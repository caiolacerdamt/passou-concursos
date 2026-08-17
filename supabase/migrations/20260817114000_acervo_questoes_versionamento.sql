-- BANCO-13 · AD-039 · AD-042
--
-- "Correcao de questao publicada = nova versao, nunca reescreve a anterior"
-- (AD-039) e a fundacao do log imutavel do M4: o aluno respondeu uma versao, e
-- essa versao nao pode mudar sob os pes dele.
--
-- Isto aqui e o que transforma essa frase em garantia do banco. Sem os gatilhos
-- abaixo, ela dependeria de todo script futuro se lembrar de fazer a coisa certa
-- — e o invariante nº1 do AGENTS.md diz que quebrar isso e bug, nao escolha.
--
-- `questoes` NAO e append-only, e essa e a diferenca em relacao a `configuracoes`
-- (AD-081) e a `tentativas` (AD-084). A SPEC 09 preenche o gabarito, a 10 muda o
-- status, a 11 preenche o embedding — todos UPDATE legitimos na versao vigente.
-- O que precisa ser imutavel e mais estreito, e sao tres regras.

-- ── Gatilho 1: o versionamento acontece no INSERT ───────────────────────────
--
-- Criar versao nova e um INSERT com o mesmo `id`. Quem numera e o banco, nao o
-- chamador: numero de versao calculado por script e numero que dois scripts
-- concorrentes calculam igual.
create or replace function public.questoes_versiona_no_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- O valor que o chamador passou em `questao_versao` e ignorado de proposito.
  select coalesce(max(q.questao_versao), 0) + 1
    into new.questao_versao
    from public.questoes as q
   where q.id = new.id;

  -- **A ordem aqui e o detalhe que da errado no lugar obvio.** Apagar o selo de
  -- vigente da versao anterior tem de acontecer ANTES da nova linha entrar: o
  -- indice unico `(id) where vigente` e verificado na hora do INSERT, e se a
  -- anterior ainda estiver vigente o INSERT falha. Num gatilho AFTER seria tarde.
  if new.vigente then
    update public.questoes as q
       set vigente = false
     where q.id = new.id and q.vigente;
  end if;

  return new;
end;
$$;

create trigger questoes_versiona
  before insert on public.questoes
  for each row execute function public.questoes_versiona_no_insert();

-- ── Gatilho 2: a versao que saiu de cena esta congelada ─────────────────────
--
-- As tres regras, e por que cada uma existe:
--
-- (1) UPDATE em linha com `vigente = false` e recusado. E o que faz "nunca
--     reescreve a anterior" ser verdade. Nao conflita com o gatilho 1: o
--     `update ... set vigente = false` de la atinge linha que AINDA e vigente,
--     entao `old.vigente` e true e esta regra nao dispara.
-- (2) Mudar `id` ou `questao_versao` e recusado. Identidade nao se edita — se
--     desse, a FK de `tentativas` passaria a apontar para outra questao.
-- (3) DELETE e recusado. Descartar questao e `status = 'rejeitada'`; DELETE
--     arrebentaria a FK de `tentativas` e apagaria o fato de um aluno ter
--     respondido. Diferente de `tentativas` (AD-082), aqui NAO existe porta de
--     esquecimento: a questao nao e dado pessoal de ninguem.
create or replace function public.questoes_protege_versao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'questoes nao aceita DELETE: descartar questao e status = ''rejeitada'' (AD-039). Apagar arrebentaria a FK de tentativas.';
  end if;

  if not old.vigente then
    raise exception
      'questao_versao % de % nao e mais vigente e esta congelada: correcao = versao nova, nunca UPDATE na anterior (AD-039).',
      old.questao_versao, old.id;
  end if;

  if new.id <> old.id or new.questao_versao <> old.questao_versao then
    raise exception
      'id e questao_versao nao se editam: sao a identidade que tentativas e explicacoes referenciam (AD-039/AD-042).';
  end if;

  -- UPDATE legitimo na versao vigente (gabarito, status, embedding, topico)
  -- passa daqui para baixo. Aproveita para nao depender de o chamador lembrar.
  new.atualizada_em := now();
  return new;
end;
$$;

create trigger questoes_protege_versao_antiga
  before update or delete on public.questoes
  for each row execute function public.questoes_protege_versao();

-- TRUNCATE nao dispara gatilho de linha (AD-084): precisa de um por comando.
-- Este e o que alcanca o `service_role`, que tem o privilegio e passa por cima
-- da RLS.
create or replace function public.questoes_bloqueia_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'questoes nao aceita TRUNCATE: e o acervo do produto.';
end;
$$;

create trigger questoes_sem_truncate
  before truncate on public.questoes
  for each statement execute function public.questoes_bloqueia_truncate();
