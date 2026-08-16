# INFRA-11 — Relatório de verificação

**Veredito**: ✅ **PASS**
**Data**: 2026-08-16
**Escopo verificado**: `40508ba..61a2d92` (branch `feat/m9-infra11-configuracao`, tasks T5…T9)
**Gate**: `npm run build` ✓ · `npm run lint` ✓ · `npm test` → **41 passando, 0 falhando**

> A fase 0 (T1…T4, esqueleto) entrou pelo PR #9 e não é reverificada aqui: ela não tem AC de produto.

---

## 1. Cobertura ancorada na spec

Os critérios vêm de `.specs/features/m9-infra/spec.md` §"P1: Configuração e feature flags sem
deploy". Cada linha cita o `file:line` da asserção — sem citação, o critério conta como **não
coberto**.

| AC da spec | Evidência (`file:line` + asserção) | Resultado esperado pela spec | Coberto? |
| --- | --- | --- | --- |
| **AC1** — uma fonte só (tabela Postgres) para flag **e** parâmetro | `supabase/migrations/20260816212947_configuracoes.sql:24` — `check (chave ~ '^(flag\|param)\.m[1-9]\.[a-z0-9_]+$')` · `tests/db/configuracoes.test.ts:22` — insere `flag.m4.simulado` e `config.m4.simulado` e ambos são recusados; `flag.m4.simulado` válido entra | Uma tabela aceita os dois prefixos; nada fora deles | ✅ |
| **AC2** — env var só para o que precede o banco | `src/modules/config/leitura.test.ts:156` — `expect(readFileSync(arquivo,"utf8")).not.toContain("process.env")` nos três arquivos do módulo | Flag/parâmetro nunca vêm de variável de ambiente | ✅ *(lacuna achada nesta verificação e fechada — commit `61a2d92`)* |
| **AC3** — muda sem novo deploy | `tests/db/config-leitura.test.ts:33` — `expect(await getParam(chave)).toBe(20)` → INSERT → `toBe(25)` → INSERT → `toBe(35)`; e `isFlagOn` de `false` para `true` | Valor novo passa a valer sem build | ✅ |
| **AC4** — flag booleana e global, sem rollout %/segmentação/A-B | `src/modules/config/catalogo.test.ts:60` — para toda flag: `tipo.safeParse(50).success === false`, `safeParse("on") === false`, `safeParse({percentual:10}) === false` | Só `true`/`false` são aceitos | ✅ *(lacuna achada nesta verificação e fechada — commit `61a2d92`)* |
| **AC5** — cache curto, sem consultar o banco a cada verificação | `src/modules/config/leitura.test.ts:174` — `JANELA_DE_CACHE_SEGUNDOS === 30` e nenhuma chave de config casa `/cache\|ttl\|janela/` · `src/modules/config/leitura.test.ts:128` — `expect(chamadas).toHaveLength(1)` para três chaves | Janela curta, constante em código; leitura em lote num round-trip | ⚠️ **Parcial** — ver §4 |
| **AC6** — indisponível ⇒ default + alerta; flag ⇒ **desligada** | `tests/db/config-queda.test.ts:44` — `expect(await isFlagOn("flag.m4.caderno_erros")).toBe(false)` com o default declarado `true` · `:56` — `getParam` devolve 20/2/"fsrs" · `:71` — `expect(reportes).toHaveLength(2)` e `contexto.motivo === "falha ao ler a configuracao"` | Flag ilegível nunca liga superfície; parâmetro cai no default; alerta dispara | ✅ |
| **AC7** — quem, quando, valor anterior e novo; sem alteração anônima | `tests/db/config-escrita.test.ts:62` — `expect(rows.map(l=>l.valor)).toEqual([2,3])`, motivos na ordem, `alterado_por` igual ao autor, `alterado_em instanceof Date` · `src/modules/config/escrita.test.ts:91` — quatro formas de autor ausente, todas `rejects.toThrow(ConfiguracaoRecusada)` · `tests/db/config-escrita.test.ts:116` — FK recusa autor inexistente | Histórico sai da própria tabela; não existe alteração anônima | ✅ |
| **AC8** — dono declarado + default; sem chave órfã | `src/modules/config/catalogo.test.ts:15` — todo `padrao` valida contra o próprio `tipo` · `:24` — 10 chaves, todas com `moduloDono` e descrição · `tests/db/catalogo-sem-orfa.test.ts:11` — lê as chaves reais do banco **e** insere uma órfã em transação revertida para provar que o detector detecta | Nenhuma chave órfã | ✅ |

