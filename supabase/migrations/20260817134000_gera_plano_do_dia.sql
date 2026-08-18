-- ALUNO-07 · ALUNO-08 · ALUNO-11 · ALUNO-05 (retrato frio) · AD-018 · AD-044
--
-- O motor de prioridade. **Nenhuma chamada de IA aqui, e isso e o invariante
-- nº6**: a IA escreve a frase de abertura (SPEC 08) e nada mais. O que o aluno
-- estuda sai de uma conta que qualquer pessoa pode conferir a mao.
--
--     nota = peso_raiox x fraqueza x devendo_revisao
--
--   peso_raiox      — da view `raiox_peso_topico`. 1.0 ate a SPEC 11 entrar.
--   fraqueza        — `1 - dominio_topico.score`. Sem linha na projecao, vem da
--                     semente do `nivel_declarado` (`param.m4.fraqueza_por_nivel`),
--                     que e o que faz o plano do 1o dia existir (ALUNO-05 AC1).
--   devendo_revisao — `param.m4.peso_devendo_revisao` quando `due <= hoje`,
--                     senao 1.0.
--
-- Os dois niveis (ALUNO-11):
--   `piso`       -> **so** os blocos Revisar dos topicos vencidos. E o minimo que
--                   mantem a sequencia. Aluno sem revisao vencida tem piso vazio,
--                   e isso e correto, nao defeito.
--   `meta_cheia` -> os mesmos Revisar, mais Avancar e Treinar, somando
--                   `minutos_estimados` ate caber em `minutos_por_dia`.
--
-- Idempotencia: `unique (user_id, data)` mais o `delete` dos blocos. Rerodar no
-- mesmo dia **substitui** o plano.

