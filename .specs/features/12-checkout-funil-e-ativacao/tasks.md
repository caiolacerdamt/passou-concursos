# SPEC 12 — Tasks: checkout, funil de venda e ativação

## Execution Protocol

Executar uma task por vez, sempre com teste derivado dos Acceptance Criteria,
gate verde, status atualizado neste arquivo e um commit atômico. A SPEC 12 tem
12 tasks e aciona a oferta de lote de subagentes prevista pelo TLC; a decisão de
execução deve ser tomada antes do primeiro código. O verificador final será
independente, único e aguardado até concluir.

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Catálogo e preço | unit | Defaults, tipos, flag desligada, cálculo parcelado/à vista e congelamento de valor | `src/modules/config/catalogo.test.ts`, `src/modules/pagamentos/preco.test.ts` | `npm run test:unit` |
| Contratos puros | unit | Máquina de estados, validação de checkout, garantia e allowlist | `src/modules/pagamentos/*.test.ts` | `npm run test:unit` |
| Schema Supabase | integration | Tabelas, enums, constraints, RLS, transições, idempotência e fila | `tests/db/pagamentos-schema.test.ts` | `npm run test:db` |
| Gateway Asaas | unit | Headers, endpoints, payloads, timeout e sanitização de erro com gateway falso | `src/modules/pagamentos/asaas.test.ts` | `npm run test:unit` |
| Analytics | unit | Quatro eventos, propriedades permitidas, remoção de PII e falha não crítica | `src/modules/analytics/funil.test.ts`, `src/app/api/analytics/route.test.ts` | `npm run test:unit` |
| Página pública | unit/render | Conteúdo mínimo, links, preços, garantia, responsividade sem largura fixa | `src/app/page.test.tsx`, `src/app/checkout/page.test.tsx` | `npm run test:unit` |
| Webhook e ativação | unit | Assinatura, evento desconhecido, replay, confirmação, fila e conta/matrícula idempotentes | `src/modules/pagamentos/webhook.test.ts`, `src/modules/pagamentos/ativacao.test.ts` | `npm run test:unit` |
| Job | unit | Reconcilia pagos sem conta, expira pendente, retenta falha e não cobra analytics | `scripts/jobs/reconciliacao-pagamentos.test.ts` | `npm run test:unit` |
| Garantia | unit/render | Dias 5 e 9, reembolso inválido, status, acesso encerrado e mensagem clara | `src/modules/pagamentos/garantia.test.ts`, `src/app/app/reembolso/page.test.tsx` | `npm run test:unit` |
| Gate final | build | Lint, unit, banco e compilação Next 16 | projeto inteiro | `npm run lint` + `npm run test:unit` + `npm run test:db` + `npm run build` |

## Gate Check Commands

| Gate Level | Command |
| --- | --- |
| Quick | `npm run test:unit` |
| Full | `npm run test:unit` + `npm run test:db` |
| Build | `npm run lint` + `npm run test:unit` + `npm run test:db` + `npm run build` |
| Spec/task | `python C:\Users\Caio Lacerda\.agents\skills\tlc-spec-driven\scripts\validate_spec.py .specs\features\12-checkout-funil-e-ativacao` e `python C:\Users\Caio Lacerda\.agents\skills\tlc-spec-driven\scripts\validate_tasks.py .specs\features\12-checkout-funil-e-ativacao` |

## Execution Plan

As fases são sequenciais. Dentro de uma fase, as setas são a ordem mínima; uma
dependência de fase anterior aparece no campo `Depends on` da task.

### Phase 1: Foundation

```text
T106 -> T107 -> T108
```

### Phase 2: Public purchase surface

```text
T109
T110 -> T111
```

### Phase 3: Purchase and activation

```text
T112 -> T113 -> T114 -> T115
```

### Phase 4: Guarantee and closure

```text
T116 -> T117
```

### Dependency edges across phases

```text
T108 -> T109
T108 -> T110
T109 -> T112
T111 -> T112
T114 -> T116
T115 -> T117
```

## Task Breakdown

### T106: Cadastrar preço, garantia e flag do analytics

**What**: Adicionar ao catálogo M8 os parâmetros de preço, desconto e garantia,
e ao M9 a flag global de analytics logado desligada. Criar o leitor tipado do
preço e documentar as variáveis externas novas.
**Where**: `src/modules/config/catalogo.ts`
**Depends on**: None
**Requirement**: PAG-09, PAG-03, INFRA-12, SEC-06
**Tools**: Skill `tlc-spec-driven`
**Done when**:

