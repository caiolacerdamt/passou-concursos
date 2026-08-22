-- SPEC 12 · correção F-15 · PAG-03
--
-- O estorno do Asaas **não confirma na mesma chamada**. Em Pix o estorno nasce
-- `PENDING` ou `AWAITING_CRITICAL_ACTION_AUTHORIZATION` (a conta pode exigir
-- autorização por código do titular), e a confirmação chega depois, por
-- webhook. Até aqui o fechamento local só acontecia se o gateway respondesse
-- confirmado na hora — então o reembolso ficava pendurado para sempre: aluno
-- com acesso, dinheiro devolvido, sistema sem saber.
--
-- Duas peças: registrar o PEDIDO quando o aluno clica (a auditoria de "quem
-- pediu e quando" não pode esperar o gateway), e preservar esse registro no
-- fechamento, que agora pode vir horas depois e por outro caminho.

create or replace function public.registrar_pedido_de_reembolso(
  p_pagamento_id uuid,
  p_user_id uuid,
  p_meio public.pagamento_meio,
  p_quando timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado public.pagamento_estado;
begin
  select estado into v_estado
    from public.pagamentos
   where id = p_pagamento_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'pagamento de reembolso inexistente';
  end if;

  if v_estado not in ('confirmada', 'ativada') then
    raise exception 'pagamento não está em estado reembolsável: %', v_estado;
  end if;

  -- Só grava se ainda não houver pedido: uma segunda tentativa não pode
  -- reescrever a data do pedido original, que é o que prova a janela de 7 dias.
  update public.pagamentos
     set reembolso_solicitado_por = coalesce(reembolso_solicitado_por, p_user_id),
         reembolso_solicitado_em = coalesce(reembolso_solicitado_em, p_quando),
         reembolso_meio = coalesce(reembolso_meio, p_meio)
   where id = p_pagamento_id;

  return true;
end;
$$;

comment on function public.registrar_pedido_de_reembolso(
  uuid, uuid, public.pagamento_meio, timestamptz
) is
  'Registra quem pediu o reembolso e quando, sem mudar o estado. O acesso só cai quando o gateway confirmar.';

revoke all on function public.registrar_pedido_de_reembolso(
  uuid, uuid, public.pagamento_meio, timestamptz
) from public, anon, authenticated;
grant execute on function public.registrar_pedido_de_reembolso(
  uuid, uuid, public.pagamento_meio, timestamptz
) to service_role;

-- Fechamento: preserva o pedido original em vez de sobrescrever com a hora da
-- confirmação. O `user_id` continua sendo o dono do pagamento — no fechamento
-- assíncrono quem chama é o webhook, não a sessão do aluno.
create or replace function public.confirmar_reembolso_pagamento(
  p_pagamento_id uuid,
  p_user_id uuid,
  p_meio public.pagamento_meio,
  p_quando timestamptz,
  p_motivo text default 'reembolso_confirmado'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pagamento public.pagamentos;
begin
  select * into v_pagamento
    from public.pagamentos
   where id = p_pagamento_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'pagamento de reembolso inexistente';
  end if;

  if v_pagamento.estado not in ('confirmada', 'ativada', 'reembolsada') then
    raise exception 'pagamento não está em estado reembolsável: %', v_pagamento.estado;
  end if;

  update public.pagamentos
     set estado = 'reembolsada',
         reembolso_solicitado_por = coalesce(v_pagamento.reembolso_solicitado_por, p_user_id),
         reembolso_solicitado_em = coalesce(v_pagamento.reembolso_solicitado_em, p_quando),
         reembolso_meio = coalesce(v_pagamento.reembolso_meio, p_meio),
         ultima_falha_codigo = p_motivo
   where id = p_pagamento_id;

  if v_pagamento.matricula_id is not null then
    update public.matriculas
       set estado = 'reembolsada'
     where id = v_pagamento.matricula_id
       and user_id = p_user_id
       and estado = 'ativa';
  end if;

  return true;
end;
$$;

comment on function public.confirmar_reembolso_pagamento(
  uuid, uuid, public.pagamento_meio, timestamptz, text
) is
  'Fecha pagamento e matrícula na mesma transação, preservando a data do pedido; repetir também corrige matrícula ativa após pagamento já reembolsado.';
