-- AD-133 · item 9 de docs/planos/TRIAL-1-mecanismo-e-conta-gratuita.md
--
-- Ate aqui, todo titular no banco era alguem que pagou. Depois deste plano,
-- nao: passa a existir uma populacao de leads que testou 7 dias e sumiu.
--
-- O relogio do AD-045 conta do fim da matricula e o padrao e 24 meses. Guardar
-- por 24 meses o e-mail de quem testou uma semana e risco sem contrapartida —
-- entra `param.m7.retencao_trial_meses`, mais curto, para conta que **teve
-- trial e nunca teve pagamento**.
--
-- ⚠️ A rotina **automatica** de retencao e da SPEC 18, pos-lancamento. O que
-- entra agora e a consulta que **lista os candidatos**: no dia 1 o apagamento e
-- procedimento manual documentado, igual ao pedido de exclusao (AD-090). Nada
-- aqui apaga nada.

create or replace function public.candidatos_a_retencao_do_trial(
  p_meses integer default null
)
returns table (
  user_id      uuid,
  fim_do_trial timestamptz,
  meses_desde  numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with limite as (
    select coalesce(
      p_meses,
      (select (valor #>> '{}')::integer from public.configuracoes_vigentes
        where chave = 'param.m7.retencao_trial_meses'),
      6
    ) as meses
  ),
  trials as (
    select m.user_id, max(m.fim_em) as fim_do_trial
      from public.matriculas m
     where m.tipo = 'trial'
     group by m.user_id
  )
  select t.user_id,
         t.fim_do_trial,
         round(extract(epoch from (now() - t.fim_do_trial)) / 2629800.0, 1)
    from trials t, limite l
   -- "Nunca pagou" e o que separa o lead do aluno. Uma matricula paga, em
   -- qualquer estado, tira a conta desta lista: quem pagou volta para a janela
   -- de 24 meses do AD-045.
   where not exists (
           select 1 from public.matriculas p
            where p.user_id = t.user_id and p.tipo = 'pago')
     and not exists (
           select 1 from public.pagamentos g
            where g.user_id = t.user_id)
     and t.fim_do_trial < now() - make_interval(months => l.meses)
   order by t.fim_do_trial;
$$;

comment on function public.candidatos_a_retencao_do_trial(integer) is
  'Lista as contas que tiveram trial, nunca pagaram e passaram da janela de param.m7.retencao_trial_meses (AD-133). NAO apaga nada: a rotina automatica e da SPEC 18; no dia 1 o apagamento e manual, pela apagar_dados_do_usuario.';

revoke all on function public.candidatos_a_retencao_do_trial(integer)
  from public, anon, authenticated;
grant execute on function public.candidatos_a_retencao_do_trial(integer) to service_role;
