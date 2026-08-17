# SPEC 14 — Ciclo de vida da explicação

| | |
| --- | --- |
| **Ordem** | 14 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 13 |
| **Habilita** | SPEC 23, 39 |
| **Tasks (estimativa)** | ~8 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **IA-09**, **IA-07** |
| **Fonte dos requisitos** | `.specs/modulos/m2-camada-ia/spec.md` |

## Problem Statement

A SPEC 09 criou versões de questão. Sem uma regra de invalidação, uma retificação de gabarito deixa
a explicação antiga no ar **ensinando errado** — exatamente o que o produto promete não fazer.

## Goals

- [ ] Mudança substantiva (gabarito, enunciado, alternativas) tira a explicação do ar **na hora**.
- [ ] Mudança cosmética não regera nada.
- [ ] Explicação invalidada volta ao ar só depois de revisão humana.
- [ ] Aluno tem dois sinais separados — "foi útil?" e "reportar erro" — e nenhum deles muda a explicação sozinho.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| IA-09 | invalidação imediata por tipo de mudança; regeração pela fábrica; volta só com revisão; questão exibida sem explicação (com aviso) ou retirada de circulação, conforme configuração; tentativas antigas intactas | §P1: Explicação amarrada à versão |
| IA-07 | `feedback_explicacao` com os dois sinais; fila priorizada por volume; feedback é sinal, nunca autoridade; classificado no **grupo 1** da LGPD | §P2: Dois sinais de feedback |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Os botões na tela | SPEC 23 (a tabela e a regra nascem aqui) |
| Descarte e refação do áudio correspondente | SPEC 39 (contrato TTS-04 registrado aqui) |
| Questão suspeita por estatística | SPEC 35 |

## Contratos que esta spec fixa para as próximas

- `feedback_explicacao` é **grupo 1** — entra na rotina de esquecimento da SPEC 32.
- Quando a explicação é invalidada, o áudio daquela versão é descartado (a SPEC 39 implementa).

## Success Criteria

- [ ] Retificar o gabarito de uma questão já respondida faz a explicação sumir na hora e entrar na fila
- [ ] Corrigir um acento não regera explicação nenhuma
- [ ] Tentativas antigas permanecem intactas depois da invalidação
- [ ] Três alunos reportando erro na mesma questão sobem o item na fila sem alterar o texto
