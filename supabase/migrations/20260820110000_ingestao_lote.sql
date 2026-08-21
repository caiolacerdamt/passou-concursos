-- BANCO-03 · IA-17 · AD-036
--
-- A **retomada** da extracao, que o AD-036 exige de todo trabalho longo: "a
-- extracao falha no meio de um Batch, retoma por chave de dedup sem reprocessar
-- o que ja foi extraido" (edge case do M1).
--
-- A forma escolhida e uma tabela, e nao uma coluna de progresso em `provas`.
-- Com tabela, cada bloco tem estado proprio: um bloco pode estar colhido
-- enquanto o vizinho ainda espera o provedor, e reenviar a prova nao remonta
-- nenhum dos dois. Com uma coluna so, "onde parou" viraria um numero que duas
-- execucoes concorrentes escreveriam por cima uma da outra.
--
-- A `ia_geracoes` **nao** serve para isto: ela registra o que ja voltou do
-- modelo, e o que precisa ser guardado aqui e o pedido que ainda esta em voo —
-- o id do lote no provedor, que so existe entre o envio e a colheita.

create type public.status_bloco as enum (
  'montado', 'enviado', 'colhido', 'falhou'
);

create table public.prova_lote (
  id       uuid primary key default gen_random_uuid(),
  prova_id uuid not null references public.provas(id),

  -- 0-based, como o fatiamento produz. E parte do sentido da chave de dedup:
  -- mudar a base mudaria a chave de toda prova ja ingerida.
  bloco    smallint not null check (bloco >= 0),

  -- `prova:<id>:bloco:<n>:v<versao do prompt>`. A versao do prompt entra aqui
  -- pelo mesmo motivo que entra na chave do gateway (IA-14): mudar a instrucao
  -- e querer reprocessar, e sem ela a retomada acharia que ja estava feito.
  chave_dedup text not null,

  -- 1-based e inclusivo. Guardado para o operador conseguir abrir o PDF na
  -- pagina certa quando um bloco falha.
  primeira_pagina  smallint not null check (primeira_pagina >= 1),
  ultima_pagina    smallint not null check (ultima_pagina >= 1),
  tokens_estimados integer  not null check (tokens_estimados >= 0),

  status status_bloco not null default 'montado',

  -- O id do lote no provedor. Nulo antes do envio; e a unica coisa que liga a
  -- nossa linha ao trabalho que esta rodando la fora.
  lote_provedor text,
  -- Quantas questoes este bloco colheu, e quantas foram recusadas na
  -- conferencia. E o numero que diz se a prova saiu inteira.
  questoes_aceitas   integer not null default 0 check (questoes_aceitas >= 0),
  questoes_recusadas integer not null default 0 check (questoes_recusadas >= 0),
  erro text,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint prova_lote_paginas_em_ordem check (ultima_pagina >= primeira_pagina),

  -- As duas unicidades sao a retomada. A primeira e a natural; a segunda pega o
  -- caso em que a prova foi refatiada com outro teto de tokens e o mesmo indice
  -- de bloco passou a significar outro pedaco.
  constraint prova_lote_bloco_unico unique (prova_id, bloco),
  constraint prova_lote_chave_unica unique (chave_dedup),

  -- Lote enviado sem id do provedor e lote que ninguem consegue colher.
  constraint prova_lote_enviado_tem_id check (
    status in ('montado', 'falhou') or lote_provedor is not null
  )
);

comment on table public.prova_lote is
  'Um bloco de paginas da prova em voo para a Batch API (AD-036). E o que torna a extracao retomavel: reenviar nao remonta bloco que ja tem linha, e colher duas vezes nao insere questao duas vezes.';

comment on column public.prova_lote.chave_dedup is
  'prova:<id>:bloco:<n>:v<versao do prompt>. A versao do prompt entra aqui pelo mesmo motivo que entra na chave do gateway (IA-14).';

-- A fila de trabalho da colheita: o que foi enviado e ainda nao voltou.
create index prova_lote_em_voo_idx
  on public.prova_lote (prova_id, bloco)
  where status = 'enviado';

-- ── Carimbo de `atualizada_em` ──────────────────────────────────────────────
--
-- `questoes` ja carimba (no gatilho de protecao da versao); `provas` nasceu com
-- a coluna e sem o gatilho, e a divida ficou registrada para esta spec. Esta e a
-- spec que mais mexe em `provas.status`, entao "quando foi que esta prova mudou
-- de estado" passa a ser pergunta de rotina.

create or replace function public.carimba_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizada_em := now();
  return new;
end;
$$;

create trigger provas_carimba_atualizacao
  before update on public.provas
  for each row execute function public.carimba_atualizacao();

-- A mesma funcao nao serve para `prova_lote`: a coluna la chama `atualizado_em`
-- (o lote e masculino). Duas linhas em vez de uma abstracao que exigiria passar
-- o nome da coluna como argumento do gatilho.
create or replace function public.prova_lote_carimba()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger prova_lote_carimba_atualizacao
  before update on public.prova_lote
  for each row execute function public.prova_lote_carimba();

-- ── Privilegios ─────────────────────────────────────────────────────────────
--
-- Bastidor da fabrica: nem `anon` nem `authenticated` tem o que fazer aqui. RLS
-- ligada sem policy fecha o PostgREST; o `revoke all` fecha o resto, inclusive
-- TRUNCATE, que RLS nao governa (AD-084). Quem escreve e o job, com a chave de
-- servico.
revoke all on public.prova_lote from anon, authenticated;
alter table public.prova_lote enable row level security;
