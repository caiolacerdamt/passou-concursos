-- W1-A · ALUNO-02/ALUNO-09 · progresso e revisao no fechamento do bloco
--
-- A action pode ser repetida depois de uma falha de rede, de projeção ou de
-- agendamento. `tentativas` já tem deduplicação pelo item da sessão; o evento
-- de revisão também precisa de uma chave idempotente, senão a retentativa que
-- recupera um agendamento perdido duplicaria o log append-only.

alter table public.revisao_evento
  add column if not exists sessao_id uuid references public.sessoes(id) on delete cascade;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'revisao_evento_sessao_unica'
       and conrelid = 'public.revisao_evento'::regclass
  ) then
    alter table public.revisao_evento
      add constraint revisao_evento_sessao_unica unique (user_id, sessao_id);
  end if;
end;
$$;

comment on column public.revisao_evento.sessao_id is
  'Bloco Revisar que originou o evento. Nulo para jobs legados; quando preenchido, (aluno, sessao) e a chave de idempotencia da action.';

drop function if exists public.registrar_revisao(
  uuid, uuid, text, date, smallint, numeric, jsonb, smallint
);
drop function if exists public.registrar_revisao(
  uuid, uuid, text, date, smallint, numeric, jsonb, smallint, uuid
);

create or replace function public.registrar_revisao(
  p_user_id     uuid,
  p_topico_id   uuid,
  p_algoritmo   text,
  p_due         date,
  p_nota        smallint,
  p_percentual  numeric,
  p_fsrs_card   jsonb    default null,
  p_regua_passo smallint default 0,
  p_sessao_id   uuid     default null,
  p_so_agenda   boolean  default false
)
returns table (due date, algoritmo text, regua_passo smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user        uuid;
  v_sessao_user     uuid;
  v_sessao_contexto public.contexto_tentativa;
  v_sessao_fechada  timestamptz;
  v_evento          public.revisao_evento;
  v_agenda          public.revisao_agenda;
begin
  -- A action passa sempre pelo cliente da sessão. O job legado, sem sessão,
  -- continua podendo operar por qualquer aluno.
  v_auth_user := (select auth.uid());
  if v_auth_user is not null and v_auth_user <> p_user_id then
    raise exception
      'aluno_alheio: a revisao so pode ser registrada no nome de quem esta autenticado'
      using errcode = 'insufficient_privilege';
  end if;
  if v_auth_user is not null and p_sessao_id is null then
    raise exception
      'sessao_obrigatoria: chamada autenticada precisa informar o bloco concluido'
      using errcode = 'insufficient_privilege';
  end if;

  if p_sessao_id is not null then
    select s.user_id, s.contexto, s.encerrada_em
      into v_sessao_user, v_sessao_contexto, v_sessao_fechada
      from public.sessoes s
     where s.id = p_sessao_id;

    if not found or v_sessao_user <> p_user_id then
      raise exception
        'sessao_invalida: o bloco nao pertence a este aluno'
        using errcode = 'insufficient_privilege';
    end if;
    if p_so_agenda and v_sessao_contexto not in (
      'plano'::public.contexto_tentativa,
      'treino'::public.contexto_tentativa
    ) then
      raise exception
        'sessao_invalida: somente bloco de conteudo cria agenda inicial'
        using errcode = 'check_violation';
    end if;
    if not p_so_agenda and v_sessao_contexto <> 'revisao'::public.contexto_tentativa then
      raise exception
        'sessao_invalida: somente bloco de revisao cria evento de revisao'
        using errcode = 'check_violation';
    end if;
    if v_sessao_fechada is null then
      raise exception
        'sessao_aberta: o evento so pode ser gravado depois do fechamento do bloco'
        using errcode = 'check_violation';
    end if;
    if not exists (
      select 1
        from public.tentativas t
       where t.user_id = p_user_id
         and t.sessao_id = p_sessao_id
         and t.topico_id = p_topico_id
    ) then
      raise exception
        'topico_invalido: o topico nao pertence as tentativas deste bloco'
        using errcode = 'check_violation';
    end if;
  end if;

  if p_algoritmo not in ('fsrs', 'regua_fixa') then
    raise exception 'algoritmo_desconhecido: %', p_algoritmo using errcode = 'check_violation';
  end if;

  if not p_so_agenda then
    if p_nota is null then
      raise exception
        'revisao_invalida: nota obrigatoria para evento de revisao'
        using errcode = 'check_violation';
    end if;

    -- A inserção é o único caminho que cria o fato. Em concorrência, a segunda
    -- chamada espera a primeira, perde no UNIQUE e lê a agenda já confirmada.
    insert into public.revisao_evento
      (user_id, topico_id, sessao_id, algoritmo, nota, percentual)
    values
      (p_user_id, p_topico_id, p_sessao_id, p_algoritmo, p_nota, p_percentual)
    on conflict on constraint revisao_evento_sessao_unica do nothing
    returning * into v_evento;

    if not found then
      select e.*
        into v_evento
        from public.revisao_evento e
       where e.user_id = p_user_id and e.sessao_id = p_sessao_id;

      if not found or v_evento.topico_id <> p_topico_id then
        raise exception
          'sessao_revisao_conflitante: esta sessao ja possui outro topico'
          using errcode = 'unique_violation';
      end if;

      select *
        into v_agenda
        from public.revisao_agenda a
       where a.user_id = p_user_id and a.topico_id = v_evento.topico_id;

      if not found then
        raise exception
          'sessao_revisao_incompleta: evento sem agenda confirmada'
          using errcode = 'internal_error';
      end if;

      return query select
        v_agenda.due,
        v_agenda.algoritmo,
        v_agenda.regua_passo;
      return;
    end if;
  end if;

  return query
    insert into public.revisao_agenda as a
      (user_id, topico_id, algoritmo, fsrs_card, regua_passo, due, ultima_nota, atualizado_em)
    values
      (p_user_id, p_topico_id, p_algoritmo, p_fsrs_card, p_regua_passo, p_due, p_nota, now())
    on conflict (user_id, topico_id) do update
      set algoritmo     = excluded.algoritmo,
          -- O Card do FSRS é preservado quando quem escreveu foi a régua
          -- fixa: se o aluno voltar ao FSRS, a memória acumulada continua lá.
          fsrs_card     = coalesce(excluded.fsrs_card, a.fsrs_card),
          regua_passo   = excluded.regua_passo,
          due           = excluded.due,
          ultima_nota   = excluded.ultima_nota,
          atualizado_em = now()
    returning a.due, a.algoritmo, a.regua_passo;
end;
$$;

comment on function public.registrar_revisao(uuid, uuid, text, date, smallint, numeric, jsonb, smallint, uuid, boolean) is
  'Grava evento append-only e agenda no mesmo bloco. `sessao_id` torna a conclusão idempotente; `p_so_agenda` agenda o primeiro retorno para amanhã sem fingir que o aluno já fez uma revisão.';

revoke all on function public.registrar_revisao(uuid, uuid, text, date, smallint, numeric, jsonb, smallint, uuid, boolean) from public, anon;
grant execute on function public.registrar_revisao(uuid, uuid, text, date, smallint, numeric, jsonb, smallint, uuid, boolean) to authenticated, service_role;
