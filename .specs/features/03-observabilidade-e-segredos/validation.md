# SPEC 03 — Observabilidade e segredos · Validation

**Data**: 2026-08-17
**Spec**: `.specs/features/03-observabilidade-e-segredos/spec.md`
**Requisitos**: INFRA-09, INFRA-10 (`.specs/modulos/m9-infra/spec.md` §P2 e §Edge Cases) + a
assumption de migração por GitHub Actions (M9 §Assumptions)
**Decisões que governam**: AD-087, AD-088 (e AD-037, AD-078, AD-081, AD-083 citadas)
**Diff range**: `0db8e06..HEAD` na branch `feat/m9-p2-observabilidade` — 11 commits, 44 arquivos
**Verifier**: sub-agente independente (autor ≠ verificador), evidence-or-zero

> **Limitação declarada da evidência.** A branch **não foi empurrada**. Nenhum dos workflows novos
> (`advisors.yml`, `vigia-de-jobs.yml`, `migracao.yml`) nem o `ci.yml` alterado jamais executou no
> GitHub. Tudo que depende de execução de workflow foi verificado por **leitura + parse de YAML +
> execução local do script que o workflow chama** — o que prova o script, não o gatilho. Isto é
> limitação de evidência, **não** falha de implementação. Os segredos `SENTRY_DSN`,
> `SUPABASE_ACCESS_TOKEN` e `DATABASE_URL` já estão cadastrados no repositório (conferido hoje).

---

## Task Completion

| Task | Status | Notas |
| --- | --- | --- |
| T23 — saneamento + ponto único de reporte | ✅ Done | 8 "Done when" com evidência; 21 testes novos (`saneamento.test.ts` 14 + `reporte.test.ts` 7) |
| T24 — Sentry no front, servidor e edge | ✅ Done | 16 testes novos (`ambiente.test.ts` 8 + `boot-do-sentry.test.ts` 8); build verde com `withSentryConfig` |
| T25 — falha de config passa a alertar | ✅ Done | assinatura da SPEC 02 preservada; 4 testes novos; nenhum teste da SPEC 02 removido nem enfraquecido |
| T26 — rota de erro proposital atrás de flag | ✅ Done | 3 testes; chave `flag.m9.rota_de_erro_proposital` no catálogo com default `false` |
| T27 — falha de workflow do Actions | ⚠️ Done com desvio | 11 testes verdes, mas o "Done when" pedia passo `if: failure()` **nos três jobs** e a implementação usou **um job `alerta` agregador**. Ver Gap 3 |
| T28 — pg_cron + view `jobs_falhados` | ✅ Done | 5 testes de banco; `get_advisors` conferido ao vivo, nenhum achado novo |
| T29 — vigia de jobs | ⚠️ Done com lacuna de teste | 10 testes cobrem `JANELA_HORAS`, `ambienteDoScript`, `motivoDeParada`, `resumirFalhas`; **`executar()` não tem teste automatizado**. Ver Gap 1 |
| T30 — advisors do Supabase | ✅ Done | 11 testes, `executar()` coberto por injeção de `buscar`; execução real conferida |
| T31 — varredura de segredos + inventário | ✅ Done | 21 testes, 1 caso positivo por padrão + teste negativo do DSN + varredura do repositório inteiro sem exceção; `docs/SEGREDOS.md` completo |
| T32 — migração por CI | ✅ Done | YAML parseia; `db-push.mjs` passou a aceitar `DATABASE_URL` do ambiente; `docs/GITFLOW.md` atualizado. Sem teste por desenho (matriz declara `none`) |

Nenhuma task bloqueada. Nenhum marcador `// SPEC_DEVIATION` no diff.

---

## Spec-Anchored Acceptance Criteria

### INFRA-09 AC1 — erro no front e no servidor, com contexto (rota, release), e alerta

| Critério (WHEN X THEN Y) | Resultado esperado pela spec | `file:line` + expressão da asserção | Resultado |
| --- | --- | --- | --- |
| Erro não tratado no **servidor** é capturado com contexto de **rota** | `onRequestError` exportado — é ele que carrega `routerKind`/`routePath`/`routeType` (design.md §Components) | `src/instrumentation.ts:25` — `export const onRequestError = Sentry.captureRequestError`; teste `src/modules/observabilidade/boot-do-sentry.test.ts:86` — `expect(conteudo).toContain("export const onRequestError = Sentry.captureRequestError")` | ⚠️ PASS estrutural (asserção sobre texto do fonte, ver Gap 6) |
| Erro não tratado no **front** (render do React) é capturado | `global-error.tsx` chama `captureException` e **não** imprime a mensagem | `src/app/global-error.tsx:22` — `Sentry.captureException(error)`; teste `boot-do-sentry.test.ts:95,97` — `expect(conteudo).toContain("Sentry.captureException(error)")` e `expect(conteudo).not.toContain("{error.message}")` | ⚠️ PASS estrutural |
| O evento carrega **release** | cascata `NEXT_PUBLIC_SENTRY_RELEASE` → `VERCEL_GIT_COMMIT_SHA` → `GITHUB_SHA` → `"desenvolvimento"`, com teste por degrau | `src/modules/observabilidade/ambiente.test.ts:56` — `expect(release()).toBe("v1.2.3")`; `:62` — `toBe("sha-da-vercel")`; `:67` — `toBe("sha-do-github")`; `:71` — `toBe("desenvolvimento")` | ✅ PASS |
| Os três runtimes leem DSN/release/ambiente da mesma fonte | `dsn: dsn()`, `release: release()`, `environment: ambienteDeExecucao()` nos três `init` | `boot-do-sentry.test.ts:51-53` — `expect(conteudo).toContain("release: release()")` (loop sobre `server`, `edge`, `client`) | ✅ PASS |
| DSN ausente/vazio/só-espaço ⇒ SDK calado, app funciona igual | `sentryLigado() === false` nos três casos | `ambiente.test.ts:42-47` — `expect(dsn()).toBe("")` e `expect(sentryLigado()).toBe(false)` para `undefined`, `""` e `"   "` | ✅ PASS |
| Ambiente sem pista ⇒ `development`, nunca `production` | `"development"` | `ambiente.test.ts:92` — `expect(ambienteDeExecucao()).toBe("development")` | ✅ PASS |
| **E SHALL alertar** o time conforme regra configurada | e-mail `passouconcurso@gmail.com` pela regra padrão do Sentry (design.md §Tech Decisions, AD-087c) | regra vive no painel do Sentry — fora do código | **evidência ao vivo — fornecida pelo orquestrador, ver adendo no fim do relatório** |

### INFRA-09 AC2 — falha de job visível (log + alerta), nunca silenciosa

