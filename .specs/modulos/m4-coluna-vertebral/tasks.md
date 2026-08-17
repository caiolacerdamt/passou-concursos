# M4 — Coluna Vertebral do Aluno · Tasks (rodada 1)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute
flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source
of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier,
discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/modulos/m4-coluna-vertebral/design.md`
**Spec**: `.specs/modulos/m4-coluna-vertebral/spec.md`
**Status**: Draft
**Depende de**: `.specs/modulos/m9-infra/tasks.md` — **T1…T9 precisam estar prontas**. T10 não começa
sem T9: o M4 lê 10 chaves da configuração e não existe `package.json` antes de T1.

> A numeração continua a do M9 de propósito. Aqui vão **T10…T22**.

---

## Test Coverage Matrix

> Idêntica à de `.specs/modulos/m9-infra/tasks.md` — a matriz é do projeto, não da feature.
> Diretrizes encontradas: `AGENTS.md`, `CLAUDE.md`, `docs/GITFLOW.md`. Nenhuma configuração de runner
> existia antes de T2, então os defaults fortes do skill se aplicam.

| Camada de código | Tipo de teste | Cobertura esperada | Padrão de local | Comando |
| --- | --- | --- | --- | --- |
| Migração SQL — schema, `CHECK`, gatilho, RLS, função plpgsql | integration (banco) | Todo AC da spec + todo edge case listado; a trava só-INSERT tem teste de recusa explícito | `tests/db/*.test.ts` | `npm run test:db` |
| Módulo de domínio TS (`modules/aluno/*`) | unit | Todos os ramos; 1:1 com os AC; todo edge case listado | `src/modules/**/*.test.ts` | `npm run test:unit` |
| Script de job (`scripts/jobs/*`) | unit | Caminho feliz + falha do provedor de IA + falha de rede | `scripts/**/*.test.ts` | `npm run test:unit` |
| Configuração do projeto | none | — (gate de build) | — | gate de build |

## Parallelism Assessment

| Tipo de teste | Paralelizável? | Modelo de isolamento | Evidência |
| --- | --- | --- | --- |
| unit | **Sim** | sem estado compartilhado | módulos puros, sem rede |
| integration (banco) | **Não** | um banco só, compartilhado por todos os arquivos | `vitest.config.ts` com `fileParallelism: false` (T2) |

**Consequência:** nenhuma task com teste de banco leva `[P]`. Nesta feature isso é quase todas.

## Gate Check Commands

| Nível | Quando usar | Comando |
| --- | --- | --- |
| Quick | task só com teste unit | `npm run test:unit` |
| Full | task com teste de banco | `npm test` |
| Build | fim de fase | `npm run build && npm run lint && npm test` |

---

## Execution Plan

### Fase 2: Fundação do log (sequencial) — ALUNO-01, ALUNO-04, INFRA-04

```
T9 (M9) → T10 → T11 → T12 → T13
                  └──→ T14
```

### Fase 3: Registro da resposta (sequencial) — ALUNO-01, ALUNO-03

```
T13, T14 → T15
```

### Fase 4: Projeções e revisão (sequencial) — ALUNO-02, ALUNO-06, ALUNO-09, ALUNO-10

```
T15 → T16 → T17
        └──→ T18
