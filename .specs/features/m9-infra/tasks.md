# M9 — Infra · Tasks (rodada 1)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute
flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source
of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier,
discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/m9-infra/design.md`
**Spec**: `.specs/features/m9-infra/spec.md`
**Status**: Draft
**Escopo**: **INFRA-11** (configuração + feature flags) + o esqueleto do projeto que ela exige.
A parte do **INFRA-04** (partição de `tentativas`) fica em `.specs/features/m4-coluna-vertebral/tasks.md`,
junto da tabela que ela particiona.

> **Continua em** `.specs/features/m4-coluna-vertebral/tasks.md` (T10…T22). A numeração é contínua
> entre os dois arquivos de propósito: T13 do M4 depende de T7 daqui.

---

## Ambiente: onde isto roda

| Peça | Escolha | Por quê |
| --- | --- | --- |
| Banco de desenvolvimento | o **próprio projeto Supabase** `kfpmetkmhjtmgwgaaerl` (São Paulo) | está vazio, sem aluno e sem dado real; é o ambiente de dev de fato |
| Aplicar migração | `supabase db push` / `migration up --linked`, ou `apply_migration` do MCP | verificado na doc oficial (Context7, 2026-08-16): **não usa Docker** |
| Docker | **não usado** | só seria necessário para `supabase start` e `db diff`/`db pull` — nenhum dos três entra aqui |
| Staging separado | **fast-follow**, não nesta leva | INFRA-06; vira obrigatório quando existir aluno pagante |

**Consequência que precisa estar clara:** teste de banco escreve no banco de desenvolvimento real.
Todo teste limpa o que criou e usa `user_id` gerado na hora, nunca fixo.

---

## Test Coverage Matrix

> Gerada do código, das diretrizes do projeto e da spec — confirmar antes do Execute.
> Diretrizes encontradas: `AGENTS.md`, `CLAUDE.md`, `docs/GITFLOW.md`. **Nenhuma configuração de
> runner existe ainda** (não há `package.json`), então os defaults fortes do skill se aplicam:
> cobrir todo AC da spec e todo edge case listado.

| Camada de código | Tipo de teste | Cobertura esperada | Padrão de local | Comando |
| --- | --- | --- | --- | --- |
| Migração SQL — schema, `CHECK`, gatilho, RLS, função plpgsql | integration (banco) | Todo AC da spec + todo edge case listado; a trava só-INSERT tem teste de recusa explícito | `tests/db/*.test.ts` | `npm run test:db` |
| Módulo de domínio TS (`modules/config`, `modules/aluno/*`) | unit | Todos os ramos; 1:1 com os AC; todo edge case listado | `src/modules/**/*.test.ts` | `npm run test:unit` |
| Script de job (`scripts/jobs/*`) | unit | Caminho feliz + falha do provedor de IA + falha de rede | `scripts/**/*.test.ts` | `npm run test:unit` |
| Configuração do projeto (`package.json`, `tsconfig.json`, `next.config.ts`, `.github/workflows/`) | none | — (gate de build) | — | gate de build |

## Parallelism Assessment

> Gerada do código — confirmar antes do Execute.

| Tipo de teste | Paralelizável? | Modelo de isolamento | Evidência |
| --- | --- | --- | --- |
| unit | **Sim** | sem estado compartilhado; nenhum toca banco | nenhuma dependência de rede nos módulos puros |
| integration (banco) | **Não** | um banco só, compartilhado por todos os arquivos de teste | `vitest.config.ts` com `fileParallelism: false` (T2) |

**Consequência:** toda task cujo teste é de banco roda **sequencial** — sem marca `[P]`, mesmo quando
o código dela não depende de nenhuma outra.

## Gate Check Commands

> Gerada do código — confirmar antes do Execute.

| Nível | Quando usar | Comando |
| --- | --- | --- |
| Quick | task só com teste unit | `npm run test:unit` |
| Full | task com teste de banco | `npm test` |
| Build | fim de fase, ou task só de configuração | `npm run build && npm run lint && npm test` |

---

## Execution Plan

### Fase 0: Esqueleto do projeto (sequencial)

Não existe `package.json`. Nada abaixo roda sem esta fase.

```
T1 → T2 → T3 → T4
```

### Fase 1: Configuração e feature flags — INFRA-11 (sequencial)

```
T4 → T5 → T6 → T7 → T8 → T9
```

Sequencial inteira: T5 cria a tabela que T6…T9 leem, e todo teste desta fase é de banco
(não paralelizável).

---

## Task Breakdown

### T1: Esqueleto Next.js + TypeScript

**What**: criar o projeto Next.js (App Router) em TypeScript com a estrutura de pastas do design.
**Where**: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `src/app/`,
`src/modules/`, `src/lib/db/`, `supabase/`, `scripts/jobs/`
**Depends on**: nenhuma
**Reuses**: nada — primeira linha de código do projeto
**Requirement**: — (pré-requisito de INFRA-11; estrutura definida no design do M4, §Components)

**Tools**:

- MCP: NONE
- Skill: NONE
- Consultar **Context7** (`/vercel/next.js`) antes de fixar versão ou formato do `next.config`

**Done when**:

- [ ] `npm run build` conclui sem erro
- [ ] `npm run lint` conclui sem erro
- [ ] As pastas do design existem, cada uma com um `.gitkeep` ou um `index.ts` vazio:
      `src/modules/config/`, `src/modules/aluno/{tentativas,revisao,projecoes,plano}/`,
      `src/lib/db/`, `supabase/migrations/`, `scripts/jobs/`
- [ ] `.gitignore` já cobre `node_modules/`, `.next/`, `.env` — conferir, não reescrever

**Tests**: none (camada "configuração do projeto" na matriz)
**Gate**: build

**Commit**: `chore(infra): cria o esqueleto next.js do projeto`

---

### T2: Vitest configurado, com separação unit × banco

**What**: instalar e configurar o Vitest com dois projetos — `unit` (sem rede) e `db` (banco real,
sequencial) — e os scripts de npm que a matriz de gates usa.
**Where**: `vitest.config.ts`, `package.json` (scripts), `tests/db/setup.ts`
**Depends on**: T1
**Reuses**: `vitest.config.ts` é novo; não há padrão anterior no repositório
**Requirement**: — (pré-requisito; a matriz de cobertura acima depende destes comandos existirem)

**Tools**:

- MCP: NONE
- Skill: NONE
- Consultar **Context7** (`/vitest-dev/vitest`) para a sintaxe atual de `projects`/`workspace`

**Done when**:

- [ ] `npm run test:unit` existe e passa
- [ ] `npm run test:db` existe; **pula com mensagem clara** quando `DATABASE_URL` não está definida
      (não falha — quem clona o repo sem credencial ainda consegue rodar `test:unit`)
- [ ] `npm test` roda os dois
- [ ] O projeto `db` roda com `fileParallelism: false` (ver Parallelism Assessment)
- [ ] Um teste trivial em cada projeto prova que os dois comandos funcionam
- [ ] Gate: `npm run build && npm run lint && npm test`
- [ ] Contagem de testes: 2 passam

**Tests**: unit
**Gate**: build

**Commit**: `chore(infra): configura vitest com projetos unit e db`

---

### T3: Supabase CLI ligado ao projeto + conexão de banco para teste

**What**: adicionar o Supabase CLI como dependência de desenvolvimento, ligar ao projeto
`kfpmetkmhjtmgwgaaerl`, e criar o cliente `pg` que os testes de banco usam.
**Where**: `package.json` (devDependency + script `db:push`), `supabase/config.toml`,
`tests/db/conexao.ts`, `.env.example`
**Depends on**: T2
**Reuses**: `.env.example` já existe — **acrescentar**, não reescrever
**Requirement**: — (pré-requisito de toda migração)

**Tools**:

- MCP: `supabase-passou` (confirmar o id do projeto e a região)
- Skill: NONE

**Done when**:

- [ ] `npx supabase --version` responde (CLI instalado como devDependency, não global)
- [ ] `supabase/config.toml` existe e aponta para `kfpmetkmhjtmgwgaaerl`
- [ ] `npm run db:push` existe e aplica migração no projeto ligado **sem Docker**
- [ ] ⚠️ **O script passa o token lendo do `.env`, explicitamente.** A variável de ambiente do
      Windows `SUPABASE_ACCESS_TOKEN` existe na máquina e contém o token de **outra conta** — o CLI
      leria ela e ligaria no projeto errado. Um teste confere que `db:push` aponta para
      `kfpmetkmhjtmgwgaaerl`, não para qualquer projeto que o ambiente sugira
- [ ] `.env.example` documenta `DATABASE_URL` (string de conexão direta, para os testes de banco),
      **sem valor**, com o mesmo aviso de "nunca commite segredo" das outras chaves
- [ ] `tests/db/conexao.ts` abre e fecha uma conexão contra `DATABASE_URL` e um teste prova isso
- [ ] Gate: `npm test`
- [ ] Contagem de testes: 3 passam (2 de T2 + 1 novo)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `chore(infra): liga o supabase cli e a conexao de teste ao projeto`

---

### T4: CI roda build, lint e testes

**What**: acrescentar ao `ci.yml` um job que instala dependências, compila, roda lint e roda os
testes unit; os de banco rodam se o segredo estiver configurado.
**Where**: `.github/workflows/ci.yml` (modificar)
**Depends on**: T3
**Reuses**: `ci.yml` já tem os jobs `segredos` e `documentos` — **acrescentar um job**, não substituir
**Requirement**: — (a regra "`main` é sempre deployável" do `docs/GITFLOW.md` depende disto)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] O job novo roda `npm ci`, `npm run build`, `npm run lint`, `npm run test:unit`
- [ ] O job roda `npm run test:db` **apenas** quando o segredo `DATABASE_URL` existe no repositório;
      sem ele, pula com aviso — nunca falha por ausência de credencial
- [ ] Os jobs `segredos` e `documentos` continuam existindo e passando
- [ ] O PR desta task mostra a CI verde

**Tests**: none (camada "configuração do projeto")
**Gate**: build

**Commit**: `ci: roda build, lint e testes a cada PR`

---

### T5: Tabela `configuracoes` — append-only, com trava

**What**: primeira migração do banco: a tabela de configuração, seu índice, a view do valor vigente,
o RLS e as duas camadas de trava contra UPDATE/DELETE.
**Where**: `supabase/migrations/<ts>_configuracoes.sql`, `tests/db/configuracoes.test.ts`
**Depends on**: T4
**Reuses**: SQL do design (`m9-infra/design.md` §Data Models) — copiar de lá, não reinventar
**Requirement**: INFRA-11 (AC1, AC4, AC7) · **AD-078** · **AD-081**

**Tools**:

- MCP: `supabase-passou` (`apply_migration`, `execute_sql`, `list_tables`)
- Skill: NONE

**Done when**:

- [ ] A tabela existe com as colunas do design, incluindo `alterado_por uuid not null references auth.users(id)`
- [ ] O `CHECK chave_com_prefixo_valido` recusa chave fora do padrão `^(flag|param)\.m[1-9]\.[a-z0-9_]+$`
- [ ] A view `configuracoes_vigentes` devolve **a última linha** de cada chave (AC7: o valor anterior
      é a penúltima linha, não uma tabela paralela)
- [ ] `REVOKE update, delete` + gatilho recusam UPDATE e DELETE **inclusive** para o papel de serviço
      (AD-081 herda a trava do AD-082, sem porta de esquecimento — a tabela não tem dado pessoal)
- [ ] RLS ligado, **sem policy** para `anon`/`authenticated`: a tabela é invisível ao navegador
- [ ] Gate: `npm test`
- [ ] Contagem de testes: 8 passam (3 anteriores + 5 novos: prefixo inválido recusado · valor vigente
      = última linha · histórico preservado após 2 INSERTs · UPDATE recusado · DELETE recusado)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m9): cria a tabela de configuracao append-only`

