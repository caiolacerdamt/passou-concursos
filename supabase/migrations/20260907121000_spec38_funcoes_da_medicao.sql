-- SPEC 38 · BANCO-14 · BANCO-15 · BANCO-16 · AD-138
--
-- As funcoes que fazem a medicao ser confiavel. A regra que elas existem para
-- cumprir cabe numa hierarquia de tres linhas:
--
--     questao publicada  >  etiqueta humana  >  etiqueta de IA
--
-- e num veredito: a grade declarada pela prova e o **gabarito de qualidade** do
-- etiquetador. Quando a soma nao bate, a prova nao entra no Raio-X — em vez de
-- entrar com peso errado, que e o erro caro e silencioso.

-- ── A grade declarada (BANCO-15) ────────────────────────────────────────────
--
-- **Este e o unico lugar do projeto que escreve em `prova_blocos`.** A ausencia
-- de qualquer outro `insert` e o que cumpre o AC4: nao existe caminho por onde
-- uma grade inferida entre em silencio.
--
-- `p_blocos` e um array de objetos:
--   [{"ordem":1,"nome_impresso":"LINGUA PORTUGUESA","item_inicial":1,
--     "item_final":10,"pontuacao_por_item":1.0}]
-- `pontuacao_por_item` ausente ou nula = a prova nao declarou pontuacao, e o
-- bloco nasce com base `itens` (AC3).
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

  -- Reexecutar e normal: o leitor melhora e a prova e relida. Apagar antes de
  -- inserir mantem a grade como um retrato inteiro, nunca uma mistura de duas
  -- leituras.
  delete from public.prova_blocos b where b.prova_id = p_prova;

  -- Grade nao lida: `ausente`, fila humana, e **nenhum bloco** (AC4).
  if jsonb_array_length(p_blocos) = 0 or p_itens_declarados is null then
    update public.provas
       set itens_declarados = null,
           grade_status     = 'ausente',
           atualizada_em    = now()
     where id = p_prova;
    return 'ausente';
  end if;

  insert into public.prova_blocos
    (prova_id, ordem, nome_impresso, item_inicial, item_final, pontuacao_por_item, base)
  select
    p_prova,
    (b->>'ordem')::smallint,
    nullif(btrim(coalesce(b->>'nome_impresso', '')), ''),
    (b->>'item_inicial')::smallint,
    (b->>'item_final')::smallint,
    (b->>'pontuacao_por_item')::numeric,
    case when (b->>'pontuacao_por_item') is null then 'itens' else 'pontos' end
  from jsonb_array_elements(p_blocos) as b;

  select count(*), coalesce(sum(item_final - item_inicial + 1), 0)
    into v_blocos, v_soma
    from public.prova_blocos
   where prova_id = p_prova;

  -- AC5: soma dos blocos <> total declarado = inconsistente. Adulterar um
  -- cabecalho cai exatamente aqui, e a prova para de valer para o Raio-X em vez
  -- de gerar peso errado.
  v_status := case when v_soma = p_itens_declarados then 'lida' else 'inconsistente' end;

  -- Faixa sobreposta tambem e inconsistencia: a mesma questao em dois blocos
  -- pesaria duas vezes, e a soma pode bater por acaso.
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
  'Unico caminho de escrita de prova_blocos. Grava o veredito: lida, inconsistente (soma ou sobreposicao) ou ausente (BANCO-15 AC1/AC3/AC4/AC5).';

