-- PAG-01 · PAG-04 · PAG-06 AC2 (parte) · AD-031 · AD-032
--
-- A **chave unica** do conteudo pago. O contrato da SPEC 07 diz: nenhuma spec
-- posterior inventa outro caminho de liberacao. Esta migracao e onde essa frase
-- vira mecanismo em vez de combinado.
--
-- O ponto nao obvio esta no fim do arquivo. Desde a SPEC 04, `questoes`,
-- `provas`, `materias` e `topicos` estao com RLS **ligada e sem policy nenhuma**
-- — ou seja, hoje aluno nenhum le o acervo, nem parcialmente. O que falta nao e
-- fechar: e **abrir**, e abrir so para quem tem matricula. E por isso que
-- "SHALL NOT mostrar conteudo parcial" (m8 §P1 AC6) nao depende de o codigo da
-- tela lembrar de checar nada: sem matricula, o banco devolve zero linha para
-- qualquer consulta, de qualquer tela, escrita hoje ou daqui a seis specs.
--
-- O que NAO esta aqui, de proposito: checkout, webhook, criacao de conta pelo
-- pagamento, reembolso e aviso de vencimento sao da SPEC 12. Esta spec cria a
-- fechadura e prova que ela funciona **antes** de existir dinheiro para testa-la.
--
-- Grupo LGPD: **1** (`user_id` identificado) nas duas tabelas do aluno. Entram
-- no registro de apagamento de `src/modules/lgpd/grupo-1.ts`.

-- ── Produto (PAG-04 / m8 §P3 AC1) ───────────────────────────────────────────
--
-- O lancamento vende **um** plano e SHALL NOT apresentar tiers (PAG-01 AC6). A
-- tabela existe assim mesmo porque o §P3 AC1 exige que o modelo aceite mais de
-- um produto depois **sem migracao destrutiva** — e a migracao destrutiva seria
-- exatamente esta: descobrir tarde que "12 meses" estava escrito como constante
-- dentro do codigo e ter que reescrever `matriculas` para caber um plano novo.
--
-- Por isso `meses_de_acesso` e coluna daqui, e nao numero no TypeScript.

create table public.produtos (
  id              uuid primary key default gen_random_uuid(),
  -- Estavel e legivel: e por ele que o codigo e a SPEC 12 apontam para o plano,
  -- nunca por uuid escrito a mao.
  codigo          text    not null unique,
  nome            text    not null,
  meses_de_acesso integer not null,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),

  constraint produtos_meses_positivos check (meses_de_acesso > 0)
);

comment on table public.produtos is
  'Catalogo de planos (PAG-04). Um so no lancamento; a tabela existe para o segundo caber sem migracao destrutiva (m8 §P3 AC1).';

comment on column public.produtos.meses_de_acesso is
  'De onde sai a validade da matricula. Fica aqui, e nao como constante no codigo, para plano novo nao exigir deploy nem migracao.';

-- O plano unico do lancamento. `on conflict do nothing` porque a migracao roda
-- em banco que ja pode te-lo (dev reaplicado).
insert into public.produtos (codigo, nome, meses_de_acesso)
values ('anual-unico', 'Passou Concursos — 12 meses', 12)
on conflict (codigo) do nothing;

-- ── Matricula ───────────────────────────────────────────────────────────────

-- Enum e nao text: transicao para estado inexistente vira erro do banco, que e
-- o que PAG-06 AC7 pede ("transicao invalida SHALL ser rejeitada"). A maquina de
-- estados completa (`pendente → confirmada → ativada`, reembolso) e da SPEC 12 e
-- mora em `pagamentos`; aqui esta so o que a matricula sabe ser.
create type public.matricula_estado as enum (
  'ativa',
  'vencida',
  'reembolsada',
  'encerrada'
);

create table public.matriculas (
  id         uuid primary key default gen_random_uuid(),

  -- FK de verdade para `auth.users`, com cascade: apagar a conta apaga a
  -- matricula junto. Difere de `tentativas`, que **nao** tem FK de proposito
  -- (design da SPEC 05) — la a linha e log imutavel e precisa sobreviver; aqui
  -- a matricula sem usuario nao significa nada.
  user_id    uuid not null references auth.users(id) on delete cascade,
  produto_id uuid not null references public.produtos(id),

  estado     public.matricula_estado not null default 'ativa',

  inicio_em  timestamptz not null default now(),
  -- Preenchida pelo gatilho a partir de `produtos.meses_de_acesso` quando vem
  -- nula. `not null` porque matricula sem fim e acesso vitalicio por descuido.
  fim_em     timestamptz not null,

  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),

  constraint matriculas_fim_depois_do_inicio check (fim_em > inicio_em)
);

comment on table public.matriculas is
  'A UNICA chave do conteudo pago (PAG-01/PAG-06 AC2, AD-031). Grupo LGPD 1. Quem escreve e a SPEC 12; aqui o aluno so le a propria.';