| Critério | Resultado esperado pela spec | `file:line` + expressão da asserção | Resultado |
| --- | --- | --- | --- |
| Execução de `pg_cron` que **falhou** fica visível; a que deu certo não | view devolve `failed` e `canceled`, esconde `succeeded` e `running` | `tests/db/jobs-falhados.test.ts:46` — `expect(rows.map((l) => Number(l.runid))).toEqual([999001, 999003])`; `:48` — `expect(rows[0].return_message).toBe("division by zero")` | ✅ PASS |
| Extensão `pg_cron` instalada e histórico de pé | `pg_extension` tem a linha; `cron.job_run_details` existe | `tests/db/jobs-falhados.test.ts:20,25` — `expect(extensao.rows).toHaveLength(1)`, `expect(historico.rows[0].tabela).toBe("cron.job_run_details")` | ✅ PASS |
| A view não abre porta lateral para o schema `cron` | `security_invoker=true`; `anon`/`authenticated` sem grant | `tests/db/jobs-falhados.test.ts:92` — `expect(rows[0].reloptions).toContain("security_invoker=true")`; `:81` — `expect(rows).toEqual([])` sobre `role_table_grants` | ⚠️ PASS por proxy (grant, não tentativa de leitura — Gap 5) |
| Falha órfã (job apagado) ainda aparece | 1 linha, `jobname = null` (left join) | `tests/db/jobs-falhados.test.ts:65-66` — `expect(rows).toHaveLength(1)`, `expect(rows[0].jobname).toBe(null)` | ✅ PASS |
| O vigia transforma linha da view em alerta | mensagem com nome do job e status; contexto com `origem: "pg_cron"` | `scripts/jobs/vigia-de-jobs.test.ts:89` — `expect(falha.mensagem).toBe("job de pg_cron falhou: recalcula_projecoes (failed)")`; `:92-100` — `expect(falha.contexto).toEqual({...})` | ✅ PASS |
| Job sem nome não vira `"null"` | identificado por `jobid` | `vigia-de-jobs.test.ts:108` — `expect(falha.mensagem).toBe("job de pg_cron falhou: jobid 9 (canceled)")` | ✅ PASS |
| Lista vazia não gera alerta nenhum | `[]` | `vigia-de-jobs.test.ts:73` — `expect(resumirFalhas([])).toEqual([])` | ✅ PASS |
| Sem `DATABASE_URL` o vigia diz o que falta, nunca "nada a reportar" | motivo explícito + código de saída ≠ 0 | motivo: `vigia-de-jobs.test.ts:58` — `expect(motivoDeParada({})).toContain("DATABASE_URL nao esta definida")`. Código de saída: **sem teste** — conferido ao vivo pelo verificador (`EXIT=1`) | ⚠️ PASS parcial (Gap 1) |
| Nenhuma falha na janela ⇒ código de saída 0 | `0` | **sem teste** — conferido ao vivo pelo verificador: `npm run jobs:vigia` → `[vigia] nenhuma falha de pg_cron nas ultimas 26h.`, `EXIT=0` | ⚠️ PASS parcial (Gap 1) |
| Janela é constante em código, não parâmetro de config (AD-088b) | 26 horas | `vigia-de-jobs.test.ts:23` — `expect(JANELA_HORAS).toBe(26)`; `:24` — `expect(CONSULTA).toContain("make_interval(hours => $1::int)")` | ✅ PASS |
| Falha de **workflow** do Actions produz mensagem útil com workflow/job/URL | uma linha com workflow e detalhe; URL da execução | `scripts/jobs/reportar-falha.test.ts:31` — `expect(montarMensagem(AMBIENTE_COMPLETO)).toBe("GitHub Actions falhou: CI — app=failure")`; `:52` — URL completa; `:65-72` — `expect(montarContexto(...)).toEqual({origem:"github-actions",workflow:"CI",job:"app",...})` | ✅ PASS |
| Entrada faltando campo não explode nem vira `"undefined"` | `"workflow desconhecido — sem detalhe"`; campos `null` | `reportar-falha.test.ts:44` e `:76-83` — `expect(montarContexto({})).toEqual({... workflow: null, job: null, execucao: null})` | ✅ PASS |
| **Visibilidade não depende do Sentry** (log é o piso, AD-088c) | sem DSN: `iniciarSentry() === false` e o console recebe a falha | `reportar-falha.test.ts:90,93` — `expect(await iniciarSentry()).toBe(false)`; `:102-106` — `expect(espiao).toHaveBeenCalledWith("[job]", { origem: "github-actions" }, "Error: job caiu")` | ✅ PASS |
| Nenhum dado de aluno no evento do job | só metadado público do GitHub | `reportar-falha.test.ts:65-72` (contexto fechado, sem campo de aluno) | ✅ PASS |
| Cada workflow tem passo de alerta em `if: failure()` | os quatro workflows | `ci.yml:130` (`if: failure()` + `needs: [segredos, documentos, app]`), `advisors.yml:39`, `vigia-de-jobs.yml:45`, `migracao.yml:64` — todos com `run: node scripts/jobs/reportar-falha.mjs` | ⚠️ PASS por leitura (nunca executou — limitação declarada; e Gap 3 no `ci.yml`) |

### INFRA-09 AC3 — advisors como fonte complementar

| Critério | Resultado esperado pela spec | `file:line` + expressão da asserção | Resultado |
| --- | --- | --- | --- |
| Separa `ERROR` de `WARN`/`INFO`, com as três severidades | três grupos distintos | `scripts/advisors.test.ts:42-45` — `expect(grupos.ERROR.map((l) => l.name)).toEqual(["policy_exists_rls_disabled"])` + WARN + INFO + `DESCONHECIDO` vazio | ✅ PASS |
| Resposta em formato inesperado ⇒ erro explícito, **nunca** "nenhum achado" | lança com mensagem reconhecível | `advisors.test.ts:56-58` — `expect(() => classificar({})).toThrow(/resposta inesperada da API de advisors/)`, idem para `lints: "nao e lista"` e `null` | ✅ PASS |
| Severidade não reconhecida não é engolida | vai para `DESCONHECIDO` e **reprova** | `advisors.test.ts:50` — `expect(grupos.DESCONHECIDO.map((l) => l.name)).toEqual(["novo", "sem"])`; `:68` — `expect(reprova(classificar({lints:[{level:"CRITICAL"}]}))).toBe(true)` | ✅ PASS |
| Sem `SUPABASE_ACCESS_TOKEN` ⇒ saída ≠ 0 dizendo o que falta | `1` + mensagem | `advisors.test.ts:86-87` — `expect(await executar({token:""})).toBe(1)` e `expect(espiao.mock.calls[0][0]).toContain("SUPABASE_ACCESS_TOKEN nao esta definido")` | ✅ PASS |
| `ERROR` presente ⇒ saída ≠ 0; só `WARN`/`INFO` ⇒ 0 com lista impressa | `1` / `0` | `advisors.test.ts:105` — `expect(await executar({token:"sbp_falso", buscar: respostaFalsa(RESPOSTA)})).toBe(1)`; `:98-99` — `expect(codigo).toBe(0)` + `toContain("[security] INFO: so um aviso")` | ✅ PASS |
| HTTP fora do 2xx reprova em vez de fingir que não há achado | `1` + `"a API respondeu 401"` | `advisors.test.ts:118-119` | ✅ PASS |
| Consulta os dois tipos, com o token no cabeçalho | 2 chamadas, `Bearer <token>` | `advisors.test.ts:133-134` — `expect(chamadas).toHaveLength(2)`, `expect(chamadas[0].cabecalho).toBe("Bearer sbp_falso")` | ✅ PASS |
| Funciona contra a API real | achados impressos, saída 0 sem `ERROR` | **conferido ao vivo pelo verificador**: `npm run advisors` → 1 INFO de segurança + 1 INFO de desempenho, ambos sobre `configuracoes` (SPEC 02), `EXIT=0` | ✅ PASS |

