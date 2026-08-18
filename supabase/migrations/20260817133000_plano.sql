-- ALUNO-05 AC1 · ALUNO-08 · ALUNO-11 · ALUNO-12 · AD-044 · AD-056/AD-057
--
-- A camada 3: o plano. Saida do motor de prioridade, escrito por regra/SQL.
--
-- Tres tabelas e uma view, e a view e a peca mais importante do arquivo:
-- `raiox_peso_topico` e a **fronteira** entre o plano (M4) e o Raio-X (M5). Ela
-- devolve 1.0 hoje e a SPEC 11 troca o corpo dela por frequencia real **sem
-- tocar no motor do plano**. Fixar essa fronteira agora e o que evita que o
-- calculo do Raio-X nasca espalhado dentro do `gera_plano_do_dia()`.

-- ── Perfil de estudo (ALUNO-05 AC1) ─────────────────────────────────────────
--
-- E o caminho de quem **pula o diagnostico**: declarar o nivel e dizer quantos
-- minutos tem por dia ja basta para o plano do 1o dia existir. O diagnostico
-- adaptativo de ~20 questoes e da SPEC 13 e nasce atras de flag desligada
-- (AD-076) — este perfil e o que faz o produto funcionar sem ele.
--
-- `minutos_por_dia` e `not null` de proposito: e o unico numero do motor que
-- **so o aluno** pode dar. Sem ele nao ha corte por tempo, e o plano viraria uma
-- lista infinita.

create table public.perfil_estudo (
  user_id         uuid primary key,
  nivel_declarado text,
  minutos_por_dia integer not null,
  -- Lido pelo M6 (AD-061). Nulo no BB sem edital publicado — e o normal, nao
  -- excecao: o produto existe antes do edital sair.
  data_prova      date,
  atualizado_em   timestamptz not null default now(),

  constraint perfil_nivel_conhecido check (
    nivel_declarado is null
    or nivel_declarado in ('iniciante', 'intermediario', 'avancado')
  ),
  constraint perfil_minutos_positivos check (minutos_por_dia > 0)
);

comment on table public.perfil_estudo is
  'O que o aluno declarou sobre si (ALUNO-05 AC1). E o caminho de quem pula o diagnostico: nivel + minutos por dia bastam para o plano do 1o dia. Grupo LGPD 1.';

comment on column public.perfil_estudo.minutos_por_dia is
  'O unico numero do motor que so o aluno pode dar. Sem ele nao ha corte por tempo e o plano vira lista infinita.';

-- ── Plano do dia ────────────────────────────────────────────────────────────

create type public.bloco_tipo  as enum ('revisar', 'avancar', 'treinar', 'simulado');
create type public.plano_nivel as enum ('piso', 'meta_cheia');

create table public.plano_dia (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null,
  data      date not null,
  -- **Anulavel, e isso e um requisito, nao descuido** (ALUNO-05 AC4 / ALUNO-12):
  -- a frase de abertura e escrita por IA (SPEC 08) e o nucleo nao depende de IA
  -- ao vivo (invariante nº7). Se a chamada falhar, `frase` fica nula e o plano e
  -- entregue assim mesmo.
  frase     text,
  gerado_em timestamptz not null default now(),

  -- Um plano por aluno por dia. E o que faz rerodar o job **substituir** em vez
  -- de duplicar (ALUNO-07, idempotencia).
  constraint plano_dia_unico unique (user_id, data)
);

comment on table public.plano_dia is
  'O plano de um aluno num dia (AD-044). `frase` nula = a IA nao respondeu e o plano vale assim mesmo (invariante nº7). Grupo LGPD 1.';

create table public.plano_bloco (
  id                uuid primary key default gen_random_uuid(),
  plano_dia_id      uuid not null references public.plano_dia(id) on delete cascade,
  tipo              public.bloco_tipo  not null,
  -- ALUNO-11: os dois niveis que o M6 consome. `piso` mantem a sequencia (so as
  -- revisoes devidas); `meta_cheia` enche o anel do dia. O mesmo plano emite os
  -- dois, e por isso o par (nivel, ordem) e que e unico, nao a ordem sozinha.
  nivel             public.plano_nivel not null,
  ordem             integer not null,
  -- Nulo no bloco `treinar`, que mistura assuntos de proposito (ALUNO-08 AC3).
  topico_id         uuid references public.topicos(id),
  minutos_estimados integer not null,
  -- ALUNO-08 AC5: o porque, em texto, quando a revisao manda revisar em vez de
  -- avancar. Escrito por regra — nao e a frase da IA, que mora em `plano_dia`.
  motivo            text,

  constraint plano_bloco_ordem_unica unique (plano_dia_id, nivel, ordem),
  constraint plano_bloco_ordem_positiva check (ordem >= 1),
  constraint plano_bloco_minutos_positivos check (minutos_estimados > 0)
);

