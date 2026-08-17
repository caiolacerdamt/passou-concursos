-- ALUNO-01 AC1 (Independent Test da spec) · AD-015 · AD-029 · AD-084
--
-- Invariante nº1 do projeto: `tentativas` so recebe INSERT. Correcao e linha
-- nova ou tabela vizinha. Quebrar isto nao e escolha de implementacao, e bug.
--
-- A trava tem **tres** pecas (AD-084, que substituiu a receita de duas do
-- AD-082), e cada uma existe porque a anterior nao alcanca alguem:
--
--   1. `revoke` — tira o privilegio de `anon` e `authenticated`. Nao alcanca o
--      `service_role`, que e quem os scripts da fabrica usam.
--   2. gatilho `for each row` em `before update or delete` — alcanca todo mundo,
--      inclusive o dono da tabela. **Medido nesta rodada: o Postgres clona este
--      gatilho para cada particao**, entao atacar a particao direto tambem para
--      aqui. Era a pergunta aberta que o design da rodada 1 deixou.
--   3. gatilho `for each statement` em `before truncate` — TRUNCATE nao dispara
--      gatilho de linha, e RLS nao governa TRUNCATE. **Este NAO e clonado para
--      as particoes**: o buraco que sobra e fechado na migracao seguinte
--      (AD-091).
--
-- A unica excecao de DELETE e a **porta nomeada do esquecimento** (AD-029): a
-- sessao declara de quem e o dado antes de apagar. Um privilegio generico de
-- administrador nao serviria — nao deixaria rastro de qual titular foi atendido,
-- e apagaria a linha errada em silencio.

revoke update, delete, truncate on public.tentativas from anon, authenticated;

create or replace function public.tentativas_bloqueia_mutacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception
      'tentativas e log imutavel: UPDATE proibido. Correcao = linha nova ou tabela vizinha (AD-015/AD-042).';
  end if;

  -- `current_setting(..., true)` devolve NULL quando a chave nunca foi definida,
  -- e `is distinct from` faz o NULL perder: sessao que nao declarou nada nao
  -- apaga nada. Comparar como texto e proposital — a porta e aberta com
  -- `set local`, que so aceita texto.
  if current_setting('app.esquecimento_user_id', true) is distinct from old.user_id::text then
    raise exception
      'DELETE em tentativas so pela rotina de esquecimento: declare app.esquecimento_user_id com o titular (AD-029).';
  end if;

  return old;
end;
$$;

comment on function public.tentativas_bloqueia_mutacao() is
  'Camada 2 da trava (AD-084). Recusa UPDATE sempre; recusa DELETE que nao venha pela porta nomeada do esquecimento (AD-029).';

create or replace function public.tentativas_bloqueia_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'tentativas e log imutavel: TRUNCATE proibido (AD-015/AD-084).';
end;
$$;

comment on function public.tentativas_bloqueia_truncate() is
  'Camada 3 da trava (AD-084). Precisa existir tambem em cada particao — o Postgres nao clona gatilho de statement (AD-091).';

-- Este e clonado para toda particao, presente e futura.
create trigger tentativas_sem_mutacao
  before update or delete on public.tentativas
  for each row execute function public.tentativas_bloqueia_mutacao();

-- Este nao e. Ver a migracao do endurecimento.
create trigger tentativas_sem_truncate
  before truncate on public.tentativas
  for each statement execute function public.tentativas_bloqueia_truncate();

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Diferente de `questoes` e `configuracoes`, que ficam sem policy nenhuma: aqui
-- o aluno **precisa** ler e escrever o proprio historico, e e a RLS que define o
-- que "proprio" quer dizer. Nao ha policy de UPDATE nem de DELETE, e ausencia de
-- policy e negacao — a trava e a RLS dizem a mesma coisa por caminhos diferentes.
--
-- `(select auth.uid())` e nao `auth.uid()`: envolver em subconsulta faz o
-- Postgres avaliar a funcao uma vez por consulta em vez de uma vez por linha.

alter table public.tentativas enable row level security;

create policy tentativas_le_o_proprio on public.tentativas
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy tentativas_insere_o_proprio on public.tentativas
  for insert to authenticated
  with check (user_id = (select auth.uid()));
