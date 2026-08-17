# SPEC 33 — Grupo 3: sequência pseudonimizada

| | |
| --- | --- |
| **Ordem** | 33 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 18, SPEC 29 |
| **Tasks (estimativa)** | ~7 |
| **Ritual** | **A — completo** (`design.md` próprio + Verificador independente com sensor de mutação) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **DADOS-13** |
| **Fonte dos requisitos** | `.specs/modulos/m7-lgpd-flywheel/spec.md` §P3: Grupo 3 |

## Problem Statement

Knowledge tracing precisa da sequência por aluno — mas pseudonimizar **não é** anonimizar. O grupo 3
continua sendo dado pessoal e some no DELETE junto com a tabela de correspondência.

## Goals

- [ ] Código por aluno, com a correspondência código↔`user_id` guardada **separada** e restrita.
- [ ] Tratado como dado pessoal: some no DELETE, respeita o opt-out do flywheel.
- [ ] Política e LIA atualizados **antes** de ligar.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| DADOS-13 | tabela de sequência por código, correspondência separada, acesso restrito, opt-out respeitado, extensão da rotina de esquecimento da SPEC 18 **na mesma task** | §P3: Grupo 3 |

## Success Criteria

- [ ] Ligar o grupo 3 num aluno de teste, pedir DELETE e ver a sequência **e** a correspondência sumirem
- [ ] Aluno com opt-out não entra no grupo 3
- [ ] Política e LIA atualizados antes de a flag ligar