```

### Fase 5: Plano do dia (sequencial) — ALUNO-05, ALUNO-07, ALUNO-08, ALUNO-11, ALUNO-12

```
T17, T18 → T19 → T20 → T21 → T22
```

---

## Task Breakdown

### T10: Enums de domínio e tabelas mínimas de questão

**What**: criar os tipos do domínio e as tabelas mínimas que `tentativas` referencia — `materias`,
`topicos` e uma `questoes` reduzida ao contrato do AD-039/AD-040.
**Where**: `supabase/migrations/<ts>_dominio_minimo.sql`, `tests/db/dominio-minimo.test.ts`
**Depends on**: T9 (M9)
**Reuses**: contratos AD-039/AD-040 (M1) — copiar o contrato, não inventar colunas
**Requirement**: ALUNO-01 (pré-requisito do snapshot) · AD-039 · AD-040

**Tools**:

- MCP: `supabase-passou` (`apply_migration`, `list_tables`)
- Skill: NONE

**Done when**:

- [ ] Enums `contexto_tentativa`, `causa_erro`, `causa_origem`, `tipo_questao`, `origem_questao`
      existem com **exatamente** os valores das specs (a lista de `causa_erro` é a do ALUNO-04 AC2:
      as 6 + `nao_sei_dizer` + `faltou_tempo`)
- [ ] `materias` e `topicos` existem, mínimas, com `id` e rótulo
- [ ] `questoes` existe **mínima**, com `id`, `versao`, `topico_id`, `tipo_questao`, `origem`,
      `dificuldade`, `anulada` — o M1 completa depois, sem quebrar este contrato
- [ ] Um comentário em SQL na migração diz que estas tabelas são **stubs do M1** e quem as completa
- [ ] Gate: `npm test`
- [ ] Contagem: **+3** testes (total ≥ 33)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): cria enums e tabelas minimas do dominio`

---

### T11: Tabela `tentativas` particionada, com snapshot e validações

**What**: a tabela do fato cru, particionada por `respondida_em`, com os índices e todos os `CHECK`
do design.
**Where**: `supabase/migrations/<ts>_tentativas.sql`, `tests/db/tentativas-schema.test.ts`
**Depends on**: T10
**Reuses**: SQL do design (`m4-coluna-vertebral/design.md` §Data Models) — copiar de lá
**Requirement**: ALUNO-01 (AC2, AC3, AC4, AC5) · ALUNO-04 (AC2) · INFRA-04 (AC4) · AD-042

**Tools**:

- MCP: `supabase-passou` (`apply_migration`, `execute_sql`)
- Skill: NONE

**Done when**:

- [ ] A tabela existe `partition by range (respondida_em)`, PK `(id, respondida_em)`
- [ ] Todas as colunas de snapshot do AC2 existem, **id e rótulo** para matéria e tópico
- [ ] `CHECK resposta_valida` recusa letra fora do tipo (A–E para múltipla, C/E para certo-errado)
- [ ] `CHECK causa_obrigatoria_no_treino` recusa erro no treino sem causa
- [ ] `CHECK causa_so_com_erro` recusa causa em resposta certa
- [ ] `CHECK faltou_tempo_so_no_simulado` recusa `faltou_tempo` nesta tabela
- [ ] `CHECK dificuldade_1_a_5`
- [ ] Os 4 índices do design existem (AC4 do INFRA-04)
- [ ] Teste do AC3: gravar tentativa, **reclassificar o tópico da questão** e confirmar que
      `topico_rotulo` e `topico_id` da tentativa **não mudaram**
- [ ] Gate: `npm test`
- [ ] Contagem: **+7** testes (total ≥ 40)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): cria o log tentativas particionado com snapshot congelado`

---

### T12: Trava do só-INSERT em duas camadas + RLS

**What**: `REVOKE` + RLS (camada 1) e gatilho de bloqueio com porta nomeada de esquecimento
(camada 2).
**Where**: `supabase/migrations/<ts>_tentativas_trava.sql`, `tests/db/tentativas-trava.test.ts`
**Depends on**: T11
**Reuses**: SQL do design §A trava do só-INSERT
**Requirement**: ALUNO-01 (AC1) — **Independent Test da spec** · **AD-082** · AD-015

**Tools**:

- MCP: `supabase-passou` (`apply_migration`, `execute_sql`, `get_advisors` para conferir RLS)
- Skill: NONE

**Done when**:

- [ ] UPDATE recusado para `authenticated`
- [ ] UPDATE recusado **também** para o papel de serviço — é a razão de existir a camada 2 (AD-082)
- [ ] DELETE recusado quando a sessão **não** declarou `app.esquecimento_user_id`
- [ ] DELETE **permitido** quando a sessão declara o `user_id` correto (a porta do M7/AD-029)
- [ ] DELETE recusado quando a sessão declara o `user_id` de **outro** aluno
- [ ] RLS: o aluno lê só as próprias linhas; INSERT só com `user_id = auth.uid()`
- [ ] **Verificar e registrar** se o gatilho de linha propaga da tabela-pai para as partições
      (pergunta aberta do design §Data Models). Se não propagar, criar por partição via template do
      `pg_partman` e registrar o achado no `.specs/STATE.md` como nota do handoff
- [ ] Gate: `npm test`
- [ ] Contagem: **+7** testes (total ≥ 47)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): trava o log contra update e delete acidental`

