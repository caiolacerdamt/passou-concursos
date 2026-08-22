# Otimização dos testes de banco — Validação

**Veredito**: ✅ PASS
**Data**: 2026-08-22
**Spec**: `docs/superpowers/specs/2026-08-22-otimizacao-testes-db-design.md`
**Decisão**: `.specs/STATE.md` — AD-104
**Diff**: `main..HEAD` (`6159981..51eacd6`)
**Verifier**: subagente independente, autor ≠ verificador

## Critérios de aceite

| # | Resultado esperado | Evidência `file:line` + expressão de assertion | Resultado |
| - | ------------------ | ---------------------------------------------- | --------- |
| 1 | Dois usos consecutivos mantêm o PID; cliente liberado rejeita consulta | `tests/db/conexao.test.ts:20` — `await expect(clienteUsado!.query("select 1")).rejects.toThrow()`; `tests/db/conexao.test.ts:33` — `expect(segundoPid).toBe(primeiroUso.pid)` | ✅ PASS |
| 2 | Falha do callback ainda executa `ROLLBACK` | `tests/db/conexao.test.ts:44` — `.rejects.toThrow("falha proposital depois do insert")`; `tests/db/conexao.test.ts:54` — `expect(quantidade).toBe(0)` | ✅ PASS |
| 3 | Projeto `db` permanece sequencial e compartilha módulos | `scripts/testes-db-config.test.ts:14` — `expect(config).toContain("fileParallelism: false")`; `scripts/testes-db-config.test.ts:15` — `expect(config).toContain("isolate: false")`; `scripts/testes-db-config.test.ts:16` — `expect(config).toContain('runner: "tests/db/runner.ts"')` | ✅ PASS |
| 4 | App e banco rodam em jobs distintos | `scripts/ci.test.ts:19` — `expect(app).toContain("run: npm run build")`; `scripts/ci.test.ts:21` — `expect(app).toContain("run: npm run test:unit")`; `scripts/ci.test.ts:22` — `expect(app).not.toContain("test:db")`; `scripts/ci.test.ts:31` — `expect(db).toContain("run: npm run test:db")`; `scripts/ci.test.ts:33` — `expect(gate).toContain("needs: [app, db]")` | ✅ PASS |
| 5 | Execução obsoleta é cancelada e jobs DB não concorrem | `scripts/ci.test.ts:38` — `expect(workflow).toContain("group: ci-...")`; `scripts/ci.test.ts:40` — `expect(workflow).toContain("cancel-in-progress: true")`; `scripts/ci.test.ts:29` — `expect(db).toContain("group: testes-banco-supabase-dev")`; `scripts/ci.test.ts:30` — `expect(db).toContain("cancel-in-progress: false")` | ✅ PASS |
| 6 | Log padrão da suíte informa usos e conexões físicas | `scripts/testes-db-config.test.ts:20` — `expect(pacote.scripts["test:db"]).toBe("vitest run --project db --disableConsoleIntercept")`; `scripts/testes-db-config.test.ts:23` — `expect(formatarResumoDasConexoes({ usos: 350, conexoes: 1 })).toBe("[db] usos_do_helper=350 conexoes_fisicas=1")` | ✅ PASS |

**Spec-anchored check**: 6/6 critérios têm assertions sobre o resultado definido pela spec. Não há gap de precisão.

## Gates independentes

| Gate | Resultado |
| ---- | --------- |
| `npm run test:unit` | ✅ 82 arquivos, 589 testes, 0 falhas, 0 pulos; 6,74 s |
| `npm run lint` | ✅ exit 0 na validação inicial |
| `npm run build` | ✅ build e TypeScript concluídos na validação inicial |
| `npm run test:db` | ✅ 42 arquivos, 348 testes, 0 falhas, 0 pulos; 72,88 s; última métrica `[db] usos_do_helper=350 conexoes_fisicas=1` |
| Comando oficial focal: `npm run test:db -- tests/db/conexao.test.ts` | ✅ 2/2; publicou `[db] usos_do_helper=4 conexoes_fisicas=1` sem flag adicional; 703 ms |
| YAML estrutural (`js-yaml`) | ✅ jobs e concorrências parseados com os valores esperados na validação inicial |

O gate completo de banco foi executado pelo orquestrador após o commit `51eacd6`. O verificador repetiu o teste unitário completo e o comando oficial de banco de forma focalizada.

## Sensor de discriminação

As mutações rodaram apenas em `.verifier-scratch`, uma cópia temporária removida ao final. O worktree real não foi modificado.

| Mutação | Resultado |
| ------- | --------- |
| Trocar `isolate: false` por `isolate: true` na cópia de `vitest.config.mts:43` | ✅ Morta por `expect(config).toContain("isolate: false")` |
| Remover `--disableConsoleIntercept` do `test:db` na cópia de `package.json:12` | ✅ Morta por `expect(pacote.scripts["test:db"]).toBe(...)` |

**Sensor da revalidação**: 2 mutações injetadas, 2 mortas, 0 sobreviventes.

**Sensor acumulado**: 5 mutações injetadas nas duas rodadas, 5 mortas, 0 sobreviventes.

**Isolamento**: `git status --porcelain=v1` antes e depois do sensor foi idêntico. Ambos continham somente o relatório não rastreado. Base64 antes/depois: `Pz8gZG9jcy9zdXBlcnBvd2Vycy9zcGVjcy8yMDI2LTA4LTIyLW90aW1pemFjYW8tdGVzdGVzLWRiLXZhbGlkYXRpb24ubWQ=`.

## Qualidade e conclusão

O commit `51eacd6` resolve os três gaps anteriores sem alterar o comportamento do pool. O comando oficial passou a liberar o console interceptado, o formato do resumo foi extraído para uma função pura testável e a configuração sequencial ganhou assertions de contrato. `tests/db/runner.ts` continua lendo o acumulado do mesmo módulo compartilhado e só publica quando houve uso.

**Overall**: ✅ Ready. Os 6 critérios estão cobertos, os gates passam e todas as mutações foram mortas. Não há gaps ranqueados.
