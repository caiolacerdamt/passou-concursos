# Validação da SPEC 12 — Checkout, funil e ativação

## Validation: PASS técnico — fechamento E2E pendente

Resultado: PASS técnico local. Os defeitos F-01 a F-06 do relatório anterior
foram corrigidos, os contratos da SPEC 12 passaram pelos gates unitários e de
banco, o sensor de discriminação matou os seis mutantes introduzidos e as rotas
públicas foram conferidas em desktop e em viewport de 360 px. Um teste E2E real
revelou o F-07 no link de definição de senha; a correção de código foi aplicada,
mas a configuração do template de e-mail no Supabase e o reteste ainda faltam.

Data: 2026-08-21
Escopo: T106–T117, migrations, gateway Asaas, webhook, ativação,
reconciliação, garantia, fatura, funil anônimo e páginas da SPEC 12.
Ritual: A.
Verificação: revisão fresh-eyes do agente principal, com sensor em worktree
temporário. Não foi iniciado um verificador separado ou subagent, conforme
instrução explícita do usuário. Essa é uma limitação de processo registrada,
não uma lacuna funcional encontrada.

## Integridade do workspace

| Marco | Evidência | Resultado |
| --- | --- | --- |
| Baseline do relatório anterior | e348753 | O relatório antigo apontava F-01 a F-06 |
| Código após as correções | 11c925b + f15b1b8 + fd896a3 | F-01 a F-07 implementados e commitados |
| Worktree de sensor | diretório temporário fora do workspace | Removido ao final |
| Workspace durante a revisão | branch codex-spec-12 | F-07 foi corrigido no código e documentado; não há alteração de segredo |
| Verificação de patch | git diff --check | PASS |

A alteração de código desta rodada é exclusivamente a correção F-07, descoberta
no teste E2E do e-mail. O sensor anterior foi executado em uma cópia descartável
e o branch principal permaneceu preservado; os novos testes cobrem o callback
SSR diretamente.

## Correções confirmadas

| Achado anterior | Correção | Evidência |
| --- | --- | --- |
| F-01 — eventos apenas declarados | Os quatro eventos agora são emitidos nos pontos reais: entrada da oferta, início do checkout, confirmação de pagamento e reconciliação. O envio é não bloqueante. | src/modules/analytics/entrada.tsx:8 · src/app/checkout/page.tsx:18 · src/app/api/webhooks/asaas/route.ts:39 · scripts/jobs/reconciliacao-pagamentos.mts:273 |
| F-02 — reembolso podia deixar acesso aberto | O fechamento local de pagamento e matrícula usa RPC transacional e idempotente; retry recupera divergências e abre pendência quando necessário. | src/modules/pagamentos/garantia.ts:214 · src/modules/pagamentos/repositorio.ts:184 · supabase/migrations/20260821130000_spec12_reembolso_nf.sql:34 |
| F-03 — cobrança paga após expiração não reabria | A reconciliação reabre exclusivamente expirada → confirmada antes de ativar. | scripts/jobs/reconciliacao-pagamentos.mts:313 · src/modules/pagamentos/repositorio.ts:117 · supabase/migrations/20260821131000_spec12_reconciliacao.sql:52 |
| F-04 — NF não era cancelada | O gateway usa o endpoint oficial de cancelamento, persiste estados finais/em processamento/negado e mantém fila operacional. Ausência de NF não bloqueia o reembolso. | src/modules/pagamentos/asaas.ts:260 · src/modules/pagamentos/garantia.ts:302 · src/modules/pagamentos/repositorio.ts:369 |
| F-05 — resultado público aceitava UUID sem contrato explícito | A URL usa capability token aleatório, guarda somente hash, aplica TTL de 48 horas e faz lookup server-side. UUID não é aceito. | src/modules/pagamentos/resultado-token.ts:10 · src/modules/pagamentos/repositorio.ts:128 · src/app/checkout/resultado/[token]/page.tsx:10 · supabase/migrations/20260821132000_spec12_resultado_token.sql:4 |
| F-06 — analytics permitia meio de pagamento | O DTO público aceita somente quatro nomes de evento e remove propriedades; PostHog recebe distinct_id anônimo e objeto de propriedades vazio. | src/modules/analytics/funil.ts:3 · src/modules/analytics/posthog.ts:82 · src/app/api/analytics/route.ts:28 |
| F-07 — link de definição de senha caía na home/login | O cliente de serviço usa fluxo implícito e o template padrão entrega tokens no fragmento, que o servidor não recebe. O novo `/auth/confirm` valida `token_hash` via `verifyOtp`, cria a sessão SSR e encaminha para `/definir-senha`. | src/app/auth/confirm/route.ts · src/app/auth/confirm/route.test.ts · src/modules/pagamentos/repositorio.ts |
| F-08 — reconciliação ignorava cobranças confirmadas | A listagem consulta `RECEIVED` e `CONFIRMED`, combina por ID e o job ativa uma cobrança `CONFIRMED` sem webhook. | src/modules/pagamentos/asaas.ts:192 · src/modules/pagamentos/asaas.test.ts:144 · scripts/jobs/reconciliacao-pagamentos.test.ts:81 |
| F-09 — transporte PostHog usava contrato legado e host amplo | O publicador usa `/i/v0/e/`, envia `distinct_id` no campo próprio, mantém `properties` vazio e rejeita o domínio da interface. | src/modules/analytics/posthog.ts:8 · src/modules/analytics/posthog.ts:82 · src/modules/analytics/posthog.test.ts:57 |

