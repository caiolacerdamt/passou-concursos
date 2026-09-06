-- SPEC 37 · RAIOX-20 · AD-140
--
-- O Raio-X mede sem acervo (e o ponto do AD-138), mas o plano nao estuda sem
-- questao. Sem gate, um concurso recem-aberto mostra ao aluno um assunto que o
-- plano nao tem como servir. Por isso o concurso nasce **oculto** e so aparece
-- na escolha depois de passar no piso E de alguem publicar.
--
-- A regra sabe subir `oculto -> elegivel` e sabe alertar. **Publicar e humano**
-- e fica registrado em `operador_acoes` (RAIOX-20 AC2). Cair abaixo do piso
-- depois de publicado NAO despublica (AC4): despublicar sozinho tiraria o
-- produto do ar de um aluno pagante por causa de um numero de acervo.

-- ── A lista do que falta, assunto por assunto (AC3) ─────────────────────────
--
-- Uma linha por assunto do edital de cada concurso, com o nome de materia
-- **daquele** concurso. O piso de questoes por topico e o mesmo do go-live
-- (`param.m1.minimo_aptas_por_topico`), reusado de proposito: prontidao de
-- concurso novo e a mesma pergunta que a prontidao do lancamento.
create or replace view public.prontidao_do_concurso
with (security_invoker = true)
as
  with piso as (
    select coalesce((
      select (valor #>> '{}')::integer
        from public.configuracoes_vigentes
       where chave = 'param.m1.minimo_aptas_por_topico'
         and jsonb_typeof(valor) = 'number'
         and (valor #>> '{}') ~ '^[1-9][0-9]*$'
    ), 5) as minimo_aptas
  )
  select
    c.id                                as concurso_id,
    c.orgao,
    c.cargo,
    c.visibilidade,
    cm.id                               as concurso_materia_id,
    cm.nome                             as materia,
    cm.ordem                            as materia_ordem,
    a.topico_id,
    t.nome                              as assunto,
    coalesce(r.peso, 0)::numeric        as peso,
    coalesce(i.aptas_sessao, 0)         as aptas_sessao,
    piso.minimo_aptas,
    coalesce(i.aptas_sessao, 0) >= piso.minimo_aptas as pronto
  from public.concursos c
  join public.concurso_materias cm          on cm.concurso_id = c.id
  join public.concurso_materia_assuntos a   on a.concurso_materia_id = cm.id
  join public.topicos t                     on t.id = a.topico_id
  cross join piso
  left join public.raiox_projecoes r
    on r.perfil_concurso_id = c.perfil_concurso_id and r.topico_id = a.topico_id
  left join public.inventario_acervo i      on i.topico_id = a.topico_id;

comment on view public.prontidao_do_concurso is
  'O que falta para publicar um concurso, assunto por assunto, com o nome de materia do edital dele (RAIOX-20 AC3).';

-- Cobertura **ponderada pelo peso**: e assim que "os assuntos de maior peso"
-- pesam mais na conta sem precisar de um corte arbitrario de quantos sao os
-- "maiores". Concurso sem projecao nenhuma tem cobertura zero — e nao elegivel,
-- que e a resposta certa para um concurso vazio.
create or replace view public.prontidao_do_concurso_resumo
with (security_invoker = true)
as
  with piso as (
    select coalesce((
      select (valor #>> '{}')::numeric
        from public.configuracoes_vigentes
       where chave = 'param.m5.prontidao_piso'
         and jsonb_typeof(valor) = 'number'
    ), 0.8) as fracao
  )
  select
    c.id                                              as concurso_id,
    c.visibilidade,
    count(p.topico_id)::integer                       as assuntos,
    count(p.topico_id) filter (where p.pronto)::integer as assuntos_prontos,
    case
      when coalesce(sum(p.peso), 0) > 0
        then (sum(p.peso) filter (where p.pronto) / sum(p.peso))::numeric
      else 0::numeric
    end                                               as cobertura,
    piso.fracao                                       as piso,
    case
      when coalesce(sum(p.peso), 0) > 0
        then coalesce(sum(p.peso) filter (where p.pronto), 0) / sum(p.peso) >= piso.fracao
      else false
    end                                               as atinge_piso
  from public.concursos c
  cross join piso
  left join public.prontidao_do_concurso p on p.concurso_id = c.id
  group by c.id, c.visibilidade, piso.fracao;

comment on view public.prontidao_do_concurso_resumo is
  'Cobertura ponderada pelo peso do Raio-X contra param.m5.prontidao_piso. `atinge_piso` e condicao para elegivel, nunca para publicar.';

revoke all on public.prontidao_do_concurso, public.prontidao_do_concurso_resumo
  from anon, authenticated;
grant select on public.prontidao_do_concurso, public.prontidao_do_concurso_resumo
  to service_role;

-- ── A regra: sobe ate elegivel, alerta, nunca despublica ────────────────────
create or replace function public.avaliar_prontidao_do_concurso(
  p_concurso_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mudou integer := 0;
  v_linha record;
begin
  for v_linha in
    select r.concurso_id, r.visibilidade, r.atinge_piso
      from public.prontidao_do_concurso_resumo r
     where p_concurso_id is null or r.concurso_id = p_concurso_id
  loop
    if v_linha.visibilidade = 'oculto' and v_linha.atinge_piso then
      update public.concursos
         set visibilidade = 'elegivel', atualizado_em = now()
       where id = v_linha.concurso_id;
      v_mudou := v_mudou + 1;

    elsif v_linha.visibilidade = 'elegivel' and not v_linha.atinge_piso then
      -- Elegivel e so uma promessa: pode voltar. Publicado nao.
      update public.concursos
         set visibilidade = 'oculto', atualizado_em = now()
       where id = v_linha.concurso_id;
      v_mudou := v_mudou + 1;

    elsif v_linha.visibilidade = 'publicado' then
      update public.concursos
         set prontidao_alerta_em = case when v_linha.atinge_piso then null else now() end,
             atualizado_em = now()
       where id = v_linha.concurso_id
         and (prontidao_alerta_em is null) = (not v_linha.atinge_piso);
      if found then
        v_mudou := v_mudou + 1;
      end if;
    end if;
  end loop;

  return v_mudou;
end;
$$;

comment on function public.avaliar_prontidao_do_concurso(uuid) is
  'Sobe oculto->elegivel e desce elegivel->oculto pelo piso. Concurso publicado abaixo do piso e ALERTADO (prontidao_alerta_em), nunca despublicado (RAIOX-20 AC4).';

-- ── A publicacao: acao humana, registrada ───────────────────────────────────
create or replace function public.publicar_concurso(
  p_concurso_id uuid,
  p_operador_id uuid,
  p_motivo      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visibilidade public.concurso_visibilidade;
begin
  -- `operadores` guarda `operador_id`, nao `user_id`: no inventario LGPD do
  -- projeto `user_id` e vocabulario do titular. `operador_ativo` ja e a
  -- pergunta pronta desde a SPEC 15.
  if not public.operador_ativo(p_operador_id) then
    raise exception 'operador_invalido';
  end if;

  if p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'motivo_obrigatorio';
  end if;

  select c.visibilidade into v_visibilidade
    from public.concursos c where c.id = p_concurso_id
   for update;

  if v_visibilidade is null then
    raise exception 'concurso_inexistente';
  end if;

  if v_visibilidade = 'publicado' then
    return p_concurso_id;
  end if;

  -- Publicar direto de `oculto` seria pular o gate. O operador so assina o que
  -- a regra ja disse estar pronto.
  if v_visibilidade <> 'elegivel' then
    raise exception 'concurso_nao_elegivel';
  end if;

  update public.concursos
     set visibilidade = 'publicado',
         publicado_em = now(),
         publicado_por = p_operador_id,
         prontidao_alerta_em = null,
         atualizado_em = now()
   where id = p_concurso_id;

  insert into public.operador_acoes (operador_id, tipo, entidade, entidade_id, motivo)
  values (p_operador_id, 'publicar', 'concursos', p_concurso_id::text, p_motivo);

  return p_concurso_id;
end;
$$;

comment on function public.publicar_concurso(uuid, uuid, text) is
  'Publica um concurso elegivel. Exige operador ativo e motivo, e grava operador_acoes: e a "acao humana registrada" da RAIOX-20 AC2.';

revoke all on function public.avaliar_prontidao_do_concurso(uuid)      from anon, authenticated;
revoke all on function public.publicar_concurso(uuid, uuid, text)      from anon, authenticated;
