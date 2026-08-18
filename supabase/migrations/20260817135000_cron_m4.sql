-- ALUNO-02 AC2 · ALUNO-07 AC1 · INFRA-03 · AD-035 · AD-071
--
-- Os dois primeiros jobs de verdade do projeto. A SPEC 03 instalou o pg_cron e a
-- vigilancia (`public.jobs_falhados` + o vigia diario do GitHub Actions); aqui
-- entra o que ela vigia.
--
-- 06:00 e 06:30 UTC = **03:00 e 03:30 BRT**. A ordem nao e arbitraria: o plano le
-- as projecoes, entao o recalculo precisa ter terminado antes. Meia hora de
-- folga com dezenas de alunos e exagero de proposito — quando o volume crescer,
-- o que muda e o intervalo, nao a ordem.
--
-- Os dois jobs ja saem do lock sozinhos se o disparo anterior ainda estiver
-- rodando (`pg_try_advisory_xact_lock` dentro de cada funcao, chaves diferentes),
-- entao um recalculo longo nao cancela nem atrasa o plano.
--
-- A frase de abertura de cada plano (07:00, GitHub Actions) e da SPEC 08: e
-- chamada de IA e nao roda dentro do Postgres.

select cron.schedule(
  'm4-recalcula-projecoes',
  '0 6 * * *',
  $projecoes$ select public.recalcula_projecoes(); $projecoes$
);

select cron.schedule(
  'm4-gera-plano-do-dia',
  '30 6 * * *',
  $plano$ select public.gera_plano_do_dia(); $plano$
);

-- ── A divida que a SPEC 03 deixou marcada ───────────────────────────────────
--
-- "O pg_cron **nao** limpa `cron.job_run_details` sozinho. Com job rodando todo
-- dia a tabela cresce para sempre. Nao ha job nenhum agendado ainda, entao a
-- poda entra junto do primeiro job de verdade, na SPEC 06." — e este.
--
-- A janela e configuravel (`param.m4.retencao_historico_cron_dias`) porque ela e
-- o quanto de historico o vigia consegue investigar depois de um incidente de
-- fim de semana. Poda cedo demais apaga a prova do que aconteceu.
--
-- Nao confundir com a retencao de dado pessoal (AD-045): aqui nao ha titular
-- nenhum, e log de execucao de job.

create or replace function public.podar_historico_de_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dias    integer;
  v_apagadas integer;
begin
  v_dias := coalesce(
    (select valor #>> '{}' from public.configuracoes_vigentes
      where chave = 'param.m4.retencao_historico_cron_dias'),
    '30'
  )::integer;

  delete from cron.job_run_details
   where end_time is not null
     and end_time < now() - make_interval(days => v_dias);

  get diagnostics v_apagadas = row_count;
  return v_apagadas;
end;
$$;

comment on function public.podar_historico_de_jobs() is
  'Poda `cron.job_run_details`, que o pg_cron nao limpa sozinho (divida registrada na SPEC 03). Janela em `param.m4.retencao_historico_cron_dias`. Nao e retencao de dado pessoal: aqui nao ha titular.';

revoke all on function public.podar_historico_de_jobs() from public, anon, authenticated;

-- 05:40 UTC: depois da manutencao de particao (05:17) e antes dos dois jobs do
-- M4, para o historico do dia nascer numa tabela ja podada.
select cron.schedule(
  'm4-poda-historico-de-jobs',
  '40 5 * * *',
  $poda$ select public.podar_historico_de_jobs(); $poda$
);
