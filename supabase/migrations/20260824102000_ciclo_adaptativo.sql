-- W2-A · ALUNO-07/08/11 · ciclo adaptativo do Agente Comercial
--
-- O plano continua sendo uma projeção descartável. Esta migration adiciona os
-- dados que pertencem ao bloco (quantidade e versão cheia) e os pequenos
-- ajustes feitos pelo aluno, sem criar uma segunda fonte de verdade para
-- tentativas, sessões ou revisão.

alter table public.plano_bloco
  add column if not exists n_questoes integer,
  add column if not exists n_questoes_cheias integer,
  add column if not exists minutos_estimados_cheios integer,
  add column if not exists ajuste_usuario boolean not null default false,
  add column if not exists adiado_de date;

-- Linhas que vieram de migrations anteriores ainda não conheciam a quantidade
-- nem a base da versão curta. O valor atual é a versão cheia observada naquele
-- momento; a operação curta nunca faz redução cumulativa.
update public.plano_bloco
   set n_questoes = coalesce(
         n_questoes,
         greatest(
           1,
           ceil(
             minutos_estimados / coalesce(
               (select (valor #>> '{}')::numeric
                  from public.configuracoes_vigentes
                 where chave = 'param.m4.minutos_por_questao'
                   and jsonb_typeof(valor) = 'number'
                   and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'),
               2
             )
           )::integer
         )
       ),
       minutos_estimados_cheios = coalesce(minutos_estimados_cheios, minutos_estimados, 1);

update public.plano_bloco
   set n_questoes_cheias = coalesce(n_questoes_cheias, n_questoes, 10)
 where n_questoes_cheias is null;

alter table public.plano_bloco
  alter column n_questoes set default 10,
  alter column n_questoes_cheias set default 10,
  alter column minutos_estimados_cheios set default 1,
  alter column n_questoes set not null,
  alter column n_questoes_cheias set not null,
  alter column minutos_estimados_cheios set not null;

alter table public.plano_bloco
  add constraint plano_bloco_n_questoes_positivo
    check (n_questoes >= 1),
  add constraint plano_bloco_n_questoes_cheias_positivo
    check (n_questoes_cheias >= 1),
  add constraint plano_bloco_minutos_cheios_positivos
    check (minutos_estimados_cheios >= 1);

create index if not exists plano_bloco_adiado_idx
  on public.plano_bloco (adiado_de)
  where adiado_de is not null;

-- O programa do perfil ativo é o porteiro do edital. A projeção continua sendo
-- a única fonte do peso, mas uma projeção fora do programa não atravessa a
-- fronteira para o motor. Sem perfil ativo, o fallback 1.0 legado permanece.
create or replace view public.raiox_peso_topico
  with (security_invoker = true) as
  select t.id as topico_id, 1.0::numeric as peso
    from public.topicos t
   where t.ativo
     and not exists (
       select 1
         from public.perfil_concurso p
        where p.ativo
     )
  union all
  select r.topico_id, r.peso
    from public.raiox_projecoes r
    join public.perfil_concurso p
      on p.id = r.perfil_concurso_id and p.ativo
    join public.topicos t
      on t.id = r.topico_id and t.ativo
   where r.peso > 0
     and exists (
       select 1
         from jsonb_array_elements_text(p.programa_edital) edital(topico_id)
        where edital.topico_id = r.topico_id::text
     );

comment on view public.raiox_peso_topico is
  'FRONTEIRA M4 <-> M5 (AD-056/AD-057). Sem perfil ativo, fallback 1.0. Com perfil ativo, entrega somente tópicos do programa_edital com peso real positivo; a taxa do Raio-X continua vindo apenas de questões origem=real.';

create or replace function public.gera_plano_do_dia(
  p_user_id uuid default null,
  p_data    date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data                    date;
  v_peso_revisao            numeric;
  v_questoes_bloco          integer;
  v_minutos_questao         numeric;
  v_minutos_bloco           integer;
  v_pct_avancar             numeric;
  v_pct_praticar            numeric;
  v_pct_revisar             numeric;
  v_teto_revisoes           integer;
  v_cooldown_dias           integer;
  v_teto_semanal            integer;
  v_janela_maxima           integer;
  v_fraqueza_nivel          jsonb;
  v_simulado_ligado         boolean;
  v_aluno                   record;
  v_topico                  record;
  v_plano_id                uuid;
  v_ordem_piso              integer;
  v_ordem_meta              integer;
  v_minutos_gastos          integer;
  v_total_slots             integer;
  v_slots_existentes        integer;
  v_slots_restantes         integer;
  v_review_slots            integer;
  v_advance_slots           integer;
  v_practice_slots          integer;
  v_extra_slots              integer;
  v_selecionados_revisao    integer;
  v_selecionados_avanco     integer;
  v_selecionados_pratica    integer;
  v_minutos_revisao         integer;
  v_planos                  integer := 0;
  v_pass                    integer;
  v_tem_revisao             boolean;
  v_motivo                  text;
  v_tipo_extra              text;
  v_usados_topicos          uuid[];
  v_usados_materias         uuid[];
begin
  -- 8406/2 é exclusivo do plano. Uma execução concorrente sai sem apagar ou
  -- misturar o plano que a outra execução está montando.
  if not pg_try_advisory_xact_lock(8406, 2) then
    return -1;
  end if;

  v_data := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);

  -- A leitura usa o catálogo como contrato. As verificações de tipo evitam que
  -- um jsonb ilegível interrompa o job; o default seguro vence em qualquer
  -- dúvida, assim como no leitor TypeScript.
  select
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
                          then (valor #>> '{}')::numeric end
                from public.configuracoes_vigentes
               where chave = 'param.m4.peso_devendo_revisao'), 1.5),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^[1-9][0-9]*$'
                          then (valor #>> '{}')::integer end
                from public.configuracoes_vigentes
               where chave = 'param.m4.questoes_por_bloco'), 10),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
                          then (valor #>> '{}')::numeric end
                from public.configuracoes_vigentes
               where chave = 'param.m4.minutos_por_questao'), 2),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^0([.][0-9]+)?$|^1([.]0+)?$'
                          then (valor #>> '{}')::numeric end
                from public.configuracoes_vigentes
               where chave = 'param.m4.percentual_avancar'), 0.5),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^0([.][0-9]+)?$|^1([.]0+)?$'
                          then (valor #>> '{}')::numeric end
                from public.configuracoes_vigentes
               where chave = 'param.m4.percentual_praticar'), 0.3),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^0([.][0-9]+)?$|^1([.]0+)?$'
                          then (valor #>> '{}')::numeric end
                from public.configuracoes_vigentes
               where chave = 'param.m4.percentual_revisar'), 0.2),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^[1-9][0-9]*$'
                          then (valor #>> '{}')::integer end
                from public.configuracoes_vigentes
               where chave = 'param.m4.teto_revisoes_dia'), 2),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^[0-9]+$'
                          then (valor #>> '{}')::integer end
                from public.configuracoes_vigentes
               where chave = 'param.m4.cooldown_materia_dias'), 2),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^[1-9][0-9]*$'
                          then (valor #>> '{}')::integer end
                from public.configuracoes_vigentes
               where chave = 'param.m4.teto_semanal_materia'), 3),
    coalesce((select case when jsonb_typeof(valor) = 'number'
                           and (valor #>> '{}') ~ '^[1-9][0-9]*$'
                          then (valor #>> '{}')::integer end
                from public.configuracoes_vigentes
               where chave = 'param.m4.limite_sem_toque_materia_dias'), 7),
    coalesce((select valor
                from public.configuracoes_vigentes
               where chave = 'param.m4.fraqueza_por_nivel'
                 and jsonb_typeof(valor) = 'object'),
             '{"iniciante":0.9,"intermediario":0.6,"avancado":0.35}'::jsonb),
    coalesce((select case when jsonb_typeof(valor) = 'boolean'
                          then (valor #>> '{}')::boolean end
                from public.configuracoes_vigentes
               where chave = 'flag.m4.simulado_semanal'), false)
    into v_peso_revisao, v_questoes_bloco, v_minutos_questao,
         v_pct_avancar, v_pct_praticar, v_pct_revisar,
         v_teto_revisoes, v_cooldown_dias, v_teto_semanal,
         v_janela_maxima, v_fraqueza_nivel, v_simulado_ligado;

  if v_pct_avancar + v_pct_praticar + v_pct_revisar <= 0 then
    v_pct_avancar := 1;
    v_pct_praticar := 0;
    v_pct_revisar := 0;
  end if;

  v_minutos_bloco := greatest(ceil(v_questoes_bloco * v_minutos_questao)::integer, 1);

  for v_aluno in
    select p.user_id, p.minutos_por_dia, p.nivel_declarado, p.dias_estudo
      from public.perfil_estudo p
     where p_user_id is null or p.user_id = p_user_id
  loop
    -- Perfil legado sem dias continua operável. Perfil novo recebe plano
    -- somente nos dias que declarou (0 = domingo, como no onboarding).
    if v_aluno.dias_estudo is not null
       and cardinality(v_aluno.dias_estudo) > 0
       and not (extract(dow from v_data)::smallint = any(v_aluno.dias_estudo)) then
      continue;
    end if;

    insert into public.plano_dia (user_id, data, gerado_em)
    values (v_aluno.user_id, v_data, now())
    on conflict (user_id, data) do update
      set gerado_em = now(), frase = null
    returning id into v_plano_id;

    -- Regerar não perde um bloco com sessão (aberta ou encerrada) nem um
    -- ajuste explícito. O restante é projeção descartável e pode ser montado
    -- de novo com domínio, peso e agenda atuais.
    update public.plano_bloco b
       set ordem = b.ordem + 200000
     where b.plano_dia_id = v_plano_id
       and (
         b.ajuste_usuario
         or exists (
           select 1 from public.sessoes s where s.plano_bloco_id = b.id
         )
       );

    delete from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and not (
         b.ajuste_usuario
         or exists (
           select 1 from public.sessoes s where s.plano_bloco_id = b.id
         )
       );

    select coalesce(sum(b.minutos_estimados), 0)::integer,
           count(*)::integer
      into v_minutos_gastos, v_slots_existentes
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and b.nivel = 'meta_cheia';

    select coalesce(array_agg(b.topico_id) filter (where b.topico_id is not null), '{}'::uuid[])
      into v_usados_topicos
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and b.nivel = 'meta_cheia';

    select coalesce(array_agg(t.materia_id) filter (where t.materia_id is not null), '{}'::uuid[])
      into v_usados_materias
      from public.plano_bloco b
      join public.topicos t on t.id = b.topico_id
     where b.plano_dia_id = v_plano_id
       and b.nivel = 'meta_cheia';

    v_ordem_piso := 0;
    v_ordem_meta := 0;
    v_total_slots := greatest(floor(v_aluno.minutos_por_dia / v_minutos_bloco)::integer, 0);
    v_slots_restantes := greatest(v_total_slots - v_slots_existentes, 0);

    select exists (
      select 1
        from public.revisao_agenda r
        join public.raiox_peso_topico rx on rx.topico_id = r.topico_id
       where r.user_id = v_aluno.user_id
         and r.due <= v_data
    ) into v_tem_revisao;

    v_review_slots := least(
      v_slots_restantes,
      v_teto_revisoes,
      greatest(floor(v_aluno.minutos_por_dia * v_pct_revisar / v_minutos_bloco)::integer, 0)
    );
    -- Uma capacidade menor que um bloco ainda reserva uma revisão quando há
    -- espaço para um bloco inteiro; nunca estoura o teto diário.
    if v_tem_revisao and v_review_slots = 0 and v_slots_restantes > 0
       and v_pct_revisar > 0 then
      v_review_slots := 1;
    end if;
    v_slots_restantes := greatest(v_slots_restantes - v_review_slots, 0);

    v_advance_slots := least(
      v_slots_restantes,
      greatest(floor(v_aluno.minutos_por_dia * v_pct_avancar / v_minutos_bloco)::integer, 0)
    );
    v_slots_restantes := greatest(v_slots_restantes - v_advance_slots, 0);

    v_practice_slots := least(
      v_slots_restantes,
      greatest(floor(v_aluno.minutos_por_dia * v_pct_praticar / v_minutos_bloco)::integer, 0)
    );
    v_slots_restantes := greatest(v_slots_restantes - v_practice_slots, 0);
    v_extra_slots := v_slots_restantes;

    v_selecionados_revisao := 0;
    v_minutos_revisao := 0;

    -- Revisão devida tem prioridade, mas a participação é limitada pelo
    -- percentual e pelo teto configurável. O piso e a meta continuam sendo a
    -- mesma revisão lógica, como no contrato anterior.
    for v_pass in 0..1 loop
      exit when v_selecionados_revisao >= v_review_slots;
      for v_topico in
        select t.id as topico_id, t.materia_id
        from public.topicos t
        join public.raiox_peso_topico rx on rx.topico_id = t.id
        join public.revisao_agenda r
          on r.user_id = v_aluno.user_id and r.topico_id = t.id
        left join public.dominio_topico d
          on d.user_id = v_aluno.user_id and d.topico_id = t.id
       where t.ativo
         and r.due <= v_data
         and exists (
           select 1 from public.questoes q
            where q.topico_id = t.id
              and q.status = 'publicada'
              and q.vigente
              and not q.anulada
         )
       order by rx.peso * v_peso_revisao * coalesce(
         case when d.score is null
              then (v_fraqueza_nivel ->> coalesce(v_aluno.nivel_declarado, 'iniciante'))::numeric
              else 1 - d.score end,
         0.9
       ) desc, t.id
      loop
        exit when v_selecionados_revisao >= v_review_slots;
        if v_topico.topico_id = any(v_usados_topicos)
           or v_topico.materia_id = any(v_usados_materias) and v_pass = 0 then
          continue;
        end if;

      v_ordem_piso := v_ordem_piso + 1;
      insert into public.plano_bloco
        (plano_dia_id, tipo, nivel, ordem, topico_id, n_questoes,
         n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo)
      values
        (v_plano_id, 'revisar', 'piso', v_ordem_piso, v_topico.topico_id,
         v_questoes_bloco, v_questoes_bloco, v_minutos_bloco, v_minutos_bloco,
         'revisar hoje = nao perder o que voce ja conquistou');

      v_ordem_meta := v_ordem_meta + 1;
      insert into public.plano_bloco
        (plano_dia_id, tipo, nivel, ordem, topico_id, n_questoes,
         n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo)
      values
        (v_plano_id, 'revisar', 'meta_cheia', v_ordem_meta, v_topico.topico_id,
         v_questoes_bloco, v_questoes_bloco, v_minutos_bloco, v_minutos_bloco,
         'revisar hoje = nao perder o que voce ja conquistou');

        v_usados_topicos := array_append(v_usados_topicos, v_topico.topico_id);
        v_usados_materias := array_append(v_usados_materias, v_topico.materia_id);
        v_selecionados_revisao := v_selecionados_revisao + 1;
        v_minutos_revisao := v_minutos_revisao + v_minutos_bloco;
        v_minutos_gastos := v_minutos_gastos + v_minutos_bloco;
      end loop;
    end loop;

    -- O cursor de tópicos é reaberto para cada categoria. A primeira passagem
    -- respeita cooldown; a segunda só é usada quando não há matéria elegível
    -- fora dele. Assim um cooldown não monopoliza o dia, mas também não deixa
    -- o aluno sem plano num edital pequeno.
    v_selecionados_avanco := 0;
    for v_pass in 0..1 loop
      exit when v_selecionados_avanco >= v_advance_slots;
      for v_topico in
        select
          t.id as topico_id,
          t.materia_id,
          rx.peso,
          d.score,
          coalesce(d.n_respostas, 0)::integer as n_respostas,
          coalesce(semana.n_blocos, 0)::integer as n_blocos_semana,
          ultima.ultima_data,
          (r.due is not null and r.due <= v_data) as devendo,
          (ultima.ultima_data is not null
             and v_data - ultima.ultima_data <= v_cooldown_dias) as em_cooldown
        from public.topicos t
        join public.raiox_peso_topico rx on rx.topico_id = t.id
        left join public.dominio_topico d
          on d.user_id = v_aluno.user_id and d.topico_id = t.id
        left join public.revisao_agenda r
          on r.user_id = v_aluno.user_id and r.topico_id = t.id
        left join lateral (
          select max((tentativa.respondida_em at time zone 'America/Sao_Paulo')::date) as ultima_data
           from public.tentativas tentativa
           where tentativa.user_id = v_aluno.user_id
             and tentativa.materia_id = t.materia_id
        ) ultima on true
        left join lateral (
          select count(distinct tentativa.sessao_id)::integer as n_blocos
            from public.tentativas tentativa
           where tentativa.user_id = v_aluno.user_id
             and tentativa.materia_id = t.materia_id
             and (tentativa.respondida_em at time zone 'America/Sao_Paulo')::date
                   >= date_trunc('week', v_data::timestamp)::date
        ) semana on true
       where t.ativo
         and not (r.due is not null and r.due <= v_data)
         and exists (
           select 1 from public.questoes q
            where q.topico_id = t.id
              and q.status = 'publicada'
              and q.vigente
              and not q.anulada
         )
       order by
         (ultima.ultima_data is null
           or v_data - ultima.ultima_data >= v_janela_maxima) desc,
         (rx.peso * coalesce(
           case when d.score is null
                then (v_fraqueza_nivel ->> coalesce(v_aluno.nivel_declarado, 'iniciante'))::numeric
                else 1 - d.score end,
           0.9
         )) desc,
         ultima.ultima_data nulls first,
         t.materia_id,
         t.id
      loop
        exit when v_selecionados_avanco >= v_advance_slots;
        if v_topico.topico_id = any(v_usados_topicos)
           or v_topico.materia_id = any(v_usados_materias) and v_pass = 0
           or v_topico.em_cooldown and v_pass = 0 then
          continue;
        end if;
        if v_topico.n_blocos_semana >= v_teto_semanal
           and not (
             v_topico.n_respostas = 0
             or v_topico.ultima_data is null
             or v_data - v_topico.ultima_data >= v_janela_maxima
           ) then
          continue;
        end if;

        if v_topico.n_respostas = 0 then
          v_motivo := 'cobertura do edital';
        elsif v_topico.ultima_data is null
           or v_data - v_topico.ultima_data >= v_janela_maxima then
          v_motivo := 'janela maxima sem tocar materia relevante';
        elsif v_topico.score is not null and v_topico.score <= 0.5 then
          v_motivo := 'seu ponto mais fraco entre os que mais caem';
        else
          v_motivo := 'rotacao do edital';
        end if;

        v_ordem_meta := v_ordem_meta + 1;
        insert into public.plano_bloco
          (plano_dia_id, tipo, nivel, ordem, topico_id, n_questoes,
           n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo)
        values
          (v_plano_id, 'avancar', 'meta_cheia', v_ordem_meta,
           v_topico.topico_id, v_questoes_bloco, v_questoes_bloco,
           v_minutos_bloco, v_minutos_bloco, v_motivo);
        v_usados_topicos := array_append(v_usados_topicos, v_topico.topico_id);
        v_usados_materias := array_append(v_usados_materias, v_topico.materia_id);
        v_selecionados_avanco := v_selecionados_avanco + 1;
        v_minutos_gastos := v_minutos_gastos + v_minutos_bloco;
      end loop;
    end loop;

    v_selecionados_pratica := 0;
    for v_pass in 0..1 loop
      exit when v_selecionados_pratica >= v_practice_slots;
      for v_topico in
        select
          t.id as topico_id,
          t.materia_id,
          rx.peso,
          d.score,
          coalesce(d.n_respostas, 0)::integer as n_respostas,
          coalesce(semana.n_blocos, 0)::integer as n_blocos_semana,
          ultima.ultima_data,
          (r.due is not null and r.due <= v_data) as devendo,
          (ultima.ultima_data is not null
             and v_data - ultima.ultima_data <= v_cooldown_dias) as em_cooldown
        from public.topicos t
        join public.raiox_peso_topico rx on rx.topico_id = t.id
        left join public.dominio_topico d
          on d.user_id = v_aluno.user_id and d.topico_id = t.id
        left join public.revisao_agenda r
          on r.user_id = v_aluno.user_id and r.topico_id = t.id
        left join lateral (
          select max((tentativa.respondida_em at time zone 'America/Sao_Paulo')::date) as ultima_data
            from public.tentativas tentativa
           where tentativa.user_id = v_aluno.user_id
             and tentativa.materia_id = t.materia_id
        ) ultima on true
        left join lateral (
          select count(distinct tentativa.sessao_id)::integer as n_blocos
            from public.tentativas tentativa
           where tentativa.user_id = v_aluno.user_id
             and tentativa.materia_id = t.materia_id
             and (tentativa.respondida_em at time zone 'America/Sao_Paulo')::date
                   >= date_trunc('week', v_data::timestamp)::date
        ) semana on true
       where t.ativo
         and not (r.due is not null and r.due <= v_data)
         and exists (
           select 1 from public.questoes q
            where q.topico_id = t.id
              and q.status = 'publicada'
              and q.vigente
              and not q.anulada
         )
       order by
         (ultima.ultima_data is null
           or v_data - ultima.ultima_data >= v_janela_maxima) desc,
         (rx.peso * coalesce(
           case when d.score is null
                then (v_fraqueza_nivel ->> coalesce(v_aluno.nivel_declarado, 'iniciante'))::numeric
                else 1 - d.score end,
           0.9
         )) desc,
         ultima.ultima_data nulls first,
         t.materia_id,
         t.id
      loop
        exit when v_selecionados_pratica >= v_practice_slots;
        if v_topico.topico_id = any(v_usados_topicos)
           or v_topico.materia_id = any(v_usados_materias) and v_pass = 0
           or v_topico.em_cooldown and v_pass = 0 then
          continue;
        end if;
        if v_topico.n_blocos_semana >= v_teto_semanal
           and not (
             v_topico.n_respostas = 0
             or v_topico.ultima_data is null
             or v_data - v_topico.ultima_data >= v_janela_maxima
           ) then
          continue;
        end if;

        if v_topico.n_respostas = 0 then
          v_motivo := 'cobertura do edital';
        elsif v_topico.ultima_data is null
           or v_data - v_topico.ultima_data >= v_janela_maxima then
          v_motivo := 'janela maxima sem tocar materia relevante';
        elsif v_topico.em_cooldown then
          v_motivo := 'rotacao do edital';
        else
          v_motivo := 'pratica distribuida no ciclo';
        end if;

        v_ordem_meta := v_ordem_meta + 1;
        insert into public.plano_bloco
          (plano_dia_id, tipo, nivel, ordem, topico_id, n_questoes,
           n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo)
        values
          (v_plano_id, 'treinar', 'meta_cheia', v_ordem_meta,
           v_topico.topico_id, v_questoes_bloco, v_questoes_bloco,
           v_minutos_bloco, v_minutos_bloco, v_motivo);
        v_usados_topicos := array_append(v_usados_topicos, v_topico.topico_id);
        v_usados_materias := array_append(v_usados_materias, v_topico.materia_id);
        v_selecionados_pratica := v_selecionados_pratica + 1;
        v_minutos_gastos := v_minutos_gastos + v_minutos_bloco;
      end loop;
    end loop;

    -- Percentuais são alvos em blocos inteiros. Se uma categoria não consegue
    -- usar toda a sua fatia (por falta de matéria elegível ou por arredondamento),
    -- o restante volta para a capacidade total, sem exceder minutos_por_dia.
    v_extra_slots := greatest(
      v_total_slots - v_slots_existentes
        - v_selecionados_revisao - v_selecionados_avanco - v_selecionados_pratica,
      0
    );
    for v_pass in 0..1 loop
      exit when v_extra_slots = 0;
      for v_topico in
        select
          t.id as topico_id,
          t.materia_id,
          rx.peso,
          d.score,
          coalesce(d.n_respostas, 0)::integer as n_respostas,
          coalesce(semana.n_blocos, 0)::integer as n_blocos_semana,
          ultima.ultima_data,
          (r.due is not null and r.due <= v_data) as devendo,
          (ultima.ultima_data is not null
             and v_data - ultima.ultima_data <= v_cooldown_dias) as em_cooldown
        from public.topicos t
        join public.raiox_peso_topico rx on rx.topico_id = t.id
        left join public.dominio_topico d
          on d.user_id = v_aluno.user_id and d.topico_id = t.id
        left join public.revisao_agenda r
          on r.user_id = v_aluno.user_id and r.topico_id = t.id
        left join lateral (
          select max((tentativa.respondida_em at time zone 'America/Sao_Paulo')::date) as ultima_data
            from public.tentativas tentativa
           where tentativa.user_id = v_aluno.user_id
             and tentativa.materia_id = t.materia_id
        ) ultima on true
        left join lateral (
          select count(distinct tentativa.sessao_id)::integer as n_blocos
            from public.tentativas tentativa
           where tentativa.user_id = v_aluno.user_id
             and tentativa.materia_id = t.materia_id
             and (tentativa.respondida_em at time zone 'America/Sao_Paulo')::date
                   >= date_trunc('week', v_data::timestamp)::date
        ) semana on true
       where t.ativo
         and not (r.due is not null and r.due <= v_data)
         and exists (
           select 1 from public.questoes q
            where q.topico_id = t.id
              and q.status = 'publicada'
              and q.vigente
              and not q.anulada
         )
       order by
         (ultima.ultima_data is null
           or v_data - ultima.ultima_data >= v_janela_maxima) desc,
         (rx.peso * coalesce(
           case when d.score is null
                then (v_fraqueza_nivel ->> coalesce(v_aluno.nivel_declarado, 'iniciante'))::numeric
                else 1 - d.score end,
           0.9
         )) desc,
         ultima.ultima_data nulls first,
         t.materia_id,
         t.id
      loop
        exit when v_extra_slots = 0;
        if v_topico.topico_id = any(v_usados_topicos)
           or v_topico.materia_id = any(v_usados_materias) and v_pass = 0
           or v_topico.em_cooldown and v_pass = 0 then
          continue;
        end if;
        if v_topico.n_blocos_semana >= v_teto_semanal
           and not (
             v_topico.n_respostas = 0
             or v_topico.ultima_data is null
             or v_data - v_topico.ultima_data >= v_janela_maxima
           ) then
          continue;
        end if;

        if v_selecionados_pratica <= v_selecionados_avanco then
          v_tipo_extra := 'treinar';
          v_motivo := 'pratica distribuida no ciclo';
          v_selecionados_pratica := v_selecionados_pratica + 1;
        else
          v_tipo_extra := 'avancar';
          v_motivo := 'rotacao do edital';
          v_selecionados_avanco := v_selecionados_avanco + 1;
        end if;

        if v_topico.n_respostas = 0 then
          v_motivo := 'cobertura do edital';
        elsif v_topico.ultima_data is null
           or v_data - v_topico.ultima_data >= v_janela_maxima then
          v_motivo := 'janela maxima sem tocar materia relevante';
        end if;

        v_ordem_meta := v_ordem_meta + 1;
        insert into public.plano_bloco
          (plano_dia_id, tipo, nivel, ordem, topico_id, n_questoes,
           n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo)
        values
          (v_plano_id, v_tipo_extra::public.bloco_tipo, 'meta_cheia', v_ordem_meta,
           v_topico.topico_id, v_questoes_bloco, v_questoes_bloco,
           v_minutos_bloco, v_minutos_bloco, v_motivo);
        v_usados_topicos := array_append(v_usados_topicos, v_topico.topico_id);
        v_usados_materias := array_append(v_usados_materias, v_topico.materia_id);
        v_extra_slots := v_extra_slots - 1;
        v_minutos_gastos := v_minutos_gastos + v_minutos_bloco;
      end loop;
    end loop;

    if v_simulado_ligado
       and v_minutos_gastos + v_minutos_bloco <= v_aluno.minutos_por_dia then
      v_ordem_meta := v_ordem_meta + 1;
      insert into public.plano_bloco
        (plano_dia_id, tipo, nivel, ordem, n_questoes,
         n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo)
      values
        (v_plano_id, 'simulado', 'meta_cheia', v_ordem_meta, v_questoes_bloco,
         v_questoes_bloco, v_minutos_bloco, v_minutos_bloco,
         'simulado da semana');
    end if;

    -- A ordem dos blocos preservados (adiados/reordenados/concluídos) vem
    -- antes das escolhas novas. Duas passagens evitam colisão na UNIQUE durante
    -- a troca de ordens.
    update public.plano_bloco b
       set ordem = b.ordem + 200000
     where b.plano_dia_id = v_plano_id;

    with ordenados as (
      select b.id,
             row_number() over (
               partition by b.nivel
               order by
                 case when b.ajuste_usuario then 0
                      when exists (select 1 from public.sessoes s where s.plano_bloco_id = b.id) then 1
                      else 2 end,
                 case when b.adiado_de is not null then 0 else 1 end,
                 b.ordem,
                 b.id
             )::integer as nova_ordem
        from public.plano_bloco b
       where b.plano_dia_id = v_plano_id
    )
    update public.plano_bloco b
       set ordem = o.nova_ordem
      from ordenados o
     where b.id = o.id;

    v_planos := v_planos + 1;
  end loop;

  return v_planos;
end;
$$;

comment on function public.gera_plano_do_dia(uuid, date) is
  'Motor determinístico do ciclo adaptativo (W2-A). Respeita agenda declarada, programa_edital, capacidade por avançar/praticar/revisar, cooldown, teto semanal e janela máxima; preserva sessões e ajustes do aluno. Sem IA e idempotente.';

revoke all on function public.gera_plano_do_dia(uuid, date)
  from public, anon, authenticated;

-- ── Ajustes do aluno ────────────────────────────────────────────────────────

create or replace function public.reordenar_plano_do_dia(
  p_plano_id uuid,
  p_nivel    public.plano_nivel default null,
  p_ordens   uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_total integer;
begin
  if v_user_id is null then
    raise exception 'usuario_ausente: a ordenacao exige uma sessao autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.plano_dia p
     where p.id = p_plano_id and p.user_id = v_user_id
  ) then
    raise exception 'plano_alheio: o plano nao pertence ao aluno'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*)::integer into v_total
    from public.plano_bloco b
   where b.plano_dia_id = p_plano_id
     and (p_nivel is null or b.nivel = p_nivel)
     and not exists (
       select 1 from public.sessoes s
        where s.plano_bloco_id = b.id and s.encerrada_em is not null
     );

  if cardinality(coalesce(p_ordens, '{}'::uuid[])) <> v_total
     or cardinality(coalesce(p_ordens, '{}'::uuid[]))
        <> cardinality(array(select distinct x from unnest(coalesce(p_ordens, '{}'::uuid[])) x)) then
    raise exception 'permutacao_invalida: a lista precisa conter todos os blocos pendentes uma unica vez'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
      from unnest(coalesce(p_ordens, '{}'::uuid[])) x
      left join public.plano_bloco b
        on b.id = x and b.plano_dia_id = p_plano_id
       and (p_nivel is null or b.nivel = p_nivel)
     where b.id is null
  )
  or exists (
    select 1
      from public.plano_bloco b
     where b.plano_dia_id = p_plano_id
       and (p_nivel is null or b.nivel = p_nivel)
       and not exists (select 1 from unnest(coalesce(p_ordens, '{}'::uuid[])) x where x = b.id)
       and not exists (
         select 1 from public.sessoes s
          where s.plano_bloco_id = b.id and s.encerrada_em is not null
       )
  )
  or exists (
    select 1
      from unnest(coalesce(p_ordens, '{}'::uuid[])) x
      join public.plano_bloco b on b.id = x
      where exists (
        select 1 from public.sessoes s
         where s.plano_bloco_id = b.id and s.encerrada_em is not null
      )
  ) then
    raise exception 'permutacao_invalida: bloco alheio, concluido ou lista parcial'
      using errcode = 'check_violation';
  end if;

  -- Primeiro tira todas as linhas da faixa normal; depois atribui a posição da
  -- lista. A operação inteira é uma transação única dentro da RPC.
  -- Linhas concluídas também sobem temporariamente: caso contrário, uma
  -- permutação de pendentes poderia colidir com a ordem antiga de uma linha já
  -- encerrada. Elas ficam preservadas no histórico, mas fora da faixa normal
  -- da lista que está sendo reordenada.
  update public.plano_bloco b
     set ordem = b.ordem + 200000
   where b.plano_dia_id = p_plano_id
     and (p_nivel is null or b.nivel = p_nivel);

  with novas_ordens as (
    select x.id, row_number() over (partition by b.nivel order by x.posicao)::integer as ordem
      from unnest(coalesce(p_ordens, '{}'::uuid[])) with ordinality x(id, posicao)
      join public.plano_bloco b on b.id = x.id
  )
  update public.plano_bloco b
     set ordem = 100000 + n.ordem,
         ajuste_usuario = true
    from novas_ordens n
   where b.id = n.id;

  with novas_ordens as (
    select b.id, row_number() over (partition by b.nivel order by b.ordem)::integer as ordem
      from public.plano_bloco b
     where b.plano_dia_id = p_plano_id
       and (p_nivel is null or b.nivel = p_nivel)
       and b.ordem >= 100000
  )
  update public.plano_bloco b
     set ordem = n.ordem
    from novas_ordens n
   where b.id = n.id;
end;
$$;

create or replace function public.reordenar_plano_blocos(
  p_plano_id uuid,
  p_ordens uuid[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.reordenar_plano_do_dia(p_plano_id, null, p_ordens);
$$;

create or replace function public.adiar_plano_bloco(
  p_bloco_id uuid
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_bloco record;
  v_perfil record;
  v_data date;
  v_alvo date;
  v_plano_destino uuid;
  v_dias smallint[];
  v_i integer;
begin
  if v_user_id is null then
    raise exception 'usuario_ausente: o adiamento exige uma sessao autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  select b.*, p.user_id, p.data as data_origem
    into v_bloco
    from public.plano_bloco b
    join public.plano_dia p on p.id = b.plano_dia_id
   where b.id = p_bloco_id and p.user_id = v_user_id;
  if not found then
    raise exception 'bloco_alheio: o bloco nao pertence ao aluno'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.sessoes s
     where s.plano_bloco_id = p_bloco_id and s.encerrada_em is not null
  ) then
    raise exception 'bloco_concluido: bloco concluido nao pode ser adiado'
      using errcode = 'check_violation';
  end if;

  select p.dias_estudo into v_dias
    from public.perfil_estudo p where p.user_id = v_user_id;
  v_data := v_bloco.data_origem;

  for v_i in 1..14 loop
    if v_dias is null or cardinality(v_dias) = 0
       or extract(dow from (v_data + v_i))::smallint = any(v_dias) then
      v_alvo := v_data + v_i;
      exit;
    end if;
  end loop;
  if v_alvo is null then
    raise exception 'agenda_invalida: nao ha proximo dia declarado'
      using errcode = 'check_violation';
  end if;

  insert into public.plano_dia (user_id, data)
  values (v_user_id, v_alvo)
  on conflict (user_id, data) do nothing;

  select p.id into v_plano_destino
    from public.plano_dia p
   where p.user_id = v_user_id and p.data = v_alvo;

  update public.plano_bloco b
     set ordem = b.ordem + 200000
   where b.plano_dia_id = v_plano_destino and b.nivel = v_bloco.nivel;

  update public.plano_bloco
     set plano_dia_id = v_plano_destino,
         ordem = 1,
         ajuste_usuario = true,
         motivo = case when motivo like 'adiado:%' then motivo
                       else 'adiado: ' || coalesce(motivo, 'bloco priorizado') end,
         adiado_de = v_data
   where id = p_bloco_id;

  -- A visita continua sendo o mesmo fato. Só atualizamos a referência ao plano
  -- para que uma sessão retomada não aponte para o dia antigo.
  update public.sessoes
     set plano_dia_id = v_plano_destino
   where plano_bloco_id = p_bloco_id;

  return v_alvo;
end;
$$;

create or replace function public.encurtar_plano_bloco(
  p_bloco_id uuid
)
returns table (n_questoes integer, minutos_estimados integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_bloco record;
  v_f_q numeric;
  v_f_m numeric;
begin
  if v_user_id is null then
    raise exception 'usuario_ausente: a versao curta exige uma sessao autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  select b.* into v_bloco
    from public.plano_bloco b
    join public.plano_dia p on p.id = b.plano_dia_id
   where b.id = p_bloco_id and p.user_id = v_user_id;
  if not found then
    raise exception 'bloco_alheio: o bloco nao pertence ao aluno'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.sessoes s
     where s.plano_bloco_id = p_bloco_id and s.encerrada_em is not null
  ) then
    raise exception 'bloco_concluido: bloco concluido nao pode ser encurtado'
      using errcode = 'check_violation';
  end if;

  select coalesce((select case when jsonb_typeof(valor) = 'number'
                                and (valor #>> '{}') ~ '^0([.]0*[1-9][0-9]*)?$|^0([.][0-9]+)?$|^1([.]0+)?$'
                               then (valor #>> '{}')::numeric end
                     from public.configuracoes_vigentes
                    where chave = 'param.m4.fracao_questoes_versao_curta'), 0.5),
         coalesce((select case when jsonb_typeof(valor) = 'number'
                                and (valor #>> '{}') ~ '^0([.]0*[1-9][0-9]*)?$|^0([.][0-9]+)?$|^1([.]0+)?$'
                               then (valor #>> '{}')::numeric end
                     from public.configuracoes_vigentes
                    where chave = 'param.m4.fracao_minutos_versao_curta'), 0.5)
    into v_f_q, v_f_m;

  update public.plano_bloco b
     set n_questoes = greatest(1, ceil(b.n_questoes_cheias * v_f_q)::integer),
         minutos_estimados = greatest(1, ceil(b.minutos_estimados_cheios * v_f_m)::integer),
         ajuste_usuario = true
   where b.id = p_bloco_id
  returning b.n_questoes, b.minutos_estimados into n_questoes, minutos_estimados;

  return next;
end;
$$;

revoke all on function public.reordenar_plano_do_dia(uuid, public.plano_nivel, uuid[])
  from public, anon;
revoke all on function public.reordenar_plano_blocos(uuid, uuid[])
  from public, anon;
revoke all on function public.adiar_plano_bloco(uuid)
  from public, anon;
revoke all on function public.encurtar_plano_bloco(uuid)
  from public, anon;

grant execute on function public.reordenar_plano_do_dia(uuid, public.plano_nivel, uuid[])
  to authenticated;
grant execute on function public.reordenar_plano_blocos(uuid, uuid[])
  to authenticated;
grant execute on function public.adiar_plano_bloco(uuid)
  to authenticated;
grant execute on function public.encurtar_plano_bloco(uuid)
  to authenticated;

comment on column public.plano_bloco.n_questoes is
  'Quantidade vigente de questões do bloco. Pode ser reduzida uma vez pela versão curta; a base cheia fica em n_questoes_cheias.';
comment on column public.plano_bloco.n_questoes_cheias is
  'Quantidade da versão cheia gerada pelo motor. Evita redução cumulativa quando a versão curta é escolhida novamente.';
comment on column public.plano_bloco.ajuste_usuario is
  'Marca que o aluno reordenou, adiou ou escolheu a versão curta. O motor preserva o bloco em uma regeneração idempotente.';
comment on column public.plano_bloco.adiado_de is
  'Data de origem de um bloco pendente adiado para o próximo dia declarado.';
