-- SPEC 37 · RAIOX-19 · RAIOX-08 · AD-139/AD-140
--
-- A taxonomia se parte em duas camadas. **Por dentro** nada muda: `topicos`
-- continua sendo o assunto canonico, o atomo onde `questoes.topico_id` grava e
-- onde o snapshot de `tentativas` congela. **Por fora** nasce o edital: cada
-- concurso tem a sua lista de materias, com o nome e a ordem do edital dele, e
-- cada materia aponta para um conjunto de assuntos canonicos.
--
-- `concurso_materia_assuntos` e um MAPA, nao uma arvore. E a diferenca entre
-- "a CAIXA chama de Atendimento Bancario o que o BB chama de Vendas e
-- Negociacao" e "existem dois acervos". O mesmo topico aparece nos dois, com
-- nome diferente, e a questao gravada na prova do BB serve o aluno da CAIXA.
--
-- Por que tabela nova e nao `perfil_concurso` renomeado: o perfil e lido hoje
-- por `raiox_peso_topico`, `raiox_projecoes`, `raiox_projecoes_materia` e por
-- duas leituras da aplicacao. Mexer nele arrisca o AC que manda o produto se
-- comportar como hoje com a flag desligada. `concursos` carrega so o que nao
-- existia — chave natural, visibilidade, edital — e aponta 1:1 para o perfil.
-- Efeito colateral util: a projecao ja e por concurso, porque
-- `raiox_projecoes(perfil_concurso_id, ...)` e cada concurso tem o seu perfil.

create type public.concurso_visibilidade as enum ('oculto', 'elegivel', 'publicado');

create table public.concursos (
  id                 uuid primary key default gen_random_uuid(),
  orgao              text not null check (length(btrim(orgao)) > 0),
  -- Chave natural e `(orgao, cargo)`; as edicoes sao os anos das provas. Cargo
  -- que muda de nome entre edicoes (Escriturario -> Agente Comercial) e vinculo
  -- confirmado por humano, nunca inferido — por isso nao ha regra automatica
  -- ligando um ao outro aqui.
  cargo              text not null default 'indefinido'
                       check (length(btrim(cargo)) > 0),
  -- Banca, programa do edital, data da prova e formato continuam no perfil.
  -- 1:1 obrigatorio: e o que faz `raiox_projecoes` ser projecao por concurso.
  perfil_concurso_id uuid not null unique
                       references public.perfil_concurso(id) on delete restrict,
  visibilidade       public.concurso_visibilidade not null default 'oculto',
  publicado_em       timestamptz,
  publicado_por      uuid references auth.users(id),
  -- Carimbo do AC4 da RAIOX-20: concurso publicado que cai abaixo do piso e
  -- **alertado**, nunca despublicado automaticamente.
  prontidao_alerta_em timestamptz,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),

  constraint concursos_chave_natural unique (orgao, cargo),
  -- Publicado sem quem publicou seria "acao humana registrada" sem registro.
  constraint concursos_publicacao_registrada check (
    (visibilidade = 'publicado') = (publicado_em is not null and publicado_por is not null)
  )
);

comment on table public.concursos is
  'A camada de fora da taxonomia (AD-139). Chave natural (orgao, cargo); banca/edital/data ficam no perfil_concurso 1:1. Nasce oculto (RAIOX-20 AC1).';

comment on column public.concursos.visibilidade is
  'oculto -> elegivel (por regra, avaliar_prontidao_do_concurso) -> publicado (so por publicar_concurso, com operador e motivo em operador_acoes).';

create index concursos_publicados_idx
  on public.concursos (visibilidade, orgao, cargo)
  where visibilidade = 'publicado';

create table public.concurso_materias (
  id          uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos(id) on delete cascade,
  -- O nome do edital DAQUELE concurso. Renomear aqui nao toca em nenhum outro:
  -- e essa linha, e nao o topico, que guarda o nome (RAIOX-19 AC4).
  nome        text not null check (length(btrim(nome)) > 0),
  ordem       smallint not null default 0,
  criada_em   timestamptz not null default now(),

  constraint concurso_materias_nome_unico unique (concurso_id, nome),
  -- Alvo da FK composta do mapa: prende materia e assunto ao mesmo concurso.
  constraint concurso_materias_id_concurso unique (id, concurso_id)
);

