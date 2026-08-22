# Validação da SPEC 12 — Checkout, funil e ativação

## Validation: PASS técnico — E2E real parcial concluído

Resultado: PASS técnico local. Os defeitos F-01 a F-06 do relatório anterior
foram corrigidos, os contratos da SPEC 12 passaram pelos gates unitários e de
banco, o sensor de discriminação matou os seis mutantes introduzidos e as rotas
públicas foram conferidas em desktop e em viewport de 360 px. O reteste E2E
externo confirmou Pix e cartão no Sandbox, webhook HTTP 200, criação de senha e
login no aplicativo. Boleto, reembolso externo, reconciliação real e NF ainda
ficam na homologação posterior.

Data: 2026-08-22
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
| E2E externo Sandbox | Asaas → webhook → Supabase Auth → `/app` | Pix e cartão confirmados; webhook HTTP 200; senha e login concluídos |

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
| F-10 — workflow não repassava PostHog à reconciliação | O workflow injeta `POSTHOG_API_KEY` e `POSTHOG_API_URL`, e o teste estático protege os dois nomes de secret. | .github/workflows/reconciliacao-pagamentos.yml:34 · scripts/jobs/reconciliacao-pagamentos.test.ts:163 |

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

## F-07 — Reteste manual concluído

O primeiro teste manual revelou que o e-mail padrão do Supabase levava à
home/login em vez de mostrar a definição de senha. A causa foi isolada: o
e-mail enviado pelo cliente de serviço usa o fluxo implícito, enquanto o
callback anterior esperava `?code` PKCE.

A correção está implementada e coberta por `src/app/auth/confirm/route.test.ts`.
O template com `token_hash`, as Redirect URLs e o fluxo real foram conferidos:

1. O e-mail abriu **Defina sua senha**.
2. A nova senha foi salva.
3. O usuário entrou no `/app` após a ativação do pagamento.

O F-07 está PASS. O link antigo não é usado como evidência; a evidência é o
reteste real descrito acima.

## Melhoria futura — UX do pagamento e entrada

Observada na homologação externa de 2026-08-22. Não bloqueia a implementação da
SPEC 12, mas deve virar uma tarefa de UX na SPEC 13 ou em uma rodada posterior
de checkout:

- No cartão, a cobrança é criada primeiro e o comprador precisa descobrir o
  link **Acompanhar cobrança** para chegar ao formulário de cartão hospedado
  pelo Asaas. O resultado precisa explicar esse próximo passo de forma direta
  ou abrir o pagamento automaticamente.
- Após a confirmação, a tela não informa claramente que o e-mail para criar a
  senha foi enviado. Deve existir uma mensagem explícita, endereço mascarado e
  ação para reenviar o e-mail.
- Depois do pagamento hospedado, o retorno ao Passou Concursos não é evidente.
  O fluxo futuro deve oferecer retorno explícito, consulta da cobrança e uma
  forma de retomar o resultado sem depender do histórico do navegador.

Esses itens são melhoria de experiência, não correção de segurança nem mudança
do contrato de ativação. O fluxo atual foi concluído com sucesso.

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

## Evidência externa — 2026-08-22

- **Supabase Auth + Resend — PASS manual:** domínio `auth.passouconcursos.com` verificado;
  SMTP próprio configurado; template `Reset Password` com `token_hash` salvo; recuperação,
  definição de senha e novo login testados pelo responsável do produto.
- **Asaas Sandbox — PASS manual parcial:** uma compra Pix e uma compra em cartão foram
  confirmadas; o webhook corrigido retornou HTTP 200; a conta foi ativada, o e-mail de
  definição de senha chegou e o novo login abriu `/app`.
- **PostHog — PASS parcial manual:** o projeto US recebeu o token; a tela Activity mostrou
  `pagina_vista`, `checkout_iniciado` e `meio_escolhido`. Os três eventos apareceram com a
  pessoa `anonimo`, sem dado pessoal visível. O evento `pagamento_confirmado` foi emitido
  no caminho do webhook real; a conferência visual do evento no painel ainda fica pendente.

## Dependências externas e teste manual posterior

O código local está pronto. Para completar a homologação externa, ainda falta:

1. CNPJ, regime fiscal, conta Asaas, contrato lido, credenciais de sandbox,
   token do webhook e configuração dos campos fiscais.
2. Uma compra de teste em boleto; repetição do webhook; ausência de webhook
   para a reconciliação; reembolso no 5º e no 9º dia; e NF sem,
   processando e com cancelamento negado.
3. O quarto evento PostHog, `pagamento_confirmado`, durante a homologação do webhook Asaas,
   conferindo a ausência de CPF, e-mail e meio de pagamento.

Esses testes devem usar sandbox e dados descartáveis. As chaves devem ficar em
arquivo de ambiente local ignorado pelo Git; nunca devem ser colocadas em
documentos, testes ou commits.

