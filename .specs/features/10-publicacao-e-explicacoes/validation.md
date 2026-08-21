# SPEC 10 — Validação independente e remediação

**Data:** 2026-08-21
**Verificador independente:** Mencius, primeira rodada do Ritual B
**Escopo:** os 9 Success Criteria da SPEC 10

## Resultado da primeira rodada

O verificador independente encontrou duas falhas reais na implementação inicial:

1. a trava bloqueava baixa confiança, mas não criava a pendência automática em questao_revisoes;
2. a fonte mínima confiava apenas no campo afirmacoes_externas, permitindo texto normativo não declarado.

As duas falhas foram corrigidas. O verificador não aplicou correções. Os critérios abaixo foram
rechecados pelo código e pelos testes após a correção.

| Critério | Evidência atual | Resultado |
| --- | --- | --- |
| Baixa confiança real vai para revisão | supabase/migrations/20260821093000_roteamento_qa_spec10.sql:7-50,57-106; tests/db/publicacao-explicacoes.test.ts:273-293 | PASS |
| Real sem proveniência não publica | supabase/migrations/20260821092000_trava_publicacao_spec10.sql:24-31; tests/db/acervo-proveniencia.test.ts | PASS |
| Explicação com documento grava citações conferidas | src/modules/ia/explicacao.ts:282-299; src/modules/acervo/explicacao.ts:22-42; scripts/jobs/explicacoes.mts:157-189 | PASS |
| Citação fora da fonte é rejeitada e vai à fila | src/modules/ia/explicacao.ts:282-299; scripts/jobs/explicacoes.mts:192-219 | PASS |
| Explicação que contradiz o gabarito é rejeitada | src/modules/ia/explicacao.ts:252-258; src/modules/ia/explicacao.test.ts | PASS |
| Fonte mínima não autoriza norma, prazo, percentual ou regra externa | src/modules/ia/explicacao.ts:201-220,271-280; src/modules/ia/explicacao.test.ts:194-241 | PASS |
| Duas execuções gravam uma explicação | src/modules/acervo/explicacao.ts:22-42; tests/db/publicacao-explicacoes.test.ts:181-218 | PASS |
| Ausência da API não bloqueia o núcleo | scripts/jobs/explicacoes.mts:246-265; scripts/jobs/explicacoes.test.ts:239-256 | PASS |
| Decisão registra operador e data | supabase/migrations/20260821091000_fila_revisao.sql:61-74; tests/db/publicacao-explicacoes.test.ts:239-269 | PASS |

## Gates após a correção

- npm run test:unit: 54 arquivos, 480 testes aprovados.
- npm run test:db: 37 arquivos, 319 testes aprovados.
- npm test: 91 arquivos, 799 testes aprovados.
- Teste focado da SPEC 10: 13 testes aprovados.
- npm run lint: aprovado.
- npx tsc --noEmit: aprovado.
- npm run build: aprovado.
- Sensor de mutação: não executado; o Ritual B da SPEC 10 o exclui.

O banco de desenvolvimento recebeu as migrations 20260821093000 e 20260821093500 por db push.

## Limitação do registro

A segunda rodada independente não foi concluída porque os verificadores foram interrompidos durante a
tentativa de repetição. Portanto, o achado independente registrado é o FAIL inicial, e o PASS acima é
demonstrado pelos gates e pela inspeção posterior do agente principal, não por um segundo veredito
independente. Nenhuma lacuna funcional conhecida permanece.
