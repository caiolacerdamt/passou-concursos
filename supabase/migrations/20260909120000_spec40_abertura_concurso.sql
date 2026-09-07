-- SPEC 40 · BANCO-01 · BANCO-02 · RAIOX-07 · RAIOX-20 · AD-003 · AD-145
--
-- A abertura de um concurso acontece na **sessao** do Codex ou do Claude Code:
-- o agente pesquisa com a ferramenta e o limite daquela sessao, e conduz duas
-- confirmacoes na conversa. Nada disso e verdade persistida enquanto nao passar
-- por aqui.
--
-- O que este arquivo existe para garantir e a metade que a conversa nao segura:
--
--   * a **ordem** — nao se baixa antes de aprovar, nao se aplica edital antes
--     de aprovar, nao se publica antes de o Raio-X dizer que da;
--   * a **autoria** — toda decisao carrega o operador, e cai em `operador_acoes`;
--   * a **idempotencia** — rodar de novo nao duplica abertura, documento,
--     prova, assunto nem custo;
--   * a **proveniencia** — prova ingerida guarda a URL oficial de onde veio.
--
-- O banco NAO valida a allowlist de dominios: isso e do comando (T3), que
-- normaliza host, recusa esquema, IP e credencial e revalida cada redirect. O
-- que o banco recusa e o que o banco consegue provar: HTTPS, escopo do ID,
-- ordem do estado e presenca de operador.

-- ── Vocabulario ─────────────────────────────────────────────────────────────
--
-- O fluxo e monotonico. `elegivel` e `publicado` NAO entram neste enum de
-- proposito: eles sao `concursos.visibilidade`, e quem os move continua sendo
-- `avaliar_prontidao_do_concurso` / `publicar_concurso` da SPEC 37. A abertura
-- termina em `concluida` e entrega o concurso para aquele gate.
create type public.abertura_estado as enum (
  'pesquisa_pendente',
  'documentos_pendentes',
  'documentos_aprovados',
  'processamento_em_andamento',
  'assuntos_pendentes',
  'pronto_para_recalculo',
  'concluida'
);

create type public.abertura_documento_tipo as enum ('edital', 'prova');

-- `pendente` e o unico estado inicial possivel: documento nasce candidato, e
-- so a primeira confirmacao o move.
create type public.abertura_decisao as enum ('pendente', 'aprovado', 'rejeitado');

-- As quatro saidas da segunda confirmacao (RAIOX-07). `criar` e `fundir` sao
-- decisoes diferentes de proposito: criar nasce assunto novo, fundir reconhece
-- que o "novo" ja existia com outro nome.
create type public.abertura_assunto_decisao as enum (
  'pendente', 'mapear', 'criar', 'fundir', 'rejeitar'
);

/**
 * A posicao do estado na fila. Existe para que "nao pular etapa" seja uma
 * comparacao de numero, e nao uma lista de `if` repetida em cada RPC.
 */
create or replace function public.abertura_ordem(p_estado public.abertura_estado)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_estado
    when 'pesquisa_pendente'          then 1
    when 'documentos_pendentes'       then 2
    when 'documentos_aprovados'       then 3
    when 'processamento_em_andamento' then 4
    when 'assuntos_pendentes'         then 5
    when 'pronto_para_recalculo'      then 6
    when 'concluida'                  then 7
  end::smallint;
$$;

-- ── A execucao ──────────────────────────────────────────────────────────────
create table public.aberturas_concurso (
  id          uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos(id) on delete cascade,
  estado      public.abertura_estado not null default 'pesquisa_pendente',
  -- Quem abriu. Nao e o autor de cada decisao (esse fica na linha da decisao):
  -- e quem respondeu pela execucao.
  operador_id uuid not null references auth.users(id),
  -- Quantos resultados a busca da sessao jogou fora por nao serem fonte legal
  -- (AD-003). E numero, e nao lista, de proposito: URL de agregador nao entra
  -- no banco nem em log — reporta-se o **tamanho** do descarte.
  descartados integer not null default 0 check (descartados >= 0),
  -- O que se procurou e nao se achou. Fica no relatorio ate alguem resolver
  -- fora do sistema; o fluxo nunca inventa documento para preencher.
  faltantes   jsonb not null default '[]'::jsonb
                check (jsonb_typeof(faltantes) = 'array'),
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  concluida_em  timestamptz,

  constraint aberturas_concluida_carimbada
    check ((estado = 'concluida') = (concluida_em is not null))
);

