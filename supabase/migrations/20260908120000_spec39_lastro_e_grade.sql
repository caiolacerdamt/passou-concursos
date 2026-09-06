-- SPEC 39 · RAIOX-16 · RAIOX-17 · RAIOX-18 · AD-138
--
-- O que esta migracao entrega e a **materia-prima** do calculo em dois niveis:
--
--   prova_blocos.materia_id       o bloco declarado sabe de que materia fala
--   concurso_peso_materia         o peso que o EDITAL declara (degrau 2)
--   colunas de lastro             degrau, quantas provas, quais anos, que base
--   provas_pendentes_de_ingestao  a prova que ficou de fora e por que
--
-- A conta em si nasce na migracao seguinte. Aqui nao ha nenhuma formula.

-- ── T1 · A grade declarada aponta para a materia canonica ───────────────────
--
-- A SPEC 38 gravou o bloco com `nome_impresso` livre ("LINGUA PORTUGUESA").
-- Para o nivel 1 o bloco precisa apontar para a materia **canonica**, e ha duas
-- vias: esta coluna (explicita, do operador) e a moda das etiquetas da faixa
-- (automatica, na migracao seguinte).
--
-- A coluna sozinha nao bastaria — obrigaria retrabalho manual em toda prova ja
-- registrada. A moda sozinha tambem nao: a RAIOX-16 AC4 fala de materia **sem
-- nenhum item etiquetado**, e essa materia nao tem moda nenhuma. As duas juntas
-- cobrem os dois estados.
alter table public.prova_blocos
  add column materia_id uuid references public.materias(id);

comment on column public.prova_blocos.materia_id is
  'Materia canonica do bloco declarado (RAIOX-16 AC2). NULL = ninguem vinculou; a materia e entao a moda das etiquetas da faixa. Bloco que nao resolve por nenhuma via continua no denominador do peso oficial e nao soma para materia nenhuma.';

create index prova_blocos_materia_idx
  on public.prova_blocos (materia_id)
  where materia_id is not null;

-- `registrar_grade_declarada` continua sendo o **unico** caminho de escrita de
-- `prova_blocos`. A unica mudanca e aceitar `materia_id` no objeto do bloco.
create or replace function public.registrar_grade_declarada(
  p_prova            uuid,
  p_itens_declarados integer,
  p_blocos           jsonb
)
returns public.grade_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.grade_status;
  v_soma   integer := 0;
  v_blocos integer := 0;
begin
  if not exists (select 1 from public.provas p where p.id = p_prova) then
    raise exception 'prova_inexistente';
  end if;

  if p_blocos is null or jsonb_typeof(p_blocos) <> 'array' then
    raise exception 'blocos_invalidos';
  end if;

  delete from public.prova_blocos b where b.prova_id = p_prova;

  if jsonb_array_length(p_blocos) = 0 or p_itens_declarados is null then
    update public.provas
       set itens_declarados = null,
           grade_status     = 'ausente',
           atualizada_em    = now()
     where id = p_prova;
    return 'ausente';
  end if;

  insert into public.prova_blocos
    (prova_id, ordem, nome_impresso, item_inicial, item_final,
     pontuacao_por_item, base, materia_id)
  select
    p_prova,
    (b->>'ordem')::smallint,
    nullif(btrim(coalesce(b->>'nome_impresso', '')), ''),
    (b->>'item_inicial')::smallint,
    (b->>'item_final')::smallint,
    (b->>'pontuacao_por_item')::numeric,
    case when (b->>'pontuacao_por_item') is null then 'itens' else 'pontos' end,
    (b->>'materia_id')::uuid
  from jsonb_array_elements(p_blocos) as b;

  select count(*), coalesce(sum(item_final - item_inicial + 1), 0)
    into v_blocos, v_soma
    from public.prova_blocos
   where prova_id = p_prova;

  v_status := case when v_soma = p_itens_declarados then 'lida' else 'inconsistente' end;

  if v_status = 'lida' and exists (
    select 1
      from public.prova_blocos a
      join public.prova_blocos c
        on c.prova_id = a.prova_id and c.ordem <> a.ordem
     where a.prova_id = p_prova
       and a.item_inicial <= c.item_final
       and c.item_inicial <= a.item_final
  ) then
    v_status := 'inconsistente';
  end if;

  update public.provas
     set itens_declarados = p_itens_declarados,
         grade_status     = v_status,
         atualizada_em    = now()
   where id = p_prova;

  return v_status;
end;
$$;

