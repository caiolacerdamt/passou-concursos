-- INFRA-09 AC2 · AD-035 · AD-037
--
-- Job leve e recorrente do projeto roda em pg_cron, dentro do Postgres (AD-035).
-- O problema e que ele falha **dentro do banco** e nao avisa ninguem: o pg_cron
-- grava toda execucao em `cron.job_run_details` e para por ai.
--
-- Esta migracao instala a extensao e abre a janela por onde a falha e vista de
-- fora. Quem olha por essa janela e o vigia (`scripts/jobs/vigia-de-jobs.mjs`),
-- rodado uma vez por dia pelo GitHub Actions.
--
-- **Fronteira com a SPEC 06:** aqui entra a extensao e a vigilancia; o primeiro
-- job de verdade (projecoes e plano do dia) e da SPEC 06. Sem a extensao aqui, o
-- criterio de sucesso desta spec — "pg_cron forcado a falhar dispara alerta" —
-- seria impossivel de cumprir.

create extension if not exists pg_cron;

-- Execucao que deu errado, e so ela. `succeeded` e `running` ficam de fora: o
-- vigia le esta view inteira e reporta tudo que encontra, entao filtrar aqui e
-- o que impede o alerta de virar ruido diario.
-- O nome do job mora em `cron.job`, nao no historico de execucao — por isso o
-- join. Ele e `left` porque apagar um job **nao** apaga o historico dele, e uma
-- falha orfa continua sendo uma falha que precisa aparecer.
create view public.jobs_falhados with (security_invoker = true) as
select
  execucao.jobid,
  execucao.runid,
  job.jobname,
  execucao.status,
  execucao.return_message,
  execucao.start_time,
  execucao.end_time
from cron.job_run_details as execucao
left join cron.job as job on job.jobid = execucao.jobid
where execucao.status in ('failed', 'canceled');

comment on view public.jobs_falhados is
  'Execucoes de pg_cron que falharam (INFRA-09 AC2). Lida pelo vigia diario. Nao e para o navegador.';

-- `security_invoker` faz a view rodar com o privilegio de quem chama, entao ela
-- nao vira porta lateral para o schema `cron`. O revoke explicito fecha a porta
-- de vez, em vez de depender de como o pg_cron distribuiu os privilegios dele:
-- `return_message` carrega o texto do erro do Postgres, que leva valor de linha.
revoke all on public.jobs_falhados from anon, authenticated;

-- NOTA OPERACIONAL (doc do Supabase, Upgrading §pg_cron): o pg_cron **nao**
-- limpa `cron.job_run_details` sozinho. Com job rodando todo dia a tabela cresce
-- para sempre. Nao ha job nenhum agendado ainda, entao a poda entra junto do
-- primeiro job de verdade, na SPEC 06 — registrado no Handoff do STATE.md.