---

### T13: Particionamento mensal por `pg_partman` — INFRA-04

**What**: ligar o `pg_partman` na `tentativas`, com 3 meses pré-criados, e provar o partition pruning.
**Where**: `supabase/migrations/<ts>_tentativas_partman.sql`, `tests/db/tentativas-particao.test.ts`
**Depends on**: T12
**Reuses**: SQL do design do M9 §Particionamento (`m9-infra/design.md`)
**Requirement**: **INFRA-04** (AC1, AC2, AC3) · AD-067 (partição nunca é dropada)

**Tools**:

- MCP: `supabase-passou` (`apply_migration`, `execute_sql`, `list_extensions`)
- Skill: NONE

**Done when**:

- [ ] Extensão `pg_partman` instalada no schema `partman`
- [ ] `create_parent` configurado com `p_interval := '1 month'`, `p_premake := 3`
- [ ] A partição do **mês seguinte** existe antes de o mês virar (AC3)
- [ ] INSERT com `respondida_em` de meses diferentes cai em partições diferentes (AC1)
- [ ] `EXPLAIN` de uma consulta por `user_id` + período mostra **pruning para uma partição só**,
      sem varredura da tabela inteira (AC2 — **Independent Test do INFRA-04**)
- [ ] A retenção do partman está desligada — **partição nunca é dropada** (AD-067)
- [ ] Gate: `npm test`
- [ ] Contagem: **+3** testes (total ≥ 50)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m9): particiona tentativas por mes com pg_partman`

---

### T14: Sessão, itens da sessão e causa do simulado

**What**: as tabelas mutáveis que cercam o log — a sessão, seus itens (que fazem o dedup) e a tabela
vizinha que recebe a causa do simulado.
**Where**: `supabase/migrations/<ts>_sessoes.sql`, `tests/db/sessoes.test.ts`
**Depends on**: T11
**Reuses**: SQL do design §Sessão e §Causa do simulado
**Requirement**: ALUNO-04 (AC3) · edge case do duplo-clique · AD-043

**Tools**:

- MCP: `supabase-passou` (`apply_migration`)
- Skill: NONE

**Done when**:

- [ ] `sessoes` e `sessao_itens` existem com `unique (sessao_id, ordem)`
- [ ] `tentativa_causa_simulado` existe com `unique (tentativa_id)` e carrega `respondida_em` para
      fechar a referência à partição
- [ ] `tentativa_causa_simulado` **aceita** `faltou_tempo` — é o único lugar onde esse valor entra
- [ ] Gravar causa de simulado **não** toca a tentativa original (ALUNO-04 AC3): teste compara a
      linha antes e depois
- [ ] Sair no meio da sessão deixa itens com `respondido_em` nulo e **não** desfaz nada (edge case)
- [ ] Gate: `npm test`
- [ ] Contagem: **+4** testes (total ≥ 54)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): cria sessao, itens e causa do simulado`

---

### T15: `registrarTentativa` — gravar a resposta com dedup

**What**: a função TypeScript que grava uma resposta como linha permanente, com snapshot congelado e
dedup por `UPDATE` condicional em `sessao_itens`.
**Where**: `src/modules/aluno/tentativas/registrar.ts`, `src/modules/aluno/tentativas/index.ts`,
`src/modules/aluno/tentativas/registrar.test.ts`, `tests/db/registrar-tentativa.test.ts`
**Depends on**: T13, T14
**Reuses**: `modules/config` (T7) para `param.m4.dias_sem_repetir_questao`; cliente Supabase de `src/lib/db/`
**Requirement**: ALUNO-01 (AC2) · ALUNO-03 (AC1, AC2, AC4) · edge cases do duplo-clique, da resposta
inválida e de sair no meio