### INFRA-10 — segredo fora do código (M9 §Edge Cases)

| Critério | Resultado esperado pela spec | `file:line` + expressão da asserção | Resultado |
| --- | --- | --- | --- |
| Cada padrão de segredo é achado | 1 caso positivo por padrão, sem padrão órfão | `scripts/varredura-de-segredos.test.ts:40-43` — `it.each(EXEMPLOS)` com `expect(achados.map((a) => a.nome)).toContain(nome)`; `:46-48` — `expect(EXEMPLOS.map(([n]) => n).sort()).toEqual(PADROES.map((p) => p.nome).sort())` | ✅ PASS |
| Padrões novos desta spec: `sntrys_`, `sb_secret_`, senha em string de conexão | os três na lista com caso de teste | `varredura-de-segredos.mjs:26,27,45` + `varredura-de-segredos.test.ts:24,25,34-36` | ✅ PASS |
| O DSN público do Sentry **não** é segredo (AD-087f) | `[]` | `varredura-de-segredos.test.ts:63` — `expect(encontrarSegredos("NEXT_PUBLIC_SENTRY_DSN=" + dsn)).toEqual([])` | ✅ PASS |
| `.env.example` não dispara a varredura, com o conteúdo real | `[]` | `varredura-de-segredos.test.ts:105` — `expect(encontrarSegredos(readFileSync(".env.example","utf8"))).toEqual([])` | ✅ PASS |
| `.env` não está versionado | `false` | `varredura-de-segredos.test.ts:109` — `expect(envEstaVersionado()).toBe(false)` | ✅ PASS |
| Nenhum arquivo versionado carrega credencial, sem exceção | `[]` sobre o repositório inteiro | `varredura-de-segredos.test.ts:126` — `expect(comSegredo).toEqual([])` varrendo `arquivosVersionados()` | ✅ PASS |
| Não imprime o valor inteiro do achado | trecho de 8 caracteres | `varredura-de-segredos.test.ts:56-57` — `expect(achados[0].trecho).toBe("sbp_zzzz…")` e `not.toContain("z".repeat(40))` | ✅ PASS |
| Alarme falso controlado (exemplo curto, string montada em código) | `[]` | `varredura-de-segredos.test.ts:67-70` e `:77-86` | ✅ PASS |
| A varredura **reprova** de fato quando há segredo | código de saída 1 | **conferido ao vivo pelo verificador** em repositório git descartável: segredo plantado ⇒ `::error file=vazamento.ts,line=1::token de acesso do Supabase` + `EXIT=1`; sem segredo ⇒ `EXIT=0`; `.env` versionado ⇒ `EXIT=1` | ✅ PASS |
| Onde cada segredo vive, quem usa, o que fazer se vazar | inventário completo | `docs/SEGREDOS.md:16-25` (tabela de 8 variáveis × 3 lares), `:50-65` (rotação primeiro), `:74-81` (os três comportamentos do AD-088c) | ✅ PASS |
| `.env.example` documenta **sem valor** | nomes sem valor | `.env.example:36,51,54,63,79,83,87,93` — toda linha termina em `=` | ✅ PASS |

### INFRA-11 AC6 — a parte "e SHALL alertar", que a SPEC 02 deixou pendente

| Critério | Resultado esperado pela spec | `file:line` + expressão da asserção | Resultado |
| --- | --- | --- | --- |
| Falha de leitura de config chega ao ponto único com o módulo identificado | contexto `{ modulo: "config", chaves, motivo }` | `src/modules/config/leitura.test.ts:198-202` — `expect(recebidos[0].contexto).toEqual({ modulo: "config", chaves: ["param.m4.minutos_por_questao"], motivo: "falha ao ler a configuracao" })` | ✅ PASS |
| Flag ilegível continua **desligada** E agora também alerta | `false` + 1 reporte | `leitura.test.ts:212-214` — `expect(await isFlagOn("flag.m4.caderno_erros")).toBe(false)` + `expect(recebidos).toHaveLength(1)` | ✅ PASS |
| Dado pessoal no contexto do config chega saneado | `email: "[removido]"`, `chave` preservada | `leitura.test.ts:226-230` — `expect(recebidos[0].contexto).toEqual({ modulo: "config", email: "[removido]", chave: "param.m4.minutos_por_questao" })` | ✅ PASS |
| A assinatura publicada pela SPEC 02 não mudou | `definirReporteDeErro` continua curto-circuitando o padrão | `leitura.test.ts:240-242` — `expect(reportes).toHaveLength(1)` e `expect(noDestino).toEqual([])`; os 9 testes da SPEC 02 passam sem edição | ✅ PASS |

### Contrato desta spec — erro sem dado pessoal (antecipa DADOS-07 AC6, AD-087b)