comment on table public.aberturas_concurso is
  'Uma execucao de abertura de concurso conduzida na sessao do agente (AD-145). O estado e monotonico e mora aqui, nao no historico do chat: outra sessao retoma sem depender da conversa.';
comment on column public.aberturas_concurso.descartados is
  'Quantos resultados de busca cairam fora da allowlist de fonte oficial. Numero, nunca URL: agregador e descartado sem exibicao (AD-003).';

-- Uma execucao ativa por concurso. E o que faz `iniciar` ser idempotente e o
-- que impede duas sessoes de abrirem o mesmo concurso em paralelo.
create unique index aberturas_concurso_ativa
  on public.aberturas_concurso (concurso_id)
  where estado <> 'concluida';

-- ── Os documentos candidatos ────────────────────────────────────────────────
create table public.concurso_documentos (
  id          uuid primary key default gen_random_uuid(),
  abertura_id uuid not null references public.aberturas_concurso(id) on delete cascade,
  tipo        public.abertura_documento_tipo not null,
  -- HTTPS e o unico esquema. O host ja foi conferido contra a allowlist pelo
  -- comando; o `like` aqui e a rede de baixo, nao a validacao principal.
  url         text not null check (url like 'https://%'),
  titulo      text not null check (length(btrim(titulo)) > 0),
  -- banca / ano / orgao / cargo / caderno, do jeito que o agente leu. E
  -- material da conversa ate o operador aprovar; nada nele vira peso sozinho.
  metadados   jsonb not null default '{}'::jsonb
                check (jsonb_typeof(metadados) = 'object'),

  decisao      public.abertura_decisao not null default 'pendente',
  decidido_em  timestamptz,
  decidido_por uuid references auth.users(id),

  -- Preenchidos so depois da primeira confirmacao: o download acontece **apos**
  -- a aprovacao, nunca antes (SEC-03).
  baixado_em  timestamptz,
  bytes       integer check (bytes > 0),
  sha256      text check (sha256 ~ '^[0-9a-f]{64}$'),
  prova_id    uuid references public.provas(id),

  registrado_em timestamptz not null default now(),

  -- O mesmo link registrado duas vezes e o mesmo documento: retry nao duplica.
  constraint concurso_documentos_url_unica unique (abertura_id, url),
  constraint concurso_documentos_decisao_assinada
    check ((decisao = 'pendente') = (decidido_em is null and decidido_por is null)),
  -- Baixar o que nao foi aprovado seria furar a primeira porta.
  constraint concurso_documentos_so_baixa_aprovado
    check (baixado_em is null or decisao = 'aprovado'),
  constraint concurso_documentos_baixado_medido
    check ((baixado_em is null) = (bytes is null and sha256 is null)),
  constraint concurso_documentos_prova_so_de_baixado
    check (prova_id is null or (baixado_em is not null and tipo = 'prova'))
);

comment on table public.concurso_documentos is
  'Candidatos que sobreviveram a allowlist, a decisao humana sobre cada um e o que foi baixado depois dela (BANCO-01/BANCO-02). Resultado de agregador nao chega aqui.';

-- Uma prova pertence a um documento so: reingerir o mesmo caderno numa segunda
-- abertura nao cria uma segunda origem para a mesma prova.
create unique index concurso_documentos_prova_unica
  on public.concurso_documentos (prova_id)
  where prova_id is not null;

create index concurso_documentos_da_abertura_idx
  on public.concurso_documentos (abertura_id, tipo, decisao);

-- ── A proveniencia da prova ─────────────────────────────────────────────────
--
-- `pdf_storage_path` diz onde o arquivo esta; `url_origem` diz de onde ele veio,
-- e e essa a pergunta auditavel do AD-003. Nullable porque as 28 provas ja
-- catalogadas entraram a mao, antes de existir fluxo de abertura.
alter table public.provas
  add column url_origem text check (url_origem like 'https://%');

