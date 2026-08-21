# SPEC 11 — Tasks: Raio-X, frequência real, peso e tela

## Execution Protocol

Implementar estas tasks com a `tlc-spec-driven`: uma task por vez, teste derivado dos critérios da
SPEC, gate verde, status fechado no arquivo e um commit atômico por task. A validação final será feita
por Verifier independente, conforme o Ritual B da SPEC 11.

**Design embutido — Ritual B**

- `perfil_concurso` é um cadastro global multi-concurso. Só um perfil pode estar `ativo`.
- `programa_edital` é um array JSON de UUIDs de `topicos`; o pivot com citações fica para a SPEC 27.
- `raiox_projecoes` guarda uma linha por perfil e tópico do programa: taxa bruta, peso amortecido,
  `n_questoes`, `tendencia` e `amostra_baixa`.
- `recalcula_raiox(p_referencia)` lê somente questões reais, publicadas e vigentes. A taxa é participação
  por peso de ano, a amostra amortiza em direção à média e a tendência compara duas janelas configuradas.
- `banca='indefinida'` combina as bancas de `param.m5.bancas`. A classificação núcleo/condicional fica
  fora desta spec.
- A função usa `pg_try_advisory_xact_lock`, substitui a projeção dentro da transação e deixa a projeção
  anterior intacta quando falha. O job roda antes do plano do M4.
- `raiox_peso_topico` mantém `(topico_id, peso)`. Com perfil ativo, só tópicos do edital com peso positivo
  entram na view; fora do edital fica zero na projeção e não entra no plano. Sem perfil ativo, o fallback
  `1.0` preserva o contrato transitório da SPEC 06.
- A tela `/app/raio-x` exige matrícula, verifica `flag.m5.raiox` e lê somente a projeção pré-computada.
  Exibe tópico, peso, questões reais, tendência e `Baseado em poucas questões` quando aplicável.

**Status**: In Progress

## Test Coverage Matrix

> Guidelines encontradas: `AGENTS.md`, `docs/GITFLOW.md`, `package.json` e `vitest.config.mts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Configuração | unit | Todas as chaves M5, tipos, defaults e flag desligada | `src/modules/config/catalogo.test.ts` | `npm run test:unit` |
| Schema Supabase | integration | Campos, constraints, índice de perfil ativo, RLS e privilégios | `tests/db/raiox-schema.test.ts` | `npm run test:db` |
| Regra de frequência e job | integration | Critérios RAIOX-01/04/05/11/12/14 e edge cases do cálculo | `tests/db/raiox-recalculo.test.ts` | `npm run test:db` |
| View, cron e contrato do plano | integration | Assinatura, porteiro, idempotência, agenda e reordenação | `tests/db/raiox-view-cron.test.ts`, `tests/db/raiox-plano.test.ts` | `npm run test:db` |
| Leitura server-side | unit | DTO mínimo, ordenação e estado sem perfil | `src/modules/raiox/index.test.ts` | `npm run test:unit` |
| Componente de tela | unit | Campos visíveis, rótulo de amostra, tendência e vazio | `src/modules/raiox/tela.test.tsx` | `npm run test:unit` |
| Rota protegida | unit | Flag desligada, sem perfil e sucesso com matrícula | `src/app/app/raio-x/page.test.tsx` | `npm run test:unit` |

## Gate Check Commands

| Gate Level | Command |
| --- | --- |
| Quick | `npm run test:unit` |
| Full | `npm run test:unit` + `npm run test:db` |
| Build | `npm run lint` + `npm run test:unit` + `npm run test:db` + `npm run build` |

## Execution Plan

As fases são sequenciais e as tasks dentro de cada fase também.

### Phase 1: Foundation

```text
T1 → T2
```

### Phase 2: Core projection

```text
T3 → T4
```

### Phase 3: Surface

```text
T5 → T6 → T7
```

### Phase 4: Contract closure

```text
T8
```

### Phase dependency edges

```text
T2 → T3
T3 → T5
T4 → T5
T4 → T8
T7 → T8
```

## Task Breakdown

### T1: Cadastrar configuração do M5

**What**: Adicionar as chaves tipadas do Raio-X e a flag global da tela ao catálogo existente.
**Where**: `src/modules/config/catalogo.ts`
**Depends on**: None
**Requirement**: RAIOX-11, RAIOX-12, RAIOX-14
**Tools**: MCP: none · Skill: `tlc-spec-driven`
**Done when**:

- [ ] `flag.m5.raiox` nasce `false`.
- [ ] Decaimento, amortecimento, piso e duas janelas de tendência têm tipo, default e descrição.
- [ ] O teste do catálogo confirma formato, default e ausência de chave órfã em código.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(m5): cadastra configuracao do raio-x`
**Status**: ✅ Done — unit gate verde

