# LESSONS — auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation — do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 — Script de linha de comando recebe o executor externo (conexao, fetch) por parametro com default, para o teste unit cobrir cada codigo de saida.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `scripts` · harmful: 0
- features: 03-observabilidade-e-segredos
- evidence: scripts/jobs/vigia-de-jobs.mjs:113 (validation.md Gap 1) (scripts)
- last seen: 2026-08-17T12:40:18Z

### L-002 — Copia recursiva de objeto trata Date, Error, Map e Set explicitamente; Object.entries os devolve como objeto vazio em silencio.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `observabilidade` · harmful: 0
- features: 03-observabilidade-e-segredos
- evidence: src/modules/observabilidade/saneamento.mjs:144 (validation.md Gap 2) (observabilidade)
- last seen: 2026-08-17T12:40:18Z

### L-003 — Implementacao que se afasta de um item do Done when atualiza a tasks.md ou deixa marcador SPEC_DEVIATION; comentario no arquivo de codigo nao conta.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `processo` · harmful: 0
- features: 03-observabilidade-e-segredos
- evidence: tasks.md T27 x .github/workflows/ci.yml:128 (validation.md Gap 3) (processo)
- last seen: 2026-08-17T12:40:18Z

## Quarantined (failed when applied — ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