comment on column public.provas.url_origem is
  'URL oficial de onde o PDF veio (BANCO-01). Preenchida pela abertura de concurso; nula nas provas catalogadas a mao antes da SPEC 40.';

-- ── Os assuntos propostos ───────────────────────────────────────────────────
create table public.abertura_assuntos (
  id          uuid primary key default gen_random_uuid(),
  abertura_id uuid not null references public.aberturas_concurso(id) on delete cascade,
  -- O nome da materia **no edital daquele concurso** (AD-139): e a camada de
  -- fora, e nao a materia canonica.
  materia_edital text not null check (length(btrim(materia_edital)) > 0),
  nome_proposto  text not null check (length(btrim(nome_proposto)) > 0),
  ordem          smallint not null default 0,

  -- Casamento exato calculado por codigo. NULL = o nome nao existe na taxonomia.
  topico_id  uuid references public.topicos(id),
  -- Quase-duplicatas, calculadas deterministicamente pelo comando: `[{topico_id,
  -- nome, similaridade}]`. Sao **pergunta**, nunca decisao — nada funde sozinho.
  candidatos jsonb not null default '[]'::jsonb
               check (jsonb_typeof(candidatos) = 'array'),

  decisao      public.abertura_assunto_decisao not null default 'pendente',
  decidido_em  timestamptz,
  decidido_por uuid references auth.users(id),
  -- O assunto canonico com que a linha terminou: o mapeado, o criado ou o
  -- destino da fusao. NULL em `rejeitar`.
  topico_resultante uuid references public.topicos(id),

  proposto_em timestamptz not null default now(),

  constraint abertura_assuntos_unico unique (abertura_id, materia_edital, nome_proposto),
  constraint abertura_assuntos_decisao_assinada
    check ((decisao = 'pendente') = (decidido_em is null and decidido_por is null)),
  -- Decisao que mapeia, cria ou funde SEMPRE termina num assunto canonico;
  -- rejeitar e pendente nunca terminam em um.
  constraint abertura_assuntos_resultado_coerente
    check ((decisao in ('mapear', 'criar', 'fundir')) = (topico_resultante is not null))
);

comment on table public.abertura_assuntos is
  'A proposta de vinculo do programa do edital produzida na sessao do agente, com as quase-duplicatas calculadas por codigo e a decisao humana de cada linha (RAIOX-07).';

create index abertura_assuntos_da_abertura_idx
  on public.abertura_assuntos (abertura_id, decisao);

-- ── Privilegios ─────────────────────────────────────────────────────────────
--
-- Mesma postura das tabelas do acervo e dos concursos: o navegador nao encosta.
-- Quem escreve e o comando, com a credencial administrativa dos jobs.
revoke all on public.aberturas_concurso, public.concurso_documentos, public.abertura_assuntos
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.aberturas_concurso, public.concurso_documentos, public.abertura_assuntos
  to service_role;

alter table public.aberturas_concurso  enable row level security;
alter table public.concurso_documentos enable row level security;
alter table public.abertura_assuntos   enable row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- As funcoes. Cada uma exige operador ativo, confere o escopo dos IDs e recusa
-- o salto de estado antes de escrever qualquer coisa.
-- ════════════════════════════════════════════════════════════════════════════

/**
 * Trava a abertura e devolve seu estado, recusando o que nao existe, o que ja
 * terminou e o ID que nao e daquele operador conferir sem ser operador.
 */
create or replace function public.abertura_em_estado(
  p_abertura  uuid,
  p_operador  uuid,
  p_esperado  public.abertura_estado
)
returns public.aberturas_concurso
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_abertura public.aberturas_concurso%rowtype;
begin
  perform public.exigir_operador_ativo(p_operador);

  select a.* into v_abertura
    from public.aberturas_concurso a
   where a.id = p_abertura
   for update;

  if v_abertura.id is null then
    raise exception 'abertura_inexistente';
  end if;

  if v_abertura.estado <> p_esperado then
    -- A mensagem diz onde a execucao esta, porque e disso que o comando
    -- `relatorio` precisa para dizer como retomar.
    raise exception 'abertura_fora_de_ordem: esperado %, esta em %',
      p_esperado, v_abertura.estado;
  end if;

  return v_abertura;