comment on function public.registrar_grade_declarada(uuid, integer, jsonb) is
  'Unico caminho de escrita de prova_blocos. Grava o veredito (lida/inconsistente/ausente) e, quando informado, a materia canonica do bloco (BANCO-15 AC1/AC3/AC4/AC5 · RAIOX-16 AC2).';

-- Vincular depois de a grade ja estar lida: o caminho do operador na SPEC 40,
-- que nao pode exigir reler a prova inteira so para dar nome a um bloco.
create or replace function public.vincular_bloco_a_materia(
  p_prova   uuid,
  p_ordem   smallint,
  p_materia uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_materia is not null and not exists (
    select 1 from public.materias m where m.id = p_materia and m.ativa
  ) then
    raise exception 'materia_inexistente_ou_inativa';
  end if;

  update public.prova_blocos
     set materia_id = p_materia
   where prova_id = p_prova and ordem = p_ordem;

  if not found then
    raise exception 'bloco_inexistente';
  end if;
end;
$$;

comment on function public.vincular_bloco_a_materia(uuid, smallint, uuid) is
  'Liga um bloco declarado a uma materia canonica sem reler a prova. NULL desfaz o vinculo e devolve o bloco a resolucao automatica.';

revoke all on function public.vincular_bloco_a_materia(uuid, smallint, uuid)
  from public, anon, authenticated;

-- ── T2 · O peso que o edital declara ────────────────────────────────────────
--
-- E o nivel 1 do **degrau 2**: concurso recem-aberto, com edital e sem prova.
--
-- Por que na materia **canonica** e nao em `concurso_materias`: a projecao
-- inteira e de grao canonico, e uma materia do edital pode mapear assuntos de
-- mais de uma materia canonica. Colocar o peso na camada do edital obrigaria a
-- **estimar** como reparti-lo — exatamente o que o nivel 1 existe para nao
-- fazer. O nome do edital continua sendo a camada de fora (AD-139).
create table public.concurso_peso_materia (
  concurso_id    uuid not null references public.concursos(id) on delete cascade,
  materia_id     uuid not null references public.materias(id),
  -- Numero do edital: 10 questoes, ou 15 pontos, ou 20 (por cento). A base diz
  -- qual. A normalizacao para fracao acontece no recalculo, nunca aqui — assim
  -- o que esta gravado continua sendo o que o documento disse.
  peso_declarado numeric(10, 3) not null check (peso_declarado > 0),
  base           text not null check (base in ('pontos', 'itens', 'percentual')),
  registrado_em  timestamptz not null default now(),

  primary key (concurso_id, materia_id)
);

comment on table public.concurso_peso_materia is
  'Peso oficial por materia declarado pelo EDITAL (RAIOX-16 AC2). Nivel 1 do degrau 2: concurso com edital e sem prova. Nunca derivado de contagem de questoes.';

comment on column public.concurso_peso_materia.base is
  'Em que unidade o edital declarou. Registrada e nao derivada: a linha do Raio-X mostra qual base sustentou o peso (BANCO-15 AC3).';

create or replace function public.registrar_peso_do_edital(
  p_concurso uuid,
  p_pesos    jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linhas integer := 0;
begin
  if not exists (select 1 from public.concursos c where c.id = p_concurso) then
    raise exception 'concurso_inexistente';
  end if;

  if p_pesos is null or jsonb_typeof(p_pesos) <> 'array' then
    raise exception 'pesos_invalidos';
  end if;

  -- Retrato inteiro, como a grade: reler o edital substitui a leitura anterior
  -- em vez de misturar duas.
  delete from public.concurso_peso_materia where concurso_id = p_concurso;

  insert into public.concurso_peso_materia
    (concurso_id, materia_id, peso_declarado, base)
  select
    p_concurso,
    (p->>'materia_id')::uuid,
    (p->>'peso_declarado')::numeric,
    coalesce(p->>'base', 'itens')
  from jsonb_array_elements(p_pesos) as p;

  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

comment on function public.registrar_peso_do_edital(uuid, jsonb) is
  'Grava o peso por materia declarado pelo edital de um concurso, substituindo a leitura anterior inteira (RAIOX-16 AC2).';

revoke all on public.concurso_peso_materia from public, anon, authenticated;
grant select, insert, update, delete on public.concurso_peso_materia to service_role;
alter table public.concurso_peso_materia enable row level security;

revoke all on function public.registrar_peso_do_edital(uuid, jsonb)
  from public, anon, authenticated;

-- ── T3 · O lastro, por linha ────────────────────────────────────────────────
--
-- Quatro colunas nas duas projecoes. Nenhuma coluna existente sai: `peso`,
-- `taxa_bruta`, `n_questoes`, `tendencia` e `amostra_baixa` continuam com o
-- mesmo tipo, e a assinatura de `raiox_peso_topico` nao e tocada.
--
-- O default `4` / `0` / `{}` / `sem_dado` e o estado honesto de uma linha que
-- ainda nao foi recalculada: sem dado.
alter table public.raiox_projecoes
  add column degrau       smallint not null default 4 check (degrau between 1 and 4),
  add column n_provas     integer  not null default 0 check (n_provas >= 0),
  add column anos         smallint[] not null default '{}',
  add column base_do_peso text not null default 'sem_dado'
                 check (base_do_peso in ('pontos', 'itens', 'edital', 'sem_dado'));

alter table public.raiox_projecoes_materia
  add column degrau       smallint not null default 4 check (degrau between 1 and 4),
  add column n_provas     integer  not null default 0 check (n_provas >= 0),
  add column anos         smallint[] not null default '{}',
  add column base_do_peso text not null default 'sem_dado'
                 check (base_do_peso in ('pontos', 'itens', 'edital', 'sem_dado'));

comment on column public.raiox_projecoes.degrau is
  'Degrau de lastro (RAIOX-18 AC1): 1 provas do proprio concurso · 2 grade do edital sem provas · 3 provas da mesma banca em outro orgao · 4 sem dado. E o degrau da MATERIA; o assunto herda o dela.';
comment on column public.raiox_projecoes.n_provas is
  'Quantas provas sustentam esta linha (RAIOX-17 AC4). Caderno irmao conta uma vez.';
comment on column public.raiox_projecoes.anos is
  'Quais anos sustentam esta linha (RAIOX-17 AC4), crescente e sem repeticao.';
comment on column public.raiox_projecoes.base_do_peso is
  'De onde veio o peso da materia: pontos ou itens (grade declarada da prova), edital (peso declarado) ou sem_dado (degrau 4).';

comment on column public.raiox_projecoes_materia.degrau is
  'Degrau de lastro da materia (RAIOX-18 AC1). Com degrau 2, 3 ou 4 a tela para na materia e NAO exibe percentual por assunto (AC4).';
comment on column public.raiox_projecoes_materia.n_provas is
  'Quantas provas sustentam esta materia (RAIOX-17 AC4).';
comment on column public.raiox_projecoes_materia.anos is
  'Quais anos sustentam esta materia (RAIOX-17 AC4).';
comment on column public.raiox_projecoes_materia.base_do_peso is
  'De onde veio o peso oficial desta materia: pontos, itens, edital ou sem_dado.';

-- O significado de `n_questoes` mudou junto com a unidade de medida (AD-138):
-- passa a contar **etiqueta de item**, nao questao publicada. A questao continua
-- sendo a unidade de treino; nada no M4 muda.
comment on column public.raiox_projecoes.n_questoes is
  'Itens ETIQUETADOS do assunto nas provas fonte (AD-138). Nao e contagem de questoes publicadas: medir e treinar sao unidades separadas.';
comment on column public.raiox_projecoes_materia.n_questoes is
  'Itens ETIQUETADOS da materia nas provas fonte (AD-138). E o `n` do amortecimento dentro da materia.';

-- ── T4 · A prova que ficou de fora ──────────────────────────────────────────
--
-- A RAIOX-17 AC2 nao aceita que a prova saia da conta em silencio: quem esta
-- abaixo do piso precisa estar numa lista. O piso e lido da configuracao aqui
-- dentro, e nao pelo chamador, para que a lista e o recalculo nunca discordem
-- sobre quem entrou.
create or replace view public.provas_pendentes_de_ingestao
with (security_invoker = true)
as
  with piso as (
    select coalesce((
      select (valor #>> '{}')::numeric
        from public.configuracoes_vigentes
       where chave = 'param.m1.cobertura_minima'
         and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
         and (valor #>> '{}')::numeric between 0 and 1
    ), 0.9) as valor
  )
  select
    c.prova_id, c.banca, c.ano, c.orgao, c.cargo, c.caderno,
    c.itens_declarados, c.itens_ingeridos, c.cobertura,
    p.valor as cobertura_minima
    from public.provas_medidas c
   cross join piso p
   where c.cobertura is null or c.cobertura < p.valor
   order by c.ano desc, c.banca, c.orgao;

comment on view public.provas_pendentes_de_ingestao is
  'Provas com grade lida cuja cobertura esta abaixo de param.m1.cobertura_minima: ficam FORA do Raio-X e aparecem aqui (RAIOX-17 AC2).';

revoke all on public.provas_pendentes_de_ingestao from anon, authenticated;
grant select on public.provas_pendentes_de_ingestao to service_role;