---

### T6: Catálogo de chaves em código

**What**: declarar em TypeScript toda chave que existe — tipo, default, módulo dono, descrição — e o
teste que prova que não há chave órfã no banco.
**Where**: `src/modules/config/catalogo.ts`, `src/modules/config/catalogo.test.ts`,
`tests/db/catalogo-sem-orfa.test.ts`
**Depends on**: T5
**Reuses**: a lista das 10 chaves está em `m4-coluna-vertebral/design.md` §Chaves de configuração
**Requirement**: INFRA-11 (AC8) · **AD-078**

**Tools**:

- MCP: NONE (o teste de órfã usa a conexão de T3)
- Skill: NONE
- Consultar **Context7** (`/colinhacks/zod`) para a API de validação atual

**Done when**:

- [ ] `CATALOGO` declara as 10 chaves do M4 do design, cada uma com `tipo` (schema zod), `padrao`,
      `moduloDono` e `descricao`
- [ ] O tipo `Chave` é derivado do catálogo — ler chave inexistente é **erro de compilação**
- [ ] `ChaveFlag` e `ChaveParam` são tipos separados, derivados do prefixo
- [ ] Teste de banco: toda `chave` presente em `configuracoes` existe no catálogo (AC8 — chave órfã
      falha o teste)
- [ ] Todo `padrao` valida contra o próprio `tipo` da chave (default inválido é erro no teste)
- [ ] Gate: `npm test`
- [ ] Contagem de testes: 12 passam (8 anteriores + 4 novos)

