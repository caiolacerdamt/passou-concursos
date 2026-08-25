-- Grupo 5 · Fase 3 — liberar o acervo restante.
--
-- Com a exigencia de explicacao fora da porta de publicacao, a unica barreira
-- que sobrava era a revisao humana por amostragem: ~119 questoes com
-- proveniencia e gabarito completos cairam no sorteio de 10% e ficaram
-- `pendente` esperando operador.
--
-- Aqui as revisoes pendentes sao aprovadas em lote por um operador ativo e
-- todas as questoes vigentes nao anuladas passam por `publicar_questao`, que
-- continua sendo a unica porta — a trava do banco segue valendo questao a
-- questao. Questao anulada nunca publica, por definicao.
--
-- Decisao do dono do produto, incluindo as questoes de conta de Matematica e
-- Matematica Financeira, publicadas sem a conferencia de calculo.

do $$
declare
  v_operador uuid;
  v_pendentes bigint[];
  v_questao record;
  v_recusadas integer := 0;
  v_publicadas integer := 0;
  v_aprovadas integer := 0;
begin
  select operador_id into v_operador
    from public.operadores
   where ativo
   order by criado_em
   limit 1;

  if v_operador is null then
    raise exception 'nenhum operador ativo para assinar a liberacao em lote';
  end if;

  -- `decidir_revisoes_em_lote` publica a questao ao aprovar, entao uma revisao
  -- pendente de questao anulada derruba o lote inteiro com `publicada_tem_
  -- gabarito`. As 20 pendentes nessa situacao sao exatamente as 20 anuladas —
  -- que nunca publicam, por definicao. Ficam pendentes, e esta certo assim.
  --
  -- A funcao tambem recusa lote fora da faixa de 1 a 50. A fatia de 50 respeita
  -- a guarda em vez de contorna-la: a funcao continua sendo a unica porta.
  loop
    select array_agg(id) into v_pendentes
      from (
        select r.id
          from public.questao_revisoes as r
          join public.questoes as q
            on q.id = r.questao_id
           and q.questao_versao = r.questao_versao
         where r.status = 'pendente'
           and q.vigente
           and not q.anulada
           and q.resposta_correta is not null
         order by r.id
         limit 50
      ) as fatia;

    exit when v_pendentes is null;

    perform public.decidir_revisoes_em_lote(
      v_pendentes,
      'aprovada',
      v_operador,
      'liberacao em lote — Grupo 5, decisao do dono do produto'
    );
    v_aprovadas := v_aprovadas + array_length(v_pendentes, 1);
  end loop;
  raise notice 'revisoes aprovadas: %', v_aprovadas;

  for v_questao in
    select id, questao_versao
      from public.questoes
     where vigente and not anulada and status <> 'publicada'
  loop
    begin
      perform public.publicar_questao(v_questao.id, v_questao.questao_versao);
      v_publicadas := v_publicadas + 1;
    exception when others then
      -- Recusa nao interrompe o lote: registra o motivo e segue.
      v_recusadas := v_recusadas + 1;
      raise notice 'recusada % v%: %', v_questao.id, v_questao.questao_versao, sqlerrm;
    end;
  end loop;

  raise notice 'publicadas: % · recusadas: %', v_publicadas, v_recusadas;
end;
$$;
