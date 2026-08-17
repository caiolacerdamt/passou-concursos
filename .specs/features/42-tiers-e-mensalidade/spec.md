# SPEC 42 — Tiers e mensalidade

| | |
| --- | --- |
| **Ordem** | 42 de 42 · [ROADMAP](../../ROADMAP.md) · **fast-follow** |
| **Depende de** | SPEC 20, SPEC 35 |
| **Tasks (estimativa)** | ~6 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-16** |
| **Fonte dos requisitos** | `.specs/modulos/m8-negocio-pagamentos/spec.md` §P3: Escada de tiers |

## Problem Statement

Sem dado de uso, qualquer tier é chute — e o checkout simples converte mais no lançamento (AD-032).
Esta spec existe para que a decisão, quando vier, não exija migração destrutiva.

## Goals

- [ ] `matricula`/`pagamentos` suportam mais de um produto/plano sem migração destrutiva.
- [ ] Nenhum tier é lançado antes de haver dado de uso do flywheel.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| PAG-16 | modelo de dados multi-plano e a decisão de negócio embasada no flywheel | §P3: Escada de tiers |

## Success Criteria

- [ ] Introduzir um segundo plano não exige migração destrutiva nem afeta matrícula vendida
- [ ] A decisão de preço/tier cita o dado do flywheel que a embasou
