-- ALUNO · checklist de estudo guiado
--
-- A marca pertence ao aluno e é um estado mutável, não um log: marcar duas
-- vezes mantém uma linha e desmarcar remove a linha. `user_id` é obrigatório
-- para que a troca de dispositivo preserve o conhecimento registrado.

create table public.recurso_visto (
  user_id   uuid not null references auth.users(id) on delete cascade,
  recurso_id uuid not null references public.recursos_estudo(id) on delete cascade,
  visto_em   timestamptz not null default now(),

  primary key (user_id, recurso_id)
);

comment on table public.recurso_visto is
  'Checklist persistido de recursos curados que o aluno já viu. Estado mutável: DELETE desmarca; não é log de tentativas.';
comment on column public.recurso_visto.visto_em is
  'Instante em que a marca foi criada. A linha sobrevive à troca de dispositivo e some no esquecimento da conta.';

create index recurso_visto_recurso_idx
  on public.recurso_visto (recurso_id, user_id);

alter table public.recurso_visto enable row level security;

revoke all on public.recurso_visto from anon, authenticated;
grant select, insert, delete on public.recurso_visto to authenticated;

create policy recurso_visto_le_o_proprio on public.recurso_visto
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.tem_matricula_ativa())
  );

create policy recurso_visto_insere_o_proprio on public.recurso_visto
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.tem_matricula_ativa())
  );

create policy recurso_visto_apaga_o_proprio on public.recurso_visto
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.tem_matricula_ativa())
  );
