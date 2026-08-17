# SPEC 22 — Sessão de questões

| | |
| --- | --- |
| **Ordem** | 22 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 06, SPEC 10, SPEC 17 |
| **Habilita** | SPEC 23, 24, 28, 29, 38 |
| **Tasks (estimativa)** | ~11 |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **ALUNO-03** (superfície), **ALUNO-01** (superfície), **BANCO-01** (AC2: fonte visível) |
| **Fonte dos requisitos** | `.specs/modulos/m4-coluna-vertebral/spec.md` · `.specs/modulos/m1-banco-questoes/spec.md` |

## Problem Statement

Toda a máquina de servidor das SPECs 04–14 só vira produto quando o aluno consegue abrir um bloco do
plano, responder e dizer por que errou. É uma das **quatro superfícies que nascem ligadas** (AD-076).

## Goals

- [ ] Abrir um bloco do plano do dia e responder questão por questão.
- [ ] Errar no treino exige declarar a causa **antes de avançar** — 6 causas + "não sei dizer".
- [ ] Cada resposta vira uma tentativa com snapshot; duplo-clique não cria duas.
- [ ] A fonte da questão (banca/ano/órgão/cargo) fica visível.
- [ ] Questão com imagem é servida com a imagem; questão anulada não vira treino.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| ALUNO-03 (superfície) | a tela da causa do erro: 6 causas + "não sei dizer"; obrigatória no treino, ausente no diagnóstico e no simulado | m4 §P1: Causa do erro |
| ALUNO-01 (superfície) | a sessão que chama `registrarTentativa`; `tempo_ms`, `marcou_chute`, contexto correto por bloco | m4 §P1: Log imutável |
| BANCO-01 (AC2) | proveniência exibida junto do enunciado | m1 §P1: Proveniência visível |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Explicação e feedback na tela | SPEC 23 |
| Tela do plano do dia e onboarding | SPEC 24 |
| Anel do dia e sequência | SPEC 28 |
| Tutor | SPEC 29 |
| Simulado | SPEC 38 |

## Contratos que esta spec fixa para as próximas

- O anel da SPEC 28 conta **bloco concluído**, e bloco com erro só fecha depois de a causa de cada
  erro ter sido declarada (AD-060) — a tela precisa deixar esse estado explícito.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Sair no meio da sessão | nada é desfeito; o item fica com `respondido_em` nulo | y (edge case) |
| Questão sem explicação válida | mostra a questão com aviso de "em revisão" ou retira de circulação, conforme configuração | y (IA-09 AC5) |
| Repetição de questão | `param.m4.dias_sem_repetir_questao` evita a mesma questão recente | y |

## Success Criteria

- [ ] Errar no treino e não conseguir avançar sem marcar a causa
- [ ] "Não sei dizer" é aceito e fecha o passo
- [ ] Duplo-clique gera **uma** tentativa
- [ ] Sair no meio e voltar não perde nem duplica resposta
- [ ] A fonte da questão real aparece na tela
- [ ] Bloco com questão anulada fecha sem ela
