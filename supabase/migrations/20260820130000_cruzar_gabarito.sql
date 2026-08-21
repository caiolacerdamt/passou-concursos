-- BANCO-04 (AC1, AC2, AC3) · BANCO-13 · AD-039 · AD-042
--
-- O cruzamento do gabarito definitivo. Tres coisas acontecem aqui, e o motivo de
-- estarem no banco e o mesmo para as tres: **a retificacao e uma transacao**.
--
--   1. Questao sem gabarito ganha `resposta_correta` e `gabarito_versao` (AC1).
--   2. Gabarito que anula marca `anulada = true` e **mantem a questao** (AC2) —
--      ela continua contando na frequencia do Raio-X, porque a banca cobrou o
--      assunto, e nao vira treino, porque nao ha resposta certa a treinar.
--   3. Gabarito **diferente** do que ja estava gravado nao reescreve nada: nasce
--      uma `questao_versao` nova (AC3). A tentativa que um aluno ja fez continua
--      apontando para a versao que ele respondeu — e o invariante nº1 e nº2.
--
-- Feito em TypeScript, o item 3 seriam quatro idas ao banco por questao, com uma
-- janela entre elas em que a questao nao teria versao vigente nenhuma.
--
-- **Idempotente** (edge case do M1): rodar o mesmo arquivo duas vezes nao cria
-- versao nova, e gabarito que chega antes da extracao nao quebra — ele conta as
-- questoes que ainda nao existem e espera.

create or replace function public.cruzar_gabarito(
  p_prova   uuid,
  p_itens   jsonb,
  p_versao  text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_item       jsonb;
  v_numero     integer;
  v_resposta   text;
  v_anulada    boolean;
  v_atual      public.questoes%rowtype;
  r_preenchidas integer := 0;
  r_inalteradas integer := 0;
  r_versionadas integer := 0;
  r_anuladas    integer := 0;
  r_sem_questao integer := 0;
begin
  if p_versao is null or btrim(p_versao) = '' then
    raise exception 'cruzar_gabarito exige gabarito_versao: e ela que distingue o preliminar do definitivo (BANCO-04 AC1)';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then
    raise exception 'cruzar_gabarito espera um array de itens';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_numero   := (v_item ->> 'numero')::integer;
    v_resposta := v_item ->> 'resposta';
    v_anulada  := coalesce((v_item ->> 'anulada')::boolean, false);

    -- A versao **vigente** e a unica que se cruza. As antigas estao congeladas
    -- pelo gatilho da SPEC 04, e e assim que elas ficam.
    select * into v_atual
      from public.questoes as q
     where q.prova_id = p_prova and q.numero = v_numero and q.vigente;

    if not found then
      -- O gabarito chegou antes da extracao terminar. Nao e erro: o cruzamento
      -- e retomavel e roda de novo quando as questoes existirem (AD-036).
      r_sem_questao := r_sem_questao + 1;
      continue;
    end if;

    if v_atual.resposta_correta is null and v_atual.gabarito_versao is null then
      update public.questoes
         set resposta_correta = v_resposta,
             gabarito_versao  = p_versao,
             anulada          = v_anulada
       where id = v_atual.id and questao_versao = v_atual.questao_versao;

      r_preenchidas := r_preenchidas + 1;
      if v_anulada then r_anuladas := r_anuladas + 1; end if;
      continue;
    end if;

    if v_atual.resposta_correta is not distinct from v_resposta
       and v_atual.anulada = v_anulada then
      -- Mesmo conteudo. Se so o rotulo da versao mudou (preliminar -> definitivo
      -- com a mesma letra), carimba o rotulo: e mudanca **cosmetica**, e o
      -- BANCO-13 nao pede versao nova para cosmetica.
      if v_atual.gabarito_versao is distinct from p_versao then
        update public.questoes
           set gabarito_versao = p_versao
         where id = v_atual.id and questao_versao = v_atual.questao_versao;
      end if;

      r_inalteradas := r_inalteradas + 1;
      if v_anulada then r_anuladas := r_anuladas + 1; end if;
      continue;
    end if;

    -- Retificacao (AC3). Versao nova e **linha nova**: o INSERT dispara o
    -- gatilho `questoes_versiona`, que numera a versao e apaga o selo de
    -- vigente da anterior. `questao_versao` vai como 1 de proposito — o valor
    -- que o chamador passa e ignorado, e quem numera e o banco.
    insert into public.questoes (
      id, questao_versao, vigente,
      prova_id, numero, origem, fonte_citacao,
      topico_id, tipo_questao, enunciado, alternativas, imagens,
      resposta_correta, gabarito_versao, anulada,
      status, dificuldade, confianca_ia,
      mudanca_tipo, mudanca_motivo
    ) values (
      v_atual.id, 1, true,
      v_atual.prova_id, v_atual.numero, v_atual.origem, v_atual.fonte_citacao,
      v_atual.topico_id, v_atual.tipo_questao, v_atual.enunciado,
      v_atual.alternativas, v_atual.imagens,
      v_resposta, p_versao, v_anulada,
      v_atual.status, v_atual.dificuldade, v_atual.confianca_ia,
      -- Gabarito e o que a questao ensina: mudar a alternativa correta e
      -- sempre **substantivo**, e e o que faz a SPEC 10 regerar a explicacao
      -- (IA-09 AC4 / AD-052). A classificacao nasce junto da versao e SHALL NOT
      -- ser inferida depois pela IA.
      'substantiva',
      format(
        'retificacao de gabarito %s -> %s (versao %s)',
        coalesce(v_atual.resposta_correta, 'sem resposta'),
        coalesce(v_resposta, 'sem resposta'),
        p_versao
      )
    );

    r_versionadas := r_versionadas + 1;
    if v_anulada then r_anuladas := r_anuladas + 1; end if;
  end loop;

  return jsonb_build_object(
    'preenchidas', r_preenchidas,
    'inalteradas', r_inalteradas,
    'versionadas', r_versionadas,
    'anuladas',    r_anuladas,
    'sem_questao', r_sem_questao
  );
end;
$$;

comment on function public.cruzar_gabarito(uuid, jsonb, text) is
  'BANCO-04. Preenche resposta_correta/gabarito_versao, marca anuladas, e transforma retificacao em questao_versao nova (AC3). Idempotente: rodar duas vezes o mesmo arquivo nao versiona nada.';

-- `security invoker` e sem `grant`: quem cruza gabarito e o operador pelo job,
-- com a chave de servico. Aluno nao tem o que fazer aqui, e funcao concedida sem
-- necessidade e superficie aberta de graca (licao 11 do STATE.md).
revoke all on function public.cruzar_gabarito(uuid, jsonb, text) from anon, authenticated;
