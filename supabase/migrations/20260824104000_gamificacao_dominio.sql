-- W4-B · GAM-01/02/03/04 · AD-076/071
--
-- Gamificação é uma projeção pessoal sobre o plano e os fatos do aluno. O
-- navegador só lê a RPC sem argumentos; os eventos de pontos e as projeções
-- são escritos por esta migration em funções de bastidor, com deduplicação por
-- origem. Não há ranking, liga, moeda, loja ou vidas.

-- ── Leitura segura da configuração ────────────────────────────────────────

create or replace function public.gamificacao_config_numero(
  p_chave  text,
  p_padrao integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when jsonb_typeof(valor) = 'number'
       and (valor #>> '{}') ~ '^[0-9]{1,9}$'
      then (valor #>> '{}')::integer
    end
      from public.configuracoes_vigentes
     where chave = p_chave
  ), p_padrao);
$$;

create or replace function public.gamificacao_flag_ligada()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case when jsonb_typeof(valor) = 'boolean'
                then (valor #>> '{}')::boolean
           end
      from public.configuracoes_vigentes
     where chave = 'flag.m6.gamificacao'
  ), false);
$$;

revoke all on function public.gamificacao_config_numero(text, integer)
  from public, anon, authenticated;
revoke all on function public.gamificacao_flag_ligada()
  from public, anon, authenticated;
grant execute on function public.gamificacao_config_numero(text, integer)
  to service_role;
grant execute on function public.gamificacao_flag_ligada()
  to service_role;

-- ── Projeções e eventos ────────────────────────────────────────────────────

create table public.gamificacao_dia (
  user_id              uuid        not null,
  data                 date        not null,
  estudo_meta          integer     not null default 0,
  estudo_progresso     integer     not null default 0,
  estudo_bruto         integer     not null default 0,
  questoes_meta        integer     not null default 0,
  questoes_progresso   integer     not null default 0,
  questoes_bruto       integer     not null default 0,
  revisao_meta         integer     not null default 0,
  revisao_progresso    integer     not null default 0,
  revisao_bruto        integer     not null default 0,
  atualizado_em        timestamptz not null default now(),

  primary key (user_id, data),
  constraint gamificacao_dia_valores_nao_negativos check (
    estudo_meta >= 0 and estudo_progresso >= 0 and estudo_bruto >= 0
    and questoes_meta >= 0 and questoes_progresso >= 0 and questoes_bruto >= 0
    and revisao_meta >= 0 and revisao_progresso >= 0 and revisao_bruto >= 0
  ),
  constraint gamificacao_dia_progresso_limitado check (
    estudo_progresso <= estudo_meta
    and questoes_progresso <= questoes_meta
    and revisao_progresso <= revisao_meta
  )
);

comment on table public.gamificacao_dia is
  'Projeção do anel de hoje. O progresso é limitado à meta da meta_cheia; os campos bruto preservam o valor server-trusted para auditoria (GAM-01/AD-071). Grupo LGPD 1.';

create table public.gamificacao_ponto_evento (
  id              bigint generated always as identity primary key,
  user_id         uuid        not null,
  chave_evento    text        not null,
  tipo            text        not null,
  origem_id       text        not null,
  data            date        not null,
  pontos          integer     not null,
  criado_em       timestamptz not null default now(),

  constraint gamificacao_evento_chave_tamanho check (char_length(chave_evento) between 1 and 180),
  constraint gamificacao_evento_tipo_valido check (
    tipo in ('estudo_prioritario', 'conclusao', 'revisao_no_prazo', 'recuperacao_erro')
  ),
  constraint gamificacao_evento_origem_obrigatoria check (char_length(origem_id) between 1 and 180),
  constraint gamificacao_evento_pontos_nao_negativos check (pontos >= 0),
  constraint gamificacao_evento_unico_por_origem unique (user_id, chave_evento)
);

comment on table public.gamificacao_ponto_evento is
  'Evento auditável de pontuação, com origem única. ON CONFLICT (user_id, chave_evento) torna o job idempotente e impede prêmio por repetição/duplo processamento. Grupo LGPD 1.';

create index gamificacao_evento_user_data_idx
  on public.gamificacao_ponto_evento (user_id, data desc);

