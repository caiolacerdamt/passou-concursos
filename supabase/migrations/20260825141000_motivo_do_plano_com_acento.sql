-- ALUNO · corrige os motivos do plano na fonte e nas projeções já materializadas.
-- A função abaixo é a definição vigente de gera_plano_do_dia (20260824102000),
-- copiada sem alterações de lógica; somente os quatro literais sem acento foram
-- corrigidos. 'adiado:' e 'bloco priorizado' em adiar_plano_bloco não precisam
-- de acento, portanto essa função não é recriada nesta migration.

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
  v_minutos_disponiveis     integer;
  v_planos                  integer := 0;
  v_pass                    integer;
  v_tem_revisao             boolean;
  v_tem_avanco              boolean;
  v_minimo_avanco           integer;
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

    select coalesce(sum(b.minutos_estimados), 0)::integer
      into v_minutos_gastos
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and b.nivel = 'meta_cheia';

    -- A quantidade de linhas preservadas não representa capacidade: uma
    -- versão curta pode ter 1 questão/1 minuto, e um ajuste antigo pode ter
    -- outro tamanho. A soma dos minutos é a única fonte para não exceder o
    -- limite depois de regenerar.
    v_slots_existentes := 0;

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
    v_minutos_disponiveis := greatest(v_aluno.minutos_por_dia - v_minutos_gastos, 0);
    v_total_slots := greatest(floor(v_minutos_disponiveis / v_minutos_bloco)::integer, 0);
    v_slots_restantes := v_total_slots;

    select exists (
      select 1
        from public.revisao_agenda r
        join public.raiox_peso_topico rx on rx.topico_id = r.topico_id
       where r.user_id = v_aluno.user_id
         and r.due <= v_data
    ) into v_tem_revisao;

    -- Reserve um slot para conteúdo novo sempre que houver algo elegível para
    -- Avançar. A fila de revisão continua priorizada e limitada, mas não pode
    -- consumir o único slot de um dia que ainda consegue avançar o edital.
    select exists (
      select 1
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
         and t.id <> all(v_usados_topicos)
         and not (r.due is not null and r.due <= v_data)
         and (
           coalesce(d.n_respostas, 0) = 0
           or coalesce(semana.n_blocos, 0) < v_teto_semanal
           or ultima.ultima_data is null
           or v_data - ultima.ultima_data >= v_janela_maxima
         )
         and exists (
           select 1 from public.questoes q
            where q.topico_id = t.id
              and q.status = 'publicada'
              and q.vigente
              and not q.anulada
         )
    ) into v_tem_avanco;

    v_minimo_avanco := case when v_tem_avanco and v_slots_restantes > 0 then 1 else 0 end;

    v_review_slots := least(
      greatest(v_slots_restantes - v_minimo_avanco, 0),
      v_teto_revisoes,
      greatest(floor(v_aluno.minutos_por_dia * v_pct_revisar / v_minutos_bloco)::integer, 0)
    );
    -- Uma capacidade menor que um bloco ainda reserva uma revisão quando há
    -- espaço para um bloco inteiro; nunca estoura o teto diário.
    if v_tem_revisao and v_review_slots = 0
       and v_slots_restantes - v_minimo_avanco > 0
       and v_pct_revisar > 0 then
      v_review_slots := 1;
    end if;
    v_slots_restantes := greatest(v_slots_restantes - v_review_slots, 0);

    v_advance_slots := least(
      v_slots_restantes,
      greatest(floor(v_aluno.minutos_por_dia * v_pct_avancar / v_minutos_bloco)::integer, 0)
    );
    if v_tem_avanco and v_advance_slots = 0 and v_slots_restantes > 0 then
      v_advance_slots := 1;
    end if;
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
         'revisar hoje = não perder o que você já conquistou');

      v_ordem_meta := v_ordem_meta + 1;
      insert into public.plano_bloco
        (plano_dia_id, tipo, nivel, ordem, topico_id, n_questoes,
         n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo)
      values
        (v_plano_id, 'revisar', 'meta_cheia', v_ordem_meta, v_topico.topico_id,
         v_questoes_bloco, v_questoes_bloco, v_minutos_bloco, v_minutos_bloco,
         'revisar hoje = não perder o que você já conquistou');

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
        -- Dentro da mesma matéria, uma lacuna de cobertura vence a fraqueza
        -- recorrente. Entre matérias a rotação/nota continua decidindo, o que
        -- preserva o retrato frio de níveis diferentes.
        if v_topico.n_respostas > 0 and exists (
          select 1
            from public.topicos virgem
            left join public.dominio_topico dominio_virgem
              on dominio_virgem.user_id = v_aluno.user_id
             and dominio_virgem.topico_id = virgem.id
            left join public.revisao_agenda revisao_virgem
              on revisao_virgem.user_id = v_aluno.user_id
             and revisao_virgem.topico_id = virgem.id
           where virgem.materia_id = v_topico.materia_id
             and (dominio_virgem.n_respostas is null or dominio_virgem.n_respostas = 0)
             and not (revisao_virgem.due is not null and revisao_virgem.due <= v_data)
             and virgem.id <> all(v_usados_topicos)
             and not (
               v_pass = 0
               and exists (
                 select 1
                   from public.tentativas tentativa_virgem
                  where tentativa_virgem.user_id = v_aluno.user_id
                    and tentativa_virgem.materia_id = virgem.materia_id
                    and v_data - (tentativa_virgem.respondida_em at time zone 'America/Sao_Paulo')::date
                        <= v_cooldown_dias
               )
             )
             and exists (
               select 1 from public.questoes q
                where q.topico_id = virgem.id
                  and q.status = 'publicada'
                  and q.vigente
                  and not q.anulada
             )
        ) then
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
          v_motivo := 'janela máxima sem tocar matéria relevante';
        elsif v_topico.score is not null and v_topico.score <= 0.5 then
          v_motivo := 'seu ponto mais fraco entre os que mais caem';
        else
          v_motivo := 'rotação do edital';
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
        -- Conteúdo virgem é avanço. Treinar só consolida algo que o aluno já
        -- tocou, evitando que o rótulo da prática esconda cobertura faltante.
        if v_topico.n_respostas = 0 then
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
          v_motivo := 'janela máxima sem tocar matéria relevante';
        elsif v_topico.em_cooldown then
          v_motivo := 'rotação do edital';
        else
          v_motivo := 'prática distribuída no ciclo';
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

        if v_topico.n_respostas = 0 then
          v_tipo_extra := 'avancar';
          v_motivo := 'cobertura do edital';
          v_selecionados_avanco := v_selecionados_avanco + 1;
        elsif v_selecionados_pratica <= v_selecionados_avanco then
          v_tipo_extra := 'treinar';
          v_motivo := 'prática distribuída no ciclo';
          v_selecionados_pratica := v_selecionados_pratica + 1;
        else
          v_tipo_extra := 'avancar';
          v_motivo := 'rotação do edital';
          v_selecionados_avanco := v_selecionados_avanco + 1;
        end if;

        if v_topico.n_respostas = 0 then
          v_motivo := 'cobertura do edital';
        elsif v_topico.ultima_data is null
           or v_data - v_topico.ultima_data >= v_janela_maxima then
          v_motivo := 'janela máxima sem tocar matéria relevante';
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

-- Corrige linhas existentes, inclusive motivos já prefixados por 'adiado:'.
update public.plano_bloco
   set motivo = replace(
                 replace(
                   replace(
                     replace(motivo,
                       'revisar hoje = nao perder o que voce ja conquistou',
                       'revisar hoje = não perder o que você já conquistou'),
                     'janela maxima sem tocar materia relevante',
                     'janela máxima sem tocar matéria relevante'),
                   'rotacao do edital',
                   'rotação do edital'),
                 'pratica distribuida no ciclo',
                 'prática distribuída no ciclo')
 where motivo like '%revisar hoje = nao perder o que voce ja conquistou%'
    or motivo like '%janela maxima sem tocar materia relevante%'
    or motivo like '%rotacao do edital%'
    or motivo like '%pratica distribuida no ciclo%';
