-- Leitura da gamificação: total vitalício por categoria e progresso das conquistas
--
-- O que esta migração conserta é de LEITURA, não de cálculo. A
-- `materializar_gamificacao` sempre esteve certa: ela grava em
-- `gamificacao_pontos_dia` a discriminação **do dia** (filtro `e.data =
-- v_data`) e em `gamificacao_pontos` o acumulado de sempre. A RPC de leitura
-- devolvia os dois no mesmo objeto — `pontos.total` de sempre e
-- `pontos.discriminacao` só de hoje — sem nomear a janela de nenhum. A tela
-- então mostrava "300 no total" ao lado de quatro zeros, e o aluno lia isso
-- como defeito.
--
-- Duas adições, nenhuma tabela nova e nenhuma escrita nova:
--
--   `pontos.discriminacao_total` — a mesma discriminação, somada sobre TODOS
--   os eventos do titular. Sai de `gamificacao_ponto_evento`, que é a fonte
--   auditável de onde as duas projeções já são reconstruídas.
--
--   `progresso_conquistas` — quanto falta para cada conquista do catálogo. Os
--   quatro números já eram calculados dentro da `materializar_gamificacao`
--   para decidir o desbloqueio; só não saíam, e por isso a tela só sabia
--   dizer "Ainda não".
--
-- GAM-03 · GAM-04 · AD-130

create or replace function public.consultar_gamificacao_do_dia()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id        uuid := auth.uid();
  v_data           date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ligada         boolean;
  v_anel           record;
  v_pontos_dia     record;
  v_pontos_total   record;
  v_missao         record;
  v_sequencia      jsonb;
  v_conquistas     jsonb;
  v_vitalicio      record;
  v_meta_seq       integer;
  v_meta_questoes  integer;
  v_seq_maxima     integer;
  v_n_tentativas   integer;
  v_tem_bloco      boolean;
  v_tem_revisao    boolean;
  v_zerado         jsonb := jsonb_build_object(
    'estudo_prioritario', 0, 'conclusao', 0,
    'revisao_no_prazo', 0, 'recuperacao_erro', 0
  );