## Acceptance criteria

| Critério | Resultado | Evidência |
| --- | --- | --- |
| Visitante AC1: método, evidências, garantia, dois preços, termos e política antes do CTA | PASS | src/app/page.test.tsx:21 · src/app/page.test.tsx:24 · src/app/page.test.tsx:30; conferido também em / em desktop e 360 px |
| Visitante AC2: preço/meio visíveis, e-mail, nome, documento, 18+ e aceite datado | PASS | src/app/checkout/page.test.tsx:16 · src/app/checkout/page.test.tsx:27 · src/modules/pagamentos/contratos.test.ts:27; conferido em /checkout |
| Visitante AC3: sem 18+ ou termos não cria cobrança e não coleta nascimento | PASS | src/modules/pagamentos/contratos.test.ts:64 · src/modules/pagamentos/checkout.test.ts:130 |
| Visitante AC4: analytics indisponível não bloqueia compra | PASS | src/app/api/analytics/route.test.ts:66 · src/modules/analytics/posthog.test.ts:31 · src/modules/analytics/navegador.test.ts:27 |
| Pagamento AC1: pagamento válido cria/localiza conta, matrícula anual e senha | PASS | src/modules/pagamentos/ativacao.test.ts:79 · src/modules/pagamentos/ativacao.test.ts:81 · src/modules/pagamentos/ativacao.test.ts:83 |
| Pagamento AC2: webhook repetido processa uma vez e deixa uma conta/matrícula | PASS | src/modules/pagamentos/webhook.test.ts:83 · src/modules/pagamentos/webhook.test.ts:84 · tests/db/pagamentos-schema.test.ts:200 |
| Pagamento AC3: assinatura ausente/inválida é rejeitada antes de processar e sem PII | PASS | src/app/api/webhooks/asaas/route.test.ts:31 · src/modules/pagamentos/webhook.test.ts:58 |
| Pagamento AC4: falha de ativação vira pendência visível e alerta | PASS | src/modules/pagamentos/ativacao.test.ts:113 · src/modules/pagamentos/ativacao.test.ts:119 · src/app/api/webhooks/asaas/route.test.ts:52 |
| Pagamento AC5: webhook ausente é coberto por reconciliação, inclusive expirada-paga | PASS | scripts/jobs/reconciliacao-pagamentos.test.ts:126 · scripts/jobs/reconciliacao-pagamentos.test.ts:130 · scripts/jobs/reconciliacao-pagamentos.test.ts:131 |
| Garantia AC1: dentro de sete dias mostra restantes e permite solicitar | PASS | src/modules/pagamentos/garantia.test.ts:26 · src/modules/pagamentos/garantia.test.ts:27; a rota autenticada redireciona para login sem sessão |
| Garantia AC2: antes da confirmação/depois da janela recusa, preserva e registra tentativa | PASS | src/modules/pagamentos/garantia.test.ts:97 · src/modules/pagamentos/garantia.test.ts:100 · src/modules/pagamentos/garantia.test.ts:117 |
| Garantia AC3: estorno confirmado fecha pagamento/matrícula, encerra acesso, registra auditoria e trata NF | PASS | src/modules/pagamentos/garantia.test.ts:79 · src/modules/pagamentos/asaas.test.ts:189 · tests/db/pagamentos-schema.test.ts:476 · tests/db/pagamentos-schema.test.ts:499 |

## Requisitos e segurança

