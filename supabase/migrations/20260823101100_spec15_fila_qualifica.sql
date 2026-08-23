-- SPEC 15 · correcao forward-only de T119
-- O nome da coluna de retorno `questao_versao` colide com a coluna homonima
-- dentro de PL/pgSQL. Alias explicito remove a ambiguidade sem mudar o contrato.

create or replace function public.corrigir_questao_operador(
  p_questao_id uuid,
  p_questao_versao integer,
  p_operador uuid,
  p_mudanca_tipo public.tipo_mudanca,
  p_motivo text,
  p_campos jsonb
)
returns table (questao_id uuid, questao_versao integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.questoes%rowtype;
  v_nova_versao integer;
  v_revisao record;
begin
  perform public.exigir_operador_ativo(p_operador);
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_da_acao_obrigatorio';
  end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object'
     or p_campos = '{}'::jsonb then
    raise exception 'correcao_deve_ter_ao_menos_um_campo';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_campos) as campo
     where campo not in (
       'enunciado', 'alternativas', 'resposta_correta',
       'topico_id', 'dificuldade', 'anulada'
     )
  ) then
    raise exception 'campo_de_correcao_nao_permitido';
  end if;

  select q.* into v_atual
    from public.questoes as q
   where q.id = p_questao_id
     and q.questao_versao = p_questao_versao
     and q.vigente
   for update;
  if v_atual.id is null then
    raise exception 'questao_vigente_nao_encontrada';
  end if;

  insert into public.questoes (
    id, questao_versao, vigente,
    prova_id, numero, origem, fonte_citacao,
    topico_id, tipo_questao, enunciado, alternativas, imagens,
    resposta_correta, gabarito_versao, anulada,
    status, dificuldade, confianca_ia,
    mudanca_tipo, mudanca_motivo
  ) values (
    v_atual.id, v_atual.questao_versao + 1, true,
    v_atual.prova_id, v_atual.numero, v_atual.origem, v_atual.fonte_citacao,
    case when p_campos ? 'topico_id'
      then nullif(p_campos ->> 'topico_id', '')::uuid else v_atual.topico_id end,
    v_atual.tipo_questao,
    case when p_campos ? 'enunciado'
      then p_campos ->> 'enunciado' else v_atual.enunciado end,
    case when p_campos ? 'alternativas'
      then case when p_campos -> 'alternativas' = 'null'::jsonb
        then null else p_campos -> 'alternativas' end
      else v_atual.alternativas end,
    v_atual.imagens,
    case when p_campos ? 'resposta_correta'
      then p_campos ->> 'resposta_correta' else v_atual.resposta_correta end,
    v_atual.gabarito_versao,
    case when p_campos ? 'anulada'
      then (p_campos ->> 'anulada')::boolean else v_atual.anulada end,
    'em_revisao',
    case when p_campos ? 'dificuldade'
      then nullif(p_campos ->> 'dificuldade', '')::smallint else v_atual.dificuldade end,
    v_atual.confianca_ia,
    p_mudanca_tipo,
    btrim(p_motivo)
  ) returning public.questoes.questao_versao into v_nova_versao;

  for v_revisao in
    select r.id from public.questao_revisoes as r
     where r.questao_id = p_questao_id
       and r.questao_versao = p_questao_versao
       and r.status = 'pendente'
     for update
  loop
    perform public.registrar_decisao_questao_revisao(
      v_revisao.id, 'rejeitada', p_operador,
      'substituida pela versao corrigida: ' || btrim(p_motivo)
    );
  end loop;

  perform public.enfileirar_questao_revisao(
    p_questao_id, v_nova_versao, 'correcao_operador', 100::smallint,
    btrim(p_motivo)
  );
  perform public.registrar_acao_operador(
    p_operador, 'questao_corrigida', 'questao', p_questao_id::text,
    btrim(p_motivo),
    jsonb_build_object(
      'versao_anterior', p_questao_versao,
      'versao_nova', v_nova_versao,
      'mudanca_tipo', p_mudanca_tipo,
      'campos', p_campos
    )
  );

  return query select p_questao_id, v_nova_versao;
end;
$$;
