-- Correcao de tres achados do Verificador independente da SPEC 06 (Ritual B).
-- Relatorio completo em `.specs/features/06-projecoes-revisao-e-plano/tasks.md`.
--
-- ── G1 (Major): `registrar_revisao` nao amarrava o aluno ────────────────────
--
-- A funcao e `security definer` (precisa ser: `revisao_agenda` e `revisao_evento`
-- nao tem policy de escrita) e esta concedida a `authenticated`. Faltava o que a
-- SPEC 05 garante em `registrar_tentativa` por outro caminho — la o `p_user_id`
-- e checado contra o dono da sessao.
--
-- Sem isso, medido pelo Verificador no banco de dev: o aluno A gravava agenda e
-- evento **no nome do aluno B**, inclusive uma linha no log append-only, que
-- ninguem apaga depois. Falsificar historico alheio de forma irreversivel e pior
-- que o buraco de leitura que a RLS ja fecha.
--
-- ── G2 (Major): a semente do retrato frio entrava invertida ─────────────────
--
-- `param.m4.fraqueza_por_nivel` **e a fraqueza**, nao o score — o catalogo diz
-- "a fraqueza que vale enquanto o aluno nao tem historico no topico". A versao
-- anterior escrevia `1 - coalesce(d.score, semente)`, o que punha a semente na
-- posicao do score e a invertia: iniciante ficava com fraqueza 0.1 e avancado com
-- 0.65, o contrario do pretendido. Pior, qualquer topico ja tocado ganhava de
-- todo topico virgem, e o aluno novo nunca abria assunto novo.
--
-- O teste de ordenacao nao pegou porque semeava `dominio_topico` nos dois topicos
-- comparados — nunca comparou um topico com historico contra um sem.
--
-- ── G3 (Minor): o comentario da coluna contradizia o motor ──────────────────

create or replace function public.registrar_revisao(
  p_user_id     uuid,
  p_topico_id   uuid,
  p_algoritmo   text,
  p_due         date,
  p_nota        smallint,
  p_percentual  numeric,
  p_fsrs_card   jsonb    default null,
  p_regua_passo smallint default 0
)
returns table (due date, algoritmo text, regua_passo smallint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Amarra o titular: quem chama pelo navegador tem `auth.uid()`; o job e o
  -- script rodam sem sessao (`null`) e continuam podendo agendar por qualquer
  -- aluno, que e o caminho legitimo.
  if (select auth.uid()) is not null and (select auth.uid()) <> p_user_id then
    raise exception
      'aluno_alheio: a revisao so pode ser registrada no nome de quem esta autenticado'
      using errcode = 'insufficient_privilege';
  end if;

  if p_algoritmo not in ('fsrs', 'regua_fixa') then
    raise exception 'algoritmo_desconhecido: %', p_algoritmo using errcode = 'check_violation';
  end if;

  insert into public.revisao_evento
    (user_id, topico_id, algoritmo, nota, percentual)
  values
    (p_user_id, p_topico_id, p_algoritmo, p_nota, p_percentual);

  return query
    insert into public.revisao_agenda as a
      (user_id, topico_id, algoritmo, fsrs_card, regua_passo, due, ultima_nota, atualizado_em)
    values
      (p_user_id, p_topico_id, p_algoritmo, p_fsrs_card, p_regua_passo, p_due, p_nota, now())
    on conflict (user_id, topico_id) do update
      set algoritmo     = excluded.algoritmo,
          -- O `Card` do FSRS e preservado quando quem escreveu foi a regua
          -- fixa: se o aluno voltar para o FSRS depois, a memoria acumulada
          -- ainda esta la e o intervalo nao recomeca do zero.
          fsrs_card     = coalesce(excluded.fsrs_card, a.fsrs_card),
          regua_passo   = excluded.regua_passo,
          due           = excluded.due,
          ultima_nota   = excluded.ultima_nota,
          atualizado_em = now()
    returning a.due, a.algoritmo, a.regua_passo;
end;
$$;


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
          -- `coalesce(1 - score, semente)`, e nao `1 - coalesce(score, semente)`:
          -- a semente ja E a fraqueza (achado G2 do Verificador).
          * coalesce(
              1 - d.score,
              (v_fraqueza_nivel ->> coalesce(v_aluno.nivel_declarado, 'iniciante'))::numeric
            )
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

comment on function public.registrar_revisao is
  'Grava o resultado de um bloco Revisar (ALUNO-09). Upsert na agenda e insert no evento numa transacao so. Recebe `due` ja calculado: nao sabe qual algoritmo o produziu (AC3). `security definer` com a amarra `auth.uid() = p_user_id` — sem ela um aluno gravaria no log append-only de outro (G1).';

revoke all on function public.registrar_revisao from public, anon;
grant execute on function public.registrar_revisao to authenticated, service_role;

-- O comentario dizia "nulo no bloco `treinar`" e o motor grava o topico. Quem
-- manda e o motor: cada bloco Treinar nomeia um topico, e a intercalacao de
-- assuntos que o ALUNO-08 AC3 pede acontece **entre** os blocos do dia, nao
-- dentro de um bloco sem dono.
comment on column public.plano_bloco.topico_id is
  'De qual topico e o bloco. Nulo no `simulado`, que atravessa a prova inteira. Em `treinar` o topico e preenchido: a intercalacao do ALUNO-08 AC3 acontece entre os blocos do dia.';