- [x] Preço anual, percentual à vista e dias de garantia têm tipo, default e descrição.
- [x] `flag.m9.analytics_logado` nasce `false` e não aceita rollout, string ou percentual.
- [x] O DTO público expõe os dois preços sem revelar configuração interna.
- [x] `.env.example` documenta Asaas, PostHog e URL pública sem valores secretos.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(pag): cadastra preco e flag do funil`
**Status**: Done

**Execution record**

- **State**: concluida; o catalogo e a fronteira publica de preco estao prontos.
- **Assumptions**: o preco de ancora continua em R$ 197,00; desconto e garantia permanecem configuraveis no banco.
- **Files**: `src/modules/config/catalogo.ts`, `src/modules/config/catalogo.test.ts`, `src/modules/pagamentos/preco.ts`, `src/modules/pagamentos/preco.test.ts`, `.env.example`.
- **Success evidence**: defaults e tipos passam; DTO retorna parcelado/a vista/garantia sem expor chaves internas; `npm run test:unit -- src/modules/config/catalogo.test.ts src/modules/pagamentos/preco.test.ts` — 2 arquivos, 9 testes verdes.

### T107: Criar schema de pagamentos, eventos, faturas e transições

**What**: Criar a migration com pagamentos, aceites, eventos idempotentes,
transições append-only, faturas, pendências, enum de estado, constraints,
funções de transição/claim, RLS e privilégios de serviço.
**Where**: `supabase/migrations/20260821110000_pagamentos_schema.sql`
**Depends on**: T106
**Requirement**: PAG-02, PAG-05, PAG-06, PAG-12, PAG-13, INFRA-10, SEC-02, SEC-03
**Tools**: Skill `tlc-spec-driven`
**Done when**:

- [x] O banco aceita somente os estados e transições previstos e rejeita reembolso antes da confirmação.
- [x] Evento Asaas repetido não cria segunda linha; eventos e transições não aceitam edição nem truncate.
- [x] O pagamento congela valor, meio, e-mail, referência e aceite; `faturas` mantém referência fiscal.
- [x] Navegador não escreve pagamentos, faturas, eventos, transições ou pendências.
- [x] A reserva de ativação é concorrente e recuperável pela reconciliação.

**Tests**: integration
**Gate**: full
**Commit**: `feat(pag): cria schema do checkout e estados`
**Status**: Done

**Execution record**

- **State**: concluida; migration aplicada no Supabase de desenvolvimento.
- **Assumptions**: o claim de ativacao expira apos 10 minutos; recuperacao e feita pela reconciliação futura.
- **Files**: `supabase/migrations/20260821110000_pagamentos_schema.sql`, `tests/db/pagamentos-schema.test.ts`.
- **Success evidence**: `npm run db:push`; `npm run test:db -- tests/db/pagamentos-schema.test.ts` — 1 arquivo, 4 testes verdes; `npm run test:unit` — 58 arquivos, 493 testes verdes.

### T108: Publicar contratos puros, retenção e regras de garantia

**What**: Implementar tipos e validações compartilhadas para meio, checkout,
estados, transições, garantia e erro sanitizado; registrar pagamentos, faturas,
aceites e pendências no inventário de retenção.
**Where**: `src/modules/pagamentos/contratos.ts`
**Depends on**: T107
**Requirement**: PAG-03, PAG-06, PAG-12, DADOS-11, SEC-01
**Tools**: Skill `tlc-spec-driven`
**Done when**:

- [x] A validação não aceita DOB e exige 18+ e aceite datado.
- [x] A máquina pura coincide com a máquina SQL e não permite transição fora de ordem.
- [x] O cálculo da garantia usa dias corridos desde a confirmação e não depende do relógio da UI.
- [x] A rotina de esquecimento conhece as exceções financeiras antes da SPEC 14.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(pag): publica contratos de compra e garantia`
**Status**: Done

**Execution record**

- **State**: concluida; contratos, cálculo da janela e inventário de retenção publicados.
- **Assumptions**: dias corridos são comparados por data UTC; a janela fica aberta enquanto `diasPassados < garantiaDias`.
- **Files**: `src/modules/pagamentos/contratos.ts`, `src/modules/pagamentos/contratos.test.ts`, `src/modules/pagamentos/garantia.ts`, `src/modules/pagamentos/garantia.test.ts`, `src/modules/lgpd/grupo-1.ts`, `src/modules/lgpd/grupo-1.test.ts`.
- **Success evidence**: `npm run test:unit` — 61 arquivos, 501 testes verdes; schema strict rejeita `dataNascimento`, e os casos do 5º/9º dia passam.