**Tests**: unit + integration (banco)
**Gate**: full

**Commit**: `feat(m9): declara o catalogo de chaves de configuracao`

---

### T7: Leitura — `getParam`, `isFlagOn`, `getParams`

**What**: a função que entrega valor tipado a quem consome, com cache curto e queda segura.
**Where**: `src/modules/config/leitura.ts`, `src/modules/config/index.ts`,
`src/modules/config/leitura.test.ts`, `tests/db/config-leitura.test.ts`
**Depends on**: T6
**Reuses**: `unstable_cache` do Next.js (verificado no design via Context7); cliente Supabase de
servidor de `src/lib/db/`
**Requirement**: INFRA-11 (AC3, AC5, AC6) · **AD-078** · **AD-081**

**Tools**:

- MCP: NONE
- Skill: NONE
- Consultar **Context7** (`/vercel/next.js`) para `unstable_cache` — assinatura e invalidação por tag

**Done when**:

- [ ] `getParam(chave)` devolve o valor vigente do banco, tipado
- [ ] `getParam` devolve o **default do catálogo** quando não há linha no banco (banco vazio sobe)
- [ ] `getParam` devolve o **default do catálogo** quando a leitura falha, e reporta o erro (AC6)
- [ ] `getParam` devolve o **default do catálogo** quando o valor do banco não valida contra o tipo,
      e reporta o erro