comment on table public.concurso_materias is
  'Materias do edital de um concurso, com o nome e a ordem daquele edital (RAIOX-19 AC1). E a unica camada que o aluno ve.';

create table public.concurso_materia_assuntos (
  concurso_id         uuid not null references public.concursos(id) on delete cascade,
  concurso_materia_id uuid not null,
  topico_id           uuid not null references public.topicos(id),
  ordem               smallint not null default 0,

  primary key (concurso_materia_id, topico_id),
  -- Dentro de UM concurso o assunto tem um pai so. Entre concursos, nao — e o
  -- ponto inteiro da RAIOX-19 AC5.
  constraint concurso_materia_assuntos_um_pai unique (concurso_id, topico_id),
  constraint concurso_materia_assuntos_mesma_grade
    foreign key (concurso_materia_id, concurso_id)
    references public.concurso_materias(id, concurso_id) on delete cascade
);

comment on table public.concurso_materia_assuntos is
  'Mapa materia-do-concurso -> assunto canonico. MAPA, nao arvore: nenhuma taxonomia e duplicada, e o mesmo topico pode ter pais de nomes diferentes em concursos diferentes.';

create index concurso_materia_assuntos_topico_idx
  on public.concurso_materia_assuntos (topico_id);

-- ── Privilegios ─────────────────────────────────────────────────────────────
--
-- Mesma postura do acervo (20260817110000): escrita e de script de fabrica e de
-- operador, nunca do navegador; RLS ligada e sem policy. A leitura do aluno
-- passa pelo servidor, que usa `service_role`.
revoke all on public.concursos, public.concurso_materias, public.concurso_materia_assuntos
  from anon, authenticated;

alter table public.concursos                 enable row level security;
alter table public.concurso_materias         enable row level security;
alter table public.concurso_materia_assuntos enable row level security;

-- ── O perfil vigente vira o concurso numero 1 (RAIOX-08) ────────────────────
--
-- Sem migracao destrutiva e sem duplicar taxonomia: o concurso nasce apontando
-- para o perfil que ja existe, e o edital dele e um espelho das `materias`
-- ativas de hoje — mesmo nome, mesma ordem — com os `topicos` ativos mapeados.
-- Idempotente de proposito: rodar duas vezes nao cria concurso repetido.
do $migracao$
declare
  v_perfil    uuid;
  v_orgao     text;
  v_concurso  uuid;
begin
  select p.id, p.orgao into v_perfil, v_orgao
    from public.perfil_concurso p
   where p.ativo
   limit 1;

  if v_perfil is null then
    return;
  end if;

  -- Duas chaves podem colidir aqui: o perfil (1:1) e a natural (orgao, cargo).
  -- O `on conflict` so cobre uma, entao a guarda e explicita — uma migracao que
  -- estoura por causa de dado de demonstracao nao ajuda ninguem.
  if not exists (
    select 1 from public.concursos c
     where c.perfil_concurso_id = v_perfil
        or (c.orgao = v_orgao and c.cargo = 'indefinido')
  ) then
    insert into public.concursos (orgao, cargo, perfil_concurso_id)
    values (v_orgao, 'indefinido', v_perfil);
  end if;

  select c.id into v_concurso
    from public.concursos c
   where c.perfil_concurso_id = v_perfil;

  -- A guarda acima pode ter recusado a insercao por causa da chave natural de
  -- OUTRO perfil. Sem concurso, nao ha edital a semear — e semear no concurso
  -- errado seria pior do que nao semear.
  if v_concurso is null then
    return;
  end if;

  insert into public.concurso_materias (concurso_id, nome, ordem)
  select v_concurso, m.nome, m.ordem
    from public.materias m
   where m.ativa
  on conflict (concurso_id, nome) do nothing;

  insert into public.concurso_materia_assuntos (concurso_id, concurso_materia_id, topico_id, ordem)
  select v_concurso, cm.id, t.id, t.ordem
    from public.topicos t
    join public.materias m on m.id = t.materia_id
    join public.concurso_materias cm
      on cm.concurso_id = v_concurso and cm.nome = m.nome
   where t.ativo and m.ativa
  on conflict (concurso_id, topico_id) do nothing;
end;
$migracao$;
