-- BANCO-01 AC1/AC2 · BANCO-07 AC2 (metade estrutural) · AD-003 · AD-040
--
-- "Nunca publicar questao sem proveniencia" e uma proibicao absoluta do
-- AGENTS.md, e "a IA nao decide a alternativa correta" e o invariante nº4.
--
-- A escolha de forma desta migracao e uma so: a trava e `CHECK` do banco, nao
-- validacao no job. Job errado, script errado ou operador com a chave de servico
-- na mao — os tres batem na mesma parede. Validacao em codigo protege quem passa
-- pelo codigo; `CHECK` protege a tabela.
--
-- A trava e **de publicacao, nao de ingestao**: rascunho sem proveniencia e sem
-- gabarito continua entrando, porque a questao vive assim entre a extracao
-- (SPEC 08) e o cruzamento (SPEC 09). O que ela nao faz e chegar ao aluno.

-- BANCO-01 AC1. `origem <> 'real'` na frente porque inedita (`gerada_ia`) nao
-- veio de prova nenhuma e nao tem proveniencia para dar.
alter table public.questoes add constraint real_tem_proveniencia check (
  status <> 'publicada' or origem <> 'real' or fonte_citacao is not null
);

-- Proveniencia e o conjunto, nao o campo: `fonte_citacao = '{}'` passaria o
-- CHECK acima e nao diria nada ao aluno. O AD-040 lista as cinco chaves.
--
-- `?&` e o operador "contem todas estas chaves". A primeira clausula do OR e
-- necessaria pelo mesmo motivo do `alternativas_conforme_tipo`: CHECK que avalia
-- para NULL passa, e o operador com NULL a esquerda devolve NULL.
alter table public.questoes add constraint fonte_citacao_completa check (
  fonte_citacao is null
  or (
    jsonb_typeof(fonte_citacao) = 'object'
    and fonte_citacao ?& array['banca', 'ano', 'orgao', 'cargo', 'numero']
  )
);

-- Invariante nº4: a verdade e o gabarito oficial. Questao publicada sem
-- `resposta_correta` e questao que o aluno responde e o sistema nao sabe corrigir.
-- A conferencia do gabarito em si e da SPEC 09/10; o piso estrutural e aqui.
alter table public.questoes add constraint publicada_tem_gabarito check (
  status <> 'publicada' or resposta_correta is not null
);

-- BANCO-07 AC2, metade estrutural: inedita exige 100% de revisao humana antes de
-- publicar. A porta operada — fila de revisao e `questao_revisoes` — e da SPEC 10,
-- e quando existir esta trava passa a consulta-la. O que cabe aqui e fechar o
-- caminho direto: `gerada_ia` nao vira `publicada` por INSERT nem por UPDATE.
alter table public.questoes add constraint gerada_ia_passa_por_revisao check (
  origem <> 'gerada_ia' or status <> 'publicada'
);

comment on constraint real_tem_proveniencia on public.questoes is
  'BANCO-01 AC1. A trava e do banco e nao do job: script errado bate na mesma parede.';
