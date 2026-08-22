-- SPEC 12 · F-02/F-04 · PAG-03
--
-- O gateway é externo, mas o fechamento local do reembolso é uma única
-- transação: pagamento e matrícula não podem divergir depois do estorno.

alter table public.faturas
  add column if not exists status_gateway text,
  add column if not exists cancelamento_solicitado_em timestamptz,
  add column if not exists cancelada_em timestamptz;

alter table public.faturas
  drop constraint if exists faturas_estado_valido;

alter table public.faturas
  add constraint faturas_estado_valido
  check (
    estado in (
      'pendente',
      'emitida',
      'falha',
      'cancelamento_processando',
      'cancelada',
      'cancelamento_negado',
      'falha_cancelamento'
    )
  );

comment on column public.faturas.status_gateway is
  'Último status fiscal informado pelo Asaas; mantém o vocabulário externo sem abrir acesso.';

comment on column public.faturas.estado is
  'Estado local da NF, incluindo a fila de cancelamento após reembolso; não controla acesso do aluno.';

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
         reembolso_solicitado_por = p_user_id,
         reembolso_solicitado_em = p_quando,
         reembolso_meio = p_meio,
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
  'Fecha pagamento e matrícula na mesma transação; repetir também corrige matrícula ativa após pagamento já reembolsado.';

revoke all on function public.confirmar_reembolso_pagamento(
  uuid, uuid, public.pagamento_meio, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.confirmar_reembolso_pagamento(
  uuid, uuid, public.pagamento_meio, timestamptz, text
) to service_role;
