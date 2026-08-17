# SPEC 02 — Configuração e feature flags

| | |
| --- | --- |
| **Ordem** | 02 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 01 |
| **Habilita** | todas — todo parâmetro que as specs mandam para "configuração" mora aqui |
| **Tasks** | 5 (T5–T9) |
| **Dificuldade** | Média |
| **Status** | ✅ **Concluída e verificada** (2026-08-16) |
| **Requisitos** | **INFRA-11** (8 de 8 AC) |
| **Fonte dos requisitos** | `.specs/modulos/m9-infra/spec.md` §P1: Configuração e feature flags sem deploy |

## Problem Statement

O AD-001 escolheu feature flag como mecanismo e o AD-076 pôs cinco superfícies atrás de flag
desligada, mas nenhuma spec dizia **onde o valor mora**. Sem isso, M1–M8 não têm onde ler dezenas de
parâmetros já especificados, e trocar uma flag exigiria deploy — o oposto do que o `docs/GITFLOW.md`
promete.

## O que foi construído

| Task | Commit | O quê |
| --- | --- | --- |
| T5 | `7b924e3` | migração `configuracoes` append-only + view `configuracoes_vigentes` + RLS + trava de 3 camadas |
| T6 | `a82d83a` | catálogo em código com as 10 chaves do M4; default amarrado ao tipo em compilação |
| T7 | `cd6e770` | `getParam`, `isFlagOn`, `getParams`; cache de 30s; queda segura |
| T8 | `4904d42` | `setConfig` — INSERT com autor obrigatório, validação antes do banco |
| T9 | `63c1000` | Independent Test: config ilegível deixa a flag **desligada** |
| — | `61a2d92` | AC2 e AC4, que a verificação achou sem teste, fechados |

**Documentos da rodada:** design em `.specs/modulos/m9-infra/design.md`, tasks em
`.specs/modulos/m9-infra/tasks.md` (T5–T9), verificação independente em
`.specs/modulos/m9-infra/validation.md` — **PASS**, 8/8 AC com evidência `file:line`, sensor de
discriminação 4/4 mutantes mortos.

## Contratos que esta spec fixa para as próximas

1. **Toda chave nova entra em `src/modules/config/catalogo.ts`** na mesma task que a consome. Chave
   no banco sem linha no catálogo é erro (INFRA-11 AC8), com teste que varre a tabela.
2. Padrão obrigatório da chave: `^(flag|param)\.m[1-9]\.[a-z0-9_]+$` — validado no banco **e** no
   catálogo.
3. **Flag ilegível = desligada** (AC6). Parâmetro ilegível = default do catálogo. Nunca o contrário.
4. `reportarFalhaDeConfig` em `src/modules/config/leitura.ts` é o **ponto único de reporte** — a
   SPEC 03 pluga o Sentry ali, sem tocar no resto.
5. Janela de cache é **constante em código** (30s), única exceção declarada ao "tudo em
   configuração" (AD-081).
6. `unstable_cache` só vale dentro de requisição do Next; job e script caem para leitura direta
   (**AD-085**).

## Success Criteria

- [x] Ligar uma flag pela tabela muda o comportamento sem deploy, dentro da janela de cache
- [x] Derrubar a leitura deixa a superfície **desligada** e reporta
- [x] Alteração registra quem, quando, valor anterior (penúltima linha) e valor novo
- [x] Nenhuma chave órfã
