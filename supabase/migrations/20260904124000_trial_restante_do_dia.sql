-- AD-133 · item 6 de docs/planos/TRIAL-1-mecanismo-e-conta-gratuita.md
--
-- Quantas questoes ainda cabem hoje, ou NULL quando nao ha teto (matricula
-- paga, ou nenhuma). E a mesma conta que `registrar_tentativa` faz antes do
-- INSERT — por isso mora aqui, e nao no TypeScript: duas implementacoes do
-- mesmo corte de dia divergem no primeiro fuso que alguem esquecer.
--
-- `security definer` pelo mesmo motivo de `trial_questoes_por_dia()`: a leitura
-- da configuracao precisa enxergar `configuracoes`, invisivel para
-- `authenticated`. A contagem e sempre do proprio `auth.uid()`.

create or replace function public.trial_questoes_restantes_hoje()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_inicio timestamptz;
  v_feitas integer;
begin
  if v_user is null then
    return null;
  end if;

  if (select public.tipo_da_matricula_ativa()) is distinct from 'trial' then
    return null;
  end if;

  v_inicio := date_trunc('day', now() at time zone 'America/Sao_Paulo')
                at time zone 'America/Sao_Paulo';

  select count(*) into v_feitas
    from public.tentativas t
   where t.user_id = v_user
     and t.respondida_em >= v_inicio;

  return greatest(0, (select public.trial_questoes_por_dia()) - v_feitas);
end;
$$;

comment on function public.trial_questoes_restantes_hoje() is
  'Quantas questoes ainda cabem hoje no trial; NULL quando nao ha teto (AD-133). Le auth.uid() por dentro. E o que dimensiona a sessao para o aluno nao receber um bloco de 10 e travar na quarta.';

revoke all on function public.trial_questoes_restantes_hoje() from public, anon;
grant execute on function public.trial_questoes_restantes_hoje() to authenticated, service_role;