**Tools**:

- MCP: NONE (usa a conexão de teste de T3)
- Skill: NONE

**Done when**:

- [ ] Grava a tentativa com **todo** o snapshot lido de `questoes` no momento da resposta
- [ ] Dedup: dois cliques na mesma resposta produzem **uma** tentativa; a segunda chamada devolve a
      existente sem inserir (edge case do duplo-clique)
- [ ] Erro no **treino** sem `causa_erro` é **recusado antes do INSERT**, com mensagem própria
      (ALUNO-03 AC1)
- [ ] `nao_sei_dizer` é aceito como causa válida (ALUNO-03 AC4)
- [ ] `contexto='diagnostico'` grava **sem** pedir causa (ALUNO-05 AC2)
- [ ] `contexto='simulado'` grava sem pedir causa e **não** interrompe (ALUNO-04 AC3 / P3 AC1)
- [ ] Resposta fora do conjunto válido é recusada (o `CHECK` de T11 é a rede; o módulo recusa antes)
- [ ] `causa_origem` é gravada como `'aluno'` quando a causa vem do aluno
- [ ] Gate: `npm test`
- [ ] Contagem: **+8** testes (total ≥ 62)

**Tests**: unit + integration (banco)
**Gate**: full

**Commit**: `feat(m4): registra tentativa com snapshot e dedup`

---

### T16: Tabelas de projeção e de agenda de revisão

**What**: as quatro tabelas da camada 2 — `dominio_topico`, `caderno_erros`, `revisao_agenda`,
`revisao_evento`.
**Where**: `supabase/migrations/<ts>_projecoes.sql`, `tests/db/projecoes-schema.test.ts`
**Depends on**: T15
**Reuses**: SQL do design §Projeções
**Requirement**: ALUNO-02 (AC1) · ALUNO-09 (AC1) · ALUNO-10 (AC1) · AD-044

**Tools**:

- MCP: `supabase-passou` (`apply_migration`)
- Skill: NONE

**Done when**:

- [ ] As quatro tabelas existem com as chaves primárias do design
- [ ] `revisao_evento` é append-only (mesma trava de T12, sem porta de esquecimento própria — o
      DELETE por `user_id` do M7 continua possível)
- [ ] `revisao_evento` guarda **percentual e nota** — é o que permite recalibrar a conversão depois
      (risco registrado no design)
- [ ] `revisao_agenda.algoritmo` aceita `'fsrs'` e `'regua_fixa'`, e `due` é a **mesma coluna** nos
      dois casos (ALUNO-09 AC4: trocar não migra dado)
- [ ] Gate: `npm test`
- [ ] Contagem: **+2** testes (total ≥ 64)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): cria as tabelas de projecao e a agenda de revisao`

---

### T17: `recalcula_projecoes()` — reconstruir tudo a partir do log

**What**: a função SQL idempotente que reconstrói `dominio_topico` e `caderno_erros` a partir de
`tentativas`.
**Where**: `supabase/migrations/<ts>_recalcula_projecoes.sql`, `tests/db/recalcula-projecoes.test.ts`
**Depends on**: T16
**Reuses**: design §`recalcula_projecoes()`
**Requirement**: ALUNO-02 (AC1, AC3, AC4) — **Independent Test da spec** · ALUNO-06 · ALUNO-10 (AC1)

**Tools**:

- MCP: `supabase-passou` (`apply_migration`, `execute_sql`)
- Skill: NONE

**Done when**:

- [ ] **Independent Test do ALUNO-02**: apagar as duas projeções inteiras, rodar a função e obter
      **os mesmos números**
- [ ] Idempotente: rodar duas vezes seguidas não muda o resultado (AC4)
- [ ] `marcou_chute = true` que **acertou** é descontado do domínio seguro (AC3)
- [ ] Questão `anulada` **não** entra na conta (AC3)
- [ ] `caderno_erros` agrupa por tópico **e** por causa, sobre `correta = false` (ALUNO-10 AC1)
- [ ] `pg_advisory_lock` impede duas execuções sobrepostas (edge case do M9)
- [ ] Falha no meio deixa a projeção **defasada, não corrompida** (AC4) — teste força erro e confere
      que os números anteriores continuam consistentes
- [ ] Gate: `npm test`
- [ ] Contagem: **+7** testes (total ≥ 71)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): recalcula as projecoes a partir do log`

