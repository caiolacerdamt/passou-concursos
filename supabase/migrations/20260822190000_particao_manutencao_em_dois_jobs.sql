-- Manutencao da particao de `tentativas` em DOIS jobs (INFRA-04 AC3 · INFRA-09 AC2)
--
-- Conserta uma falha diaria e silenciosa desde 2026-08-17. O job criado pela
-- migracao `20260817123000_tentativas_particao_endurecida.sql` levava duas
-- instrucoes na mesma string de comando:
--
--     call partman.run_maintenance_proc();
--     select public.endurecer_particoes_de_tentativas();
--
-- e falhava todo dia as 05:17 UTC com:
--
--     ERROR: invalid transaction termination
--     CONTEXT: partman.run_maintenance_proc() line 43 at COMMIT
--
-- **A causa e a juncao, nao o partman.** Quando o pg_cron manda mais de uma
-- instrucao de uma vez, o Postgres as envolve numa transacao implicita. E
-- `run_maintenance_proc` e uma PROCEDURE que faz COMMIT no proprio corpo, de
-- proposito, para nao segurar lock enquanto cria particao. COMMIT dentro de
-- transacao implicita e justamente "invalid transaction termination". Ou seja: a
-- intencao registrada no comentario original — "na mesma transacao do job, sem
-- janela entre uma coisa e outra" — nao era so desnecessaria, era impossivel. O
-- partman nunca trabalha na transacao de quem o chama.
--
-- O preco de separar e uma janela de 10 minutos entre a particao nascer e ser
-- endurecida. Ela e inofensiva e nao e a mesma coisa que a janela temida no
-- comentario antigo: com `premake = 3`, a particao criada as 05:17 so recebe o
-- primeiro INSERT dali a meses. O que existia antes nao era janela menor — era
-- endurecimento nenhum, porque o job inteiro abortava antes da primeira linha.
--
-- 05:27 UTC continua antes da poda do historico (05:40), que os testes exigem
-- que venha depois da manutencao.

select cron.unschedule('tentativas-manutencao-particao');

-- Uma instrucao por job: e o que mantem cada uma na propria transacao.
select cron.schedule(
  'tentativas-manutencao-particao',
  '17 5 * * *',
  $manutencao$ call partman.run_maintenance_proc(); $manutencao$
);

-- Idempotente por contrato (ver o `comment on function`): reendurecer particao
-- ja endurecida nao faz nada. Por isso rodar todo dia, mesmo quando o partman
-- nao criou nada, e seguro — e e o que fecha a janela do dia anterior.
select cron.schedule(
  'tentativas-endurece-particao',
  '27 5 * * *',
  $endurece$ select public.endurecer_particoes_de_tentativas(); $endurece$
);
