-- AD-146 · BANCO-14 · RAIOX-16 · RAIOX-17 · RAIOX-18 (corrige o legado do BB)
--
-- Duas coisas falharam ao mesmo tempo, e o Raio-X do BB saiu inteiro em zero.
--
-- **1. A medicao olhava so metade da verdade.** A SPEC 38 diz, em texto, que a
-- questao publicada vence a etiqueta (BANCO-14 AC3) — mas quem lia isso era
-- `alinhar_etiquetas_com_questoes`, que so conserta uma etiqueta **ja
-- existente**. Onde nao ha etiqueta nenhuma, a regra nao tinha por onde agir: o
-- acervo tem 1.375 questoes vigentes publicadas e classificadas e **zero**
-- linhas em `etiquetas_de_item`, e a medicao contava zero. Reetiquetar por
-- modelo o que ja foi conferido por humano seria pagar para produzir uma
-- classificacao pior.
--
-- A saida NAO e copiar 1.375 questoes para `etiquetas_de_item`: isso criaria a
-- segunda classificacao concorrente que o proprio AC3 proibe, e faria a
-- correcao de uma questao publicada divergir em silencio da etiqueta gemea. A
-- saida e uma **fronteira de leitura** — `itens_medidos_efetivos` —, com uma
-- linha por `(prova_id, numero)` e a precedencia escrita nela:
--
--     questao publicada  >  etiqueta humana  >  etiqueta de IA
--
-- que e exatamente a hierarquia que a SPEC 38 declarou. `etiquetas_de_item`
-- continua sendo a medicao de item que **nao** existe como questao publicada, e
-- e por isso que ela nao some.
--
-- **2. "Prova propria" era comparacao de texto.** `recalcula_raiox()` descobria
-- se uma prova pertencia ao concurso comparando `concursos.orgao` com
-- `provas.orgao` e `concursos.cargo` com `provas.cargo`. No banco real o
-- concurso legado e `Banco do Brasil — Escriturario, Agente Comercial` com
-- `cargo='indefinido'` (sentinela da SPEC 37), e as provas sao
-- `orgao='Banco do Brasil'` com `cargo='Escriturario - Agente Comercial'`.
-- Nenhuma casava. Trocar a comparacao por outra comparacao mais esperta seria
-- repetir o erro: **a pergunta "esta prova da lastro a este concurso" e humana**,
-- e a resposta dela vira linha em `concurso_provas`, com autor e motivo.
--
-- O que este arquivo NAO faz: nenhum INSERT de backfill. Vincular as provas do
-- BB e operacao com autorizacao propria, feita pelo fluxo da SPEC 40.

-- ════════════════════════════════════════════════════════════════════════════
-- 1 · O item medido, uma vez so
-- ════════════════════════════════════════════════════════════════════════════

/**
 * A fonte unica da medicao: uma linha por `(prova_id, numero)`.
 *
 * O `full join` e o desenho inteiro. Ele entrega os tres casos sem UNION e sem
 * DISTINCT ON: item que so tem questao, item que so tem etiqueta, e item que
 * tem os dois — e neste ultimo o `coalesce` faz a questao ganhar, porque ela e
 * o mesmo dado que o aluno estuda e foi conferido por humano.
 *
 * A unicidade nao depende de boa vontade: `questoes_numero_unico_na_prova` e
 * unico em `(prova_id, numero) where vigente`, e a chave de `etiquetas_de_item`
 * e `(prova_id, numero)`. Versao antiga da questao nao entra (`vigente`), e por
 * isso reeditar uma questao nao duplica item medido.
 *
 * `origem='gerada_ia'` fica de fora por invariante do projeto: questao inedita
 * nunca conta como o que a banca cobrou (Raio-X so conta `origem='real'`).
 */
create or replace view public.itens_medidos_efetivos
with (security_invoker = true)
as
  select
    coalesce(pub.prova_id, eti.prova_id)          as prova_id,
    coalesce(pub.numero, eti.numero::integer)     as numero,
    coalesce(pub.topico_id, eti.topico_id)        as topico_id,
    case
      when pub.prova_id is not null then 'questao_publicada'
      when eti.origem = 'humano'    then 'etiqueta_humana'
      else                               'etiqueta_ia'
    end                                           as fonte
    from (
      -- Rascunho, rejeitada e versao antiga nao aparecem aqui de proposito:
      -- verdade publicada e o que passou pela revisao, nao o que esta na fila.
      select q.prova_id, q.numero, q.topico_id
        from public.questoes q
       where q.vigente
         and q.status = 'publicada'
         and q.origem = 'real'
         and q.prova_id  is not null
         and q.numero    is not null
         and q.topico_id is not null
    ) pub
    full join public.etiquetas_de_item eti
      on eti.prova_id = pub.prova_id
     and eti.numero   = pub.numero;

comment on view public.itens_medidos_efetivos is
  'A unidade de medicao do AD-138 vista de um lugar so: questao publicada > etiqueta humana > etiqueta de IA, uma linha por (prova_id, numero), com a precedencia exposta em `fonte`. A questao publicada NAO e copiada para `etiquetas_de_item` (AD-146, BANCO-14 AC3).';

