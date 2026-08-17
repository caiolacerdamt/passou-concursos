# SPEC 03 — Observabilidade e segredos · Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute
flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source
of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier,
discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Spec**: `.specs/features/03-observabilidade-e-segredos/spec.md`
**Design**: `.specs/features/03-observabilidade-e-segredos/design.md`
**Status**: Approved
**Escopo**: INFRA-09, INFRA-10 + a assumption de migração por GitHub Actions (M9 §Assumptions)
**Branch**: `feat/m9-p2-observabilidade`

> **Numeração T23–T32.** T1–T9 são das SPECs 01/02 (já mergeadas), T10 morreu na reorganização
> (AD-086) e T11–T22 estão reservadas às SPECs 05/06/07 pelo Handoff. Recomeçar em T1 colidiria com
> hash de commit já registrado no `STATE.md`.

---

## Ambiente: onde isto roda

| Peça | Escolha | Por quê |
| --- | --- | --- |
| Sentry | projeto `passou-concursos`, org `passou-concursos`, **região EUA** | conta criada pelo sócio em 2026-08-16; região registrada como risco no Design |
| Banco | projeto Supabase `kfpmetkmhjtmgwgaaerl` (São Paulo) | AD-083 — o banco de dev *é* o ambiente |
| DSN em teste | **vazio** | teste `unit` não toca rede (AD-083); DSN vazio deixa o SDK calado |
| Alerta | e-mail `passouconcurso@gmail.com`, regra padrão do Sentry | decidido no Design |

---

## Test Coverage Matrix

> Gerada do código, das diretrizes do projeto e da spec — confirmar antes do Execute.
> Diretrizes encontradas: `AGENTS.md`, `CLAUDE.md`, `docs/GITFLOW.md`, `vitest.config.mts`,
> `.specs/modulos/m9-infra/tasks.md` (matriz da rodada 1, que esta herda e estende).

| Camada de código | Tipo de teste | Cobertura esperada | Padrão de local | Comando |
| --- | --- | --- | --- | --- |
| Módulo de domínio TS/MJS (`src/modules/observabilidade/*`) | unit | Todos os ramos; 1:1 com os AC; todo edge case do Design | `src/modules/**/*.test.ts` | `npm run test:unit` |
| Script de job e de ferramenta (`scripts/**`) | unit | Caminho feliz + falha do provedor + entrada malformada | `scripts/**/*.test.ts` | `npm run test:unit` |
| Migração SQL (extensão, view, permissão) | integration (banco) | Todo AC + a recusa de acesso indevido | `tests/db/*.test.ts` | `npm run test:db` |
| Boot do Sentry, rota do Next, `next.config.ts`, workflows YAML | none | — (gate de build) | — | gate de build |

## Parallelism Assessment

> Gerada do código — confirmar antes do Execute.

| Tipo de teste | Paralelizável? | Modelo de isolamento | Evidência |
| --- | --- | --- | --- |
| unit | **Sim** | sem estado compartilhado; nenhum toca banco nem rede | `vitest.config.mts:17-26` — projeto `unit` sem `setupFiles` de banco |
| integration (banco) | **Não** | um banco só, compartilhado por todos os arquivos | `vitest.config.mts:35` — `fileParallelism: false` |

**Consequência:** toda task cujo teste é de banco roda **sequencial**, sem marca `[P]`.

**Ressalva desta spec:** `reporte.ts` guarda o destino num módulo (estado global do processo). Toda
task que mexe nele precisa restaurar o padrão no `afterEach` — o Vitest roda arquivos do mesmo
projeto em processos separados, mas testes do mesmo arquivo compartilham o módulo.

## Gate Check Commands

> Gerada do código — confirmar antes do Execute.

| Nível | Quando usar | Comando |
| --- | --- | --- |
| Quick | task só com teste unit | `npm run test:unit` |
| Full | task com teste de banco | `npm test` |
| Build | fim de fase, ou task só de configuração/YAML | `npm run build && npm run lint && npm test` |

---

## Execution Plan

### Fase 1: O erro da aplicação chega ao Sentry (sequencial)

```
T23 → T24 → T25 → T26
```

Sequencial: T24 liga no ponto que T23 cria; T25 pluga o config nesse mesmo ponto; T26 prova o
caminho inteiro por uma rota real.

### Fase 2: Falha de job nunca silenciosa (sequencial)

```
T23 → T27 → T28 → T29
```

T27 usa o saneamento de T23. T29 lê a view que T28 cria.

### Fase 3: Segredo, advisors e migração por CI (T30 e T31 em paralelo, T32 depois)

