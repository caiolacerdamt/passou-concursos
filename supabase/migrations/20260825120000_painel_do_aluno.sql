-- PAINEL DO ALUNO - correcoes de dominio da rodada 2
--
-- A.1: o anel mede a meta_cheia e guarda o recorte do piso.
-- A.2: os dois niveis da mesma revisao compartilham a satisfacao.
-- A.3: piso vazio so cumpre o dia quando existe meta_cheia satisfeita.
-- A regra A.3 e retroativa: o recalculo pode rebaixar dias historicos que
-- antes ganhavam cumprimento por terem piso vazio.

-- A.1: recorte do piso no anel

alter table public.gamificacao_dia
  add column estudo_piso_meta integer not null default 0,
  add column estudo_piso_progresso integer not null default 0,
  add column questoes_piso_meta integer not null default 0,
  add column questoes_piso_progresso integer not null default 0,
  add column revisao_piso_meta integer not null default 0,
  add column revisao_piso_progresso integer not null default 0,
  add constraint gamificacao_dia_piso_valores_nao_negativos check (
    estudo_piso_meta >= 0 and estudo_piso_progresso >= 0
    and questoes_piso_meta >= 0 and questoes_piso_progresso >= 0
    and revisao_piso_meta >= 0 and revisao_piso_progresso >= 0
  ),
  add constraint gamificacao_dia_piso_progresso_limitado check (
    estudo_piso_progresso <= estudo_piso_meta
    and questoes_piso_progresso <= questoes_piso_meta
    and revisao_piso_progresso <= revisao_piso_meta
  ),
  add constraint gamificacao_dia_piso_meta_limitado check (
    estudo_piso_meta <= estudo_meta
    and questoes_piso_meta <= questoes_meta
    and revisao_piso_meta <= revisao_meta
  );

comment on column public.gamificacao_dia.estudo_piso_meta is
  'Quantidade de blocos de estudo do nivel piso, preservada como marca minima do anel.';
comment on column public.gamificacao_dia.estudo_piso_progresso is
  'Blocos de estudo do nivel piso satisfeitos, sem teto da meta_cheia.';
comment on column public.gamificacao_dia.questoes_piso_meta is
  'Quantidade de questoes do nivel piso, preservada como marca minima do anel.';
comment on column public.gamificacao_dia.questoes_piso_progresso is
  'Questoes respondidas no nivel piso, limitadas a questoes_piso_meta.';
comment on column public.gamificacao_dia.revisao_piso_meta is
  'Quantidade de revisoes do nivel piso, preservada como marca minima do anel.';
comment on column public.gamificacao_dia.revisao_piso_progresso is
  'Revisoes do nivel piso satisfeitas, limitadas a revisao_piso_meta.';

-- A.2: satisfacao compartilhada entre os niveis

create or replace function public.plano_bloco_satisfeito(
  p_bloco_id uuid,
  p_user_id  uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.plano_bloco b
      join public.plano_dia p on p.id = b.plano_dia_id
     where b.id = p_bloco_id
       and p.user_id = p_user_id
       and (
         exists (
           select 1
             from public.sessoes s
            where s.plano_bloco_id = b.id
              and s.user_id = p_user_id
              and s.encerrada_em is not null
         )
         or (
           b.topico_id is not null
           and exists (
             select 1
               from public.plano_bloco g
               join public.sessoes s on s.plano_bloco_id = g.id
              where g.plano_dia_id = b.plano_dia_id
                and g.tipo = b.tipo
                and g.topico_id is not null
                and g.topico_id = b.topico_id
                and s.user_id = p_user_id
                and s.encerrada_em is not null
           )
         )
       )
  );
$$;

comment on function public.plano_bloco_satisfeito(uuid, uuid) is
  'Informa se um bloco tem sessao encerrada ou se sua revisao gemea no mesmo plano, topico e tipo tem sessao encerrada. Topico nulo nunca forma gemea.';