end;
$$;

/**
 * Abre — ou reencontra — a execucao ativa de um concurso.
 *
 * Idempotente de proposito: a sessao cai, o agente roda `iniciar` de novo e
 * recebe a MESMA abertura, no estado em que ela parou. Chamar duas vezes nao
 * cria duas execucoes, e o indice parcial e quem garante isso mesmo sob corrida.
 */
create or replace function public.iniciar_abertura(
  p_concurso uuid,
  p_operador uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.exigir_operador_ativo(p_operador);

  if not exists (select 1 from public.concursos c where c.id = p_concurso) then
    raise exception 'concurso_inexistente';
  end if;

  select a.id into v_id
    from public.aberturas_concurso a
   where a.concurso_id = p_concurso and a.estado <> 'concluida'
   for update;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.aberturas_concurso (concurso_id, operador_id)
  values (p_concurso, p_operador)
  returning id into v_id;

  perform public.registrar_acao_operador(
    p_operador, 'abertura_iniciada', 'aberturas_concurso', v_id::text,
    'abertura de concurso conduzida na sessao do agente',
    jsonb_build_object('concurso_id', p_concurso)
  );

  return v_id;
end;
$$;

/**
 * Grava os candidatos que sobreviveram a allowlist, mais o tamanho do descarte
 * e o que faltou.
 *
 * O que chega aqui **ja passou** pela validacao do comando. O que esta funcao
 * acrescenta e escopo e idempotencia: a mesma URL registrada de novo atualiza a
 * linha em vez de criar outra, e um candidato nunca entra numa abertura que ja
 * passou da primeira porta.
 */
create or replace function public.registrar_documentos_encontrados(
  p_abertura    uuid,
  p_operador    uuid,
  p_documentos  jsonb,
  p_descartados integer,
  p_faltantes   jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_abertura public.aberturas_concurso%rowtype;
  v_linhas   integer := 0;
begin
  perform public.exigir_operador_ativo(p_operador);

  select a.* into v_abertura
    from public.aberturas_concurso a where a.id = p_abertura for update;
  if v_abertura.id is null then
    raise exception 'abertura_inexistente';
  end if;

  -- Registrar achado depois de a lista ja ter sido aprovada mudaria o que o
  -- operador assinou. Quem achou mais documento abre outra rodada.
  if v_abertura.estado not in ('pesquisa_pendente', 'documentos_pendentes') then
    raise exception 'abertura_fora_de_ordem: esperado pesquisa_pendente, esta em %',
      v_abertura.estado;
  end if;

  if p_documentos is null or jsonb_typeof(p_documentos) <> 'array' then
    raise exception 'documentos_invalidos';
  end if;
  if p_faltantes is null or jsonb_typeof(p_faltantes) <> 'array' then
    raise exception 'faltantes_invalidos';
  end if;
  if p_descartados is null or p_descartados < 0 then
    raise exception 'descartados_invalidos';
  end if;

  insert into public.concurso_documentos (abertura_id, tipo, url, titulo, metadados)
  select
    p_abertura,
    (d->>'tipo')::public.abertura_documento_tipo,
    d->>'url',
    d->>'titulo',
    coalesce(d->'metadados', '{}'::jsonb)
  from jsonb_array_elements(p_documentos) as d
  -- Retry manda a mesma lista: a linha ja decidida NAO volta para pendente.
  on conflict (abertura_id, url) do update
    set titulo    = excluded.titulo,
        metadados = excluded.metadados
  where concurso_documentos.decisao = 'pendente';

  get diagnostics v_linhas = row_count;

  update public.aberturas_concurso
     set estado        = 'documentos_pendentes',
         descartados   = p_descartados,
         faltantes     = p_faltantes,
         atualizada_em = now()
   where id = p_abertura;

  return v_linhas;
end;
$$;

/**
 * A primeira confirmacao: o operador decide documento por documento.
 *
 * Nada e decidido por omissao. Documento que ficar pendente segura a abertura,
 * porque baixar o "resto" seria decidir no lugar de quem assina.
 */
create or replace function public.decidir_documentos(
  p_abertura uuid,
  p_operador uuid,
  p_decisoes jsonb,
  p_motivo   text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_decididos integer := 0;
  v_pendentes integer := 0;
  v_aprovados integer := 0;
begin
  perform public.abertura_em_estado(p_abertura, p_operador, 'documentos_pendentes');

  if p_decisoes is null or jsonb_typeof(p_decisoes) <> 'array'
     or jsonb_array_length(p_decisoes) = 0 then
    raise exception 'decisoes_invalidas';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_obrigatorio';
  end if;

  -- ID de outra abertura nao decide nada aqui (SEC-02): o `abertura_id` no
  -- WHERE e o escopo, e a contagem abaixo denuncia o que ficou de fora.
  update public.concurso_documentos d
     set decisao      = (e->>'decisao')::public.abertura_decisao,
         decidido_em  = now(),
         decidido_por = p_operador
    from jsonb_array_elements(p_decisoes) as e
   where d.abertura_id = p_abertura
     and d.id = (e->>'id')::uuid
     and d.decisao = 'pendente'
     and (e->>'decisao') in ('aprovado', 'rejeitado');

  get diagnostics v_decididos = row_count;

  if v_decididos <> jsonb_array_length(p_decisoes) then
    raise exception 'decisao_fora_da_abertura_ou_repetida';
  end if;

  select count(*) filter (where decisao = 'pendente'),
         count(*) filter (where decisao = 'aprovado')
    into v_pendentes, v_aprovados
    from public.concurso_documentos where abertura_id = p_abertura;

  if v_pendentes > 0 then
    raise exception 'documentos_pendentes_restantes: %', v_pendentes;
  end if;
  if v_aprovados = 0 then
    raise exception 'nenhum_documento_aprovado';
  end if;

  update public.aberturas_concurso
     set estado = 'documentos_aprovados', atualizada_em = now()
   where id = p_abertura;

  perform public.registrar_acao_operador(
    p_operador, 'abertura_documentos_decididos', 'aberturas_concurso',
    p_abertura::text, btrim(p_motivo),
    jsonb_build_object('decididos', v_decididos, 'aprovados', v_aprovados)
  );

  return v_aprovados;
end;
$$;

/**
 * Registra que um documento aprovado foi baixado, e — quando e prova — amarra a
 * prova a URL oficial de onde ela veio.
 *
 * Idempotente pela chave do arquivo: baixar de novo o mesmo PDF nao cria prova
 * nova nem apaga a que existe.
 */
create or replace function public.registrar_documento_baixado(
  p_abertura  uuid,
  p_operador  uuid,
  p_documento uuid,
  p_bytes     integer,
  p_sha256    text,
  p_prova     uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento public.concurso_documentos%rowtype;
begin
  perform public.exigir_operador_ativo(p_operador);

  select d.* into v_documento
    from public.concurso_documentos d
   where d.id = p_documento and d.abertura_id = p_abertura
   for update;

  if v_documento.id is null then
    raise exception 'documento_fora_da_abertura';
  end if;
  if v_documento.decisao <> 'aprovado' then
    raise exception 'documento_nao_aprovado';
  end if;
  if p_bytes is null or p_bytes <= 0 or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'arquivo_invalido';
  end if;
  if v_documento.tipo = 'prova' and p_prova is null then
    raise exception 'prova_obrigatoria';
  end if;
  if v_documento.tipo = 'edital' and p_prova is not null then
    raise exception 'edital_nao_tem_prova';
  end if;

  update public.concurso_documentos
     set baixado_em = coalesce(baixado_em, now()),
         bytes      = p_bytes,
         sha256     = p_sha256,
         prova_id   = p_prova
   where id = p_documento;

  if p_prova is not null then
    update public.provas set url_origem = v_documento.url, atualizada_em = now()
     where id = p_prova;
    if not found then
      raise exception 'prova_inexistente';
    end if;
  end if;
end;
$$;

/**
 * Avanca o estado da abertura sem pular etapa.
 *
 * So anda para frente, e so um degrau por vez. Voltar atras nao existe: uma
 * confirmacao ja assinada nao se desfaz por comando.
 */
create or replace function public.avancar_abertura(
  p_abertura uuid,
  p_operador uuid,
  p_estado   public.abertura_estado
)
returns public.abertura_estado
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_abertura public.aberturas_concurso%rowtype;
begin
  perform public.exigir_operador_ativo(p_operador);

  select a.* into v_abertura
    from public.aberturas_concurso a where a.id = p_abertura for update;
  if v_abertura.id is null then
    raise exception 'abertura_inexistente';
  end if;

  -- Repetir o estado atual e retomada, nao erro: o comando roda de novo depois
  -- de uma falha externa e encontra o que ja tinha gravado.
  if p_estado = v_abertura.estado then
    return v_abertura.estado;
  end if;

  if public.abertura_ordem(p_estado) <> public.abertura_ordem(v_abertura.estado) + 1 then
    raise exception 'abertura_fora_de_ordem: de % para %', v_abertura.estado, p_estado;
  end if;

  update public.aberturas_concurso
     set estado = p_estado,
         concluida_em = case when p_estado = 'concluida' then now() else concluida_em end,
         atualizada_em = now()
   where id = p_abertura;

  return p_estado;
end;
$$;

/**
 * Grava a proposta de vinculo que a sessao produziu ao ler o trecho do programa.
 *
 * Proposta nao muda nada: cada linha nasce `pendente`, e o edital do concurso
 * segue exatamente como estava ate a segunda confirmacao.
 */
create or replace function public.registrar_assuntos_propostos(
  p_abertura uuid,
  p_operador uuid,
  p_assuntos jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linhas integer := 0;
begin
  perform public.abertura_em_estado(p_abertura, p_operador, 'processamento_em_andamento');

  if p_assuntos is null or jsonb_typeof(p_assuntos) <> 'array'
     or jsonb_array_length(p_assuntos) = 0 then
    raise exception 'assuntos_invalidos';
  end if;

  insert into public.abertura_assuntos
    (abertura_id, materia_edital, nome_proposto, ordem, topico_id, candidatos)
  select
    p_abertura,
    a->>'materia_edital',
    a->>'nome_proposto',
    coalesce((a->>'ordem')::smallint, 0),
    (a->>'topico_id')::uuid,
    coalesce(a->'candidatos', '[]'::jsonb)
  from jsonb_array_elements(p_assuntos) as a
  on conflict (abertura_id, materia_edital, nome_proposto) do update
    set ordem      = excluded.ordem,
        topico_id  = excluded.topico_id,
        candidatos = excluded.candidatos
  where abertura_assuntos.decisao = 'pendente';

  get diagnostics v_linhas = row_count;

  update public.aberturas_concurso
     set estado = 'assuntos_pendentes', atualizada_em = now()
   where id = p_abertura;

  return v_linhas;
end;
$$;

/**
 * A segunda confirmacao: o quadro inteiro do edital numa transacao so.
 *
 * Cada linha vira uma de quatro coisas — mapear para canonico existente, criar
 * assunto novo pela fila de candidatos da SPEC 15, fundir um quase-duplicado no
 * canonico vigente, ou rejeitar. **Nada e automatico**: linha sem decisao para
 * a funcao inteira, e a fusao usa a funcao da SPEC 37, nao um UPDATE local.
 *
 * `p_pesos` entra aqui, e nao numa chamada a parte, porque peso de materia sem
 * assunto mapeado — ou o contrario — e meio edital aplicado.
 */
create or replace function public.decidir_assuntos(
  p_abertura uuid,
  p_operador uuid,
  p_decisoes jsonb,
  p_pesos    jsonb,
  p_motivo   text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_abertura   public.aberturas_concurso%rowtype;
  v_linha      public.abertura_assuntos%rowtype;
  v_entrada    jsonb;
  v_decisao    public.abertura_assunto_decisao;
  v_topico     uuid;
  v_origem     uuid;
  v_materia    uuid;
  v_candidato  uuid;
  v_aplicados  integer := 0;
  v_pendentes  integer := 0;
begin
  v_abertura := public.abertura_em_estado(p_abertura, p_operador, 'assuntos_pendentes');

  if p_decisoes is null or jsonb_typeof(p_decisoes) <> 'array'
     or jsonb_array_length(p_decisoes) = 0 then
    raise exception 'decisoes_invalidas';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_obrigatorio';
  end if;

  for v_entrada in select jsonb_array_elements(p_decisoes) loop
    select a.* into v_linha
      from public.abertura_assuntos a
     where a.id = (v_entrada->>'id')::uuid and a.abertura_id = p_abertura
     for update;

    if v_linha.id is null then
      raise exception 'assunto_fora_da_abertura';
    end if;
    if v_linha.decisao <> 'pendente' then
      raise exception 'assunto_ja_decidido';
    end if;

    v_decisao := (v_entrada->>'decisao')::public.abertura_assunto_decisao;
    if v_decisao = 'pendente' then
      raise exception 'decisao_invalida';
    end if;

    v_topico := null;

    if v_decisao = 'mapear' then
      v_topico := (v_entrada->>'topico_id')::uuid;
      if v_topico is null then
        raise exception 'topico_obrigatorio_para_mapear';
      end if;

    elsif v_decisao = 'criar' then
      -- Assunto novo nasce pela fila de curadoria da SPEC 15, e nao por INSERT
      -- direto em `topicos`: e ela que grava autor, motivo e trilha.
      v_materia := (v_entrada->>'materia_id')::uuid;
      if v_materia is null then
        raise exception 'materia_obrigatoria_para_criar';
      end if;
      insert into public.topico_candidato (nome_sugerido, materia_id)
      values (btrim(v_linha.nome_proposto), v_materia)
      returning id into v_candidato;
      v_topico := public.decidir_topico_candidato(
        v_candidato, 'aprovado', p_operador, v_materia,
        btrim(v_linha.nome_proposto), btrim(p_motivo)
      );

    elsif v_decisao = 'fundir' then
      v_topico := (v_entrada->>'topico_id')::uuid;   -- destino vigente
      v_origem := (v_entrada->>'origem_id')::uuid;   -- o quase-duplicado
      if v_topico is null or v_origem is null then
        raise exception 'fusao_exige_origem_e_destino';
      end if;
      perform public.fundir_assuntos_canonicos(
        v_origem, v_topico, p_operador, btrim(p_motivo)
      );
    end if;

    update public.abertura_assuntos
       set decisao = v_decisao,
           decidido_em = now(),
           decidido_por = p_operador,
           topico_resultante = v_topico
     where id = v_linha.id;

    -- O mapa do edital: a materia daquele concurso, com o nome dele, e o
    -- assunto canonico pendurado nela (AD-139). `rejeitar` nao mapeia nada.
    if v_topico is not null then
      insert into public.concurso_materias (concurso_id, nome, ordem)
      values (v_abertura.concurso_id, btrim(v_linha.materia_edital), v_linha.ordem)
      on conflict (concurso_id, nome) do update set nome = excluded.nome
      returning id into v_materia;

      insert into public.concurso_materia_assuntos
        (concurso_id, concurso_materia_id, topico_id, ordem)
      values (v_abertura.concurso_id, v_materia, v_topico, v_linha.ordem)
      on conflict (concurso_materia_id, topico_id) do nothing;
    end if;

    v_aplicados := v_aplicados + 1;
  end loop;

  select count(*) into v_pendentes
    from public.abertura_assuntos
   where abertura_id = p_abertura and decisao = 'pendente';
  if v_pendentes > 0 then
    raise exception 'assuntos_pendentes_restantes: %', v_pendentes;
  end if;

  -- O peso que o edital declara e o nivel 1 do degrau 2 (SPEC 39). Vazio e
  -- legitimo: edital sem tabela de pontos deixa o concurso no degrau que tiver.
  if p_pesos is not null and jsonb_typeof(p_pesos) = 'array'
     and jsonb_array_length(p_pesos) > 0 then
    perform public.registrar_peso_do_edital(v_abertura.concurso_id, p_pesos);
  end if;

  update public.aberturas_concurso
     set estado = 'pronto_para_recalculo', atualizada_em = now()
   where id = p_abertura;

  perform public.registrar_acao_operador(
    p_operador, 'abertura_assuntos_decididos', 'aberturas_concurso',
    p_abertura::text, btrim(p_motivo),
    jsonb_build_object('aplicados', v_aplicados)
  );

  return v_aplicados;
end;
$$;

/**
 * Fecha a execucao. Nao publica nada: publicar continua sendo
 * `publicar_concurso`, com elegibilidade e assinatura propria (RAIOX-20 AC2).
 */
create or replace function public.concluir_abertura(
  p_abertura uuid,
  p_operador uuid,
  p_motivo   text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_abertura public.aberturas_concurso%rowtype;
begin
  v_abertura := public.abertura_em_estado(p_abertura, p_operador, 'pronto_para_recalculo');

  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_obrigatorio';
  end if;

  update public.aberturas_concurso
     set estado = 'concluida', concluida_em = now(), atualizada_em = now()
   where id = p_abertura;

  perform public.registrar_acao_operador(
    p_operador, 'abertura_concluida', 'aberturas_concurso', p_abertura::text,
    btrim(p_motivo), jsonb_build_object('concurso_id', v_abertura.concurso_id)
  );

  return v_abertura.concurso_id;
end;
$$;

-- ── O que o relatorio le ────────────────────────────────────────────────────
create or replace view public.abertura_em_curso
with (security_invoker = true)
as
  select
    a.id            as abertura_id,
    a.concurso_id,
    c.orgao,
    c.cargo,
    c.visibilidade,
    a.estado,
    a.operador_id,
    a.descartados,
    a.faltantes,
    count(d.id) filter (where d.decisao = 'pendente')::integer  as documentos_pendentes,
    count(d.id) filter (where d.decisao = 'aprovado')::integer  as documentos_aprovados,
    count(d.id) filter (where d.decisao = 'rejeitado')::integer as documentos_rejeitados,
    count(d.id) filter (where d.baixado_em is not null)::integer as documentos_baixados,
    count(d.id) filter (where d.prova_id is not null)::integer   as provas_da_abertura,
    a.criada_em,
    a.atualizada_em,
    a.concluida_em
  from public.aberturas_concurso a
  join public.concursos c on c.id = a.concurso_id
  left join public.concurso_documentos d on d.abertura_id = a.id
  group by a.id, c.orgao, c.cargo, c.visibilidade;

comment on view public.abertura_em_curso is
  'Uma linha por execucao de abertura, com estado e contagens. E o que o comando `relatorio` le para dizer onde a execucao parou e como retomar.';

revoke all on public.abertura_em_curso from public, anon, authenticated;
grant select on public.abertura_em_curso to service_role;

-- ── Privilegios das funcoes ─────────────────────────────────────────────────
revoke all on function public.abertura_ordem(public.abertura_estado) from public, anon, authenticated;
revoke all on function public.abertura_em_estado(uuid, uuid, public.abertura_estado) from public, anon, authenticated;
revoke all on function public.iniciar_abertura(uuid, uuid) from public, anon, authenticated;
revoke all on function public.registrar_documentos_encontrados(uuid, uuid, jsonb, integer, jsonb) from public, anon, authenticated;
revoke all on function public.decidir_documentos(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.registrar_documento_baixado(uuid, uuid, uuid, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.avancar_abertura(uuid, uuid, public.abertura_estado) from public, anon, authenticated;
revoke all on function public.registrar_assuntos_propostos(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.decidir_assuntos(uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.concluir_abertura(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.abertura_ordem(public.abertura_estado) to service_role;
grant execute on function public.abertura_em_estado(uuid, uuid, public.abertura_estado) to service_role;
grant execute on function public.iniciar_abertura(uuid, uuid) to service_role;
grant execute on function public.registrar_documentos_encontrados(uuid, uuid, jsonb, integer, jsonb) to service_role;
grant execute on function public.decidir_documentos(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.registrar_documento_baixado(uuid, uuid, uuid, integer, text, uuid) to service_role;
grant execute on function public.avancar_abertura(uuid, uuid, public.abertura_estado) to service_role;
grant execute on function public.registrar_assuntos_propostos(uuid, uuid, jsonb) to service_role;
grant execute on function public.decidir_assuntos(uuid, uuid, jsonb, jsonb, text) to service_role;
grant execute on function public.concluir_abertura(uuid, uuid, text) to service_role;