```
        ┌→ T30 [P] ─┐
T24 ────┤           ├──→ T32
        └→ T31 [P] ─┘
```

T30 e T31 não se tocam (um mexe em `scripts/advisors.mjs` + workflow próprio, outro em
`scripts/varredura-de-segredos.mjs` + o job `segredos` do `ci.yml`). T32 vem por último porque o
workflow de migração precisa que a migração do pg_cron (T28) já esteja no repositório para ter o que
aplicar, e que a CI esteja no formato final.

---

## Task Breakdown

### T23: Saneamento de dado pessoal + ponto único de reporte

**What**: Criar o módulo de observabilidade — a função que tira dado pessoal de qualquer valor e o
ponto único `reportarErro`, com destino injetável e **sem nenhum import do Sentry**.
**Where**: `src/modules/observabilidade/saneamento.mjs`, `src/modules/observabilidade/reporte.ts`,
`src/modules/observabilidade/index.ts` (+ testes ao lado)
**Depends on**: None
**Reuses**: padrão `.mjs` + JSDoc de `scripts/alvo-do-banco.mjs`; forma da costura de
`definirReporteDeErro` (`src/modules/config/leitura.ts:41`)
**Requirement**: INFRA-09 AC1 · contrato "erro sem dado pessoal" da spec

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `sanitizar()` troca o valor de chave sensível por `[removido]`, e-mail por `[email]`, CPF por
      `[cpf]`, em objeto aninhado, dentro de array e dentro de string solta
- [x] `sanitizar()` não entra em laço infinito com referência circular e respeita teto de profundidade
- [x] `sanearEventoSentry()` apaga `user.email` e `user.ip_address` e saneia o resto do evento
- [x] `reportarErro()` entrega o **contexto já saneado** ao destino, e a mensagem do erro sai saneada
      em todo ponto onde vira texto (destino padrão de console e `sanearEventoSentry`). O objeto
      `Error` em si segue cru até o destino de propósito: sem ele a pilha de chamada se perde
- [x] `reportarErro()` não deixa erro do próprio destino escapar — reportar erro não pode derrubar
      a requisição que já estava com problema
- [x] Destino padrão escreve no `console.error`; `definirDestinoDeErro`/`restaurarDestinoPadrao` funcionam
- [x] Nenhum arquivo do módulo importa `@sentry/*` (teste confere lendo o próprio fonte)
- [x] Gate: `npm run test:unit`
- [x] Contagem de testes: ≥ 41 (os 41 que já existem) + os novos, todos verdes

**Tests**: unit · **Gate**: quick
**Commit**: `feat(m9): cria o ponto único de reporte com saneamento de dado pessoal` — `f8ef737` ✅

---

### T24: Sentry ligado no Next — front, servidor e edge

**What**: Instalar `@sentry/nextjs` e inicializá-lo nos três runtimes, com release e contexto de rota,
`beforeSend` saneado e queda limpa quando o DSN está vazio.
**Where**: `src/modules/observabilidade/ambiente.ts`, `src/instrumentation.ts`,
`src/instrumentation-client.ts`, `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`,
`src/app/global-error.tsx`, `next.config.ts`, `.env.example`, `env.d.ts`, `package.json`
**Depends on**: T23
**Reuses**: `sanearEventoSentry` e `definirDestinoDeErro` de T23
**Requirement**: INFRA-09 AC1

**Tools**: MCP: `context7` (API do `@sentry/nextjs`) · Skill: NONE

**Done when**:

- [x] `release()` cai em cascata `NEXT_PUBLIC_SENTRY_RELEASE` → `VERCEL_GIT_COMMIT_SHA` →
      `GITHUB_SHA` → `"desenvolvimento"`, com teste para cada degrau
- [x] `sentryLigado()` é `false` com DSN ausente, vazio ou só espaço
- [x] Os três `Sentry.init` recebem `beforeSend: sanearEventoSentry` e
      `dataCollection: { userInfo: false, httpBodies: [] }`
- [x] Nenhum `Sentry.init` liga replay nem tracing (`tracesSampleRate: 0`) — teste lê o fonte e falha
      se `replayIntegration` aparecer
