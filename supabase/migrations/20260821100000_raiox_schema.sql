-- RAIOX-05 · RAIOX-08 · AD-100
--
-- O perfil do concurso e a projeção do Raio-X são dados globais do produto,
-- não dados pessoais de um aluno. O operador/fábrica escreve pelo serviço; a
-- área logada lê um DTO produzido no servidor.

create type public.raiox_tendencia as enum ('subindo', 'estavel', 'caindo');

create table public.perfil_concurso (
  id              uuid primary key default gen_random_uuid(),
  orgao           text not null check (length(btrim(orgao)) > 0),
  banca           text not null default 'indefinida'
                    check (length(btrim(banca)) > 0),
  -- No MVP, o programa é a lista de IDs canônicos. Citações e redação entram
  -- no pivot do edital da SPEC 27, sem mudar o esqueleto do Raio-X.
  programa_edital jsonb not null default '[]'::jsonb
                    check (jsonb_typeof(programa_edital) = 'array'),
  data_prova      date,
  formato         text not null default 'multipla_escolha'
                    check (length(btrim(formato)) > 0),
  ativo           boolean not null default false,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

comment on table public.perfil_concurso is
  'Cadastro global multi-concurso (RAIOX-08/AD-100). O perfil ativo direciona a projeção e o plano.';

comment on column public.perfil_concurso.programa_edital is
  'Array JSON de UUIDs de `topicos` que formam o porteiro do edital no MVP.';

create unique index perfil_concurso_uma_ativa
  on public.perfil_concurso (ativo)
  where ativo;

create index perfil_concurso_ativos_idx
  on public.perfil_concurso (ativo, atualizado_em desc);

create table public.raiox_projecoes (
  perfil_concurso_id uuid not null references public.perfil_concurso(id) on delete cascade,
  topico_id          uuid not null references public.topicos(id),
  taxa_bruta         numeric(12, 8) not null
                       check (taxa_bruta >= 0 and taxa_bruta <= 1),
  peso               numeric(12, 8) not null
                       check (peso >= 0 and peso <= 1),
  n_questoes        integer not null check (n_questoes >= 0),
  tendencia          public.raiox_tendencia not null,
  amostra_baixa      boolean not null,
  atualizado_em      timestamptz not null default now(),

  primary key (perfil_concurso_id, topico_id)
);

comment on table public.raiox_projecoes is
  'Projeção recalculável do Raio-X. Não lê `tentativas`; a origem é o acervo publicado (RAIOX-14).';

create index raiox_projecoes_ordenacao_idx
  on public.raiox_projecoes (perfil_concurso_id, peso desc, topico_id);

-- O navegador não escreve nem lê o perfil global ou a projeção bruta.
revoke all on public.perfil_concurso, public.raiox_projecoes
  from anon, authenticated;

alter table public.perfil_concurso enable row level security;
alter table public.raiox_projecoes enable row level security;
