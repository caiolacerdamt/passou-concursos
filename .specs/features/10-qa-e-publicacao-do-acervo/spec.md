# SPEC 10 — QA e publicação do acervo

| | |
| --- | --- |
| **Ordem** | 10 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 09 |
| **Habilita** | SPEC 11, 12, 18, 22, 26, 37 |
| **Tasks (estimativa)** | ~9 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **BANCO-07**, **BANCO-01** (execução da trava) |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` §P1: QA misto por fonte |

## Problem Statement

Publicar questão com gabarito ou enunciado errado quebra o invariante "não ensinar errado". Revisar
100% do acervo à mão não escala. O AD-006 resolve com QA **misto por fonte**: real de alta confiança
publica com amostra de auditoria; baixa confiança e inédita passam por humano.

## Goals

- [ ] Existe **uma** fila de revisão humana, com prioridade, que todas as outras specs alimentam.
- [ ] `confianca_ia` abaixo do piso (configurável) roteia para revisão antes de publicar.
- [ ] Publicação é uma porta com guardas, não um `update status`.
- [ ] Toda decisão de revisão fica registrada (`questao_revisoes`).

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-07 | piso de confiança em config; 100% de revisão para `origem='gerada_ia'`; amostra de auditoria sobre real de alta confiança; `questao_revisoes`; report de aluno entra na fila e **não** altera a questão sozinho | §P1: QA misto por fonte |
| BANCO-01 | a trava efetiva: questão real sem `fonte_citacao` **não** publica | §P1: Proveniência |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| A tela onde o operador revisa | SPEC 18 |
| Sinal de "foi útil?" / "reportar erro" do aluno | SPEC 23 (a fila que recebe é criada aqui) |
| Questão suspeita por estatística (índice de discriminação) | SPEC 35 |
| Inéditas | SPEC 37 |

## Contratos que esta spec fixa para as próximas

- **A fila de revisão é uma só.** SPEC 12 (conta que não fecha), 13 (explicação sem citação válida),
  23 (report do aluno) e 35 (questão suspeita) enfileiram aqui, com motivo distinto.
- Publicação é irreversível para o histórico: tentativa antiga continua apontando para a versão que
  respondeu.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Ator | papel único **operador de conteúdo** no MVP | y |
| Taxa de amostra de QA | em configuração; começa alta e afrouxa com acurácia provada | n (calibra) |
| Piso de `confianca_ia` | em configuração, conservador | n (calibra) |

## Success Criteria

- [ ] Baixar a `confianca_ia` de uma questão real abaixo do piso a manda para revisão
- [ ] Inédita não publica sem revisão humana
- [ ] Real sem proveniência não publica
- [ ] Report de aluno sobe o item na fila sem alterar a questão
- [ ] Decisão de revisão fica registrada com quem e quando
