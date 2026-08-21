# SPEC 12 — Checkout, funil de venda e ativação

| | |
| --- | --- |
| **Ordem** | 12 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 07 |
| **Habilita** | SPEC 13, 16, 17, 28, 34 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **A — completo** (`design.md` próprio + Verificador independente com sensor de mutação) |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-08**, **PAG-17**, **INFRA-12**, **PAG-02**, **PAG-05**, **PAG-09**, **PAG-06**, **PAG-13**, **PAG-12**, **DADOS-11**, **PAG-03**, **INFRA-10** (webhook) |
| **Fonte dos requisitos** | `.specs/modulos/m8-negocio-pagamentos/spec.md` · `.specs/modulos/m9-infra/spec.md` · `.specs/modulos/m7-lgpd-flywheel/spec.md` (DADOS-11) |
| **Vem de** | SPEC 19 + SPEC 21 + a garantia da SPEC 20 do recorte de 42 (AD-089) |

## Problem Statement

É a costura entre dinheiro e produto, e é **ritual A** por um motivo só: se o webhook falhar,
**alguém pagou e não entrou** — o pior defeito possível. Como o modelo é paga-primeiro, esta é a
única porta de entrada, e a página de vendas é a única superfície de conversão.

Página e checkout são a mesma spec porque são o mesmo funil: o que a página promete é o que o
checkout cobra.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| PAG-08 | página responsiva sem login: método, evidências (`docs/EVIDENCIAS-CIENTIFICAS.md`), garantia, os dois preços, link para política e termos; **declaração honesta do que existe hoje** | m8 §P1: Página de vendas |
| PAG-17 / INFRA-12 | quatro eventos do funil (página vista, checkout iniciado, meio escolhido, pagamento confirmado) **anônimos**, por proxy reverso do domínio; bloqueio de dado pessoal na origem; sem session replay; analytics da superfície logada **atrás de flag desligada** | m9 §P2: Analytics |
| PAG-02 / PAG-05 | checkout próprio integrado ao Asaas; cartão 12x, Pix e boleto; NF nativa do gateway | m8 §P1: Checkout |
| PAG-09 | preço em configuração, dois valores (parcelado e à vista com desconto), os dois exibidos antes da escolha | m8 §P1: Checkout (AC4) |
| PAG-06 | pagamento confirmado vira usuário + `matricula` de 12 meses **sem intervenção manual**; e-mail "defina sua senha"; estados `pendente → confirmada → ativada`, `confirmada → reembolsada`, `pendente → expirada`; transição inválida rejeitada; `faturas` | m8 §P1: Buy-then-activate |
| PAG-13 / INFRA-10 | assinatura do webhook verificada antes de processar; idempotência por id do evento; **job de reconciliação** que ativa quem pagou e ficou sem conta; falha vira fila visível e alertada | m8 §P1: Buy-then-activate (AC3–AC6) |
| PAG-12 / DADOS-11 | declaração afirmativa de 18+ e aceite dos termos com data/hora; **sem coletar data de nascimento** | m7 §P1: Declaração de maioridade |
| PAG-03 | garantia de 7 dias: janela contada da confirmação, em dias corridos, visível ao aluno; reembolso pelo Asaas leva a matrícula a `reembolsada` e encerra o acesso; fora da janela recusa com clareza; quem pediu e quando fica registrado | m8 §P1: Garantia de 7 dias |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Trava de antecipação, avisos de 30/7 dias, renovação, conciliação e reemissão de NF (PAG-10/11/15) | SPEC 28 — a **validade** da matrícula já corta o acesso desde a SPEC 07 |
| Onboarding e plano do 1º dia (PAG-14) | SPEC 13 |
| DELETE dos dados do aluno | SPEC 14 — reembolso **não** apaga histórico; são pedidos distintos |
| Tiers e mensalidade | SPEC 34 |
| Copy e arte finais da página | decisão de marketing — a spec define **o que** a página contém |
| Feature flag pela ferramenta de analytics | **proibido** — flags vivem na SPEC 02 (AD-078) |

