-- A folga de tres meses passa a ser incondicional (INFRA-04 AC3 · AD-067 · AD-123)
--
-- Sintoma: em 2026-09-01 o teste `tentativas-particao.test.ts` reprovou pedindo
-- `tentativas_p20261201`. O conjunto de particoes estava exatamente como o
-- `create_parent` de 2026-08-17 o deixou — 202605..202611 mais a `default` — e
-- nao tinha avancado um mes sequer em quinze dias.
--
-- **Nao e o job.** O log do Postgres mostra o job 7 rodando as 05:17 UTC e
-- terminando limpo (`COMMAND completed: CALL`); `automatic_maintenance` esta
-- `on`, `premake` esta 3. A correcao de 2026-08-22, que separou o
-- `run_maintenance_proc()` do endurecimento em dois jobs, funcionou: nao ha mais
-- `invalid transaction termination`. O job roda, tem sucesso, e nao cria nada.
--
-- A causa e `infinite_time_partitions = false`, que e o default do partman e o
-- que o `create_parent` gravou. A doc do pg_partman descreve o parametro como o
-- que "permite a criacao de particoes vazias mesmo quando nenhum dado novo e
-- inserido, sobrepondo o comportamento padrao, desenhado para evitar criacao
-- excessiva de tabelas vazias". Ou seja: **com `false`, a criacao de particao
-- futura anda a reboque do dado que chega**, e nao do calendario. Num banco de
-- desenvolvimento, onde quase todo teste roda em transacao revertida, o dado
-- efetivamente nao chega e o partman para de andar.
--
-- Por que isso e bug e nao peculiaridade do ambiente de desenvolvimento: o
-- INFRA-04 AC3 pede tres meses futuros **ja criados**, e o comentario da
-- migracao original diz para que serve a folga — "transformar 'a manutencao nao
-- rodou' num alerta em vez de um INSERT perdido". Com `false` essa garantia e
-- condicional ao fluxo de INSERT, e o modo de falha e o pior possivel: silencioso
-- de ponta a ponta. A `public.jobs_falhados` (SPEC 03) vigia job que **falha**;
-- este tem sucesso. Qualquer periodo quieto — o pre-lancamento, um feriado, uma
-- queda de algumas horas na virada do mes — consome a folga sem acender nada, e
-- quem descobre e o aluno cuja resposta o Postgres recusa por nao ter particao.
--
-- O preco de `true` e ~12 tabelas vazias por ano. Pelo AD-067 particao nunca e
-- dropada, entao nao ha interacao com retencao, e o custo e desprezivel perto de
-- perder um INSERT em `tentativas` — que, pelo invariante 1, nao tem reenvio: a
-- resposta do aluno ou entra na hora ou nao existe.
update partman.part_config
   set infinite_time_partitions = true
 where parent_table = 'public.tentativas';

-- Recupera o atraso agora, sem esperar as 05:17 de amanha.
--
-- `run_maintenance` (funcao), nao `run_maintenance_proc` (procedimento): o
-- procedimento faz COMMIT no proprio corpo e nao sobrevive dentro da transacao
-- da migracao — e exatamente o `invalid transaction termination` que a migracao
-- `20260822190000` diagnosticou no job. A funcao nao commita e por isso pode ser
-- chamada aqui.
select partman.run_maintenance(
  p_parent_table := 'public.tentativas',
  p_jobmon       := false
);

-- AD-091: particao recem-criada nasce sem RLS, sem o gatilho de TRUNCATE e com
-- os privilegios que o `alter default privileges` do Supabase concede em
-- `public`. O job das 05:27 faria isso amanha; as particoes criadas na linha
-- acima nao podem passar a noite abertas ao `authenticated`.
select public.endurecer_particoes_de_tentativas();
