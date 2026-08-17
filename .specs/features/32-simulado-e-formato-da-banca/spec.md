# SPEC 32 — Simulado, diagnóstico adaptativo e formato da banca

| | |
| --- | --- |
| **Ordem** | 32 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 08, SPEC 13, SPEC 20 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **ALUNO-08** (bloco simulado), **RAIOX-09**, **ALUNO-05** (AC2, AC3, AC4) |
| **Fonte dos requisitos** | `.specs/modulos/m4-coluna-vertebral/spec.md` §P3: Simulado semanal · `.specs/modulos/m5-raiox-banca/spec.md` §P3: Módulo de formato |

> **Nota da AD-089.** O **diagnóstico adaptativo** e a **chamada de IA do plano inicial** saíram do
> MVP e vieram para cá. Motivo: o diagnóstico é pulável por invariante (nº5) — nasce como "declare
> seu nível" na SPEC 13 — e o plano diário já ganha frase de IA na SPEC 08. Diagnóstico e simulado
> são a mesma família: blocos de questões que **não** são treino, gravam contexto próprio e não pedem
> causa durante a prova.

## Problem Statement

Simulado firma para a prova, mas o formato exato depende da banca — que ainda não foi anunciada. Por
isso os dois andam juntos e ficaram na gaveta: o módulo de formato (A–E × Certo/Errado com a regra de
compensação) só resolve com banca definida, e o simulado sem formato é genérico.

## Goals

- [ ] Simulado 1×/semana, sem interromper a prova para pedir causa.
- [ ] Causa dos erros coletada na **revisão pós-prova**, incluindo `faltou_tempo`.
- [ ] Módulo de formato selecionado por configuração a partir do `formato` do perfil de concurso.
- [ ] Com banca indefinida, entrega o núcleo universal de "fazer a prova" sem forçar formato.
- [ ] Diagnóstico de ~20 questões reais adaptativas, atrás de `flag.m4.diagnostico_adaptativo`, **sempre pulável**.
- [ ] Uma chamada de IA escreve o plano inicial pós-diagnóstico; se falhar, o plano sai por regra/SQL do mesmo jeito.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| ALUNO-08 (P3) | bloco de simulado no plano (`flag.m4.simulado_semanal`), gravação com `contexto='simulado'`, revisão pós-prova gravando em `tentativa_causa_simulado` (tabela já criada na SPEC 05) | m4 §P3: Simulado semanal |
| RAIOX-09 | módulo de formato por configuração/flag, incluindo a regra de compensação do Certo/Errado | m5 §P3: Módulo de formato |
| ALUNO-05 AC2 | seleção das ~20 questões + passo adaptativo (acertou sobe, errou desce); grava `contexto='diagnostico'` **sem pedir causa**; tópico sem questão publicada é pulado | m4 §P1: Diagnóstico curto |
| ALUNO-05 AC3 | tarefa própria do gateway "plano inicial pós-diagnóstico", **distinta** da frase diária da SPEC 08; síncrona, com cache | m4 §P1: Diagnóstico (AC3) + m2 IA-02 (AC2) |
| ALUNO-05 AC4 | falha da IA entrega o plano por regra/SQL, sem frase | m4 §P1: Diagnóstico (AC4) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Onboarding com nível declarado e plano do 1º dia | SPEC 13 — o caminho de quem **pula** o diagnóstico já existe desde o lançamento |
| Motor de prioridade e geração do plano | SPEC 06 |

## Success Criteria

- [ ] Fazer o diagnóstico gera ~20 tentativas com `contexto='diagnostico'` e nenhuma pergunta de causa
- [ ] Pular o diagnóstico continua entregando o plano do 1º dia (não regride a SPEC 13)
- [ ] Derrubar a IA não impede o plano de aparecer
- [ ] Fazer um simulado e marcar as causas (inclusive "faltou tempo") no fim, sem UPDATE em nenhuma tentativa
- [ ] Trocar o `formato` do perfil muda o simulado de A–E para Certo/Errado sem alteração de código
- [ ] Com a flag desligada, nenhum bloco de simulado é gerado
