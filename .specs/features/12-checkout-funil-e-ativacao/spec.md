# SPEC 12 — Checkout, funil de venda e ativação

| | |
| --- | --- |
| **Ordem** | 12 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 07 |
| **Habilita** | SPEC 13, 16, 17, 28, 34 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **A — completo** (`design.md` próprio + Verificador independente com sensor de mutação) |
| **Status** | ✅ Implementada; gates técnicos concluídos; E2E real confirmado para Pix e cartão; homologação externa restante registrada em `validation.md` |
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
| PAG-17 / INFRA-12 | quatro eventos do funil (página vista, checkout iniciado, meio escolhido, pagamento confirmado) **anônimos**, por proxy reverso do domínio; propriedades sempre vazias, incluindo meio de pagamento; bloqueio de dado pessoal na origem; sem session replay; analytics da superfície logada **atrás de flag desligada** | m9 §P2: Analytics |
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
- A URL pública de resultado é `/checkout/resultado/[token]`: token bearer aleatório,
  TTL de 48 horas, somente hash SHA-256 persistido e lookup server-side. UUID de pagamento
  não é capability pública.
- O fechamento local do reembolso é uma RPC transacional e idempotente que marca pagamento
  e matrícula juntos. NF Asaas usa o cancelamento oficial e estados de pendência próprios;
  ausência de NF não bloqueia o estorno.
- A reconciliação pode usar somente a RPC específica para `expirada → confirmada`; a máquina
  geral continua rejeitando essa transição fora desse caminho.
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

**Nota de implementação (T112):** o Asaas exige nome e CPF/CNPJ para criar o cliente pagador. O
checkout coleta esses dados no servidor, não coleta data de nascimento e não grava esses campos no
registro operacional local de pagamento; o contrato externo, CNPJ e configuração fiscal continuam
pendentes de confirmação antes da operação real.

**Nota de implementação (correções F-01–F-06):** a instrumentação não aceita nem transporta
qualquer campo de meio de pagamento. O resultado público usa capability token com hash e TTL;
o caminho de reembolso é transacional, o cancelamento de NF é recuperável e a reconciliação
tem a única abertura controlada de pagamento expirado.

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
| PAG-02 | Compra anual no cartão em até 12x, Pix e boleto | Testes unitários, banco e fluxo de checkout | Verified |
| PAG-03 | Garantia de 7 dias, reembolso e encerramento de acesso | Testes unitários, banco e fluxo de reembolso | Verified |
| PAG-05 | Checkout próprio integrado ao Asaas e NF nativa | Testes do adaptador e registro de fatura | Verified — NF real depende de CNPJ/configuração externa |
| PAG-06 | Buy-then-activate, matrícula de 12 meses e estados | Testes de transição, idempotência e ativação | Verified |
| PAG-08 | Página de vendas responsiva e honesta | Teste de renderização e teste visual manual | Verified — visual local concluído; tela autenticada de reembolso ainda requer conta de teste |
| PAG-09 | Preço e desconto à vista em configuração | Testes do catálogo e da leitura de preço | Verified |
| PAG-12 | Declaração afirmativa de 18+ sem data de nascimento | Testes do checkout e banco | Verified |
| PAG-13 | Webhook verificado, idempotente e reconciliação | Testes de rota, banco e job | Verified |
| PAG-17 | Funil anônimo, proxy próprio e sem session replay | Testes de allowlist e rota de analytics | Verified |
| DADOS-11 | Aceite datado de termos e maioridade | Testes do checkout e banco | Verified |
| INFRA-10 | Entrada de webhook com assinatura e falha observável | Testes da rota e do alerta | Verified |
| INFRA-12 | Analytics pré-login anônimo e não crítico para compra | Testes do proxy e bloqueio no navegador | Verified |
| SEC-01 | Entrada do checkout é validada no serviço e combinações incoerentes são recusadas | `v5.0.0-2.2.1`, `v5.0.0-2.2.2`, `v5.0.0-2.2.3` · testes da action | Verified |
| SEC-02 | Máquina de estados exige ordem e claim impede dupla ativação | `v5.0.0-2.3.1`, `v5.0.0-2.3.4` · testes de banco | Verified |
| SEC-03 | Reembolso e leitura de dados usam autorização no servidor, não no navegador | `v5.0.0-8.2.1`, `v5.0.0-8.3.1` · testes de RLS e action | Verified |
| SEC-04 | Asaas, Supabase e PostHog usam credenciais de serviço com privilégio mínimo | `v5.0.0-13.2.1`, `v5.0.0-13.2.2` · testes de configuração | Verified |
| SEC-05 | Chamadas externas exigem HTTPS e destino permitido | `v5.0.0-12.2.1`, `v5.0.0-12.3.1`, `v5.0.0-13.2.4` · testes do gateway | Verified |
| SEC-06 | Segredos não entram no código, no cliente ou no build | `v5.0.0-13.3.1` · inspeção e testes de ambiente | Verified |
| SEC-07 | Webhook e falhas retornam mensagem genérica e não registram token, CPF, e-mail ou pagamento bruto | `v5.0.0-16.2.5`, `v5.0.0-16.5.1`, `v5.0.0-16.5.2`, `v5.0.0-16.5.3` · testes de saneamento | Verified |
| SEC-08 | Rotas HTTP respondem com tipo de conteúdo coerente | `v5.0.0-4.1.1` · testes de Route Handler | Verified |
| SEC-09 | Operações da garantia verificam a sessão por serviço confiável | `v5.0.0-7.2.1` · testes da action | Verified |

`Verified` significa que a implementação local e os testes correspondentes passaram. A ativação real
de Asaas/NF continua dependente de credenciais, CNPJ e configuração fiscal externos; a oferta e o
checkout já foram conferidos no navegador local.

## Success Criteria

- [x] Abrir no celular, entender método/preço/garantia e chegar ao checkout em um clique — conferido em desktop e viewport de 360 px
- [ ] Compra de ponta a ponta em cada meio de pagamento — Pix e cartão PASS no Sandbox; boleto ainda pendente
- [x] Mesmo webhook disparado três vezes → **uma** conta e **uma** matrícula
- [x] Webhook apagado → o job de reconciliação ativa a compra sozinho
- [x] E-mail com matrícula ativa comprando de novo é avisado, não cobrado
- [x] Checkout sem a declaração de 18+ não conclui
- [x] Transição inválida (reembolso antes da confirmação) é rejeitada com alerta
- [x] Reembolso no 5º dia devolve e encerra; no 9º, recusa com mensagem clara
- [x] Os quatro eventos aparecem sem nenhum dado pessoal nas propriedades
- [x] Bloquear o analytics no navegador e concluir a compra normalmente