revoke all on public.itens_medidos_efetivos from public, anon, authenticated;
grant select on public.itens_medidos_efetivos to service_role;

-- ── Cobertura, agora sobre o item efetivo ───────────────────────────────────
--
-- Mesmas colunas de antes: `provas_medidas` depende desta view e nao pode ver a
-- forma mudar. O que muda e o numerador — a prova cujos 70 itens ja sao questao
-- publicada tem cobertura cheia sem uma unica etiqueta, que e a verdade dela.
create or replace view public.cobertura_da_prova
with (security_invoker = true)
as
  select
    p.id                    as prova_id,
    p.banca, p.ano, p.orgao, p.cargo, p.caderno,
    p.grade_status,
    p.separacao_via,
    p.conferencia_motivo,
    p.caderno_irmao_de,
    p.itens_declarados,
    count(i.numero)::integer as itens_ingeridos,
    case
      when p.itens_declarados is null or p.itens_declarados = 0 then null
      else round(count(i.numero)::numeric / p.itens_declarados, 4)
    end                      as cobertura
  from public.provas p
  left join public.itens_medidos_efetivos i on i.prova_id = p.id
  group by p.id;

comment on view public.cobertura_da_prova is
  'cobertura = itens medidos efetivos / itens_declarados (BANCO-15 AC2, AD-146). O numerador conta questao publicada e etiqueta na mesma moeda, uma vez por item.';

-- ── A materia do bloco, idem ────────────────────────────────────────────────
--
-- A moda que resolve a materia de um bloco sem `materia_id` explicito passa a
-- enxergar a questao publicada. Sem isto o BB continuaria com blocos sem
-- materia mesmo depois de a grade ser lida, e o peso sumiria da tela.
create or replace view public.prova_bloco_materia
with (security_invoker = true)
as
  select
    b.prova_id,
    b.ordem,
    b.item_inicial,
    b.item_final,
    b.base,
    public.peso_do_bloco(b)                 as peso,
    coalesce(b.materia_id, moda.materia_id) as materia_id,
    (b.materia_id is not null)              as materia_vinculada
    from public.prova_blocos b
    left join lateral (
      select t.materia_id
        from public.itens_medidos_efetivos i
        join public.topicos t on t.id = i.topico_id
       where i.prova_id = b.prova_id
         and i.numero between b.item_inicial and b.item_final
       group by t.materia_id
       order by count(*) desc, t.materia_id
       limit 1
    ) moda on b.materia_id is null;

comment on view public.prova_bloco_materia is
  'O bloco declarado da grade com a materia canonica resolvida: coluna explicita quando existe, moda dos itens medidos efetivos da faixa quando nao (RAIOX-16 AC2, AD-146).';

-- ════════════════════════════════════════════════════════════════════════════
-- 2 · O vinculo concurso -> prova, explicito
-- ════════════════════════════════════════════════════════════════════════════

create table public.concurso_provas (
  concurso_id uuid not null references public.concursos(id) on delete cascade,
  prova_id    uuid not null references public.provas(id)    on delete cascade,

  -- Nao ha vinculo sem autor. Prova nao vira lastro de degrau 1 por deducao de
  -- codigo: alguem assinou que aquele caderno e daquele concurso.
  vinculada_por uuid not null references auth.users(id),
  motivo        text not null check (length(btrim(motivo)) > 0),

  -- De qual execucao de abertura o vinculo saiu. Nulo no backfill do acervo
  -- legado feito fora de uma abertura, e no vinculo corrigido a mao.
  abertura_id   uuid references public.aberturas_concurso(id) on delete set null,

  vinculada_em  timestamptz not null default now(),

  -- A mesma prova apoiando dois concursos e legitimo (a prova da CAIXA de 2024
  -- pode ser lastro do proprio concurso da CAIXA), mas exige DOIS vinculos
  -- humanos separados — nunca um vinculo que vale para os dois por heranca.
  primary key (concurso_id, prova_id)
);

comment on table public.concurso_provas is
  'Quais provas dao lastro de degrau 1 a um concurso, por decisao humana registrada (AD-146). Substitui a comparacao textual de orgao/cargo que `recalcula_raiox` fazia. Escrita SOMENTE por `vincular_prova_ao_concurso`.';
comment on column public.concurso_provas.abertura_id is
  'A execucao de abertura (SPEC 40) que produziu o vinculo. Nulo quando o vinculo veio do backfill do acervo legado.';

-- Ler "quais concursos esta prova apoia" e a pergunta do inventario legado e do
-- relatorio; a PK so serve a direcao oposta.
create index concurso_provas_por_prova_idx on public.concurso_provas (prova_id);
create index concurso_provas_da_abertura_idx
  on public.concurso_provas (abertura_id) where abertura_id is not null;

