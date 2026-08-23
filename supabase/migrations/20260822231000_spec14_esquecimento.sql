-- SPEC 14 · DADOS-04 · AD-029 · AD-090
--
-- O pedido é uma fila pequena e operacional. A rotina abaixo apaga o grupo 1
-- dentro de uma transação e só deixa o pedido aberto para a confirmação externa
-- de e-mail e a invalidação da conta Auth.

create table public.solicitacoes_esquecimento (
  user_id             uuid        primary key,
  estado              text        not null default 'recebido',
  ultima_falha_codigo text,
  criada_em           timestamptz not null default now(),
  dados_apagados_em   timestamptz,
  email_enviado_em    timestamptz,
  concluida_em        timestamptz,
  atualizado_em       timestamptz not null default now(),

  constraint solicitacao_esquecimento_estado_valido check (
    estado in ('recebido', 'dados_apagados', 'email_enviado', 'concluido')
  ),
  constraint solicitacao_esquecimento_falha_tamanho check (
    ultima_falha_codigo is null or char_length(ultima_falha_codigo) between 1 and 160
  )
);

comment on table public.solicitacoes_esquecimento is
  'Fila operacional do direito ao esquecimento mínimo do lançamento. Não guarda e-mail nem o corpo da confirmação; a conta Auth só é invalidada depois do e-mail (DADOS-04/AD-105). Grupo LGPD 1 enquanto o pedido está aberto.';

alter table public.solicitacoes_esquecimento enable row level security;
revoke all on public.solicitacoes_esquecimento from public, anon, authenticated;

-- ── Porta nominal e apagamento transacional ────────────────────────────────