- [x] `instrumentation.ts` exporta `onRequestError = Sentry.captureRequestError`
- [x] `src/app/global-error.tsx` existe e chama `Sentry.captureException`
- [x] `next.config.ts` embrulhado em `withSentryConfig`
- [x] `.env.example` documenta `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
      `NEXT_PUBLIC_SENTRY_RELEASE` **sem valor**
- [x] Gate: `npm run build && npm run lint && npm run test:unit`

**Tests**: unit (para `ambiente.ts` e para a proibição de replay) · **Gate**: build
**Commit**: `feat(m9): liga o Sentry no front, no servidor e no edge` — `4bfa0e8` ✅

---

### T25: Falha de configuração passa a alertar

**What**: Fazer o reporte padrão do módulo de configuração delegar ao ponto único, **sem mudar a
assinatura** publicada pela SPEC 02.
**Where**: `src/modules/config/leitura.ts` (modificar), `src/sentry.server.config.ts` (ligar o destino),
`src/modules/config/leitura.test.ts` (estender)
**Depends on**: T24
**Reuses**: `reportarErro` de T23; toda a costura já existente da SPEC 02
**Requirement**: INFRA-09 AC1 · INFRA-11 AC6 (a parte "e SHALL alertar", que ficou pendente)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `definirReporteDeErro`, `restaurarReportePadrao` e `reportarFalhaDeConfig` mantêm exatamente a
      mesma assinatura (teste de tipo + os testes da SPEC 02 continuam passando sem edição)
- [x] Com o destino de observabilidade espionado, uma falha de leitura de config chega nele com o
      contexto `{ modulo: "config" }`
- [x] Um contexto de config que contenha e-mail chega saneado ao destino
- [x] `sentry.server.config.ts` chama `definirDestinoDeErro` no boot
- [x] Gate: `npm run test:unit`
- [x] Contagem de testes: nenhum teste da SPEC 02 removido ou enfraquecido

**Tests**: unit · **Gate**: quick
**Commit**: `fix(m9): faz a falha de configuração alertar, não só logar` — `7879e17` ✅

---

### T26: Rota de erro proposital atrás de flag

**What**: Rota que erra de propósito para provar o caminho até o Sentry, com a primeira chave de
configuração do M9 como porteiro.
**Where**: `src/modules/config/catalogo.ts` (modificar), `src/app/api/erro-proposital/route.ts`,
`src/modules/config/catalogo.test.ts` (estender)
**Depends on**: T25
**Reuses**: `isFlagOn` (`src/modules/config/leitura.ts:182`), padrão do catálogo da SPEC 02
**Requirement**: INFRA-09 AC1 (Success Criteria nº1 da spec)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `flag.m9.rota_de_erro_proposital` declarada no catálogo com default `false` e dono `m9`
- [x] A chave passa no teste de padrão de nome já existente (`PADRAO_DA_CHAVE`)
- [x] Flag desligada ⇒ a rota responde `404` e **não** lança
- [x] Flag ligada ⇒ a rota lança, e o erro tem mensagem reconhecível
- [x] O teste cobre os dois lados chamando o handler direto, sem subir servidor
- [x] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(m9): rota de erro proposital atrás de flag para conferir o alerta` — `e6c6fee` ✅

---

### T27: Falha de workflow do GitHub Actions nunca silenciosa

**What**: Reporter para processo fora do Next (`@sentry/node`) e o CLI que cada job da CI chama no
passo `if: failure()`.
**Where**: `scripts/jobs/sentry-node.mjs`, `scripts/jobs/reportar-falha.mjs`,
`scripts/jobs/reportar-falha.test.ts`, `.github/workflows/ci.yml` (modificar), `package.json`
**Depends on**: T23
**Reuses**: `saneamento.mjs` de T23; padrão de script `.mjs` + teste `.ts`
**Requirement**: INFRA-09 AC2

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `iniciarSentry()` não inicializa nada com DSN vazio e devolve `false`
- [x] `reportar()` com DSN vazio não lança e escreve no `console.error` (visibilidade nunca depende do Sentry)
- [x] `montarMensagem()` produz uma linha com workflow, job e URL da execução, e é testada com
      entrada faltando campo