| Critério | Resultado esperado pela spec | `file:line` + expressão da asserção | Resultado |
| --- | --- | --- | --- |
| Chave sensível vira `[removido]` em objeto raso, aninhado e dentro de array | `"[removido]"` | `src/modules/observabilidade/saneamento.test.ts:25-33` — `expect(saneado.email).toBe("[removido]")`, idem `aluno.cpf`, `aluno.nome`, `tentativas[0].senha`, `tentativas[1].authorization` | ✅ PASS |
| E-mail vira `[email]`, CPF vira `[cpf]`, em texto solto | strings exatas | `saneamento.test.ts:58-64` — `expect(sanitizarTexto("... joao.silva+bb@gmail.com ...")).toBe("... [email] ...")`, `"(cpf)=([cpf])"`, `"cpf [cpf] invalido"` | ✅ PASS |
| Referência circular não vira laço infinito | `"[circular]"`, e reuso lado a lado **não** é ciclo | `saneamento.test.ts:81` — `expect(saneado.eu).toBe("[circular]")`; `:90-91` — reuso preservado | ✅ PASS |
| Teto de profundidade respeitado | `"[profundo]"` no nível 12 | `saneamento.test.ts:104` — `expect(atual).toBe("[profundo]")` | ✅ PASS |
| `sanearEventoSentry` **apaga** `user.email` e `user.ip_address` | chave ausente, não mascarada | `saneamento.test.ts:124-125` — `expect("email" in saneado.user).toBe(false)`, `expect("ip_address" in saneado.user).toBe(false)`; `:126` — `user.id` preservado | ✅ PASS |
| A pilha de chamada sobrevive ao saneamento | `filename`, `function`, `lineno` intactos no nível 7 | `saneamento.test.ts:152-155` — `expect(quadro.filename).toBe("src/app/page.tsx")` etc. | ✅ PASS |
| `chave`/`chaves` **não** são tratadas como credencial | `false`, valor preservado | `saneamento.test.ts:46-47,53-54` — `expect(chaveEhSensivel("chave")).toBe(false)`, `expect(saneado.chaves).toEqual(["flag.m4.caderno_erros"])` | ✅ PASS |
| O contexto chega ao destino **já saneado** | destino nunca vê o dado cru | `src/modules/observabilidade/reporte.test.ts:45-49` — `expect(recebido).toEqual({ email: "[removido]", motivo: "conta de [email] recusada", chaves: [...] })` | ✅ PASS |
| O objeto `Error` chega **cru** ao destino, para não perder a pilha | mesma `stack` | `reporte.test.ts:61-62` — `expect((recebido as Error).stack).toBe(erro.stack)` | ✅ PASS |
| Destino padrão escreve no `console.error` com a mensagem saneada | `["[erro]", { modulo: "config" }, "Error: conta [email] nao existe"]` | `reporte.test.ts:73-77` — `expect(espiao.mock.calls[0]).toEqual([...])` | ✅ PASS |
| Erro do próprio destino não escapa | não lança; console recebe os dois erros | `reporte.test.ts:98-103` — `expect(() => reportarErro(...)).not.toThrow()` + `toHaveBeenCalledWith("[erro] o destino de reporte falhou", ...)` | ✅ PASS |
| O log do job também sai saneado (AD-087b: vale para o console) | `{ email: "[removido]", detalhe: "cpf [cpf] duplicado" }` | `scripts/jobs/reportar-falha.test.ts:118-122` | ✅ PASS |
| `return_message` do pg_cron sai saneado no ponto em que é lido | e-mail e CPF trocados | `scripts/jobs/vigia-de-jobs.test.ts:128-130` — `expect(falha.contexto.detalhe).toBe("duplicate key ... Key (email)=([email]) — cpf [cpf]")` | ✅ PASS |
| O núcleo **não importa** `@sentry/*` (AD-087a) | nenhum import em nenhum fonte do módulo | `saneamento.test.ts:172-173` — `expect(conteudo.includes('from "@sentry/')).toBe(false)` varrendo `readdirSync` da pasta | ✅ PASS |

### AD-087d/e — replay proibido, tracing desligado

| Critério | Resultado esperado | `file:line` + expressão da asserção | Resultado |
| --- | --- | --- | --- |
| Nenhum `init` liga session replay | os três nomes ausentes | `boot-do-sentry.test.ts:60-62` — `expect(conteudo).not.toContain("replayIntegration")`, `not.toContain("replaysSessionSampleRate")`, `not.toContain("replaysOnErrorSampleRate")` | ✅ PASS |
| Nenhum `init` liga tracing | `tracesSampleRate: 0` nos três | `boot-do-sentry.test.ts:68` | ✅ PASS |
| Privacidade também no `init` do job | mesmas três linhas no `sentry-node.mjs` | `reportar-falha.test.ts:133-136` — `toContain("beforeSend: sanearEventoSentry")`, `toContain("dataCollection: { userInfo: false, httpBodies: [] }")`, `toContain("tracesSampleRate: 0")`, `not.toContain("replayIntegration")` | ✅ PASS |
| Nem dado de usuário nem corpo de requisição | `dataCollection: { userInfo: false, httpBodies: [] }` nos três | `boot-do-sentry.test.ts:42-44` | ✅ PASS |

### M9 §Assumptions — migração aplicada por GitHub Actions

| Critério | Resultado esperado pela spec | Evidência | Resultado |
| --- | --- | --- | --- |
| Dispara só em `push` na `main` tocando `supabase/migrations/**`, mais `workflow_dispatch` | dois gatilhos | `migracao.yml:15-20`; parse de YAML confirma `gatilhos: push, workflow_dispatch` e `paths: ["supabase/migrations/**"]` | ⚠️ PASS por leitura (nunca executou) |
| Sem `DATABASE_URL` o workflow **falha** (≠ do teste de banco, que pula) — AD-088c | `exit 1` com mensagem explícita | `migracao.yml:45-53` — `if [ -z "${DATABASE_URL:-}" ]; then echo "::error::..."; exit 1; fi` | ⚠️ PASS por leitura |
| Usa `npm run db:push`, que recusa banco diferente do declarado | `conferirAlvo()` no caminho | `migracao.yml:61` + `scripts/db-push.mjs:33` (`conferirAlvo(databaseUrl)`); `scripts/alvo-do-banco.test.ts` (3 testes, pré-existentes, seguem verdes) | ✅ PASS |
| Dois merges seguidos não aplicam ao mesmo tempo | `concurrency` sem cancelamento | `migracao.yml:23-25` | ✅ PASS |
| `docs/GITFLOW.md` diz que migração entra por merge, não por painel | frase explícita | `docs/GITFLOW.md` §Banco de dados — "**Quem aplica é a CI, não você.**" | ✅ PASS |
| `db:push` passou a funcionar sem `.env` (caso da CI) | lê do ambiente | `scripts/db-push.mjs:30-31` — `existsSync(CAMINHO_ENV) ? lerEnv(...) : {}` e `doArquivo.DATABASE_URL \|\| process.env.DATABASE_URL` | ⚠️ Sem teste (mudança de comportamento em script pré-existente, ver Gap 7) |

**Status**: ✅ Todos os AC das duas fontes de requisito (INFRA-09 AC1/AC2/AC3, INFRA-10) têm evidência
com `file:line`. **1 linha pendente de evidência ao vivo** (a parte "SHALL alertar" do AC1).
**6 critérios marcados ⚠️** por evidência estrutural, por proxy ou por só existir ao vivo — nenhum
sem evidência.

