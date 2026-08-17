-- ALUNO-01 AC1 · INFRA-04 AC3 · **AD-091** · AD-084
--
-- O buraco que esta migracao fecha foi medido, nao imaginado. Com a trava do
-- AD-084 aplicada **so na tabela-pai**, num ensaio no banco de desenvolvimento:
--
--   update  via pai        -> bloqueado      update  direto na particao -> bloqueado
--   delete  via pai        -> bloqueado      delete  direto na particao -> bloqueado
--   truncate via pai       -> bloqueado      truncate direto na particao -> **PASSOU**
--
-- O Postgres clona gatilho de **linha** para as particoes; gatilho de
-- **statement** nao. E ha um segundo furo, pior: particao criada em `public`
-- nasce com os privilegios do `alter default privileges` do Supabase
-- (`arwdDxtm` para `anon` e `authenticated`) e **sem RLS** — RLS nao se herda.
-- Uma particao assim e uma copia de `tentativas` que o navegador le inteira,
-- de todos os alunos, por fora de toda policy.
--
-- O `inherit_privileges = true` da migracao anterior resolve metade (o partman
-- copia os privilegios do pai ao criar). A outra metade — RLS e gatilho de
-- TRUNCATE — o partman nao copia, e e o que esta funcao faz.
--
-- Ela roda em dois momentos: no fim desta migracao, para as particoes que ja
-- existem, e no job de manutencao, logo depois de `run_maintenance_proc()`, que
-- e o unico lugar onde particao nova nasce.

create or replace function public.endurecer_particoes_de_tentativas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  particao   record;
  nome_gatilho text;
  endurecidas  integer := 0;
begin
  for particao in
    select c.oid, c.relname, c.relrowsecurity
      from pg_catalog.pg_class c
      join pg_catalog.pg_inherits i on i.inhrelid = c.oid
     where i.inhparent = 'public.tentativas'::regclass
  loop
    -- Privilegio: o acesso legitimo passa pela tabela-pai, e o Postgres checa
    -- privilegio no pai — entao revogar tudo aqui nao atrapalha ninguem que use
    -- a porta da frente. Medido: INSERT e SELECT via pai continuam funcionando
    -- para `authenticated`, e o acesso direto a particao vira permission denied.
    execute format('revoke all on public.%I from anon, authenticated', particao.relname);

    -- RLS: cinto e suspensorio. Se um dia alguem reconceder SELECT na particao,
    -- a ausencia de policy aqui ainda nega.
    if not particao.relrowsecurity then
      execute format('alter table public.%I enable row level security', particao.relname);
    end if;

    -- Camada 3 do AD-084, agora tambem na particao.
    nome_gatilho := particao.relname || '_sem_truncate';
    if not exists (
      select 1 from pg_catalog.pg_trigger
       where tgrelid = particao.oid and tgname = nome_gatilho
    ) then
      execute format(
        'create trigger %I before truncate on public.%I
           for each statement execute function public.tentativas_bloqueia_truncate()',
        nome_gatilho, particao.relname
      );
    end if;

    endurecidas := endurecidas + 1;
  end loop;

  return endurecidas;
end;
$$;

comment on function public.endurecer_particoes_de_tentativas() is
  'AD-091: fecha em cada particao de `tentativas` o que o pg_partman nao copia — RLS e o gatilho de TRUNCATE — e revoga o privilegio que o `alter default privileges` do Supabase concede. Idempotente. Chamada pela migracao e pelo job de manutencao.';

-- `security definer` da a funcao o poder de alterar tabela do dono. O corpo e
-- fechado de proposito: so age em particoes de `public.tentativas`, so faz
-- revoke/RLS/gatilho, todo nome vai por `format(%I)` e o `search_path` e vazio.
-- Executa-la nao pode ser privilegio de quem se autentica pelo navegador.
revoke all on function public.endurecer_particoes_de_tentativas() from public, anon, authenticated;

-- As particoes que o `create_parent` ja criou.
select public.endurecer_particoes_de_tentativas();

-- ── Manutencao (INFRA-04 AC3) ───────────────────────────────────────────────
--
-- Diaria, e nao mensal: com `premake = 3` ha tres meses de folga, entao uma
-- execucao perdida vira alerta em `public.jobs_falhados` (SPEC 03) em vez de
-- INSERT recusado. 05:17 UTC = 02:17 BRT, longe do horario dos jobs da SPEC 06.
--
-- O endurecimento vem **depois** do partman na mesma chamada: a particao nova e
-- criada e protegida na mesma transacao do job, sem janela entre uma coisa e
-- outra.
select cron.schedule(
  'tentativas-manutencao-particao',
  '17 5 * * *',
  $manutencao$
    call partman.run_maintenance_proc();
    select public.endurecer_particoes_de_tentativas();
  $manutencao$
);