## Contratos que esta spec fixa para as próximas

- `pagamentos` e `faturas` **sobrevivem ao DELETE-por-esquecimento** (prazo fiscal) — a SPEC 14
  trata essa exceção explicitamente.
- O fim da matrícula é o marco de onde a SPEC 18 conta `retencao_meses` (AD-045).
- Avisos de vencimento são **transacionais** — não dependem de consentimento de marketing.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Preço | R$197/ano de âncora, **valor em configuração** | y (estrutura) / n (número) |
| Desconto à vista | ~10%, percentual em configuração | y |
| Reembolso: o que volta | valor ao aluno; taxa do cartão normalmente não volta | n — **ler o contrato do Asaas** |
| CNPJ/regime para NF | ME no Simples como hipótese | n — **contador** |
| Ferramenta de analytics | PostHog Cloud, região EUA (AD-079) | y / **free tier n — conferir em fonte primária antes de ligar** |
| Moeda | só BRL, só Brasil | y |

**Pendências externas que travam esta spec:** conta Asaas + **CNPJ** + contrato lido. É o bloqueio de
calendário mais longo do MVP — resolver em paralelo com as specs 08–11.

**Open questions:** o contrato do Asaas, o CNPJ/regime fiscal e o free tier do PostHog ainda precisam
de confirmação externa; a implementação local não depende de assumir esses valores como fato.

## User Stories

### P1: visitante entende a oferta e inicia a compra

**Acceptance Criteria**:

1. **When** uma pessoa abre a página sem sessão, a página SHALL mostrar método, evidências, garantia, os dois preços, termos e política antes do botão de checkout.
2. **When** a pessoa escolhe um meio de pagamento, o checkout SHALL manter o preço e o meio escolhidos visíveis e SHALL exigir e-mail, declaração afirmativa de 18+ e aceite datado dos termos.
3. **If** a pessoa não marcar 18+ ou não aceitar os termos, **then** o checkout SHALL recusar a criação da cobrança e SHALL não coletar data de nascimento.
4. **When** o analytics estiver bloqueado ou indisponível, a página e o checkout SHALL continuar permitindo a compra.

### P1: pagamento confirmado libera o produto

**Acceptance Criteria**:

1. **When** o gateway confirmar um pagamento válido, o sistema SHALL criar ou localizar a conta pelo e-mail, criar uma matrícula de 12 meses e enviar o e-mail para definir a senha sem intervenção manual.
2. **When** o mesmo evento de webhook chegar mais de uma vez, o sistema SHALL processá-lo uma única vez e SHALL deixar uma única conta e uma única matrícula ativa.
3. **If** a assinatura do webhook for inválida, **then** o sistema SHALL rejeitar o evento antes de processá-lo e SHALL registrar a falha sem expor dados pessoais no alerta.
4. **When** a ativação não concluir, o sistema SHALL manter uma pendência visível para retry e SHALL emitir um alerta operacional.
5. **If** a cobrança for confirmada e o webhook não chegar, **then** o job de reconciliação SHALL encontrar a cobrança paga e SHALL concluir a ativação.

### P1: aluno controla a garantia

**Acceptance Criteria**:

1. **While** a matrícula estiver dentro de sete dias corridos da confirmação, o aluno SHALL ver os dias restantes e SHALL poder solicitar reembolso.
2. **If** o reembolso for solicitado antes da confirmação ou depois da janela, **then** o sistema SHALL recusar claramente, SHALL preservar a matrícula e SHALL registrar a tentativa inválida para alerta.
3. **When** o Asaas confirmar um reembolso válido, o sistema SHALL marcar o pagamento e a matrícula como reembolsados, SHALL encerrar o acesso e SHALL registrar solicitante, data/hora e meio.

## Requirement Traceability