---

## ASVS Security Verification

**Escopo**: não aplicável — a spec não declara nenhum critério `SEC-*`. O trabalho tem superfície de
segurança real (segredos, privilégio de view, dado pessoal atravessando fronteira), e ela foi
verificada pelos AC de INFRA-10, pelo contrato de saneamento e pelos testes de privilégio da view —
mas sem os IDs `SEC-*` versionados que a seção 2A do procedimento exige. Registrado como observação,
não como gap: a spec foi escrita antes de o projeto adotar `SEC-*`.

---

## Discrimination Sensor

Executado em **cópia temporária**: cada arquivo foi copiado para o scratch, mutado no original, testado
e restaurado pela cópia, com `git diff --stat` conferindo a limpeza depois de cada restauração.
Nenhum `git stash`/`restore`/`reset`/`clean` foi usado — os três documentos não commitados
(`STATE.md`, `ROADMAP.md`, `spec.md`) sobreviveram intactos.

| # | File:line | Mutação | Testes mortos | Morta? |
| --- | --- | --- | --- | --- |
| 1 | `src/modules/observabilidade/saneamento.mjs:102` | `PEDACOS_SENSIVEIS.some((p) => normalizada.includes(p))` → `PEDACOS_SENSIVEIS.includes(normalizada)` (casamento por pedaço vira casamento exato: `userEmail`, `SUPABASE_SECRET_KEY` deixariam de ser sanitizados) | `saneamento.test.ts:38` | ✅ Morta (1 falha) |
| 2 | `src/modules/observabilidade/reporte.ts:56` | `destinoAtual(erro, sanitizar(contexto))` → `destinoAtual(erro, contexto)` (remove o efeito exigido: contexto cru chegaria ao Sentry) | `reporte.test.ts:45`, `leitura.test.ts:226` | ✅ Morta (2 falhas) |
| 3 | `src/app/api/erro-proposital/route.ts:20` | `if (!(await isFlagOn(...)))` → `if (await isFlagOn(...))` (inverte o porteiro: flag desligada abriria a rota) | `route.test.ts` — 3 de 3 testes | ✅ Morta (3 falhas) |
| 4 | `scripts/varredura-de-segredos.mjs:45` | senha na string de conexão `{8,}` → `{1,}` e remove a guarda `(?!\$\{)` (afrouxa para alarme falso) | `varredura-de-segredos.test.ts:70`, `:81`, `:126` | ✅ Morta (3 falhas) |
| 5 | `scripts/jobs/vigia-de-jobs.mjs:93` | remove `sanitizarTexto(...)` de `detalhe` (dado pessoal do `return_message` iria cru para os EUA) | `vigia-de-jobs.test.ts:128` | ✅ Morta (1 falha) |
| 6 | `scripts/advisors.mjs:24` | `NIVEIS_QUE_REPROVAM = ["ERROR","DESCONHECIDO"]` → `["ERROR"]` (severidade nova voltaria a ser engolida) | `advisors.test.ts:68` | ✅ Morta (1 falha) |

**Profundidade**: 6 mutações — acima do piso "leve" (1–3) porque o núcleo mexe com **dado pessoal
atravessando fronteira** (AD-087g) e com **segredo**, que é a categoria de integridade do
procedimento.
**Cobertura das mutações**: as duas funções do saneamento, o ponto único de reporte, o porteiro de
flag, a varredura de segredos, o saneamento no vigia e a classificação dos advisors.
**Resultado**: **6/6 mortas — PASS ✅**. Nenhum mutante sobreviveu, nenhuma fix task de asserção fraca.

**O que o sensor não alcançou** (registrado, não escondido): a view SQL `public.jobs_falhados`. Mutar
o `where ... in ('failed','canceled')` exigiria reaplicar a migração no banco de desenvolvimento real,
que é o único banco existente (AD-083) — risco desproporcional. Em compensação, a asserção que a
cobre é discriminante por construção: `tests/db/jobs-falhados.test.ts:46` compara a **lista exata**
de `runid` contra 4 linhas semeadas (`failed`, `succeeded`, `canceled`, `running`), então qualquer
alargamento ou estreitamento do filtro quebra o teste.

---

## Code Quality

| Princípio | Status |
| --- | --- |
| Nenhuma funcionalidade além do pedido | ✅ — a única peça que não estava no `Escopo` literal é a chave de catálogo do M9, exigida pelo porteiro da rota que o Success Criteria nº1 pede |
| Nenhuma abstração para código de uso único | ✅ — `ambiente.ts` existe porque três `init` leem dele; `saneamento.mjs` porque aplicação e script leem dele. Os dois têm mais de um consumidor real |
| Nenhuma "flexibilidade" desnecessária | ⚠️ — `dsnDoAmbiente`/`carregarSdk` do `sentry-node.mjs` duplicam de propósito a lógica de `ambiente.ts` (script `.mjs` não importa `.ts`). Justificado no arquivo; o teste `reportar-falha.test.ts:126` existe para pegar as duas se divergirem |
| Só arquivos necessários tocados | ✅ — 44 arquivos, todos citados no `Where` de alguma task. `scripts/db-push.mjs` foi tocado por necessidade real de T32 |
| Não "melhorou" código não relacionado | ✅ |
| Segue os padrões existentes | ✅ — `.mjs` + JSDoc + teste `.ts` do `alvo-do-banco.mjs`; costura `definir*/restaurar*` da SPEC 02; molde de migração com comentário e `security_invoker` |
| Um engenheiro sênior aprovaria? | ✅ com as ressalvas ranqueadas abaixo. O comentário explica **por que**, não **o que** — padrão raro e mantido em todo o diff |
| Testes mapeiam para AC e não são rasos | ✅ — sensor 6/6; asserções por valor exato (`toEqual` de objeto fechado), não `toBeTruthy` |
| Spec-anchored: valor asseverado = valor da spec | ✅ — inclusive nos casos em que a spec dá a string literal (`"desenvolvimento"`, `"[removido]"`, `404`, `26`) |
| Coverage Expectation por camada | ⚠️ — domínio 1:1 com os AC; a rota cobre feliz + porta fechada + config ilegível (3 caminhos). Falha o item de script: `executar()` do vigia sem teste (Gap 1) |
| Todo teste mapeia para requisito, AC ou "Done when" | ✅ — 102 testes novos, nenhum órfão. Amostragem em `varredura-de-segredos.test.ts`: os 21 saem de itens explícitos do "Done when" de T31 |
| Diretrizes documentadas seguidas | ✅ — `AGENTS.md` (PT-BR no domínio, inglês na infra; nunca hardcodar modelo; nunca commitar segredo), `CLAUDE.md`, `docs/GITFLOW.md` (Conventional Commits com requisito e AD no corpo, 1 commit por task), `vitest.config.mts` (projetos `unit`/`db`), matriz da própria `tasks.md` |

