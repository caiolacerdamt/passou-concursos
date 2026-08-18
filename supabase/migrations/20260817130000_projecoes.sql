-- ALUNO-02 AC1 · ALUNO-09 AC1/AC4 · ALUNO-10 AC1 · AD-044 · AD-072 · AD-084 · AD-029
--
-- A camada 2 do M4: **projecao**. Nada aqui e fato — tudo pode ser apagado e
-- reconstruido a partir de `tentativas` (camada 1). E o que o ALUNO-02 AC1 pede
-- e o primeiro Success Criteria da SPEC 06: apagar as duas projecoes, rodar o
-- job e obter os mesmos numeros.
--
-- Daí a diferenca de trava em relacao a `tentativas`:
--
--   `dominio_topico`, `caderno_erros`, `revisao_agenda`  -> mutaveis. O job
--       apaga e reescreve a cada madrugada; travar UPDATE aqui travaria o job.
--   `revisao_evento`                                     -> append-only, com a
--       trava de tres camadas do AD-084. Ele **nao** e derivavel de
--       `tentativas`: a nota de uma revisao nasce do bloco Revisar e some se a
--       linha sumir. Sem ele a agenda nao seria reconstruivel do zero (o `Card`
--       do FSRS carrega estado acumulado) e o `computeParameters` do fast-follow
--       nao teria de onde ler.
--
-- Grupo LGPD: **grupo 1** as quatro (`user_id` identificado). A rotina de
-- apagamento e da SPEC 14; o que existe aqui e a porta por onde ela passa —
-- DELETE direto nas tres mutaveis, porta nomeada `app.esquecimento_user_id` no
-- log de eventos (AD-029).

-- ── Dominio por topico (ALUNO-02) ───────────────────────────────────────────
--
-- "Quao bem este aluno vai neste topico", num numero de 0 a 1. O motor de
-- prioridade le `1 - score` como fraqueza.
--
-- `n_chute_certo` fica numa coluna propria e nao so embutido no `score` porque a
-- SPEC 19 precisa distinguir "acerta pouco" de "acerta chutando": sao remedios
-- diferentes, e um score de 0.4 nao diz qual dos dois e.

create table public.dominio_topico (
  user_id       uuid     not null,
  topico_id     uuid     not null references public.topicos(id),
  n_respostas   integer  not null,
  n_acertos     integer  not null,
  -- Anti-coasting (AD-044): acerto marcado como chute nao e maestria. O sinal
  -- cru vem de `tentativas.marcou_chute`; o desconto e feito aqui.
  n_chute_certo integer  not null,
  score         numeric(5,4) not null,
  atualizado_em timestamptz  not null default now(),

  primary key (user_id, topico_id),

  constraint dominio_contagens_nao_negativas check (
    n_respostas >= 0 and n_acertos >= 0 and n_chute_certo >= 0
  ),
  constraint dominio_acertos_cabem_nas_respostas check (n_acertos <= n_respostas),
  constraint dominio_chute_cabe_nos_acertos     check (n_chute_certo <= n_acertos),
  constraint dominio_score_entre_0_e_1          check (score between 0 and 1)
);

comment on table public.dominio_topico is
  'Projecao de dominio por topico (ALUNO-02/AD-044). Reconstruida inteira por `recalcula_projecoes()`. Grupo LGPD 1.';

comment on column public.dominio_topico.n_chute_certo is
  'Acertos marcados como chute. Descontados do score e guardados a parte: "acerta pouco" e "acerta chutando" pedem remedios diferentes (SPEC 19).';

-- ── Caderno de erros (ALUNO-10) ─────────────────────────────────────────────
--
-- Projecao pura sobre erro + causa. Nao tem decisao propria: se a linha existe,
-- e porque ha tentativa errada com aquela causa naquele topico.
--
-- A causa vem de **duas** fontes, e e por isso que `faltou_tempo` aparece aqui:
-- no treino ela esta em `tentativas.causa_erro`; no simulado ela esta em
-- `tentativa_causa_simulado`, porque a prova nao e interrompida (ALUNO-04 AC3).
-- Um caderno que lesse so a primeira perderia todo erro de simulado.

create table public.caderno_erros (
  user_id        uuid        not null,
  topico_id      uuid        not null references public.topicos(id),
  causa_erro     public.causa_erro not null,
  n_erros        integer     not null,
  ultimo_erro_em timestamptz not null,
  atualizado_em  timestamptz not null default now(),

  primary key (user_id, topico_id, causa_erro),

  constraint caderno_n_erros_positivo check (n_erros > 0)
);

comment on table public.caderno_erros is
  'Projecao de erro por topico e causa (ALUNO-10 AC1). Soma `tentativas.causa_erro` e `tentativa_causa_simulado` — e por isso `faltou_tempo` entra aqui. Grupo LGPD 1.';

-- ── Agenda de revisao (ALUNO-09) ────────────────────────────────────────────
--
-- Uma linha por aluno e topico, com **uma** coluna de data: `due`. E o contrato
-- do ALUNO-09 AC3 tornado forma — o motor de prioridade so pergunta "due <=
-- hoje?" e nao sabe qual algoritmo produziu a data.
--
-- Por isso trocar `param.m4.algoritmo_revisao` nao migra dado nenhum (AC4): as
-- linhas existentes continuam la, com o `due` que tinham, e a proxima revisao e
-- calculada pelo outro algoritmo na mesma coluna.