### T2: Criar schema do perfil e da projeção

**What**: Criar as tabelas, enum de tendência, constraints, índice de perfil ativo e proteção RLS.
**Where**: `supabase/migrations/20260821100000_raiox_schema.sql`
**Depends on**: T1
**Requirement**: RAIOX-08, RAIOX-05
**Tools**: MCP: none · Skill: `tlc-spec-driven`
**Done when**:

- [ ] `perfil_concurso` aceita banca `indefinida`, programa JSON, `data_prova` nula e mais de um registro.
- [ ] No máximo um perfil fica ativo; `raiox_projecoes` guarda os campos da leitura e a enumeração exigida.
- [ ] Cliente anônimo/autenticado não lê nem escreve as tabelas; o serviço continua podendo operar.

**Tests**: integration
**Gate**: full
**Commit**: `feat(m5): cria schema do perfil e da projecao`
**Status**: ⬜ Pending

### T3: Implementar o recálculo idempotente do Raio-X

**What**: Implementar `recalcula_raiox(p_referencia)` com taxa real, decaimento, tendência e amortecimento.
**Where**: `supabase/migrations/20260821101000_raiox_recalculo.sql`
**Depends on**: T2
**Requirement**: RAIOX-01, RAIOX-04, RAIOX-05, RAIOX-11, RAIOX-12, RAIOX-14
**Tools**: MCP: none · Skill: `tlc-spec-driven`
**Done when**:

- [ ] Só questão real, publicada e vigente entra; inédita não entra; anulada conta; versões antigas não somam.
- [ ] A taxa é participação, o ano recente pesa mais e nenhum ano é cortado.
- [ ] Amostra baixa é amortizada para a média, tópico sem questão recebe a média, e tendência tem três valores.
- [ ] A função usa trava, substitui sem duplicar, recalcula perfis e falha sem corromper a projeção anterior.

**Tests**: integration
**Gate**: full
**Commit**: `feat(m5): calcula frequencia real do raio-x`
**Status**: ⬜ Pending

### T4: Ligar view, porteiro e agendamento

**What**: Substituir a view stub mantendo a assinatura, excluir peso zero do plano e agendar o job antes do M4.
**Where**: `supabase/migrations/20260821102000_raiox_integracao.sql`
**Depends on**: T3
**Requirement**: RAIOX-03, RAIOX-14
**Tools**: MCP: none · Skill: `tlc-spec-driven`
**Done when**:

- [ ] `raiox_peso_topico` continua com exatamente `topico_id, peso`.
- [ ] Fora do programa não entra na view/planejamento; perfil ativo muda a coluna no recálculo seguinte.
- [ ] O job `m5-recalcula-raiox` é ativo, tem lock próprio e roda antes de `m4-recalcula-projecoes`.

**Tests**: integration
**Gate**: full
**Commit**: `feat(m5): liga raio-x ao plano e ao cron`
**Status**: ⬜ Pending

### T5: Criar leitura server-side do Raio-X

**What**: Expor no módulo M5 um DTO mínimo que consulta perfil ativo e projeções ordenadas pelo peso.
**Where**: `src/modules/raiox/index.ts`
**Depends on**: T3, T4
**Requirement**: RAIOX-05, RAIOX-08, RAIOX-12
**Tools**: MCP: none · Skill: `tlc-spec-driven`
**Done when**:

