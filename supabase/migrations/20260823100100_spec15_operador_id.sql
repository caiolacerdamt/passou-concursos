-- SPEC 15 · correcao antes do commit de T118
-- `user_id` e vocabulario reservado ao titular/aluno no inventario LGPD do
-- projeto. Operador e autor administrativo e segue o mesmo padrao de
-- `alterado_por`/`decidido_por`: nome de papel, nao dado do grupo 1.

alter table public.operadores
  rename column user_id to operador_id;

create or replace function public.operador_ativo(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.operadores
     where operador_id = p_user_id and ativo
  );
$$;