---

### T18: `agendarRevisao` — FSRS com régua fixa como plano B

**What**: a função TypeScript que converte o desempenho de um bloco Revisar em data da próxima
revisão, por FSRS ou pela régua fixa, escolhido por configuração.
**Where**: `src/modules/aluno/revisao/agendar.ts`, `src/modules/aluno/revisao/index.ts`,
`src/modules/aluno/revisao/agendar.test.ts`, `tests/db/agendar-revisao.test.ts`
**Depends on**: T16
**Reuses**: `ts-fsrs` (`fsrs()`, `createEmptyCard()`, `scheduler.next()`); `modules/config` (T7) para
`param.m4.algoritmo_revisao` e `param.m4.fsrs_faixas_nota`
**Requirement**: ALUNO-09 (AC1, AC2, AC3, AC4) — **Independent Test da spec** · AD-072

**Tools**:

- MCP: NONE
- Skill: NONE
- Consultar **Context7** (`/open-spaced-repetition/ts-fsrs`) antes de escrever a chamada

**Done when**:

- [ ] **Independent Test do ALUNO-09**: aluno novo, sem histórico nenhum, já recebe intervalo do
      **FSRS** (não a régua fixa) — confirma o AD-072
- [ ] As 4 faixas de `param.m4.fsrs_faixas_nota` convertem percentual em `Rating` 1–4; cada faixa tem
      teste, incluindo as bordas
- [ ] Grava o `Card` novo e o `due` em `revisao_agenda`
- [ ] Registra `revisao_evento` com **percentual e nota**
- [ ] Trocar `param.m4.algoritmo_revisao` para `'regua_fixa'` faz a data sair de **1/3/7/14/30**, na
      **mesma coluna `due`** — e **nenhum agendamento existente se perde** (AC4, segunda metade do
      Independent Test)
- [ ] O contrato exposto ao motor continua sendo só "está devendo revisão ou não" (AC3) — nada além
      de `due` sai deste módulo
- [ ] `computeParameters` **não** entra nesta leva (fast-follow do AC5); a chave
      `param.m4.fsrs_limiar_otimizacao` existe no catálogo e nada a lê ainda
- [ ] Gate: `npm test`
- [ ] Contagem: **+8** testes (total ≥ 79)

**Tests**: unit + integration (banco)
**Gate**: full

**Commit**: `feat(m4): agenda revisao por fsrs com regua fixa como plano b`

---

### T19: Perfil de estudo, plano e a view stub do Raio-X

**What**: as tabelas do plano (`perfil_estudo`, `plano_dia`, `plano_bloco`) e a view stub que o M5
substitui depois.
**Where**: `supabase/migrations/<ts>_plano.sql`, `tests/db/plano-schema.test.ts`
**Depends on**: T17, T18
**Reuses**: design §Plano, §`perfil_estudo`, §Contrato com o M5
**Requirement**: ALUNO-05 (AC1) · ALUNO-11 · AD-044 · AD-056/AD-057 (assinatura da view)

**Tools**:

- MCP: `supabase-passou` (`apply_migration`)
- Skill: NONE

**Done when**:

- [ ] `perfil_estudo` existe com `nivel_declarado` restrito a
      `iniciante|intermediario|avancado` e `minutos_por_dia not null` (ALUNO-05 AC1: declarar o nível
      é o caminho de quem pula o diagnóstico)
- [ ] `plano_dia` com `unique (user_id, data)` e `frase` **anulável** (ALUNO-05 AC4 / ALUNO-12)
- [ ] `plano_bloco` com `nivel ∈ {piso, meta_cheia}`, `ordem`, `motivo` e
      `unique (plano_dia_id, nivel, ordem)` (ALUNO-11)