create table public.gamificacao_pontos_dia (
  user_id               uuid        not null,
  data                  date        not null,
  pontos_total          integer     not null default 0,
  estudo_prioritario    integer     not null default 0,
  conclusao             integer     not null default 0,
  revisao_no_prazo      integer     not null default 0,
  recuperacao_erro      integer     not null default 0,
  atualizado_em         timestamptz not null default now(),

  primary key (user_id, data),
  constraint gamificacao_pontos_dia_nao_negativos check (
    pontos_total >= 0 and estudo_prioritario >= 0 and conclusao >= 0
    and revisao_no_prazo >= 0 and recuperacao_erro >= 0
  )
);

comment on table public.gamificacao_pontos_dia is
  'Projeção diária do placar, discriminada por sinal significativo. Reconstruída a partir dos eventos de origem (GAM-03). Grupo LGPD 1.';

create table public.gamificacao_pontos (
  user_id       uuid        primary key,
  pontos_total  integer     not null default 0,
  atualizado_em timestamptz not null default now(),

  constraint gamificacao_pontos_nao_negativos check (pontos_total >= 0)
);

comment on table public.gamificacao_pontos is
  'Placar acumulado pessoal, sem comparação com outro aluno. A soma é derivada dos eventos idempotentes. Grupo LGPD 1.';

create table public.gamificacao_missao_dia (
  user_id          uuid        not null,
  data             date        not null,
  id               text        not null,
  tipo             text        not null,
  progresso        integer     not null default 0,
  progresso_bruto  integer     not null default 0,
  meta             integer     not null default 0,
  estado           text        not null,
  atualizado_em    timestamptz not null default now(),

  primary key (user_id, data),
  constraint gamificacao_missao_tipo_valido check (
    tipo in ('concluir_piso', 'responder_questoes', 'sem_plano')
  ),
  constraint gamificacao_missao_estado_valido check (
    estado in ('pendente', 'em_andamento', 'concluida', 'indisponivel')
  ),
  constraint gamificacao_missao_valores_nao_negativos check (
    progresso >= 0 and progresso_bruto >= 0 and meta >= 0
  ),
  constraint gamificacao_missao_progresso_limitado check (progresso <= meta)
);

comment on table public.gamificacao_missao_dia is
  'Missão diária determinística sobre o plano de hoje. O progresso visual tem teto e o bruto fica preservado. Grupo LGPD 1.';

create table public.gamificacao_conquistas (
  user_id          uuid        not null,
  conquista        text        not null,
  desbloqueada_em  timestamptz not null default now(),

  primary key (user_id, conquista),
  constraint gamificacao_conquista_catalogo check (
    conquista in ('primeiro_bloco', 'primeira_revisao', 'sequencia_pessoal', 'cem_questoes')
  )
);

comment on table public.gamificacao_conquistas is
  'Conquistas pessoais, pequenas e idempotentes. Não há ranking, liga, moeda, loja ou vidas. Grupo LGPD 1.';

create index gamificacao_conquistas_user_idx
  on public.gamificacao_conquistas (user_id, desbloqueada_em);

-- ── RLS e portas de escrita ────────────────────────────────────────────────

alter table public.gamificacao_dia           enable row level security;
alter table public.gamificacao_ponto_evento enable row level security;
alter table public.gamificacao_pontos_dia   enable row level security;
alter table public.gamificacao_pontos       enable row level security;
alter table public.gamificacao_missao_dia   enable row level security;
alter table public.gamificacao_conquistas   enable row level security;

create policy gamificacao_dia_le_o_proprio on public.gamificacao_dia
  for select to authenticated using (user_id = (select auth.uid()));

create policy gamificacao_evento_le_o_proprio on public.gamificacao_ponto_evento
  for select to authenticated using (user_id = (select auth.uid()));

create policy gamificacao_pontos_dia_le_o_proprio on public.gamificacao_pontos_dia
  for select to authenticated using (user_id = (select auth.uid()));

create policy gamificacao_pontos_le_o_proprio on public.gamificacao_pontos
  for select to authenticated using (user_id = (select auth.uid()));

create policy gamificacao_missao_le_o_proprio on public.gamificacao_missao_dia
  for select to authenticated using (user_id = (select auth.uid()));

create policy gamificacao_conquistas_le_o_proprio on public.gamificacao_conquistas
  for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.gamificacao_dia,
  public.gamificacao_ponto_evento, public.gamificacao_pontos_dia,
  public.gamificacao_pontos, public.gamificacao_missao_dia,
  public.gamificacao_conquistas from anon, authenticated;