| Grupo | Resultado | Evidência |
| --- | --- | --- |
| PAG-02/PAG-09 | PASS: cartão em até 12x, Pix/boleto e preço/desconto vêm do catálogo/configuração | src/modules/pagamentos/checkout.test.ts:109 · src/modules/pagamentos/asaas.test.ts:73 |
| PAG-03 | PASS: garantia, auditoria, fechamento atômico, retry e pendência | src/modules/pagamentos/garantia.test.ts:165 · tests/db/pagamentos-schema.test.ts:451 |
| PAG-05/PAG-06/PAG-13 | PASS: checkout próprio, matrícula anual, máquina de estados, webhook idempotente e reconciliação | src/modules/pagamentos/webhook.test.ts:76 · scripts/jobs/reconciliacao-pagamentos.test.ts:59 |
| PAG-08/PAG-17/INFRA-12 | PASS local: página honesta, funil anônimo, proxy próprio e analytics não crítico | src/app/page.test.tsx:36 · src/modules/analytics/funil.test.ts:8 · src/app/api/analytics/route.test.ts:28 |
| PAG-12/DADOS-11 | PASS: declaração afirmativa de 18+, sem data de nascimento, aceite com timestamp de servidor | src/modules/pagamentos/contratos.test.ts:82 · src/modules/pagamentos/checkout.test.ts:81 |
| INFRA-10 | PASS: webhook exige token/content-type, responde de forma genérica e reporta falha | src/app/api/webhooks/asaas/route.ts:102 · src/app/api/webhooks/asaas/route.ts:118 |
| SEC-01/SEC-02 | PASS: entrada server-side, transições permitidas e claim idempotente | src/modules/pagamentos/contratos.test.ts:82 · tests/db/pagamentos-schema.test.ts:187 |
| SEC-03/SEC-09 | PASS: resultado por capability com TTL e reembolso protegido por sessão server-side | src/modules/pagamentos/resultado-token.test.ts:9 · src/app/app/reembolso/acoes.ts:12 |
| SEC-04/SEC-05/SEC-06 | PASS local: credenciais server-only, HTTPS/allowlist e nenhum nome de modelo ou segredo hardcoded | src/modules/pagamentos/asaas.test.ts:17 · src/modules/pagamentos/asaas.test.ts:214 |
| SEC-07/SEC-08 | PASS: logs/erros saneados e tipos de conteúdo coerentes | src/app/api/webhooks/asaas/route.test.ts:20 · src/app/api/analytics/route.test.ts:70 |

## Reteste manual pendente do F-07

O teste manual de pagamento confirmou o webhook Asaas e a ativação da conta, mas
o e-mail padrão do Supabase levou à home/login em vez de mostrar a definição de
senha. A causa está isolada: o e-mail enviado pelo cliente de serviço usa o
fluxo implícito, enquanto o callback anterior esperava `?code` PKCE.

A correção está implementada e coberta por `src/app/auth/confirm/route.test.ts`.
Para fechar o E2E, ainda é necessário:

1. Em **Authentication → Email Templates → Reset Password**, salvar o link com
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
2. Em **Authentication → URL Configuration → Redirect URLs**, incluir
   `http://localhost:3000/auth/confirm` (e o domínio de produção quando existir).
3. Solicitar um novo link em `/recuperar-senha`, clicar no e-mail e confirmar a
   tela **Defina sua senha**; depois salvar a senha e entrar no `/app`.

O link antigo não serve como evidência do conserto; ele pode ter sido consumido
ou foi criado com o template anterior.

## Casos de borda exercitados

- Webhook repetido três vezes: uma reivindicação, uma ativação e uma matrícula.
- Webhook fora de ordem e cobrança paga com estado local expirada: reabertura
  exclusiva antes da ativação.
- Falha de NF, ausência de NF, status de cancelamento em processamento e
  cancelamento negado: acesso e reembolso não ficam presos por uma falha fiscal;
  o caso operacional fica pendente.
- Falha externa de estorno e retry local: não duplica o estorno e tenta fechar a
  divergência com a mesma RPC idempotente.
- E-mail com matrícula ativa: checkout é bloqueado antes da cobrança.
- Token aleatório inválido e UUID: a página pública mostra somente mensagem
  genérica de resultado indisponível.
- Analytics desligado ou indisponível: a compra segue normalmente.
- Viewport móvel de 360 px: documentElement.scrollWidth e body.clientWidth
  ficaram em 345 px, sem overflow horizontal.

## Sensor de discriminação

Profundidade: P0/full, por envolver dinheiro, autenticação, acesso e dados
financeiros. Foram injetados seis mutantes, um por vez, em cópia temporária:

| Mutação | Teste alvo | Resultado |
| --- | --- | --- |
| Remover propriedades vazias do DTO do funil | src/modules/analytics/funil.ts:60 · funil.test.ts | Mutante morto: 2 de 3 casos falharam |
| Ignorar a RPC de fechamento local do reembolso | src/modules/pagamentos/garantia.ts:236 · garantia.test.ts | Mutante morto: 5 de 11 casos falharam |
| Trocar /cancel por /refund na NF | src/modules/pagamentos/asaas.ts:267 · asaas.test.ts | Mutante morto: endpoint oficial falhou |
| Reduzir o token de 32 para 16 bytes | src/modules/pagamentos/resultado-token.ts:10 · resultado-token.test.ts | Mutante morto: formato/entropia falhou |
| Não reabrir expirada-paga | scripts/jobs/reconciliacao-pagamentos.mts:330 · reconciliacao-pagamentos.test.ts | Mutante morto: ativação esperada não ocorreu |
| Inverter o claim do webhook | src/modules/pagamentos/webhook.ts:114 · webhook.test.ts | Mutante morto: replay e out-of-order falharam |