comment on column public.plano_bloco.nivel is
  'piso = so as revisoes devidas, o que mantem a sequencia. meta_cheia = o dia inteiro cabendo em minutos_por_dia. Contrato consumido pela SPEC 19 (ALUNO-11).';

comment on column public.plano_bloco.motivo is
  'O porque, por regra (ALUNO-08 AC5). Nao confundir com `plano_dia.frase`, que e a unica coisa que a IA escreve neste modulo.';

create index plano_bloco_plano_idx on public.plano_bloco (plano_dia_id, nivel, ordem);
create index plano_dia_user_data_idx on public.plano_dia (user_id, data desc);

-- ── A coluna que a SPEC 05 deixou para ca ───────────────────────────────────
--
-- `sessoes` nasceu sem `plano_dia_id` porque `plano_dia` e desta spec, e uma
-- spec so depende de spec de numero menor (ROADMAP). Agora que a tabela existe,
-- a ligacao entra. Anulavel: sessao de treino livre nao pertence a plano nenhum.

alter table public.sessoes
  add column plano_dia_id uuid references public.plano_dia(id) on delete set null;

comment on column public.sessoes.plano_dia_id is
  'De qual plano do dia esta sessao saiu. Nulo em treino livre. `set null` e nao `cascade`: apagar o plano nao pode levar junto o registro de que o aluno estudou.';

-- ── A fronteira com o M5 (AD-056/AD-057) ────────────────────────────────────
--
-- **Stub por escolha, nao por preguica.** O peso do Raio-X e "quanto este
-- assunto cai na prova", e calcula-lo exige frequencia real sobre `origem =
-- 'real'` — que e a SPEC 11. O que esta spec entrega e a **assinatura**:
-- `(topico_id, peso)`. A SPEC 11 troca o corpo desta view e o
-- `gera_plano_do_dia()` nao muda uma linha.
--
-- Com 1.0 para todo tópico, a ordenacao do plano fica so por fraqueza e por
-- revisao devida. E o comportamento aceito ate a SPEC 11 — o AD-076 exige a
-- conta do Raio-X ligada no dia 1, e a SPEC 11 e pre-lancamento por isso.

create view public.raiox_peso_topico with (security_invoker = true) as
  select t.id as topico_id, 1.0::numeric as peso
    from public.topicos t
   where t.ativo;

comment on view public.raiox_peso_topico is
  'FRONTEIRA M4 <-> M5 (AD-056/AD-057). Devolve 1.0 por enquanto; a SPEC 11 substitui o corpo por frequencia real MANTENDO a assinatura (topico_id, peso). Nenhuma outra parte do plano fala com o Raio-X.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Assimetria proposital:
--   `perfil_estudo` — o aluno **escreve**. E declaracao dele sobre ele.
--   `plano_dia` / `plano_bloco` — o aluno so **le**. Quem escreve e o job; um
--       aluno que pudesse editar o proprio plano poderia se dar meta zero e
--       manter a sequencia sem estudar.

alter table public.perfil_estudo enable row level security;
alter table public.plano_dia     enable row level security;
alter table public.plano_bloco   enable row level security;

create policy perfil_estudo_do_proprio on public.perfil_estudo
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy plano_dia_le_o_proprio on public.plano_dia
  for select to authenticated using (user_id = (select auth.uid()));

create policy plano_bloco_le_o_proprio on public.plano_bloco
  for select to authenticated
  using (
    exists (
      select 1 from public.plano_dia p
       where p.id = plano_dia_id and p.user_id = (select auth.uid())
    )
  );

revoke truncate on public.perfil_estudo, public.plano_dia, public.plano_bloco
  from anon, authenticated;
