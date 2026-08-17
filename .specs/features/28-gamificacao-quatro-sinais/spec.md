# SPEC 28 — Gamificação: os quatro sinais

| | |
| --- | --- |
| **Ordem** | 28 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 24, SPEC 25, SPEC 27 |
| **Habilita** | SPEC 33 |
| **Tasks (estimativa)** | ~12 |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **GAM-01**, **GAM-02**, **GAM-03**, **GAM-04**, **GAM-07**, **GAM-11**, **GAM-12**, **GAM-13**, **GAM-14**, **GAM-08** |
| **Fonte dos requisitos** | `.specs/modulos/m6-gamificacao/spec.md` |

## Problem Statement

Quatro coisas diferentes precisam ser ditas ao aluno sem virar um número único que esconde a
verdade: constância, esforço de hoje, se está avançando e quanto cresceu. O risco do módulo é
premiar presença — por isso o anel tem teto no plano e o sinal "no prazo" existe para dizer que
sequência bonita e nenhum avanço é reprovação.

## Goals

- [ ] Quatro sinais separados, nunca combinados num índice.
- [ ] Sequência mantida ao cumprir o **`piso`** entregue pelo sistema, respeitando a agenda declarada.
- [ ] Anel medindo **bloco concluído** com teto na `meta_cheia`; sem trava por tempo de resposta.
- [ ] "No prazo" com `data_prova` compara ritmo × tempo restante; sem `data_prova`, mede ritmo de avanço — e troca sozinho.
- [ ] Tudo é projeção recalculável; o M6 **nunca** escreve em `tentativas`.
- [ ] Anel e sequência calculados na abertura da tela (AD-071); progresso e histórico por job.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| GAM-01 / GAM-13 / GAM-14 | os quatro sinais como projeção; o que é ao vivo e o que é job | §P1: Quatro sinais separados |
| GAM-02 | sequência pelo piso, agenda declarada, folga declarada não conta contra | §P1: Sequência de barra baixa |
| GAM-07 / GAM-11 | anel por bloco com teto; bloco com erro só fecha com a causa declarada; **sem** trava de tempo (AD-060) | §P1: Anel do dia |
| GAM-03 / GAM-12 | "no prazo" nos dois modos, sem congelamento nem escudo | §P1: Sinal "no prazo" |
| GAM-04 | progresso desde o ponto de partida; nunca é moeda do hábito | §P1: Quatro sinais (AC2/AC3) |
| GAM-08 | sem ranking, liga, placar ou percentil entre alunos | §P2: 100% solo |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Escudos, reset suave, janela de recuperação, notificação | SPEC 33 |
| Grupo privado de responsabilidade | SPEC 33 (P3) |
| Geração do plano e dos dois níveis | SPEC 06 |

## Flags no lançamento

O AD-076 liga **apenas a sequência** entre os sinais de gamificação; anel, "no prazo" e progresso
nascem **atrás de flag desligada** — e são construídos assim mesmo.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Fuso do aluno | sequência usa o fuso declarado vigente; virada do dia não retroage | y (edge case) |
| Falha do job do plano | não quebra sequência nem consome escudo | y (edge case) |
| Matrícula vencida | sequência preservada no histórico, dias sem acesso não contam como quebra | y (edge case) |

## Success Criteria

- [ ] Apagar a projeção de hábito e reconstruí-la do log + planos devolve os mesmos quatro números
- [ ] Cumprir só o piso em 5 dias declarados mantém a sequência depois de um fim de semana sem estudar
- [ ] Responder 200 questões fora do plano para o anel na meta cheia
- [ ] Erro sem causa declarada não fecha o bloco
- [ ] 15 dias só de piso: sequência em 15 **e** "no prazo" em alerta
- [ ] Nenhuma tela mostra posição comparativa entre alunos
