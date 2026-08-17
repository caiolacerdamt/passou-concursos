# SPEC 09 — Gabarito, versões e classificação

| | |
| --- | --- |
| **Ordem** | 09 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 08 |
| **Habilita** | SPEC 10, 11, 26 |
| **Tasks (estimativa)** | ~9 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **BANCO-04**, **BANCO-05** (parte: classificação por IA), **BANCO-13** (comportamento) |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` |

## Problem Statement

Questão extraída ainda não tem resposta certa. A verdade da alternativa correta vem do **gabarito
oficial definitivo** — nunca da IA (invariante nº4). E questão precisa cair no tópico certo, senão o
plano manda o aluno estudar a coisa errada e o Raio-X conta no lugar errado.

## Goals

- [ ] `resposta_correta` e `gabarito_versao` preenchidos por cruzamento com o gabarito definitivo.
- [ ] Anulada marcada, mantida no acervo e fora do treino.
- [ ] Retificação depois de publicada gera **versão nova**, classificada cosmética × substantiva.
- [ ] Cada questão classificada em tópico; o que não encaixa vira candidato, não tópico canônico.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-04 | cruzamento por `numero`; `anulada = true` mantendo a questão; retificação → nova `questao_versao` sem reescrever a anterior | §P1: Cruzamento de gabarito |
| BANCO-13 | a marcação **cosmética × substantiva** registrada no momento da versão (a SPEC 14 depende dela para invalidar explicação) | §P1: Cruzamento (AC3) + m2 IA-09 AC4 |
| BANCO-05 (parte) | classificação da questão no tópico como tarefa do gateway; tópico inexistente vira **candidato**, nunca canônico | §P3: Tela de curadoria (AC1) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Tela de curadoria da taxonomia | SPEC 18 |
| Piso de confiança, amostra e fila de revisão | SPEC 10 |
| Explicação e verificação de conta | SPEC 12, 13 |
| Invalidação da explicação por mudança de versão | SPEC 14 |

## Contratos que esta spec fixa para as próximas

- Questão **anulada** conta na frequência do Raio-X (a banca cobrou o assunto) e **não** vira treino
  — as duas regras vivem em specs diferentes (26 e 06) e nascem deste campo.
- A classificação "cosmética × substantiva" **SHALL NOT** ser inferida depois pela IA.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Gabarito definitivo chega antes ou depois da extração | o cruzamento é idempotente e espera as questões existirem | y (edge case do M1) |
| Classificação | tarefa própria do gateway (IA-02), não a mesma chamada da extração | y (invariante nº12) |

## Success Criteria

- [ ] Rodar o gabarito de uma prova preenche `resposta_correta` + `gabarito_versao` e marca as anuladas
- [ ] Retificar gabarito de questão respondida cria versão nova; a tentativa antiga segue apontando para a versão que respondeu
- [ ] Tópico sugerido inexistente aparece como candidato e **não** cria tópico canônico