## Conclusão

A SPEC 12 está implementada e passou nos gates técnicos locais. O caminho
visitante → checkout → pagamento → webhook → conta/matrícula → senha → login foi
confirmado no Sandbox para Pix e cartão. Para declarar fechamento oficial ainda
faltam o boleto, a conferência visual do evento `pagamento_confirmado`, a NF
fiscal real e a tela autenticada de reembolso com uma conta de teste ativa.

---

## Homologação externa — 2026-08-22 (rodada final)

Resultado: **NÃO fecha ainda.** A homologação com dinheiro real no Sandbox confirmou tudo o que
faltava, exceto o estorno, e revelou um defeito de produção (F-11) que nenhum teste local pegaria.

### O que passou com dado real

| Item | Evidência |
| --- | --- |
| **Boleto ponta a ponta** | `pay_vcvhgr43rku5ffw8`: confirmado 19:25:34 → ativado 19:25:37, sem intervenção manual; matrícula `ativa` até 2027-08-22. Era o último Success Criteria em aberto |
| **Cartão ponta a ponta** | duas compras ativadas (19:43:32 e 20:07:20) |
| **Funil anônimo no PostHog** | os quatro eventos com `PERSON = anônimo` e **propriedades vazias** — inclusive `URL/SCREEN` e `LIBRARY` em branco, ou seja nem as propriedades automáticas passaram. PAG-17 / INFRA-12 |
| **Transição inválida rejeitada com alerta** | pendências `reconciliacao/evento_fora_de_ordem` em 19:43:33 e 20:07:21: um segundo evento do Asaas chegou para pagamento já ativado, a máquina de estados recusou a transição e abriu pendência visível **em vez de corromper o estado**. É o AC acontecendo fora de teste |
| **NF ausente não trava a compra** | 5 pendências `nota_fiscal/configuracao_nf_ausente` com os pagamentos em `ativada`: o caminho degradado sem CNPJ funciona como projetado |

### F-11 — estorno de cartão parcelado usa o endpoint errado (BLOQUEIA)

O cartão é criado como parcelamento de 12x (`asaas.ts:142`). O Asaas cria um **parcelamento** e
devolve uma parcela; o id do parcelamento (`installment`) é descartado — não está em
`RespostaCobranca` (`asaas.ts:366`) nem em `normalizarCobranca` (`asaas.ts:398`). O estorno chama
`POST /payments/{id}/refund` com o id da parcela (`asaas.ts:219`) e o Asaas recusa: *"acesse a tela
de detalhes desse parcelamento para solicitar o estorno"*. A doc oficial exige
`POST /installments/{id}/refund`.

Reproduzido duas vezes com dado real: pendências `falha_no_estorno` em 19:31:34 e 20:09:22.

**Não é limitação do Sandbox — quebraria em produção**, no meio principal de pagamento. A garantia
de 7 dias (PAG-03) deixa de concluir sozinha. O pedido não se perde (abre pendência, alerta a
operação e mantém o acesso ligado até o estorno sair), mas a devolução vira processo manual.

**Correção**: capturar `installment`; persistir em `pagamentos.asaas_parcelamento_id` (migration);
em `estornarCobranca`, escolher `/installments/{id}/refund` quando houver parcelamento, mantendo
`/payments/{id}/refund` (Pix) e `/bankSlip/refund` (boleto); teste que prova a escolha do endpoint.

**Por que escapou:** o teste do estorno usa gateway falso, que aceita qualquer id e devolve sucesso.
Ele prova que chamamos o gateway, não que acertamos o endpoint de uma compra parcelada. O sensor de
mutação da rodada anterior mediu a mesma superfície e por isso também não pegou. Nenhum teste com
peça simulada acharia — só pagamento real. **Lição para as specs de dinheiro: o gateway falso prova
o fluxo, nunca o contrato externo.**

### Limitação do ambiente, registrada

O Sandbox do Asaas **não estorna cartão** — o próprio painel informa: *"Esta ação Sandbox permite
estorno apenas de pagamentos via PIX ou boleto"*. Depois da correção do F-11, o estorno será
homologado **por Pix**; o de cartão parcelado ficará coberto por teste automatizado da escolha do
endpoint e **só pode ser confirmado em produção**.

Para confirmar Pix no Sandbox use **"Confirmar pagamento"**, não "Receber pagamento": este é baixa
manual em dinheiro, e a doc do Asaas separa `undoReceivedInCash` de `refund`. Foi o que impediu o
estorno do boleto nesta rodada — e não é defeito nosso.

### Defeitos menores abertos

- **F-12 — `asaas_status` congela em `PENDING`** (`repositorio.ts:117`): só é escrito na criação da
  cobrança; o webhook nunca atualiza. A tela mostra *"Status operacional: ativada · retorno do
  provedor: PENDING"*, contradizendo a si mesma para quem acabou de pagar. Proposta: remover o bloco
  de diagnóstico da tela do comprador e atualizar o campo no webhook. **Aguarda decisão.**
