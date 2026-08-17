# SPEC 29 — Flywheel: esteiras 1 e 2

| | |
| --- | --- |
| **Ordem** | 29 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 15, SPEC 16, SPEC 17 (base legal e LIA antes de ligar) |
| **Tasks (estimativa)** | ~11 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **DADOS-06**, **DADOS-05**, **DADOS-12**, **ALUNO-06** (fecha a calibração) |
| **Fonte dos requisitos** | `.specs/modulos/m7-lgpd-flywheel/spec.md` |

## Problem Statement

Com volume, os números delatam a questão quebrada sozinhos — o operador não precisa revisar questão
por questão. O limite é o invariante nº10: automação só ajusta número que afina o plano de leve;
mudar o que se ensina ou o gabarito é decisão humana.

## Goals

- [ ] Esteira 1 (100% automática): dificuldade real, tempo médio, `n_respostas` e **índice de discriminação** por questão, lidos do grupo 2.
- [ ] Questão com discriminação abaixo do limiar vira **suspeita** e entra na fila — nunca despublicada sozinha.
- [ ] Esteira 2: a IA pré-diagnostica a suspeita e o humano confirma numa tela de revisão em lote.
- [ ] Auto-aplicação só por **lista fechada**, auditada e reversível em um passo.
- [ ] A dificuldade calibrada substitui a estimada pela IA sem reescrever snapshot antigo.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| DADOS-06 | os quatro números por questão; **"frequência" fica reservado ao Raio-X** (AD-070) | §P2: Esteira 1 |
| DADOS-05 | limiar de discriminação em config, `n_respondentes >= piso_anonimato`, marcação de suspeita, correção arriscada sempre humana; correção aprovada vira **versão nova** | §P2: Esteira 1 e 2 |
| DADOS-12 | lista fechada (inicial: aposentar distrator com 0 marcações em ≥N respostas), auditoria, reversão em um passo, relatório; ampliar a lista exige AD nova | §P2: Esteira 2 |
| ALUNO-06 | a calibração da dificuldade real que o M4 deixou pendente por desenho | m4 §P1: Projeções |

⚠️ **Decisão pendente antes do Design:** o pré-diagnóstico de questão suspeita é **chamada de IA fora
da lista fechada do IA-02** — entra na matriz do gateway ou vira exceção registrada em AD nova.

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Grupo 2 e piso de anonimato | SPEC 16 |
| Opt-out e LIA | SPEC 17 — **o flywheel não liga antes do LIA arquivado** |
| Grupo 3 / knowledge tracing | SPEC 33 |

## Success Criteria

- [ ] Respostas em que alunos fortes erram tanto quanto os fracos tornam a questão suspeita, sem sumir do ar
- [ ] Abaixo do piso de respondentes, nenhum sinal da esteira 1 é usado
- [ ] Distrator com 0 marcações em N+10 respostas é aposentado com auditoria e revertido em um passo
- [ ] Reversão registrada impede reaplicar a mesma ação sem decisão humana