- [ ] View `raiox_peso_topico` devolve `1.0` para todo tópico, com um comentário SQL dizendo que o M5
      a substitui **mantendo a assinatura**
- [ ] Gate: `npm test`
- [ ] Contagem: **+3** testes (total ≥ 82)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): cria perfil de estudo, plano do dia e o stub do raio-x`

---

### T20: `gera_plano_do_dia()` — o motor de prioridade

**What**: a função SQL que monta o plano de cada aluno ativo por regra: nota do tópico, corte por
tempo, blocos e os dois níveis.
**Where**: `supabase/migrations/<ts>_gera_plano_do_dia.sql`, `tests/db/gera-plano.test.ts`
**Depends on**: T19
**Reuses**: design §`gera_plano_do_dia()`; view `raiox_peso_topico` (T19); `revisao_agenda` (T16)
**Requirement**: ALUNO-07 · ALUNO-08 · ALUNO-11 — **Independent Test da spec** · edge cases do acervo
frio e do retrato frio

**Tools**:

- MCP: `supabase-passou` (`apply_migration`, `execute_sql`)
- Skill: NONE

**Done when**:

- [ ] A nota do tópico é `peso_raiox × fraqueza × devendo_revisao`, com `peso_raiox` vindo da view e
      `devendo_revisao` usando `param.m4.peso_devendo_revisao` (ALUNO-07 AC2)
- [ ] A escolha é **só regra/SQL** — nenhuma chamada de IA nesta função (ALUNO-07 AC1, invariante #6)
- [ ] **Independent Test**: com um retrato semeado, saem blocos Revisar/Avançar/Treinar cabendo no
      `minutos_por_dia` declarado, com `piso` e `meta_cheia` **distintos**
- [ ] `piso` contém **só** as revisões devidas (ALUNO-11)
- [ ] `plano_bloco.motivo` traz o porquê quando a revisão manda revisar em vez de avançar
      (ALUNO-08 AC5)
- [ ] Edge case: tópico **sem questão publicada** é pulado e o motor pega o próximo de maior nota
- [ ] Edge case: **retrato frio** (aluno recém-criado, só com `nivel_declarado`) ainda gera plano do
      1º dia (ALUNO-05, Independent Test)
- [ ] Idempotente: rerodar no mesmo dia **substitui** o plano, não duplica (`unique (user_id, data)`)
- [ ] Bloco `simulado` não é gerado enquanto `flag.m4.simulado_semanal` estiver desligada (P3)
- [ ] Gate: `npm test`
- [ ] Contagem: **+9** testes (total ≥ 91)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): gera o plano do dia por regra`

---

### T21: Agendar os dois jobs no `pg_cron`

**What**: registrar `recalcula_projecoes()` às 06:00 UTC e `gera_plano_do_dia()` às 06:30 UTC.
**Where**: `supabase/migrations/<ts>_cron.sql`, `tests/db/cron.test.ts`
**Depends on**: T20
**Reuses**: design §Fluxos/Madrugada
**Requirement**: ALUNO-02 (AC2) · ALUNO-07 (AC1) · INFRA-03 (parte consumida pelo M4)

**Tools**:

- MCP: `supabase-passou` (`apply_migration`, `execute_sql`, `list_extensions`)
- Skill: NONE

**Done when**:

- [ ] Extensão `pg_cron` habilitada
- [ ] Os dois jobs existem em `cron.job` nos horários do design (06:00 e 06:30 UTC = 03:00 e 03:30 BRT)
- [ ] Cada job toma `pg_advisory_lock` e sai sem erro se o anterior ainda estiver rodando
- [ ] Gate: `npm test`
- [ ] Contagem: **+2** testes (total ≥ 93)

**Tests**: integration (banco)
**Gate**: full

**Commit**: `feat(m4): agenda os jobs de projecao e de plano no pg_cron`

---

### T22: `frase-do-plano.ts` — a única chamada de IA do módulo

