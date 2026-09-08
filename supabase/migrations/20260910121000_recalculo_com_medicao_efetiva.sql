-- AD-146 · RAIOX-16 · RAIOX-17 · RAIOX-18 (recorta a SPEC 39 em dois pontos)
--
-- `recalcula_raiox()` inteira, com duas trocas cirurgicas e nada mais:
--
--   1. a materia-prima do nivel 2 passa de `etiquetas_de_item` para
--      `itens_medidos_efetivos`, e com isso as 1.375 questoes publicadas do
--      acervo passam a medir o que a banca cobra — sem virar copia em
--      `etiquetas_de_item` e sem uma unica chamada a modelo;
--   2. `propria` deixa de ser igualdade de texto entre `concursos.orgao/cargo` e
--      `provas.orgao/cargo` e passa a ser `provas_proprias_do_concurso()`, que
--      responde pelo vinculo humano de `concurso_provas` e so cai no texto
--      quando aquele concurso ainda nao tem vinculo nenhum.
--
-- **A conta nao muda.** peso_oficial(materia) x share(assunto|materia), o
-- amortecimento dentro da materia, a media ponderada pelo decaimento por prova,
-- o porteiro do edital, os quatro degraus e o lock continuam identicos.
-- Trocaram-se a fonte dos itens e a fonte da resposta "esta prova e deste
-- concurso" — nao a formula.
--
-- `v_cargo` sumiu porque nao ha mais comparacao de cargo aqui. O sentinela
-- `cargo='indefinido'` da SPEC 37 continua tratado, agora uma camada abaixo, em
-- `provas_proprias_do_concurso`.

