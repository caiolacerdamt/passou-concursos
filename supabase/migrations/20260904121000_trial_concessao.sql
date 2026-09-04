-- AD-133 · item 3 de docs/planos/TRIAL-1-mecanismo-e-conta-gratuita.md
--
-- A concessao do trial e a pergunta de escopo. Nenhuma das duas funcoes abaixo
-- libera coisa alguma: quem libera continua sendo `tem_matricula_ativa()`, que
-- esta migracao nao encosta.

-- ── "Paga ou trial?", nunca "libera?" ───────────────────────────────────────

create or replace function public.tipo_da_matricula_ativa()
returns public.produto_tipo
language sql
stable
security definer
set search_path = ''
as $$
  select m.tipo
    from public.matriculas m
   where m.user_id = (select auth.uid())
     and m.estado  = 'ativa'
     and m.fim_em  > now()
   limit 1;
$$;

comment on function public.tipo_da_matricula_ativa() is
  'Escopo, nao liberacao: diz se a matricula ativa do aluno da sessao e paga ou trial (AD-133). Le auth.uid() por dentro, igual a tem_matricula_ativa() — nao aceita titular por parametro (contrato nº 11).';

revoke all on function public.tipo_da_matricula_ativa() from public, anon;
grant execute on function public.tipo_da_matricula_ativa() to authenticated, service_role;

-- ── O teto diario, lido por quem nao enxerga `configuracoes` ────────────────
--
-- `configuracoes` tem RLS ligada e **zero** policy: e invisivel para
-- `authenticated`, e `configuracoes_vigentes` e uma view `security_invoker`.
-- `registrar_tentativa` e `security invoker` — dentro dela a leitura da config
-- voltaria vazia e o override nunca valeria, so o default. Esta funcao e a
-- ponte: `security definer`, devolve **um numero** que nao e segredo, e nao
-- abre a tabela inteira para o navegador.

create or replace function public.trial_questoes_por_dia()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select valor #>> '{}' from public.configuracoes_vigentes
      where chave = 'param.m8.trial_questoes_por_dia'),
    '10')::integer;
$$;

comment on function public.trial_questoes_por_dia() is
  'Teto diario de questoes do trial (param.m8.trial_questoes_por_dia, default 10). Existe porque configuracoes e invisivel para authenticated e quem precisa do numero roda como o aluno (AD-133/AD-078).';

revoke all on function public.trial_questoes_por_dia() from public, anon;
grant execute on function public.trial_questoes_por_dia() to authenticated, service_role;

-- ── A concessao ────────────────────────────────────────────────────────────

create or replace function public.conceder_trial()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := (select auth.uid());
  v_produto   uuid;
  v_matricula uuid;
begin
  -- Le auth.uid() por dentro, SEMPRE. Um parametro aqui seria exatamente o
  -- buraco do gap Major da SPEC 06: funcao `security definer` concedida a
  -- `authenticated` que aceita o titular de fora deixa um aluno agir pelo outro.
  if v_user is null then
    raise exception 'sem_sessao' using errcode = '28000';
  end if;

  -- A flag. Config ilegivel deixa desligado, nunca ligado.
  if not coalesce(
       (select valor #>> '{}' from public.configuracoes_vigentes
         where chave = 'flag.m8.trial_gratuito'), 'false')::boolean
  then
    raise exception 'trial_desligado';
  end if;

  -- E-mail confirmado e pre-requisito, nao detalhe: e o unico filtro barato
  -- contra cadastro em massa por bot.
  if not exists (
    select 1 from auth.users u
     where u.id = v_user and u.email_confirmed_at is not null)
  then
    raise exception 'email_nao_confirmado';
  end if;

  -- Ja tem acesso de qualquer tipo? Nao concede e nao estoura — idempotente.
  if (select public.tem_matricula_ativa()) then
    return null;
  end if;

  -- Ja usou o trial alguma vez na vida? (vencido e encerrado contam)
  if exists (
    select 1 from public.matriculas m
     where m.user_id = v_user and m.tipo = 'trial')
  then
    raise exception 'trial_ja_usado';
  end if;

  select p.id into v_produto
    from public.produtos p
   where p.codigo = 'trial-7d' and p.ativo;

  if v_produto is null then
    raise exception 'produto_trial_indisponivel';
  end if;

  insert into public.matriculas (user_id, produto_id)
  values (v_user, v_produto)
  returning id into v_matricula;

  return v_matricula;
end;
$$;

comment on function public.conceder_trial() is
  'Concede a matricula de trial ao aluno da sessao, uma vez na vida, com a flag ligada e o e-mail confirmado (AD-133). Nao aceita titular por parametro. Idempotente para quem ja tem acesso: devolve null.';

revoke all on function public.conceder_trial() from public, anon;
grant execute on function public.conceder_trial() to authenticated;

-- ── Defesa em profundidade ─────────────────────────────────────────────────
--
-- Uma conta tem UM trial na vida — nao um trial ativo por vez. Se a funcao
-- acima tiver um bug, o banco recusa mesmo assim. E o que faz a regra durar
-- depois desta sessao.

create unique index matriculas_um_trial_por_aluno
  on public.matriculas (user_id) where tipo = 'trial';
