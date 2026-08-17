# `.specs/modulos/` — as 9 specs temáticas

**O que é:** o texto dos requisitos do produto, agrupado por assunto (M1…M9), como saiu da fase
Specify. Cada requisito (`BANCO-01`, `IA-04`, `ALUNO-09`, `INFRA-11`…) é definido **aqui, uma vez só**
— com user story, critérios de aceite, edge cases e Independent Test.

**O que não é:** ordem de implementação. Nenhum módulo é construído inteiro de uma vez.

**Onde está a ordem:** [`../ROADMAP.md`](../ROADMAP.md) e as specs numeradas em
[`../features/`](../features/). Cada spec numerada diz **quais requisitos** ela constrói e aponta para
a seção correspondente daqui.

| Se você quer saber | Olhe |
| --- | --- |
| o que o requisito exige | esta pasta |
| em qual spec ele é construído, e quando | `../ROADMAP.md` |
| o que já foi decidido e não se rediscute | `../STATE.md` (AD-NNN) |

## Documentos de rodada que moram aqui

| Arquivo | O que é |
| --- | --- |
| `m9-infra/design.md` | design de INFRA-11 (spec 02) + particionamento (insumo da spec 05) |
| `m9-infra/tasks.md` | T1–T9 — specs **01** e **02**, executadas |
| `m9-infra/validation.md` | verificação independente da spec 02 — PASS |
| `m4-coluna-vertebral/design.md` | design do log, das projeções e do plano — insumo das specs **05** e **06** |
| `m4-coluna-vertebral/tasks.md` | T10–T22, planejadas e **não** executadas: T11–T15 → spec 05, T16–T21 → spec 06, T22 → spec 07, **T10 absorvida pela spec 04** |

Nada aqui é refeito por causa da reorganização (AD-086).
