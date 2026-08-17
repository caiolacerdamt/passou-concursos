# SPEC 24 — Tutor de dúvidas

| | |
| --- | --- |
| **Ordem** | 24 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 08, SPEC 10, SPEC 13 |
| **Habilita** | — |
| **Tasks (estimativa)** | ~11 |
| **Ritual** | **A — completo** (`design.md` próprio + Verificador independente com sensor de mutação) |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **IA-10**, **INFRA-05**, **IA-12** (consumo do alerta de gasto) |
| **Fonte dos requisitos** | `.specs/modulos/m2-camada-ia/spec.md` · `.specs/modulos/m9-infra/spec.md` §P1: Tutor ao vivo |

## Problem Statement

É a **única** superfície de IA ao vivo do produto (invariante nº7). Sem trava, um chat solto estoura
custo e vira assistente de propósito geral; com contexto injetado, teto diário e cache de pergunta
repetida, o custo fica previsível e a resposta não contradiz o que já foi conferido.

## Goals

- [ ] O tutor responde com a **explicação e as fontes já aprovadas** injetadas — nunca busca sozinho.
- [ ] Teto de 3 perguntas por aluno por dia (número em configuração), com mensagem clara ao bater.
- [ ] Pergunta semelhante na **mesma** questão reaproveita resposta já gerada.
- [ ] Resposta por streaming; API fora do ar degrada só o tutor.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| IA-10 | contexto injetado, teto diário, cache por similaridade **dentro da mesma questão**, tratamento de contradição com a explicação, tabela própria de perguntas (grupo 1, nunca em `tentativas`) | m2 §P1: Tutor de dúvidas |
| INFRA-05 | função com streaming na **Vercel Pro**; núcleo pré-computado continua de pé sem ela | m9 §P1: Tutor ao vivo |
| IA-12 (consumo) | o alerta de gasto criado na SPEC 08 passa a ter volume de verdade; **não** desliga o tutor sozinho | m2 §P1: Tutor (AC6) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Gateway, matriz de modelos, fallback | SPEC 08 |
| Explicação e fontes | SPEC 10 |
| Tutor como assistente geral / busca na internet | **proibido** (AD-012) |

## Flag no lançamento

O tutor nasce **atrás de flag desligada** (AD-076) e é construído mesmo assim. A Vercel **Pro** só é
requisito quando a flag ligar (AD-066).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Store do rate-limit | Postgres (tabela + contagem), sem Redis novo | y (M9) |
| Esforço do modelo no tutor | `medium`, em configuração | y (AD-073) |
| Perguntas do tutor | tabela própria, **grupo 1** da LGPD | y (IA-10 AC7) |

**Pendência externa:** Vercel **Pro** contratada antes de ligar a flag.

## Success Criteria

- [ ] Três perguntas passam, a quarta é bloqueada com mensagem amigável
- [ ] A mesma pergunta de outro aluno na mesma questão não gera nova chamada ao modelo
- [ ] A mesma pergunta em **questão diferente** não reaproveita cache
- [ ] Pergunta fora do assunto da questão recebe recusa educada
- [ ] Derrubar a API de IA degrada só o tutor