-- O log de pontos também precisa da mesma porta nominal do esquecimento que os
-- outros logs append-only do projeto. O job pode inserir; ninguém o edita.
create or replace function public.gamificacao_evento_bloqueia_mutacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception
      'gamificacao_ponto_evento e log imutavel: UPDATE proibido. Correcao = evento novo.';
  end if;

  if current_setting('app.esquecimento_user_id', true) is distinct from old.user_id::text then
    raise exception
      'DELETE em gamificacao_ponto_evento so pela rotina de esquecimento: declare app.esquecimento_user_id.';
  end if;

  return old;
end;
$$;

create or replace function public.gamificacao_evento_bloqueia_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'gamificacao_ponto_evento e log imutavel: TRUNCATE proibido.';
end;
$$;

create trigger gamificacao_evento_sem_mutacao
  before update or delete on public.gamificacao_ponto_evento
  for each row execute function public.gamificacao_evento_bloqueia_mutacao();

create trigger gamificacao_evento_sem_truncate
  before truncate on public.gamificacao_ponto_evento
  for each statement execute function public.gamificacao_evento_bloqueia_truncate();

revoke update, delete, truncate on public.gamificacao_ponto_evento
  from anon, authenticated;

-- ── Materialização server-only ─────────────────────────────────────────────