| ID | Contrato coberto nesta spec | Evidência esperada | Status |
| --- | --- | --- | --- |
| PAG-02 | Compra anual no cartão em até 12x, Pix e boleto | Testes unitários, banco e fluxo de checkout | Pending |
| PAG-03 | Garantia de 7 dias, reembolso e encerramento de acesso | Testes unitários, banco e fluxo de reembolso | Pending |
| PAG-05 | Checkout próprio integrado ao Asaas e NF nativa | Testes do adaptador e registro de fatura | Pending |
| PAG-06 | Buy-then-activate, matrícula de 12 meses e estados | Testes de transição, idempotência e ativação | Pending |
| PAG-08 | Página de vendas responsiva e honesta | Teste de renderização e teste visual manual | Pending |
| PAG-09 | Preço e desconto à vista em configuração | Testes do catálogo e da leitura de preço | Pending |
| PAG-12 | Declaração afirmativa de 18+ sem data de nascimento | Testes do checkout e banco | Pending |
| PAG-13 | Webhook verificado, idempotente e reconciliação | Testes de rota, banco e job | Pending |
| PAG-17 | Funil anônimo, proxy próprio e sem session replay | Testes de allowlist e rota de analytics | Pending |
| DADOS-11 | Aceite datado de termos e maioridade | Testes do checkout e banco | Pending |
| INFRA-10 | Entrada de webhook com assinatura e falha observável | Testes da rota e do alerta | Pending |
| INFRA-12 | Analytics pré-login anônimo e não crítico para compra | Testes do proxy e bloqueio no navegador | Pending |
| SEC-01 | Entrada do checkout é validada no serviço e combinações incoerentes são recusadas | `v5.0.0-2.2.1`, `v5.0.0-2.2.2`, `v5.0.0-2.2.3` · testes da action | Pending |
| SEC-02 | Máquina de estados exige ordem e claim impede dupla ativação | `v5.0.0-2.3.1`, `v5.0.0-2.3.4` · testes de banco | Pending |
| SEC-03 | Reembolso e leitura de dados usam autorização no servidor, não no navegador | `v5.0.0-8.2.1`, `v5.0.0-8.3.1` · testes de RLS e action | Pending |
| SEC-04 | Asaas, Supabase e PostHog usam credenciais de serviço com privilégio mínimo | `v5.0.0-13.2.1`, `v5.0.0-13.2.2` · testes de configuração | Pending |
| SEC-05 | Chamadas externas exigem HTTPS e destino permitido | `v5.0.0-12.2.1`, `v5.0.0-12.3.1`, `v5.0.0-13.2.4` · testes do gateway | Pending |
| SEC-06 | Segredos não entram no código, no cliente ou no build | `v5.0.0-13.3.1` · inspeção e testes de ambiente | Pending |
| SEC-07 | Webhook e falhas retornam mensagem genérica e não registram token, CPF, e-mail ou pagamento bruto | `v5.0.0-16.2.5`, `v5.0.0-16.5.1`, `v5.0.0-16.5.2`, `v5.0.0-16.5.3` · testes de saneamento | Pending |
| SEC-08 | Rotas HTTP respondem com tipo de conteúdo coerente | `v5.0.0-4.1.1` · testes de Route Handler | Pending |
| SEC-09 | Operações da garantia verificam a sessão por serviço confiável | `v5.0.0-7.2.1` · testes da action | Pending |

## Success Criteria

- [ ] Abrir no celular, entender método/preço/garantia e chegar ao checkout em um clique
- [ ] Compra de ponta a ponta em cada meio de pagamento, informando só o e-mail
- [ ] Mesmo webhook disparado três vezes → **uma** conta e **uma** matrícula
- [ ] Webhook apagado → o job de reconciliação ativa a compra sozinho
- [ ] E-mail com matrícula ativa comprando de novo é avisado, não cobrado
- [ ] Checkout sem a declaração de 18+ não conclui
- [ ] Transição inválida (reembolso antes da confirmação) é rejeitada com alerta
- [ ] Reembolso no 5º dia devolve e encerra; no 9º, recusa com mensagem clara
- [ ] Os quatro eventos aparecem sem nenhum dado pessoal nas propriedades
- [ ] Bloquear o analytics no navegador e concluir a compra normalmente
