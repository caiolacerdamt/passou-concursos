-- BANCO-05 (parte: taxonomia) · BANCO-09 AC3 (enums) · AD-039
--
-- Primeira migracao do acervo. Entrega o vocabulario do dominio (os enums) e a
-- taxonomia canonica (materia -> topico) que classifica cada questao.
--
-- Os valores dos enums NAO sao escolha desta rodada: estao literais no AD-039.
-- Quem mudar um valor aqui muda o snapshot congelado de `tentativas` (AD-042) e
-- o contrato de `explicacoes` (AD-052) — e isso e mudanca de contrato, com `!`
-- no commit.
--
-- Por que `origem_questao` e `status_questao` levam sufixo: `origem` e `status`
-- reaparecem em `provas` (nesta spec), em `perfil_concurso` (SPEC 26) e em
-- `explicacoes` (SPEC 13). Tipo com nome generico e colisao marcada.

create type public.tipo_questao   as enum ('multipla_escolha', 'certo_errado');
create type public.origem_questao as enum ('real', 'gerada_ia');
create type public.status_questao as enum (
  'rascunho', 'em_revisao', 'publicada', 'rejeitada', 'precisa_ocr'
);

-- BANCO-13: a classificacao nasce junto da versao. O IA-09 AC4 (SPEC 14) le
-- exatamente isto para decidir se regera a explicacao: `cosmetica` nao regera,
-- `substantiva` regera.
create type public.tipo_mudanca as enum ('cosmetica', 'substantiva');

-- Estado da ingestao da prova. Cada valor responde a uma frase que ja esta
-- escrita em outra spec: `catalogada` (AD-009 — o alvo existe antes do PDF),
-- `extraindo`/`extraida` (BANCO-03, retomada por dedup depois de falha no meio
-- do lote), `gabarito_cruzado` (BANCO-04, cruzamento e etapa separada),
-- `precisa_ocr` (BANCO-12/AD-041, obrigatorio) e `falhou`.
-- Quem move a prova entre esses estados e a SPEC 08/09; aqui so existe o
-- vocabulario.
create type public.status_prova as enum (
  'catalogada', 'extraindo', 'extraida', 'gabarito_cruzado',
  'concluida', 'precisa_ocr', 'falhou'
);

-- BANCO-05 (P3 AC1): topico sugerido pela IA e candidato, nunca canonico.
create type public.status_candidato as enum ('pendente', 'aprovado', 'rejeitado');

-- ── Taxonomia canonica ──────────────────────────────────────────────────────
--
-- `ativa`/`ativo` em vez de DELETE: topico que sai do edital novo continua sendo
-- o rotulo de tentativas antigas. Apagar a linha arrebentaria a FK do historico;
-- desligar o `ativo` tira o topico da classificacao futura sem tocar no passado.
-- E a forma de a taxonomia ser editavel sem contradizer o snapshot congelado.

create table public.materias (
  id        uuid        primary key default gen_random_uuid(),
  nome      text        not null,
  -- Ordem de exibicao do edital verticalizado. Nao e regra de negocio, e tela.
  ordem     smallint    not null default 0,
  ativa     boolean     not null default true,
  criada_em timestamptz not null default now(),

  constraint materias_nome_unico unique (nome)
);

comment on table public.materias is
  'Nivel 1 da taxonomia (BANCO-05). Editavel pelo operador (SPEC 18). Nunca apagada: desativa.';

create table public.topicos (
  id         uuid        primary key default gen_random_uuid(),
  materia_id uuid        not null references public.materias(id),
  nome       text        not null,
  ordem      smallint    not null default 0,
  ativo      boolean     not null default true,
  criado_em  timestamptz not null default now(),

  -- O mesmo nome de topico em materias diferentes e permitido de proposito:
  -- "Juros Simples" existe em Matematica Financeira e pode existir em
  -- Conhecimentos Bancarios. Unicidade global obrigaria nome artificial.
  constraint topicos_nome_unico_na_materia unique (materia_id, nome)
);

comment on table public.topicos is
  'Nivel 2 da taxonomia (BANCO-05). Reclassificar (renomear ou mover de materia) e UPDATE normal: o historico esta protegido em `tentativas`, que copia id E rotulo no momento da resposta (AD-042).';

create index topicos_materia_idx on public.topicos (materia_id) where ativo;

-- ── Privilegios ─────────────────────────────────────────────────────────────
--
-- O acervo e escrito por script de fabrica (AD-036) e por operador, nunca pelo
-- navegador. TRUNCATE entra na lista pela razao do AD-084: o
-- `alter default privileges` do Supabase o concede, e RLS nao governa TRUNCATE.
revoke insert, update, delete, truncate on public.materias from anon, authenticated;
revoke insert, update, delete, truncate on public.topicos  from anon, authenticated;

-- RLS ligada e SEM policy: a taxonomia e invisivel para `anon` e
-- `authenticated`. Nao e excesso de zelo — nao existe `matricula` (SPEC 17) nem
-- tela (SPEC 22) para escrever uma policy honesta hoje, e "sem policy" e a
-- postura que erra para o lado seguro. A policy de leitura entra na SPEC 22,
-- junto de quem precisa dela.
alter table public.materias enable row level security;
alter table public.topicos  enable row level security;
