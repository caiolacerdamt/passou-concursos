-- ALUNO-02 AC1/AC3/AC4 · ALUNO-06 · ALUNO-10 AC1 · AD-015 · AD-044
--
-- O Independent Test da story do ALUNO-02, em forma de funcao: **apagar as duas
-- projecoes, rodar isto e obter os mesmos numeros**. Se um dia esta funcao
-- precisar de qualquer coisa que nao esteja em `tentativas`, a aposta
-- fundacional (AD-015) ja terá sido quebrada em outro lugar.
--
-- Tres decisoes de forma, e cada uma responde a um AC:
--
-- (1) **Apaga e reconstroi, sem `on conflict`.** Um `upsert` acumularia sobre o
--     numero anterior; o AC1 pede reconstrucao, nao incremento. Como plpgsql e
--     atomico, o `delete` + `insert` inteiro ou acontece ou nao acontece —
--     falhar no meio deixa a projecao **defasada, nao corrompida** (AC4). Nao ha
--     tratamento de erro nenhum aqui de proposito: qualquer `exception` faz
--     rollback e o job aparece em `public.jobs_falhados` (SPEC 03).
--
-- (2) **`pg_try_advisory_xact_lock`, nao `pg_advisory_lock`.** A versao
--     bloqueante enfileiraria a segunda execucao, e duas madrugadas empilhadas
--     e exatamente o que o edge case do M9 quer evitar. A tentativa devolve
--     falso na hora e a funcao sai com `-1`: sem erro, sem trabalho repetido.
--     `xact` no nome importa — o lock cai sozinho no fim da transacao, mesmo se
--     a funcao estourar.
--
-- (3) **`p_user_id` opcional.** Nulo = todo mundo (e o que o pg_cron chama).
--     Preenchido = so aquele aluno, que e como a SPEC 13 vai recalcular depois
--     de uma sessao sem esperar a madrugada.

create or replace function public.recalcula_projecoes(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linhas integer := 0;
begin
  -- 8406 e um numero arbitrario e fixo: o que importa e nenhum outro job do
  -- projeto usar o mesmo. O par (classe, chave) e o identificador do lock.
  if not pg_try_advisory_xact_lock(8406, 1) then
    return -1;
  end if;

  -- ── dominio_topico ────────────────────────────────────────────────────────
  --
  -- Duas exclusoes, as duas do AC3:
  --   `q.anulada` — questao anulada nao mede nada. A tentativa continua no log
  --       (o fato aconteceu), mas nao entra na projecao.
  --   `marcou_chute and correta` — acerto por sorte nao e maestria. Aqui ele nao
  --       e removido da contagem: e contado a parte (`n_chute_certo`) e
  --       **descontado** do score. A diferenca importa — remover esconderia que
  --       o aluno chuta; descontar mostra.
  --
  -- O join carrega `questao_versao`: a tentativa aponta para a versao que o
  -- aluno respondeu, e e o `anulada` **daquela** versao que vale.

  delete from public.dominio_topico d
   where p_user_id is null or d.user_id = p_user_id;

  insert into public.dominio_topico
    (user_id, topico_id, n_respostas, n_acertos, n_chute_certo, score, atualizado_em)
  select
    t.user_id,
    t.topico_id,
    count(*),
    count(*) filter (where t.correta),
    count(*) filter (where t.correta and t.marcou_chute),
    -- `greatest(..., 0)` porque a subtracao pode zerar mas nunca deve ficar
    -- negativa: um aluno que so acertou chutando tem dominio zero, nao negativo.
    round(
      greatest(
        count(*) filter (where t.correta)
          - count(*) filter (where t.correta and t.marcou_chute),
        0
      )::numeric / count(*),
      4
    ),
    now()
    from public.tentativas t
    join public.questoes q
      on q.id = t.questao_id and q.questao_versao = t.questao_versao
   where not q.anulada
     and (p_user_id is null or t.user_id = p_user_id)
   group by t.user_id, t.topico_id;

  get diagnostics v_linhas = row_count;

  -- ── caderno_erros ─────────────────────────────────────────────────────────
  --
  -- Duas fontes de causa, somadas (ALUNO-10 AC1 + ALUNO-04 AC3):
  --   `tentativas.causa_erro`        — o treino, declarado no proprio INSERT;
  --   `tentativa_causa_simulado`     — o simulado, declarado na revisao
  --                                    pos-prova, em tabela vizinha.
  -- Ler so a primeira deixaria todo erro de simulado fora do caderno, e e o
  -- unico caminho por onde `faltou_tempo` chega aqui.
  --
  -- `causa_erro is not null` na primeira fonte: erro sem causa declarada e
  -- possivel fora do treino (o diagnostico nao pergunta), e nao ha o que agrupar.

  delete from public.caderno_erros c
   where p_user_id is null or c.user_id = p_user_id;

  insert into public.caderno_erros
    (user_id, topico_id, causa_erro, n_erros, ultimo_erro_em, atualizado_em)
  select user_id, topico_id, causa_erro, count(*), max(quando), now()
    from (
      select t.user_id, t.topico_id, t.causa_erro, t.respondida_em as quando
        from public.tentativas t
        join public.questoes q
          on q.id = t.questao_id and q.questao_versao = t.questao_versao
       where not t.correta
         and t.causa_erro is not null
         and not q.anulada
         and (p_user_id is null or t.user_id = p_user_id)

      union all

      select t.user_id, t.topico_id, cs.causa_erro, t.respondida_em
        from public.tentativa_causa_simulado cs
        join public.tentativas t
          on t.id = cs.tentativa_id and t.respondida_em = cs.respondida_em
        join public.questoes q
          on q.id = t.questao_id and q.questao_versao = t.questao_versao
       where not t.correta
         and not q.anulada
         and (p_user_id is null or t.user_id = p_user_id)
    ) as erros
   group by user_id, topico_id, causa_erro;

  return v_linhas;
end;
$$;

comment on function public.recalcula_projecoes(uuid) is
  'Reconstroi `dominio_topico` e `caderno_erros` a partir de `tentativas` (ALUNO-02 AC1). Idempotente: apaga e reconstroi, sem acumular. Devolve o numero de linhas de dominio gravadas, ou -1 quando outra execucao ja detem o lock. Chamada pelo pg_cron as 06:00 UTC.';

-- `security definer` porque o job precisa ler `tentativas` de todos os alunos e
-- escrever nas projecoes, que nao tem policy de escrita. O corpo e fechado: nao
-- recebe nome de objeto, so um `user_id` que entra como parametro de consulta.
-- Executar isto nao pode ser privilegio de quem se autentica pelo navegador — a
-- funcao le o historico do banco inteiro.
revoke all on function public.recalcula_projecoes(uuid) from public, anon, authenticated;
