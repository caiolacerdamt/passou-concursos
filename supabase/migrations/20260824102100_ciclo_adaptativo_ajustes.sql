-- W2-A · ajustes aditivos após a validação no banco de desenvolvimento.
-- A definição vigente é reaplicada com três correções pequenas, sem reabrir a
-- migration anterior: fallback legado, plano vazio fora da agenda e reserva
-- de capacidade para o simulado ligado.

do $ajustes$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.gera_plano_do_dia(uuid, date)'::regprocedure
  )
    into v_definition;

  if position('if v_topico.n_respostas > 0 and exists (' in v_definition) = 0 then
    raise exception 'W2-A: definição de gera_plano_do_dia sem seletor de cobertura esperado';
  end if;
  v_definition := replace(
    v_definition,
    'if v_topico.n_respostas > 0 and exists (',
    'if exists (select 1 from public.perfil_concurso p where p.ativo)'
      || ' and v_topico.n_respostas > 0 and exists ('
  );

  if position(
       'v_total_slots := greatest(floor(v_minutos_disponiveis / v_minutos_bloco)::integer, 0);'
       in v_definition
     ) = 0 then
    raise exception 'W2-A: definição de gera_plano_do_dia sem cálculo de slots esperado';
  end if;
  v_definition := replace(
    v_definition,
    'v_total_slots := greatest(floor(v_minutos_disponiveis / v_minutos_bloco)::integer, 0);',
    $slot$
    v_total_slots := greatest(
      floor(v_minutos_disponiveis / v_minutos_bloco)::integer
        - case when v_simulado_ligado then 1 else 0 end,
      0
    );$slot$
  );

  if position(
       'and not (extract(dow from v_data)::smallint = any(v_aluno.dias_estudo)) then'
       in v_definition
     ) = 0 then
    raise exception 'W2-A: definição de gera_plano_do_dia sem guarda de agenda esperada';
  end if;
  v_definition := replace(
    v_definition,
    $agenda$
    if v_aluno.dias_estudo is not null
       and cardinality(v_aluno.dias_estudo) > 0
       and not (extract(dow from v_data)::smallint = any(v_aluno.dias_estudo)) then
      continue;
    end if;$agenda$,
    $agenda_nova$
    if v_aluno.dias_estudo is not null
       and cardinality(v_aluno.dias_estudo) > 0
       and not (extract(dow from v_data)::smallint = any(v_aluno.dias_estudo)) then
      insert into public.plano_dia (user_id, data, gerado_em)
      values (v_aluno.user_id, v_data, now())
      on conflict (user_id, data) do update
        set gerado_em = now(), frase = null;
      continue;
    end if;$agenda_nova$
  );
  if position($agenda$
    if v_aluno.dias_estudo is not null
       and cardinality(v_aluno.dias_estudo) > 0
       and not (extract(dow from v_data)::smallint = any(v_aluno.dias_estudo)) then
      continue;
    end if;$agenda$ in v_definition) > 0 then
    raise exception 'W2-A: não foi possível tornar o plano fora da agenda observável';
  end if;

  execute v_definition;
end;
$ajustes$;