- **F-13 — aviso preso na URL** (`app/reembolso/page.tsx:96`): recarregar a página reexibe *"O pedido
  ficou em análise"* sem nova tentativa. → SPEC 13.
- **F-14 — UX de definir senha**: adicionar o botão de revelar a senha. **Não** adicionar confirmação
  de senha (padrão em desuso; não evita o erro que promete e aumenta abandono) nem redirecionar ao
  login (a pessoa acabou de provar identidade pelo link do e-mail). → SPEC 13.

### Correções entregues nesta rodada

PR #23, mergeado na `main`, CI 6/6 verde (576 unit, 344 db, lint, build), publicado na Vercel:

| Commit | O quê |
| --- | --- |
| `202ad04` | job do partman em dois — falhava diariamente desde 17/08 e a manutenção de partição de `tentativas` não rodava |
| `fa26e19` | isolamento de `perfil_concurso` nos testes — um perfil de demonstração derrubava 6 arquivos na CI |
| `9cdc5f3` | aviso do e-mail de senha, com endereço mascarado — a tela mandava entrar quem não tinha senha |
| `560e692` | "Acompanhar cobrança" → "Pagar agora", em aba nova |

## Rodada de correção — F-11 e F-12 (2026-08-22)

Branch `fix-spec-12-estorno-parcelamento`. Migration `20260822200000_spec12_parcelamento_e_status.sql`.

### F-11 — corrigido

O que mudou, e por quê cada peça:

| Onde | Mudança |
| --- | --- |
| `src/modules/pagamentos/asaas.ts` | `CobrancaAsaas.parcelamentoId` lê o campo `installment` da resposta de `POST /v3/payments`. Era ele que estava sendo descartado |
| `src/modules/pagamentos/asaas.ts` | `estornarCobranca` ganha `parcelamentoId` e passa a escolher entre três endereços: `/v3/installments/{id}/refund` (parcelamento), `/v3/payments/{id}/refund` (Pix/cartão avulso) e `/v3/payments/{id}/bankSlip/refund` (boleto) |
| migration | `pagamentos.asaas_parcelamento_id` + índice parcial. Sem persistir o id não há como escolher o endereço no dia do reembolso |
| `repositorio.ts` · `checkout.ts` · `garantia.ts` · `app/reembolso/acoes.ts` | o id atravessa criação → persistência → estorno |

Contrato conferido na doc oficial (Context7, `docs.asaas.com/reference/refund-installment`): o corpo
de `/installments/{id}/refund` aceita **somente** `value`, para estorno parcial. A garantia é estorno
total, então a chamada vai **sem corpo** — não com o `description` que o endpoint de cobrança avulsa
aceita. Enviar campo que o DTO não declara é o tipo de detalhe que devolve 400 no dia do reembolso.

**Teste que prova a correção** (`asaas.test.ts`, *"escolhe o endpoint do estorno pelo tipo da
compra"*): captura a **URL** de cada chamada, não só o fato de ter chamado. É a superfície que
faltava — o gateway falso antigo aceitava qualquer id e devolvia sucesso, então provava o fluxo e
nunca o endereço. Um segundo teste prova que `installment` sobrevive à normalização da cobrança, e
`garantia.test.ts` prova que o id do parcelamento chega ao gateway numa compra por cartão.

**Limite honesto desta correção:** o endpoint certo está provado contra a **documentação** e contra
teste automatizado, **não** contra o gateway real — o Sandbox do Asaas não estorna cartão. O
primeiro estorno de cartão em produção é o teste de verdade e SHALL ser acompanhado.

### F-12 — corrigido (decisão do dono do produto, 2026-08-22: fazer (a) e (b))

- **(a)** o bloco *"Status operacional: … · retorno do provedor: PENDING"* saiu de
  `/checkout/resultado/[token]`. É detalhe operacional; para quem acabou de pagar ele só se
  contradizia. `statusGateway` saiu junto do contrato `DadosDoResultado` — não era lido por
  `apresentarResultado`, era plumbing morto.
- **(b)** o webhook passa a gravar `asaas_status` (`webhook.ts`, `registrarStatusDoGateway`), uma vez
  por evento não-duplicado. A escrita é **deliberadamente engolida em caso de falha**: o evento já
  foi registrado como recebido, então devolver 202 faria o Asaas reenviar e o replay seria
  descartado como duplicado — o acesso nunca abriria. Status de diagnóstico não pode derrubar
  ativação. Teste em `webhook.test.ts` cobre as duas metades.

### O que falta para fechar a spec

Homologar o **estorno por Pix** com dado real no Sandbox (AC3 da garantia). O cartão fica coberto
por teste automatizado + doc, com a ressalva acima registrada.