-- Uma matricula ativa por aluno. Parcial em `estado = ''ativa''` de proposito:
-- o historico de matriculas vencidas e reembolsadas do mesmo aluno precisa
-- caber (ele volta no ano seguinte — PAG-06/AD-055), e so a ativa e unica.
create unique index matriculas_uma_ativa_por_aluno
  on public.matriculas (user_id) where estado = 'ativa';

-- A consulta quente e "esta pessoa tem acesso agora?", e ela filtra por
-- user_id + estado. `fim_em` entra no indice para a checagem de validade sair
-- da mesma leitura.
create index matriculas_por_aluno_idx
  on public.matriculas (user_id, estado, fim_em desc);

-- ── Gatilho de carimbo e de validade ────────────────────────────────────────

create or replace function public.matriculas_carimba()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meses integer;
begin
  if tg_op = 'INSERT' then
    -- `fim_em` explicito vence (a SPEC 12 pode precisar alinhar com a data do
    -- gateway). Nulo significa "calcule pelo produto", que e o caminho normal.
    if new.fim_em is null then
      select p.meses_de_acesso into v_meses
        from public.produtos p where p.id = new.produto_id;

      if v_meses is null then
        raise exception 'produto_inexistente: %', new.produto_id
          using errcode = 'foreign_key_violation';
      end if;

      new.fim_em := new.inicio_em + make_interval(months => v_meses);
    end if;
  else
    new.atualizada_em := now();
  end if;

  return new;
end;
$$;

comment on function public.matriculas_carimba() is
  'Deriva fim_em de produtos.meses_de_acesso no INSERT e carimba atualizada_em no UPDATE. E o que mantem "12 meses" fora do codigo de aplicacao.';

-- `before insert` porque `fim_em` e `not null`: preencher depois chega tarde,
-- a mesma armadilha que a SPEC 04 ja pagou com o selo de `vigente`.
create trigger matriculas_carimba_insert
  before insert on public.matriculas
  for each row execute function public.matriculas_carimba();

create trigger matriculas_carimba_update
  before update on public.matriculas
  for each row execute function public.matriculas_carimba();

-- ── A funcao do paywall ─────────────────────────────────────────────────────
--
-- `security definer` porque ela e chamada de dentro das policies do acervo, e
-- precisa enxergar `matriculas` mesmo para quem nao tem permissao de ler a
-- tabela. Ela nao recebe `user_id`: le `auth.uid()` por dentro, sempre. Um
-- parametro aqui seria exatamente o buraco do gap Major da SPEC 06 — funcao
-- `security definer` concedida a `authenticated` que aceita o titular de fora
-- deixa um aluno responder pelo outro (contrato nº 11).
--
-- `stable` e nao `volatile`: dentro de uma consulta o resultado nao muda, e isso
-- deixa o planejador chamar a funcao uma vez em vez de uma por linha do acervo.

create or replace function public.tem_matricula_ativa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.matriculas m
     where m.user_id = (select auth.uid())
       and m.estado  = 'ativa'
       and m.fim_em  > now()
  );
$$;

comment on function public.tem_matricula_ativa() is
  'A unica pergunta que libera conteudo pago (PAG-01/PAG-06 AC2). Le auth.uid() por dentro — nao aceita titular por parametro, de proposito (contrato nº 11).';

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Assimetria igual a de `plano_dia`: o aluno **le** a propria matricula (para a
-- tela dizer ate quando ele tem acesso) e **nao escreve**. Quem escreve e o
-- webhook da SPEC 12, com a chave de servico. Aluno que pudesse escrever se
-- daria matricula sozinho — seria o segundo mecanismo de liberacao que a PAG-01
-- proibe, e o mais barato de explorar.

revoke insert, update, delete, truncate on public.matriculas from anon, authenticated;
revoke insert, update, delete, truncate on public.produtos   from anon, authenticated;

alter table public.matriculas enable row level security;
alter table public.produtos   enable row level security;

create policy matriculas_le_a_propria on public.matriculas
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Catalogo de plano nao e conteudo pago: a pagina de vendas (SPEC 12) precisa
-- exibir o plano para quem ainda nao pagou. Leitura aberta, escrita nao.
create policy produtos_leitura_publica on public.produtos
  for select to anon, authenticated
  using (ativo);

-- ── O paywall no acervo ─────────────────────────────────────────────────────
--
-- Aqui e onde a matricula vira a fechadura. Ate esta linha, `questoes`,
-- `provas`, `materias` e `topicos` tinham RLS ligada e **zero** policy: fechadas
-- para todo mundo. Abrem agora, e so pela matricula.
--
-- `anon` fica de fora das quatro: visitante nao le acervo em nenhuma hipotese.

create policy questoes_so_com_matricula on public.questoes
  for select to authenticated
  using ((select public.tem_matricula_ativa()));

create policy provas_so_com_matricula on public.provas
  for select to authenticated
  using ((select public.tem_matricula_ativa()));

create policy materias_so_com_matricula on public.materias
  for select to authenticated
  using ((select public.tem_matricula_ativa()));

create policy topicos_so_com_matricula on public.topicos
  for select to authenticated
  using ((select public.tem_matricula_ativa()));
