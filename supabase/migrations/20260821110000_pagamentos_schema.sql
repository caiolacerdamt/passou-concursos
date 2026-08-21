-- PAG-02 · PAG-05 · PAG-06 · PAG-12 · PAG-13 · INFRA-10 · AD-090
--
-- O pagamento nasce antes da conta. Estas tabelas guardam a tentativa, o
-- aceite, o evento externo, a transicao, a fatura e a pendencia de operacao.
-- Nenhuma delas e uma superficie de escrita do navegador: checkout, webhook e
-- reconciliação usam o servidor com a chave de servico.

create type public.pagamento_meio as enum (
  'CREDIT_CARD',
  'PIX',
  'BOLETO'
);

create type public.pagamento_estado as enum (
  'pendente',
  'confirmada',
  'ativada',
  'expirada',
  'reembolsada'
);

create type public.pagamento_pendencia_tipo as enum (
  'ativacao',
  'nota_fiscal',
  'reconciliacao',
  'alerta'
);

create type public.pagamento_pendencia_estado as enum (
  'aberta',
  'em_processamento',
  'resolvida',
  'expirada'
);

-- ── Compra e aceite ─────────────────────────────────────────────────────────

create table public.pagamentos (
  id                     uuid primary key default gen_random_uuid(),
  produto_id             uuid not null references public.produtos(id),
  email                  text not null,
  valor_centavos         integer not null,
  moeda                  text not null default 'BRL',
  meio                   public.pagamento_meio not null,
  parcelas               smallint not null default 1,
  referencia_interna     text not null unique,
  asaas_cobranca_id      text unique,
  estado                 public.pagamento_estado not null default 'pendente',
  user_id                uuid references auth.users(id) on delete set null,
  matricula_id           uuid references public.matriculas(id) on delete set null,
  confirmado_em          timestamptz,
  ativado_em             timestamptz,
  expirado_em            timestamptz,
  reembolsado_em         timestamptz,
  ativacao_claim_por     text,
  ativacao_claim_em      timestamptz,
  ultima_falha_codigo    text,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),

  constraint pagamentos_email_normalizado
    check (email = lower(btrim(email)) and length(email) between 3 and 320),
  constraint pagamentos_valor_positivo
    check (valor_centavos > 0),
  constraint pagamentos_moeda_brl
    check (moeda = 'BRL'),
  constraint pagamentos_meio_parcelas_coerentes
    check (
      (meio = 'CREDIT_CARD' and parcelas = 12)
      or (meio in ('PIX', 'BOLETO') and parcelas = 1)
    ),
  constraint pagamentos_referencia_preenchida
    check (length(btrim(referencia_interna)) between 8 and 120)
);

comment on table public.pagamentos is
  'Tentativa de compra com valor e meio congelados. Dado financeiro retido mesmo no esquecimento do aluno (PAG-06/DADOS-04).';

comment on column public.pagamentos.valor_centavos is
  'Valor final da cobrança em BRL, copiado da configuração no momento da compra; alteração posterior não muda esta linha.';

create index pagamentos_estado_idx
  on public.pagamentos (estado, criado_em desc);

create index pagamentos_email_idx
  on public.pagamentos (email, criado_em desc);

create index pagamentos_claim_idx
  on public.pagamentos (estado, ativacao_claim_em);

create table public.pagamento_aceites (
  id                 uuid primary key default gen_random_uuid(),
  pagamento_id       uuid not null unique references public.pagamentos(id),
  maior_de_idade     boolean not null,
  termos_versao      text not null,
  aceito_em          timestamptz not null,
  criado_em          timestamptz not null default now(),

  constraint pagamento_aceite_maioridade check (maior_de_idade is true),
  constraint pagamento_aceite_termos_preenchidos
    check (length(btrim(termos_versao)) between 1 and 80)
);

comment on table public.pagamento_aceites is
  'Prova afirmativa e datada de maioridade e aceite dos termos; não coleta data de nascimento (DADOS-11).';

-- ── Eventos, transicoes e fatura ───────────────────────────────────────────

create table public.pagamento_eventos (
  id                   uuid primary key default gen_random_uuid(),
  evento_id            text not null unique,
  tipo                 text not null,
  asaas_cobranca_id    text,
  pagamento_id         uuid references public.pagamentos(id),
  resultado            text not null default 'recebido',
  recebido_em          timestamptz not null default now(),

  constraint pagamento_evento_id_preenchido
    check (length(btrim(evento_id)) between 1 and 160),
  constraint pagamento_evento_tipo_preenchido
    check (length(btrim(tipo)) between 1 and 120),
  constraint pagamento_evento_resultado_valido
    check (resultado in ('recebido', 'duplicado', 'ignorado', 'rejeitado'))
);

comment on table public.pagamento_eventos is
  'Registro mínimo e idempotente de eventos do Asaas. O corpo bruto nunca é persistido.';

create index pagamento_eventos_cobranca_idx
  on public.pagamento_eventos (asaas_cobranca_id, recebido_em desc);

create table public.pagamento_transicoes (
  id             bigint generated always as identity primary key,
  pagamento_id   uuid not null references public.pagamentos(id),
  de_estado      public.pagamento_estado not null,
  para_estado    public.pagamento_estado not null,
  motivo         text,
  ocorrida_em    timestamptz not null default now()
);

comment on table public.pagamento_transicoes is
  'Log append-only da máquina de estados de pagamentos; correção é nova transição, nunca edição.';

create index pagamento_transicoes_pagamento_idx
  on public.pagamento_transicoes (pagamento_id, ocorrida_em);

