-- AD-133 · item 6 de docs/planos/TRIAL-2-conversao-e-telas.md
--
-- Os quatro e-mails do trial: dia 0 (conta criada), dia 3 (o que ja foi
-- construido), dia 6 (amanha o acesso fecha) e dia 8 (o resumo e o link).
--
-- **`pg_cron` nao fala HTTP.** O que roda aqui e um job leve e diario que
-- **enfileira**; quem envia e `scripts/jobs/emails-do-trial.mts`, disparado por
-- GitHub Actions (AD-036 — nunca serverless), pela API do Resend (AD-105).
--
-- Base legal: estes quatro sao **execucao do servico que a pessoa pediu**, nao
-- marketing. Qualquer e-mail alem destes (novidade, promocao, conteudo) e
-- marketing e exige opt-in — invariante nº9 do AGENTS.md. Nao misturar as duas
-- coisas na mesma lista.

create type public.trial_email_tipo as enum ('dia_0', 'dia_3', 'dia_6', 'dia_8');

-- ── A fila ──────────────────────────────────────────────────────────────────
--
-- O `unique (user_id, tipo)` e o que garante "os quatro saem uma vez cada": nao
-- e uma checagem no codigo do job, que um retry duplicaria — e a forma da
-- tabela. Enfileirar duas vezes o dia_3 do mesmo aluno e um no-op.
--
-- `contexto` guarda os numeros **no momento em que a linha nasce**. Calcula-los
-- na hora do envio faria o e-mail do dia 3 contar o dia 4 se o job atrasasse.

create table public.trial_emails_pendentes (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  tipo           public.trial_email_tipo not null,
  email          text not null,
  contexto       jsonb not null default '{}'::jsonb,
  enfileirado_em timestamptz not null default now(),
  enviado_em     timestamptz,
  n_tentativas   smallint not null default 0,
  ultimo_erro    text,

  constraint trial_emails_um_de_cada unique (user_id, tipo),
  constraint trial_emails_email_normalizado
    check (email = lower(btrim(email)) and length(email) between 3 and 320)
);

create index trial_emails_pendentes_a_enviar
  on public.trial_emails_pendentes (enfileirado_em)
  where enviado_em is null;

comment on table public.trial_emails_pendentes is
  'Fila dos quatro e-mails do ciclo do trial (AD-133). pg_cron enfileira, o job do GitHub Actions envia pela API do Resend. O unique (user_id, tipo) e o que garante um de cada por conta, na vida — nao uma checagem no codigo.';

-- Ninguem alem do job le esta fila: ela tem e-mail de titular em cada linha.
alter table public.trial_emails_pendentes enable row level security;
revoke all on public.trial_emails_pendentes from public, anon, authenticated;
grant select, update on public.trial_emails_pendentes to service_role;

-- ── Quem enfileira ──────────────────────────────────────────────────────────
--
-- Roda uma vez por dia. Para cada matricula de trial, calcula em que dia do
-- ciclo o aluno esta e enfileira o e-mail daquele degrau, se ele ainda nao foi
-- enfileirado.
--
-- **O teto de 1 e-mail/dia (invariante nº14) e estrutural**: os degraus sao
-- 0, 3, 6 e 8, entao dois nunca caem no mesmo dia por construcao. A guarda
-- explicita contra "ja tem linha de hoje" existe mesmo assim, porque a
-- construcao deixa de valer no dia em que alguem acrescentar um degrau.

create or replace function public.enfileirar_emails_do_trial()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enfileirados integer := 0;
begin
  with ciclo as (
    select m.user_id,
           lower(btrim(u.email)) as email,
           -- Dias inteiros desde o inicio, no fuso do produto: o "dia 3" do
           -- aluno e o terceiro dia dele, nao 72 horas cravadas em UTC.
           (
             (now() at time zone 'America/Sao_Paulo')::date
             - (m.inicio_em at time zone 'America/Sao_Paulo')::date
           ) as dia
      from public.matriculas m
      join auth.users u on u.id = m.user_id
     where m.tipo = 'trial'
       and u.email is not null
       and u.email_confirmed_at is not null
       -- Uma conta que ja pagou nao recebe "seu teste vai acabar".
       and not exists (
             select 1 from public.pagamentos p
              where p.user_id = m.user_id and p.confirmado_em is not null)
  ),
  degrau as (
    select c.user_id,
           c.email,
           case c.dia
             when 0 then 'dia_0'
             when 3 then 'dia_3'
             when 6 then 'dia_6'
             when 8 then 'dia_8'
           end::public.trial_email_tipo as tipo
      from ciclo c
     where c.dia in (0, 3, 6, 8)
  ),
  -- Os numeros do proprio aluno, congelados no instante em que a linha nasce.
  numeros as (
    select d.user_id,
           d.email,
           d.tipo,
           jsonb_build_object(
             'questoes',  coalesce((select count(*) from public.tentativas t
                                     where t.user_id = d.user_id), 0),
             'acertos',   coalesce((select count(*) from public.tentativas t
                                     where t.user_id = d.user_id and t.correta), 0),
             'dias',      coalesce((select count(distinct
                                      (t.respondida_em at time zone 'America/Sao_Paulo')::date)
                                     from public.tentativas t
                                     where t.user_id = d.user_id), 0),
             'assuntos',  coalesce((select count(*) from public.dominio_topico g
                                     where g.user_id = d.user_id), 0),
             'caderno',   coalesce((select count(distinct e.topico_id)
                                     from public.caderno_erros e
                                     where e.user_id = d.user_id), 0),
             'revisoes',  coalesce((select count(*) from public.revisao_agenda r
                                     where r.user_id = d.user_id), 0)
           ) as contexto
      from degrau d
     -- Teto de 1 e-mail/dia por aluno, explicito. Hoje ele nunca dispara —
     -- os degraus 0/3/6/8 nao colidem — e e por isso que ele fica: no dia em
     -- que alguem acrescentar um degrau, e ele que segura o invariante.
     where not exists (
             select 1 from public.trial_emails_pendentes f
              where f.user_id = d.user_id
                and coalesce(f.enviado_em, f.enfileirado_em)::date
                    = (now() at time zone 'America/Sao_Paulo')::date)
  ),
  inseridos as (
    insert into public.trial_emails_pendentes (user_id, tipo, email, contexto)
    select n.user_id, n.tipo, n.email, n.contexto from numeros n
    on conflict (user_id, tipo) do nothing
    returning 1
  )
  select count(*) into v_enfileirados from inseridos;

  return v_enfileirados;
end;
$$;

comment on function public.enfileirar_emails_do_trial() is
  'Enfileira o e-mail do degrau do dia (0, 3, 6, 8) para cada trial em curso, com os numeros do aluno congelados no contexto (AD-133). Nao envia nada: pg_cron nao fala HTTP.';

revoke all on function public.enfileirar_emails_do_trial() from public, anon, authenticated;
grant execute on function public.enfileirar_emails_do_trial() to service_role;

-- ── O cron ──────────────────────────────────────────────────────────────────
--
-- 11:00 UTC = 08:00 BRT. Depois do plano do dia (06:30 UTC) e da sequencia
-- (07:00 UTC), para que o e-mail do dia 3 conte um dia ja fechado.

select cron.schedule(
  'm8-enfileira-emails-do-trial',
  '0 11 * * *',
  $trial$ select public.enfileirar_emails_do_trial(); $trial$
);
