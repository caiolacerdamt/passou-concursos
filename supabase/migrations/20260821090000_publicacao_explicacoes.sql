-- SPEC 10 · BANCO-07 · IA-04 · IA-05
--
-- A fila, a base e a explicacao sao acervo de operacao. Nenhuma delas tem
-- `user_id`: sao dados de conteudo e nao entram no grupo 1 da LGPD.

create type public.status_revisao_questao as enum ('pendente', 'aprovada', 'rejeitada');
create type public.origem_base_referencia as enum ('oficial', 'resumo_nosso');
create type public.status_base_referencia as enum ('rascunho', 'conferido');
create type public.status_explicacao as enum (
  'rascunho', 'aprovada', 'em_revisao', 'rejeitada', 'invalidada'
);

-- Uma linha pendente por motivo e versao. A decisao final fica na mesma linha
-- para a fila poder ser operada pelo Supabase Studio sem uma segunda tabela.
create table public.questao_revisoes (
  id              bigint generated always as identity primary key,
  questao_id      uuid not null,
  questao_versao  integer not null check (questao_versao >= 1),
  motivo          text not null check (length(btrim(motivo)) > 0),
  prioridade      smallint not null default 0 check (prioridade >= 0),
  status          public.status_revisao_questao not null default 'pendente',
  observacao      text,
  criada_em       timestamptz not null default now(),
  decidido_por    uuid references auth.users(id),
  decidida_em     timestamptz,

  constraint questao_revisao_questao_fk
    foreign key (questao_id, questao_versao)
    references public.questoes(id, questao_versao),
  constraint questao_revisao_decisao_completa check (
    (status = 'pendente' and decidido_por is null and decidida_em is null)
    or
    (status in ('aprovada', 'rejeitada') and decidido_por is not null and decidida_em is not null)
  )
);

comment on table public.questao_revisoes is
  'Fila unica de revisao do acervo (BANCO-07/IA-04). Motivo, prioridade, decisao, operador e data ficam juntos.';

create unique index questao_revisoes_uma_pendente
  on public.questao_revisoes (questao_id, questao_versao, motivo)
  where status = 'pendente';

create index questao_revisoes_pendentes_idx
  on public.questao_revisoes (prioridade desc, criada_em)
  where status = 'pendente';

-- Base pequena e curada por topico. A prioridade oficial x resumo e decidida
-- na consulta da fabrica, nao por um default que possa ficar esquecido.
create table public.base_referencia (
  id              uuid primary key default gen_random_uuid(),
  topico_id       uuid not null references public.topicos(id),
  titulo          text not null check (length(btrim(titulo)) > 0),
  conteudo        text not null check (length(btrim(conteudo)) > 0),
  origem          public.origem_base_referencia not null,
  status          public.status_base_referencia not null default 'rascunho',
  fonte_citacao   jsonb,
  conferido_por   uuid references auth.users(id),
  conferido_em    timestamptz,
  criada_em       timestamptz not null default now(),
  atualizada_em   timestamptz not null default now(),

  constraint base_referencia_conferencia_completa check (
    (status = 'rascunho' and conferido_por is null and conferido_em is null)
    or
    (status = 'conferido' and conferido_por is not null and conferido_em is not null)
  ),
  constraint base_referencia_fonte_objeto check (
    fonte_citacao is null or jsonb_typeof(fonte_citacao) = 'object'
  )
);

comment on table public.base_referencia is
  'Documentos pequenos por topico para grounding (IA-05). Oficial conferido tem prioridade sobre resumo conferido.';

create index base_referencia_por_topico_idx
  on public.base_referencia (topico_id, status, origem);

-- A explicacao e um fato do acervo, amarrado ao mesmo par que uma tentativa
-- responde. `chave_dedup` tambem liga a linha ao registro de gasto/auditoria de
-- `ia_geracoes`, sem uma FK que faria o historico desaparecer junto.
create table public.explicacoes (
  id                  uuid primary key default gen_random_uuid(),
  questao_id          uuid not null,
  questao_versao      integer not null check (questao_versao >= 1),
  explicacao_versao   integer not null default 1 check (explicacao_versao >= 1),
  vigente             boolean not null default true,
  status              public.status_explicacao not null default 'rascunho',
  texto               text not null check (length(btrim(texto)) > 0),
  alternativa_correta text not null check (length(btrim(alternativa_correta)) > 0),
  fontes_citadas      jsonb not null default '[]'::jsonb,
  base_referencia_id  uuid references public.base_referencia(id),
  chave_dedup         text not null,
  criada_em           timestamptz not null default now(),
  atualizada_em       timestamptz not null default now(),

  constraint explicacoes_questao_fk
    foreign key (questao_id, questao_versao)
    references public.questoes(id, questao_versao),
  constraint explicacoes_fontes_array check (jsonb_typeof(fontes_citadas) = 'array'),
  constraint explicacoes_aprovada_tem_fonte check (
    status <> 'aprovada' or jsonb_array_length(fontes_citadas) > 0
  ),
  constraint explicacoes_chave_unica unique (chave_dedup)
);

comment on table public.explicacoes is
  'Explicacao pre-computada por questao-versao, com status e citacoes conferidas (IA-04/IA-01).';

create unique index explicacoes_uma_vigente
  on public.explicacoes (questao_id, questao_versao)
  where vigente;

create index explicacoes_por_questao_idx
  on public.explicacoes (questao_id, questao_versao, status);

-- O navegador nunca escreve nem lê conteúdo de operação. Os jobs usam a
-- conexao de serviço e as próximas telas terão policies próprias.
revoke all on public.questao_revisoes from anon, authenticated;
revoke all on public.base_referencia from anon, authenticated;
revoke all on public.explicacoes from anon, authenticated;

alter table public.questao_revisoes enable row level security;
alter table public.base_referencia enable row level security;
alter table public.explicacoes enable row level security;

