-- SPEC 38 · BANCO-14 · BANCO-15 · BANCO-16 · AD-138 · AD-140
--
-- Medir e diferente de treinar. A `questao` e a unidade de **treino**: enunciado,
-- alternativas, gabarito cruzado, explicacao conferida. Para saber o que a banca
-- cobra nao e preciso nada disso — basta `(prova, numero do item, assunto)`.
-- Este arquivo cria a unidade de **medicao** e o que a torna confiavel:
--
--   `prova_blocos`       o que a prova declarou de si mesma (BANCO-15)
--   `etiquetas_de_item`  a medicao propriamente dita (BANCO-14)
--   colunas em `provas`  o veredito: grade lida? separada por codigo ou por modelo?
--
-- **Nenhuma linha aqui substitui a SPEC 09/10.** Etiqueta nunca vira questao:
-- publicar continua exigindo proveniencia e gabarito conferido.

-- ── Vocabulario ─────────────────────────────────────────────────────────────
--
-- `ausente` e o **default** de proposito (BANCO-15 AC4): prova nasce sem grade,
-- e grade so existe quando alguem conseguiu ler uma. O estado que nao pode
-- existir e "grade inferida em silencio", e ele nao tem nome aqui.
create type public.grade_status as enum ('ausente', 'lida', 'inconsistente');

-- Qual via separou os itens. `null` = ninguem separou ainda. Registrar a via e o
-- BANCO-16 AC3: a reserva por modelo e legitima, mas nunca invisivel.
create type public.separacao_via as enum ('deterministica', 'modelo');

-- BANCO-14 AC1. Fechado nos dois de proposito: a questao publicada nao e uma
-- terceira origem, e sim a verdade que sobrescreve a etiqueta (AC3).
create type public.origem_etiqueta as enum ('ia', 'humano');

-- ── O que a prova declarou ──────────────────────────────────────────────────
alter table public.provas
  -- Quantos itens a prova diz ter ("60 (sessenta) questoes objetivas"). E o
  -- denominador da cobertura, e vem do documento — nunca da contagem do que
  -- conseguimos ingerir, que e justamente o vies que o AD-138 corrige.
  add column itens_declarados  integer check (itens_declarados > 0),
  add column grade_status      public.grade_status not null default 'ausente',
  add column separacao_via     public.separacao_via,
  -- Preenchido = a prova esta parada esperando olho humano (BANCO-16 AC5).
  add column conferencia_motivo text,
  -- Caderno irmao (Tipo A/B/C): aponta para o principal. NULL = e o principal.
  -- Auto-referencia e o jeito de o BANCO-16 AC6 nao precisar de tabela nova.
  add column caderno_irmao_de  uuid references public.provas(id);

comment on column public.provas.itens_declarados is
  'Total de itens que a propria prova declara (BANCO-15 AC1). Denominador da cobertura.';
comment on column public.provas.grade_status is
  'ausente = ninguem leu a grade e ela espera humano; inconsistente = a soma dos blocos nao bate e a prova NAO entra no Raio-X (BANCO-15 AC4/AC5).';
comment on column public.provas.separacao_via is
  'Como os itens foram separados. `modelo` significa que o separador deterministico nao fechou com a grade (BANCO-16 AC3).';
comment on column public.provas.caderno_irmao_de is
  'Caderno irmao (Tipo A/B/C) do mesmo concurso: aponta para o principal. Irmao e registrado e NAO soma peso ao ano (BANCO-16 AC6).';

-- Um principal por `(banca, ano, orgao, cargo)`. O indice unico de `provas` ja
-- existente (`provas_alvo_unico`) inclui `caderno` e por isso aceita os tres
-- cadernos; este aqui garante que exatamente um deles conta.
create unique index provas_caderno_principal_unico
  on public.provas (banca, ano, orgao, cargo)
  where caderno_irmao_de is null;

-- Irmao nao aponta para irmao: cadeia de dois niveis viraria peso escondido.
create or replace function public.trava_caderno_irmao()
returns trigger
language plpgsql
as $$
begin
  if new.caderno_irmao_de is null then
    return new;
  end if;

  if new.caderno_irmao_de = new.id then
    raise exception 'uma prova nao pode ser caderno irmao de si mesma';
  end if;

  if exists (
    select 1 from public.provas
     where id = new.caderno_irmao_de and caderno_irmao_de is not null
  ) then
    raise exception 'caderno irmao SHALL apontar para o caderno principal, nunca para outro irmao';
  end if;

  return new;
end;
$$;

create trigger provas_caderno_irmao_raso
  before insert or update of caderno_irmao_de on public.provas
  for each row execute function public.trava_caderno_irmao();

