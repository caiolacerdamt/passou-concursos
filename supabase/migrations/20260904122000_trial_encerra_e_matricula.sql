-- AD-133 · item 4 de docs/planos/TRIAL-1-mecanismo-e-conta-gratuita.md
--
-- O defeito mais caro do plano, e um que a propria mudanca introduz: sem isto,
-- o aluno que veio do trial paga R$197 e continua com 7 dias, porque a ativacao
-- reaproveita "a matricula ativa" sem olhar o tipo.
--
-- O encerramento precisa acontecer ANTES do insert da paga: o indice
-- `matriculas_uma_ativa_por_aluno` recusa as duas ativas ao mesmo tempo. Uma
-- funcao so garante que as duas coisas acontecem na mesma transacao.

create or replace function public.encerrar_trial_e_matricular(
  p_user_id    uuid,
  p_produto_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matricula uuid;
begin
  -- Encerra, nao promove: promover a mesma linha apagaria o registro de que
  -- houve trial, que e justamente o dado de conversao a medir depois.
  update public.matriculas
     set estado = 'encerrada'
   where user_id = p_user_id
     and tipo    = 'trial'
     and estado  = 'ativa';

  insert into public.matriculas (user_id, produto_id)
  values (p_user_id, p_produto_id)
  returning id into v_matricula;

  return v_matricula;
end;
$$;

comment on function public.encerrar_trial_e_matricular(uuid, uuid) is
  'Encerra o trial ativo e cria a matricula do produto pago na mesma transacao (AD-133). Aceita user_id por parametro, entao SO service_role: e a excecao que confirma a regra do contrato nº 11 — nunca ao alcance do aluno.';

revoke all on function public.encerrar_trial_e_matricular(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.encerrar_trial_e_matricular(uuid, uuid) to service_role;