create table public.faturas (
  id                    uuid primary key default gen_random_uuid(),
  pagamento_id          uuid not null unique references public.pagamentos(id),
  asaas_fatura_id       text unique,
  referencia_fiscal     text,
  estado                text not null default 'pendente',
  erro_codigo           text,
  criada_em             timestamptz not null default now(),
  emitida_em            timestamptz,

  constraint faturas_estado_valido
    check (estado in ('pendente', 'emitida', 'falha'))
);

comment on table public.faturas is
  'Referência fiscal da cobrança. Falha da NF vira pendência sem desfazer a ativação.';

create table public.pagamento_pendencias (
  id                    uuid primary key default gen_random_uuid(),
  pagamento_id          uuid not null references public.pagamentos(id),
  tipo                  public.pagamento_pendencia_tipo not null,
  estado                public.pagamento_pendencia_estado not null default 'aberta',
  tentativas            integer not null default 0,
  ultima_falha_codigo   text,
  proxima_tentativa_em  timestamptz,
  criada_em             timestamptz not null default now(),
  resolvida_em          timestamptz,

  constraint pagamento_pendencia_tentativas_nao_negativas
    check (tentativas >= 0)
);

comment on table public.pagamento_pendencias is
  'Fila visível de ativação, NF, reconciliação e alerta. É o caminho de recuperação de uma falha parcial.';

create unique index pagamento_pendencias_uma_aberta
  on public.pagamento_pendencias (pagamento_id, tipo)
  where estado in ('aberta', 'em_processamento');

create index pagamento_pendencias_retry_idx
  on public.pagamento_pendencias (estado, proxima_tentativa_em);

-- ── Travas append-only ──────────────────────────────────────────────────────

create or replace function public.pagamentos_bloqueia_mutacao_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'log de pagamentos e append-only: % proibido. Correção = nova linha.', tg_op;
end;
$$;

create or replace function public.pagamentos_bloqueia_truncate_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'log de pagamentos e append-only: TRUNCATE proibido.';
end;
$$;

create trigger pagamento_eventos_sem_mutacao
  before update or delete on public.pagamento_eventos
  for each row execute function public.pagamentos_bloqueia_mutacao_log();

create trigger pagamento_eventos_sem_truncate
  before truncate on public.pagamento_eventos
  for each statement execute function public.pagamentos_bloqueia_truncate_log();

create trigger pagamento_transicoes_sem_mutacao
  before update or delete on public.pagamento_transicoes
  for each row execute function public.pagamentos_bloqueia_mutacao_log();

create trigger pagamento_transicoes_sem_truncate
  before truncate on public.pagamento_transicoes
  for each statement execute function public.pagamentos_bloqueia_truncate_log();

-- ── Máquina de estados ──────────────────────────────────────────────────────

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

create trigger pagamentos_valida_estado
  before update on public.pagamentos
  for each row execute function public.pagamentos_valida_transicao();

create or replace function public.mudar_estado_pagamento(
  p_pagamento_id uuid,
  p_novo_estado public.pagamento_estado,
  p_motivo text default null
)
returns public.pagamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pagamento public.pagamentos;
begin
  update public.pagamentos
     set estado = p_novo_estado,
         ultima_falha_codigo = p_motivo
   where id = p_pagamento_id
   returning * into v_pagamento;

  if not found then
    raise exception 'pagamento inexistente: %', p_pagamento_id;
  end if;

  return v_pagamento;
end;
$$;

comment on function public.mudar_estado_pagamento(uuid, public.pagamento_estado, text) is
  'Único contrato de aplicação para mudar o estado; o trigger valida a ordem e grava a transição.';

-- Reserva condicional: duas execuções concorrentes não podem ativar a mesma
-- confirmação. Claim velho expira para que o job de reconciliação recupere uma
-- ativação abandonada sem criar nova cobrança.
create or replace function public.reservar_ativacao_pagamento(
  p_pagamento_id uuid,
  p_dono text,
  p_agora timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(btrim(p_dono)) = 0 then
    raise exception 'dono do claim e obrigatorio';
  end if;

  update public.pagamentos
     set ativacao_claim_por = p_dono,
         ativacao_claim_em = p_agora
   where id = p_pagamento_id
     and estado = 'confirmada'
     and (
       ativacao_claim_em is null
       or ativacao_claim_em < p_agora - interval '10 minutes'
     );

  return found;
end;
$$;

create or replace function public.registrar_pagamento_evento(
  p_evento_id text,
  p_tipo text,
  p_asaas_cobranca_id text default null,
  p_pagamento_id uuid default null,
  p_resultado text default 'recebido'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pagamento_eventos (
    evento_id, tipo, asaas_cobranca_id, pagamento_id, resultado
  ) values (
    p_evento_id, p_tipo, p_asaas_cobranca_id, p_pagamento_id, p_resultado
  ) on conflict (evento_id) do nothing;

  return found;
end;
$$;

-- ── RLS e privilégios ──────────────────────────────────────────────────────

revoke all on public.pagamentos,
  public.pagamento_aceites,
  public.pagamento_eventos,
  public.pagamento_transicoes,
  public.faturas,
  public.pagamento_pendencias
from anon, authenticated;

alter table public.pagamentos enable row level security;
alter table public.pagamento_aceites enable row level security;
alter table public.pagamento_eventos enable row level security;
alter table public.pagamento_transicoes enable row level security;
alter table public.faturas enable row level security;
alter table public.pagamento_pendencias enable row level security;

revoke all on function public.mudar_estado_pagamento(uuid, public.pagamento_estado, text)
  from public, anon, authenticated;
grant execute on function public.mudar_estado_pagamento(uuid, public.pagamento_estado, text)
  to service_role;

revoke all on function public.reservar_ativacao_pagamento(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reservar_ativacao_pagamento(uuid, text, timestamptz)
  to service_role;

revoke all on function public.registrar_pagamento_evento(text, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.registrar_pagamento_evento(text, text, text, uuid, text)
  to service_role;