**Invariantes do `AGENTS.md`** conferidos no diff: nenhum nome de modelo em código; nenhum segredo
commitado (provado pela própria varredura rodando sobre o repositório); nada de raspagem; nada de
execução de código gerado por IA; `tentativas` não tocada.

---

## Edge Cases

Da spec, do design (§Error Handling Strategy) e do M9 §Edge Cases:

- [x] **DSN vazio** (dev, clone sem credencial): SDK calado, `reportarErro` cai no console — `ambiente.test.ts:42-47`, `reportar-falha.test.ts:90-107`
- [x] **Contexto com e-mail/CPF**: saneado antes de sair do processo — `reporte.test.ts:45`, `leitura.test.ts:226`
- [x] **Falha ao ler config**: default + flag desligada **e** alerta — `leitura.test.ts:212`, `tests/db/config-queda.test.ts` (4 testes, seguem verdes)
- [x] **Job de Actions falha**: passo de alerta + workflow vermelho — `ci.yml:128-155` (⚠️ nunca executou)
- [x] **pg_cron falha**: linha na view + vigia reporta — `tests/db/jobs-falhados.test.ts:46`, `vigia-de-jobs.test.ts:89`
- [x] **Vigia não consegue conectar**: reporta e sai ≠ 0 — `vigia-de-jobs.mjs:121-126`; ramo **sem teste automatizado**, coberto por leitura (Gap 1)
- [x] **Advisors devolvem formato inesperado**: falha explícita, nunca "nenhum achado" — `advisors.test.ts:56-58`
- [x] **Erro do próprio destino de reporte**: engolido, não derruba a requisição — `reporte.test.ts:98`
- [x] **Referência circular / objeto profundo no contexto** — `saneamento.test.ts:81,104`
- [x] **Entrada malformada no CLI de falha** (fora do Actions, ambiente vazio) — `reportar-falha.test.ts:44,76`
- [x] **Job apagado com histórico de falha órfão** — `tests/db/jobs-falhados.test.ts:65`
- [x] **Segredo em arquivo versionado** — provado ao vivo, `EXIT=1`
- [x] **`.env` versionado por descuido** — provado ao vivo, `EXIT=1`
- [x] **Ausência de segredo com três comportamentos distintos** (AD-088c): teste de banco pula (`ci.yml:119-122`), migração falha (`migracao.yml:45-53`), sem DSN segue e loga (`reportar-falha.test.ts:96`)
- [ ] **Valor não-plano no contexto** (`Date`, `Error`, `Map`): achatado para `{}` em silêncio — **não previsto por nenhum documento e não tratado**. Ver Gap 2

---

## Gate Check

- **Comando (nível Build da `tasks.md`)**: `npm run build && npm run lint && npm test`
- **`npm run build`**: ✅ compilou em 7,8s; TypeScript em 4,0s sem erro; 3 rotas geradas, `/api/erro-proposital` como `ƒ (Dynamic)`; `withSentryConfig` ativo (é o typecheck — não existe script `typecheck`)
- **`npm run lint`**: ✅ `ESLint: No issues found`
- **`npm test`**: ✅ **22 arquivos, 143 testes, 143 passaram, 0 falharam, 0 pulados** (14 arquivos `unit` + 8 `db`), 14,68s
- **Testes antes da feature** (`0db8e06`): **41** (22 `unit` + 19 `db`) — contados arquivo por arquivo com `git show`
- **Testes depois**: **143**
- **Delta**: **+102**
- **Pulados**: nenhum. O projeto `db` **rodou** porque `DATABASE_URL` está no `.env` local — os 24
  testes de banco executaram de verdade contra o projeto `kfpmetkmhjtmgwgaaerl`. O pulo projetado
  (AD-088c) não foi exercido aqui; ele está codificado em `ci.yml:119-122` e em `tests/db/setup.ts`
- **Integridade dos testes**: nenhum teste apagado. `catalogo.test.ts` teve a contagem esperada
  **elevada** de 10 para 11 chaves e ganhou uma asserção nova (`:27`, dono `m9`) — mudança que
  **aperta**, não afrouxa. `leitura.test.ts` só ganhou linhas. Nenhuma asserção enfraquecida no diff

---

## Provas ao vivo executadas pelo verificador

Fora do gate, para cobrir "Done when" que nenhum teste automatizado alcança:

| O que | Comando | Resultado |
| --- | --- | --- |
| Advisors contra a API real (AC3 + "sem achado novo pela migração" de T28) | `npm run advisors` | `EXIT=0`; só 2 INFO, ambos sobre `configuracoes` da SPEC 02 — **nada sobre `jobs_falhados`** |
| Vigia contra a view real, sem falha na janela (T29) | `npm run jobs:vigia` | `[vigia] nenhuma falha de pg_cron nas ultimas 26h.` · `EXIT=0` — prova que `CONSULTA` é SQL válido contra a view de verdade |
| Vigia sem `DATABASE_URL` (T29, AD-088c) | script rodado de diretório sem `.env`, com a variável removida | mensagem explícita · `EXIT=1` |
| CLI de falha do Actions sem DSN (T27) | `NEXT_PUBLIC_SENTRY_DSN="" node scripts/jobs/reportar-falha.mjs` | contexto impresso no console · `EXIT=0` (reportar não pode derrubar o job) |
| Varredura reprova segredo (Success Criteria nº4) | repositório git descartável no scratch, segredo plantado | `::error file=vazamento.ts,line=1::token de acesso do Supabase` · `EXIT=1`; sem segredo `EXIT=0`; `.env` versionado `EXIT=1`; o DSN no `.env.example` **não** disparou |
| Sintaxe dos 4 workflows | parse YAML dos 4 arquivos | todos OK; gatilhos e jobs conforme o design |

---

## Fix Plans

### Gap 1 — `executar()` do vigia sem teste automatizado · **Major**

- **Root cause**: `scripts/jobs/vigia-de-jobs.mjs:113` instancia `new Client(...)` dentro da própria
  função. Sem ponto de injeção, não há como testar os três desfechos (`0` sem falha, `1` com falha,
  `1` sem conseguir consultar) no projeto `unit`, que não toca rede. O `advisors.mjs` resolveu o
  mesmo problema recebendo `buscar = fetch` por parâmetro — o padrão existe no próprio diff e não foi
  aplicado aqui.
