-- AD-133 · item 6 de docs/planos/TRIAL-2-conversao-e-telas.md
--
-- `trial_emails_pendentes` nasceu com `user_id` **e** com o e-mail do titular em
-- coluna propria. Ela e grupo 1, e o teste de inventario do contrato nº 9 pegou
-- isso na hora — que e exatamente para o que ele existe.
--
-- O `on delete cascade` da FK para `auth.users` cobriria a linha se o apagamento
-- passasse por la. Nao passa: a rotina varre por `user_id`, tabela a tabela, e
-- o que ela nao conhece ela nao apaga. Entao a tabela entra na rotina, e entra
-- tambem na contagem que a tela do titular usa para provar o apagamento.
--
-- A funcao inteira e re-declarada, no molde da migracao da gamificacao: a
-- alteracao de inventario e a cobertura do apagamento tem de ser atomicas.

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

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  perform set_config('app.esquecimento_user_id', p_user_id::text, true);

  insert into public.solicitacoes_esquecimento (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_pedido
    from public.solicitacoes_esquecimento
   where user_id = p_user_id
   for update;

  if v_pedido.estado in ('email_enviado', 'concluido') then
    return v_pedido;
  end if;

  delete from public.tentativa_causa_simulado where user_id = p_user_id;
  delete from public.sessoes where user_id = p_user_id;
  delete from public.plano_dia where user_id = p_user_id;

  delete from public.dominio_topico where user_id = p_user_id;
  delete from public.caderno_erros where user_id = p_user_id;
  delete from public.revisao_agenda where user_id = p_user_id;
  delete from public.revisao_evento where user_id = p_user_id;
  delete from public.tentativas where user_id = p_user_id;

  -- Projeções/eventos da gamificação são grupo 1. A ordem alcança o log antes
  -- das projeções e mantém a mesma transação do pedido de esquecimento.
  delete from public.gamificacao_ponto_evento where user_id = p_user_id;
  delete from public.gamificacao_dia where user_id = p_user_id;
  delete from public.gamificacao_pontos_dia where user_id = p_user_id;
  delete from public.gamificacao_pontos where user_id = p_user_id;
  delete from public.gamificacao_missao_dia where user_id = p_user_id;
  delete from public.gamificacao_conquistas where user_id = p_user_id;

  -- A fila dos e-mails do trial e grupo 1 (AD-133): ela guarda o e-mail do
  -- titular em coluna propria. Vem ANTES de `matriculas` so por leitura — a FK
  -- e para `auth.users`, entao a ordem entre as duas nao importa aqui.
  delete from public.trial_emails_pendentes where user_id = p_user_id;

  delete from public.folgas_programadas where user_id = p_user_id;
  delete from public.sequencia_dia where user_id = p_user_id;
  delete from public.perfil_estudo where user_id = p_user_id;
  delete from public.matriculas where user_id = p_user_id;

  delete from public.pagamento_resultado_tokens t
   using public.pagamentos p
   where t.pagamento_id = p.id
     and p.user_id = p_user_id;

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

  select * into v_pedido
    from public.solicitacoes_esquecimento
   where user_id = p_user_id;
  return v_pedido;
end;
$$;

comment on function public.apagar_dados_do_usuario(uuid) is
  'Apaga grupo 1 pela porta app.esquecimento_user_id, incluindo as projecoes da gamificacao e a fila de e-mails do trial, retem o minimo financeiro e deixa a confirmacao externa em fila idempotente.';

revoke all on function public.apagar_dados_do_usuario(uuid)
  from public, anon, authenticated;
grant execute on function public.apagar_dados_do_usuario(uuid)
  to service_role;

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
    'caderno_erros', 'dominio_topico', 'folgas_programadas',
    'gamificacao_conquistas', 'gamificacao_dia', 'gamificacao_missao_dia',
    'gamificacao_ponto_evento', 'gamificacao_pontos', 'gamificacao_pontos_dia',
    'matriculas', 'perfil_estudo', 'plano_dia', 'revisao_agenda',
    'revisao_evento', 'sequencia_dia', 'solicitacoes_esquecimento',
    'sessoes', 'tentativa_causa_simulado', 'tentativas',
    'trial_emails_pendentes'
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
