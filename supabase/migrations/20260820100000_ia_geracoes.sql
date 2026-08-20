-- IA-14 · IA-02 (AC4, AC8) · IA-12 · AD-036 · AD-073
--
-- O registro de tudo que a IA gerou. Serve tres coisas de uma vez, e por isso e
-- uma tabela so:
--
--   1. **Dedup** (IA-14): `chave_dedup` unica. Rerodar a fabrica nao regera nem
--      cobra de novo o que ja existe — o gateway acha a linha e devolve o
--      `resultado` de antes, sem encostar no provedor.
--   2. **Auditoria** (IA-02 AC4): com que modelo, que versao, que esforco e que
--      versao de prompt cada coisa nasceu. Sem isso, uma explicacao errada em
--      producao nao tem como ser rastreada ate a instrucao que a produziu.
--   3. **Gasto** (IA-12): tokens e custo por chamada, somados por mes.
--
-- **Nao tem `user_id` de proposito.** Tarefa de aluno (frase do plano, tutor)
-- grava aqui so o metadado — `resultado` nulo e `chave_dedup` nula — para o
-- texto pessoal nao ganhar uma segunda copia fora da tabela que ja o guarda e
-- ja esta no inventario do grupo 1. Quem quiser mudar isso mexe no AD-027 antes.

create table public.ia_geracoes (
  id bigint generated always as identity primary key,

  -- **Nula e caso normal**, nao excecao: e o que diz "esta chamada nao se
  -- reaproveita". Unicidade em Postgres deixa passar quantas nulas quiser, que
  -- e exatamente o que se quer aqui.
  chave_dedup   text,

  tarefa        text not null,

  -- Preenchidos so quando a tarefa e de questao (extracao, explicacao,
  -- verificacao, classificacao). Sem FK: a geracao sobrevive a questao ser
  -- apagada, e o par (id, versao) e a PK de `questoes` — uma FK aqui obrigaria
  -- a linha a morrer junto, perdendo o registro de que houve gasto.
  questao_id     uuid,
  questao_versao integer,

  -- O que a configuracao mandou usar. Texto puro: o banco nao conhece modelo
  -- nenhum, do mesmo jeito que o codigo nao conhece (IA-02 AC1).
  modelo         text not null,
  modelo_versao  text not null,
  esforco        text not null,
  versao_prompt  text not null,

  batch          boolean not null default false,
  -- IA-02 AC5: o fallback assumiu? A linha e o registro do evento.
  usou_fallback  boolean not null default false,

  tokens_entrada    integer,
  tokens_cacheados  integer,
  tokens_saida      integer,
  -- Nulo = nao havia preco na configuracao para este modelo. Preco ausente
  -- **nao** impede a chamada; so deixa a soma do mes incompleta, e isso e
  -- reportado (IA-12).
  custo_usd         numeric(12, 6),

  resultado  jsonb,
  criada_em  timestamptz not null default now(),

  constraint ia_geracoes_chave_dedup_unica unique (chave_dedup),
  constraint ia_geracoes_questao_completa check (
    (questao_id is null) = (questao_versao is null)
  ),
  constraint ia_geracoes_tokens_nao_negativos check (
    coalesce(tokens_entrada, 0)   >= 0 and
    coalesce(tokens_cacheados, 0) >= 0 and
    coalesce(tokens_saida, 0)     >= 0
  )
);

comment on table public.ia_geracoes is
  'Toda geracao que passou pelo gateway (SPEC 08). Dedup (IA-14) + auditoria de modelo/versao/esforco/prompt (IA-02 AC4) + base do gasto mensal (IA-12). Sem user_id de proposito: tarefa de aluno grava so metadado.';

comment on column public.ia_geracoes.chave_dedup is
  'questao_id + questao_versao + tarefa + versao do prompt (IA-14). Nula = chamada que nao se reaproveita, como a frase do plano, cuja idempotencia e `frase is null`.';

comment on column public.ia_geracoes.usou_fallback is
  'O modelo principal falhou e o fallback assumiu (IA-02 AC5). Contar estas linhas e como se percebe um provedor degradado antes do aluno perceber.';

-- A soma do mes e a unica consulta quente da tabela.
create index ia_geracoes_criada_idx on public.ia_geracoes (criada_em desc);
create index ia_geracoes_tarefa_idx on public.ia_geracoes (tarefa, criada_em desc);

-- ── Alerta de gasto ─────────────────────────────────────────────────────────
--
-- IA-12: alerta **uma vez** por periodo quando o gasto passa do teto, e
-- **SHALL NOT** desligar nada sozinho.
--
-- "Uma vez" e a PK, nao um `if` no codigo. Job que roda de novo, duas execucoes
-- simultaneas, reinicio no meio — nada disso produz um segundo e-mail, porque o
-- segundo INSERT e recusado pelo banco. Um contador em memoria nao sobreviveria
-- a nenhum dos tres.

create table public.ia_alerta_de_gasto (
  periodo     text primary key,
  gasto_usd   numeric(12, 2) not null,
  teto_usd    numeric(12, 2) not null,
  alertado_em timestamptz not null default now(),

  constraint ia_alerta_periodo_mensal check (periodo ~ '^\d{4}-\d{2}$')
);

comment on table public.ia_alerta_de_gasto is
  'Um alerta de gasto por mes (IA-12). O periodo e a PK: "alertar uma vez" e garantia do banco, nao disciplina do codigo. Passar do teto SHALL NOT desligar tarefa nenhuma.';

-- ── Privilegios ─────────────────────────────────────────────────────────────
--
-- Nem `anon` nem `authenticated` tem o que fazer aqui: e tabela de bastidor. RLS
-- ligada e sem policy nenhuma fecha a porta do PostgREST; o `revoke` fecha a de
-- baixo, inclusive TRUNCATE, que RLS nao governa (a mesma licao de
-- `configuracoes`). Quem escreve e o gateway, com a chave de servico.

revoke all on public.ia_geracoes        from anon, authenticated;
revoke all on public.ia_alerta_de_gasto from anon, authenticated;

alter table public.ia_geracoes        enable row level security;
alter table public.ia_alerta_de_gasto enable row level security;
