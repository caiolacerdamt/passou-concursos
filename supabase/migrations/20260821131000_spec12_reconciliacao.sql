-- SPEC 12 · F-03 · PAG-06/PAG-13
--
-- Um boleto/Pix pago após a expiração é o único caso autorizado a reabrir a
-- confirmação. A transição não fica disponível no RPC genérico.

create or replace function public.pagamentos_valida_transicao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado <> old.estado then
    if not (
      (old.estado = 'pendente' and new.estado in ('confirmada', 'expirada'))
      or (old.estado = 'confirmada' and new.estado in ('ativada', 'reembolsada'))
      or (old.estado = 'ativada' and new.estado = 'reembolsada')
      or (
        old.estado = 'expirada'
        and new.estado = 'confirmada'
        and coalesce(current_setting('app.reconciliacao_pagamento_expirado', true), '') = 'on'
      )
    ) then
      raise exception 'transicao de pagamento invalida: % -> %', old.estado, new.estado;
    end if;

    if new.estado = 'confirmada' and new.confirmado_em is null then
      new.confirmado_em := now();
    end if;
    if new.estado = 'ativada' and new.ativado_em is null then
      new.ativado_em := now();
    end if;
    if new.estado = 'expirada' and new.expirado_em is null then
      new.expirado_em := now();
    end if;
    if new.estado = 'reembolsada' and new.reembolsado_em is null then
      new.reembolsado_em := now();
    end if;

    insert into public.pagamento_transicoes (
      pagamento_id, de_estado, para_estado, motivo
    ) values (
      old.id, old.estado, new.estado, new.ultima_falha_codigo
    );
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.reabrir_pagamento_expirado_reconciliacao(
  p_pagamento_id uuid,
  p_motivo text default 'reconciliacao_pagamento_pago'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.reconciliacao_pagamento_expirado', 'on', true);

  update public.pagamentos
     set estado = 'confirmada',
         ultima_falha_codigo = p_motivo
   where id = p_pagamento_id
     and estado = 'expirada';

  if not found then
    perform set_config('app.reconciliacao_pagamento_expirado', 'off', true);
    raise exception 'pagamento expirado não encontrado: %', p_pagamento_id;
  end if;

  perform set_config('app.reconciliacao_pagamento_expirado', 'off', true);
  return true;
end;
$$;

comment on function public.reabrir_pagamento_expirado_reconciliacao(uuid, text) is
  'Único caminho para a reconciliação reabrir expirada -> confirmada quando o gateway informa pagamento.';

revoke all on function public.reabrir_pagamento_expirado_reconciliacao(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reabrir_pagamento_expirado_reconciliacao(uuid, text)
  to service_role;