**What**: o script do GitHub Actions que escreve a frase de abertura de cada plano recém-gerado, e o
workflow que o dispara.
**Where**: `scripts/jobs/frase-do-plano.ts`, `scripts/jobs/frase-do-plano.test.ts`,
`.github/workflows/frase-do-plano.yml`
**Depends on**: T21
**Reuses**: `modules/config` (T7) para a matriz de modelos; design §`scripts/jobs/frase-do-plano.ts`
**Requirement**: ALUNO-12 · ALUNO-05 (AC4) · **AD-080** · AD-036 (trabalho longo fora do serverless)

**Tools**:

- MCP: NONE
- Skill: NONE
- Consultar **Context7** (SDK da OpenAI) antes de escrever a chamada

**Done when**:

- [ ] O script lê os planos do dia sem frase e escreve **uma** frase por aluno
- [ ] A chamada é **síncrona, não Batch** (AD-080) — o teste prova que o caminho de Batch não é usado
- [ ] Falha da IA em um aluno deixa `frase = null` e **não** derruba os outros nem o plano
      (ALUNO-05 AC4, invariante #7)
- [ ] Falha de rede é tratada e reportada, sem retry infinito
- [ ] O nome do modelo **não está no código** — vem da configuração (proibição do AGENTS.md)
- [ ] O workflow do GitHub Actions roda às 07:00 UTC, **depois** dos dois jobs SQL
- [ ] O workflow não roda em PR — só no agendamento e no disparo manual
- [ ] Gate: `npm test`
- [ ] Contagem: **+4** testes (total ≥ 97)

**Tests**: unit
**Gate**: full

**Commit**: `feat(m4): escreve a frase de abertura do plano do dia`

---

## Parallel Execution Map

```
Fase 2:
  T9 (M9) ──→ T10 ──→ T11 ──┬──→ T12 ──→ T13
                            └──→ T14

Fase 3:
  T13, T14 ──→ T15

Fase 4:
  T15 ──→ T16 ──┬──→ T17
                └──→ T18

Fase 5:
  T17, T18 ──→ T19 ──→ T20 ──→ T21 ──→ T22
```

Nenhuma task leva `[P]`. T12/T14 e T17/T18 são independentes entre si em código, mas o teste de banco
compartilha um banco só — a Parallelism Assessment manda rodar em sequência.

---

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T10 | 1 migração (enums + 3 tabelas stub coesas) | ⚠️ 3 tabelas mínimas na mesma migração — coeso, aceitável |
| T11 | 1 migração, 1 tabela | ✅ Granular |
| T12 | 1 migração (trava + RLS da mesma tabela) | ✅ Granular |
| T13 | 1 migração | ✅ Granular |
| T14 | 1 migração (3 tabelas da mesma fronteira) | ⚠️ coeso, aceitável |
| T15 | 1 função | ✅ Granular |
| T16 | 1 migração (4 tabelas da mesma camada) | ⚠️ coeso, aceitável |
| T17 | 1 função SQL | ✅ Granular |
| T18 | 1 função | ✅ Granular |
| T19 | 1 migração (3 tabelas + 1 view) | ⚠️ coeso, aceitável |
| T20 | 1 função SQL | ✅ Granular |
| T21 | 1 migração | ✅ Granular |
| T22 | 1 script + 1 workflow | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends on (corpo) | Diagrama mostra | Status |
| --- | --- | --- | --- |
| T10 | T9 (M9) | T9 → T10 | ✅ |
| T11 | T10 | T10 → T11 | ✅ |
| T12 | T11 | T11 → T12 | ✅ |
| T13 | T12 | T12 → T13 | ✅ |
| T14 | T11 | T11 → T14 | ✅ |
| T15 | T13, T14 | T13, T14 → T15 | ✅ |
| T16 | T15 | T15 → T16 | ✅ |
| T17 | T16 | T16 → T17 | ✅ |
| T18 | T16 | T16 → T18 | ✅ |
| T19 | T17, T18 | T17, T18 → T19 | ✅ |
| T20 | T19 | T19 → T20 | ✅ |
| T21 | T20 | T20 → T21 | ✅ |
| T22 | T21 | T21 → T22 | ✅ |

---

## Test Co-location Validation

| Task | Camada criada/modificada | Matriz exige | Task diz | Status |
| --- | --- | --- | --- | --- |
| T10 | migração SQL | integration | integration | ✅ |
| T11 | migração SQL | integration | integration | ✅ |
| T12 | migração SQL | integration | integration | ✅ |
| T13 | migração SQL | integration | integration | ✅ |
| T14 | migração SQL | integration | integration | ✅ |
| T15 | módulo TS | unit (+ integration p/ dedup) | unit + integration | ✅ |
| T16 | migração SQL | integration | integration | ✅ |
| T17 | migração SQL (função) | integration | integration | ✅ |
| T18 | módulo TS | unit (+ integration p/ persistência) | unit + integration | ✅ |
| T19 | migração SQL | integration | integration | ✅ |
| T20 | migração SQL (função) | integration | integration | ✅ |
| T21 | migração SQL | integration | integration | ✅ |
| T22 | script de job | unit | unit | ✅ |

---

## Requirement Traceability

| Requisito | Task | Cobertura |
| --- | --- | --- |
| ALUNO-01 | T11, T12 | **completa** |
| ALUNO-02 | T17, T21 | **completa** |
| ALUNO-03 | T11 (`CHECK`), T15 (recusa antes do INSERT) | **completa no servidor**; a tela é fase futura |
| ALUNO-04 | T10 (enum), T11 (`CHECK`), T14 (tabela vizinha) | **completa** |
| ALUNO-05 | T19 (`nivel_declarado`), T6 (flag), T20 (retrato frio), T15 (`contexto='diagnostico'`) | **parcial — ver lacunas abaixo** |
| ALUNO-06 | T17 (`dominio_topico` alimenta a calibração) | **parcial por desenho** — a calibração em si é M7 |
| ALUNO-07 | T20 | **completa** |
| ALUNO-08 | T20 | **completa** |
| ALUNO-09 | T16, T18 | **completa** (AC5, otimização por aluno, é fast-follow declarado) |
| ALUNO-10 | T16, T17 | **completa como projeção**; o filtro na tela é fase futura |
| ALUNO-11 | T19, T20 | **completa** |
| ALUNO-12 | T22 | **completa** |

### Lacunas: AC sem componente no design

Estas não viram task porque **o design da rodada 1 não desenhou componente para elas**. Não são
esquecimento — são escopo que ficou de fora e precisa voltar num Design posterior:

| AC descoberto | O que falta | Quando resolver |
| --- | --- | --- |
| **ALUNO-05 AC2** — diagnóstico de ~20 questões adaptativas | Nenhum componente no design escolhe as questões nem aplica o passo adaptativo. Fica atrás de `flag.m4.diagnostico_adaptativo = false` (AD-076), mas o AD-076 manda **construir** o que está desligado | Precisa do **M1** — sem acervo não há questão para aplicar. Entra no Design junto da superfície do diagnóstico |
| **ALUNO-05 AC3** — chamada de IA do "plano inicial pós-diagnóstico" | O design só tem `frase-do-plano.ts`, que é a **frase diária** (ALUNO-12). A spec (e o IA-02) descrevem uma **tarefa distinta** do gateway | Junto do AC2 acima, ou do Design do M2 |
| **Telas** — sessão de questões, plano do dia, caderno de erros, progresso | O design da rodada 1 não tem nenhuma tela. As regras estão no servidor; a superfície não | Depois do M1, quando houver questão para mostrar |

**Nenhuma dessas trava esta leva.** O que está aqui é a fundação: o log, as projeções, a agenda e o
plano. A superfície entra depois, e o AD-076 já diz quais nascem ligadas.

---

## Branches

`docs/GITFLOW.md` limita a branch a ~10 commits e 3 dias. 13 tasks = **quatro** branches:

| Branch | Tasks | PR |
| --- | --- | --- |
| `feat/m4-p1-log-tentativas` | T10…T14 | fundação do log + partição |
| `feat/m4-p1-registrar-tentativa` | T15 | registro da resposta |
| `feat/m4-p1-projecoes` | T16…T18 | projeções + agenda de revisão |
| `feat/m4-p1-plano-do-dia` | T19…T22 | plano + jobs + frase |