Resultado: 6/6 mutantes mortos. A cópia temporária e seus artefatos foram
removidos; nada do sensor ficou no branch principal.

## Validação visual local

Executada com o servidor Next já disponível em http://localhost:3000:

| Rota | Resultado |
| --- | --- |
| / | PASS em desktop e 360 px; cabeçalho, método, evidências, preços, garantia, termos, privacidade e CTA visíveis |
| /checkout | PASS em 360 px; meios, valores, nome, e-mail, documento, 18+, termos e botão visíveis; sem overflow horizontal |
| /checkout/resultado/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA | PASS; token inválido mostra resultado genérico indisponível |
| /checkout/resultado/11111111-1111-1111-1111-111111111111 | PASS; UUID não é tratado como capability |
| /app/reembolso | PASS de proteção; sem sessão redireciona para /entrar?proximo=%2Fapp%2Freembolso |

Não foi enviado formulário, não foi usado dado pessoal, não foi feito login e
não foi disparada cobrança real. A página autenticada de reembolso precisa ser
conferida manualmente depois de existir uma conta de teste com matrícula ativa.
Os logs do navegador não registraram erros na navegação acima.

## Gates executados

| Gate | Resultado |
| --- | --- |
| validate_spec.py | PASS: 0 erros, 1 warning sobre perguntas externas ainda abertas |
| validate_tasks.py | PASS: 0 erros, 0 warnings |
| npm.cmd run test:unit | PASS final: 80 arquivos, 567 testes |
| npm.cmd run lint | PASS, exit 0 |
| npx.cmd tsc --noEmit | PASS, exit 0 |
| npm.cmd run build | PASS, Next 16.3.1, incluindo /auth/confirm, /checkout, /checkout/resultado/[token] e /app/reembolso |
| SPEC 12 DB: pagamentos-schema.test.ts + matricula.test.ts | PASS: 2 arquivos, 24/24 testes |
| Suíte DB completa | 324/344 aprovados; 20 testes antigos fora da SPEC 12 não passaram em seis arquivos de plano/Raio-X |
| Sensor de discriminação | PASS: 6/6 mutantes mortos |
| git diff --check | PASS |
| validate_state.py | PASS: 0 erros após o sincronismo documental |

A primeira execução completa dos unitários teve um timeout transitório em um
teste não relacionado; a execução isolada passou duas vezes e a suíte completa
foi repetida com 80/567 aprovados. A primeira execução do banco foi bloqueada
por rede; a repetição com autorização de acesso ao Postgres Supabase passou.
As 20 falhas da suíte DB geral permanecem concentradas nos módulos antigos
gera-plano/plano e Raio-X; não foram alteradas para mascarar a SPEC 12.

## Dependências externas e teste manual posterior

O código local está pronto, mas a validação ponta a ponta precisa de:

1. Template **Reset Password** com `token_hash` e Redirect URL `/auth/confirm`,
   seguido do reteste do link de definição de senha e entrada no `/app`.
2. CNPJ, regime fiscal, conta Asaas, contrato lido, credenciais de sandbox,
   token do webhook e configuração dos campos fiscais.
3. Uma compra de teste em cartão, Pix e boleto; repetição do webhook; ausência
   de webhook para a reconciliação; reembolso no 5º e no 9º dia; e NF sem,
   processando e com cancelamento negado.
4. PostHog configurado no endpoint/região aprovados, conferindo os quatro
   eventos anônimos e a ausência de CPF, e-mail e meio de pagamento.

Esses testes devem usar sandbox e dados descartáveis. As chaves devem ficar em
arquivo de ambiente local ignorado pelo Git; nunca devem ser colocadas em
documentos, testes ou commits.

## Conclusão

A SPEC 12 está implementada e passou nos gates técnicos locais. Ela entrega o
caminho visitante → checkout → pagamento → webhook → conta/matrícula, a
reconciliação das cobranças, a garantia/reembolso, a fatura/NF, o funil anônimo
e as proteções de segurança correspondentes. Para declarar fechamento oficial
na próxima sessão, falta primeiro configurar e retestar o link SSR de definição
de senha; depois permanecem as integrações externas Asaas/PostHog, a NF fiscal
real e a tela autenticada de reembolso com uma conta de teste.
