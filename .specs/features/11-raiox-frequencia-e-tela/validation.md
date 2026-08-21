# Validação da SPEC 11

**Data:** 2026-08-21  
**Branch:** `codex/spec-11`  
**Ritual:** B — Verificador independente curto, sem sensor de mutação  
**Verificador:** Mendel (`01a02526-c20b-7820-beba-2ef7f32a13f6`)

## Veredito

**PASS parcial.** A implementação atende o comportamento pedido e todos os gates automatizados
passaram. O verificador registrou duas limitações de interpretação/observabilidade, sem apontar
defeito bloqueante:

1. O amortecimento reduz a influência de uma amostra pequena e a tela mostra o aviso, mas não existe
   um teto absoluto que impeça matematicamente toda linha com `n_questoes = 3` de ocupar o primeiro
   lugar. O requisito formal pede puxar a estimativa para a média, não um limite rígido de posição.
2. Uma nova execução atualiza `atualizado_em` com o horário da execução. Os valores de negócio da
   projeção são idempotentes; portanto a repetição é equivalente para o plano, mas a linha inteira
   não é byte a byte igual por causa desse metadado operacional.

## Success Criteria

| # | Critério | Resultado | Evidência |
| --- | --- | --- | --- |
| 1 | Questões inéditas não mudam a taxa | **PASS** | Filtro de origem em `supabase/migrations/20260821101000_raiox_recalculo.sql:123-128`; teste em `tests/db/raiox-recalculo.test.ts:76-115` |
| 2 | Prova recente pesa mais que prova antiga | **PASS** | Peso temporal em `supabase/migrations/20260821101000_raiox_recalculo.sql:105-111`; teste em `tests/db/raiox-recalculo.test.ts:120-145` |
| 3 | Amostra pequena é amortizada e rotulada | **PASS parcial** | Fórmula e `amostra_baixa` em `supabase/migrations/20260821101000_raiox_recalculo.sql:183-197`; rótulo em `src/modules/raiox/tela.tsx:49-55`; teste numérico em `tests/db/raiox-recalculo.test.ts:150-179`. Não há teto absoluto de ranking; limitação descrita acima. |
| 4 | Tópico fora do edital não entra no plano | **PASS** | Porteiro do programa em `supabase/migrations/20260821101000_raiox_recalculo.sql:164-177`; view em `supabase/migrations/20260821102000_raiox_integracao.sql:19-27`; tópico fora do edital é omitido da view, o que representa peso lógico zero. |
| 5 | Repetir o job mantém o resultado | **PASS parcial** | Valores de negócio e preservação em falha testados em `tests/db/raiox-recalculo.test.ts:183-206`; `atualizado_em` é renovado por execução em `supabase/migrations/20260821101000_raiox_recalculo.sql:195-199`. |
| 6 | A view reordena o plano sem alterar o motor | **PASS** | View e porteiro em `supabase/migrations/20260821102000_raiox_integracao.sql:6-27`; teste compara a definição da função e reordena o plano em `tests/db/raiox-plano.test.ts:73-103`. |
| 7 | A tela identifica linhas de pouca amostra | **PASS** | Renderização em `src/modules/raiox/tela.tsx:24-55`; teste em `src/modules/raiox/tela.test.tsx:14-39`. |

## Gates executados

| Gate | Resultado |
| --- | --- |
| `npm run test:unit` | **PASS** — 57 arquivos, 490 testes |
| `npm run test:db` | **PASS** — 41 arquivos, 332 testes |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** — rota `/app/raio-x` compilada como dinâmica |
| Teste específico T105 | **PASS** — `tests/db/raiox-plano.test.ts` |

Os testes de banco usam transações revertidas para não deixar dados de teste persistidos
(`tests/db/conexao.ts:22-39`). O verificador independente não alterou arquivos nem executou sensor
de mutação.

## Teste visual manual

A tela pode ser conferida localmente com:

```text
npm run dev
```

Depois, é necessário ativar manualmente `flag.m5.raiox`, possuir uma matrícula ativa e existir um
`perfil_concurso` ativo com projeções pré-computadas. Acessando `/app/raio-x`, a flag desligada deve
mostrar “O Raio-X está em preparação”; com a flag ligada, devem aparecer órgão, banca, tópicos,
peso, quantidade de questões, tendência e “Baseado em poucas questões” nas linhas marcadas.

Não foi necessário executar esse passo manual para concluir os gates automatizados. Ele depende de
dados de usuário e configuração no projeto Supabase de desenvolvimento.
