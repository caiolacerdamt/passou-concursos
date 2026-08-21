-- Endurece as funcoes de roteamento: a fila continua sendo uma operacao de
-- servico e a execucao normal acontece somente pelo trigger do banco.

revoke all on function public.motivo_revisao_spec10(uuid, public.origem_questao, numeric)
  from public, anon, authenticated;
grant execute on function public.motivo_revisao_spec10(uuid, public.origem_questao, numeric)
  to service_role;

revoke all on function public.rotear_questao_revisao_spec10()
  from public, anon, authenticated;
grant execute on function public.rotear_questao_revisao_spec10()
  to service_role;