- **Impacto**: dois itens do "Done when" de T29 ficam sem `file:line` ("nenhuma falha ⇒ saída 0";
  "sem `DATABASE_URL` sai ≠ 0"). Verifiquei os dois ao vivo, então o comportamento **está** correto
  hoje — o que falta é a rede de proteção contra regressão. O ramo mais crítico é o `catch` da
  consulta (`:121-126`): é ele que impede o vigia de parecer que olhou.
- **Fix task**: dar a `executar()` um parâmetro `consultar` com default que constrói o `Client`
  (espelhando `buscar = fetch` de `advisors.mjs:105`), e escrever 3 testes: sem falha ⇒ `0`;
  duas falhas ⇒ `1` e duas chamadas a `reportar`; consulta que lança ⇒ `1` e reporte com
  `motivo: "nao consegui consultar jobs_falhados"`.
- **Verify**: `npm run test:unit` com 3 testes novos; mutação `return 1` → `return 0` no ramo do
  `catch` deve morrer.

### Gap 2 — o ponto único achata `Date`, `Error` e `Map` para `{}` em silêncio · **Major**

- **Root cause**: `src/modules/observabilidade/saneamento.mjs:144` percorre com
  `Object.entries(valor)`. Objeto sem propriedade própria enumerável — `Date`, `Error`, `Map`, `Set`,
  `RegExp` — sai como `{}`. Confirmado executando: `sanitizar({ causa: new Error("detalhe
  importante") })` devolve `{"causa":{}}`.
- **Impacto**: nenhum AC desta spec falha, porque os dois chamadores atuais convertem antes
  (`vigia-de-jobs.mjs:94` faz `toISOString()`; o config só passa string e array). O problema é de
  fronteira: o AD-087 tornou `reportarErro` **transversal a todas as specs seguintes**, e a primeira
  spec que escrever `reportarErro(e, { causa: erroOriginal, quando: new Date() })` vai perder
  exatamente a informação de que precisava — sem erro, sem aviso, sem teste vermelho.
- **Fix task**: em `sanitizar`, antes do `Object.entries`: `Date` → `toISOString()`; `Error` →
  `{ name, message: sanitizarTexto(message) }`; `Map`/`Set` → array saneado; qualquer outro objeto
  sem chave própria enumerável → `String(valor)` saneado. Mais 4 testes, um por tipo.
- **Verify**: `npm run test:unit`; mutação que remova o tratamento de `Error` deve morrer.

### Gap 3 — desvio do "Done when" de T27, não registrado na `tasks.md` · **Minor**

- **Root cause**: T27 exige "os três jobs do `ci.yml` ganham passo `if: failure()` chamando o CLI".
  A implementação criou **um job** `alerta` (`ci.yml:128-131`) com
  `if: failure()` + `needs: [segredos, documentos, app]`. O comentário do YAML dá a razão (uma
  execução quebrada não render três e-mails iguais) e a razão é boa — mas a `tasks.md` continua
  dizendo a outra coisa, e nenhum `// SPEC_DEVIATION` foi deixado.
- **Impacto**: o AC2 é atendido (a falha alerta). Duas diferenças de comportamento merecem estar
  escritas: (a) job **cancelado** ou **skipado** não dispara `failure()`, então esse caminho fica sem
  alerta; (b) o alerta agregado custa um `npm ci` extra, só quando já falhou.
- **Fix task**: atualizar o "Done when" de T27 para descrever o job agregador, ou registrar o desvio.
  Uma linha de documento, sem mudança de código.

### Gap 4 — nenhum workflow novo jamais executou · **Minor (limitação de evidência)**

- **Root cause**: branch não empurrada.
- **Impacto**: `advisors.yml`, `vigia-de-jobs.yml`, `migracao.yml` e o `ci.yml` alterado têm evidência
  de **sintaxe** (parse YAML) e de **conteúdo** (o script que cada um chama foi executado à mão), não
  de **gatilho**. O caminho mais frágil é o `paths:` do `migracao.yml`, que só se prova num merge real.
- **Fix task**: nenhuma no código. Ao empurrar, conferir: CI verde no PR; `migracao.yml` disparando
  no merge (esta branch traz uma migração, então vai disparar); disparo manual do vigia e dos
  advisors por `workflow_dispatch`.

### Gap 5 — privilégio da view provado por `grant`, não por tentativa de leitura · **Minor**

- **Root cause**: `tests/db/jobs-falhados.test.ts:74-82` consulta `role_table_grants` e espera lista
  vazia. O "Done when" de T28 diz "`anon`/`authenticated` **não conseguem ler**".