- [ ] `isFlagOn(chave)` devolve **`false`** em qualquer falha — mesmo que o default declarado seja
      `true` (AC6: flag ilegível nunca liga superfície)
- [ ] `getParams(...chaves)` lê em lote, **um** round-trip
- [ ] A janela de cache é **constante em código, 30s** — não vem da tabela (circularidade registrada
      no design §Risks)
- [ ] Teste de banco: mudar o valor por INSERT e ver a leitura mudar **sem novo build** (AC3)
- [ ] Gate: `npm test`
- [ ] Contagem de testes: 21 passam (12 anteriores + 9 novos — um por marcador acima)

**Tests**: unit + integration (banco)
**Gate**: full

**Commit**: `feat(m9): le configuracao com cache curto e queda segura`

---

### T8: Escrita — `setConfig` com autor obrigatório

**What**: registrar mudança de valor validando contra o catálogo, com autor obrigatório, e invalidar
o cache.
**Where**: `src/modules/config/escrita.ts`, `src/modules/config/escrita.test.ts`,
`tests/db/config-escrita.test.ts`
**Depends on**: T7
**Reuses**: `CATALOGO` (T6), a tag de cache de T7
**Requirement**: INFRA-11 (AC7) · **AD-081**

**Tools**:

- MCP: `supabase-passou` (criar um usuário de teste em `auth.users` para o `alterado_por`)
- Skill: NONE

**Done when**:

- [ ] `setConfig(chave, valor, { autorId, motivo })` faz **INSERT** — nunca UPDATE
- [ ] Valor que não valida contra o tipo do catálogo é recusado **antes** do INSERT
- [ ] Chave fora do catálogo é recusada (erro de compilação para chave literal; erro em execução para
      chave dinâmica)
- [ ] `autorId` ausente ou nulo é recusado — **não existe alteração anônima** (AC7)
- [ ] Depois do INSERT, a leitura de T7 devolve o valor novo dentro da janela de cache
- [ ] Teste de banco: dois `setConfig` seguidos na mesma chave deixam **duas linhas**; a consulta do
      histórico mostra quem, quando, valor anterior e valor novo (AC7) sem tabela paralela
- [ ] Gate: `npm test`
- [ ] Contagem de testes: 27 passam (21 anteriores + 6 novos)

**Tests**: unit + integration (banco)
**Gate**: full

**Commit**: `feat(m9): grava mudanca de configuracao com autor obrigatorio`

---

### T9: Teste de queda — a superfície fica desligada, não ligada

