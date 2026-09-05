-- AD-133 · item 7 de docs/planos/TRIAL-2-conversao-e-telas.md
--
-- A metrica do funil, no proprio Postgres. **Sem PostHog**: o AD-079 deixou a
-- analytics da superficie logada atras de flag desligada, e uma view de leitura
-- responde a pergunta que importa por custo quase zero.
--
-- Sem isto, a decisao de trocar o funil continua sendo palpite DEPOIS do
-- lancamento tambem — e o ponto inteiro de trocar o funil era parar de chutar.
--
-- ⚠️ Isto **nao e dado de aluno** e nao vai para tela nenhuma do produto. A
-- leitura e do operador (a allowlist que a SPEC 15 criou) ou do `service_role`,
-- e a consulta e pelo Supabase Studio — painel de operador para isto e do
-- "o que este plano nao faz".

-- ── A coorte ────────────────────────────────────────────────────────────────
--
-- A semana e a de **criacao da conta**, e nao a do trial: o denominador do
-- funil e quem criou conta, inclusive quem criou e nunca confirmou o e-mail.
-- Coortar pela concessao do trial esconderia exatamente a perda que mais
-- importa medir — a que acontece antes do trial existir.
--
-- `security_invoker = on` e o que faz o `revoke` abaixo valer: sem ele a view
-- rodaria com os poderes do dono e devolveria linha para qualquer um que
-- conseguisse chama-la.

create or replace view public.funil_trial
with (security_invoker = on) as
with contas as (
  select u.id                                as user_id,
         date_trunc('week', u.created_at)    as semana,
         u.email_confirmed_at
    from auth.users u
),
trials as (
  select m.user_id,
         min(m.inicio_em) as trial_em
    from public.matriculas m
   where m.tipo = 'trial'
   group by m.user_id
),
-- Uso real: quantas tentativas, e em quantos dias distintos. O "≥3 dias ativos"
-- do plano e o sinal de habito — responder 40 questoes numa tarde e curiosidade,
-- responder em 3 dias diferentes e rotina.
uso as (
  select t.user_id,
         count(*)                                                     as n_tentativas,
         count(distinct (t.respondida_em at time zone 'America/Sao_Paulo')::date) as n_dias
    from public.tentativas t
   group by t.user_id
),
-- "Converteu" e pagamento confirmado, nao matricula paga criada: matricula
-- nasce de varios caminhos (cortesia, correcao manual), e so o pagamento
-- responde a pergunta de negocio.
pagos as (
  select p.user_id,
         min(p.confirmado_em) as pagou_em
    from public.pagamentos p
   where p.user_id is not null
     and p.confirmado_em is not null
   group by p.user_id
)
select
  c.semana,
  count(*)                                                   as contas_criadas,
  count(*) filter (where c.email_confirmed_at is not null)   as emails_confirmados,
  count(t.user_id)                                           as trials_concedidos,
  count(*) filter (where coalesce(u.n_tentativas, 0) >= 1)   as com_ao_menos_1_tentativa,
  count(*) filter (where coalesce(u.n_dias, 0) >= 3)         as com_3_dias_ativos,
  count(g.user_id)                                           as convertidos,
  -- Mediana, e nao media: uma conversao tardia isolada puxa a media inteira e
  -- faz o funil parecer mais lento do que e.
  round(
    percentile_cont(0.5) within group (
      order by extract(epoch from (g.pagou_em - t.trial_em)) / 86400.0
    )::numeric,
    1
  )                                                          as dias_ate_converter_mediana
from contas c
left join trials t on t.user_id = c.user_id
left join uso    u on u.user_id = c.user_id
left join pagos  g on g.user_id = c.user_id
group by c.semana
order by c.semana desc;

comment on view public.funil_trial is
  'Funil do trial por semana de coorte de CRIACAO DA CONTA (AD-133): contas criadas, e-mails confirmados, trials concedidos, com >=1 tentativa, com >=3 dias ativos, convertidos em pagamento e a mediana de dias ate converter. Leitura de operador ou service_role — nao e dado de aluno e nao vai para tela do produto.';

-- ── Quem pode ler ───────────────────────────────────────────────────────────
--
-- `authenticated` **nao** pode: e um agregado de toda a base, e a view roda com
-- os poderes de quem chama. Um aluno lendo isto veria a operacao inteira.

revoke all on public.funil_trial from public, anon, authenticated;
grant select on public.funil_trial to service_role;

-- A allowlist do operador nao e um papel do Postgres — ela e uma tabela, e a
-- checagem acontece na aplicacao (`exigir_operador_ativo`). Para o operador ler
-- pelo Studio, a leitura passa por esta funcao, que confere a allowlist e so
-- entao devolve as linhas.

create or replace function public.funil_trial_do_operador()
returns setof public.funil_trial
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exigir_operador_ativo((select auth.uid()));
  return query select * from public.funil_trial;
end;
$$;

comment on function public.funil_trial_do_operador() is
  'A view funil_trial para um operador ativo da allowlist da SPEC 15. Recusa com operador_nao_autorizado para qualquer outra conta autenticada (AD-133).';

revoke all on function public.funil_trial_do_operador() from public, anon;
grant execute on function public.funil_trial_do_operador() to authenticated, service_role;