### T109: Implementar adaptador HTTP do Asaas

**What**: Implementar a interface de gateway e o adaptador Asaas para criar
cobrança, consultar pagamentos, estornar cobrança e agendar NF, com timeout,
headers, payloads por meio e erros sem dados pessoais.
**Where**: `src/modules/pagamentos/asaas.ts`
**Depends on**: T108
**Requirement**: PAG-02, PAG-05, PAG-13, SEC-04, SEC-05, SEC-06, SEC-07
**Tools**: Skill `tlc-spec-driven`; documentação oficial do Asaas
**Done when**:

- [x] Cartão usa 12 parcelas; Pix e boleto usam o valor à vista configurado.
- [x] A API usa chave e URL de ambiente, `asaas-access-token` somente no webhook e nunca expõe segredo em erro.
- [x] O adaptador não inventa nome, CPF ou outro dado cadastral exigido pelo provedor.
- [x] O gateway é injetável para testes, sem rede real na suíte unitária.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(pag): integra gateway Asaas`
**Status**: Done

**Execution record**

- **State**: concluida; adapter HTTP e contratos de cobrança, consulta, estorno e NF publicados.
- **Assumptions**: cobrança de cartão usa `totalValue` + 12 parcelas; NF exige serviço municipal e impostos fornecidos pelo chamador, sem valores inventados.
- **Files**: `src/modules/pagamentos/asaas.ts`, `src/modules/pagamentos/asaas.test.ts`.
- **Success evidence**: `npm run test:unit` — 62 arquivos, 507 testes verdes; testes cobrem host HTTPS allowlisted, headers, payloads, timeout, estorno por meio e ausência de PII.

### T110: Criar proxy próprio de analytics anônimo

**What**: Criar a allowlist de eventos do funil e a rota same-origin que envia
somente eventos anônimos com propriedades vazias ao PostHog quando configurado,
sem bloquear a compra.
**Where**: `src/modules/analytics/funil.ts`
**Depends on**: T108
**Requirement**: PAG-17, INFRA-12, SEC-07, SEC-08
**Tools**: Skill `tlc-spec-driven`
**Done when**:

- [x] Existem somente quatro eventos públicos e nenhum aceita campo de meio de pagamento.
- [x] E-mail, nome, CPF, telefone, `user_id`, pagamento, meio e chaves desconhecidas são descartados.
- [x] Sem PostHog, com bloqueador ou com timeout, a rota continua respondendo sem afetar o checkout.
- [x] Não há session replay nem emissão da flag/logado na superfície protegida.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): adiciona proxy anonimo do funil`
**Status**: Done

**Execution record**

- **State**: concluida; allowlist, proxy same-origin e transporte servidor-only publicados.
- **Assumptions**: PostHog usa endpoint EUA oficial configurado por ambiente; `distinct_id=anonimo` é o único identificador enviado.
- **Files**: `src/modules/analytics/funil.ts`, `src/modules/analytics/funil.test.ts`, `src/modules/analytics/posthog.ts`, `src/modules/analytics/posthog.test.ts`, `src/modules/analytics/entrada.tsx`, `src/modules/analytics/navegador.ts`, `src/modules/analytics/navegador.test.ts`, `src/app/api/analytics/route.ts`, `src/app/api/analytics/route.test.ts`, `src/app/api/webhooks/asaas/route.ts`, `scripts/jobs/reconciliacao-pagamentos.mts`.
- **Success evidence**: correção F-01/F-06 cobre emissão real dos quatro eventos, transporte não bloqueante e propriedades vazias; gate final será registrado na seção de correções pós-validação.

### T111: Construir a página pública e textos legais iniciais

**What**: Substituir a landing mínima pela página de vendas responsiva e criar
as páginas públicas de termos e privacidade com links consistentes.
**Where**: `src/app/page.tsx`
**Depends on**: T110
**Requirement**: PAG-08, PAG-09, PAG-03
**Tools**: Skill `tlc-spec-driven`
**Done when**:

