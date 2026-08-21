-- PAG-02 · PAG-09 · PAG-12 · DADOS-11 · SEC-01 · SEC-03
--
-- O checkout grava pagamento e aceite no mesmo RPC. O navegador nao recebe
-- permissao para chamar a funcao; a action de servidor usa service_role.

alter table public.pagamentos
  add column if not exists asaas_cliente_id text,
  add column if not exists asaas_status text,
  add column if not exists resultado_url text,
  add column if not exists resultado_boleto_url text,
  add column if not exists resultado_pix_qr_code text,
  add column if not exists resultado_pix_copia_e_cola text,
  add column if not exists reembolso_solicitado_por uuid references auth.users(id) on delete set null,
  add column if not exists reembolso_solicitado_em timestamptz,
  add column if not exists reembolso_meio public.pagamento_meio;

comment on column public.pagamentos.asaas_cliente_id is
  'Identificador do pagador no gateway; nao e aceito pelo navegador.';

comment on column public.pagamentos.resultado_url is
  'URL HTTPS devolvida pelo gateway para acompanhar a cobrança; sem e-mail ou CPF.';

create or replace function public.criar_pagamento_checkout(
  p_produto_codigo text,
  p_email text,
  p_valor_centavos integer,
  p_meio public.pagamento_meio,
  p_parcelas smallint,
  p_referencia_interna text,
  p_maior_de_idade boolean,
  p_termos_versao text,
  p_aceito_em timestamptz
)
returns public.pagamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produto public.produtos;
  v_pagamento public.pagamentos;
begin
  if p_maior_de_idade is not true then
    raise exception 'aceite de maioridade obrigatorio';
  end if;

  if p_email <> lower(btrim(p_email)) or length(p_email) < 3 then
    raise exception 'email de checkout invalido';
  end if;

  if exists (
    select 1
      from auth.users u
      join public.matriculas m on m.user_id = u.id
     where lower(u.email) = p_email
       and m.estado = 'ativa'
       and m.fim_em > now()
  ) then
    raise exception 'matricula_ativa';
  end if;

  select * into v_produto
    from public.produtos
   where codigo = p_produto_codigo and ativo;

  if not found then
    raise exception 'produto_indisponivel';
  end if;

  insert into public.pagamentos (
    produto_id, email, valor_centavos, meio, parcelas, referencia_interna
  ) values (
    v_produto.id, p_email, p_valor_centavos, p_meio, p_parcelas,
    p_referencia_interna
  ) returning * into v_pagamento;

  insert into public.pagamento_aceites (
    pagamento_id, maior_de_idade, termos_versao, aceito_em
  ) values (
    v_pagamento.id, p_maior_de_idade, p_termos_versao, p_aceito_em
  );

  return v_pagamento;
end;
$$;

revoke all on function public.criar_pagamento_checkout(
  text, text, integer, public.pagamento_meio, smallint, text, boolean, text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.criar_pagamento_checkout(
  text, text, integer, public.pagamento_meio, smallint, text, boolean, text,
  timestamptz
) to service_role;
