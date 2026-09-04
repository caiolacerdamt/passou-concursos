-- AD-133 · item 2 de docs/planos/TRIAL-1-mecanismo-e-conta-gratuita.md
--
-- O trial **e uma matricula**. Nao ha segundo mecanismo de liberacao: a
-- `tem_matricula_ativa()` e as 7 policies que a usam continuam exatamente como
-- estavam, e o m8 §P1 AC2 segue valendo ao pe da letra. O que entra aqui e uma
-- pergunta de **escopo**, nao de liberacao: esta matricula e paga ou e trial?
--
-- `produtos` so sabia contar em meses (`meses_de_acesso integer not null`), e
-- 7 dias nao cabe em meses. O prazo do trial mora em `produtos.dias_de_acesso`
-- e **nao** existe `param.m8.trial_dias`: trocar o prazo ja e um UPDATE numa
-- linha de tabela, que e o que o AD-078 pede ("troca sem deploy"). Um parametro
-- em paralelo so criaria a chance de os dois discordarem.

-- ── Produto: prazo em meses OU em dias ──────────────────────────────────────

create type public.produto_tipo as enum ('pago', 'trial');

alter table public.produtos
  add column tipo           public.produto_tipo not null default 'pago',
  add column dias_de_acesso integer,
  alter column meses_de_acesso drop not null;

comment on column public.produtos.dias_de_acesso is
  'Prazo em dias, para produto de trial. Exclusivo com meses_de_acesso. E a UNICA fonte do prazo do trial (AD-133) — nao existe parametro de configuracao equivalente.';

comment on column public.produtos.tipo is
  'Paga ou trial. Copiado para matriculas.tipo pelo gatilho no INSERT; e a base da pergunta de escopo tipo_da_matricula_ativa().';

-- Exatamente um dos dois prazos, sempre positivo. O check antigo
-- (`produtos_meses_positivos`) continua valendo e passa com NULL.
alter table public.produtos
  add constraint produtos_prazo_exclusivo check (
       (meses_de_acesso is not null and dias_de_acesso is null  and meses_de_acesso > 0)
    or (dias_de_acesso  is not null and meses_de_acesso is null and dias_de_acesso  > 0)
  );

insert into public.produtos (codigo, nome, tipo, meses_de_acesso, dias_de_acesso)
values ('trial-7d', 'Teste gratis — 7 dias', 'trial', null, 7)
on conflict (codigo) do nothing;

-- ── Matricula: o tipo, desnormalizado de proposito ──────────────────────────
--
-- Duas razoes concretas, nenhuma delas estetica: (a) o indice unico do trial
-- precisa da coluna local, um indice nao faz subconsulta; (b) `matriculaAtiva()`
-- na aplicacao passa a ler o tipo sem join. E escrita uma vez no INSERT e
-- imutavel depois — o gatilho recusa a troca.

alter table public.matriculas add column tipo public.produto_tipo;

update public.matriculas m
   set tipo = p.tipo
  from public.produtos p
 where p.id = m.produto_id;

alter table public.matriculas alter column tipo set not null;

comment on column public.matriculas.tipo is
  'Paga ou trial, copiado do produto no INSERT e imutavel depois. Nao libera nada — quem libera continua sendo tem_matricula_ativa() (AD-133).';

-- ── O gatilho: deriva dos dois prazos e protege o tipo ──────────────────────
--
-- A ordem importa: a funcao so pode ser substituida DEPOIS do UPDATE acima. Com
-- ela no lugar, aquele UPDATE cairia na guarda de imutabilidade (old.tipo nulo,
-- new.tipo 'pago') e a migracao nao aplicaria.

create or replace function public.matriculas_carimba()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produto record;
begin
  if tg_op = 'INSERT' then
    select p.tipo, p.meses_de_acesso, p.dias_de_acesso
      into v_produto
      from public.produtos p
     where p.id = new.produto_id;

    if not found then
      raise exception 'produto_inexistente: %', new.produto_id
        using errcode = 'foreign_key_violation';
    end if;

    -- O tipo vem SEMPRE do produto. Nunca do que o chamador mandou.
    new.tipo := v_produto.tipo;

    -- `fim_em` explicito vence (a ativacao pode alinhar com a data do gateway).
    if new.fim_em is null then
      new.fim_em := new.inicio_em + case
        when v_produto.dias_de_acesso is not null
          then make_interval(days   => v_produto.dias_de_acesso)
        else   make_interval(months => v_produto.meses_de_acesso)
      end;
    end if;
  else
    if new.tipo is distinct from old.tipo then
      raise exception 'tipo_de_matricula_e_imutavel';
    end if;
    new.atualizada_em := now();
  end if;

  return new;
end;
$$;

comment on function public.matriculas_carimba() is
  'Deriva fim_em de produtos.meses_de_acesso OU produtos.dias_de_acesso no INSERT, copia o tipo do produto e recusa troca de tipo no UPDATE. E o que mantem prazo e tipo fora do codigo de aplicacao (AD-133).';