revoke all on function public.plano_bloco_satisfeito(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.plano_bloco_satisfeito(uuid, uuid)
  to service_role;

-- A.1/A.2: materializacao do anel

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
  v_estudo_piso_bruto       integer := 0;
  v_estudo_piso_meta        integer := 0;
  v_estudo_piso_progresso   integer := 0;
  v_questoes_meta           integer := 0;
  v_questoes_bruto          integer := 0;
  v_questoes_piso_bruto     integer := 0;
  v_questoes_piso_meta      integer := 0;
  v_questoes_piso_progresso integer := 0;
  v_revisao_meta            integer := 0;
  v_revisao_bruto           integer := 0;
  v_revisao_piso_bruto      integer := 0;
  v_revisao_piso_meta       integer := 0;
  v_revisao_piso_progresso  integer := 0;
  v_piso_meta               integer := 0;
  v_piso_bruto              integer := 0;
  v_estudo_progresso        integer := 0;
  v_questoes_progresso      integer := 0;
  v_revisao_progresso       integer := 0;
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
    raise exception 'titular da gamificacao e obrigatorio';
  end if;

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

  -- Sessao fechada sem tentativa nao gera ponto. A origem continua sendo o
  -- bloco, para que uma reexecucao nao duplique premio.
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
     and (
       select anterior.correta
         from public.tentativas anterior
        where anterior.user_id = t.user_id
          and anterior.questao_id = t.questao_id
          and (
            anterior.respondida_em < t.respondida_em
            or (
              anterior.respondida_em = t.respondida_em
              and anterior.id < t.id
            )
          )
        order by anterior.respondida_em desc, anterior.id desc
        limit 1
     ) is false
  on conflict (user_id, chave_evento) do nothing;
  get diagnostics v_linhas = row_count;
  v_novos_eventos := v_novos_eventos + v_linhas;

  -- Anel: meta_cheia e recorte piso
  select p.id
    into v_plano_id
    from public.plano_dia p
   where p.user_id = p_user_id and p.data = v_data;

  if v_plano_id is not null then
    select
      count(*) filter (where b.nivel = 'meta_cheia' and b.tipo <> 'revisar'),
      count(*) filter (where b.nivel = 'meta_cheia' and b.tipo = 'revisar'),
      coalesce(sum(b.n_questoes) filter (where b.nivel = 'meta_cheia'), 0),
      count(*) filter (where b.nivel = 'piso' and b.tipo <> 'revisar'),
      coalesce(sum(b.n_questoes) filter (where b.nivel = 'piso'), 0),
      count(*) filter (where b.nivel = 'piso' and b.tipo = 'revisar'),
      count(*) filter (where b.nivel = 'piso')
      into v_estudo_meta, v_revisao_meta, v_questoes_meta,
           v_estudo_piso_meta, v_questoes_piso_meta, v_revisao_piso_meta,
           v_piso_meta
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id;

    -- A satisfacao da gemea fecha a linha dos dois niveis. Tentativa continua
    -- obrigatoria para a contagem de gamificacao, preservando sessao vazia.
    select count(distinct b.id)
      into v_estudo_bruto
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and b.tipo <> 'revisar'
       and public.plano_bloco_satisfeito(b.id, p_user_id)
       and exists (
         select 1
           from public.plano_bloco c
           join public.sessoes s on s.plano_bloco_id = c.id
           join public.tentativas t on t.sessao_id = s.id
          where c.plano_dia_id = b.plano_dia_id
            and (
              c.id = b.id
              or (
                b.topico_id is not null
                and c.topico_id is not null
                and c.topico_id = b.topico_id
                and c.tipo = b.tipo
              )
            )
            and s.user_id = p_user_id
            and s.encerrada_em is not null
            and t.user_id = p_user_id
       );

    select count(distinct b.id)
      into v_estudo_piso_bruto
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and b.nivel = 'piso'
       and b.tipo <> 'revisar'
       and public.plano_bloco_satisfeito(b.id, p_user_id)
       and exists (
         select 1
           from public.plano_bloco c
           join public.sessoes s on s.plano_bloco_id = c.id
           join public.tentativas t on t.sessao_id = s.id
          where c.plano_dia_id = b.plano_dia_id
            and (
              c.id = b.id
              or (
                b.topico_id is not null
                and c.topico_id is not null
                and c.topico_id = b.topico_id
                and c.tipo = b.tipo
              )
            )
            and s.user_id = p_user_id
            and s.encerrada_em is not null
            and t.user_id = p_user_id
       );

    select count(distinct b.id)
      into v_revisao_bruto
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and b.tipo = 'revisar'
       and public.plano_bloco_satisfeito(b.id, p_user_id)
       and exists (
         select 1
           from public.plano_bloco c
           join public.sessoes s on s.plano_bloco_id = c.id
           join public.tentativas t on t.sessao_id = s.id
          where c.plano_dia_id = b.plano_dia_id
            and (
              c.id = b.id
              or (
                b.topico_id is not null
                and c.topico_id is not null
                and c.topico_id = b.topico_id
                and c.tipo = b.tipo
              )
            )
            and s.user_id = p_user_id
            and s.encerrada_em is not null
            and t.user_id = p_user_id
       );

    select count(distinct b.id)
      into v_revisao_piso_bruto
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and b.nivel = 'piso'
       and b.tipo = 'revisar'
       and public.plano_bloco_satisfeito(b.id, p_user_id)
       and exists (
         select 1
           from public.plano_bloco c
           join public.sessoes s on s.plano_bloco_id = c.id
           join public.tentativas t on t.sessao_id = s.id
          where c.plano_dia_id = b.plano_dia_id
            and (
              c.id = b.id
              or (
                b.topico_id is not null
                and c.topico_id is not null
                and c.topico_id = b.topico_id
                and c.tipo = b.tipo
              )
            )
            and s.user_id = p_user_id
            and s.encerrada_em is not null
            and t.user_id = p_user_id
       );

    -- Bruto permanece sem teto e continua contando o volume do dia inteiro.
    select count(*)
      into v_questoes_bruto
      from public.tentativas t
     where t.user_id = p_user_id
       and (t.respondida_em at time zone 'America/Sao_Paulo')::date = v_data;

    select count(*)
      into v_questoes_piso_bruto
      from public.tentativas t
      join public.sessoes s on s.id = t.sessao_id
      join public.plano_bloco b on b.id = s.plano_bloco_id
     where t.user_id = p_user_id
       and s.user_id = p_user_id
       and b.plano_dia_id = v_plano_id
       and b.nivel = 'piso';

    select count(distinct b.id)
      into v_piso_bruto
      from public.plano_bloco b
     where b.plano_dia_id = v_plano_id
       and b.nivel = 'piso'
       and public.plano_bloco_satisfeito(b.id, p_user_id)
       and exists (
         select 1
           from public.plano_bloco c
           join public.sessoes s on s.plano_bloco_id = c.id
           join public.tentativas t on t.sessao_id = s.id
          where c.plano_dia_id = b.plano_dia_id
            and (
              c.id = b.id
              or (
                b.topico_id is not null
                and c.topico_id is not null
                and c.topico_id = b.topico_id
                and c.tipo = b.tipo
              )
            )
            and s.user_id = p_user_id
            and s.encerrada_em is not null
            and t.user_id = p_user_id
       );
  end if;

  v_estudo_progresso := least(v_estudo_bruto, v_estudo_meta);
  v_questoes_progresso := least(v_questoes_bruto, v_questoes_meta);
  v_revisao_progresso := least(v_revisao_bruto, v_revisao_meta);
  v_estudo_piso_progresso := least(v_estudo_piso_bruto, v_estudo_piso_meta);
  v_questoes_piso_progresso := least(v_questoes_piso_bruto, v_questoes_piso_meta);
  v_revisao_piso_progresso := least(v_revisao_piso_bruto, v_revisao_piso_meta);

  insert into public.gamificacao_dia (
    user_id, data,
    estudo_meta, estudo_progresso, estudo_bruto,
    estudo_piso_meta, estudo_piso_progresso,
    questoes_meta, questoes_progresso, questoes_bruto,
    questoes_piso_meta, questoes_piso_progresso,
    revisao_meta, revisao_progresso, revisao_bruto,
    revisao_piso_meta, revisao_piso_progresso, atualizado_em
  ) values (
    p_user_id, v_data,
    v_estudo_meta, v_estudo_progresso, v_estudo_bruto,
    v_estudo_piso_meta, v_estudo_piso_progresso,
    v_questoes_meta, v_questoes_progresso, v_questoes_bruto,
    v_questoes_piso_meta, v_questoes_piso_progresso,
    v_revisao_meta, v_revisao_progresso, v_revisao_bruto,
    v_revisao_piso_meta, v_revisao_piso_progresso, now()
  ) on conflict (user_id, data) do update set
    estudo_meta = excluded.estudo_meta,
    estudo_progresso = excluded.estudo_progresso,
    estudo_bruto = excluded.estudo_bruto,
    estudo_piso_meta = excluded.estudo_piso_meta,
    estudo_piso_progresso = excluded.estudo_piso_progresso,
    questoes_meta = excluded.questoes_meta,
    questoes_progresso = excluded.questoes_progresso,
    questoes_bruto = excluded.questoes_bruto,
    questoes_piso_meta = excluded.questoes_piso_meta,
    questoes_piso_progresso = excluded.questoes_piso_progresso,
    revisao_meta = excluded.revisao_meta,
    revisao_progresso = excluded.revisao_progresso,
    revisao_bruto = excluded.revisao_bruto,
    revisao_piso_meta = excluded.revisao_piso_meta,
    revisao_piso_progresso = excluded.revisao_piso_progresso,
    atualizado_em = excluded.atualizado_em;

  -- Pontos e missao
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
  'Materializa o anel da meta_cheia e preserva o recorte do piso, com satisfacao gemea para blocos duplicados. Bruto continua sem teto.';

revoke all on function public.materializar_gamificacao(uuid, date)
  from public, anon, authenticated;
grant execute on function public.materializar_gamificacao(uuid, date)
  to service_role;

-- A.1: contrato da leitura com a marca do piso em cada dimensao.

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
        'estudo', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false),
        'questoes', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false),
        'revisao', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false)
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
        'estudo', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false),
        'questoes', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false),
        'revisao', jsonb_build_object('progresso', 0, 'meta', 0, 'bruto', 0, 'piso_meta', 0, 'piso_progresso', 0, 'percentual', 0, 'concluido', false)
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

  -- A abertura da tela e a excecao autorizada para um aluno e um dia.
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
        'piso_meta', v_anel.estudo_piso_meta,
        'piso_progresso', v_anel.estudo_piso_progresso,
        'percentual', case when v_anel.estudo_meta = 0 then 0
                           else round(v_anel.estudo_progresso::numeric / v_anel.estudo_meta, 4) end,
        'concluido', v_anel.estudo_meta > 0 and v_anel.estudo_progresso >= v_anel.estudo_meta
      ),
      'questoes', jsonb_build_object(
        'progresso', v_anel.questoes_progresso,
        'meta', v_anel.questoes_meta,
        'bruto', v_anel.questoes_bruto,
        'piso_meta', v_anel.questoes_piso_meta,
        'piso_progresso', v_anel.questoes_piso_progresso,
        'percentual', case when v_anel.questoes_meta = 0 then 0
                           else round(v_anel.questoes_progresso::numeric / v_anel.questoes_meta, 4) end,
        'concluido', v_anel.questoes_meta > 0 and v_anel.questoes_progresso >= v_anel.questoes_meta
      ),
      'revisao', jsonb_build_object(
        'progresso', v_anel.revisao_progresso,
        'meta', v_anel.revisao_meta,
        'bruto', v_anel.revisao_bruto,
        'piso_meta', v_anel.revisao_piso_meta,
        'piso_progresso', v_anel.revisao_piso_progresso,
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
  'Contrato sem user_id: deriva auth.uid(), materializa o dia e devolve o anel meta_cheia com o recorte do piso.';

revoke all on function public.consultar_gamificacao_do_dia()
  from public, anon;
grant execute on function public.consultar_gamificacao_do_dia()
  to authenticated;

-- A.2/A.3: recalculo historico da sequencia

create or replace function public.recalcula_sequencia(
  p_user_id uuid default null,
  p_ate     date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ate             date;
  v_inicio          date;
  v_total           integer := 0;
  v_aluno           record;
  v_dia             date;
  v_plano_id        uuid;
  v_agendado        boolean;
  v_folga           boolean;
  v_piso_entregue   boolean;
  v_piso_cumprido   boolean;
  v_estado          text;
  v_sequencia       integer;
  v_snapshot        record;
begin
  if not pg_try_advisory_xact_lock(8406, 3) then
    return -1;
  end if;

  v_ate := least(
    coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date - 1),
    (now() at time zone 'America/Sao_Paulo')::date - 1
  );

  for v_aluno in
    select p.user_id, p.dias_estudo
      from public.perfil_estudo p
     where p_user_id is null or p.user_id = p_user_id
  loop
    select min(x.data)
      into v_inicio
      from (
        select p.data
          from public.plano_dia p
         where p.user_id = v_aluno.user_id
        union all
        select s.data
          from public.sequencia_dia s
         where s.user_id = v_aluno.user_id
      ) x;

    if v_inicio is null or v_inicio > v_ate then
      continue;
    end if;

    v_sequencia := 0;

    for v_dia in
      select gs::date
        from generate_series(v_inicio::timestamp, v_ate::timestamp, interval '1 day') gs
       order by gs
    loop
      select s.agendado, s.folga
        into v_snapshot
        from public.sequencia_dia s
       where s.user_id = v_aluno.user_id
         and s.data = v_dia;

      if found then
        v_agendado := v_snapshot.agendado;
        v_folga := v_snapshot.folga;
      else
        v_agendado := extract(dow from v_dia)::smallint = any(
          coalesce(v_aluno.dias_estudo, array[0, 1, 2, 3, 4, 5, 6]::smallint[])
        );
        select exists (
          select 1
            from public.folgas_programadas f
           where f.user_id = v_aluno.user_id
             and f.data = v_dia
        ) into v_folga;
      end if;

      v_plano_id := null;
      select p.id
        into v_plano_id
        from public.plano_dia p
       where p.user_id = v_aluno.user_id
         and p.data = v_dia;

      v_piso_entregue := false;
      v_piso_cumprido := false;
      if v_plano_id is not null then
        select exists (
          select 1
            from public.plano_bloco b
           where b.plano_dia_id = v_plano_id
             and b.nivel = 'piso'
        ) into v_piso_entregue;

        if not v_piso_entregue then
          -- A.3: piso vazio exige ao menos um bloco meta_cheia satisfeito.
          select exists (
            select 1
              from public.plano_bloco b
             where b.plano_dia_id = v_plano_id
               and b.nivel = 'meta_cheia'
               and public.plano_bloco_satisfeito(b.id, v_aluno.user_id)
          ) into v_piso_cumprido;
        else
          select not exists (
            select 1
              from public.plano_bloco b
             where b.plano_dia_id = v_plano_id
               and b.nivel = 'piso'
               and not public.plano_bloco_satisfeito(b.id, v_aluno.user_id)
          ) into v_piso_cumprido;
        end if;
      end if;

      if not v_agendado then
        v_estado := 'fora_agenda';
        v_piso_cumprido := true;
      elsif v_folga then
        v_estado := 'folga';
        v_piso_cumprido := true;
      elsif v_plano_id is null then
        v_estado := 'plano_indisponivel';
      elsif v_piso_cumprido then
        v_estado := 'cumprido';
        v_sequencia := v_sequencia + 1;
      else
        v_estado := 'piso_pendente';
        v_sequencia := 0;
      end if;

      insert into public.sequencia_dia
        (user_id, data, agendado, folga, piso_entregue, piso_cumprido, estado, sequencia, atualizado_em)
      values
        (v_aluno.user_id, v_dia, v_agendado, v_folga, v_piso_entregue,
         v_piso_cumprido, v_estado, v_sequencia, now())
      on conflict (user_id, data) do update
        set piso_entregue = excluded.piso_entregue,
            piso_cumprido = excluded.piso_cumprido,
            estado = excluded.estado,
            sequencia = excluded.sequencia,
            atualizado_em = excluded.atualizado_em;

      v_total := v_total + 1;
    end loop;
  end loop;

  return v_total;
end;
$$;

comment on function public.recalcula_sequencia(uuid, date) is
  'Recalcula a sequencia ate ontem, usa satisfacao gemea e exige meta_cheia para piso vazio. A regra de piso vazio e retroativa.';

revoke all on function public.recalcula_sequencia(uuid, date)
  from public, anon, authenticated;
grant execute on function public.recalcula_sequencia(uuid, date)
  to service_role;

-- A.2/A.3: estado de hoje

create or replace function public.consultar_sequencia_do_dia()
returns table (
  data            date,
  sequencia       integer,
  estado          text,
  piso_entregue   boolean,
  piso_cumprido   boolean,
  tem_historico   boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id          uuid := auth.uid();
  v_hoje             date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dias_estudo      smallint[];
  v_agendado         boolean;
  v_folga            boolean;
  v_plano_id         uuid;
  v_piso_entregue    boolean := false;
  v_piso_cumprido    boolean := false;
  v_estado           text;
  v_anterior         integer := 0;
  v_tem_historico    boolean := false;
begin
  if v_user_id is null then
    return;
  end if;

  select p.dias_estudo
    into v_dias_estudo
    from public.perfil_estudo p
   where p.user_id = v_user_id;

  if not found then
    return;
  end if;

  select coalesce((
    select s.sequencia
      from public.sequencia_dia s
     where s.user_id = v_user_id
       and s.data < v_hoje
     order by s.data desc
     limit 1
  ), 0)
    into v_anterior;

  select exists (
    select 1 from public.tentativas t where t.user_id = v_user_id
  ) into v_tem_historico;

  v_agendado := extract(dow from v_hoje)::smallint = any(
    coalesce(v_dias_estudo, array[0, 1, 2, 3, 4, 5, 6]::smallint[])
  );

  select exists (
    select 1
      from public.folgas_programadas f
     where f.user_id = v_user_id
       and f.data = v_hoje
  ) into v_folga;

  select p.id
    into v_plano_id
    from public.plano_dia p
   where p.user_id = v_user_id
     and p.data = v_hoje;

  if v_plano_id is not null then
    select exists (
      select 1
        from public.plano_bloco b
       where b.plano_dia_id = v_plano_id
         and b.nivel = 'piso'
    ) into v_piso_entregue;

    if not v_piso_entregue then
      -- A.3: hoje segue a mesma regra retroativa do recalculo.
      select exists (
        select 1
          from public.plano_bloco b
         where b.plano_dia_id = v_plano_id
           and b.nivel = 'meta_cheia'
           and public.plano_bloco_satisfeito(b.id, v_user_id)
      ) into v_piso_cumprido;
    else
      select not exists (
        select 1
          from public.plano_bloco b
         where b.plano_dia_id = v_plano_id
           and b.nivel = 'piso'
           and not public.plano_bloco_satisfeito(b.id, v_user_id)
      ) into v_piso_cumprido;
    end if;
  end if;

  if not v_agendado then
    v_estado := 'fora_agenda';
    v_piso_cumprido := true;
  elsif v_folga then
    v_estado := 'folga';
    v_piso_cumprido := true;
  elsif v_plano_id is null then
    v_estado := 'plano_indisponivel';
  elsif v_piso_cumprido then
    v_estado := 'cumprido';
  else
    v_estado := 'piso_pendente';
  end if;

  return query
  select v_hoje,
         case when v_estado = 'cumprido' then v_anterior + 1 else v_anterior end,
         v_estado,
         v_piso_entregue,
         v_piso_cumprido,
         v_tem_historico;
end;
$$;

comment on function public.consultar_sequencia_do_dia() is
  'Calcula a sequencia de hoje para auth.uid(), com satisfacao gemea e meta_cheia obrigatoria quando o piso esta vazio.';

revoke all on function public.consultar_sequencia_do_dia()
  from public, anon;
grant execute on function public.consultar_sequencia_do_dia()
  to authenticated;
