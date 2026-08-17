# SPEC 05 — Log de tentativas · Tasks

**Design**: `.specs/features/05-log-de-tentativas/design.md` · **Spec**:
`.specs/features/05-log-de-tentativas/spec.md` · **Ritual**: **A**
**Branch**: `feat/m4-p1-log-tentativas` · **Numeração**: T41…T47 (continua a SPEC 04, que fechou em T40)

Gate de toda task com SQL: `npm test`. Gate de task só de TypeScript: `npm run test:unit`.
Fim da spec: `npm run build && npm run lint && npm test`.
Um commit atômico por task. Teste de banco roda em transação revertida — a tabela recusa DELETE.

## Ordem

```
T41 → T42 → T43 → T44 → T46
  └──→ T45 ──────────────┘
                          → T47
```

---

### T41 — Enums do log e a tabela `tentativas`

**Onde**: `supabase/migrations/<ts>_tentativas.sql`, `tests/db/tentativas-schema.test.ts`,
`tests/db/aluno.ts` · **Requisito**: ALUNO-01 AC2/AC3/AC4 · ALUNO-04 AC2 · INFRA-04 AC4 · AD-042/AD-043

- [ ] Enums `contexto_tentativa`, `causa_erro` (as 6 + `nao_sei_dizer` + `faltou_tempo`), `causa_origem`
- [ ] Tabela `partition by range (respondida_em)`, PK `(id, respondida_em)`, colunas de snapshot com **id e rótulo**
- [ ] FK para `questoes (id, questao_versao)`, `topicos (id)`, `materias (id)`; `user_id` **sem** FK
- [ ] Os 5 `CHECK` do design; os 4 índices do design
- [ ] `tests/db/aluno.ts` com fixtures no molde de `tests/db/acervo.ts`
- [ ] Teste: cada `CHECK` recusa o caso que existe para recusar
- [ ] Teste do AC3: gravar tentativa → renomear e mover o tópico da questão → rótulo e id da tentativa intactos

**Commit**: `feat(m4): cria o log tentativas particionado com snapshot congelado`

---

### T42 — Trava de 3 camadas, RLS e a porta do esquecimento

**Onde**: `supabase/migrations/<ts>_tentativas_trava.sql`, `tests/db/tentativas-trava.test.ts`
**Requisito**: ALUNO-01 AC1 (Independent Test) · AD-084 · AD-029 · AD-015

- [ ] `revoke update, delete, truncate` de `anon` e `authenticated`
- [ ] Gatilho `for each row` em `before update or delete` (com a porta do esquecimento) e gatilho
      `for each statement` em `before truncate`; ambas as funções com `set search_path = ''`
- [ ] RLS ligada; policy de SELECT e de INSERT por `auth.uid()`; **sem** policy de UPDATE/DELETE
- [ ] Teste: UPDATE recusado para `authenticated` **e** para o dono da tabela (a camada 2)
- [ ] Teste: TRUNCATE da tabela recusado
- [ ] Teste da porta: DELETE recusado sem declarar, recusado declarando outro aluno, **aceito** declarando o certo
- [ ] Teste de RLS: um aluno não enxerga a linha do outro; INSERT com `user_id` alheio é recusado

**Commit**: `feat(m4): trava o log contra update, delete e truncate`

---

### T43 — `pg_partman`: partição mensal, sem retenção, com pruning provado

**Onde**: `supabase/migrations/<ts>_tentativas_particao.sql`, `tests/db/tentativas-particao.test.ts`
**Requisito**: INFRA-04 AC1/AC2/AC3 · AD-067

- [ ] Extensão `pg_partman` no schema `partman`; `create_parent` na assinatura da 5.3.1 com
      `p_interval := '1 month'`, `p_premake := 3`, `p_default_table := true`, `p_jobmon := false`
- [ ] `part_config`: `retention` nula, `retention_keep_table` verdadeiro, `inherit_privileges` verdadeiro
- [ ] Teste: existem partições do mês corrente e de pelo menos os 3 seguintes, mais a *default*
- [ ] Teste: INSERT em meses diferentes cai em partições diferentes (`tableoid`)
- [ ] Teste: com `enable_seqscan = off`, `EXPLAIN` de consulta por `user_id` + período cita **uma** partição
- [ ] Teste: a retenção está desligada — partição nunca é dropada

**Commit**: `feat(m9): particiona tentativas por mes com pg_partman`

---

### T44 — Endurecer as partições e agendar a manutenção (AD-091)

**Onde**: `supabase/migrations/<ts>_tentativas_particao_endurecida.sql`,
`tests/db/tentativas-particao-endurecida.test.ts` · **Requisito**: ALUNO-01 AC1 · INFRA-04 AC3 · **AD-091**

