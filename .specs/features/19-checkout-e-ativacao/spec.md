# SPEC 19 — Checkout e ativação (Asaas)

| | |
| --- | --- |
| **Ordem** | 19 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 16 (endpoint público para o webhook), SPEC 17 |
| **Habilita** | SPEC 20, 21, 24 |
| **Tasks (estimativa)** | ~12 |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-02**, **PAG-05**, **PAG-06**, **PAG-09**, **PAG-12**, **PAG-13**, **DADOS-11**, **INFRA-10** (webhook) |
| **Fonte dos requisitos** | `.specs/modulos/m8-negocio-pagamentos/spec.md` · `.specs/modulos/m7-lgpd-flywheel/spec.md` (DADOS-11) |

## Problem Statement

É a costura entre dinheiro e produto. Se o webhook falhar, **alguém pagou e não entrou** — o pior
defeito possível do produto. E como o modelo é paga-primeiro, esta é a única porta de entrada.

## Goals

- [ ] Comprar informando **só o e-mail**, com cartão 12x, Pix ou boleto, em checkout próprio.
- [ ] Pagamento confirmado vira conta + matrícula de 12 meses **sem intervenção manual**.
- [ ] Webhook verificado e idempotente: o mesmo evento N vezes produz uma conta e uma matrícula.
- [ ] Job de reconciliação ativa quem pagou e ficou sem conta — nada depende só do webhook.
- [ ] Nenhuma compra se perde em silêncio: falha vira fila visível e alertada.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| PAG-02 / PAG-05 | checkout próprio integrado ao Asaas; cartão 12x, Pix e boleto; NF nativa do gateway | §P1: Checkout |
| PAG-09 | preço em configuração, dois valores (parcelado e à vista com desconto), os dois exibidos antes da escolha | §P1: Checkout (AC4) |
| PAG-06 | criação de usuário + `matricula` 12 meses + e-mail "defina sua senha"; estados `pendente → confirmada → ativada`, `confirmada → reembolsada`, `pendente → expirada`, com transição inválida rejeitada; `faturas` | §P1: Buy-then-activate |
| PAG-13 | assinatura do webhook verificada, idempotência por id do evento, job de reconciliação | §P1: Buy-then-activate (AC3–AC6) |
| PAG-12 / DADOS-11 | declaração afirmativa de 18+ e aceite dos termos com data/hora; sem coletar data de nascimento | m7 §P1: Declaração de maioridade |
| INFRA-10 (parte) | segredo do webhook fora do código, verificação antes de processar | m9 §Edge Cases |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Garantia de 7 dias, antecipação, fim da matrícula, conciliação | SPEC 20 |
| Página de vendas e eventos do funil | SPEC 21 |
| Onboarding e plano do 1º dia | SPEC 24 |
| Tiers e mensalidade | SPEC 42 |

## Contratos que esta spec fixa para as próximas

- `pagamentos` e `faturas` **sobrevivem ao DELETE-por-esquecimento** (prazo fiscal) — a SPEC 32
  precisa tratar essa exceção explicitamente.
- O fim da matrícula dispara o relógio de retenção do M7 (SPEC 32, AD-045).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Preço | R$197/ano de âncora, **valor em configuração** | y (estrutura) / n (número) |
| Desconto à vista | ~10%, percentual em configuração | y |
| Reembolso: o que volta | valor ao aluno; taxa do cartão normalmente não volta | n — **ler o contrato do Asaas** |
| CNPJ/regime para NF | ME no Simples como hipótese | n — **contador** |
| Moeda | só BRL, só Brasil | y |

**Pendências externas:** conta Asaas, contrato lido, contador.

## Success Criteria

- [ ] Compra de ponta a ponta em cada meio de pagamento, informando só o e-mail
- [ ] Mesmo webhook disparado três vezes → uma conta e uma matrícula
- [ ] Webhook apagado → o job de reconciliação ativa a compra sozinho
- [ ] E-mail com matrícula ativa comprando de novo é avisado, não cobrado
- [ ] Checkout sem a declaração de 18+ não conclui
- [ ] Transição inválida (reembolso antes da confirmação) é rejeitada com alerta
