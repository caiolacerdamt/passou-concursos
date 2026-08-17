# SPEC 36 — Eval cego e revisão da matriz de modelos

| | |
| --- | --- |
| **Ordem** | 36 de 42 · [ROADMAP](../../ROADMAP.md) · **fast-follow** |
| **Depende de** | SPEC 07, SPEC 13 |
| **Tasks (estimativa)** | ~8 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **IA-03**, **IA-11** |
| **Fonte dos requisitos** | `.specs/modulos/m2-camada-ia/spec.md` §P1: Gateway (AC6/AC7) |

## Problem Statement

O líder de mercado muda toda semana — o corte de 80% no preço da `gpt-5.6-luna` quatro dias antes da
AD-073 é o caso que prova. O eval cego é o **porteiro** que impede um modelo entrar em tarefa
sensível só porque é mais barato.

**Por que depois do lançamento:** os modelos do lançamento já foram escolhidos e estão fixados em
configuração (AD-073). O eval morde quando se **troca** de modelo — e trocar antes de existir acervo
e explicação para avaliar é avaliar no vazio. Os dois requisitos são P1 na spec do M2; o que muda é
**quando**, não **se**.

## Goals

- [ ] Conjunto de ~50 questões com "explicação boa" definida pelo time, avaliado às cegas.
- [ ] Nota mínima e critério de aprovação escritos — o eval reprova, não só informa.
- [ ] Rotina periódica (default trimestral) que puxa preços/opções, roda o eval nos candidatos e registra a data da última revisão.
- [ ] OpenRouter usada **só** aqui, com chave separada, nunca na fábrica nem no tutor.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| IA-03 | eval cego de PT-BR como porteiro obrigatório para extração, explicação e tutor | §P1: Gateway (AC6) |
| IA-11 | rotina de revisão da matriz, com registro da data e do resultado | §P1: Gateway (AC7) |

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Tamanho do eval | ~50 questões | y (PRD) |
| Nota mínima e critério | **a definir no Design** | n |
| Periodicidade | trimestral, em configuração | y |

## Success Criteria

- [ ] Um modelo candidato reprovado no eval **não** entra em tarefa sensível
- [ ] A rotina registra data, candidatos e resultado
- [ ] Nenhum caminho de produção passa pela OpenRouter
