# SPEC 23 — Explicação e feedback na tela

| | |
| --- | --- |
| **Ordem** | 23 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 14, SPEC 22 |
| **Habilita** | SPEC 29 (o tutor abre a partir daqui), 39 |
| **Tasks (estimativa)** | ~8 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **IA-04** (superfície), **IA-07** (superfície), **IA-09** (AC5) |
| **Fonte dos requisitos** | `.specs/modulos/m2-camada-ia/spec.md` |

## Problem Statement

Responder sem entender por que errou é a lista de questões que o produto promete não ser. A
explicação já existe conferida no banco desde a SPEC 13 — falta servi-la, com a fonte à vista, e dar
ao aluno os dois sinais de feedback sem que eles mudem nada sozinhos.

## Goals

- [ ] Depois de responder, o aluno vê a explicação vigente daquela **versão** da questão, com as fontes.
- [ ] Questão sem explicação válida aparece com aviso de "em revisão" — nunca com a explicação antiga.
- [ ] Dois sinais separados: "foi útil?" e "reportar erro" (texto), este último abrindo item na fila.
- [ ] Nenhum feedback altera a explicação.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| IA-04 (superfície) | explicação servida do banco por `(questao_id, questao_versao)`, com `fontes_citadas` visíveis | §P1: Explicação conferida (AC7) |
| IA-09 (AC5) | comportamento da tela quando a explicação está invalidada | §P1: Explicação amarrada à versão |
| IA-07 (superfície) | os dois botões, o texto do report, a entrada na fila da SPEC 10 | §P2: Dois sinais de feedback |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Geração e invalidação da explicação | SPEC 13, 14 |
| Tutor de dúvidas | SPEC 29 |
| Áudio da explicação | SPEC 39 |

## Success Criteria

- [ ] A explicação exibida é a da versão que o aluno respondeu
- [ ] Invalidar a explicação faz a tela mostrar o aviso, nunca o texto antigo
- [ ] Reportar erro cria item na fila sem mudar o texto
- [ ] "Foi útil?" registra sinal e nada mais