- [x] A página mostra método, evidências citadas, estado atual, dois preços, garantia e um CTA para checkout.
- [x] O texto não promete tutor, gamificação ou outras superfícies ainda desligadas.
- [x] Termos e privacidade são alcançáveis sem login, deixam a revisão jurídica explícita e aparecem antes ou junto do CTA.
- [x] A renderização não cria largura fixa em pixels nem rolagem horizontal em 360px.

**Tests**: unit/render
**Gate**: quick
**Commit**: `feat(pag): publica pagina de vendas e termos`
**Status**: Done

**Execution record**

- **State**: concluida; landing, resumo público do checkout e textos legais iniciais estão acessíveis sem sessão.
- **Assumptions**: o processamento real da cobrança fica em T112; o checkout deste lote é deliberadamente informativo e mantém o botão desabilitado.
- **Files**: `src/app/page.tsx`, `src/app/page.test.tsx`, `src/app/checkout/page.tsx`, `src/app/checkout/page.test.tsx`, `src/app/termos/page.tsx`, `src/app/privacidade/page.tsx`, `src/app/paginas-publicas.test.tsx`, `src/modules/conta/rotas.ts`.
- **Success evidence**: render tests — 4 arquivos, 10 testes verdes; `npm run lint` — 0 erros após a correção mecânica de lint `2eedcea`.

### T112: Implementar checkout próprio e resultado da cobrança

**What**: Criar página e Server Action de checkout, validar aceite, bloquear
matrícula ativa, congelar preço, registrar pendente, chamar o gateway e exibir
resultado sem depender do analytics.
**Where**: `src/app/checkout/page.tsx`
**Depends on**: T109, T111
**Requirement**: PAG-02, PAG-09, PAG-12, DADOS-11, SEC-01, SEC-03, SEC-08
**Tools**: Skill `tlc-spec-driven`; guia local do Next 16 para Server Actions
**Done when**:

- [x] O preço parcelado e à vista aparece antes da escolha do meio.
- [x] Sem 18+ ou termos a action não cria cobrança; não existe campo de data de nascimento.
- [x] E-mail com matrícula ativa recebe aviso e não é cobrado novamente.
- [x] Erro de um meio preserva o formulário e permite trocar para outro.
- [x] Pix/boleto/cartão retornam para uma página própria de resultado com status operacional por capability token com TTL; UUID de pagamento não é exposto na URL pública.

**Tests**: unit/render
**Gate**: quick
**Commit**: `feat(pag): implementa checkout proprio`
**Status**: Done

**Execution record**

- **State**: concluida; checkout proprio valida no servidor, congela o valor, cria a cobrança e exibe resultado operacional sem depender de analytics.
- **Assumptions**: o contrato atual do Asaas exige nome e CPF/CNPJ para criar o pagador; esses dados são informados pelo comprador, usados somente no servidor e não entram no registro financeiro local. A cobrança vence no dia seguinte à criação.
- **Files**: `src/app/checkout/page.tsx`, `src/app/checkout/formulario.tsx`, `src/app/checkout/acoes.ts`, `src/app/checkout/resultado/[token]/page.tsx`, `src/modules/pagamentos/resultado-token.ts`, `src/modules/pagamentos/resultado-token.test.ts`, `src/modules/pagamentos/checkout.ts`, `src/modules/pagamentos/repositorio.ts`, `src/modules/pagamentos/resultado.ts`, `src/modules/pagamentos/contratos.ts`, `src/modules/pagamentos/asaas.ts`, `supabase/migrations/20260821120000_checkout_pagamento.sql`, `supabase/migrations/20260821132000_spec12_resultado_token.sql` e testes co-localizados.
- **Success evidence**: correção F-05 cobre token aleatório, hash-only, TTL e lookup server-side; gate final será registrado na seção de correções pós-validação.

### T113: Validar webhook e registrar idempotência

**What**: Criar a Route Handler pública do Asaas, validar assinatura antes do
parse, registrar evento, tratar desconhecido/fora de ordem e encaminhar somente
confirmação válida para ativação.
**Where**: `src/app/api/webhooks/asaas/route.ts`
**Depends on**: T112
**Requirement**: PAG-13, INFRA-10, PAG-06, SEC-02, SEC-05, SEC-07, SEC-08
**Tools**: Skill `tlc-spec-driven`; guia local do Next 16 para Route Handlers
**Done when**:

