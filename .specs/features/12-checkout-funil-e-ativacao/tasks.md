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
somente dados anônimos ao PostHog quando configurado, sem bloquear a compra.
**Where**: `src/modules/analytics/funil.ts`
**Depends on**: T108
**Requirement**: PAG-17, INFRA-12, SEC-07, SEC-08
**Tools**: Skill `tlc-spec-driven`
**Done when**:

- [x] Existem somente quatro eventos públicos e meio é o único campo opcional permitido.
- [x] E-mail, nome, CPF, telefone, `user_id`, pagamento e chaves desconhecidas são descartados.
- [x] Sem PostHog, com bloqueador ou com timeout, a rota continua respondendo sem afetar o checkout.
- [x] Não há session replay nem emissão da flag/logado na superfície protegida.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): adiciona proxy anonimo do funil`
**Status**: Done

**Execution record**

- **State**: concluida; allowlist, proxy same-origin e transporte servidor-only publicados.
- **Assumptions**: PostHog usa endpoint EUA oficial configurado por ambiente; `distinct_id=anonimo` é o único identificador enviado.
- **Files**: `src/modules/analytics/funil.ts`, `src/modules/analytics/funil.test.ts`, `src/modules/analytics/posthog.ts`, `src/modules/analytics/posthog.test.ts`, `src/app/api/analytics/route.ts`, `src/app/api/analytics/route.test.ts`, `src/modules/conta/rotas.ts`, `src/modules/conta/rotas.test.ts`.
- **Success evidence**: `npm run test:unit` — 64 arquivos, 514 testes verdes antes do teste direto do transporte; depois, transporte isolado — 1 arquivo, 3 testes verdes.

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
- [x] Termos e privacidade são alcançáveis sem login e deixam a revisão jurídica explícita.
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
- [x] Pix/boleto/cartão retornam para uma página própria de resultado com status operacional.

**Tests**: unit/render
**Gate**: quick
**Commit**: `feat(pag): implementa checkout proprio`
**Status**: Done

**Execution record**

- **State**: concluida; checkout proprio valida no servidor, congela o valor, cria a cobrança e exibe resultado operacional sem depender de analytics.
- **Assumptions**: o contrato atual do Asaas exige nome e CPF/CNPJ para criar o pagador; esses dados são informados pelo comprador, usados somente no servidor e não entram no registro financeiro local. A cobrança vence no dia seguinte à criação.
- **Files**: `src/app/checkout/page.tsx`, `src/app/checkout/formulario.tsx`, `src/app/checkout/acoes.ts`, `src/app/checkout/resultado/[id]/page.tsx`, `src/modules/pagamentos/checkout.ts`, `src/modules/pagamentos/repositorio.ts`, `src/modules/pagamentos/resultado.ts`, `src/modules/pagamentos/contratos.ts`, `src/modules/pagamentos/asaas.ts`, `supabase/migrations/20260821120000_checkout_pagamento.sql` e testes co-localizados.
- **Success evidence**: `npm run test:unit` — 70 arquivos, 528 testes verdes; `npm run lint` — 0 erros e 0 avisos; `npx tsc --noEmit` — verde; `npm run db:push` aplicou a migration do RPC no Supabase de desenvolvimento.

### T113: Validar webhook e registrar idempotência

**What**: Criar a Route Handler pública do Asaas, validar assinatura antes do
parse, registrar evento, tratar desconhecido/fora de ordem e encaminhar somente
confirmação válida para ativação.
**Where**: `src/app/api/webhooks/asaas/route.ts`
**Depends on**: T112
**Requirement**: PAG-13, INFRA-10, PAG-06, SEC-02, SEC-05, SEC-07, SEC-08
**Tools**: Skill `tlc-spec-driven`; guia local do Next 16 para Route Handlers
**Done when**:

- [ ] Token ausente ou incorreto é rejeitado antes de processamento e reportado sem payload bruto.
- [ ] O mesmo `event.id` três vezes resulta em uma única ação.
- [ ] Evento desconhecido ou transição inválida vira registro/alerta e não libera conteúdo.
- [ ] A rota responde de forma estável e nunca depende de sessão do navegador.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(pag): protege e torna idempotente o webhook`
**Status**: Pending

### T114: Ativar usuário, matrícula e fatura após confirmação

**What**: Implementar o orquestrador que cria/localiza conta, envia definição de
senha, cria matrícula de 12 meses, grava fatura e abre pendência separada para
falhas de NF sem bloquear a ativação.
**Where**: `src/modules/pagamentos/ativacao.ts`
**Depends on**: T113
**Requirement**: PAG-05, PAG-06, PAG-13, SEC-02, SEC-03, SEC-04, SEC-07
**Tools**: Skill `tlc-spec-driven`; SDK Supabase existente
**Done when**:

