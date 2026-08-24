-- Grupo 2 · Problema 2.1
--
-- Blocos `avancar` usam o contexto `plano`. Errar neles precisa alimentar o
-- caderno de erros com a causa declarada, com a mesma trava que já existe para
-- `treino`. Revisão, simulado e diagnóstico continuam sem interrupção.

alter table public.tentativas
  drop constraint causa_obrigatoria_no_treino;

alter table public.tentativas
  add constraint causa_obrigatoria_no_treino check (
    contexto not in ('treino', 'plano') or correta or causa_erro is not null
  );

create or replace function public.registrar_tentativa(
  p_user_id        uuid,
  p_sessao_item_id uuid,
  p_contexto       public.contexto_tentativa,
  p_resposta       text,
  p_tempo_ms       integer     default null,
  p_marcou_chute   boolean     default false,
  p_causa          public.causa_erro default null
)
returns table (
  tentativa_id  uuid,
  respondida_em timestamptz,
  correta       boolean,
  duplicada     boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_item      record;
  v_questao   record;
  v_correta   boolean;
  v_existente record;
  v_achou     boolean;
begin
  update public.sessao_itens i
     set respondido_em = now()
    from public.sessoes s
   where i.id = p_sessao_item_id
     and i.respondido_em is null
     and s.id = i.sessao_id
     and s.user_id = p_user_id
  returning i.sessao_id, i.questao_id, i.questao_versao, i.ordem into v_item;

  if not found then
    select i.sessao_id, i.questao_id
      into v_existente
      from public.sessao_itens i
      join public.sessoes s on s.id = i.sessao_id
     where i.id = p_sessao_item_id and s.user_id = p_user_id;

    if not found then
      raise exception 'item_inexistente: item % nao existe para este aluno', p_sessao_item_id
        using errcode = 'no_data_found';
    end if;

    -- Duplo-clique: devolve a tentativa que ja existe, sem inserir nada.
    select true into v_achou
      from public.tentativas t
     where t.sessao_id = v_existente.sessao_id
       and t.questao_id = v_existente.questao_id
     limit 1;

    if not found then
      -- Item marcado e nenhuma tentativa: estado que a atomicidade desta funcao
      -- deveria impedir. Se aparecer, e defeito nosso — e melhor gritar com nome
      -- do que devolver linha nenhuma e estourar no chamador.
      raise exception 'item_sem_tentativa: item % marcado como respondido sem tentativa gravada',
        p_sessao_item_id using errcode = 'internal_error';
    end if;

    return query
      select t.id, t.respondida_em, t.correta, true
        from public.tentativas t
       where t.sessao_id = v_existente.sessao_id
         and t.questao_id = v_existente.questao_id
       order by t.respondida_em desc
       limit 1;
    return;
  end if;

  select q.tipo_questao, q.dificuldade, q.origem, q.resposta_correta,
         t.id as topico_id, t.nome as topico_rotulo,
         m.id as materia_id, m.nome as materia_rotulo,
         pr.banca
    into v_questao
    from public.questoes q
    join public.topicos  t  on t.id = q.topico_id
    join public.materias m  on m.id = t.materia_id
    left join public.provas pr on pr.id = q.prova_id
   where q.id = v_item.questao_id and q.questao_versao = v_item.questao_versao;

  if not found then
    raise exception 'questao % versao % nao existe ou nao esta classificada',
      v_item.questao_id, v_item.questao_versao;
  end if;

  v_correta := (p_resposta = v_questao.resposta_correta);

  -- ALUNO-03 AC1, aqui e nao no CHECK: a recusa acontece **antes** do INSERT e
  -- com nome proprio, para a tela pedir a causa em vez de mostrar erro de banco.
  -- O rollback desta excecao devolve o item ao estado de nao respondido, entao o
  -- aluno responde de novo sem perder a questao.
  if p_contexto in ('treino', 'plano') and not v_correta and p_causa is null then
    raise exception
      'causa_obrigatoria: diga por que errou antes de seguir; "nao sei dizer" vale como resposta (ALUNO-03 AC1)'
      using errcode = 'check_violation';
  end if;

  return query
    insert into public.tentativas (
      user_id, questao_id, questao_versao,
      materia_id, materia_rotulo, topico_id, topico_rotulo, banca,
      tipo_questao, dificuldade, origem,
      sessao_id, contexto, ordem_na_sessao,
      resposta_dada, correta, tempo_ms, marcou_chute,
      causa_erro, causa_origem
    ) values (
      p_user_id, v_item.questao_id, v_item.questao_versao,
      v_questao.materia_id, v_questao.materia_rotulo,
      v_questao.topico_id, v_questao.topico_rotulo,
      coalesce(v_questao.banca, 'inedita'),
      v_questao.tipo_questao, v_questao.dificuldade, v_questao.origem,
      v_item.sessao_id, p_contexto, v_item.ordem,
      p_resposta, v_correta, p_tempo_ms, p_marcou_chute,
      p_causa,
      case when p_causa is null then null else 'aluno'::public.causa_origem end
    )
    returning tentativas.id, tentativas.respondida_em, tentativas.correta, false;
end;
$$;

comment on function public.registrar_tentativa is
  'Grava uma resposta como linha permanente (ALUNO-01/ALUNO-03). Dedup, snapshot e INSERT sao atomicos por serem uma funcao so. Recusa nomeada `causa_obrigatoria` antes do INSERT quando o aluno erra no treino ou no plano sem declarar a causa (ALUNO-03 AC1). `security invoker`: a RLS continua valendo dentro dela.';
