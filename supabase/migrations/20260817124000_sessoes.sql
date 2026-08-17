-- ALUNO-04 AC3 · AD-043 · edge case do duplo-clique
--
-- As tabelas que cercam o log. Elas sao **mutaveis** de proposito — e o contraste
-- que define `tentativas`: o que muda vive aqui, o que nao muda vive la.
--
-- `sessoes` guarda a visita; `sessao_itens` guarda o que foi oferecido naquela
-- visita e e onde o dedup acontece; `tentativa_causa_simulado` recebe a causa
-- declarada depois da prova, sem tocar no fato.
--
-- **Fronteira com a SPEC 06:** `sessoes` NAO tem `plano_dia_id`. A tabela
-- `plano_dia` e da SPEC 06, e uma spec so pode depender de spec de numero menor
-- (ROADMAP). A coluna entra la, junto da tabela que ela referencia.
--
-- Grupo LGPD: **grupo 1** as tres (`sessao_itens` some por cascade de `sessoes`).

create table public.sessoes (
  id           uuid               primary key default gen_random_uuid(),
  user_id      uuid               not null,
  contexto     contexto_tentativa not null,
  iniciada_em  timestamptz        not null default now(),
  -- Nulo enquanto a sessao esta aberta. Sair no meio nao desfaz nada: as
  -- tentativas ja gravadas ficam, e os itens sem resposta simplesmente nunca
  -- foram respondidos.
  encerrada_em timestamptz,

  constraint sessao_encerra_depois_de_comecar
    check (encerrada_em is null or encerrada_em >= iniciada_em)
);

comment on table public.sessoes is
  'Visita do aluno a um bloco de questoes. Mutavel — o oposto de `tentativas`. Grupo LGPD 1.';

create index sessoes_user_idx on public.sessoes (user_id, iniciada_em desc);

create table public.sessao_itens (
  id             uuid    primary key default gen_random_uuid(),
  sessao_id      uuid    not null references public.sessoes(id) on delete cascade,
  questao_id     uuid    not null,
  questao_versao integer not null,
  ordem          integer not null check (ordem >= 1),

  -- O campo do dedup (edge case do duplo-clique). `registrarTentativa` faz
  -- `update ... where respondido_em is null`: quem chega em segundo nao encontra
  -- linha e sabe que a resposta ja foi registrada.
  --
  -- Por que aqui e nao um UNIQUE em `tentativas`: constraint unica em tabela
  -- particionada tem de conter a chave de particao, e `(sessao_id, questao_id,
  -- respondida_em)` deixaria passar dois cliques com milissegundos de diferenca.
  respondido_em  timestamptz,

  constraint sessao_itens_questao_fk
    foreign key (questao_id, questao_versao)
    references public.questoes (id, questao_versao) on delete restrict,

  constraint sessao_itens_ordem_unica  unique (sessao_id, ordem),
  -- A mesma questao duas vezes na mesma sessao e erro de montagem do bloco, e
  -- tornaria o dedup ambiguo: dois itens candidatos para a mesma resposta.
  constraint sessao_itens_questao_unica unique (sessao_id, questao_id)
);

comment on column public.sessao_itens.respondido_em is
  'Carimbo do dedup. `update ... where respondido_em is null` e o que garante uma tentativa por duplo-clique.';

create index sessao_itens_sessao_idx on public.sessao_itens (sessao_id, ordem);

-- ── Causa do simulado (ALUNO-04 AC3) ────────────────────────────────────────
--
-- No simulado a prova nao pode ser interrompida para perguntar "por que errou".
-- A causa e coletada na revisao pos-prova — e, como `tentativas` nao aceita
-- UPDATE, ela vive aqui. Tabela vizinha, nunca coluna alterada.
--
-- E o unico lugar do sistema onde `faltou_tempo` entra: no treino esse valor nao
-- faz sentido (nao ha cronometro), e por isso `tentativas` o recusa por CHECK.

create table public.tentativa_causa_simulado (
  id            uuid         primary key default gen_random_uuid(),
  tentativa_id  uuid         not null,
  -- A chave de particao faz parte da PK de `tentativas`, entao a referencia
  -- precisa dos dois campos. Carregar `respondida_em` aqui e o que fecha a FK.
  respondida_em timestamptz  not null,
  user_id       uuid         not null,
  causa_erro    causa_erro   not null,
  causa_origem  causa_origem not null default 'aluno',
  declarada_em  timestamptz  not null default now(),

  constraint tentativa_causa_simulado_tentativa_fk
    foreign key (tentativa_id, respondida_em)
    references public.tentativas (id, respondida_em) on delete cascade,

  -- Uma causa por tentativa. Mudar de ideia e UPDATE **aqui**, o que e legitimo:
  -- esta tabela e a declaracao do aluno, nao o fato da resposta.
  constraint tentativa_causa_simulado_unica unique (tentativa_id)
);

comment on table public.tentativa_causa_simulado is
  'Causa declarada na revisao pos-prova (ALUNO-04 AC3/AD-043). Tabela vizinha: a tentativa original nunca e tocada. Unico lugar onde `faltou_tempo` e aceito. Grupo LGPD 1.';

create index tentativa_causa_simulado_user_idx
  on public.tentativa_causa_simulado (user_id, declarada_em desc);

-- ── Privilegios e RLS ───────────────────────────────────────────────────────
--
-- Diferente de `tentativas`: aqui UPDATE e DELETE sao operacoes legitimas — a
-- sessao encerra, o item recebe o carimbo, a causa e corrigida. O que a RLS faz
-- e limitar tudo isso ao proprio aluno.
--
-- `sessao_itens` nao tem `user_id`: o dono e o da sessao, e a policy pergunta
-- por ele. Duplicar `user_id` aqui criaria duas fontes que podem divergir.

revoke truncate on public.sessoes, public.sessao_itens, public.tentativa_causa_simulado
  from anon, authenticated;

alter table public.sessoes                  enable row level security;
alter table public.sessao_itens             enable row level security;
alter table public.tentativa_causa_simulado enable row level security;

create policy sessoes_do_proprio on public.sessoes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy sessao_itens_do_proprio on public.sessao_itens
  for all to authenticated
  using (
    exists (
      select 1 from public.sessoes s
       where s.id = sessao_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessoes s
       where s.id = sessao_id and s.user_id = (select auth.uid())
    )
  );

create policy causa_simulado_do_proprio on public.tentativa_causa_simulado
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