- [ ] Pagamento confirmado sem usuário cria conta pelo e-mail e envia o fluxo de senha.
- [ ] Pagamento confirmado com usuário existente reaproveita a conta e não duplica matrícula.
- [ ] A matrícula usa meses do produto no banco e fecha o paywall no reembolso.
- [ ] Falha em Auth, matrícula ou NF vira pendência visível e alerta, sem perder a compra confirmada.
- [ ] O mesmo processo repetido é seguro e termina em `ativada` uma única vez.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(pag): ativa conta e matricula pelo pagamento`
**Status**: Pending

### T115: Implementar job de reconciliação e expiração

**What**: Criar job executável fora do serverless que consulta cobranças pagas,
reativa pendências de ativação, expira pagamentos pendentes vencidos, atualiza a
fila e reporta falhas.
**Where**: `scripts/jobs/reconciliacao-pagamentos.mts`
**Depends on**: T114
**Requirement**: PAG-06, PAG-13, INFRA-10, SEC-02, SEC-04, SEC-06, SEC-07
**Tools**: Skill `tlc-spec-driven`; padrão dos jobs existentes
**Done when**:

- [ ] Cobrança paga sem webhook é encontrada e percorre o mesmo caminho de ativação.
- [ ] Job repetido não cria conta, matrícula ou evento duplicado.
- [ ] Pendência vencida passa a `expirada` e não cria conta.
- [ ] Falha de consulta/ativação fica na fila, é saneada no alerta e deixa o processo vermelho.
- [ ] Existe script no `package.json` e documentação do segredo no workflow/`.env.example`.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): reconcilia pagamentos pendentes`
**Status**: Pending

### T116: Entregar garantia, pedido de reembolso e encerramento de acesso

**What**: Criar o módulo e a tela autenticada de garantia, mostrar dias
restantes, recusar fora da janela ou antes da confirmação e processar o estorno
no Asaas antes de marcar pagamento/matrícula reembolsados.
**Where**: `src/modules/pagamentos/garantia.ts`
**Depends on**: T114
**Requirement**: PAG-03, PAG-06, SEC-03, SEC-07, SEC-09
**Tools**: Skill `tlc-spec-driven`; documentação oficial do estorno Asaas
**Done when**:

- [ ] No quinto dia a tela mostra a janela e permite solicitar; no nono dia recusa com clareza.
- [ ] Reembolso antes da confirmação é rejeitado, alertado e não encerra acesso.
- [ ] Estorno confirmado grava solicitante, timestamp e meio, marca ambos os estados e fecha o paywall.
- [ ] Falha do gateway não marca reembolso falso e abre pendência de retry.

**Tests**: unit/render
**Gate**: quick
**Commit**: `feat(pag): implementa garantia e reembolso`
**Status**: Pending

### T117: Fechar integração, rastreabilidade e gate da SPEC

**What**: Completar testes de contrato entre checkout, webhook, reconciliação,
faturas, retenção e paywall; atualizar rastreabilidade e preparar o pacote para
verificação independente.
**Where**: `tests/db/pagamentos-schema.test.ts`
**Depends on**: T115, T116
**Requirement**: PAG-02, PAG-03, PAG-05, PAG-06, PAG-08, PAG-09, PAG-12, PAG-13, PAG-17, DADOS-11, INFRA-10, INFRA-12, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-09
**Tools**: Skill `tlc-spec-driven`; gates do projeto
**Done when**:

- [ ] O teste de banco cobre estados, idempotência, RLS, fila, retenção e matrícula única.
- [ ] A matriz de rastreabilidade da SPEC e o status de cada task têm evidência real.
- [ ] `validate_spec.py`, `validate_tasks.py`, unit, db, lint e build passam, ou a limitação fica registrada.
- [ ] O teste visual manual fica documentado com `/` e `/checkout`, sem criar mockup.

**Tests**: integration + build
**Gate**: build
**Commit**: `test(pag): fecha contrato do funil e ativacao`
**Status**: Pending

## Diagram-Definition Cross-Check

| Task | Depends on | Diagram | Status |
| --- | --- | --- | --- |
| T106 | None | None | Pending |
| T107 | T106 | T106 → T107 | Pending |
| T108 | T107 | T107 → T108 | Pending |
| T109 | T108 | T108 → T109 | Pending |
| T110 | T108 | T108 → T110 | Pending |
| T111 | T110 | T110 → T111 | Pending |
| T112 | T109, T111 | T109/T111 → T112 | Pending |
| T113 | T112 | T112 → T113 | Pending |
| T114 | T113 | T113 → T114 | Pending |
| T115 | T114 | T114 → T115 | Pending |
| T116 | T114 | T114 → T116 | Pending |
| T117 | T115, T116 | T115/T116 → T117 | Pending |

## Test Co-location Validation

| Task | Layer | Matrix | Task says | Status |
| --- | --- | --- | --- | --- |
| T106 | Catálogo e preço | unit | unit | Pending |
| T107 | Schema Supabase | integration | integration | Pending |
| T108 | Contratos puros | unit | unit | Pending |
| T109 | Gateway Asaas | unit | unit | Pending |
| T110 | Analytics | unit | unit | Pending |
| T111 | Página pública | unit/render | unit/render | Pending |
| T112 | Página pública | unit/render | unit/render | Pending |
| T113 | Webhook e ativação | unit | unit | Pending |
| T114 | Webhook e ativação | unit | unit | Pending |
| T115 | Job | unit | unit | Pending |
| T116 | Garantia | unit/render | unit/render | Pending |
| T117 | Gate final | build | integration + build | Pending |

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

Depois de T117, o coordenador deve disparar um único Verifier independente com
sensor de mutação scratch, aguardar `worker_done`/veredito final e só então
escrever `validation.md`. Se o Verifier encontrar falha, corrigir e aguardar a
verificação de retorno sem cancelar uma execução em andamento. `validate_state.py`
é o último gate antes de declarar a SPEC concluída.
