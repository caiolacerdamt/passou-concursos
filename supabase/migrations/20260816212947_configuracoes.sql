-- INFRA-11 (AC1, AC4, AC7) · AD-078 · AD-081
--
-- Toda configuracao e toda feature flag do projeto em UMA fonte: esta tabela.
-- Ela e append-only. O valor vigente de uma chave e a ULTIMA linha dela; trocar
-- um valor e inserir linha nova, nunca editar a que existe.
--
-- Por que assim: o AC7 exige registrar quem mudou, quando, de que valor para
-- qual. Com UPDATE isso obrigaria uma tabela de historico mantida por gatilho —
-- duas pecas que podem divergir. Com INSERT, o valor anterior *e* a penultima
-- linha: o registro nao tem como divergir do fato, porque e o mesmo dado.

create table public.configuracoes (
  id           bigint      generated always as identity primary key,
  chave        text        not null,
  valor        jsonb       not null,
  modulo_dono  text        not null,
  alterado_por uuid        not null references auth.users(id),
  motivo       text,
  alterado_em  timestamptz not null default now(),

  -- Flag e parametro moram na mesma tabela, separados pelo prefixo (AC1 pede
  -- uma fonte so; o prefixo da a distincao sem uma segunda tabela). O modulo
  -- dono aparece dentro da chave, entao chave orfa se enxerga a olho nu.
  constraint chave_com_prefixo_valido
    check (chave ~ '^(flag|param)\.m[1-9]\.[a-z0-9_]+$')
);

comment on table public.configuracoes is
  'Append-only (AD-081). Valor vigente = ultima linha da chave. Sem UPDATE, sem DELETE.';

-- Leitura do valor vigente. O desempate por `id desc` nao e enfeite: duas linhas
-- inseridas na mesma transacao compartilham o `now()` do inicio dela.
create index configuracoes_chave_recencia_idx
  on public.configuracoes (chave, alterado_em desc, id desc);

-- `security_invoker` faz a view rodar com o privilegio de quem chama, entao a
-- RLS da tabela vale para ela tambem. Sem isso a view rodaria como dona e abriria
-- uma porta lateral para o navegador ler exatamente o que a tabela nega.
create view public.configuracoes_vigentes
  with (security_invoker = true) as
select distinct on (chave)
  chave, valor, modulo_dono, alterado_por, alterado_em
from public.configuracoes
order by chave, alterado_em desc, id desc;

-- Camada 1 da trava: a aplicacao simplesmente nao tem o privilegio.
--
-- TRUNCATE entra na lista por medida, nao por precaucao: inspecionando os grants
-- depois da primeira aplicacao desta migracao, `anon` e `authenticated` ainda
-- tinham TRUNCATE (vem do `alter default privileges` do Supabase), e **RLS nao
-- governa TRUNCATE**. Sem esta linha a tabela append-only podia ser esvaziada
-- inteira. O desenho do M4 (AD-082) tem a mesma lacuna em `tentativas`.
revoke update, delete, truncate on public.configuracoes from anon, authenticated;

-- Camada 2: o gatilho pega tambem o `service_role`, que tem rolbypassrls e
-- passaria por cima da RLS. Sem ela, qualquer script com a chave de servico
-- corromperia a fundacao por engano.
--
-- Diferenca para `tentativas` (AD-082): aqui NAO existe porta de esquecimento.
-- A tabela nao guarda dado pessoal — `alterado_por` e o administrador, nao o
-- aluno —, entao nao ha caso legitimo de DELETE para abrir excecao.
-- `set search_path = ''` fecha o aviso `function_search_path_mutable` do linter
-- do Supabase: sem ele, quem consegue criar objeto num schema que venha antes no
-- search_path pode sequestrar o que a funcao resolve. Aqui o corpo so levanta
-- excecao, mas este mesmo molde vai ser copiado para `tentativas` (AD-082), onde
-- o risco deixa de ser teorico.
create or replace function public.configuracoes_bloqueia_mutacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'configuracoes e append-only: % proibido. Trocar valor = INSERT de linha nova (AD-081).',
    tg_op;
end;
$$;

create trigger configuracoes_sem_mutacao
  before update or delete on public.configuracoes
  for each row execute function public.configuracoes_bloqueia_mutacao();

-- TRUNCATE nao dispara gatilho de linha; precisa de um por comando. Este e o
-- que alcanca o `service_role`, que tem TRUNCATE e passa por cima da RLS.
create trigger configuracoes_sem_truncate
  before truncate on public.configuracoes
  for each statement execute function public.configuracoes_bloqueia_mutacao();

-- RLS ligada e SEM nenhuma policy: a tabela e invisivel para `anon` e para
-- `authenticated`. Config nao vai para o cliente. Ha chave interna aqui (teto de
-- gasto do tutor, limiar de otimizacao do FSRS) e nao existe razao para o
-- navegador enxergar a lista inteira so para ler o preco. O servidor le e
-- entrega so o que a tela precisa.
alter table public.configuracoes enable row level security;
