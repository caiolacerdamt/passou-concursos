-- W1-C · prontidão de conteúdo
--
-- Recursos de estudo são curadoria persistida, não descoberta em tempo de
-- leitura. O operador (ou uma carga service_role) escreve; o aluno matriculado
-- somente lê os recursos ativos do acervo.

create type public.tipo_recurso_estudo as enum ('video', 'artigo', 'pdf');

create table public.recursos_estudo (
  id                uuid primary key default gen_random_uuid(),
  topico_id         uuid not null references public.topicos(id),
  titulo            text not null check (length(btrim(titulo)) > 0),
  url               text not null,
  tipo              public.tipo_recurso_estudo not null,
  duracao_minutos   integer not null,
  ordem             integer not null default 1,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),

  constraint recursos_estudo_url_https check (
    url ~* '^https://[^[:space:]]+$'
  ),
  constraint recursos_estudo_duracao_positiva check (duracao_minutos > 0),
  constraint recursos_estudo_ordem_positiva check (ordem > 0),
  constraint recursos_estudo_url_unica_no_topico unique (topico_id, url)
);

comment on table public.recursos_estudo is
  'Links de estudo curados por tópico (W1-C). A leitura não busca a web nem chama IA; link quebrado é desativado ou substituído pelo operador.';
comment on column public.recursos_estudo.duracao_minutos is
  'Duração estimada do recurso em minutos, usada para orientar o bloco de estudo.';
comment on column public.recursos_estudo.ordem is
  'Ordem curada de apresentação dentro do tópico.';

create index recursos_estudo_topico_ativos_idx
  on public.recursos_estudo (topico_id, ordem, titulo)
  where ativo;

-- A leitura é conteúdo pago, como questões e tópicos. A policy não abre
-- escrita: privilégios de mutação permanecem exclusivos do service_role.
alter table public.recursos_estudo enable row level security;

revoke insert, update, delete, truncate on public.recursos_estudo
  from anon, authenticated;
grant select on public.recursos_estudo to authenticated, service_role;
grant insert, update, delete on public.recursos_estudo to service_role;

create policy recursos_estudo_so_com_matricula on public.recursos_estudo
  for select to authenticated
  using ((select public.tem_matricula_ativa()) and ativo);

-- Inventário de prontidão: uma fonte única para operador e jobs. Só a versão
-- vigente entra na conta; assim uma correção de questão não infla a cobertura.
-- `importadas` identifica a origem oficial (`real`), enquanto `publicadas` e
-- `aptas_sessao` são estados efetivos do acervo, não números de memória.
create view public.inventario_acervo
with (security_invoker = true)
as
  select
    m.id as materia_id,
    m.nome as materia,
    t.id as topico_id,
    t.nome as topico,
    count(q.id)::integer as total,
    count(q.id) filter (where q.origem = 'real')::integer as importadas,
    count(q.id) filter (where q.status = 'publicada')::integer as publicadas,
    count(q.id) filter (
      where q.status = 'publicada' and not q.anulada
    )::integer as aptas_sessao
  from public.materias as m
  join public.topicos as t on t.materia_id = m.id
  left join public.questoes as q
    on q.topico_id = t.id and q.vigente
  group by m.id, m.nome, m.ordem, t.id, t.nome, t.ordem
  order by m.ordem, m.nome, t.ordem, t.nome;

comment on view public.inventario_acervo is
  'Prontidão por matéria/tópico: total, importadas, publicadas e aptas a sessão. Conta somente questões vigentes.';

revoke all on public.inventario_acervo from anon, authenticated;
grant select on public.inventario_acervo to service_role;

-- Escrita da curadoria para Server Actions/jobs. O autor e o motivo vêm da
-- fronteira do operador; o navegador nunca escolhe esses valores de forma
-- confiável. A chave (tópico, URL) torna a carga inicial retomável.
create or replace function public.salvar_recurso_estudo_operador(
  p_recurso_id uuid,
  p_topico_id uuid,
  p_titulo text,
  p_url text,
  p_tipo public.tipo_recurso_estudo,
  p_duracao_minutos integer,
  p_ordem integer,
  p_ativo boolean,
  p_operador uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.exigir_operador_ativo(p_operador);

  if p_topico_id is null then
    raise exception 'topico_do_recurso_obrigatorio';
  end if;
  if not exists (select 1 from public.topicos where id = p_topico_id) then
    raise exception 'topico_do_recurso_nao_encontrado';
  end if;
  if length(btrim(coalesce(p_titulo, ''))) = 0 then
    raise exception 'titulo_do_recurso_obrigatorio';
  end if;
  if p_url is null or p_url !~* '^https://[^[:space:]]+$' then
    raise exception 'url_do_recurso_invalida';
  end if;
  if p_duracao_minutos is null or p_duracao_minutos <= 0 then
    raise exception 'duracao_do_recurso_invalida';
  end if;
  if p_ordem is null or p_ordem <= 0 then
    raise exception 'ordem_do_recurso_invalida';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'motivo_da_acao_obrigatorio';
  end if;

  insert into public.recursos_estudo
    (id, topico_id, titulo, url, tipo, duracao_minutos, ordem, ativo)
  values
    (coalesce(p_recurso_id, gen_random_uuid()), p_topico_id, btrim(p_titulo),
     p_url, p_tipo, p_duracao_minutos, p_ordem, coalesce(p_ativo, true))
  on conflict (topico_id, url) do update
    set titulo = excluded.titulo,
        tipo = excluded.tipo,
        duracao_minutos = excluded.duracao_minutos,
        ordem = excluded.ordem,
        ativo = excluded.ativo,
        atualizado_em = now()
  returning id into v_id;

  perform public.registrar_acao_operador(
    p_operador,
    'recurso_estudo_salvo',
    'recurso_estudo',
    v_id::text,
    btrim(p_motivo),
    jsonb_build_object(
      'topico_id', p_topico_id,
      'tipo', p_tipo,
      'ativo', coalesce(p_ativo, true)
    )
  );
  return v_id;
end;
$$;

revoke all on function public.salvar_recurso_estudo_operador(
  uuid, uuid, text, text, public.tipo_recurso_estudo, integer, integer,
  boolean, uuid, text
) from public, anon, authenticated;
grant execute on function public.salvar_recurso_estudo_operador(
  uuid, uuid, text, text, public.tipo_recurso_estudo, integer, integer,
  boolean, uuid, text
) to service_role;