create table public.revisao_agenda (
  user_id       uuid    not null,
  topico_id     uuid    not null references public.topicos(id),
  -- Qual algoritmo escreveu o `due` que esta ali. Nao e configuracao (essa mora
  -- em `param.m4.algoritmo_revisao`): e registro do que de fato aconteceu, para
  -- o historico continuar legivel depois de uma troca.
  algoritmo     text    not null default 'fsrs',
  -- `Card` do ts-fsrs serializado. Nulo quando quem escreveu foi a regua fixa.
  fsrs_card     jsonb,
  -- Degrau da regua 1/3/7/14/30. Coluna propria porque derivar de
  -- `revisao_evento` daria o degrau errado depois de uma nota 1, que volta ao
  -- comeco. Ignorada pelo FSRS.
  regua_passo   smallint not null default 0,
  due           date     not null,
  ultima_nota   smallint,
  atualizado_em timestamptz not null default now(),

  primary key (user_id, topico_id),

  constraint revisao_algoritmo_conhecido check (algoritmo in ('fsrs', 'regua_fixa')),
  constraint revisao_nota_de_1_a_4       check (ultima_nota is null or ultima_nota between 1 and 4),
  constraint revisao_regua_passo_valido  check (regua_passo >= 0)
);

comment on table public.revisao_agenda is
  'Quando cada topico vence para este aluno (ALUNO-09). `due` e a MESMA coluna nos dois algoritmos: trocar FSRS por regua fixa nao migra dado (AC4). Grupo LGPD 1.';

comment on column public.revisao_agenda.due is
  'O unico dado que sai deste modulo para o motor de prioridade (ALUNO-09 AC3). Quem consome nao sabe qual algoritmo o produziu.';

-- Como o job pergunta "quem esta vencendo hoje", e nao "quando vence este topico".
create index revisao_agenda_due_idx on public.revisao_agenda (user_id, due);

-- ── Eventos de revisao (append-only) ────────────────────────────────────────
--
-- Guarda **percentual e nota**, os dois. O percentual e o fato (quanto o aluno
-- acertou no bloco); a nota e a interpretacao que as faixas de configuracao
-- deram a ele. Guardar so a nota tornaria a conversao irreversivel: recalibrar
-- as faixas depois exigiria o percentual original, que ja nao existiria. E o
-- risco registrado no design — a conversao percentual -> Rating e adaptacao
-- (AD-072), nao uso padrao do FSRS.

create table public.revisao_evento (
  id          bigint generated always as identity primary key,
  user_id     uuid     not null,
  topico_id   uuid     not null references public.topicos(id),
  algoritmo   text     not null default 'fsrs',
  nota        smallint not null,
  percentual  numeric(5,4) not null,
  revisado_em timestamptz  not null default now(),

  constraint revisao_evento_nota_de_1_a_4 check (nota between 1 and 4),
  constraint revisao_evento_percentual_0_a_1 check (percentual between 0 and 1),
  constraint revisao_evento_algoritmo_conhecido check (algoritmo in ('fsrs', 'regua_fixa'))
);

comment on table public.revisao_evento is
  'Log append-only de cada revisao fechada (AD-084). Guarda percentual E nota: sem o percentual a conversao das faixas seria irreversivel. Alimenta o computeParameters do fast-follow (ALUNO-09 AC5). Grupo LGPD 1 — apagamento pela porta `app.esquecimento_user_id` (AD-029).';

create index revisao_evento_user_idx on public.revisao_evento (user_id, topico_id, revisado_em desc);

-- ── Trava do log de eventos (AD-084) ────────────────────────────────────────
--
-- As mesmas tres camadas de `tentativas`, pelo mesmo motivo. A tabela nao e
-- particionada, entao o AD-091 nao se aplica: nao ha particao para endurecer.

revoke update, delete, truncate on public.revisao_evento from anon, authenticated;

create or replace function public.revisao_evento_bloqueia_mutacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception
      'revisao_evento e log imutavel: UPDATE proibido. Revisao corrigida = evento novo (AD-084).';
  end if;

  if current_setting('app.esquecimento_user_id', true) is distinct from old.user_id::text then
    raise exception
      'DELETE em revisao_evento so pela rotina de esquecimento: declare app.esquecimento_user_id com o titular (AD-029).';
  end if;

  return old;
end;
$$;

create or replace function public.revisao_evento_bloqueia_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'revisao_evento e log imutavel: TRUNCATE proibido (AD-084).';
end;
$$;

create trigger revisao_evento_sem_mutacao
  before update or delete on public.revisao_evento
  for each row execute function public.revisao_evento_bloqueia_mutacao();

create trigger revisao_evento_sem_truncate
  before truncate on public.revisao_evento
  for each statement execute function public.revisao_evento_bloqueia_truncate();

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Projecao e **leitura** para o aluno: quem escreve e o job (`recalcula_projecoes`,
-- rodando como dono) e a requisicao que fecha um bloco Revisar, que passa por
-- `registrar_revisao`. Nenhuma policy de INSERT/UPDATE/DELETE — ausencia de
-- policy e negacao, e e o que impede o navegador de inventar o proprio dominio.
--
-- `(select auth.uid())` e nao `auth.uid()`: avalia a funcao uma vez por consulta.

alter table public.dominio_topico  enable row level security;
alter table public.caderno_erros   enable row level security;
alter table public.revisao_agenda  enable row level security;
alter table public.revisao_evento  enable row level security;

create policy dominio_topico_le_o_proprio on public.dominio_topico
  for select to authenticated using (user_id = (select auth.uid()));

create policy caderno_erros_le_o_proprio on public.caderno_erros
  for select to authenticated using (user_id = (select auth.uid()));

create policy revisao_agenda_le_o_proprio on public.revisao_agenda
  for select to authenticated using (user_id = (select auth.uid()));

create policy revisao_evento_le_o_proprio on public.revisao_evento
  for select to authenticated using (user_id = (select auth.uid()));
