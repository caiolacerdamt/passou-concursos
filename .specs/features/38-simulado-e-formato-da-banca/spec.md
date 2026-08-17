# SPEC 38 — Simulado semanal e formato da banca

| | |
| --- | --- |
| **Ordem** | 38 de 42 · [ROADMAP](../../ROADMAP.md) · **fast-follow** |
| **Depende de** | SPEC 22, SPEC 27 |
| **Tasks (estimativa)** | ~9 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **ALUNO-08** (bloco simulado), **RAIOX-09** |
| **Fonte dos requisitos** | `.specs/modulos/m4-coluna-vertebral/spec.md` §P3: Simulado semanal · `.specs/modulos/m5-raiox-banca/spec.md` §P3: Módulo de formato |

## Problem Statement

Simulado firma para a prova, mas o formato exato depende da banca — que ainda não foi anunciada. Por
isso os dois andam juntos e ficaram na gaveta: o módulo de formato (A–E × Certo/Errado com a regra de
compensação) só resolve com banca definida, e o simulado sem formato é genérico.

## Goals

- [ ] Simulado 1×/semana, sem interromper a prova para pedir causa.
- [ ] Causa dos erros coletada na **revisão pós-prova**, incluindo `faltou_tempo`.
- [ ] Módulo de formato selecionado por configuração a partir do `formato` do perfil de concurso.
- [ ] Com banca indefinida, entrega o núcleo universal de "fazer a prova" sem forçar formato.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| ALUNO-08 (P3) | bloco de simulado no plano (`flag.m4.simulado_semanal`), gravação com `contexto='simulado'`, revisão pós-prova gravando em `tentativa_causa_simulado` (tabela já criada na SPEC 05) | m4 §P3: Simulado semanal |
| RAIOX-09 | módulo de formato por configuração/flag, incluindo a regra de compensação do Certo/Errado | m5 §P3: Módulo de formato |

## Success Criteria

- [ ] Fazer um simulado e marcar as causas (inclusive "faltou tempo") no fim, sem UPDATE em nenhuma tentativa
- [ ] Trocar o `formato` do perfil muda o simulado de A–E para Certo/Errado sem alteração de código
- [ ] Com a flag desligada, nenhum bloco de simulado é gerado
