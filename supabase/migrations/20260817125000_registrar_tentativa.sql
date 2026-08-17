-- ALUNO-01 AC2 · ALUNO-03 AC1/AC4 · AD-042 · AD-043
--
-- Gravar uma resposta sao tres passos que **nao podem** se separar: marcar o
-- item da sessao (o dedup), ler o snapshot da questao e inserir a tentativa. Se
-- o INSERT falhar depois de o item ter sido marcado, o item fica respondido para
-- sempre e o aluno perde a questao.
--
-- Por que uma funcao SQL e nao codigo TypeScript: o cliente do Supabase nao abre
-- transacao. Os tres passos numa funcao plpgsql sao uma instrucao so — atomicos
-- por construcao, sem transacao explicita e sem depender de o chamador lembrar
-- de abrir uma. A validacao que precisa recusar **antes** de qualquer ida ao
-- banco (ALUNO-03 AC1) continua no modulo TypeScript, que e quem fala com a tela.
--
-- `security invoker` (o default) de proposito: a RLS de `tentativas` e de
-- `sessoes` continua valendo dentro da funcao. Uma funcao `security definer`
-- aqui seria um caminho para gravar no nome de outro aluno.

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
  v_item     record;
  v_questao  record;
  v_correta  boolean;
  v_existente record;
begin
  -- Passo 1 — dedup. `where respondido_em is null` e o que faz o segundo clique
  -- nao encontrar linha. E atomico: dois cliques simultaneos disputam a mesma
  -- linha e o Postgres serializa a disputa.
  update public.sessao_itens i
     set respondido_em = now()
    from public.sessoes s
   where i.id = p_sessao_item_id
     and i.respondido_em is null
     and s.id = i.sessao_id
     and s.user_id = p_user_id
  returning i.sessao_id, i.questao_id, i.questao_versao, i.ordem into v_item;

  if not found then
    -- Ou o item nao e deste aluno / nao existe, ou ja foi respondido. Sao coisas
    -- diferentes e a tela reage diferente a cada uma.
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
    return query
      select t.id, t.respondida_em, t.correta, true
        from public.tentativas t
       where t.sessao_id = v_existente.sessao_id
         and t.questao_id = v_existente.questao_id
       order by t.respondida_em desc
       limit 1;
    return;
  end if;

  -- Passo 2 — o snapshot, lido **agora**. Reclassificar a questao amanha nao
  -- mexe no que este SELECT copiou (ALUNO-01 AC3).
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

  -- O gabarito e do banco, nunca do chamador. A IA nao decide a alternativa
  -- correta e a tela tambem nao (invariante nº4).
  v_correta := (p_resposta = v_questao.resposta_correta);

  -- Passo 3 — o INSERT. A causa entra aqui dentro, nunca por UPDATE depois.
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
      -- AD-043: no MVP toda causa e auto-relato. `sistema` fica para a deducao
      -- por IA da SPEC 29, que nasce rebaixada.
      case when p_causa is null then null else 'aluno'::public.causa_origem end
    )
    returning tentativas.id, tentativas.respondida_em, tentativas.correta, false;
end;
$$;

comment on function public.registrar_tentativa is
  'Grava uma resposta como linha permanente (ALUNO-01/ALUNO-03). Os tres passos — dedup, snapshot e INSERT — sao atomicos por serem uma funcao so. `security invoker`: a RLS continua valendo dentro dela.';

-- A funcao e o caminho de escrita do aluno logado, entao `authenticated` precisa
-- poder chama-la. Quem ela deixa gravar continua sendo decidido pela RLS e pelo
-- `s.user_id = p_user_id` do passo 1, nao pelo privilegio de execucao.
revoke all on function public.registrar_tentativa from public, anon;
grant execute on function public.registrar_tentativa to authenticated, service_role;
