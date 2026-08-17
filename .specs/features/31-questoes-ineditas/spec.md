# SPEC 31 — Questões inéditas

| | |
| --- | --- |
| **Ordem** | 31 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 10, SPEC 11 |
| **Tasks (estimativa)** | ~9 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **BANCO-08** |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` §P2: Geração de inéditas |

## Problem Statement

Volume e treino direcionado por causa de erro pedem questão além do acervo real. A armadilha é
conhecida e já está fechada por invariante: inédita **nunca** entra na taxa de frequência do Raio-X —
senão o produto passa a mandar estudar o que **nós** geramos, não o que a banca cobra.

## Goals

- [ ] Rascunho de inédita no padrão da banca, etiquetado por matéria/tópico/banca.
- [ ] Nasce `origem='gerada_ia'`, `status='em_revisao'` — 100% de revisão humana antes de publicar.
- [ ] Não infla o Raio-X em nenhuma hipótese.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-08 | tarefa de rascunho no gateway, etiquetagem, revisão obrigatória, verificação quantitativa quando for de conta (SPEC 22) | §P2: Geração de inéditas |

## Success Criteria

- [ ] Inédita não publica sem revisão humana
- [ ] Publicar 50 inéditas de um tópico não move a taxa do Raio-X
- [ ] Inédita de conta passa pelo mesmo cruzamento duplo das reais