- [ ] `public.endurecer_particoes_de_tentativas()`: por partição, `revoke all` de `anon`/`authenticated`,
      RLS ligada e gatilho `before truncate`; idempotente; `security definer` com `search_path` vazio
- [ ] Chamada no fim da própria migração, para as partições que já existem
- [ ] Job `pg_cron` diário: `run_maintenance_proc()` **e depois** o endurecimento
- [ ] Teste: nenhuma partição tem privilégio de `anon`/`authenticated`; todas com RLS e com o gatilho
- [ ] Teste: TRUNCATE **direto numa partição** é recusado (é o buraco que o AD-084 sozinho deixava)
- [ ] Teste: rodar a função duas vezes não erra e não duplica gatilho
- [ ] Teste: partição criada à mão sem proteção passa a estar protegida depois da função

**Commit**: `feat(m4): endurece cada particao do log contra leitura e truncate diretos`

---

### T45 — Sessão, itens da sessão e causa do simulado

**Onde**: `supabase/migrations/<ts>_sessoes.sql`, `tests/db/sessoes.test.ts`
**Requisito**: ALUNO-04 AC3 · edge case do duplo-clique · AD-043

- [ ] `sessoes` (sem `plano_dia_id` — é da SPEC 06) e `sessao_itens` com
      `unique (sessao_id, ordem)` e `unique (sessao_id, questao_id)`
- [ ] `tentativa_causa_simulado` com FK `(tentativa_id, respondida_em)` → `tentativas` e `unique (tentativa_id)`
- [ ] RLS por `auth.uid()` nas três; `revoke` do que o navegador não faz
- [ ] Teste: a tabela vizinha **aceita** `faltou_tempo` — é o único lugar onde esse valor entra
- [ ] Teste: gravar a causa do simulado não toca a linha da tentativa (compara antes e depois)
- [ ] Teste: sair no meio deixa item com `respondido_em` nulo e não desfaz tentativa nenhuma

**Commit**: `feat(m4): cria sessao, itens da sessao e causa do simulado`

---

### T46 — `registrarTentativa`

**Onde**: `src/modules/aluno/tentativas/{registrar.ts,contrato.ts,index.ts,registrar.test.ts}`,
`tests/db/registrar-tentativa.test.ts` · **Requisito**: ALUNO-01 AC2 · ALUNO-03 AC1/AC4

- [ ] Valida em memória **antes** de qualquer ida ao banco e levanta `TentativaRecusada` com motivo nomeado
- [ ] Dedup por `update sessao_itens ... where respondido_em is null`; devolve `duplicada: true` sem inserir
- [ ] Snapshot lido por join de `questoes`/`topicos`/`materias`/`provas` na versão vigente
- [ ] Passos 2–4 numa transação; INSERT que falha devolve o item ao estado de não respondido
- [ ] Teste unit: erro no treino sem causa é recusado sem tocar o banco; `nao_sei_dizer` aceito;
      `diagnostico` e `simulado` gravam sem causa; letra fora do tipo recusada; `faltou_tempo` recusado
- [ ] Teste de banco: duplo-clique produz **uma** tentativa; o snapshot gravado bate com a questão

**Commit**: `feat(m4): registra tentativa com snapshot congelado e dedup`

---

### T47 — Fechar a rodada

**Onde**: `.specs/STATE.md`, `.specs/ROADMAP.md`, `.specs/features/05-log-de-tentativas/validation.md`

- [ ] `AD-091` nova no fim de `## Decisions` do `STATE.md` (append-only)
- [ ] `## Handoff` reescrito: SPEC 05 concluída, as perguntas abertas do design respondidas com o que
      foi medido, contrato do `endurecer_particoes_*` para quem criar tabela particionada depois
- [ ] Linha da SPEC 05 no `ROADMAP.md`: status e número real de tasks
- [ ] `validation.md` escrito pelo **Verificador independente** (autor ≠ verificador), com AC por AC e
      sensor de mutação
- [ ] Gate final: `npm run build && npm run lint && npm test`

**Commit**: `docs(specs): fecha a spec 05 e registra a AD-091`

---

## Rastreabilidade

| Requisito | Task |
| --- | --- |
| ALUNO-01 AC1 | T42, T44 |
| ALUNO-01 AC2, AC3, AC4 | T41, T46 |
| ALUNO-01 AC5 | T43 |
| ALUNO-03 AC1, AC4 | T41 (rede), T46 (recusa antes) |
| ALUNO-04 AC2 | T41 |
| ALUNO-04 AC3 | T45 |
| INFRA-04 AC1, AC2 | T43 |
| INFRA-04 AC3 | T44 |
| INFRA-04 AC4 | T41 |
