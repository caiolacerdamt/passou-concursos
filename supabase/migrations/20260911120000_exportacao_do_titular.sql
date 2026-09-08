-- Exportação dos dados do titular · LGPD art. 18, II · DADOS-04 · AD-090
--
-- O direito de acesso é atendido na hora, em JSON, pela própria conta. O que
-- esta migration acrescenta é só o **registro** de que o pedido existiu: quem
-- pediu, quando, quantas linhas saíram e se o arquivo foi truncado pelo teto.
--
-- Por que uma tabela nova, e não `solicitacoes_esquecimento`: lá o `user_id` é
-- *primary key* e o estado passa por um `check` fechado do apagamento. Forçar
-- exportação naquela tabela travaria a fila do esquecimento no segundo pedido
-- do mesmo aluno — e o esquecimento é o caminho que não pode quebrar.

create table public.solicitacoes_exportacao (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  criada_em         timestamptz not null default now(),
  linhas_exportadas integer     not null,
  truncada          boolean     not null default false,

  constraint solicitacao_exportacao_linhas_nao_negativas
    check (linhas_exportadas >= 0)
);

-- Sem `unique` no `user_id` de propósito: exportar é um direito repetível, e
-- cada exercício vira uma linha. O histórico é o que torna o registro auditável.
create index solicitacoes_exportacao_por_titular
  on public.solicitacoes_exportacao (user_id, criada_em desc);

comment on table public.solicitacoes_exportacao is
  'Registro dos pedidos de exportação de dados do titular (LGPD art. 18, II). Não guarda o conteúdo exportado, só quem pediu, quando e o tamanho. Grupo LGPD 1: apagada no esquecimento.';

comment on column public.solicitacoes_exportacao.truncada is
  'Verdadeiro quando o teto por tabela cortou linhas do arquivo entregue. Existe para que um pedido incompleto seja auditável depois, e não só sinalizado dentro do JSON que o aluno levou.';

alter table public.solicitacoes_exportacao enable row level security;
revoke all on public.solicitacoes_exportacao from public, anon, authenticated;

-- Quem escreve é o servidor, com a chave de serviço, depois de tirar o titular
-- do cookie de sessão. `authenticated` não escreve aqui: se escrevesse, um
-- cliente poderia inventar o próprio histórico de exercício de direitos.

-- ── O apagamento tem de alcançar a tabela nova ─────────────────────────────
--
-- Sem este DELETE, o esquecimento deixaria para trás uma linha que diz "esta
-- pessoa existiu e pediu os dados dela" — dado identificado, exatamente o que o
-- DADOS-04 manda apagar.
--
-- A função inteira é re-declarada, no molde das migrations da gamificação e da
-- fila do trial: alteração de inventário e cobertura do apagamento têm de ser
-- atômicas. O corpo abaixo parte da versão **vigente**
-- (`20260905140000_trial_emails_no_esquecimento.sql`) e não da original da SPEC
-- 14 — partir da original apagaria os DELETEs da gamificação e da fila do
-- trial, e o `create or replace` faria isso em silêncio.

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

  -- O historico de pedidos de exportacao e dado identificado do titular:
  -- a linha diz que aquela pessoa existiu e exerceu um direito. O
  -- `on delete cascade` da FK so resolveria se o apagamento passasse por
  -- `auth.users`, e ele varre por `user_id` tabela a tabela.
  delete from public.solicitacoes_exportacao where user_id = p_user_id;

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
  'Apaga grupo 1 pela porta app.esquecimento_user_id, incluindo as projecoes da gamificacao, a fila de e-mails do trial e o historico de pedidos de exportacao, retem o minimo financeiro e deixa a confirmacao externa em fila idempotente.';

revoke all on function public.apagar_dados_do_usuario(uuid)
  from public, anon, authenticated;
grant execute on function public.apagar_dados_do_usuario(uuid)
  to service_role;


-- O inventario fechado da verificacao de cobertura acompanha: ele e quem prova,
-- tabela a tabela, que o apagamento nao deixou linha para tras. Uma tabela que
-- entra na rotina e nao entra aqui e apagada sem ninguem conseguir demonstrar.

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
    'sessoes', 'solicitacoes_exportacao', 'tentativa_causa_simulado',
    'tentativas', 'trial_emails_pendentes'
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