- **Impacto**: ausência de grant implica negação, então a conclusão vale. Mas o projeto já tem o
  teste mais forte no padrão da SPEC 02 (`tests/db/configuracoes.test.ts` — "e invisivel para anon e
  authenticated"), que troca de papel e tenta ler. Usar o padrão mais fraco no arquivo novo abre
  precedente para a próxima view.
- **Fix task**: acrescentar um teste que faça `set local role anon` e espere `permission denied` ao
  ler `public.jobs_falhados`, no molde de `configuracoes.test.ts`.

### Gap 6 — 16 asserções são sobre **texto do fonte**, não sobre comportamento · **Minor**

- **Root cause**: `boot-do-sentry.test.ts` (8 testes) e `reportar-falha.test.ts:125-137` leem o
  arquivo com `readFileSync` e usam `toContain`/`not.toContain`. A razão está escrita no cabeçalho
  do arquivo e é legítima: importar o fonte executaria `Sentry.init` de verdade dentro do projeto
  `unit`, que o AD-083 mantém sem rede.
- **Impacto**: a proibição de replay e o `tracesSampleRate: 0` estão bem servidos por esse formato —
  são decisões escritas, e decisão escrita se lê. O que o formato **não** garante: que
  `beforeSend: sanearEventoSentry` esteja no objeto que chega ao SDK. Trocar por
  `beforeSend: (e) => sanearEventoSentry(e)` — equivalente e correto — deixaria o teste vermelho;
  mover o `init` para dentro de um `if` deixaria o teste verde e o SDK desligado.
- **Fix task**: opcional e de baixo retorno. Se um dia valer, um teste que faça
  `vi.mock("@sentry/nextjs")` e importe `sentry.server.config.ts`, asseverando sobre o objeto
  recebido por `init`. Não recomendo agora: acrescenta mock de biblioteca, que é justamente o que o
  desenho do AD-087a evitou.

### Gap 7 — mudança de comportamento em `db-push.mjs` sem teste · **Minor**

- **Root cause**: `scripts/db-push.mjs:30-31` passou a aceitar `DATABASE_URL` do ambiente e a tolerar
  `.env` ausente. É pré-condição de T32. `scripts/alvo-do-banco.test.ts` cobre `conferirAlvo`/`lerEnv`,
  não a nova precedência.
- **Impacto**: baixo — o `conferirAlvo()` continua sendo a trava que importa, e ele tem teste. Mas
  "arquivo por cima do ambiente" é a regra que já custou caro nesta máquina (variável global do
  Windows com token de outra conta), e agora ela existe em três scripts com uma cópia da lógica cada:
  `db-push.mjs:30`, `vigia-de-jobs.mjs:52`, `advisors.mjs:95-98`.
- **Fix task**: extrair a precedência para uma função em `scripts/alvo-do-banco.mjs`, usada pelos
  três, com teste dos dois sentidos. Fecha a duplicação e o buraco de uma vez.

---

## Requirement Traceability Update

| Requisito / AC | Status anterior | Status novo |
| --- | --- | --- |
| INFRA-09 AC1 (erro front+servidor no Sentry, rota e release) | Implementing | ✅ Verificado na parte de código · alerta pendente de evidência ao vivo |
| INFRA-09 AC2 (falha de job visível e alertada) | Implementing | ✅ Verificado (⚠️ workflow nunca executou; `executar()` do vigia sem teste) |
| INFRA-09 AC3 (advisors como fonte complementar) | Implementing | ✅ Verificado, inclusive contra a API real |
| INFRA-10 (segredo fora do código, `.env.example` sem valor, CI reprova) | Implementing | ✅ Verificado |
| INFRA-11 AC6, parte "e SHALL alertar" (pendência da SPEC 02) | Pendente | ✅ Verificado |
| M9 §Assumptions (migração por Actions, prod exige merge) | Implementing | ⚠️ Verificado por leitura — nunca executou |
| Contrato da spec: erro sem dado pessoal | Implementing | ✅ Verificado (14 testes + 2 mutações mortas) |
| Contrato da spec: todo job novo entrega falha visível | Implementing | ✅ Mecanismo pronto e testado, herdado pela SPEC 06 (AD-088a) |
| AD-087 (a)…(f) | — | ✅ Todos com evidência. (g) região EUA: registrado, mitigado pelo saneamento na origem |
| AD-088 (a)(b)(c) | — | ✅ Todos com evidência |

**Success Criteria da spec:**

1. Erro proposital numa rota aparece no Sentry com alerta — parte de código ✅ (rota existe, porteiro
   funciona nos dois sentidos, `onRequestError` exportado, três `init` saneados, `beforeSend` remove
   dado pessoal); **evidência ao vivo — fornecida pelo orquestrador, ver adendo no fim do relatório**
2. `pg_cron` forçado a falhar dispara alerta — ⚠️ ✅ por proxy: a view e o vigia estão provados
   (`jobs-falhados.test.ts:46`, `vigia-de-jobs.test.ts:89`) semeando `cron.job_run_details`
   diretamente, em transação revertida. Nenhum job real foi agendado para quebrar — a spec não possui
   job nenhum (é da SPEC 06, AD-088), e o próprio teste declara essa escolha no cabeçalho
3. Config ilegível continua deixando a flag desligada **e** agora também alerta — ✅
   (`leitura.test.ts:212` + `tests/db/config-queda.test.ts`)
4. Tentativa de commitar segredo é reprovada pela CI — ✅ no script (provado ao vivo, `EXIT=1`);
   a palavra "pela CI" depende do push (Gap 4)

---

## Summary

**Geral**: ⚠️ **Pronto, com 1 linha pendente de evidência ao vivo e 7 gaps ranqueados — nenhum
bloqueante**

**Spec-anchored**: todos os AC de INFRA-09 (AC1/AC2/AC3) e INFRA-10 com `file:line` e expressão de
asserção. 6 critérios marcados ⚠️ (estrutural, por proxy, ou só ao vivo). 1 critério fora do alcance
de qualquer código — a regra de alerta no painel do Sentry.
**ASVS**: não aplicável (spec sem critérios `SEC-*`).
**Sensor**: 6 mutações injetadas, **6 mortas, 0 sobreviventes**.
**Gate**: 143 passaram, 0 falharam, 0 pulados. Build e lint verdes. +102 testes sobre os 41 anteriores.

**O que funciona**

- O ponto único de reporte existe, não importa o SDK, e **sanea antes de qualquer saída** — inclusive
  para o console, que é o caminho que na prática mais roda. As duas mutações que tentaram furar o
  saneamento morreram.
- Os três runtimes do Next inicializam com a mesma fonte testada de DSN/release/ambiente; sem replay,
  sem tracing, sem dado de usuário, sem corpo de requisição.
- A pendência que a SPEC 02 deixou (o "e SHALL alertar" do INFRA-11 AC6) está fechada **sem mudar a
  assinatura publicada** — provado pelos testes antigos passando sem edição e pelo teste novo que
  confere que `definirReporteDeErro` continua curto-circuitando o padrão.
- `pg_cron` instalado, view fechada para o navegador e `security_invoker`; o vigia lê a view de
  verdade (conferido ao vivo) e saneia o `return_message` no ponto em que o lê.
- A varredura de segredos saiu do YAML, ganhou 21 testes, tem 1 caso positivo por padrão, um teste
  negativo para o DSN público e um teste que varre o repositório inteiro **sem exceção** — e reprova
  de fato (`EXIT=1`, conferido ao vivo).
- Os advisors funcionam contra a API real e não acham nada novo por causa desta migração.
- A qualidade de comentário é alta e uniforme: quase todo bloco explica **por que**, com a AD ou o AC
  na mão.

**Problemas encontrados** (ordem de prioridade)

1. `executar()` do vigia sem teste automatizado — Major, fix task escrita (injetar `consultar`)
2. `sanitizar` achata `Date`/`Error`/`Map` em `{}` no ponto transversal do projeto — Major, fix task escrita
3. Desvio do "Done when" de T27 (job agregador × passo por job) não registrado — Minor
4. Nenhum workflow novo jamais executou — Minor, limitação de evidência
5. Privilégio da view provado por `grant` em vez de tentativa de leitura — Minor
6. 16 asserções sobre texto do fonte, não sobre comportamento — Minor, corrigir não vale o mock
7. Precedência `.env` × ambiente duplicada em três scripts, sem teste na cópia nova — Minor

**Próximos passos**

1. Anexar o adendo de evidência ao vivo (Success Criteria nº1).
2. Decidir sobre os gaps 1 e 2 antes do merge — os dois são de meia hora e o gap 2 fica mais caro a
   cada spec que passar a usar `reportarErro`.
3. Gaps 3 e 5: uma linha de documento e um teste; podem entrar no mesmo commit de correção.
4. Empurrar a branch e conferir os quatro workflows na execução real (Gap 4).
5. Gaps 6 e 7 podem virar dívida registrada.

---

## Adendo — evidência ao vivo

<!-- ADENDO -->