- [x] Token ausente ou incorreto é rejeitado antes de processamento e reportado sem payload bruto.
- [x] O mesmo `event.id` três vezes resulta em uma única ação.
- [x] Evento desconhecido ou transição inválida vira registro/alerta e não libera conteúdo.
- [x] A rota responde de forma estável e nunca depende de sessão do navegador.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(pag): protege e torna idempotente o webhook`
**Status**: Done

**Execution record**

- **State**: concluida; Route Handler público autentica o token antes do corpo, registra replay por `event.id` e encaminha apenas confirmações em estado permitido para a fila de ativação.
- **Assumptions**: `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED` são os eventos de confirmação; desconhecidos são ignorados com alerta, e confirmação após expiração/reembolso fica em reconciliação.
- **Files**: `src/app/api/webhooks/asaas/route.ts`, `src/app/api/webhooks/asaas/route.test.ts`, `src/modules/pagamentos/webhook.ts`, `src/modules/pagamentos/webhook.test.ts`, `src/modules/pagamentos/repositorio.ts`, `src/modules/conta/rotas.ts`.
- **Success evidence**: `npm run test:unit` — 72 arquivos, 535 testes verdes; `npm run lint` — 0 erros e 0 avisos; `npx tsc --noEmit` — verde.

### T114: Ativar usuário, matrícula e fatura após confirmação

**What**: Implementar o orquestrador que cria/localiza conta, envia definição de
senha, cria matrícula de 12 meses, grava fatura e abre pendência separada para
falhas de NF sem bloquear a ativação.
**Where**: `src/modules/pagamentos/ativacao.ts`
**Depends on**: T113
**Requirement**: PAG-05, PAG-06, PAG-13, SEC-02, SEC-03, SEC-04, SEC-07
**Tools**: Skill `tlc-spec-driven`; SDK Supabase existente
**Done when**:

- [x] Pagamento confirmado sem usuário cria conta pelo e-mail e envia o fluxo de senha.
- [x] Pagamento confirmado com usuário existente reaproveita a conta e não duplica matrícula.
- [x] A matrícula usa meses do produto no banco e fecha o paywall no reembolso.
- [x] Falha em Auth, matrícula ou NF vira pendência visível e alerta, sem perder a compra confirmada.
- [x] O mesmo processo repetido é seguro e termina em `ativada` uma única vez.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(pag): ativa conta e matricula pelo pagamento`
**Status**: Done

**Execution record**

- **State**: concluida; confirmação autenticada pelo webhook percorre o claim SQL, cria/reaproveita Auth, envia definição de senha, cria/reaproveita matrícula, cria fatura e ativa o pagamento; NF permanece separada.
- **Assumptions**: o Supabase Auth é a fonte de verdade de contas; a busca por e-mail usa paginação administrativa, e a validade de 12 meses é calculada pelo trigger do produto no banco. Sem configuração fiscal real, a NF fica em `falha`/pendência e não desfaz a compra.
- **Files**: `src/modules/pagamentos/ativacao.ts`, `src/modules/pagamentos/ativacao.test.ts`, `src/modules/pagamentos/repositorio.ts`, `src/app/api/webhooks/asaas/route.ts`, `.env.example`.
- **Success evidence**: testes de ativação, replay e rota — 3 arquivos, 12 testes verdes; `npm run lint` — 0 erros e 0 avisos; `npx tsc --noEmit` — verde.

### T115: Implementar job de reconciliação e expiração

**What**: Criar job executável fora do serverless que consulta cobranças pagas,
reativa pendências de ativação, expira pagamentos pendentes vencidos, atualiza a
fila e reporta falhas.
**Where**: `scripts/jobs/reconciliacao-pagamentos.mts`
**Depends on**: T114
**Requirement**: PAG-06, PAG-13, INFRA-10, SEC-02, SEC-04, SEC-06, SEC-07
**Tools**: Skill `tlc-spec-driven`; padrão dos jobs existentes
**Done when**:

