# SPEC 25 — Progresso: caderno de erros e histórico

| | |
| --- | --- |
| **Ordem** | 25 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 06, SPEC 24 |
| **Habilita** | SPEC 28 (os quatro sinais moram nesta superfície) |
| **Tasks (estimativa)** | ~7 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **ALUNO-10** (superfície), **ALUNO-02** (AC2: placar por job) |
| **Fonte dos requisitos** | `.specs/modulos/m4-coluna-vertebral/spec.md` |

## Problem Statement

"Progresso" é uma das quatro superfícies que nascem ligadas (AD-076) e hoje não existe: o caderno de
erros já é uma projeção pronta desde a SPEC 06, sem nenhuma tela que a mostre. Sem ela o aluno erra e
não tem para onde voltar.

## Goals

- [ ] Caderno de erros filtrável **por causa** e **por tópico**.
- [ ] Histórico do aluno legível a partir do log, sem inventar número.
- [ ] Aluno sem histórico vê estado inicial explícito — nunca zero apresentado como fracasso.
- [ ] O número mostrado é o do job (placar com pequeno atraso), sem cálculo pesado ao vivo.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| ALUNO-10 | tela do caderno com os dois filtros; o bloco Revisar do plano puxa esses erros (a regra já é da SPEC 06) | §P2: Caderno de erros |
| ALUNO-02 (AC2) | leitura de projeção, não recálculo na abertura — a exceção do AD-071 vale só para anel e sequência (SPEC 28) | §P1: Projeções |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Sequência, anel do dia, "no prazo", progresso desde o ponto de partida | SPEC 28 — esta spec entrega a **superfície** onde eles vão morar |
| Exportação de dados do titular | SPEC 32 |
| Qualquer comparação com outros alunos | **proibida** no lançamento (invariante nº15) |

## Success Criteria

- [ ] Errar 3 questões com causas diferentes e ver o caderno agrupar por causa e por tópico
- [ ] Filtrar por causa e por tópico funciona junto
- [ ] Aluno novo vê estado inicial explícito
- [ ] Nenhuma tela exibe posição relativa entre alunos