create or replace function public.recalcula_raiox(p_referencia date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referencia       date := coalesce(p_referencia, current_date);
  v_ano_referencia   integer;
  v_meia_vida        numeric;
  v_amortecimento_k  numeric;
  v_piso_amostra     integer;
  v_periodo_recente  integer;
  v_periodo_anterior integer;
  v_bancas           jsonb;
  v_piso_cobertura   numeric;
  v_peso_degrau_3    numeric;
  v_perfil           record;
  v_lista_bancas     jsonb;
  v_orgao            text;
  v_concurso         uuid;
  v_tem_propria      boolean;
  v_tem_edital       boolean;
  v_resto            numeric;
  v_soma_nao_declarada numeric;
  v_linhas           integer := 0;
  v_inseridas        integer;
begin
  -- Lock proprio do M5, igual ao de antes: a segunda execucao sai sem tocar na
  -- projecao atual em vez de enfileirar.
  if not pg_try_advisory_xact_lock(8406, 3) then
    return -1;
  end if;

  v_ano_referencia := extract(year from v_referencia)::integer;

  -- Configuracao ilegivel nao entra na conta: o default do catalogo mantem o job
  -- executavel (AD-078). Os parametros do AD-056 sao os mesmos de antes; o que
  -- muda e onde eles operam — agora dentro da materia.
  select
    coalesce((
      select (valor #>> '{}')::numeric from public.configuracoes_vigentes
       where chave = 'param.m5.meia_vida_decaimento_anos'
         and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
         and (valor #>> '{}')::numeric > 0), 5),
    coalesce((
      select (valor #>> '{}')::numeric from public.configuracoes_vigentes
       where chave = 'param.m5.amortecimento_k'
         and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
         and (valor #>> '{}')::numeric > 0), 10),
    coalesce((
      select (valor #>> '{}')::integer from public.configuracoes_vigentes
       where chave = 'param.m5.piso_amostra_baixa'
         and (valor #>> '{}') ~ '^[1-9][0-9]*$'), 10),
    coalesce((
      select (valor #>> '{}')::integer from public.configuracoes_vigentes
       where chave = 'param.m5.periodo_tendencia_recente_anos'
         and (valor #>> '{}') ~ '^[1-9][0-9]*$'), 3),
    coalesce((
      select (valor #>> '{}')::integer from public.configuracoes_vigentes
       where chave = 'param.m5.periodo_tendencia_anterior_anos'
         and (valor #>> '{}') ~ '^[1-9][0-9]*$'), 3),
    coalesce((
      select valor from public.configuracoes_vigentes
       where chave = 'param.m5.bancas'
         and jsonb_typeof(valor) = 'array'
         and jsonb_array_length(valor) > 0), '["Cesgranrio", "FGV", "Cebraspe"]'::jsonb),
    coalesce((
      select (valor #>> '{}')::numeric from public.configuracoes_vigentes
       where chave = 'param.m1.cobertura_minima'
         and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
         and (valor #>> '{}')::numeric between 0 and 1), 0.9),
    coalesce((
      select (valor #>> '{}')::numeric from public.configuracoes_vigentes
       where chave = 'param.m5.peso_degrau_3'
         and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
         and (valor #>> '{}')::numeric > 0
         and (valor #>> '{}')::numeric <= 1), 0.5)
    into v_meia_vida, v_amortecimento_k, v_piso_amostra,
         v_periodo_recente, v_periodo_anterior, v_bancas,
         v_piso_cobertura, v_peso_degrau_3;

  -- Tabelas de trabalho. Uma por etapa da conta, para que cada etapa seja
  -- legivel e conferivel isoladamente. `on commit drop` porque a funcao roda
  -- inteira dentro de uma transacao.
  create temporary table if not exists pg_temp.tmp39_programa (
    topico_id uuid, materia_id uuid
  ) on commit drop;
  create temporary table if not exists pg_temp.tmp39_provas (
    prova_id uuid, ano smallint, peso_ano numeric, propria boolean
  ) on commit drop;
  -- Quem responde "esta prova e deste concurso" agora e uma tabela, e nao uma
  -- comparacao de texto no meio do SELECT (AD-146).
  create temporary table if not exists pg_temp.tmp39_propria (
    prova_id uuid primary key
  ) on commit drop;
  create temporary table if not exists pg_temp.tmp39_peso_prova (
    prova_id uuid, materia_id uuid, ano smallint, peso_ano numeric,
    propria boolean, peso_rel numeric, tem_pontos boolean
  ) on commit drop;
  create temporary table if not exists pg_temp.tmp39_item (
    prova_id uuid, materia_id uuid, topico_id uuid
  ) on commit drop;
  create temporary table if not exists pg_temp.tmp39_share_prova (
    materia_id uuid, prova_id uuid, topico_id uuid, ano smallint,
    peso_ano numeric, n_itens integer, share numeric
  ) on commit drop;
  create temporary table if not exists pg_temp.tmp39_materia (
    materia_id uuid, a_m integer, peso_oficial numeric, base_do_peso text,
    fonte text, n_m integer, n_provas integer, anos smallint[], degrau smallint,
    -- O peso que as provas proprias sustentam, guardado a parte: quando o
    -- edital existe ele so vale para as materias que o edital NAO nomeia.
    peso_prova numeric, base_prova text
  ) on commit drop;
  create temporary table if not exists pg_temp.tmp39_share (
    materia_id uuid, topico_id uuid, share_bruto numeric, n_itens integer
  ) on commit drop;

  for v_perfil in
    select p.id, p.banca, p.programa_edital, p.orgao,
           c.id as concurso_id, c.orgao as concurso_orgao, c.cargo as concurso_cargo
      from public.perfil_concurso p
      left join public.concursos c on c.perfil_concurso_id = p.id
     order by p.id
  loop
    truncate pg_temp.tmp39_programa, pg_temp.tmp39_provas, pg_temp.tmp39_peso_prova,
             pg_temp.tmp39_item, pg_temp.tmp39_share_prova, pg_temp.tmp39_materia,
             pg_temp.tmp39_share, pg_temp.tmp39_propria;

    v_concurso := v_perfil.concurso_id;
    -- Sem linha em `concursos` (perfil legado), o orgao vem do proprio perfil e
    -- o cargo nao filtra: e o comportamento mais generoso possivel, e nunca
    -- transforma prova de outro orgao em prova propria.
    v_orgao := coalesce(v_perfil.concurso_orgao, v_perfil.orgao);
    v_lista_bancas := case
      when v_perfil.banca = 'indefinida' then v_bancas
      else jsonb_build_array(v_perfil.banca)
    end;

    -- ── Quais provas sao proprias (AD-146) ─────────────────────────────────
    --
    -- Antes isto era `pm.orgao = v_orgao and pm.cargo = v_cargo` dentro do
    -- SELECT, e nao funcionava no banco real: o concurso do BB e
    -- "Banco do Brasil — Escriturario, Agente Comercial" e as provas dele sao
    -- orgao "Banco do Brasil" + cargo "Escriturario - Agente Comercial". A
    -- resposta passa a vir de `concurso_provas`, que e decisao humana com autor
    -- e motivo, e sobrevive a qualquer mudanca de grafia.
    --
    -- Perfil sem linha em `concursos` (legado da SPEC 37) nao tem a quem
    -- perguntar vinculo: para ele so resta o caminho textual de antes, com o
    -- orgao do proprio perfil e sem filtro de cargo.
    if v_concurso is not null then
      insert into pg_temp.tmp39_propria (prova_id)
      select distinct pp.prova_id from public.provas_proprias_do_concurso(v_concurso) pp;
    else
      insert into pg_temp.tmp39_propria (prova_id)
      select p.id from public.provas p where p.orgao = v_orgao;
    end if;

    -- ── O porteiro do edital, antes de tudo (RAIOX-16 AC5) ─────────────────
    --
    -- O programa nao e um filtro na saida: e a definicao do conjunto. Assunto
    -- fora dele nao entra no numerador nem no denominador do share, e nao conta
    -- em `A_m`. Zero antes de qualquer multiplicacao.
    insert into pg_temp.tmp39_programa (topico_id, materia_id)
    select distinct t.id, t.materia_id
      from jsonb_array_elements_text(v_perfil.programa_edital) as itens(valor)
      join public.topicos t
        on t.id = itens.valor::uuid
       and t.ativo
     where itens.valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

    -- ── Provas fonte (RAIOX-17 AC2/AC3) ────────────────────────────────────
    --
    -- `provas_medidas` ja entrega grade lida, sem conferencia pendente e UM
    -- caderno por (banca, ano, orgao, cargo) — o caderno irmao entra uma vez so
    -- sem nenhuma regra nova aqui. O piso de cobertura e a porta que falta: a
    -- prova ingerida pela metade nao entra, e aparece em
    -- `provas_pendentes_de_ingestao`.
    insert into pg_temp.tmp39_provas (prova_id, ano, peso_ano, propria)
    select
      pm.prova_id,
      pm.ano,
      power(0.5::numeric,
            greatest(v_ano_referencia - pm.ano::integer, 0)::numeric / v_meia_vida),
      (pr.prova_id is not null)
      from public.provas_medidas pm
      left join pg_temp.tmp39_propria pr on pr.prova_id = pm.prova_id
     where pm.cobertura is not null
       and pm.cobertura >= v_piso_cobertura
       and (
         pr.prova_id is not null
         or exists (
           select 1 from jsonb_array_elements_text(v_lista_bancas) as lista(banca)
            where btrim(lista.banca) = pm.banca
         )
       );

    v_tem_propria := exists (select 1 from pg_temp.tmp39_provas where propria);

    -- ── Nivel 1, por prova: a fatia de cada materia dentro daquela prova ────
    --
    -- O denominador e a prova inteira, blocos sem materia resolvida inclusive.
    -- E o que faz duas provas do mesmo ano pesarem igual mesmo com 40 e 15
    -- itens: cada uma entrega uma distribuicao que soma 1, e nao uma contagem.
    insert into pg_temp.tmp39_peso_prova
      (prova_id, materia_id, ano, peso_ano, propria, peso_rel, tem_pontos)
    select
      b.prova_id,
      b.materia_id,
      tp.ano,
      tp.peso_ano,
      tp.propria,
      sum(b.peso) / nullif(total.peso, 0),
      bool_or(b.base = 'pontos')
      from public.prova_bloco_materia b
      join pg_temp.tmp39_provas tp on tp.prova_id = b.prova_id
      join lateral (
        select sum(x.peso) as peso
          from public.prova_bloco_materia x
         where x.prova_id = b.prova_id
      ) total on true
     where b.materia_id is not null
     group by b.prova_id, b.materia_id, tp.ano, tp.peso_ano, tp.propria, total.peso;

    -- ── Nivel 2, materia-prima: os itens etiquetados elegiveis ─────────────
    --
    -- A materia do ITEM e a do assunto canonico dele, nao a do bloco em que ele
    -- caiu. Os dois niveis usam a fonte propria de cada um: o peso vem da grade
    -- declarada, a distribuicao vem da etiqueta. Item etiquetado com assunto de
    -- outra materia conta na materia do assunto, que e o que ele de fato e.
    insert into pg_temp.tmp39_item (prova_id, materia_id, topico_id)
    select i.prova_id, pg.materia_id, i.topico_id
      from public.itens_medidos_efetivos i
      join pg_temp.tmp39_provas tp on tp.prova_id = i.prova_id
      join pg_temp.tmp39_programa pg on pg.topico_id = i.topico_id;

    -- ── As materias do edital, e quanta evidencia cada uma tem ─────────────
    insert into pg_temp.tmp39_materia
      (materia_id, a_m, peso_oficial, base_do_peso, fonte, n_m, n_provas, anos, degrau,
       peso_prova, base_prova)
    select materia_id, count(*)::integer, 0, 'sem_dado', 'nenhuma', 0, 0,
           '{}'::smallint[], 4, null, null
      from pg_temp.tmp39_programa
     group by materia_id;

    -- ── Nivel 1 agregado: quem manda quando os dois documentos falam ──────
    --
    -- **O edital manda na materia que ele nomeia.** Ele fala do concurso que
    -- vem; a prova fala do que passou. Quando os dois discordam — a grade de
    -- 2025 diz que Portugues era 100% da prova e o edital de agora diz 50% — o
    -- numero que vale e o do edital.
    --
    -- As materias que o edital **nao** nomeia dividem o que sobra
    -- (1 menos o declarado que virou linha), na proporcao da grade. E o que
    -- impede duas coisas ao mesmo tempo: um edital que nomeia so parte das
    -- materias apagar as outras, e uma materia que o edital deixou de cobrar
    -- continuar pesando so porque a prova velha a cobrava.
    --
    -- Sem edital, nada muda: o peso e o da grade, e a soma fica abaixo de 1
    -- quando algum bloco nao resolveu materia (design §3.1).
    if v_tem_propria then
      update pg_temp.tmp39_materia m
         set peso_prova = s.peso,
             base_prova = s.base
        from (
          select
            pp.materia_id,
            sum(pp.peso_ano * pp.peso_rel)
              / nullif((select sum(tp.peso_ano)
                          from pg_temp.tmp39_provas tp
                         where tp.propria
                           and exists (select 1 from pg_temp.tmp39_peso_prova z
                                        where z.prova_id = tp.prova_id)), 0) as peso,
            case when bool_or(pp.tem_pontos) then 'pontos' else 'itens' end as base
            from pg_temp.tmp39_peso_prova pp
           where pp.propria
           group by pp.materia_id
        ) s
       where s.materia_id = m.materia_id
         and s.peso is not null;
    end if;

    v_tem_edital := v_concurso is not null and exists (
      select 1 from public.concurso_peso_materia cpm
       where cpm.concurso_id = v_concurso
    );

    if v_tem_edital then
      update pg_temp.tmp39_materia m
         set peso_oficial = s.peso,
             base_do_peso = 'edital'
        from (
          select cpm.materia_id,
                 cpm.peso_declarado / sum(cpm.peso_declarado) over () as peso
            from public.concurso_peso_materia cpm
           where cpm.concurso_id = v_concurso
        ) s
       where s.materia_id = m.materia_id;

      -- A sobra so e maior que zero quando o edital declara materia que nao
      -- virou linha — tipicamente porque nenhum assunto dela esta no programa
      -- vigente. Essa fatia volta para quem a grade mediu.
      select greatest(1 - coalesce(sum(peso_oficial), 0), 0)
        into v_resto
        from pg_temp.tmp39_materia
       where base_do_peso = 'edital';

      select coalesce(sum(peso_prova), 0)
        into v_soma_nao_declarada
        from pg_temp.tmp39_materia
       where base_do_peso <> 'edital' and peso_prova > 0;

      if v_resto > 0 and v_soma_nao_declarada > 0 then
        update pg_temp.tmp39_materia
           set peso_oficial = peso_prova * v_resto / v_soma_nao_declarada,
               base_do_peso = base_prova
         where base_do_peso <> 'edital' and peso_prova > 0;
      end if;
    else
      update pg_temp.tmp39_materia
         set peso_oficial = peso_prova,
             base_do_peso = base_prova
       where peso_prova is not null;
    end if;

    -- Fonte da distribuicao: propria primeiro; so na ausencia dela a prova da
    -- mesma banca em outro orgao (degrau 3). As duas nunca se misturam — o
    -- degrau 3 e um emprestimo, nao um complemento.
    update pg_temp.tmp39_materia m
       set fonte = 'propria', n_m = s.n, n_provas = s.np, anos = s.anos
      from (
        select i.materia_id,
               count(*)::integer as n,
               count(distinct i.prova_id)::integer as np,
               array_agg(distinct tp.ano order by tp.ano) as anos
          from pg_temp.tmp39_item i
          join pg_temp.tmp39_provas tp on tp.prova_id = i.prova_id and tp.propria
         group by i.materia_id
      ) s
     where s.materia_id = m.materia_id;

    update pg_temp.tmp39_materia m
       set fonte = 'vizinha', n_m = s.n, n_provas = s.np, anos = s.anos
      from (
        select i.materia_id,
               count(*)::integer as n,
               count(distinct i.prova_id)::integer as np,
               array_agg(distinct tp.ano order by tp.ano) as anos
          from pg_temp.tmp39_item i
          join pg_temp.tmp39_provas tp on tp.prova_id = i.prova_id and not tp.propria
         group by i.materia_id
      ) s
     where s.materia_id = m.materia_id
       and m.fonte = 'nenhuma';

    -- ── Degraus de lastro (RAIOX-18 AC1/AC2) ───────────────────────────────
    --
    -- A regra e o elo mais fraco. O degrau 3 transfere **so o desenho de dentro
    -- da materia**; o peso da materia continua vindo do documento do proprio
    -- concurso e, sem documento proprio, a linha cai para 4 — nunca se importa
    -- peso de outro orgao.
    update pg_temp.tmp39_materia
       set degrau = case
             when peso_oficial is null or peso_oficial <= 0 then 4
             when fonte = 'propria' then 1
             when fonte = 'vizinha' then 3
             else 2
           end;

    -- Linha sem peso nao tem lastro para exibir: o degrau 4 e "sem dado", e
    -- citar provas nele seria dizer que ha evidencia onde nao ha.
    update pg_temp.tmp39_materia
       set n_provas = 0, anos = '{}'::smallint[], base_do_peso = 'sem_dado'
     where degrau = 4;

    -- Degrau 2 sustentado pela GRADE de uma prova: o lastro dele sao as provas
    -- que declararam a materia, e nao as que deram item — a matéria nao tem
    -- item nenhum, e por isso o degrau e 2. Sem esta linha, a tela dizia "peso
    -- declarado pela grade da prova" sem citar prova nem ano.
    update pg_temp.tmp39_materia m
       set n_provas = s.np, anos = s.anos
      from (
        select pp.materia_id,
               count(distinct pp.prova_id)::integer as np,
               array_agg(distinct pp.ano order by pp.ano) as anos
          from pg_temp.tmp39_peso_prova pp
         where pp.propria and pp.peso_rel > 0
         group by pp.materia_id
      ) s
     where s.materia_id = m.materia_id
       and m.degrau = 2
       and m.base_do_peso in ('pontos', 'itens');

    -- ── Nivel 2, por prova e agregado (RAIOX-17 AC1) ───────────────────────
    --
    -- Cada prova entrega a distribuicao dela, que soma 1 dentro da materia. A
    -- combinacao e a media ponderada pelo decaimento — **nunca** um denominador
    -- unico somando itens de provas diferentes.
    insert into pg_temp.tmp39_share_prova
      (materia_id, prova_id, topico_id, ano, peso_ano, n_itens, share)
    select
      p.materia_id, p.prova_id, p.topico_id, p.ano, p.peso_ano, p.n::integer,
      -- O denominador e a propria prova, dentro daquela materia. E aqui que o
      -- "censo por prova" vira numero: nenhum item de outra prova aparece.
      p.n / sum(p.n) over (partition by p.materia_id, p.prova_id)
      from (
        select i.materia_id, i.prova_id, i.topico_id, tp.ano, tp.peso_ano,
               count(*)::numeric as n
          from pg_temp.tmp39_item i
          join pg_temp.tmp39_provas tp on tp.prova_id = i.prova_id
          join pg_temp.tmp39_materia m on m.materia_id = i.materia_id
         where (m.fonte = 'propria' and tp.propria)
            or (m.fonte = 'vizinha' and not tp.propria)
         group by i.materia_id, i.prova_id, i.topico_id, tp.ano, tp.peso_ano
      ) p;

    -- A combinacao entre provas: media das taxas por prova ponderada pelo
    -- decaimento por ano (AD-056). O denominador e a soma dos pesos de ano das
    -- provas que mediram AQUELA materia — nao a soma de itens.
    insert into pg_temp.tmp39_share (materia_id, topico_id, share_bruto, n_itens)
    select
      sp.materia_id,
      sp.topico_id,
      sum(sp.peso_ano * sp.share) / nullif(w.total, 0),
      sum(sp.n_itens)::integer
      from pg_temp.tmp39_share_prova sp
      join lateral (
        select sum(x.peso_ano) as total
          from (select distinct prova_id, peso_ano
                  from pg_temp.tmp39_share_prova
                 where materia_id = sp.materia_id) x
      ) w on true
     group by sp.materia_id, sp.topico_id, w.total;

    -- ── Escrita: por assunto ───────────────────────────────────────────────
    delete from public.raiox_projecoes where perfil_concurso_id = v_perfil.id;

    insert into public.raiox_projecoes
      (perfil_concurso_id, topico_id, taxa_bruta, peso, n_questoes,
       tendencia, amostra_baixa, atualizado_em,
       degrau, n_provas, anos, base_do_peso)
    with amortizado as (
      select
        pg.topico_id,
        m.materia_id,
        m.peso_oficial,
        m.degrau,
        m.n_provas,
        m.anos,
        m.base_do_peso,
        m.n_m,
        coalesce(s.share_bruto, 0) as share_bruto,
        coalesce(s.n_itens, 0)     as n_itens,
        -- O amortecimento do AD-056, agora dentro da materia: a ancora e a
        -- media DAQUELA materia (1 / A_m), nunca a media geral. Trocar uma pela
        -- outra e a mutacao que o sensor da validacao persegue.
        (
          (case when m.fonte = 'vizinha' then m.n_m * v_peso_degrau_3
                else m.n_m::numeric end) * coalesce(s.share_bruto, 0)
          + v_amortecimento_k * (1::numeric / m.a_m)
        ) / nullif(
          (case when m.fonte = 'vizinha' then m.n_m * v_peso_degrau_3
                else m.n_m::numeric end) + v_amortecimento_k, 0
        ) as share
        from pg_temp.tmp39_programa pg
        join pg_temp.tmp39_materia m on m.materia_id = pg.materia_id
        left join pg_temp.tmp39_share s
          on s.materia_id = pg.materia_id and s.topico_id = pg.topico_id
    ), normalizado as (
      -- `share_bruto` ja soma 1 dentro da materia e A_m x (1/A_m) tambem: a
      -- normalizacao existe para absorver arredondamento, nao para corrigir a
      -- conta (RAIOX-16 AC3).
      select a.*,
             a.share / nullif(sum(a.share) over (partition by a.materia_id), 0) as share_norm
        from amortizado a
    ), tendencias as (
      select
        sp.materia_id,
        sp.topico_id,
        sum(sp.share) filter (
          where sp.ano between v_ano_referencia - v_periodo_recente + 1
                           and v_ano_referencia) as soma_recente,
        sum(sp.share) filter (
          where sp.ano between v_ano_referencia - v_periodo_recente
                             - v_periodo_anterior + 1
                           and v_ano_referencia - v_periodo_recente) as soma_anterior
        from pg_temp.tmp39_share_prova sp
       group by sp.materia_id, sp.topico_id
    ), janelas as (
      select
        materia_id,
        count(distinct prova_id) filter (
          where ano between v_ano_referencia - v_periodo_recente + 1
                        and v_ano_referencia)::numeric as n_recente,
        count(distinct prova_id) filter (
          where ano between v_ano_referencia - v_periodo_recente
                          - v_periodo_anterior + 1
                        and v_ano_referencia - v_periodo_recente)::numeric as n_anterior
        from pg_temp.tmp39_share_prova
       group by materia_id
    )
    select
      v_perfil.id,
      n.topico_id,
      round(least(n.peso_oficial * n.share_bruto, 1::numeric), 8),
      round(least(coalesce(n.peso_oficial * n.share_norm, 0), 1::numeric), 8),
      n.n_itens,
      case
        when j.n_recente is null or j.n_anterior is null
          or j.n_recente = 0 or j.n_anterior = 0
          then 'estavel'::public.raiox_tendencia
        when coalesce(t.soma_recente, 0) / j.n_recente
           > coalesce(t.soma_anterior, 0) / j.n_anterior
          then 'subindo'::public.raiox_tendencia
        when coalesce(t.soma_recente, 0) / j.n_recente
           < coalesce(t.soma_anterior, 0) / j.n_anterior
          then 'caindo'::public.raiox_tendencia
        else 'estavel'::public.raiox_tendencia
      end,
      -- Pouca amostra e sobre a materia: e `n_m` que governa a distribuicao
      -- interna. Degrau 2, 3 ou 4 e pouca amostra por definicao — a linha nao
      -- se apoia em prova do proprio concurso.
      (n.n_m < v_piso_amostra or n.degrau >= 2),
      now(),
      n.degrau,
      n.n_provas,
      n.anos,
      n.base_do_peso
      from normalizado n
      left join tendencias t
        on t.materia_id = n.materia_id and t.topico_id = n.topico_id
      left join janelas j on j.materia_id = n.materia_id;

    get diagnostics v_inseridas = row_count;
    v_linhas := v_linhas + v_inseridas;

    -- ── Escrita: por materia ───────────────────────────────────────────────
    --
    -- Continua sendo projecao propria, e nao a soma das linhas de assunto — mas
    -- agora pelo motivo mais forte de todos: o peso da materia e o numero
    -- **oficial**, e somar estimativas por baixo para chega-lo seria trocar um
    -- dado do documento por uma conta nossa.
    delete from public.raiox_projecoes_materia where perfil_concurso_id = v_perfil.id;

    insert into public.raiox_projecoes_materia
      (perfil_concurso_id, materia_id, taxa_bruta, peso, n_questoes,
       n_topicos, tendencia, amostra_baixa, atualizado_em,
       degrau, n_provas, anos, base_do_peso)
    with tendencias as (
      select
        pp.materia_id,
        sum(pp.peso_rel) filter (
          where pp.ano between v_ano_referencia - v_periodo_recente + 1
                           and v_ano_referencia) as soma_recente,
        sum(pp.peso_rel) filter (
          where pp.ano between v_ano_referencia - v_periodo_recente
                             - v_periodo_anterior + 1
                           and v_ano_referencia - v_periodo_recente) as soma_anterior
        from pg_temp.tmp39_peso_prova pp
       where pp.propria
       group by pp.materia_id
    ), janelas as (
      select
        count(distinct prova_id) filter (
          where ano between v_ano_referencia - v_periodo_recente + 1
                        and v_ano_referencia)::numeric as n_recente,
        count(distinct prova_id) filter (
          where ano between v_ano_referencia - v_periodo_recente
                          - v_periodo_anterior + 1
                        and v_ano_referencia - v_periodo_recente)::numeric as n_anterior
        from pg_temp.tmp39_provas
       where propria
    )
    select
      v_perfil.id,
      m.materia_id,
      round(least(coalesce(m.peso_oficial, 0), 1::numeric), 8),
      round(least(coalesce(m.peso_oficial, 0), 1::numeric), 8),
      m.n_m,
      m.a_m,
      case
        when j.n_recente = 0 or j.n_anterior = 0
          then 'estavel'::public.raiox_tendencia
        when coalesce(t.soma_recente, 0) / j.n_recente
           > coalesce(t.soma_anterior, 0) / j.n_anterior
          then 'subindo'::public.raiox_tendencia
        when coalesce(t.soma_recente, 0) / j.n_recente
           < coalesce(t.soma_anterior, 0) / j.n_anterior
          then 'caindo'::public.raiox_tendencia
        else 'estavel'::public.raiox_tendencia
      end,
      (m.n_m < v_piso_amostra or m.degrau >= 2),
      now(),
      m.degrau,
      m.n_provas,
      m.anos,
      m.base_do_peso
      from pg_temp.tmp39_materia m
      left join tendencias t on t.materia_id = m.materia_id
      cross join janelas j;

  end loop;

  return v_linhas;
end;
$$;
comment on function public.recalcula_raiox(date) is
  'Reconstroi a projecao do Raio-X em dois niveis (AD-138): peso_oficial(materia) da grade declarada ou do edital, vezes share(assunto|materia) estimado dos ITENS MEDIDOS EFETIVOS — questao publicada, etiqueta humana ou etiqueta de IA, uma vez por item (AD-146). Prova propria e a que tem vinculo em concurso_provas; a igualdade textual de orgao/cargo so responde enquanto o concurso nao tiver nenhum vinculo. Nao le tentativas. Devolve as linhas gravadas no grao de assunto, ou -1 quando outra execucao detem o lock.';

revoke all on function public.recalcula_raiox(date) from public, anon, authenticated;
