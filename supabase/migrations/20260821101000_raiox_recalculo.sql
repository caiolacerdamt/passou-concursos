-- RAIOX-01 · RAIOX-04 · RAIOX-05 · RAIOX-11 · RAIOX-12 · RAIOX-14
--
-- A projeção nasce somente do acervo publicado. `tentativas` não aparece aqui:
-- o Raio-X mede a banca, não o comportamento de um aluno.

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
  v_perfil           record;
  v_linhas           integer := 0;
  v_inseridas        integer;
begin
  -- Lock próprio do M5. A versão transacional não enfileira uma segunda
  -- execução: ela sai sem tocar na projeção atual.
  if not pg_try_advisory_xact_lock(8406, 3) then
    return -1;
  end if;

  v_ano_referencia := extract(year from v_referencia)::integer;

  -- A linha de configuração ilegível não entra na conta: o default do catálogo
  -- mantém o job executável. Valores positivos são os únicos aceitos para os
  -- parâmetros que controlam denominadores e janelas.
  select
    coalesce((
      select (valor #>> '{}')::numeric
        from public.configuracoes_vigentes
       where chave = 'param.m5.meia_vida_decaimento_anos'
         and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
         and (valor #>> '{}')::numeric > 0
    ), 5),
    coalesce((
      select (valor #>> '{}')::numeric
        from public.configuracoes_vigentes
       where chave = 'param.m5.amortecimento_k'
         and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
         and (valor #>> '{}')::numeric > 0
    ), 10),
    coalesce((
      select (valor #>> '{}')::integer
        from public.configuracoes_vigentes
       where chave = 'param.m5.piso_amostra_baixa'
         and (valor #>> '{}') ~ '^[1-9][0-9]*$'
    ), 10),
    coalesce((
      select (valor #>> '{}')::integer
        from public.configuracoes_vigentes
       where chave = 'param.m5.periodo_tendencia_recente_anos'
         and (valor #>> '{}') ~ '^[1-9][0-9]*$'
    ), 3),
    coalesce((
      select (valor #>> '{}')::integer
        from public.configuracoes_vigentes
       where chave = 'param.m5.periodo_tendencia_anterior_anos'
         and (valor #>> '{}') ~ '^[1-9][0-9]*$'
    ), 3),
    coalesce((
      select valor
        from public.configuracoes_vigentes
       where chave = 'param.m5.bancas'
         and jsonb_typeof(valor) = 'array'
         and jsonb_array_length(valor) > 0
    ), '["Cesgranrio", "FGV", "Cebraspe"]'::jsonb)
    into v_meia_vida, v_amortecimento_k, v_piso_amostra,
         v_periodo_recente, v_periodo_anterior, v_bancas;

  -- Há mais de um perfil no modelo, mas só o ativo alimenta a view do plano.
  -- Recalcular todos deixa a troca de concurso pronta para o próximo recálculo,
  -- sem duplicar questões ou taxonomia.
  for v_perfil in
    select id, banca, programa_edital
      from public.perfil_concurso
     order by id
  loop
    -- DELETE + INSERT dentro da mesma função e transação: rerodar não acumula;
    -- uma falha posterior faz o PostgreSQL desfazer também este DELETE.
    delete from public.raiox_projecoes
     where perfil_concurso_id = v_perfil.id;

    insert into public.raiox_projecoes
      (perfil_concurso_id, topico_id, taxa_bruta, peso, n_questoes,
       tendencia, amostra_baixa, atualizado_em)
    with bancas as (
      select btrim(valor) as banca
        from jsonb_array_elements_text(
          case
            when v_perfil.banca = 'indefinida' then v_bancas
            else jsonb_build_array(v_perfil.banca)
          end
        ) as lista(valor)
       where length(btrim(valor)) > 0
    ), base as (
      select
        q.topico_id,
        pr.ano,
        power(
          0.5::numeric,
          greatest(v_ano_referencia - pr.ano::integer, 0)::numeric / v_meia_vida
        ) as peso_ano,
        case
          when pr.ano between v_ano_referencia - v_periodo_recente + 1
                           and v_ano_referencia then 1
          else 0
        end as na_janela_recente,
        case
          when pr.ano between v_ano_referencia - v_periodo_recente
                           - v_periodo_anterior + 1
                           and v_ano_referencia - v_periodo_recente then 1
          else 0
        end as na_janela_anterior
        from public.questoes q
        join public.provas pr on pr.id = q.prova_id
        join bancas b on b.banca = pr.banca
       where q.origem = 'real'
         and q.status = 'publicada'
         and q.vigente
    ), totais as (
      select
        coalesce(sum(peso_ano), 0)::numeric as peso_total,
        count(*) filter (where na_janela_recente = 1)::numeric as n_recente,
        count(*) filter (where na_janela_anterior = 1)::numeric as n_anterior
        from base
    ), estatisticas as (
      select
        topico_id,
        count(*)::integer as n_questoes,
        sum(peso_ano)::numeric as peso_topico,
        count(*) filter (where na_janela_recente = 1)::numeric as n_recente,
        count(*) filter (where na_janela_anterior = 1)::numeric as n_anterior
        from base
       where topico_id is not null
       group by topico_id
    ), taxas as (
      select
        e.topico_id,
        e.n_questoes,
        e.peso_topico / nullif(t.peso_total, 0) as taxa,
        case
          when t.n_recente = 0 or t.n_anterior = 0 then 'estavel'::public.raiox_tendencia
          when e.n_recente / t.n_recente > e.n_anterior / t.n_anterior
            then 'subindo'::public.raiox_tendencia
          when e.n_recente / t.n_recente < e.n_anterior / t.n_anterior
            then 'caindo'::public.raiox_tendencia
          else 'estavel'::public.raiox_tendencia
        end as tendencia
        from estatisticas e
        cross join totais t
    ), media as (
      select coalesce(avg(taxa), 1.0::numeric) as taxa_media
        from taxas
       where n_questoes > 0
    ), programa as (
      select distinct valor::uuid as topico_id
        from jsonb_array_elements_text(v_perfil.programa_edital) as itens(valor)
       where valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ), linhas as (
      select
        p.topico_id,
        coalesce(t.taxa, 0::numeric) as taxa_bruta,
        coalesce(t.n_questoes, 0)::integer as n_questoes,
        coalesce(t.tendencia, 'estavel'::public.raiox_tendencia) as tendencia,
        m.taxa_media
        from programa p
        cross join media m
        left join taxas t on t.topico_id = p.topico_id
    )
    select
      v_perfil.id,
      l.topico_id,
      round(l.taxa_bruta, 8),
      round(
        case
          when l.n_questoes = 0 then l.taxa_media
          else (
            l.n_questoes::numeric / (l.n_questoes + v_amortecimento_k)
              * l.taxa_bruta
            + v_amortecimento_k / (l.n_questoes + v_amortecimento_k)
              * l.taxa_media
          )
        end,
        8
      ),
      l.n_questoes,
      l.tendencia,
      l.n_questoes < v_piso_amostra,
      now()
      from linhas l;

    get diagnostics v_inseridas = row_count;
    v_linhas := v_linhas + v_inseridas;
  end loop;

  return v_linhas;
end;
$$;

comment on function public.recalcula_raiox(date) is
  'Reconstrói a projeção do Raio-X a partir de questões reais, publicadas e vigentes. Usa participação por peso de ano, amortecimento e duas janelas de tendência; não lê tentativas. Devolve linhas gravadas ou -1 quando outra execução detém o lock.';

revoke all on function public.recalcula_raiox(date) from public, anon, authenticated;