create or replace function public.gera_plano_do_dia(
  p_user_id uuid  default null,
  p_data    date  default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data              date;
  v_peso_revisao      numeric;
  v_questoes_bloco    integer;
  v_minutos_questao   numeric;
  v_minutos_bloco     integer;
  v_fraqueza_nivel    jsonb;
  v_simulado_ligado   boolean;
  v_aluno             record;
  v_topico            record;
  v_plano_id          uuid;
  v_ordem_piso        integer;
  v_ordem_meta        integer;
  v_minutos_gastos    integer;
  v_planos            integer := 0;
  v_avancou           boolean;
begin
  if not pg_try_advisory_xact_lock(8406, 2) then
    return -1;
  end if;

  v_data := coalesce(p_data, current_date);

  -- Configuracao lida **uma vez**, fora do laco (INFRA-11/AD-078). Valor
  -- ilegivel cai no default declarado no catalogo — o job nunca para por causa
  -- de configuracao faltando.
  select
    coalesce((select valor #>> '{}' from public.configuracoes_vigentes
               where chave = 'param.m4.peso_devendo_revisao'), '1.5')::numeric,
    coalesce((select valor #>> '{}' from public.configuracoes_vigentes
               where chave = 'param.m4.questoes_por_bloco'), '10')::integer,
    coalesce((select valor #>> '{}' from public.configuracoes_vigentes
               where chave = 'param.m4.minutos_por_questao'), '2')::numeric,
    coalesce((select valor from public.configuracoes_vigentes
               where chave = 'param.m4.fraqueza_por_nivel'),
             '{"iniciante":0.9,"intermediario":0.6,"avancado":0.35}'::jsonb),
    coalesce((select valor #>> '{}' from public.configuracoes_vigentes
               where chave = 'flag.m4.simulado_semanal'), 'false')::boolean
    into v_peso_revisao, v_questoes_bloco, v_minutos_questao,
         v_fraqueza_nivel, v_simulado_ligado;

  v_minutos_bloco := greatest(ceil(v_questoes_bloco * v_minutos_questao)::integer, 1);

  -- Aluno ativo = aluno com perfil. Sem `minutos_por_dia` declarado nao ha corte
  -- por tempo, e o plano nao teria como caber em lugar nenhum.
  for v_aluno in
    select p.user_id, p.minutos_por_dia, p.nivel_declarado
      from public.perfil_estudo p
     where p_user_id is null or p.user_id = p_user_id
  loop
    -- Substitui, nao duplica (idempotencia do ALUNO-07). O `frase = null` e
    -- deliberado: plano novo, frase velha nao vale — a SPEC 08 reescreve.
    insert into public.plano_dia (user_id, data, gerado_em)
    values (v_aluno.user_id, v_data, now())
    on conflict (user_id, data) do update
      set gerado_em = now(), frase = null
    returning id into v_plano_id;

    delete from public.plano_bloco b where b.plano_dia_id = v_plano_id;

    v_ordem_piso     := 0;
    v_ordem_meta     := 0;
    v_minutos_gastos := 0;
    v_avancou        := false;

    for v_topico in
      select
        t.id as topico_id,
        (r.due is not null and r.due <= v_data) as devendo_revisao,
        rx.peso
          * (1 - coalesce(d.score, (v_fraqueza_nivel ->> coalesce(v_aluno.nivel_declarado, 'iniciante'))::numeric))
          * (case when r.due is not null and r.due <= v_data then v_peso_revisao else 1 end)
          as nota
        from public.topicos t
        join public.raiox_peso_topico rx on rx.topico_id = t.id
        left join public.dominio_topico d
          on d.user_id = v_aluno.user_id and d.topico_id = t.id
        left join public.revisao_agenda r
          on r.user_id = v_aluno.user_id and r.topico_id = t.id
       where t.ativo
         -- Edge case do acervo frio: topico sem questao publicada nao vira
         -- bloco. Alocar treino onde nao ha questao daria uma tela vazia ao
         -- aluno, e o motor simplesmente pega o proximo de maior nota.
         and exists (
           select 1 from public.questoes q
            where q.topico_id = t.id
              and q.status = 'publicada'
              and q.vigente
              and not q.anulada
         )
       order by nota desc, t.id
    loop
      if v_topico.devendo_revisao then
        -- Revisar entra nos DOIS niveis. E a unica coisa que entra no piso, e e
        -- o que a frase do `motivo` explica ao aluno (ALUNO-08 AC5).
        v_ordem_piso := v_ordem_piso + 1;
        insert into public.plano_bloco
          (plano_dia_id, tipo, nivel, ordem, topico_id, minutos_estimados, motivo)
        values
          (v_plano_id, 'revisar', 'piso', v_ordem_piso, v_topico.topico_id, v_minutos_bloco,
           'revisar hoje = nao perder o que voce ja conquistou');

        v_ordem_meta := v_ordem_meta + 1;
        insert into public.plano_bloco
          (plano_dia_id, tipo, nivel, ordem, topico_id, minutos_estimados, motivo)
        values
          (v_plano_id, 'revisar', 'meta_cheia', v_ordem_meta, v_topico.topico_id, v_minutos_bloco,
           'revisar hoje = nao perder o que voce ja conquistou');

        v_minutos_gastos := v_minutos_gastos + v_minutos_bloco;

      elsif v_minutos_gastos + v_minutos_bloco <= v_aluno.minutos_por_dia then
        -- O corte por tempo (ALUNO-07 AC2): so entra o que **cabe**. Um plano
        -- que nao cabe no dia declarado e um plano que o aluno abandona.
        v_ordem_meta := v_ordem_meta + 1;

        if not v_avancou then
          -- Avancar e um so, no topico de maior nota sem revisao vencida: bloco
          -- concentrado, e nao dois assuntos novos no mesmo dia (ALUNO-08 AC3).
          insert into public.plano_bloco
            (plano_dia_id, tipo, nivel, ordem, topico_id, minutos_estimados, motivo)
          values
            (v_plano_id, 'avancar', 'meta_cheia', v_ordem_meta, v_topico.topico_id, v_minutos_bloco,
             'seu ponto mais fraco entre os que mais caem');
          v_avancou := true;
        else
          insert into public.plano_bloco
            (plano_dia_id, tipo, nivel, ordem, topico_id, minutos_estimados, motivo)
          values
            (v_plano_id, 'treinar', 'meta_cheia', v_ordem_meta, v_topico.topico_id, v_minutos_bloco,
             'treino misturado para o assunto nao vir com a resposta pronta');
        end if;

        v_minutos_gastos := v_minutos_gastos + v_minutos_bloco;
      end if;
    end loop;

    -- P3, atras de flag desligada (SPEC 32). O `if` existe para deixar o lugar
    -- marcado: ligar o simulado nao pode virar reescrita do motor.
    if v_simulado_ligado then
      v_ordem_meta := v_ordem_meta + 1;
      insert into public.plano_bloco
        (plano_dia_id, tipo, nivel, ordem, minutos_estimados, motivo)
      values
        (v_plano_id, 'simulado', 'meta_cheia', v_ordem_meta, v_minutos_bloco,
         'simulado da semana');
    end if;

    v_planos := v_planos + 1;
  end loop;

  return v_planos;
end;
$$;

comment on function public.gera_plano_do_dia(uuid, date) is
  'Motor de prioridade do plano diario (ALUNO-07/ALUNO-08/ALUNO-11). Regra/SQL pura: nenhuma chamada de IA, que e o invariante nº6. Emite `piso` (so as revisoes devidas) e `meta_cheia` (o dia inteiro cabendo em minutos_por_dia). Idempotente: rerodar no mesmo dia substitui. Devolve quantos planos gerou, ou -1 quando outra execucao detem o lock.';

revoke all on function public.gera_plano_do_dia(uuid, date) from public, anon, authenticated;