create or replace function public.materializar_gamificacao(
  p_user_id uuid,
  p_data    date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data                    date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_estudo_pontos           integer;
  v_conclusao_pontos        integer;
  v_revisao_pontos          integer;
  v_recuperacao_pontos      integer;
  v_meta_questoes           integer;
  v_meta_conquista_seq      integer;
  v_meta_conquista_questoes integer;
  v_plano_id                uuid;
  v_estudo_meta             integer := 0;
  v_estudo_bruto            integer := 0;
  v_questoes_meta           integer := 0;
  v_questoes_bruto          integer := 0;
  v_revisao_meta            integer := 0;
  v_revisao_bruto           integer := 0;
  v_piso_meta               integer := 0;
  v_piso_bruto              integer := 0;
  v_missao_id               text;
  v_missao_tipo             text;
  v_missao_meta             integer := 0;
  v_missao_bruto            integer := 0;
  v_missao_progresso        integer := 0;
  v_missao_estado           text;
  v_pontos_dia              integer := 0;
  v_pontos_total            integer := 0;
  v_estudo_dia              integer := 0;
  v_conclusao_dia           integer := 0;
  v_revisao_dia             integer := 0;
  v_recuperacao_dia         integer := 0;
  v_novos_eventos           integer := 0;
  v_linhas                  integer := 0;
begin
  if p_user_id is null then
    raise exception 'titular da gamificação é obrigatório';
  end if;

  -- A flag ilegível/desligada nunca gera pontos nem deixa uma escrita lateral.
  if not public.gamificacao_flag_ligada() then
    return 0;
  end if;

  v_estudo_pontos := public.gamificacao_config_numero('param.m6.pontos_estudo_prioritario', 10);
  v_conclusao_pontos := public.gamificacao_config_numero('param.m6.pontos_conclusao', 20);
  v_revisao_pontos := public.gamificacao_config_numero('param.m6.pontos_revisao_no_prazo', 15);
  v_recuperacao_pontos := public.gamificacao_config_numero('param.m6.pontos_recuperacao_erro', 25);
  v_meta_questoes := greatest(public.gamificacao_config_numero('param.m6.meta_missao_questoes', 10), 1);
  v_meta_conquista_seq := greatest(public.gamificacao_config_numero('param.m6.meta_conquista_sequencia', 7), 1);
  v_meta_conquista_questoes := greatest(public.gamificacao_config_numero('param.m6.meta_conquista_questoes', 100), 1);

  -- ── Eventos únicos de pontos ─────────────────────────────────────────────
  -- Sessão fechada sem tentativa nunca é sinal de estudo. O bloco é a origem,
  -- não a sessão, de modo que uma reexecução ou retomada não duplica prêmio.
  insert into public.gamificacao_ponto_evento
    (user_id, chave_evento, tipo, origem_id, data, pontos)
  select p_user_id,
         'estudo_prioritario:' || b.id::text,
         'estudo_prioritario',
         b.id::text,
         v_data,
         v_estudo_pontos
    from public.plano_dia p
    join public.plano_bloco b on b.plano_dia_id = p.id
    join public.sessoes s on s.plano_bloco_id = b.id
   where p.user_id = p_user_id
     and p.data = v_data
     and b.nivel = 'piso'
     and b.tipo <> 'revisar'
     and s.user_id = p_user_id
     and s.encerrada_em is not null
     and (s.encerrada_em at time zone 'America/Sao_Paulo')::date = v_data
     and exists (
       select 1 from public.tentativas t
        where t.user_id = p_user_id and t.sessao_id = s.id
     )
  on conflict (user_id, chave_evento) do nothing;
  get diagnostics v_linhas = row_count;
  v_novos_eventos := v_novos_eventos + v_linhas;

  insert into public.gamificacao_ponto_evento
    (user_id, chave_evento, tipo, origem_id, data, pontos)
  select p_user_id,
         'conclusao:' || b.id::text,
         'conclusao',
         b.id::text,
         v_data,
         v_conclusao_pontos
    from public.plano_dia p
    join public.plano_bloco b on b.plano_dia_id = p.id
    join public.sessoes s on s.plano_bloco_id = b.id
   where p.user_id = p_user_id
     and p.data = v_data
     and b.nivel = 'meta_cheia'
     and b.tipo <> 'revisar'
     and s.user_id = p_user_id
     and s.encerrada_em is not null
     and (s.encerrada_em at time zone 'America/Sao_Paulo')::date = v_data
     and exists (
       select 1 from public.tentativas t
        where t.user_id = p_user_id and t.sessao_id = s.id
     )
  on conflict (user_id, chave_evento) do nothing;
  get diagnostics v_linhas = row_count;
  v_novos_eventos := v_novos_eventos + v_linhas;

  -- O plano só emite revisão quando ela está devida; a presença do bloco de
  -- revisão no plano de hoje é a prova server-trusted do sinal "no prazo".
  insert into public.gamificacao_ponto_evento
    (user_id, chave_evento, tipo, origem_id, data, pontos)
  select distinct on (coalesce(b.topico_id::text, b.tipo::text || ':' || b.ordem::text))
         p_user_id,
         'revisao_no_prazo:'
           || coalesce(b.topico_id::text, b.tipo::text || ':' || b.ordem::text)
           || ':' || v_data::text,
         'revisao_no_prazo',
         b.id::text,
         v_data,
         v_revisao_pontos
    from public.plano_dia p
    join public.plano_bloco b on b.plano_dia_id = p.id
    join public.sessoes s on s.plano_bloco_id = b.id
   where p.user_id = p_user_id
     and p.data = v_data
     and b.tipo = 'revisar'
     and s.user_id = p_user_id
     and s.encerrada_em is not null
     and (s.encerrada_em at time zone 'America/Sao_Paulo')::date = v_data
     and exists (
       select 1 from public.tentativas t
        where t.user_id = p_user_id and t.sessao_id = s.id
      )
   order by coalesce(b.topico_id::text, b.tipo::text || ':' || b.ordem::text),
            case when b.nivel = 'meta_cheia' then 0 else 1 end,
            b.id
   on conflict (user_id, chave_evento) do nothing;
  get diagnostics v_linhas = row_count;
  v_novos_eventos := v_novos_eventos + v_linhas;

  -- Recuperação é um fato de tentativa posterior a um erro do próprio aluno.
  -- A chave usa a tentativa, portanto o mesmo evento nunca é contado duas vezes.
  insert into public.gamificacao_ponto_evento
    (user_id, chave_evento, tipo, origem_id, data, pontos)
  select p_user_id,
         'recuperacao_erro:' || t.id::text,
         'recuperacao_erro',
         t.id::text,
         v_data,
         v_recuperacao_pontos
    from public.tentativas t
   where t.user_id = p_user_id
     and t.correta
     and (t.respondida_em at time zone 'America/Sao_Paulo')::date = v_data
     and exists (
       select 1
         from public.tentativas anterior
        where anterior.user_id = t.user_id
          and anterior.topico_id = t.topico_id
          and not anterior.correta
          and anterior.respondida_em < t.respondida_em
     )
  on conflict (user_id, chave_evento) do nothing;
  get diagnostics v_linhas = row_count;
  v_novos_eventos := v_novos_eventos + v_linhas;

  -- ── Anel ─────────────────────────────────────────────────────────────────
  select p.id
    into v_plano_id
    from public.plano_dia p
   where p.user_id = p_user_id and p.data = v_data;

  if v_plano_id is not null then
    select
      count(*) filter (where b.nivel = 'meta_cheia' and b.tipo <> 'revisar'),
      count(*) filter (where b.nivel = 'meta_cheia' and b.tipo = 'revisar'),
      coalesce(sum(b.n_questoes) filter (where b.nivel = 'meta_cheia'), 0),
      count(*) filter (where b.nivel = 'piso')
      into v_estudo_meta, v_revisao_meta, v_questoes_meta, v_piso_meta
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id;

    -- O bloco concluído exige sessão encerrada e pelo menos uma tentativa.
    select count(distinct b.id)
      into v_estudo_bruto
      from public.plano_bloco b
      join public.sessoes s on s.plano_bloco_id = b.id
      where b.plano_dia_id = v_plano_id
        and b.nivel = 'meta_cheia'
        and b.tipo <> 'revisar'
        and s.user_id = p_user_id
        and s.encerrada_em is not null
       and exists (
         select 1 from public.tentativas t
          where t.user_id = p_user_id and t.sessao_id = s.id
       );

    select count(distinct b.id)
      into v_revisao_bruto
      from public.plano_bloco b
      join public.sessoes s on s.plano_bloco_id = b.id
      where b.plano_dia_id = v_plano_id
        and b.nivel = 'meta_cheia'
        and b.tipo = 'revisar'
        and s.user_id = p_user_id
        and s.encerrada_em is not null
       and exists (
         select 1 from public.tentativas t
          where t.user_id = p_user_id and t.sessao_id = s.id
       );

    -- O bruto conserva também questões extras/fora do plano; o anel visual
    -- continua preso ao teto da meta_cheia, mas a auditoria não perde volume.
    select count(*)
      into v_questoes_bruto
      from public.tentativas t
     where t.user_id = p_user_id
       and (t.respondida_em at time zone 'America/Sao_Paulo')::date = v_data;

    select count(distinct b.id)
      into v_piso_bruto
      from public.plano_bloco b
      join public.sessoes s on s.plano_bloco_id = b.id
      where b.plano_dia_id = v_plano_id
        and b.nivel = 'piso'
        and s.user_id = p_user_id
        and s.encerrada_em is not null
       and exists (
         select 1 from public.tentativas t
          where t.user_id = p_user_id and t.sessao_id = s.id
       );
  end if;

  v_estudo_progresso := least(v_estudo_bruto, v_estudo_meta);
  v_questoes_progresso := least(v_questoes_bruto, v_questoes_meta);
  v_revisao_progresso := least(v_revisao_bruto, v_revisao_meta);

  insert into public.gamificacao_dia (
    user_id, data,
    estudo_meta, estudo_progresso, estudo_bruto,
    questoes_meta, questoes_progresso, questoes_bruto,
    revisao_meta, revisao_progresso, revisao_bruto, atualizado_em
  ) values (
    p_user_id, v_data,
    v_estudo_meta, v_estudo_progresso, v_estudo_bruto,
    v_questoes_meta, v_questoes_progresso, v_questoes_bruto,
    v_revisao_meta, v_revisao_progresso, v_revisao_bruto, now()
  ) on conflict (user_id, data) do update set
    estudo_meta = excluded.estudo_meta,
    estudo_progresso = excluded.estudo_progresso,
    estudo_bruto = excluded.estudo_bruto,
    questoes_meta = excluded.questoes_meta,
    questoes_progresso = excluded.questoes_progresso,
    questoes_bruto = excluded.questoes_bruto,
    revisao_meta = excluded.revisao_meta,
    revisao_progresso = excluded.revisao_progresso,
    revisao_bruto = excluded.revisao_bruto,
    atualizado_em = excluded.atualizado_em;

  -- ── Pontos e missão ──────────────────────────────────────────────────────
  select
    coalesce(sum(e.pontos), 0),
    coalesce(sum(e.pontos) filter (where e.data = v_data), 0),
    coalesce(sum(e.pontos) filter (where e.tipo = 'estudo_prioritario' and e.data = v_data), 0),
    coalesce(sum(e.pontos) filter (where e.tipo = 'conclusao' and e.data = v_data), 0),
    coalesce(sum(e.pontos) filter (where e.tipo = 'revisao_no_prazo' and e.data = v_data), 0),
    coalesce(sum(e.pontos) filter (where e.tipo = 'recuperacao_erro' and e.data = v_data), 0)
    into v_pontos_total, v_pontos_dia, v_estudo_dia, v_conclusao_dia,
         v_revisao_dia, v_recuperacao_dia
    from public.gamificacao_ponto_evento e
   where e.user_id = p_user_id;

  insert into public.gamificacao_pontos_dia (
    user_id, data, pontos_total, estudo_prioritario, conclusao,
    revisao_no_prazo, recuperacao_erro, atualizado_em
  ) values (
    p_user_id, v_data, v_pontos_dia, v_estudo_dia, v_conclusao_dia,
    v_revisao_dia, v_recuperacao_dia, now()
  ) on conflict (user_id, data) do update set
    pontos_total = excluded.pontos_total,
    estudo_prioritario = excluded.estudo_prioritario,
    conclusao = excluded.conclusao,
    revisao_no_prazo = excluded.revisao_no_prazo,
    recuperacao_erro = excluded.recuperacao_erro,
    atualizado_em = excluded.atualizado_em;

  insert into public.gamificacao_pontos (user_id, pontos_total, atualizado_em)
  values (p_user_id, v_pontos_total, now())
  on conflict (user_id) do update set
    pontos_total = excluded.pontos_total,
    atualizado_em = excluded.atualizado_em;

  if v_plano_id is null then
    v_missao_id := 'missao-sem-plano:' || v_data::text;
    v_missao_tipo := 'sem_plano';
    v_missao_meta := 0;
    v_missao_bruto := 0;
    v_missao_estado := 'indisponivel';
  elsif v_piso_meta > 0 then
    v_missao_id := 'missao-piso:' || v_data::text;
    v_missao_tipo := 'concluir_piso';
    v_missao_meta := v_piso_meta;
    v_missao_bruto := v_piso_bruto;
    v_missao_estado := case
      when v_missao_bruto >= v_missao_meta then 'concluida'
      when v_missao_bruto > 0 then 'em_andamento'
      else 'pendente'
    end;
  elsif v_questoes_meta > 0 then
    v_missao_id := 'missao-questoes:' || v_data::text;
    v_missao_tipo := 'responder_questoes';
    v_missao_meta := least(greatest(v_meta_questoes, 1), greatest(v_questoes_meta, 1));
    v_missao_bruto := v_questoes_bruto;
    v_missao_estado := case
      when v_missao_bruto >= v_missao_meta then 'concluida'
      when v_missao_bruto > 0 then 'em_andamento'
      else 'pendente'
    end;
  else
    v_missao_id := 'missao-sem-plano:' || v_data::text;
    v_missao_tipo := 'sem_plano';
    v_missao_meta := 0;
    v_missao_bruto := 0;
    v_missao_estado := 'indisponivel';
  end if;
  v_missao_progresso := least(v_missao_bruto, v_missao_meta);

  insert into public.gamificacao_missao_dia (
    user_id, data, id, tipo, progresso, progresso_bruto, meta, estado, atualizado_em
  ) values (
    p_user_id, v_data, v_missao_id, v_missao_tipo, v_missao_progresso,
    v_missao_bruto, v_missao_meta, v_missao_estado, now()
  ) on conflict (user_id, data) do update set
    id = excluded.id,
    tipo = excluded.tipo,
    progresso = excluded.progresso,
    progresso_bruto = excluded.progresso_bruto,
    meta = excluded.meta,
    estado = excluded.estado,
    atualizado_em = excluded.atualizado_em;

  -- ── Conquistas idempotentes ──────────────────────────────────────────────
  insert into public.gamificacao_conquistas (user_id, conquista)
  select p_user_id, 'primeiro_bloco'
   where exists (
     select 1 from public.gamificacao_ponto_evento e
      where e.user_id = p_user_id
        and e.tipo in ('estudo_prioritario', 'conclusao')
   )
  on conflict (user_id, conquista) do nothing;

  insert into public.gamificacao_conquistas (user_id, conquista)
  select p_user_id, 'primeira_revisao'
   where exists (
     select 1 from public.gamificacao_ponto_evento e
      where e.user_id = p_user_id and e.tipo = 'revisao_no_prazo'
   )
  on conflict (user_id, conquista) do nothing;

  insert into public.gamificacao_conquistas (user_id, conquista)
  select p_user_id, 'sequencia_pessoal'
   where coalesce((
     select max(s.sequencia) from public.sequencia_dia s where s.user_id = p_user_id
   ), 0) >= v_meta_conquista_seq
  on conflict (user_id, conquista) do nothing;

  insert into public.gamificacao_conquistas (user_id, conquista)
  select p_user_id, 'cem_questoes'
   where (
     select count(*) from public.tentativas t where t.user_id = p_user_id
   ) >= v_meta_conquista_questoes
  on conflict (user_id, conquista) do nothing;

  return v_novos_eventos;
end;
$$;

comment on function public.materializar_gamificacao(uuid, date) is
  'Materializa anel, pontos, missão e conquistas para um titular/data. Server-only, sem user_id vindo do navegador, idempotente por origem e reconstruível dos fatos (GAM-01/03/04).';

revoke all on function public.materializar_gamificacao(uuid, date)
  from public, anon, authenticated;
grant execute on function public.materializar_gamificacao(uuid, date)
  to service_role;

-- ── Contrato de leitura ────────────────────────────────────────────────────

create or replace function public.consultar_gamificacao_do_dia()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id       uuid := auth.uid();
  v_data          date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ligada        boolean;
  v_anel          record;
  v_pontos_dia    record;
  v_pontos_total  record;
  v_missao        record;
  v_sequencia     jsonb;
  v_conquistas    jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object(
      'data', v_data,
      'habilitada', false,
      'estado', 'desligada',
      'anel', jsonb_build_object(
        'estudo', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'percentual', 0, 'concluido', false),
        'questoes', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'percentual', 0, 'concluido', false),
        'revisao', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'percentual', 0, 'concluido', false)
      ),
      'pontos', jsonb_build_object(
        'dia', 0, 'total', 0,
        'discriminacao', jsonb_build_object(
          'estudo_prioritario', 0, 'conclusao', 0,
          'revisao_no_prazo', 0, 'recuperacao_erro', 0
        )
      ),
      'missao', null,
      'sequencia', null,
      'conquistas', '[]'::jsonb
    );
  end if;

  v_ligada := public.gamificacao_flag_ligada();
  select to_jsonb(s) into v_sequencia
    from public.consultar_sequencia_do_dia() s;

  if not v_ligada then
    return jsonb_build_object(
      'data', v_data,
      'habilitada', false,
      'estado', 'desligada',
      'anel', jsonb_build_object(
        'estudo', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'percentual', 0, 'concluido', false),
        'questoes', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'percentual', 0, 'concluido', false),
        'revisao', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'percentual', 0, 'concluido', false)
      ),
      'pontos', jsonb_build_object(
        'dia', 0, 'total', 0,
        'discriminacao', jsonb_build_object(
          'estudo_prioritario', 0, 'conclusao', 0,
          'revisao_no_prazo', 0, 'recuperacao_erro', 0
        )
      ),
      'missao', null,
      'sequencia', v_sequencia,
      'conquistas', '[]'::jsonb
    );
  end if;

  -- A abertura da tela é a exceção pequena autorizada (1 aluno × 1 dia):
  -- atualiza somente suas projeções, sem permitir titular escolhido no payload.
  perform public.materializar_gamificacao(v_user_id, v_data);

  select * into v_anel
    from public.gamificacao_dia d
   where d.user_id = v_user_id and d.data = v_data;
  select * into v_pontos_dia
    from public.gamificacao_pontos_dia p
   where p.user_id = v_user_id and p.data = v_data;
  select * into v_pontos_total
    from public.gamificacao_pontos p
   where p.user_id = v_user_id;
  select * into v_missao
    from public.gamificacao_missao_dia m
   where m.user_id = v_user_id and m.data = v_data;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.conquista,
           'desbloqueada_em', c.desbloqueada_em
         ) order by c.conquista), '[]'::jsonb)
    into v_conquistas
    from public.gamificacao_conquistas c
   where c.user_id = v_user_id;

  if v_anel is null or v_pontos_dia is null or v_pontos_total is null or v_missao is null then
    return jsonb_build_object(
      'data', v_data,
      'habilitada', false,
      'estado', 'erro',
      'codigo_erro', 'projecao_incompleta',
      'sequencia', v_sequencia
    );
  end if;

  return jsonb_build_object(
    'data', v_data,
    'habilitada', true,
    'estado', 'ok',
    'anel', jsonb_build_object(
      'estudo', jsonb_build_object(
        'progresso', v_anel.estudo_progresso,
        'meta', v_anel.estudo_meta,
        'bruto', v_anel.estudo_bruto,
        'percentual', case when v_anel.estudo_meta = 0 then 0
                           else round(v_anel.estudo_progresso::numeric / v_anel.estudo_meta, 4) end,
        'concluido', v_anel.estudo_meta > 0 and v_anel.estudo_progresso >= v_anel.estudo_meta
      ),
      'questoes', jsonb_build_object(
        'progresso', v_anel.questoes_progresso,
        'meta', v_anel.questoes_meta,
        'bruto', v_anel.questoes_bruto,
        'percentual', case when v_anel.questoes_meta = 0 then 0
                           else round(v_anel.questoes_progresso::numeric / v_anel.questoes_meta, 4) end,
        'concluido', v_anel.questoes_meta > 0 and v_anel.questoes_progresso >= v_anel.questoes_meta
      ),
      'revisao', jsonb_build_object(
        'progresso', v_anel.revisao_progresso,
        'meta', v_anel.revisao_meta,
        'bruto', v_anel.revisao_bruto,
        'percentual', case when v_anel.revisao_meta = 0 then 0
                           else round(v_anel.revisao_progresso::numeric / v_anel.revisao_meta, 4) end,
        'concluido', v_anel.revisao_meta > 0 and v_anel.revisao_progresso >= v_anel.revisao_meta
      )
    ),
    'pontos', jsonb_build_object(
      'dia', v_pontos_dia.pontos_total,
      'total', v_pontos_total.pontos_total,
      'discriminacao', jsonb_build_object(
        'estudo_prioritario', v_pontos_dia.estudo_prioritario,
        'conclusao', v_pontos_dia.conclusao,
        'revisao_no_prazo', v_pontos_dia.revisao_no_prazo,
        'recuperacao_erro', v_pontos_dia.recuperacao_erro
      )
    ),
    'missao', jsonb_build_object(
      'id', v_missao.id,
      'tipo', v_missao.tipo,
      'progresso', v_missao.progresso,
      'progresso_bruto', v_missao.progresso_bruto,
      'meta', v_missao.meta,
      'estado', v_missao.estado
    ),
    'sequencia', v_sequencia,
    'conquistas', v_conquistas
  );