- [x] O evento carrega tag do workflow e do job — nenhum dado de aluno
- [x] Os três jobs do `ci.yml` ganham passo `if: failure()` chamando o CLI
- [x] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(m9): reporta falha de workflow do GitHub Actions no Sentry` — `804a8e1` ✅

---

### T28: pg_cron instalado e falha de job visível no banco

**What**: Migração que instala o `pg_cron` e cria a view das execuções que falharam.
**Where**: `supabase/migrations/<ts>_pg_cron_e_jobs_falhados.sql`, `tests/db/jobs-falhados.test.ts`
**Depends on**: T27
**Reuses**: molde de `supabase/migrations/20260816212947_configuracoes.sql` (comentário, `security_invoker`);
`tests/db/conexao.ts`
**Requirement**: INFRA-09 AC2

**Tools**: MCP: `supabase-passou` (conferir extensão e advisors depois de aplicar) · Skill: NONE

**Done when**:

- [x] `create extension if not exists pg_cron` aplicado; `cron.job_run_details` existe
- [x] View `public.jobs_falhados` devolve execução com `status` de falha e **não** devolve execução bem-sucedida
- [x] A view é `security_invoker` e `anon`/`authenticated` não conseguem ler
- [x] `npm run db:push` aplica em banco limpo sem erro (migração idempotente no `create extension`)
- [x] `get_advisors` de segurança não ganha achado novo por causa desta migração
- [x] Gate: `npm test`

**Tests**: integration (banco) · **Gate**: full
**Commit**: `feat(m9): instala pg_cron e expõe as execuções que falharam` — `c9d51d8` ✅

---

### T29: Vigia de jobs — lê a view e alerta

**What**: Script que consulta `jobs_falhados` na janela de 26h e reporta cada falha, mais o workflow
diário que o executa.
**Where**: `scripts/jobs/vigia-de-jobs.mjs`, `scripts/jobs/vigia-de-jobs.test.ts`,
`.github/workflows/vigia-de-jobs.yml`, `package.json`
**Depends on**: T28
**Reuses**: `sentry-node.mjs` de T27; `conferirAlvo()` de `scripts/alvo-do-banco.mjs`
**Requirement**: INFRA-09 AC2 (Success Criteria nº2 da spec)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `JANELA_HORAS = 26` é constante em código, com o motivo escrito no arquivo
- [x] `resumirFalhas()` transforma linhas da view em mensagens, é testada com lista vazia, com uma
      falha e com `return_message` contendo e-mail (que sai saneado)
- [x] Sem `DATABASE_URL`, o script sai com código ≠ 0 e mensagem explícita — nunca "nada a reportar"
- [x] Nenhuma falha na janela ⇒ código de saída 0
- [x] Workflow com `schedule` diário + `workflow_dispatch`, com passo `if: failure()`
- [x] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(m9): vigia diário que alerta falha de job do pg_cron` — `521fbb4` ✅

---

### T30: Advisors do Supabase como fonte complementar [P]

**What**: Script que chama a Management API dos advisors e o workflow semanal que o roda.
**Where**: `scripts/advisors.mjs`, `scripts/advisors.test.ts`, `.github/workflows/advisors.yml`,
`package.json`
**Depends on**: T24
**Reuses**: `PROJETO_REF` de `scripts/alvo-do-banco.mjs`
**Requirement**: INFRA-09 AC3

**Tools**: MCP: `supabase-passou` (comparar a saída do script com a do MCP) · Skill: NONE

**Done when**:

- [x] `classificar()` separa `ERROR` de `WARN`/`INFO` e é testada com as três severidades
- [x] Resposta em formato inesperado ⇒ erro explícito, **nunca** "nenhum achado"
- [x] Sem `SUPABASE_ACCESS_TOKEN` ⇒ sai com código ≠ 0 e diz o que falta
- [x] Presença de `ERROR` ⇒ código de saída ≠ 0; só `WARN`/`INFO` ⇒ código 0 com a lista impressa
- [x] Workflow semanal + `workflow_dispatch`
- [x] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(m9): roda os advisors do Supabase como fonte complementar` — `20d2d3c` ✅

---

### T31: Inventário de segredos e varredura testável [P]

**What**: Tirar a varredura de segredos de dentro do YAML, transformá-la em script com teste, somar os
padrões novos, e escrever o inventário de onde cada segredo vive.
**Where**: `scripts/varredura-de-segredos.mjs`, `scripts/varredura-de-segredos.test.ts`,
`.github/workflows/ci.yml` (modificar), `docs/SEGREDOS.md`, `package.json`
**Depends on**: T24
**Reuses**: os padrões que já estão em `.github/workflows/ci.yml:21`
**Requirement**: INFRA-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `encontrarSegredos(texto)` acha cada padrão da lista — teste com um caso positivo por padrão
- [x] Padrões novos: `sntrys_` (token do Sentry), `sb_secret_` (chave secreta do Supabase), string de
      conexão `postgres(ql)://usuario:senha@host`
- [x] O DSN público do Sentry **não** é tratado como segredo (é público por desenho) — teste negativo
- [x] `.env.example` não dispara a varredura (teste com o conteúdo real do arquivo)
- [x] O job `segredos` do `ci.yml` chama o script em vez do bloco `grep` inline, e continua reprovando
- [x] `docs/SEGREDOS.md` lista cada segredo: onde vive, quem usa, o que fazer se vazar
- [x] Gate: `npm run test:unit`

