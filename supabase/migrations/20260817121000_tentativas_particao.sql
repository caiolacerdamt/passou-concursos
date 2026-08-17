-- INFRA-04 (AC1, AC2, AC3) · AD-035 · AD-067
--
-- `tentativas` cresce para sempre e e a tabela mais lida do produto. Particionar
-- depois seria mover a fundacao com a casa em cima; por isso nasce assim.
--
-- Ate esta migracao a tabela nao tem particao nenhuma e recusa todo INSERT — o
-- Postgres nao tem onde por a linha. E a razao de o particionamento vir antes da
-- trava (SPEC 05, T42 antes de T43).
--
-- **Versao**: pg_partman 5.3.1, que e a disponivel no Postgres 17.6 do projeto.
-- A assinatura mudou da serie 4: `p_type` agora aceita 'range'/'list' (nao mais
-- 'native'/'partman'), e ha parametros novos. Os valores abaixo foram lidos de
-- `pg_get_function_arguments`, nao de memoria.

create schema if not exists partman;
create extension if not exists pg_partman with schema partman;

select partman.create_parent(
  p_parent_table  := 'public.tentativas',
  p_control       := 'respondida_em',
  p_interval      := '1 month',
  p_type          := 'range',

  -- INFRA-04 AC3: tres meses futuros ja criados. A folga e o que transforma
  -- "a manutencao nao rodou" num alerta (SPEC 03, view `jobs_falhados`) em vez
  -- de um INSERT perdido — o edge case que o M9 listou.
  p_premake       := 3,

  -- Particao `default` ligada: linha com data fora de toda faixa **entra** em
  -- vez de falhar. Sem ela, um relogio errado ou uma importacao de historico
  -- derrubaria a resposta do aluno. Medido que ela **nao** estraga o partition
  -- pruning (AC2): o Postgres exclui a default pela restricao implicita dela.
  p_default_table := true,

  -- `pg_jobmon` nao esta instalado. Com `true` o partman so registra aviso a
  -- cada manutencao; dizer `false` e dizer a verdade.
  p_jobmon        := false
);

-- AD-067: **particao nunca e dropada.** A retencao por inatividade (24 meses) e
-- por `user_id`, pela porta do esquecimento — nunca por mes inteiro, que levaria
-- junto o dado de quem continua ativo.
--
-- `inherit_privileges` e a primeira linha de defesa do AD-091: sem ele, cada
-- particao nova nasce em `public` com os privilegios que o `alter default
-- privileges` do Supabase concede (`arwdDxtm` para `anon` e `authenticated`),
-- ou seja, uma copia de `tentativas` aberta ao navegador. A RLS e o gatilho de
-- TRUNCATE, que o partman **nao** copia, entram na migracao seguinte.
update partman.part_config
   set retention            = null,
       retention_keep_table = true,
       inherit_privileges   = true
 where parent_table = 'public.tentativas';

comment on table public.tentativas is
  'Log imutavel de respostas (AD-015/AD-042). So-INSERT: correcao e linha nova ou tabela vizinha. Particionada por mes via pg_partman, sem retencao — particao nunca e dropada (AD-067). Grupo LGPD 1 — apagamento pela porta `app.esquecimento_user_id` (AD-029).';