-- ── Os blocos declarados (BANCO-15 AC1/AC3) ─────────────────────────────────
create table public.prova_blocos (
  prova_id uuid not null references public.provas(id) on delete cascade,
  -- Ordem de leitura na capa. E a chave junto da prova porque duas faixas nunca
  -- ocupam a mesma posicao, e porque a ordem e o que o operador ve na SPEC 40.
  ordem    smallint not null check (ordem >= 1),

  -- Nulo e um estado legitimo: a faixa e a pontuacao fazem o peso, o nome so
  -- rotula. Prova cujo corpo nao entrega cabecalho de materia legivel fica com
  -- os blocos certos e o nome pendente, em vez de nao ter grade nenhuma.
  nome_impresso text check (nome_impresso is null or length(btrim(nome_impresso)) > 0),

  item_inicial smallint not null check (item_inicial >= 1),
  item_final   smallint not null,

  -- BANCO-15 AC3: quando a prova declara pontuacao, o peso e em pontos; quando
  -- nao declara, e em contagem de itens. As duas colunas juntas sao o "registrar
  -- qual das duas bases foi usada" — `base` nunca e derivada na leitura.
  pontuacao_por_item numeric(6,3) check (pontuacao_por_item > 0),
  base text not null check (base in ('pontos', 'itens')),

  primary key (prova_id, ordem),
  constraint faixa_crescente check (item_final >= item_inicial),
  -- Duas faixas nao comecam no mesmo item: e o que impede a mesma questao de
  -- pesar duas vezes.
  constraint bloco_inicio_unico unique (prova_id, item_inicial),
  -- `base='pontos'` sem pontuacao seria um peso que ninguem sabe calcular.
  constraint base_conforme_pontuacao check (
    (base = 'pontos' and pontuacao_por_item is not null)
    or (base = 'itens' and pontuacao_por_item is null)
  )
);

comment on table public.prova_blocos is
  'A grade que a propria prova declara: nome impresso, faixa de itens e pontuacao por item (BANCO-15 AC1). Escrita SOMENTE por registrar_grade_declarada.';

-- O peso do bloco, com a base registrada na linha (BANCO-15 AC3). Funcao e nao
-- coluna gerada porque `generated` nao aceita expressao sobre outra coluna
-- gerada, e a SPEC 39 vai querer somar isto por materia.
create or replace function public.peso_do_bloco(bloco public.prova_blocos)
returns numeric
language sql
immutable
as $$
  select case bloco.base
           when 'pontos' then (bloco.item_final - bloco.item_inicial + 1) * bloco.pontuacao_por_item
           else (bloco.item_final - bloco.item_inicial + 1)::numeric
         end;
$$;

comment on function public.peso_do_bloco(public.prova_blocos) is
  'Peso oficial do bloco: pontos quando a prova declarou pontuacao, contagem de itens quando nao (BANCO-15 AC3).';

-- ── A etiqueta de item (BANCO-14) ───────────────────────────────────────────
create table public.etiquetas_de_item (
  prova_id uuid     not null references public.provas(id) on delete cascade,
  numero   smallint not null check (numero >= 1),

  -- Aponta para o **assunto canonico** (AD-139): a etiqueta mede na mesma moeda
  -- em que a questao treina, e por isso a SPEC 39 consegue somar as duas.
  topico_id uuid not null references public.topicos(id),

  confianca numeric(4,3) check (confianca >= 0 and confianca <= 1),
  origem    public.origem_etiqueta not null,
  -- A versao fixada do modelo que produziu (BANCO-14 AC1). Nome de modelo NAO
  -- e hardcoded em lugar nenhum (AD-068): quem escreve aqui e o job, lendo a
  -- matriz de configuracao.
  modelo_versao text,

  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),

  -- BANCO-14 AC1: uma classificacao por item, e so uma.
  primary key (prova_id, numero),

  -- Etiqueta de IA sem versao do modelo seria medicao sem procedencia.
  constraint modelo_conforme_origem check (
    (origem = 'ia' and modelo_versao is not null) or origem = 'humano'
  )
);

comment on table public.etiquetas_de_item is
  'A unidade de MEDICAO do AD-138: (prova, numero, assunto canonico), sem enunciado, sem alternativa, sem gabarito. Nunca vira questao.';
comment on column public.etiquetas_de_item.origem is
  'humano vence ia numa reexecucao (BANCO-14 AC4). Questao publicada vence os dois (AC3).';

create index etiquetas_de_item_topico_idx
  on public.etiquetas_de_item (topico_id);

-- ── Privilegios: o resto do acervo, igual ───────────────────────────────────
--
-- Medicao e trabalho de fabrica. Aluno nunca escreve aqui, e no lancamento nem
-- le: quem lera e a projecao da SPEC 39, ja agregada.
revoke all on public.prova_blocos       from public, anon, authenticated;
revoke all on public.etiquetas_de_item  from public, anon, authenticated;
grant select, insert, update, delete on public.prova_blocos      to service_role;
grant select, insert, update, delete on public.etiquetas_de_item to service_role;

alter table public.prova_blocos      enable row level security;
alter table public.etiquetas_de_item enable row level security;
