-- SPEC 15 · BANCO-10 · SEC-02/04/06
-- Candidato e taxonomia canonica mudam por funcoes fechadas. A IA continua
-- escrevendo somente em topico_candidato; criar topico exige operador ativo.

alter table public.topico_candidato
  add column motivo_decisao text;

create or replace function public.topico_candidato_exige_motivo_spec15()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'pendente' and new.motivo_decisao is not null then
    raise exception 'candidato_pendente_nao_tem_motivo_de_decisao';
  end if;
  if new.status <> 'pendente'
     and length(btrim(coalesce(new.motivo_decisao, ''))) = 0 then
    raise exception 'motivo_da_decisao_obrigatorio';
  end if;
  if new.motivo_decisao is not null then
    new.motivo_decisao := btrim(new.motivo_decisao);
  end if;
  return new;
end;
$$;

create trigger topico_candidato_motivo_spec15
  before insert or update on public.topico_candidato
  for each row execute function public.topico_candidato_exige_motivo_spec15();

create or replace function public.decidir_topico_candidato(
  p_candidato_id uuid,
  p_decisao public.status_candidato,
  p_operador uuid,
  p_materia_id uuid,
  p_nome text,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidato public.topico_candidato%rowtype;
  v_materia_id uuid;
  v_nome text;
  v_topico_id uuid;
begin
  perform public.exigir_operador_ativo(p_operador);
  if p_decisao not in ('aprovado', 'rejeitado') then
    raise exception 'decisao_de_candidato_invalida';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_da_acao_obrigatorio';
  end if;

  select c.* into v_candidato
    from public.topico_candidato as c
   where c.id = p_candidato_id and c.status = 'pendente'
   for update;
  if v_candidato.id is null then
    raise exception 'candidato_nao_esta_pendente';
  end if;

  if p_decisao = 'aprovado' then
    v_materia_id := coalesce(p_materia_id, v_candidato.materia_id);
    v_nome := coalesce(nullif(btrim(p_nome), ''), btrim(v_candidato.nome_sugerido));
    if v_materia_id is null then
      raise exception 'materia_do_topico_obrigatoria';
    end if;
    if length(coalesce(v_nome, '')) = 0 then
      raise exception 'nome_do_topico_obrigatorio';
    end if;

    insert into public.topicos (materia_id, nome)
    values (v_materia_id, v_nome)
    returning id into v_topico_id;

    update public.topico_candidato
       set status = 'aprovado',
           materia_id = v_materia_id,
           topico_id = v_topico_id,
           decidido_em = now(),
           decidido_por = p_operador,
           motivo_decisao = btrim(p_motivo)
     where id = p_candidato_id;
  else
    update public.topico_candidato
       set status = 'rejeitado',
           topico_id = null,
           decidido_em = now(),
           decidido_por = p_operador,
           motivo_decisao = btrim(p_motivo)
     where id = p_candidato_id;
  end if;

  perform public.registrar_acao_operador(
    p_operador,
    case p_decisao when 'aprovado'
      then 'topico_candidato_aprovado' else 'topico_candidato_rejeitado' end,
    'topico_candidato',
    p_candidato_id::text,
    btrim(p_motivo),
    jsonb_build_object(
      'decisao', p_decisao,
      'topico_id', v_topico_id,
      'materia_id', case when p_decisao = 'aprovado' then v_materia_id else null end,
      'nome', case when p_decisao = 'aprovado' then v_nome else null end
    )
  );
  return v_topico_id;
end;
$$;

create or replace function public.editar_taxonomia_operador(
  p_tipo text,
  p_id uuid,
  p_operador uuid,
  p_motivo text,
  p_campos jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exigir_operador_ativo(p_operador);
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_da_acao_obrigatorio';
  end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object'
     or p_campos = '{}'::jsonb then
    raise exception 'edicao_de_taxonomia_deve_ter_campo';
  end if;

  if p_tipo = 'materia' then
    if exists (
      select 1 from jsonb_object_keys(p_campos) as campo
       where campo not in ('nome', 'ordem', 'ativa')
    ) then
      raise exception 'campo_de_taxonomia_nao_permitido';
    end if;
    update public.materias as m
       set nome = case when p_campos ? 'nome' then p_campos ->> 'nome' else m.nome end,
           ordem = case when p_campos ? 'ordem' then (p_campos ->> 'ordem')::smallint else m.ordem end,
           ativa = case when p_campos ? 'ativa' then (p_campos ->> 'ativa')::boolean else m.ativa end
     where m.id = p_id;
  elsif p_tipo = 'topico' then
    if exists (
      select 1 from jsonb_object_keys(p_campos) as campo
       where campo not in ('nome', 'ordem', 'ativo', 'materia_id')
    ) then
      raise exception 'campo_de_taxonomia_nao_permitido';
    end if;
    update public.topicos as t
       set nome = case when p_campos ? 'nome' then p_campos ->> 'nome' else t.nome end,
           ordem = case when p_campos ? 'ordem' then (p_campos ->> 'ordem')::smallint else t.ordem end,
           ativo = case when p_campos ? 'ativo' then (p_campos ->> 'ativo')::boolean else t.ativo end,
           materia_id = case when p_campos ? 'materia_id'
             then (p_campos ->> 'materia_id')::uuid else t.materia_id end
     where t.id = p_id;
  else
    raise exception 'tipo_de_taxonomia_invalido';
  end if;

  if not found then
    raise exception 'item_de_taxonomia_nao_encontrado';
  end if;
  perform public.registrar_acao_operador(
    p_operador, p_tipo || '_editado', p_tipo, p_id::text,
    btrim(p_motivo), p_campos
  );
  return true;
end;
$$;

revoke all on function public.decidir_topico_candidato(uuid, public.status_candidato, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.editar_taxonomia_operador(text, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.decidir_topico_candidato(uuid, public.status_candidato, uuid, uuid, text, text)
  to service_role;
grant execute on function public.editar_taxonomia_operador(text, uuid, uuid, text, jsonb)
  to service_role;
