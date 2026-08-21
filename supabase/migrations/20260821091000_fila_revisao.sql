-- BANCO-07 · IA-04
--
-- A fila e operada por duas funcoes pequenas. O job pode pedir a mesma
-- pendencia varias vezes sem multiplicar linhas; a decisao exige um operador
-- que exista em auth.users e carimba a hora no banco.

create or replace function public.enfileirar_questao_revisao(
  p_questao_id uuid,
  p_questao_versao integer,
  p_motivo text,
  p_prioridade smallint default 0,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_da_revisao_obrigatorio';
  end if;

  insert into public.questao_revisoes
    (questao_id, questao_versao, motivo, prioridade, observacao)
  values
    (p_questao_id, p_questao_versao, btrim(p_motivo), p_prioridade, p_observacao)
  on conflict (questao_id, questao_versao, motivo) where status = 'pendente'
  do update set
    prioridade = greatest(public.questao_revisoes.prioridade, excluded.prioridade),
    observacao = coalesce(excluded.observacao, public.questao_revisoes.observacao)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.enfileirar_questao_revisao(uuid, integer, text, smallint, text) is
  'Cria ou reaproveita uma pendencia da fila unica de revisao (BANCO-07/IA-04).';

create or replace function public.registrar_decisao_questao_revisao(
  p_revisao_id bigint,
  p_decisao public.status_revisao_questao,
  p_operador uuid,
  p_observacao text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_decisao = 'pendente' then
    raise exception 'decisao_de_revisao_invalida';
  end if;

  update public.questao_revisoes
     set status = p_decisao,
         decidido_por = p_operador,
         decidida_em = now(),
         observacao = coalesce(p_observacao, observacao)
   where id = p_revisao_id and status = 'pendente'
  returning id into v_id;

  if v_id is null then
    raise exception 'revisao_nao_esta_pendente';
  end if;

  return v_id;
end;
$$;

comment on function public.registrar_decisao_questao_revisao(bigint, public.status_revisao_questao, uuid, text) is
  'Registra a decisao do operador na fila de revisao com autor e data (BANCO-07).';

revoke all on function public.enfileirar_questao_revisao(uuid, integer, text, smallint, text)
  from public, anon, authenticated;
revoke all on function public.registrar_decisao_questao_revisao(bigint, public.status_revisao_questao, uuid, text)
  from public, anon, authenticated;
grant execute on function public.enfileirar_questao_revisao(uuid, integer, text, smallint, text)
  to service_role;
grant execute on function public.registrar_decisao_questao_revisao(bigint, public.status_revisao_questao, uuid, text)
  to service_role;

