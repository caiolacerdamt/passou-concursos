-- RAIOX-01 · RAIOX-04 · RAIOX-05 · RAIOX-11 · RAIOX-12 · RAIOX-14
--
-- A tela do Raio-X passa a abrir pela matéria e só revela tópico sob demanda.
-- A leitura por matéria é uma **projeção própria**, não a soma das linhas de
-- tópico: cada linha de tópico já foi amortecida contra a média, então somá-las
-- acumularia o viés da média uma vez por tópico e uma matéria com muitos
-- tópicos vazios ficaria artificialmente pesada.
--
-- A fórmula é a mesma do tópico — participação por peso de ano, amortecimento
-- por amostra e duas janelas de tendência —, só muda o agrupamento. Com o `n`
-- da matéria inteira o amortecimento praticamente desaparece, que é o
-- comportamento correto: uma matéria com 297 questões reais não precisa ser
-- puxada para a média.
--
-- A view `raiox_peso_topico` NÃO muda: o motor do plano (M4) continua
-- raciocinando por tópico. Esta tabela é leitura de tela, não fronteira de
-- motor.

create table public.raiox_projecoes_materia (
  perfil_concurso_id uuid not null references public.perfil_concurso(id) on delete cascade,
  materia_id         uuid not null references public.materias(id),
  taxa_bruta         numeric(12, 8) not null
                       check (taxa_bruta >= 0 and taxa_bruta <= 1),
  peso               numeric(12, 8) not null
                       check (peso >= 0 and peso <= 1),
  n_questoes         integer not null check (n_questoes >= 0),
  n_topicos          integer not null check (n_topicos >= 0),
  tendencia          public.raiox_tendencia not null,
  amostra_baixa      boolean not null,
  atualizado_em      timestamptz not null default now(),

  primary key (perfil_concurso_id, materia_id)
);

comment on table public.raiox_projecoes_materia is
  'Projeção do Raio-X agregada por matéria (RAIOX-14). Mesma fórmula de `raiox_projecoes`, agrupada por `materia_id` — nunca a soma das linhas de tópico. Não lê `tentativas`.';

comment on column public.raiox_projecoes_materia.n_topicos is
  'Tópicos da matéria dentro do programa do edital ativo. É o denominador da cobertura na tela.';

create index raiox_projecoes_materia_ordenacao_idx
  on public.raiox_projecoes_materia (perfil_concurso_id, peso desc, materia_id);

-- Mesma regra da projeção por tópico: o navegador não lê a projeção bruta.
revoke all on public.raiox_projecoes_materia from anon, authenticated;
alter table public.raiox_projecoes_materia enable row level security;

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

    -- ================================================ agregado por matéria ==
    --
    -- Mesmo bloco, agrupado por `materia_id`. O denominador (`peso_total`) é o
    -- mesmo do tópico, então as duas leituras falam da mesma prova. A matéria
    -- entra pelo programa do edital: quem manda é o conjunto de tópicos
    -- vigentes, não a tabela `materias` inteira — matéria de demonstração ou
    -- sem tópico no programa não aparece na tela.
    delete from public.raiox_projecoes_materia
     where perfil_concurso_id = v_perfil.id;

    insert into public.raiox_projecoes_materia
      (perfil_concurso_id, materia_id, taxa_bruta, peso, n_questoes,
       n_topicos, tendencia, amostra_baixa, atualizado_em)
    with bancas as (
      select btrim(valor) as banca
        from jsonb_array_elements_text(
          case
            when v_perfil.banca = 'indefinida' then v_bancas
            else jsonb_build_array(v_perfil.banca)
          end
        ) as lista(valor)
       where length(btrim(valor)) > 0
    ), programa as (
      select distinct valor::uuid as topico_id
        from jsonb_array_elements_text(v_perfil.programa_edital) as itens(valor)
       where valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ), materias_do_programa as (
      select tp.materia_id, count(*)::integer as n_topicos
        from programa p
        join public.topicos tp on tp.id = p.topico_id
       group by tp.materia_id
    ), base as (
      select
        tp.materia_id,
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
        join public.topicos tp on tp.id = q.topico_id
       where q.origem = 'real'
         and q.status = 'publicada'
         and q.vigente
    ), totais as (
      -- O total continua sendo o da prova inteira, e não o das matérias do
      -- programa: trocar o denominador aqui faria a mesma questão valer duas
      -- porcentagens diferentes conforme a tela que a lê.
      select
        coalesce(sum(peso_ano), 0)::numeric as peso_total,
        count(*) filter (where na_janela_recente = 1)::numeric as n_recente,
        count(*) filter (where na_janela_anterior = 1)::numeric as n_anterior
        from base
    ), estatisticas as (
      select
        materia_id,
        count(*)::integer as n_questoes,
        sum(peso_ano)::numeric as peso_materia,
        count(*) filter (where na_janela_recente = 1)::numeric as n_recente,
        count(*) filter (where na_janela_anterior = 1)::numeric as n_anterior
        from base
       group by materia_id
    ), taxas as (
      select
        e.materia_id,
        e.n_questoes,
        e.peso_materia / nullif(t.peso_total, 0) as taxa,
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
    ), linhas as (
      select
        mp.materia_id,
        mp.n_topicos,
        coalesce(t.taxa, 0::numeric) as taxa_bruta,
        coalesce(t.n_questoes, 0)::integer as n_questoes,
        coalesce(t.tendencia, 'estavel'::public.raiox_tendencia) as tendencia,
        m.taxa_media
        from materias_do_programa mp
        cross join media m
        left join taxas t on t.materia_id = mp.materia_id
    )
    select
      v_perfil.id,
      l.materia_id,
      round(l.taxa_bruta, 8),
      round(
        least(
          case
            when l.n_questoes = 0 then l.taxa_media
            else (
              l.n_questoes::numeric / (l.n_questoes + v_amortecimento_k)
                * l.taxa_bruta
              + v_amortecimento_k / (l.n_questoes + v_amortecimento_k)
                * l.taxa_media
            )
          end,
          1::numeric
        ),
        8
      ),
      l.n_questoes,
      l.n_topicos,
      l.tendencia,
      l.n_questoes < v_piso_amostra,
      now()
      from linhas l;

    -- O retorno continua contando **só o grão de tópico**. Somar a matéria
    -- aqui mudaria o significado de um número que já é contrato de quem chama
    -- a função, em troca de nenhuma informação nova: os dois grãos são
    -- escritos na mesma transação, então um não existe sem o outro.
  end loop;

  return v_linhas;
end;
$$;

comment on function public.recalcula_raiox(date) is
  'Reconstrói a projeção do Raio-X a partir de questões reais, publicadas e vigentes, em dois grãos: por tópico (`raiox_projecoes`) e por matéria (`raiox_projecoes_materia`), na mesma transação. Usa participação por peso de ano, amortecimento e duas janelas de tendência; não lê tentativas. Devolve as linhas gravadas **no grão de tópico** ou -1 quando outra execução detém o lock.';

revoke all on function public.recalcula_raiox(date) from public, anon, authenticated;