-- ── Questao publicada vence (BANCO-14 AC3) ──────────────────────────────────
--
-- "SHALL NOT haver duas classificacoes concorrentes para o mesmo item" e
-- categorico: quando o item ja existe como questao publicada com assunto, o
-- assunto da questao **e** a etiqueta. A confianca vai a 1 porque nao ha
-- estimativa envolvida — e o mesmo dado que o aluno estuda.
create or replace function public.alinhar_etiquetas_com_questoes(p_prova uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alinhadas integer := 0;
begin
  with verdade as (
    select q.numero, q.topico_id
      from public.questoes q
     where q.prova_id = p_prova
       and q.vigente
       and q.status = 'publicada'
       and q.topico_id is not null
       and q.numero is not null
  )
  update public.etiquetas_de_item e
     set topico_id     = v.topico_id,
         confianca     = 1,
         atualizada_em = now()
    from verdade v
   where e.prova_id = p_prova
     and e.numero   = v.numero
     and e.topico_id is distinct from v.topico_id;

  get diagnostics v_alinhadas = row_count;
  return v_alinhadas;
end;
$$;

comment on function public.alinhar_etiquetas_com_questoes(uuid) is
  'A questao publicada e a verdade e a etiqueta aponta para ela (BANCO-14 AC3). Roda dentro de gravar_etiquetas_ia e tambem sozinha, depois de uma publicacao.';

-- ── A gravacao do etiquetador (BANCO-14 AC4/AC5) ────────────────────────────
--
-- `p_etiquetas`: [{"numero":1,"topico_id":"…","confianca":0.93}]
--
-- Tres coisas que esta funcao **nao** faz, e cada ausencia e um AC:
--   * nao apaga linha `origem='humano'` (AC4);
--   * nao insere linha repetida — `on conflict` na chave (AC5);
--   * nao inventa topico: `topico_id` vem casado com a taxonomia pelo codigo
--     que chamou (o mesmo `casarTopico` da SPEC 09).
create or replace function public.gravar_etiquetas_ia(
  p_prova         uuid,
  p_etiquetas     jsonb,
  p_modelo_versao text
)
returns table (gravadas integer, preservadas integer, alinhadas integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gravadas    integer := 0;
  v_preservadas integer := 0;
  v_alinhadas   integer := 0;
begin
  if p_etiquetas is null or jsonb_typeof(p_etiquetas) <> 'array' then
    raise exception 'etiquetas_invalidas';
  end if;

  if p_modelo_versao is null or length(btrim(p_modelo_versao)) = 0 then
    raise exception 'modelo_versao_obrigatoria';
  end if;

  select count(*) into v_preservadas
    from public.etiquetas_de_item
   where prova_id = p_prova and origem = 'humano';

  with entrada as (
    select
      (e->>'numero')::smallint     as numero,
      (e->>'topico_id')::uuid      as topico_id,
      (e->>'confianca')::numeric   as confianca
    from jsonb_array_elements(p_etiquetas) as e
  ),
  -- A correcao humana e filtrada **antes** do insert, e nao "resolvida" no
  -- `on conflict`: assim a linha humana nem chega a ser candidata a UPDATE.
  nova as (
    select en.*
      from entrada en
     where not exists (
       select 1 from public.etiquetas_de_item j
        where j.prova_id = p_prova and j.numero = en.numero and j.origem = 'humano'
     )
  ),
  gravou as (
    insert into public.etiquetas_de_item
      (prova_id, numero, topico_id, confianca, origem, modelo_versao)
    select p_prova, numero, topico_id, confianca, 'ia', p_modelo_versao from nova
    on conflict (prova_id, numero) do update
      set topico_id     = excluded.topico_id,
          confianca     = excluded.confianca,
          modelo_versao = excluded.modelo_versao,
          atualizada_em = now()
    returning 1
  )
  select count(*) into v_gravadas from gravou;

  v_alinhadas := public.alinhar_etiquetas_com_questoes(p_prova);

  return query select v_gravadas, v_preservadas, v_alinhadas;
end;
$$;

comment on function public.gravar_etiquetas_ia(uuid, jsonb, text) is
  'Reexecucao do etiquetador: substitui SOMENTE as etiquetas de origem ia, nunca duplica linha, e registra a versao do modelo (BANCO-14 AC4/AC5).';

-- ── A correcao humana (BANCO-14 AC4) ────────────────────────────────────────
create or replace function public.corrigir_etiqueta(
  p_prova       uuid,
  p_numero      smallint,
  p_topico      uuid,
  p_operador_id uuid,
  p_motivo      text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.operador_ativo(p_operador_id) then
    raise exception 'operador_invalido';
  end if;

  if p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'motivo_obrigatorio';
  end if;

  if not exists (select 1 from public.topicos t where t.id = p_topico and t.ativo) then
    raise exception 'assunto_inexistente_ou_inativo';
  end if;

  -- Item que ja e questao publicada nao se corrige por aqui: a etiqueta dele e
  -- reflexo da questao (AC3), e uma correcao local voltaria a criar duas
  -- classificacoes concorrentes. A correcao certa e na questao.
  if exists (
    select 1 from public.questoes q
     where q.prova_id = p_prova and q.numero = p_numero
       and q.vigente and q.status = 'publicada' and q.topico_id is not null
  ) then
    raise exception 'item_tem_questao_publicada';
  end if;

  insert into public.etiquetas_de_item
    (prova_id, numero, topico_id, confianca, origem, modelo_versao)
  values (p_prova, p_numero, p_topico, 1, 'humano', null)
  on conflict (prova_id, numero) do update
    set topico_id     = excluded.topico_id,
        confianca     = 1,
        origem        = 'humano',
        modelo_versao = null,
        atualizada_em = now();

  insert into public.operador_acoes (operador_id, tipo, entidade, entidade_id, motivo, dados)
  values (
    p_operador_id, 'corrigir_etiqueta', 'etiquetas_de_item',
    p_prova::text, p_motivo,
    jsonb_build_object('numero', p_numero, 'topico_id', p_topico)
  );
end;
$$;

comment on function public.corrigir_etiqueta(uuid, smallint, uuid, uuid, text) is
  'Correcao humana da etiqueta: vira origem humano e sobrevive a qualquer reexecucao (BANCO-14 AC4). Recusa item que ja tem questao publicada.';

-- ── Caderno irmao (BANCO-16 AC6) ────────────────────────────────────────────
create or replace function public.vincular_caderno_irmao(
  p_irmao     uuid,
  p_principal uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_irmao     public.provas%rowtype;
  v_principal public.provas%rowtype;
begin
  select * into v_irmao     from public.provas where id = p_irmao;
  select * into v_principal from public.provas where id = p_principal;

  if v_irmao.id is null or v_principal.id is null then
    raise exception 'prova_inexistente';
  end if;

  -- Cadernos irmaos sao o **mesmo** concurso em outra ordem. Chave natural
  -- diferente significa provas diferentes, e ai o peso e mesmo de duas.
  if (v_irmao.banca, v_irmao.ano, v_irmao.orgao, v_irmao.cargo)
     is distinct from (v_principal.banca, v_principal.ano, v_principal.orgao, v_principal.cargo) then
    raise exception 'cadernos_de_concursos_diferentes';
  end if;

  update public.provas
     set caderno_irmao_de = p_principal,
         atualizada_em    = now()
   where id = p_irmao;
end;
$$;

comment on function public.vincular_caderno_irmao(uuid, uuid) is
  'Registra o caderno Tipo B/C como irmao do principal: continua ingerido, mas NAO soma peso ao ano (BANCO-16 AC6).';

-- ── Cobertura e as filas (BANCO-15 AC2) ─────────────────────────────────────
--
-- View e nao coluna: coluna precisaria de gatilho em `etiquetas_de_item` para
-- nao mentir, e um numero que mente sobre quanto da prova foi medido e pior que
-- numero nenhum.
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
    count(e.numero)::integer as itens_ingeridos,
    case
      when p.itens_declarados is null or p.itens_declarados = 0 then null
      else round(count(e.numero)::numeric / p.itens_declarados, 4)
    end                      as cobertura
  from public.provas p
  left join public.etiquetas_de_item e on e.prova_id = p.id
  group by p.id;

comment on view public.cobertura_da_prova is
  'cobertura = itens_ingeridos / itens_declarados (BANCO-15 AC2). Publico: a SPEC 39 usa como piso de entrada e a SPEC 40 mostra ao operador.';

-- A fila humana do AC4: prova sem grade legivel. Ordenada pelo ano mais recente,
-- que e o que mais pesa no Raio-X.
create or replace view public.grade_ausente_fila
with (security_invoker = true)
as
  select p.id as prova_id, p.banca, p.ano, p.orgao, p.cargo, p.caderno, p.status
    from public.provas p
   where p.grade_status = 'ausente'
     and p.status <> 'falhou'
   order by p.ano desc, p.banca, p.orgao;

comment on view public.grade_ausente_fila is
  'Provas cuja grade nao pode ser lida do documento e que esperam preenchimento humano (BANCO-15 AC4).';

-- O que a SPEC 39 tem direito de contar. Tres portas, todas do BANCO-15/16:
-- grade lida, sem conferencia pendente e caderno principal.
create or replace view public.provas_medidas
with (security_invoker = true)
as
  select c.*
    from public.cobertura_da_prova c
   where c.grade_status = 'lida'
     and c.conferencia_motivo is null
     and c.caderno_irmao_de is null;

comment on view public.provas_medidas is
  'Provas que podem entrar no Raio-X: grade lida, sem conferencia humana pendente e caderno principal (BANCO-15 AC5, BANCO-16 AC5/AC6). O piso de cobertura e aplicado por quem consulta, com param.m1.cobertura_minima.';

revoke all on public.cobertura_da_prova  from anon, authenticated;
revoke all on public.grade_ausente_fila  from anon, authenticated;
revoke all on public.provas_medidas      from anon, authenticated;
grant select on public.cobertura_da_prova, public.grade_ausente_fila, public.provas_medidas
  to service_role;
