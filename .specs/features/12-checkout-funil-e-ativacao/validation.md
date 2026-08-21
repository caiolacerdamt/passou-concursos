# Validação da SPEC 12

## Validation: PASS

**Result**: PASS — validação da implementação local da SPEC 12 concluída pelo
agente principal; as limitações e os casos fora do escopo estão separados abaixo.

**Data**: 2026-08-21  
**Escopo**: T112, T113, T114, T115, T116 e T117.  
**Verificador**: agente principal. Nenhum subagent ou Verifier independente foi
iniciado, por instrução explícita do usuário. O sensor de mutação scratch,
portanto, não foi executado; isso é um desvio documentado do ritual A.

## Evidências de implementação

- Checkout server-side, preço congelado, criação de cliente/cobrança e resultado seguro: `src/modules/pagamentos/checkout.ts:46` e `supabase/migrations/20260821120000_checkout_pagamento.sql:23`.
- Webhook com corpo bruto lido uma vez, content-type, token constant-time e resposta sem payload financeiro: `src/app/api/webhooks/asaas/route.ts:90` e `src/modules/pagamentos/webhook.ts:47`.
- Ativação idempotente de conta, matrícula, fatura e NF separada: `src/modules/pagamentos/ativacao.ts:38`.
- Reconciliação fora de serverless, expiração e pendência: `scripts/jobs/reconciliacao-pagamentos.mts:155`.
- Garantia, estorno condicionado à janela e encerramento server-side: `src/modules/pagamentos/garantia.ts:111` e `src/app/app/reembolso/page.tsx:49`.
- Contratos de banco para RLS, estados, idempotência, fila, fatura, checkout e reembolso: `tests/db/pagamentos-schema.test.ts:152`.

## Gates executados

| Gate | Resultado |
| --- | --- |
| `npm run test:unit` | 76 arquivos, 552 testes verdes |
| Testes específicos de T116 | 3 arquivos, 9 testes verdes |
| `npm run test:db -- tests/db/pagamentos-schema.test.ts` | 9 testes verdes |
| `npm run lint` | 0 erros, 0 avisos |
| `npx tsc --noEmit` | verde |
| `npm run build` | verde; Next 16.3.1 gerou `/app/reembolso` dinâmico |
| `validate_spec.py` | 0 erros, 1 aviso sobre perguntas externas ainda abertas |
| `validate_tasks.py` | 0 erros, 0 avisos |
| `validate_state.py` | executado após este relatório |

O primeiro acesso ao banco foi bloqueado pelo sandbox (`EACCES` na porta
5432). O teste específico foi repetido com a permissão de rede autorizada e
passou. A suíte completa de banco também foi executada com essa permissão:
42 arquivos, 321 testes verdes e 20 casos vermelhos em seis arquivos antigos
de plano/Raio-X (`tests/db/gera-plano.test.ts`, `tests/db/plano-schema.test.ts`,
`tests/db/raiox-schema.test.ts`, `tests/db/raiox-recalculo.test.ts`,
`tests/db/raiox-view-cron.test.ts` e `tests/db/raiox-plano.test.ts`). Nenhum
caso vermelho pertence ao contrato de pagamentos da SPEC 12; essas falhas
permanecem fora do escopo e não foram alteradas.

## Validação visual manual

Não foi executada pelo agente e não foi criado mockup. Para a conferência
humana, iniciar `npm run dev` e verificar em largura de celular e desktop:

- `/` — método, evidências, preços, garantia, termos e privacidade;
- `/checkout` — preço antes do meio, 18+, termos, nome e CPF/CNPJ exigidos pelo
  Asaas, sem data de nascimento;
- `/checkout/resultado/<id>` — resultado seguro sem payload bruto;
- `/app/reembolso` — dias restantes, solicitação no quinto dia e recusa no
  nono; a rota exige sessão e matrícula ativa.

O fluxo real de cobrança, webhook e NF ainda requer conta Asaas, CNPJ/regime,
contrato lido e configuração fiscal. Não foram usados dados de cliente
inventados nem segredos reais.

## Commits do lote

- `a255cbd` — `feat(pag): implementa checkout proprio` (T112)
- `df625d6` — `feat(pag): protege e torna idempotente o webhook` (T113)
- `290c7c4` — `feat(pag): ativa conta e matricula pelo pagamento` (T114)
- `da676c1` — `feat(infra): reconcilia pagamentos pendentes` (T115)
- `c77a985` — `feat(pag): implementa garantia e reembolso` (T116)
- `5669d44` — `fix(pag): protege tela de reembolso` (correção encontrada no gate integrado)
- commit do T117 — `test(pag): fecha contrato do funil e ativacao`
