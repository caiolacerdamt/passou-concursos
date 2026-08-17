# SPEC 01 — Fundação do projeto

| | |
| --- | --- |
| **Ordem** | 01 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** · ✅ concluída |
| **Depende de** | — |
| **Habilita** | todas |
| **Tasks** | 4 (T1–T4) |
| **Dificuldade** | Fácil |
| **Status** | ✅ **Concluída** (2026-08-16) |
| **Requisitos** | — (pré-requisito de tudo; AD-083 fixa o ambiente de teste) |

## Problem Statement

Não existia `package.json`. Nenhuma spec roda sem esqueleto de aplicação, runner de teste, caminho
de migração e CI que reprove o que quebra.

## O que foi construído

| Task | Commit | O quê |
| --- | --- | --- |
| T1 | `d3281a2` | Next.js 16.3.1 + React 19.2.8, App Router, TypeScript, **sem Tailwind** (a camada de estilo é decisão da SPEC 07); pastas do design com `.gitkeep` |
| T2 | `5d34aee` | Vitest 4.1.10 com projetos `unit` (paralelo) e `db` (sequencial); sem `DATABASE_URL` o `db` pula com aviso (AD-083) |
| T3 | `817fcf0` | Supabase CLI 2.114.0 como devDependency, `npm run db:push` sem Docker, `tests/db/conexao.ts` |
| T4 | `a075f4c` | job `app` da CI: `npm ci`, build, lint, `test:unit`; `test:db` só com o segredo |

**Design e tasks** desta spec vivem em `.specs/modulos/m9-infra/tasks.md` (T1–T4) — a rodada 1
planejou SPEC 01 e SPEC 02 no mesmo documento. **Não refazer.**

## Achados que valem para todas as specs seguintes

1. `--env-file` do Node e `process.loadEnvFile()` **não sobrescrevem** variável já existente no
   sistema. A variável global do Windows guarda o token de outra conta: `scripts/db-push.mjs` lê o
   `.env` e força o valor por cima; `scripts/alvo-do-banco.mjs` recusa conexão que não aponte para
   `kfpmetkmhjtmgwgaaerl`.
2. Conexão direta (`db.<ref>.supabase.co`) não resolve nesta máquina (sem IPv6). Use o **Session
   pooler, porta 5432** — o Transaction pooler (6543) não guarda estado de sessão e migração precisa.
3. O Vitest usa o reporter `minimal` dentro de agente e esconde `console.warn`. Para depurar saída,
   rode com `--reporter=default`.
4. `next build` roda o TypeScript: **compilar já é o typecheck**; não existe script `typecheck`.

## Success Criteria

- [x] `npm run build`, `npm run lint` e `npm test` passam do zero num clone
- [x] Migração aplica no projeto `kfpmetkmhjtmgwgaaerl` sem Docker
- [x] CI reprova PR que quebra build, lint ou teste
