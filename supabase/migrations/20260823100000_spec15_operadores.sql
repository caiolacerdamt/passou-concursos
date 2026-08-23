-- SPEC 15 · INFRA-11 · SEC-01/03/04
-- A sessao autentica; esta allowlist autoriza. O navegador nao consulta estas
-- tabelas: a superficie passa por Server Components/Actions e pelo servico.

create table public.operadores (
  user_id    uuid primary key references auth.users(id),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users(id)
);

comment on table public.operadores is
  'Allowlist revogavel da superficie /operador. O primeiro registro e provisionado manualmente.';

create table public.operador_acoes (
  id           bigint generated always as identity primary key,
  operador_id  uuid not null references auth.users(id),
  tipo         text not null check (length(btrim(tipo)) > 0),
  entidade     text not null check (length(btrim(entidade)) > 0),
  entidade_id  text,
  motivo       text not null check (length(btrim(motivo)) > 0),
  dados        jsonb not null default '{}'::jsonb
               check (jsonb_typeof(dados) = 'object'),
  criada_em    timestamptz not null default now()
);

comment on table public.operador_acoes is
  'Trilha append-only de mutacoes do painel: quem, quando, o que e por que.';

revoke all on public.operadores from public, anon, authenticated;
revoke all on public.operador_acoes from public, anon, authenticated;
grant select, insert, update on public.operadores to service_role;
grant select, insert on public.operador_acoes to service_role;
grant usage, select on sequence public.operador_acoes_id_seq to service_role;
alter table public.operadores enable row level security;
alter table public.operador_acoes enable row level security;

create or replace function public.operador_acoes_bloqueia_mutacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'operador_acoes e append-only: % proibido', tg_op;
end;
$$;

create trigger operador_acoes_sem_mutacao
  before update or delete on public.operador_acoes
  for each row execute function public.operador_acoes_bloqueia_mutacao();

create trigger operador_acoes_sem_truncate
  before truncate on public.operador_acoes
  for each statement execute function public.operador_acoes_bloqueia_mutacao();

create or replace function public.operador_ativo(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.operadores
     where user_id = p_user_id and ativo
  );
$$;

create or replace function public.exigir_operador_ativo(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.operador_ativo(p_user_id) then
    raise exception 'operador_nao_autorizado';
  end if;
end;
$$;

create or replace function public.registrar_acao_operador(
  p_operador_id uuid,
  p_tipo text,
  p_entidade text,
  p_entidade_id text,
  p_motivo text,
  p_dados jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform public.exigir_operador_ativo(p_operador_id);
  if length(btrim(coalesce(p_tipo, ''))) = 0 then
    raise exception 'tipo_da_acao_obrigatorio';
  end if;
  if length(btrim(coalesce(p_entidade, ''))) = 0 then
    raise exception 'entidade_da_acao_obrigatoria';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_da_acao_obrigatorio';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'dados_da_acao_devem_ser_objeto';
  end if;

  insert into public.operador_acoes
    (operador_id, tipo, entidade, entidade_id, motivo, dados)
  values
    (p_operador_id, btrim(p_tipo), btrim(p_entidade), p_entidade_id,
     btrim(p_motivo), p_dados)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.operador_ativo(uuid) from public, anon, authenticated;
revoke all on function public.exigir_operador_ativo(uuid) from public, anon, authenticated;
revoke all on function public.registrar_acao_operador(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.operador_ativo(uuid) to service_role;
grant execute on function public.exigir_operador_ativo(uuid) to service_role;
grant execute on function public.registrar_acao_operador(uuid, text, text, text, text, jsonb)
  to service_role;

-- Linhas antigas podem ter motivo nulo. Da SPEC 15 em diante, toda nova troca
-- precisa explicar por que aconteceu sem reescrever o historico anterior.
create or replace function public.configuracoes_exige_motivo_spec15()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if length(btrim(coalesce(new.motivo, ''))) = 0 then
    raise exception 'motivo_configuracao_obrigatorio';
  end if;
  new.motivo := btrim(new.motivo);
  return new;
end;
$$;

create trigger configuracoes_motivo_obrigatorio_spec15
  before insert on public.configuracoes
  for each row execute function public.configuracoes_exige_motivo_spec15();