- [ ] A leitura usa cliente de serviço no servidor e não expõe configuração ou tabelas internas.
- [ ] O DTO traz somente órgão, banca, data, formato e as linhas necessárias à tela.
- [ ] A consulta preserva a ordenação da projeção e retorna estado vazio sem perfil ativo.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(m5): expõe leitura server-side do raio-x`
**Status**: ⬜ Pending

### T6: Construir componente de leitura

**What**: Criar o componente responsivo e acessível que apresenta o perfil, a lista e os sinais da projeção.
**Where**: `src/modules/raiox/tela.tsx`
**Depends on**: T5
**Requirement**: RAIOX-05, RAIOX-12
**Tools**: MCP: none · Skill: `tlc-spec-driven`
**Done when**:

- [ ] Cada linha mostra tópico, peso, `n_questoes` e tendência em texto humano.
- [ ] Toda linha `amostra_baixa` mostra `Baseado em poucas questões` junto do número.
- [ ] A tela tem estado vazio orientado e não cria largura fixa que cause rolagem em 360px.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(m5): renderiza leitura do raio-x`
**Status**: ⬜ Pending

### T7: Integrar rota logada e flag

**What**: Adicionar `/app/raio-x` como Server Component protegido por matrícula e pela flag M5.
**Where**: `src/app/app/raio-x/page.tsx`
**Depends on**: T6
**Requirement**: RAIOX-08, RAIOX-12
**Tools**: MCP: none · Skill: `tlc-spec-driven`
**Done when**:

- [ ] Sem matrícula a guarda existente redireciona antes da leitura do acervo.
- [ ] Flag desligada não exibe a projeção; flag ligada renderiza os dados pré-computados.
- [ ] A rota funciona sem `data_prova` e exibe a banca `indefinida` sem inventar contagem regressiva.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(m5): adiciona rota logada do raio-x`
**Status**: ⬜ Pending

### T8: Fechar contrato com o plano e rastreabilidade

**What**: Provar que o peso da view reordena o plano sem alterar o motor e fechar a rastreabilidade da SPEC.
**Where**: `tests/db/raiox-plano.test.ts`
**Depends on**: T4, T7
**Requirement**: RAIOX-03, RAIOX-14
**Tools**: MCP: none · Skill: `tlc-spec-driven`
**Done when**:

- [ ] O teste mostra que alterar a projeção muda a ordem do plano pela view, sem mudar a função do plano.
- [ ] Os Success Criteria da SPEC têm evidência em testes ou ficam explicitamente registrados como limitação.
- [ ] Todos os gates do projeto passam antes do último commit.

**Tests**: integration
**Gate**: build
**Commit**: `test(m5): fecha contrato do raio-x com o plano`
**Status**: ⬜ Pending

## Diagram-Definition Cross-Check

| Task | Depends on | Diagram | Status |
| --- | --- | --- | --- |
| T1 | None | None | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T3, T4 | T3/T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T4, T7 | T4/T7 → T8 | ✅ |

## Test Co-location Validation

| Task | Layer | Matrix | Task says | Status |
| --- | --- | --- | --- | --- |
| T1 | Configuração | unit | unit | ✅ |
| T2 | Schema Supabase | integration | integration | ✅ |
| T3 | Regra de frequência e job | integration | integration | ✅ |
| T4 | View, cron e contrato | integration | integration | ✅ |
| T5 | Leitura server-side | unit | unit | ✅ |
| T6 | Componente de tela | unit | unit | ✅ |
| T7 | Rota protegida | unit | unit | ✅ |
| T8 | View, cron e contrato | integration | integration | ✅ |

## Traceability Plan

| Requirement | Tasks |
| --- | --- |
| RAIOX-01 | T3 |
| RAIOX-03 | T4, T8 |
| RAIOX-04 | T3 |
| RAIOX-05 | T2, T3, T5, T6 |
| RAIOX-08 | T2, T5, T7 |
| RAIOX-11 | T1, T3 |
| RAIOX-12 | T1, T3, T5, T6, T7 |
| RAIOX-14 | T1, T3, T4, T8 |

## Closing Protocol

Depois de T8: dispatch automático do Verifier independente, aguardando a conclusão. O relatório deve ser
gravado em `validation.md` e passar `validate_state.py` antes de declarar a SPEC concluída. Como o Ritual
é B, o relatório confere os Success Criteria com evidência `file:line`, sem sensor de mutação.
