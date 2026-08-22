-- SPEC 12 · correções incrementais F-03/F-05
--
-- A transição específica precisa rejeitar também o NULL retornado por
-- current_setting(..., true). Tokens podem expirar naturalmente; por isso a
-- tabela não pode impor que expira_em seja sempre posterior à criação.

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

alter table public.pagamento_resultado_tokens
  drop constraint if exists pagamento_resultado_token_expira_depois_de_criar;

comment on table public.pagamento_resultado_tokens is
  'Capability bearer do resultado do checkout; guarda somente hash e consulta TTL server-side de 48 horas.';
