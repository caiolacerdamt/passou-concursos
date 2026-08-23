-- SPEC 14 · GAM-02 · ALUNO-02 AC2 · AD-071 · AD-090
--
-- A sequência é uma projeção pequena, não um contador que o navegador pode
-- editar. O job fecha dias passados; a RPC autenticada calcula somente o dia
-- aberto, usando o plano e as sessões daquele titular.

create table public.sequencia_dia (
  user_id        uuid        not null,
  data           date        not null,
  agendado       boolean     not null,
  folga          boolean     not null,
  piso_entregue  boolean     not null,
  piso_cumprido  boolean     not null,
  estado         text        not null,
  sequencia      integer     not null,
  atualizado_em  timestamptz not null default now(),

  primary key (user_id, data),
  constraint sequencia_dia_estado_valido check (
    estado in ('cumprido', 'piso_pendente', 'fora_agenda', 'folga', 'plano_indisponivel')
  ),
  constraint sequencia_dia_nao_negativa check (sequencia >= 0)
);

comment on table public.sequencia_dia is
  'Projeção diária da sequência do aluno (GAM-02/AD-071). A agenda e a folga são fotografadas no primeiro cálculo do dia; o job pode recalcular o estado sem reabrir o log de tentativas. Grupo LGPD 1.';

comment on column public.sequencia_dia.piso_entregue is
  'Havia pelo menos um bloco nivel=piso no plano daquele dia.';

comment on column public.sequencia_dia.piso_cumprido is
  'Todos os blocos piso foram encerrados; fora da agenda e folga são não aplicáveis e não quebram a sequência.';

create index sequencia_dia_user_data_idx
  on public.sequencia_dia (user_id, data desc);

create table public.folgas_programadas (
  user_id      uuid        not null,
  data         date        not null,
  motivo       text,
  criada_em    timestamptz not null default now(),

  primary key (user_id, data),
  constraint folga_motivo_tamanho check (motivo is null or char_length(motivo) <= 160)
);

comment on table public.folgas_programadas is
  'Folga declarada pelo aluno para um dia futuro. Ela afina a sequência, não é escudo nem compra perdão (GAM-02; escudos só na SPEC 26). Grupo LGPD 1.';

create index folgas_programadas_user_data_idx
  on public.folgas_programadas (user_id, data);

-- O banco calcula a projeção, mas o navegador só pode ler a sua própria linha.
alter table public.sequencia_dia      enable row level security;
alter table public.folgas_programadas enable row level security;

create policy sequencia_dia_le_o_proprio on public.sequencia_dia
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy folgas_programadas_do_proprio on public.folgas_programadas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.sequencia_dia
  from anon, authenticated;
revoke truncate on public.folgas_programadas from anon, authenticated;

-- ── Recálculo histórico ────────────────────────────────────────────────────
--
-- A agenda nula só existe no caminho legado anterior ao onboarding da SPEC 13;
-- nesse caso, todos os dias são tratados como agendados para não transformar
-- uma conta antiga em uma conta sem sequência. Contas novas sempre gravam a
-- agenda explicitamente.

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
  -- 8406/3 é exclusivo da sequência. O job não espera outra execução longa.
  if not pg_try_advisory_xact_lock(8406, 3) then
    return -1;
  end if;

  -- O dia atual fica aberto para a tela. Só ontem ou datas anteriores podem
  -- virar fato histórico do job.
  v_ate := least(
    coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date - 1),
    (now() at time zone 'America/Sao_Paulo')::date - 1
  );

  for v_aluno in
    select p.user_id, p.dias_estudo
      from public.perfil_estudo p
     where p_user_id is null or p.user_id = p_user_id
  loop
    -- Inclui a própria projeção para conseguir retomar depois de uma falha em
    -- um dia que não tinha plano. Sem uma origem, não existe histórico a criar.
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
      -- Uma fotografia não muda só porque o aluno alterou a agenda depois.
      -- Linhas novas usam a declaração vigente; linhas existentes conservam a
      -- agenda e a folga que já foram observadas naquele dia.
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

        -- Piso vazio é um piso já satisfeito: o motor emite vazio quando não
        -- há revisão vencida, e isso não deve punir quem estudou o que havia.
        if not v_piso_entregue then
          v_piso_cumprido := true;
        else
          select not exists (
            select 1
              from public.plano_bloco b
             where b.plano_dia_id = v_plano_id
               and b.nivel = 'piso'
               and not exists (
                 select 1
                   from public.sessoes s
                  where s.plano_bloco_id = b.id
                    and s.encerrada_em is not null
               )
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
        -- Falha do job não vira punição do aluno. O dia fica visível para
        -- observabilidade e é recalculável quando o plano aparecer.
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
  'Recalcula a projeção diária da sequência até ontem. Usa o piso do plano, respeita agenda/folga, é idempotente e devolve -1 se outra execução detiver o lock (GAM-02/AD-071).';

revoke all on function public.recalcula_sequencia(uuid, date)
  from public, anon, authenticated;
grant execute on function public.recalcula_sequencia(uuid, date) to service_role;

-- ── Estado do dia ──────────────────────────────────────────────────────────

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

  select coalesce(max(s.sequencia), 0)
    into v_anterior
    from public.sequencia_dia s
   where s.user_id = v_user_id
     and s.data < v_hoje;

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
      v_piso_cumprido := true;
    else
      select not exists (
        select 1
          from public.plano_bloco b
         where b.plano_dia_id = v_plano_id
           and b.nivel = 'piso'
           and not exists (
             select 1
               from public.sessoes s
              where s.plano_bloco_id = b.id
                and s.encerrada_em is not null
           )
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
  'Calcula o anel de hoje para auth.uid(), sem user_id recebido do cliente. Não grava estado nem espera o job diário (GAM-02/AD-071).';

revoke all on function public.consultar_sequencia_do_dia()
  from public, anon;
grant execute on function public.consultar_sequencia_do_dia() to authenticated;