create or replace function public.apagar_dados_do_usuario(p_user_id uuid)
returns public.solicitacoes_esquecimento
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.solicitacoes_esquecimento;
begin
  if p_user_id is null then
    raise exception 'titular do esquecimento é obrigatório';
  end if;

  -- Serializa dois cliques/retentativas do mesmo titular sem bloquear outros.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Esta é a única abertura autorizada para os logs append-only. Como é LOCAL,
  -- a porta morre no fim da transação chamadora.
  perform set_config('app.esquecimento_user_id', p_user_id::text, true);

  insert into public.solicitacoes_esquecimento (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
    into v_pedido
    from public.solicitacoes_esquecimento
   where user_id = p_user_id
   for update;

  -- E-mail já confirmado: não repete o apagamento nem abre um segundo caminho
  -- que poderia apagar registros financeiros duas vezes.
  if v_pedido.estado in ('email_enviado', 'concluido') then
    return v_pedido;
  end if;

  -- Dependentes sem `user_id` próprio.
  delete from public.tentativa_causa_simulado where user_id = p_user_id;
  delete from public.sessoes where user_id = p_user_id;
  delete from public.plano_dia where user_id = p_user_id;

  -- Projeções mutáveis.
  delete from public.dominio_topico where user_id = p_user_id;
  delete from public.caderno_erros where user_id = p_user_id;
  delete from public.revisao_agenda where user_id = p_user_id;

  -- Log de revisão e log de respostas exigem a porta nominal nos triggers.
  delete from public.revisao_evento where user_id = p_user_id;
  delete from public.tentativas where user_id = p_user_id;

  -- Declarações, agenda, sequência e matrícula são grupo 1. `plano_bloco` e
  -- `sessao_itens` já foram alcançados por cascade acima.
  delete from public.folgas_programadas where user_id = p_user_id;
  delete from public.sequencia_dia where user_id = p_user_id;
  delete from public.perfil_estudo where user_id = p_user_id;
  delete from public.matriculas where user_id = p_user_id;

  -- O bearer de resultado não é prova fiscal e perde a validade no momento do
  -- esquecimento, mesmo que a cobrança continue retida.
  delete from public.pagamento_resultado_tokens t
   using public.pagamentos p
   where t.pagamento_id = p.id
     and p.user_id = p_user_id;

  -- Retém o mínimo financeiro: valor, meio, referência, estado, cobrança,
  -- eventos, transições, aceite e fatura. Remove identidade direta e URLs/
  -- capabilities que não são necessárias para a obrigação fiscal.
  update public.pagamentos
     set user_id = null,
         matricula_id = null,
         email = 'apagado+' || replace(id::text, '-', '') || '@invalid.local',
         asaas_cliente_id = null,
         resultado_url = null,
         resultado_boleto_url = null,
         resultado_pix_qr_code = null,
         resultado_pix_copia_e_cola = null,
         reembolso_solicitado_por = null
   where user_id = p_user_id;

  update public.solicitacoes_esquecimento
     set estado = 'dados_apagados',
         ultima_falha_codigo = null,
         dados_apagados_em = coalesce(dados_apagados_em, now()),
         atualizado_em = now()
   where user_id = p_user_id;

  select *
    into v_pedido
    from public.solicitacoes_esquecimento
   where user_id = p_user_id;

  return v_pedido;
end;
$$;

comment on function public.apagar_dados_do_usuario(uuid) is
  'Apaga grupo 1 pela porta app.esquecimento_user_id, retém o mínimo financeiro e deixa a confirmação externa em fila idempotente. Não invalida Auth nem envia e-mail sozinha (DADOS-04/AD-029).';

revoke all on function public.apagar_dados_do_usuario(uuid)
  from public, anon, authenticated;
grant execute on function public.apagar_dados_do_usuario(uuid) to service_role;

-- O inventário fechado também é consultável pela rotina de teste. A lista é
-- literal de propósito: uma tabela nova com `user_id` exige alterar o
-- apagamento e este contrato na mesma mudança, em vez de ser alcançada por SQL
-- dinâmico que poderia apagar uma tabela errada.
create or replace function public.contar_dados_grupo1_esquecimento(p_user_id uuid)
returns table (tabela text, n bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'caderno_erros', 'dominio_topico', 'folgas_programadas', 'matriculas',
    'perfil_estudo', 'plano_dia', 'revisao_agenda', 'revisao_evento',
    'sequencia_dia', 'solicitacoes_esquecimento', 'sessoes',
    'tentativa_causa_simulado', 'tentativas'
  ]
  loop
    return query execute format(
      'select %L::text, count(*)::bigint from public.%I where user_id = $1',
      v_tabela,
      v_tabela
    ) using p_user_id;
  end loop;
end;
$$;

comment on function public.contar_dados_grupo1_esquecimento(uuid) is
  'Inventário fechado das tabelas com user_id que a rotina de DADOS-04 precisa alcançar. Só service_role; usado pela verificação de cobertura, não pela tela.';

revoke all on function public.contar_dados_grupo1_esquecimento(uuid)
  from public, anon, authenticated;
grant execute on function public.contar_dados_grupo1_esquecimento(uuid) to service_role;

-- ── Estado da confirmação externa ──────────────────────────────────────────

create or replace function public.registrar_falha_esquecimento(
  p_user_id uuid,
  p_codigo  text
)
returns public.solicitacoes_esquecimento
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.solicitacoes_esquecimento;
begin
  update public.solicitacoes_esquecimento
     set ultima_falha_codigo = left(nullif(btrim(p_codigo), ''), 160),
         atualizado_em = now()
   where user_id = p_user_id
     and estado in ('dados_apagados', 'email_enviado');

  if not found then
    raise exception 'pedido de esquecimento não está pronto para registrar falha';
  end if;

  select * into v_pedido
    from public.solicitacoes_esquecimento
   where user_id = p_user_id;
  return v_pedido;
end;
$$;

comment on function public.registrar_falha_esquecimento(uuid, text) is
  'Registra falha recuperável do provedor sem fingir conclusão e sem guardar o conteúdo do e-mail (DADOS-04/AD-105).';

revoke all on function public.registrar_falha_esquecimento(uuid, text)
  from public, anon, authenticated;
grant execute on function public.registrar_falha_esquecimento(uuid, text) to service_role;

create or replace function public.registrar_email_esquecimento(p_user_id uuid)
returns public.solicitacoes_esquecimento
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.solicitacoes_esquecimento;
begin
  update public.solicitacoes_esquecimento
     set estado = 'email_enviado',
         email_enviado_em = coalesce(email_enviado_em, now()),
         ultima_falha_codigo = null,
         atualizado_em = now()
   where user_id = p_user_id
     and estado in ('dados_apagados', 'email_enviado');

  if not found then
    raise exception 'pedido de esquecimento não está pronto para confirmação de e-mail';
  end if;

  select * into v_pedido
    from public.solicitacoes_esquecimento
   where user_id = p_user_id;
  return v_pedido;
end;
$$;

comment on function public.registrar_email_esquecimento(uuid) is
  'Marca que a confirmação mínima foi aceita pelo provedor. Só depois desta marca a camada Auth pode ser invalidada (DADOS-04/AD-105).';

revoke all on function public.registrar_email_esquecimento(uuid)
  from public, anon, authenticated;
grant execute on function public.registrar_email_esquecimento(uuid) to service_role;

create or replace function public.finalizar_esquecimento(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A função não pode apagar a fila enquanto a conta ainda existe: isso
  -- transformaria uma falha de Auth em falso sucesso.
  if exists (select 1 from auth.users where id = p_user_id) then
    return false;
  end if;

  delete from public.solicitacoes_esquecimento
   where user_id = p_user_id;

  return true;
end;
$$;

comment on function public.finalizar_esquecimento(uuid) is
  'Remove a fila residual somente depois que a conta Auth não existe mais. É idempotente para uma fila já removida (DADOS-04).';

revoke all on function public.finalizar_esquecimento(uuid)
  from public, anon, authenticated;
grant execute on function public.finalizar_esquecimento(uuid) to service_role;