**What**: o Independent Test do INFRA-11: derrubar a leitura da config e provar que a flag fica
desligada e o alerta dispara.
**Where**: `tests/db/config-queda.test.ts`, `src/modules/config/leitura.ts` (ajuste do reporte de erro)
**Depends on**: T8
**Reuses**: `isFlagOn` (T7)
**Requirement**: INFRA-11 (AC6) — **Independent Test da spec**

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Com a leitura do banco falhando (conexão inválida), `isFlagOn` de uma flag cujo default é
      `true` devolve **`false`**
- [ ] Com a leitura falhando, `getParam` devolve o default do catálogo
- [ ] A falha é **reportada** por um ponto único, pronto para o Sentry ligar no INFRA-09 — nesta leva
      o Sentry não existe, então o reporte é uma função injetável e o teste prova que foi chamada
- [ ] Gate: `npm test`
- [ ] Contagem de testes: 30 passam (27 anteriores + 3 novos)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `test(m9): prova que config ilegivel deixa a flag desligada`

---

## Parallel Execution Map

```
Fase 0 (sequencial):
  T1 ──→ T2 ──→ T3 ──→ T4

Fase 1 (sequencial — todo teste é de banco, não paralelizável):
  T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8 ──→ T9
```

Nenhuma task desta feature leva `[P]`. Duas razões, e basta uma: (a) cada uma depende do resultado da
anterior; (b) o teste de banco compartilha um banco só.

---

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T1: esqueleto Next.js | 1 comando de scaffold + pastas vazias | ✅ Granular |
| T2: Vitest | 1 arquivo de config + scripts | ✅ Granular |
| T3: Supabase CLI + conexão | 1 config + 1 helper de conexão | ✅ Granular |
| T4: CI | 1 arquivo modificado | ✅ Granular |
| T5: tabela `configuracoes` | 1 migração | ✅ Granular |
| T6: catálogo | 1 arquivo | ✅ Granular |
| T7: leitura | 1 arquivo (3 funções da mesma interface pública) | ⚠️ 3 funções coesas no mesmo arquivo — aceitável |
| T8: escrita | 1 função | ✅ Granular |
| T9: teste de queda | 1 arquivo de teste + 1 ajuste | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends on (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T1 | nenhuma | (raiz) | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T7 | T7 → T8 | ✅ |
| T9 | T8 | T8 → T9 | ✅ |

---

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T1 | configuração do projeto | none | none | ✅ |
| T2 | configuração do projeto | none | unit (2 triviais, provam os comandos) | ✅ |
| T3 | configuração + helper de conexão | none / integration | integration | ✅ |
| T4 | configuração do projeto | none | none | ✅ |
| T5 | migração SQL | integration | integration | ✅ |
| T6 | módulo TS + migração (leitura) | unit + integration | unit + integration | ✅ |
| T7 | módulo TS | unit (+ integration p/ AC3) | unit + integration | ✅ |
| T8 | módulo TS | unit (+ integration p/ AC7) | unit + integration | ✅ |
| T9 | módulo TS (ajuste) | integration | integration | ✅ |

---

## Requirement Traceability

| Requisito | AC | Task |
| --- | --- | --- |
| INFRA-11 | AC1 (uma fonte só) | T5 |
| INFRA-11 | AC2 (env var só para o que precede o banco) | T3 (`.env.example` documenta a fronteira) |
| INFRA-11 | AC3 (muda sem deploy) | T7 |
| INFRA-11 | AC4 (flag booleana e global) | T5, T6 |
| INFRA-11 | AC5 (cache curto) | T7 |
| INFRA-11 | AC6 (queda ⇒ default; flag ⇒ desligada) | T7, T9 |
| INFRA-11 | AC7 (quem, quando, valor anterior e novo) | T5, T8 |
| INFRA-11 | AC8 (dono declarado, sem chave órfã) | T6 |
| INFRA-04 | AC1…AC4 | **T13**, em `m4-coluna-vertebral/tasks.md` |

**Cobertura:** 8 de 8 AC do INFRA-11 mapeados. Nenhum AC sem task.

---

## Branches

`docs/GITFLOW.md` limita a branch a ~10 commits e 3 dias. Esta feature são 9 tasks — cabe em **duas**:

| Branch | Tasks | PR |
| --- | --- | --- |
| `chore/esqueleto-projeto` | T1…T4 | esqueleto + CI |
| `feat/m9-infra11-configuracao` | T5…T9 | INFRA-11 completo |
