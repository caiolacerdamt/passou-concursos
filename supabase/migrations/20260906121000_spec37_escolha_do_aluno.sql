-- SPEC 37 · ALUNO-13 · RAIOX-19 · AD-139
--
-- `perfil_estudo.concurso_alvo` e `text` desde a SPEC 13: o aluno digitava o
-- concurso e nada acontecia. Aqui ele passa a apontar por **referencia**, e
-- `perfil_concurso.ativo` deixa de ser a chave global que decide o edital de
-- todo mundo.
--
-- A coluna de texto **fica**. Ela e a declaracao do aluno no onboarding e nao
-- e a mesma coisa que a escolha; apaga-la seria migracao destrutiva por
-- estetica.

-- Sem `on delete cascade` e sem `set null`: apagar um concurso que tem aluno
-- dentro deve **doer**. A FK restritiva e o aviso de que a operacao existe e
-- nao e rotina; quem precisa mesmo apagar tira os alunos antes.
alter table public.perfil_estudo
  add column if not exists concurso_id uuid references public.concursos(id);

comment on column public.perfil_estudo.concurso_id is
  'O concurso escolhido pelo aluno, por referencia (ALUNO-13 AC1). Nulo cai no concurso padrao; nunca deixa o plano sem projecao (AC6).';

create index if not exists perfil_estudo_concurso_idx
  on public.perfil_estudo (concurso_id)
  where concurso_id is not null;

-- ── O unico lugar que decide qual concurso e o do aluno ─────────────────────
--
-- Todo o resto (peso, plano, projecao, tela) pergunta aqui. Concentrar a
-- decisao numa funcao so e o que torna verificavel o AC "com a flag desligada,
-- o produto se comporta como hoje": com ela desligada esta funcao ignora a
-- escolha e devolve o concurso do perfil `ativo` — a mesma linha que a view
-- `raiox_peso_topico` casa hoje.
create or replace function public.concurso_do_aluno(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with flag as (
    select coalesce(
      (select valor #>> '{}' from public.configuracoes_vigentes
        where chave = 'flag.m5.multi_concurso'), 'false')::boolean as ligada
  ),
  padrao as (
    -- O concurso padrao e o do perfil marcado `ativo`: e o concurso numero 1 da
    -- migracao, e continua sendo o unico enquanto ninguem abrir outro.
    select c.id
      from public.concursos c
      join public.perfil_concurso p on p.id = c.perfil_concurso_id
     where p.ativo
     limit 1
  ),
  escolha as (
    select pe.concurso_id
      from public.perfil_estudo pe
      join flag on flag.ligada
     where pe.user_id = p_user_id
       and pe.concurso_id is not null
  )
  select coalesce((select concurso_id from escolha), (select id from padrao));
$$;

comment on function public.concurso_do_aluno(uuid) is
  'O concurso do aluno. Com flag.m5.multi_concurso desligada ignora a escolha e devolve o concurso do perfil ativo (ALUNO-13 AC5). Config ilegivel = desligada.';

-- O perfil por tras do concurso do aluno. E o parametro que `raiox_projecoes`,
-- `raiox_projecoes_materia` e a leitura da tela ja sabem receber — por isso
-- nenhuma dessas tabelas precisou de coluna nova para virar "por concurso".
create or replace function public.perfil_concurso_do_aluno(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.perfil_concurso_id
       from public.concursos c
      where c.id = public.concurso_do_aluno(p_user_id)),
    -- Concurso do aluno apagado ou banco sem concurso nenhum: cai no perfil
    -- ativo em vez de deixar o plano sem projecao (ALUNO-13 AC6).
    (select p.id from public.perfil_concurso p where p.ativo limit 1)
  );
$$;

-- ── A escolha ───────────────────────────────────────────────────────────────
--
-- Le `auth.uid()` por dentro, sempre. Aceitar o titular por parametro numa
-- funcao `security definer` concedida a `authenticated` e o buraco Major da
-- SPEC 06 — um aluno escolheria pelo outro.
create or replace function public.escolher_concurso(p_concurso_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'sem_sessao' using errcode = '28000';
  end if;

  if not coalesce(
       (select valor #>> '{}' from public.configuracoes_vigentes
         where chave = 'flag.m5.multi_concurso'), 'false')::boolean
  then
    raise exception 'multi_concurso_desligado';
  end if;

  -- So concurso publicado (ALUNO-13 AC4). Oculto e elegivel nao existem para o
  -- aluno, e a mensagem nao distingue os dois: nao ha razao de ele saber que
  -- existe um concurso em preparo.
  if not exists (
    select 1 from public.concursos c
     where c.id = p_concurso_id and c.visibilidade = 'publicado')
  then
    raise exception 'concurso_indisponivel';
  end if;

  -- Troca de concurso e UPDATE de uma coluna do perfil. `tentativas`,
  -- `dominio_topico` e a agenda de revisao nao sao tocadas: o historico e
  -- congelado (AD-042) e o dominio por assunto canonico se reaproveita sozinho
  -- nos assuntos que os dois concursos tem em comum (ALUNO-13 AC3).
  update public.perfil_estudo
     set concurso_id = p_concurso_id
   where user_id = v_user;

  if not found then
    raise exception 'perfil_inexistente';
  end if;

  return p_concurso_id;
end;
$$;

comment on function public.escolher_concurso(uuid) is
  'O aluno da sessao escolhe um concurso publicado. Nao toca em historico: a troca so muda para onde o plano e a projecao olham (ALUNO-13 AC3).';

revoke all on function public.concurso_do_aluno(uuid)          from anon, authenticated;
revoke all on function public.perfil_concurso_do_aluno(uuid)   from anon, authenticated;
revoke all on function public.escolher_concurso(uuid)          from anon;
grant execute on function public.escolher_concurso(uuid)       to authenticated;

-- ── A fronteira M4 <-> M5, agora por aluno ──────────────────────────────────
--
-- Mesma semantica da view `raiox_peso_topico`, que continua existindo intacta:
-- sem perfil, fallback 1.0 (a configuracao do edital nunca desliga o plano por
-- acidente); com perfil, o `programa_edital` e o porteiro e a projecao e a
-- unica fonte do peso. O que muda e de onde vem o perfil — do aluno, nao de uma
-- flag global.
create or replace function public.raiox_peso_do_aluno(p_user_id uuid)
returns table (topico_id uuid, peso numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with perfil as (
    select public.perfil_concurso_do_aluno(p_user_id) as id
  )
  select t.id, 1.0::numeric
    from public.topicos t
   where t.ativo
     and (select id from perfil) is null
  union all
  select r.topico_id, r.peso
    from public.raiox_projecoes r
    join public.perfil_concurso p
      on p.id = r.perfil_concurso_id and p.id = (select id from perfil)
    join public.topicos t
      on t.id = r.topico_id and t.ativo
   where r.peso > 0
     and exists (
       select 1
         from jsonb_array_elements_text(p.programa_edital) edital(topico_id)
        where edital.topico_id = r.topico_id::text
     );
$$;

comment on function public.raiox_peso_do_aluno(uuid) is
  'FRONTEIRA M4 <-> M5 por aluno (AD-139). Mesma regra da view raiox_peso_topico; so a origem do perfil muda. Com a flag desligada devolve exatamente o mesmo conjunto da view.';

revoke all on function public.raiox_peso_do_aluno(uuid) from anon, authenticated;