**Invariantes do `AGENTS.md` cobertos de tabela:** a trava só-INSERT tem teste de recusa explícito
para UPDATE (`tests/db/configuracoes.test.ts:103`), DELETE (`:122`) e TRUNCATE (`:141`), **inclusive
para o `service_role`**, e a RLS é provada por comparação — o servidor vê 1 linha, `anon` e
`authenticated` veem 0 (`:173`).

---

## 2. Sensor de discriminação

Quatro defeitos injetados em estado descartável, um de cada vez, com o teste rodado em seguida e a
mutação desfeita. Um defeito que sobrevive significa teste que não vale nada.

| # | Defeito injetado | Onde | Testes que falharam | Veredito |
| --- | --- | --- | --- | --- |
| 1 | `isFlagOn` cai no **default declarado** em vez de `false` quando a leitura falha | `src/modules/config/leitura.ts` | 2 | ☠️ morto |
| 2 | `setConfig` deixa de exigir autor | `src/modules/config/escrita.ts` | 1 | ☠️ morto |
| 3 | `chavesOrfas` sempre devolve `[]` | `src/modules/config/catalogo.ts` | 2 | ☠️ morto |
| 4 | A view devolve a **primeira** linha da chave em vez da última (`asc` no lugar de `desc`) | migração, aplicada no banco | 2 | ☠️ morto |

**4 de 4 mortos. Nenhum sobrevivente.** Banco e árvore de trabalho restaurados; `git status` limpo e
os 41 testes voltaram a passar depois da última reversão.

---

## 3. Achados que mudaram o código

Três divergências entre o Design (escrito antes do Execute) e o que a plataforma faz hoje. Todas
viraram código e duas viraram AD.

1. **`anon` e `authenticated` ficavam com `TRUNCATE`**, herdado do `alter default privileges` do
   Supabase, e **RLS não governa TRUNCATE** — a tabela append-only podia ser esvaziada inteira.
   Fechado com `revoke` + gatilho por comando. → **AD-084**. **A mesma lacuna existe no design de
   `tentativas` (AD-082) e precisa ser aplicada na T12.**
2. **`unstable_cache` só vale dentro de uma requisição do Next.** Job do GitHub Actions e script de
   linha de comando (AD-035/AD-036) rodam fora dela e leriam o **default do catálogo em silêncio**.
   O leitor padrão passa a cair para leitura direta. → **AD-085**.
3. **`revalidateTag` mudou de assinatura no Next 16** (exige o perfil de cache como segundo
   argumento). Corrigido para `revalidateTag(TAG_DE_CACHE, "max")`.

---

## 4. Lacunas assumidas

| Lacuna | Por quê fica | Onde fecha |
| --- | --- | --- |
| **AC5 parcial** — "SHALL NOT consultar o banco a cada verificação dentro da mesma requisição" não tem teste. O que existe prova a janela constante (30s) e o lote num round-trip, mas o cache dentro da requisição é o `unstable_cache` do Next, que só funciona **dentro** de uma requisição — e o Vitest roda fora | Testar isso exige subir o servidor Next e medir consultas por requisição: é teste de integração de app, não de módulo | Quando existir a primeira superfície logada (M4), num teste de rota |
| **Alerta ainda é `console.error`** | O Sentry é INFRA-09 e não entra nesta rodada | INFRA-09; o ponto de reporte já é único e injetável (`reportarFalhaDeConfig`) |
| **Testes de banco não rodam na CI** | O segredo `DATABASE_URL` ainda não está cadastrado no repositório; o passo pula com aviso em vez de reprovar | Pendência manual do dono do repositório |

Nenhuma lacuna esconde AC sem cobertura: as duas que a verificação encontrou (AC2 e AC4) foram
fechadas antes deste relatório, no commit `61a2d92`.
