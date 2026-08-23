-- SPEC 14 · GAM-02 · INFRA-03 · AD-071
--
-- O plano do dia nasce às 06:30 UTC. A sequência fecha o retrato de ontem
-- depois dele, às 07:00 UTC (04:00 BRT), e a função ainda protege a abertura
-- do dia atual com um limite próprio.

select cron.schedule(
  'm4-recalcula-sequencia',
  '0 7 * * *',
  $sequencia$ select public.recalcula_sequencia(); $sequencia$
);