exception when others then
  -- Não vaza SQL/identidade na resposta da área logada. O contrato de
  -- TypeScript transforma este estado em erro explícito para a fronteira.
  return jsonb_build_object(
    'data', v_data,
    'habilitada', false,
    'estado', 'erro',
    'codigo_erro', 'falha_ao_calcular',
    'sequencia', v_sequencia
  );
end;
$$;

comment on function public.consultar_gamificacao_do_dia() is
  'Contrato de leitura sem user_id: deriva o titular de auth.uid(), materializa apenas seu dia e devolve anel, pontos, missão, sequência vigente e conquistas pessoais. Erro fica explícito e seguro (GAM-01/AD-071).';

revoke all on function public.consultar_gamificacao_do_dia()
  from public, anon;
grant execute on function public.consultar_gamificacao_do_dia()
  to authenticated;

-- ── LGPD: a mesma porta nominal alcança as novas tabelas ────────────────────
--
-- A rotina original é re-declarada nesta migration para que a alteração de
-- inventário e a cobertura do apagamento sejam atômicas. O evento de pontos tem
-- trigger que só aceita DELETE depois de `app.esquecimento_user_id` ser aberto.

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
  'Apaga grupo 1 pela porta app.esquecimento_user_id, incluindo as projeções/eventos da gamificação, retém o mínimo financeiro e deixa a confirmação externa em fila idempotente.';

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
    'sessoes', 'tentativa_causa_simulado', 'tentativas'
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
  'Inventário fechado das tabelas com user_id, incluindo gamificação, que a rotina de DADOS-04 precisa alcançar.';

revoke all on function public.contar_dados_grupo1_esquecimento(uuid)
  from public, anon, authenticated;
grant execute on function public.contar_dados_grupo1_esquecimento(uuid)
  to service_role;
