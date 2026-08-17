# SPEC 20 — Garantia, antecipação e fim da matrícula

| | |
| --- | --- |
| **Ordem** | 20 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 19 |
| **Habilita** | SPEC 21, 32 (o relógio de retenção começa no fim da matrícula), 42 |
| **Tasks (estimativa)** | ~9 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-03**, **PAG-10**, **PAG-11**, **PAG-15** |
| **Fonte dos requisitos** | `.specs/modulos/m8-negocio-pagamentos/spec.md` |

## Problem Statement

A garantia de 7 dias é o contrapeso do paywall — sem ela o muro converte muito menos. Mas cada
reembolso de venda já antecipada custa ~11% em silêncio, e o fim dos 12 meses precisa avisar antes,
encerrar o acesso e **preservar o histórico**, porque concurso é anual e o aluno volta.

## Goals

- [ ] Reembolso dentro de 7 dias devolve pelo Asaas e encerra o acesso; fora da janela, recusa com clareza.
- [ ] Venda dentro da janela é **não-antecipável** e não entra em nenhuma solicitação de antecipação.
- [ ] Avisos de 30 e 7 dias antes do vencimento; no vencimento, acesso encerra e histórico fica.
- [ ] Relatório de conciliação: vendas confirmadas × valores recebidos × taxas × notas emitidas.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| PAG-03 | janela contada da confirmação, em dias corridos, visível para o aluno; matrícula vai a `reembolsada`; NF cancelada/ajustada; registro de quem pediu e quando | §P1: Garantia de 7 dias |
| PAG-10 | marcação não-antecipável, virada automática ao fim da janela, relatório do que está antecipável com líquido estimado; antecipar continua sendo decisão manual | §P1: Trava de antecipação |
| PAG-11 | avisos transacionais de 30 e 7 dias; encerramento sem cobrança automática; histórico preservado; renovar dentro da janela reinicia o relógio | §P1: Fim da matrícula |
| PAG-15 | NF referenciada em `faturas`, fila alertada de reemissão, relatório de conciliação | §P2: Nota fiscal e conciliação |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| DELETE dos dados do aluno | SPEC 32 — reembolso **não** apaga histórico; são pedidos distintos |
| Renovação com oferta e preço novo | fora do lançamento (venda única) |
| Chargeback como fluxo próprio | tratado aqui como evento do gateway que encerra acesso, registrado à parte do reembolso |

## Contratos que esta spec fixa para as próximas

- O **fim da matrícula** é o marco de onde a SPEC 32 conta `retencao_meses` (AD-045).
- Avisos de vencimento são **transacionais** — não dependem do consentimento de marketing (SPEC 31).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| O que o gateway devolve num estorno | prática de mercado: taxa do cartão não volta | n — contrato do Asaas |
| D+ do parcelado | pesquisado em 2026-07-23 (cartão à vista D+32) | n — confirmar no contrato |

## Success Criteria

- [ ] Reembolso no 5º dia devolve e encerra; no 9º, recusa com mensagem clara
- [ ] Venda de hoje aparece como não-antecipável; 8 dias depois, antecipável
- [ ] Matrícula vencendo em 30 dias dispara os dois avisos
- [ ] Depois de vencida: acesso bloqueado, histórico intacto, renovação traz tudo de volta
