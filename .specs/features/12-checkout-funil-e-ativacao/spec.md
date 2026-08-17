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