- [x] Cobrança paga sem webhook é encontrada e percorre o mesmo caminho de ativação, inclusive quando o pagamento local está expirado.
- [x] Job repetido não cria conta, matrícula ou evento duplicado.
- [x] Pendência vencida passa a `expirada` e não cria conta.
- [x] Falha de consulta/ativação fica na fila, é saneada no alerta e deixa o processo vermelho.
- [x] Existe script no `package.json` e documentação do segredo no workflow/`.env.example`.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): reconcilia pagamentos pendentes`
**Status**: Done

**Execution record**

- **State**: concluida; job Node fora do serverless consulta páginas de cobranças pagas, registra evento determinístico, reutiliza o orquestrador de ativação, expira pendentes e retorna código vermelho em falhas.
- **Assumptions**: a tentativa pendente expira por default após 48 horas, com override na tabela de configuração; o limite da página do Asaas é 100 e a varredura para quando a página vem menor.
- **Files**: `scripts/jobs/reconciliacao-pagamentos.mts`, `scripts/jobs/reconciliacao-pagamentos.test.ts`, `package.json`, `.github/workflows/reconciliacao-pagamentos.yml`, `.env.example`, `src/modules/config/catalogo.ts`, `src/modules/config/catalogo.test.ts`.
- **Success evidence**: correção F-03 cobre a RPC exclusiva `expirada → confirmada`, rejeição da transição genérica e ativação idempotente; gate final será registrado na seção de correções pós-validação.

### T116: Entregar garantia, pedido de reembolso e encerramento de acesso

**What**: Criar o módulo e a tela autenticada de garantia, mostrar dias
restantes, recusar fora da janela ou antes da confirmação e processar o estorno
no Asaas antes de marcar pagamento/matrícula reembolsados.
**Where**: `src/modules/pagamentos/garantia.ts`
**Depends on**: T114
**Requirement**: PAG-03, PAG-06, SEC-03, SEC-07, SEC-09
**Tools**: Skill `tlc-spec-driven`; documentação oficial do estorno Asaas
**Done when**:

- [x] No quinto dia a tela mostra a janela e permite solicitar; no nono dia recusa com clareza.
- [x] Reembolso antes da confirmação é rejeitado, alertado e não encerra acesso.
- [x] Estorno confirmado grava solicitante, timestamp e meio, marca pagamento e matrícula na mesma transação e fecha o paywall; retry recupera divergência local.
- [x] NF Asaas, quando existente, usa `/v3/invoices/{id}/cancel`; estados em processamento/negado viram pendência sem reabrir acesso, e ausência de NF não bloqueia o reembolso.
- [x] Falha do gateway não marca reembolso falso e abre pendência de retry.

**Tests**: unit/render
**Gate**: quick
**Commit**: `feat(pag): implementa garantia e reembolso`
**Status**: Done

**Execution record**

- **State**: concluida; a tela autenticada calcula os dias no servidor, recusa tentativas fora da janela ou antes da confirmação, chama o estorno somente no prazo e só fecha pagamento/matrícula após confirmação segura do gateway.
- **Assumptions**: a janela usa dias corridos UTC; `DONE`, `CONFIRMED` e `REFUNDED` são respostas finais aceitas do Asaas; qualquer outro status ou falha fica em pendência e mantém o acesso; o pedido inválido também abre alerta operacional sem expor dados financeiros.
- **Files**: `src/modules/pagamentos/garantia.ts`, `src/modules/pagamentos/garantia.test.ts`, `src/modules/pagamentos/repositorio.ts`, `src/app/app/reembolso/page.tsx`, `src/app/app/reembolso/page.test.tsx`, `src/app/app/reembolso/acoes.ts`, `src/app/app/reembolso/acoes.test.ts`.
- **Success evidence**: correções F-02/F-04 cobrem RPC atômica/idempotente, retry adversarial, endpoint oficial e estados de NF; gate final será registrado na seção de correções pós-validação.

### T117: Fechar integração, rastreabilidade e gate da SPEC

**What**: Completar testes de contrato entre checkout, webhook, reconciliação,
faturas, retenção e paywall; atualizar rastreabilidade e preparar o pacote para
verificação independente.
**Where**: `tests/db/pagamentos-schema.test.ts`
**Depends on**: T115, T116
**Requirement**: PAG-02, PAG-03, PAG-05, PAG-06, PAG-08, PAG-09, PAG-12, PAG-13, PAG-17, DADOS-11, INFRA-10, INFRA-12, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-09
**Tools**: Skill `tlc-spec-driven`; gates do projeto
**Done when**:

- [x] O teste de banco cobre estados, idempotência, RLS, fila, retenção e matrícula única.
- [x] A matriz de rastreabilidade da SPEC e o status de cada task têm evidência real.
- [x] `validate_spec.py`, `validate_tasks.py`, unit, db, lint e build passam, ou a limitação fica registrada.
- [x] O teste visual manual fica documentado com `/` e `/checkout`, sem criar mockup.

**Tests**: integration + build
**Gate**: build
**Commit**: `test(pag): fecha contrato do funil e ativacao`
**Status**: Done

**Execution record**

- **State**: concluida; o contrato integrado de checkout, webhook, ativação, reconciliação, garantia, fatura, retenção e paywall foi exercitado por testes unitários e de banco; rastreabilidade e gates foram atualizados.
- **Assumptions**: o Postgres de desenvolvimento é o banco de contrato; `/` e `/checkout` foram conferidos em desktop e viewport de 360 px, enquanto a tela autenticada de reembolso depende de uma conta de teste; o Verifier independente separado não foi iniciado por instrução explícita do usuário, então o relatório final identifica a revisão fresh-eyes do agente principal e o sensor scratch executado.
- **Files**: `tests/db/pagamentos-schema.test.ts`, `tests/db/matricula.test.ts`, `.specs/features/12-checkout-funil-e-ativacao/spec.md`, `.specs/features/12-checkout-funil-e-ativacao/tasks.md`, `.specs/features/12-checkout-funil-e-ativacao/validation.md`.
- **Success evidence**: `tests/db/pagamentos-schema.test.ts` + `tests/db/matricula.test.ts` — 24/24 testes verdes com conexão autorizada; unitários 80/567; lint, TypeScript, build, validação visual local, sensor e validadores registrados em `validation.md`.

## Correções pós-validação independente

Esta seção registra somente as correções solicitadas após o relatório independente.
Após as correções, `validation.md` foi atualizado com a revisão final, o sensor
scratch e a validação visual local.

| ID | Correção | Evidência de implementação | Evidência de gate |
| --- | --- | --- | --- |
| F-01/F-06 | Quatro eventos emitidos nos pontos reais do funil, envio não bloqueante e propriedades anônimas vazias, sem `meio` | `src/modules/analytics/entrada.tsx`, `src/modules/analytics/navegador.ts`, `src/app/api/webhooks/asaas/route.ts`, `scripts/jobs/reconciliacao-pagamentos.mts` | Unit 78 arquivos/563 testes; lint, TypeScript e build verdes |
| F-02 | RPC transacional e idempotente fecha pagamento + matrícula; retry recupera divergência e abre pendência quando o fechamento falha | `supabase/migrations/20260821130000_spec12_reembolso_nf.sql`, `src/modules/pagamentos/garantia.ts` | Unit direcionado verde; DB schema 12/12 |
| F-03 | Reabertura exclusiva `expirada → confirmada` na reconciliação, seguida de ativação idempotente | `supabase/migrations/20260821131000_spec12_reconciliacao.sql`, `supabase/migrations/20260821133000_spec12_guards.sql`, `scripts/jobs/reconciliacao-pagamentos.mts` | Unit direcionado verde; DB schema 12/12 |
| F-04 | Cancelamento oficial de NF, estados persistidos e fila segura; ausência de NF não bloqueia reembolso | `src/modules/pagamentos/asaas.ts`, `src/modules/pagamentos/garantia.ts`, `src/modules/pagamentos/repositorio.ts` | Unit direcionado verde; DB schema 12/12 |
| F-05 | Capability token aleatório, hash-only, TTL e lookup server-side; UUID não é aceito na rota pública | `src/modules/pagamentos/resultado-token.ts`, `src/modules/pagamentos/repositorio.ts`, `src/app/checkout/resultado/[token]/page.tsx`, `supabase/migrations/20260821132000_spec12_resultado_token.sql`, `supabase/migrations/20260821133000_spec12_guards.sql` | Unit direcionado verde; DB schema 12/12; build reconhece `/checkout/resultado/[token]` |

### F-07 — link de definição de senha caía na home/login

- **Diagnóstico**: a ativação dispara `resetPasswordForEmail` pelo cliente de serviço. O cliente usa
  o fluxo implícito; o template padrão devolve o token em fragmento, invisível ao servidor, enquanto
  `/auth/callback` só tratava `code` PKCE.
- **Correção**: `/auth/confirm` valida `token_hash` com `verifyOtp`, grava a sessão SSR e encaminha
  para `/definir-senha`; o envio de ativação aponta para esse contrato. O template Reset Password
  exigido e as Redirect URLs estão documentados em `docs/DEPLOY.md`.
- **Evidência técnica**: `src/app/auth/confirm/route.ts`,
  `src/app/auth/confirm/route.test.ts`, `src/modules/pagamentos/repositorio.ts`;
  3 testes direcionados, 80 arquivos/567 testes unitários, TypeScript e build verdes.
- **Pendente externo**: salvar o template no projeto Supabase e repetir o link com uma conta de teste;
  até essa confirmação, a SPEC fica com fechamento E2E pendente, não com falha de código conhecida.

### F-08 — reconciliação ignorava cobranças confirmadas

- **Diagnóstico**: a listagem consultava apenas `RECEIVED`, mas o Asaas considera
  `CONFIRMED` um pagamento efetuado; no cartão, `RECEIVED` pode ocorrer 32 dias depois.
- **Correção**: a listagem consulta `RECEIVED` e `CONFIRMED`, combina as páginas por ID e
  mantém o caminho de ativação idempotente.
- **Evidência técnica**: `src/modules/pagamentos/asaas.ts:192`,
  `src/modules/pagamentos/asaas.test.ts:144`,
  `scripts/jobs/reconciliacao-pagamentos.test.ts:81`.
- **Gate**: `npm.cmd run test:unit` — 80 arquivos, 568 testes verdes.

## Diagram-Definition Cross-Check

| Task | Depends on | Diagram | Status |
| --- | --- | --- | --- |
| T106 | None | None | Done |
| T107 | T106 | T106 → T107 | Done |
| T108 | T107 | T107 → T108 | Done |
| T109 | T108 | T108 → T109 | Done |
| T110 | T108 | T108 → T110 | Done |
| T111 | T110 | T110 → T111 | Done |
| T112 | T109, T111 | T109/T111 → T112 | Done |
| T113 | T112 | T112 → T113 | Done |
| T114 | T113 | T113 → T114 | Done |
| T115 | T114 | T114 → T115 | Done |
| T116 | T114 | T114 → T116 | Done |
| T117 | T115, T116 | T115/T116 → T117 | Done |

## Test Co-location Validation

| Task | Layer | Matrix | Task says | Status |
| --- | --- | --- | --- | --- |
| T106 | Catálogo e preço | unit | unit | Done |
| T107 | Schema Supabase | integration | integration | Done |
| T108 | Contratos puros | unit | unit | Done |
| T109 | Gateway Asaas | unit | unit | Done |
| T110 | Analytics | unit | unit | Done |
| T111 | Página pública | unit/render | unit/render | Done |
| T112 | Página pública | unit/render | unit/render | Done |
| T113 | Webhook e ativação | unit | unit | Done |
| T114 | Webhook e ativação | unit | unit | Done |
| T115 | Job | unit | unit | Done |
| T116 | Garantia | unit/render | unit/render | Done |
| T117 | Gate final | build | integration + build | Done |

## Traceability Plan

| Requirement | Tasks |
| --- | --- |
| PAG-02 | T107, T109, T112, T117 |
| PAG-03 | T108, T111, T116, T117 |
| PAG-05 | T107, T109, T114, T117 |
| PAG-06 | T107, T108, T112, T113, T114, T115, T116, T117 |
| PAG-08 | T111, T117 |
| PAG-09 | T106, T112, T117 |
| PAG-12 | T107, T108, T112, T117 |
| PAG-13 | T107, T109, T113, T114, T115, T117 |
| PAG-17 | T110, T117 |
| DADOS-11 | T108, T112, T117 |
| INFRA-10 | T107, T109, T113, T115, T117 |
| INFRA-12 | T106, T110, T117 |
| SEC-01 | T108, T112 |
| SEC-02 | T107, T113, T114, T115 |
| SEC-03 | T107, T112, T116, T117 |
| SEC-04 | T109, T114, T115 |
| SEC-05 | T109, T113 |
| SEC-06 | T106, T109, T115 |
| SEC-07 | T109, T110, T113, T114, T115, T116 |
| SEC-08 | T110, T113 |
| SEC-09 | T116 |

## Closing Protocol

Por instrução explícita do usuário, nenhum Verifier independente separado ou
subagent foi iniciado neste lote. O agente principal executou a revisão
fresh-eyes, os gates disponíveis, a validação visual local e um sensor de
mutação em worktree temporário: 6/6 mutantes foram mortos. `validation.md`
registra essa limitação de processo, as evidências e as dependências externas
que ainda exigem Asaas/PostHog reais.