begin
  if v_user_id is null then
    return jsonb_build_object(
      'data', v_data,
      'habilitada', false,
      'estado', 'desligada',
      'anel', jsonb_build_object(
        'estudo', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false),
        'questoes', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false),
        'revisao', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false)
      ),
      'pontos', jsonb_build_object(
        'dia', 0, 'total', 0,
        'discriminacao', v_zerado,
        'discriminacao_total', v_zerado
      ),
      'missao', null,
      'sequencia', null,
      'conquistas', '[]'::jsonb,
      'progresso_conquistas', '{}'::jsonb
    );
  end if;

  v_ligada := public.gamificacao_flag_ligada();
  select to_jsonb(s) into v_sequencia
    from public.consultar_sequencia_do_dia() s;

  if not v_ligada then
    return jsonb_build_object(
      'data', v_data,
      'habilitada', false,
      'estado', 'desligada',
      'anel', jsonb_build_object(
        'estudo', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false),
        'questoes', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false),
        'revisao', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false)
      ),
      'pontos', jsonb_build_object(
        'dia', 0, 'total', 0,
        'discriminacao', v_zerado,
        'discriminacao_total', v_zerado
      ),
      'missao', null,
      'sequencia', v_sequencia,
      'conquistas', '[]'::jsonb,
      'progresso_conquistas', '{}'::jsonb
    );
  end if;

  -- A abertura da tela e a excecao autorizada para um aluno e um dia.
  perform public.materializar_gamificacao(v_user_id, v_data);

  select * into v_anel
    from public.gamificacao_dia d
   where d.user_id = v_user_id and d.data = v_data;
  select * into v_pontos_dia
    from public.gamificacao_pontos_dia p
   where p.user_id = v_user_id and p.data = v_data;
  select * into v_pontos_total
    from public.gamificacao_pontos p
   where p.user_id = v_user_id;
  select * into v_missao
    from public.gamificacao_missao_dia m
   where m.user_id = v_user_id and m.data = v_data;

  -- A MESMA discriminação da projeção do dia, sem o filtro de data. Uma
  -- varredura só, dos eventos de um titular.
  select
    coalesce(sum(e.pontos) filter (where e.tipo = 'estudo_prioritario'), 0) as estudo,
    coalesce(sum(e.pontos) filter (where e.tipo = 'conclusao'), 0)          as conclusao,
    coalesce(sum(e.pontos) filter (where e.tipo = 'revisao_no_prazo'), 0)   as revisao,
    coalesce(sum(e.pontos) filter (where e.tipo = 'recuperacao_erro'), 0)   as recuperacao,
    bool_or(e.tipo in ('estudo_prioritario', 'conclusao'))                  as tem_bloco,
    bool_or(e.tipo = 'revisao_no_prazo')                                    as tem_revisao
    into v_vitalicio
    from public.gamificacao_ponto_evento e
   where e.user_id = v_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.conquista,
           'desbloqueada_em', c.desbloqueada_em
         ) order by c.conquista), '[]'::jsonb)
    into v_conquistas
    from public.gamificacao_conquistas c
   where c.user_id = v_user_id;

  if v_anel is null or v_pontos_dia is null or v_pontos_total is null or v_missao is null then
    return jsonb_build_object(
      'data', v_data,
      'habilitada', false,
      'estado', 'erro',
      'codigo_erro', 'projecao_incompleta',
      'sequencia', v_sequencia
    );
  end if;

  -- As mesmas metas que a `materializar_gamificacao` usa para desbloquear.
  v_meta_seq := greatest(public.gamificacao_config_numero('param.m6.meta_conquista_sequencia', 7), 1);
  v_meta_questoes := greatest(public.gamificacao_config_numero('param.m6.meta_conquista_questoes', 100), 1);
  select coalesce(max(s.sequencia), 0) into v_seq_maxima
    from public.sequencia_dia s where s.user_id = v_user_id;
  select count(*) into v_n_tentativas
    from public.tentativas t where t.user_id = v_user_id;
  v_tem_bloco := coalesce(v_vitalicio.tem_bloco, false);
  v_tem_revisao := coalesce(v_vitalicio.tem_revisao, false);

  return jsonb_build_object(
    'data', v_data,
    'habilitada', true,
    'estado', 'ok',
    'anel', jsonb_build_object(
      'estudo', jsonb_build_object(
        'progresso', v_anel.estudo_progresso,
        'meta', v_anel.estudo_meta,
        'bruto', v_anel.estudo_bruto,
        'piso_meta', v_anel.estudo_piso_meta,
        'piso_progresso', v_anel.estudo_piso_progresso,
        'percentual', case when v_anel.estudo_meta = 0 then 0
                           else round(v_anel.estudo_progresso::numeric / v_anel.estudo_meta, 4) end,
        'concluido', v_anel.estudo_meta > 0 and v_anel.estudo_progresso >= v_anel.estudo_meta
      ),
      'questoes', jsonb_build_object(
        'progresso', v_anel.questoes_progresso,
        'meta', v_anel.questoes_meta,
        'bruto', v_anel.questoes_bruto,
        'piso_meta', v_anel.questoes_piso_meta,
        'piso_progresso', v_anel.questoes_piso_progresso,
        'percentual', case when v_anel.questoes_meta = 0 then 0
                           else round(v_anel.questoes_progresso::numeric / v_anel.questoes_meta, 4) end,
        'concluido', v_anel.questoes_meta > 0 and v_anel.questoes_progresso >= v_anel.questoes_meta
      ),
      'revisao', jsonb_build_object(
        'progresso', v_anel.revisao_progresso,
        'meta', v_anel.revisao_meta,
        'bruto', v_anel.revisao_bruto,
        'piso_meta', v_anel.revisao_piso_meta,
        'piso_progresso', v_anel.revisao_piso_progresso,
        'percentual', case when v_anel.revisao_meta = 0 then 0
                           else round(v_anel.revisao_progresso::numeric / v_anel.revisao_meta, 4) end,
        'concluido', v_anel.revisao_meta > 0 and v_anel.revisao_progresso >= v_anel.revisao_meta
      )
    ),
    'pontos', jsonb_build_object(
      'dia', v_pontos_dia.pontos_total,
      'total', v_pontos_total.pontos_total,
      'discriminacao', jsonb_build_object(
        'estudo_prioritario', v_pontos_dia.estudo_prioritario,
        'conclusao', v_pontos_dia.conclusao,
        'revisao_no_prazo', v_pontos_dia.revisao_no_prazo,
        'recuperacao_erro', v_pontos_dia.recuperacao_erro
      ),
      'discriminacao_total', jsonb_build_object(
        'estudo_prioritario', coalesce(v_vitalicio.estudo, 0),
        'conclusao', coalesce(v_vitalicio.conclusao, 0),
        'revisao_no_prazo', coalesce(v_vitalicio.revisao, 0),
        'recuperacao_erro', coalesce(v_vitalicio.recuperacao, 0)
      )
    ),
    'missao', jsonb_build_object(
      'id', v_missao.id,
      'tipo', v_missao.tipo,
      'progresso', v_missao.progresso,
      'progresso_bruto', v_missao.progresso_bruto,
      'meta', v_missao.meta,
      'estado', v_missao.estado
    ),
    'sequencia', v_sequencia,
    'conquistas', v_conquistas,
    -- As duas binarias saem com meta 1 para a tela tratar as quatro igual.
    'progresso_conquistas', jsonb_build_object(
      'primeiro_bloco', jsonb_build_object(
        'progresso', case when v_tem_bloco then 1 else 0 end, 'meta', 1),
      'primeira_revisao', jsonb_build_object(
        'progresso', case when v_tem_revisao then 1 else 0 end, 'meta', 1),
      'sequencia_pessoal', jsonb_build_object(
        'progresso', least(v_seq_maxima, v_meta_seq), 'meta', v_meta_seq),
      'cem_questoes', jsonb_build_object(
        'progresso', least(v_n_tentativas, v_meta_questoes), 'meta', v_meta_questoes)
    )
  );
exception when others then
  return jsonb_build_object(
    'data', v_data,
    'habilitada', false,
    'estado', 'erro',
    'codigo_erro', 'falha_ao_calcular',
    'sequencia', v_sequencia
  );
end;
$$;

comment on function public.consultar_gamificacao_do_dia() is
  'Contrato sem user_id: deriva auth.uid(), materializa o dia e devolve o anel meta_cheia com o recorte do piso, a discriminacao do DIA e a VITALICIA lado a lado, e quanto falta para cada conquista (AD-130).';

revoke all on function public.consultar_gamificacao_do_dia()
  from public, anon;
grant execute on function public.consultar_gamificacao_do_dia()
  to authenticated;