-- Mesma postura das tabelas de operacao: o navegador nao encosta. Quem escreve
-- e o comando, com a credencial administrativa dos jobs.
revoke all on public.concurso_provas from public, anon, authenticated;
grant select, insert, update, delete on public.concurso_provas to service_role;
alter table public.concurso_provas enable row level security;

/**
 * O unico caminho de escrita de `concurso_provas`.
 *
 * Idempotente por desenho: repetir o mesmo vinculo devolve `false` e **nao**
 * cria linha nem segunda entrada em `operador_acoes` — o retry de uma abertura
 * interrompida nao pode virar duas assinaturas do mesmo fato.
 *
 * @returns true quando o vinculo nasceu agora; false quando ja existia.
 */
create or replace function public.vincular_prova_ao_concurso(
  p_concurso uuid,
  p_prova    uuid,
  p_operador uuid,
  p_motivo   text,
  p_abertura uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linhas integer := 0;
begin
  perform public.exigir_operador_ativo(p_operador);

  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_obrigatorio';
  end if;
  if not exists (select 1 from public.concursos c where c.id = p_concurso) then
    raise exception 'concurso_inexistente';
  end if;
  if not exists (select 1 from public.provas p where p.id = p_prova) then
    raise exception 'prova_inexistente';
  end if;
  -- Abertura de OUTRO concurso nao assina vinculo deste: o `abertura_id` e
  -- proveniencia, e proveniencia errada e pior que proveniencia ausente.
  if p_abertura is not null and not exists (
    select 1 from public.aberturas_concurso a
     where a.id = p_abertura and a.concurso_id = p_concurso
  ) then
    raise exception 'abertura_fora_do_concurso';
  end if;

  insert into public.concurso_provas
    (concurso_id, prova_id, vinculada_por, motivo, abertura_id)
  values (p_concurso, p_prova, p_operador, btrim(p_motivo), p_abertura)
  on conflict (concurso_id, prova_id) do nothing;

  -- `do nothing` que nao inseriu deixa `row_count` em zero: e assim que a
  -- idempotencia sabe a diferenca entre "criei" e "ja estava la".
  get diagnostics v_linhas = row_count;

  if v_linhas > 0 then
    perform public.registrar_acao_operador(
      p_operador, 'vincular_prova_ao_concurso', 'concurso_provas',
      p_concurso::text, btrim(p_motivo),
      jsonb_build_object('prova_id', p_prova, 'abertura_id', p_abertura)
    );
  end if;

  return v_linhas > 0;
end;
$$;

comment on function public.vincular_prova_ao_concurso(uuid, uuid, uuid, text, uuid) is
  'Unico caminho de escrita de concurso_provas. Exige operador ativo e motivo, confere o escopo da abertura, e e idempotente: repetir devolve false sem criar linha nem acao (AD-146).';

revoke all on function public.vincular_prova_ao_concurso(uuid, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.vincular_prova_ao_concurso(uuid, uuid, uuid, text, uuid)
  to service_role;

/**
 * As provas que um concurso pode contar como proprias, com a via que respondeu.
 *
 * `via = 'vinculo'` e a resposta definitiva. `via = 'texto'` e a compatibilidade
 * temporaria do AD-146, e ela **so vale enquanto o concurso nao tiver nenhum
 * vinculo explicito**: a primeira prova vinculada apaga o caminho legado inteiro
 * daquele concurso, de proposito — meia lista explicita e meia lista adivinhada
 * seria o pior dos dois. Quando todo concurso vivo estiver vinculado, o `union`
 * de baixo pode sair sem tocar em quem le.
 *
 * `indefinido` e o default de `concursos.cargo` (SPEC 37) e o valor com que o
 * perfil vigente foi migrado — e um **sentinela**, exatamente como
 * `banca = 'indefinida'`, e nao o nome de um cargo. Filtrar por ele deixaria o
 * concurso numero 1 sem prova propria nenhuma, todas as linhas no degrau 4 e o
 * plano do dia sem topico. Sentinela nao filtra, e por isso o `nullif`.
 */
create or replace function public.provas_proprias_do_concurso(p_concurso uuid)
returns table (prova_id uuid, via text)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.prova_id, 'vinculo'::text
    from public.concurso_provas cp
   where cp.concurso_id = p_concurso
  union all
  select p.id, 'texto'::text
    from public.concursos c
    join public.provas p
      on p.orgao = c.orgao
     and (nullif(c.cargo, 'indefinido') is null or p.cargo = c.cargo)
   where c.id = p_concurso
     and not exists (
       select 1 from public.concurso_provas cp where cp.concurso_id = p_concurso
     );
$$;

comment on function public.provas_proprias_do_concurso(uuid) is
  'As provas de lastro proprio de um concurso: o vinculo explicito de concurso_provas e, SOMENTE na ausencia total de vinculo, a igualdade textual legada de orgao/cargo (AD-146, compatibilidade removivel).';

revoke all on function public.provas_proprias_do_concurso(uuid) from public, anon, authenticated;
grant execute on function public.provas_proprias_do_concurso(uuid) to service_role;