**Tests**: unit · **Gate**: quick
**Commit**: `feat(m9): varredura de segredos testável e inventário de onde cada um vive` — `05f9bcd` ✅

---

### T32: Migração aplicada por CI a partir do merge

**What**: Workflow que aplica as migrações no banco quando um merge entra na `main` tocando
`supabase/migrations/**` — nunca por clique no painel.
**Where**: `.github/workflows/migracao.yml`, `docs/GITFLOW.md` (modificar a seção "Banco de dados")
**Depends on**: T28, T30, T31
**Reuses**: `npm run db:push` e a trava `conferirAlvo()`
**Requirement**: M9 §Assumptions ("migrações versionadas em git, aplicadas via GitHub Actions;
prod exige merge aprovado") · INFRA-09 AC2 (falha da migração também alerta)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Workflow dispara só em `push` na `main` com mudança em `supabase/migrations/**`,
      mais `workflow_dispatch`
- [x] Sem o segredo `DATABASE_URL` o workflow **falha** (diferente do teste de banco, que pula):
      migração que não aplica é problema, não ausência de credencial
- [x] Usa `npm run db:push`, que já recusa banco diferente do projeto declarado
- [x] Passo `if: failure()` reporta no Sentry
- [x] `docs/GITFLOW.md` diz que migração entra por merge, não por painel
- [x] Gate: `npm run build && npm run lint && npm test`

**Tests**: none (YAML — gate de build) · **Gate**: build
**Commit**: `ci(m9): aplica migração no merge da main, nunca por clique` — `462750a` ✅

---

## Parallel Execution Map

```
Fase 1 (sequencial):
  T23 ──→ T24 ──→ T25 ──→ T26

Fase 2 (sequencial):
  T23 ──→ T27 ──→ T28 ──→ T29

Fase 3:
  T24 ──┬──→ T30 [P] ──┐
        └──→ T31 [P] ──┤
  T28 ──────────────────┼──→ T32
                        │
  (T30, T31) ───────────┘
```

---

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T23 | 1 módulo, 2 arquivos coesos (saneamento + reporte) | ✅ Granular |
| T24 | 1 integração (boot do SDK nos 3 runtimes é uma coisa só) | ⚠️ 5 arquivos, mas é um único deliverable indivisível — os 3 `init` não funcionam separados |
| T25 | 1 função (o padrão do reporte de config) | ✅ Granular |
| T26 | 1 rota + 1 chave | ✅ Granular |
| T27 | 1 script + 1 CLI | ✅ Granular |
| T28 | 1 migração | ✅ Granular |
| T29 | 1 script + 1 workflow | ✅ Granular |
| T30 | 1 script + 1 workflow | ✅ Granular |
| T31 | 1 script + 1 documento | ✅ Granular |
| T32 | 1 workflow | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends on (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T23 | — | raiz das fases 1 e 2 | ✅ |
| T24 | T23 | T23 → T24 | ✅ |
| T25 | T24 | T24 → T25 | ✅ |
| T26 | T25 | T25 → T26 | ✅ |
| T27 | T23 | T23 → T27 | ✅ |
| T28 | T27 | T27 → T28 | ✅ |
| T29 | T28 | T28 → T29 | ✅ |
| T30 | T24 | T24 → T30 | ✅ |
| T31 | T24 | T24 → T31 | ✅ |
| T32 | T28, T30, T31 | T28 → T32; (T30,T31) → T32 | ✅ |

T30 e T31 são `[P]` e não dependem uma da outra: tocam scripts e arquivos diferentes. As duas mexem
em `package.json` (script novo) — conflito trivial, resolvido executando em ordem.

---

## Test Co-location Validation

| Task | Camada criada/alterada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T23 | módulo de domínio | unit | unit | ✅ |
| T24 | módulo de domínio (`ambiente.ts`) + boot/config | unit (maior das duas) | unit | ✅ |
| T25 | módulo de domínio | unit | unit | ✅ |
| T26 | módulo de domínio (catálogo) + rota | unit | unit | ✅ |
| T27 | script | unit | unit | ✅ |
| T28 | migração SQL | integration (banco) | integration | ✅ |
| T29 | script | unit | unit | ✅ |
| T30 | script | unit | unit | ✅ |
| T31 | script | unit | unit | ✅ |
| T32 | workflow YAML | none | none | ✅ |
