-- SPEC 12 / F-05 — a página pública de resultado recebe uma capability bearer
-- aleatória. O segredo nunca é persistido: somente o SHA-256 fica no banco.

create table public.pagamento_resultado_tokens (
  id            uuid primary key default gen_random_uuid(),
  pagamento_id  uuid not null unique references public.pagamentos(id) on delete cascade,
  token_hash    text not null unique,
  expira_em     timestamptz not null,
  criado_em     timestamptz not null default now(),

  constraint pagamento_resultado_token_hash_hex
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint pagamento_resultado_token_expira_depois_de_criar
    check (expira_em > criado_em)
);

create index pagamento_resultado_tokens_lookup_idx
  on public.pagamento_resultado_tokens (token_hash, expira_em);

alter table public.pagamento_resultado_tokens enable row level security;

revoke all on table public.pagamento_resultado_tokens from public, anon, authenticated;
grant all on table public.pagamento_resultado_tokens to service_role;

comment on table public.pagamento_resultado_tokens is
  'Capability bearer do resultado do checkout; guarda somente hash e expira em 48 horas.';
