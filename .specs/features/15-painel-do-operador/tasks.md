# SPEC 15 — Tasks: painel do operador

## Execution Protocol

Implementar com a `tlc-spec-driven`: uma task por vez, teste derivado do requisito, gate verde,
status fechado e commit atômico. O Ritual B usa Verificador independente curto, sem sensor.

**Design embutido — Ritual B**

- `/operador` é uma superfície separada de `/app`: exige sessão, mas não matrícula.
- `operadores` é a allowlist revogável ligada a `auth.users`; toda leitura e mutação a confere no servidor.
- O navegador nunca recebe a chave de serviço nem consulta diretamente as tabelas operacionais.
- Funções SQL atômicas fecham lote, publicação, correção e taxonomia. Autor vem da sessão; motivo é obrigatório.
- Lote aceita 1–50 revisões. Qualquer conflito ou falha de publicação reverte a seleção inteira.
- Correção aceita somente campos declarados, insere nova versão `em_revisao` e nunca edita versão congelada.
- Aprovar candidato cria o tópico e fecha o candidato na mesma transação; editar taxonomia nunca usa DELETE.
- Configuração continua append-only. A tela combina `CATALOGO` com vigente e histórico server-side.
- A UI é uma mesa editorial: prioridade e proveniência primeiro, cartões densos e empilhados em 360 px.
- Erro inesperado é reportado e vira mensagem genérica; tentativa sem papel é negada e reportada.

**Status**: Approved

## Test Coverage Matrix

> Guidelines: `AGENTS.md`, `docs/GITFLOW.md`, `package.json`, `vitest.config.mts` e specs-mãe.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Schema e funções do operador | integration | autorização, atomicidade, transições, append-only, concorrência e rollback | `tests/db/spec15-*.test.ts` | `npm run test:db` |
| Domínio/server-side | unit | guarda, DTO mínimo, validação fechada e erros | `src/modules/operador/*.test.ts` | `npm run test:unit` |
| Server Actions | unit | sucesso, acesso negado, entrada inválida e falha segura | `src/app/operador/**/*.test.ts` | `npm run test:unit` |
| Componentes e rotas | unit | conteúdo, vazio, erro, navegação e estrutura responsiva | `src/app/operador/**/*.test.tsx` | `npm run test:unit` |
| Configuração | unit + integration | motivo obrigatório, tipo do catálogo e histórico append-only | `src/modules/config/*.test.ts`, `tests/db/spec15-config.test.ts` | `npm run test:unit` + `npm run test:db` |

## Gate Check Commands

| Gate Level | Command |
| --- | --- |
| Quick | `npm run test:unit` |
| Full | `npm run test:unit` + `npm run test:db` |
| Build | `npm run lint` + `npm run test:unit` + `npm run test:db` + `npm run build` |

## Execution Plan

### Phase 1: Banco e contratos

```text
T118 → T119 → T120 → T121
```

### Phase 2: Fronteira server-side

```text
T121 → T122
```

### Phase 3: Superfície

```text
T122 → T123 → T124 → T125 → T126
```

## Task Breakdown

### T118: Criar identidade e trilha do operador

**What**: Criar allowlist, log append-only e exigir motivo em novas configurações.
**Where**: `supabase/migrations/20260823100000_spec15_operadores.sql`
**Depends on**: None
**Requirement**: INFRA-11, SEC-01, SEC-03, SEC-04
**Done when**: operador ativo é verificável; navegador não lê; log não aceita mutação; config sem motivo falha.
**Tests**: integration
**Gate**: full
**Commit**: `feat(m9): cria fronteira do operador`
**Status**: ✅ Done — full gate verde; migrations aplicadas em desenvolvimento

### T119: Operar a fila em transação

**What**: Criar decisão em lote e correção versionada com publicação/rollback atômicos.
**Where**: `supabase/migrations/20260823101000_spec15_fila.sql`
**Depends on**: T118
**Requirement**: BANCO-07, SEC-02, SEC-04, SEC-06
**Done when**: lote 1–50 aprova/rejeita; aprovar publica; corrigir insere versão; conflito reverte tudo.
**Tests**: integration
**Gate**: full
**Commit**: `feat(m1): opera fila de revisao`
**Status**: ✅ Done — full gate verde; migrations aplicadas em desenvolvimento

### T120: Operar a taxonomia em transação

**What**: Criar funções de candidato e edição canônica com motivo e trilha.
**Where**: `supabase/migrations/20260823102000_spec15_taxonomia.sql`
**Depends on**: T119
**Requirement**: BANCO-10, SEC-02, SEC-04, SEC-06
**Done when**: aprovação cria tópico; rejeição não cria; edição desativa sem DELETE; concorrência falha fechada.
**Tests**: integration
**Gate**: full
**Commit**: `feat(m1): opera curadoria da taxonomia`
**Status**: ⬜ Pending

### T121: Fechar escrita e histórico de configuração

**What**: Tornar motivo obrigatório no contrato TS e expor leitura administrativa tipada.
**Where**: `src/modules/config/escrita.ts`
**Depends on**: T120
**Requirement**: INFRA-11, SEC-02, SEC-03, SEC-04
**Done when**: valor inválido/motivo vazio falham antes do INSERT; vigente e histórico preservam catálogo e autoria.
**Tests**: unit + integration
**Gate**: full
**Commit**: `feat(m9): fecha historico da configuracao`
**Status**: ⬜ Pending

### T122: Criar fronteira server-side do painel

**What**: Implementar guarda, consultas mínimas e comandos tipados do operador.
**Where**: `src/modules/operador/`
**Depends on**: T121
**Requirement**: BANCO-07, BANCO-10, INFRA-11, SEC-01…SEC-06
**Done when**: sem papel nega e reporta; autor é derivado da sessão; DTOs omitem campos internos; falhas são genéricas.
**Tests**: unit
**Gate**: quick
**Commit**: `feat(m9): protege comandos do operador`
**Status**: ⬜ Pending

### T123: Construir o shell do operador

**What**: Criar layout, início e navegação acessível da mesa editorial.
**Where**: `src/app/operador/`
**Depends on**: T122
**Requirement**: SEC-01, SEC-03
**Done when**: guarda precede leitura; três áreas são navegáveis; estado sem acesso não vaza conteúdo; 360 px não transborda.
**Tests**: unit
**Gate**: quick
**Commit**: `feat(m9): cria shell do operador`
**Status**: ⬜ Pending

### T124: Construir a fila de revisão

**What**: Criar lista, seleção, decisão em lote e editor de correção.
**Where**: `src/app/operador/fila/`
**Depends on**: T123
**Requirement**: BANCO-07, SEC-01, SEC-02, SEC-06
**Done when**: prioridade/proveniência aparecem; lote exige motivo; correção explicita nova versão; erros orientam sem detalhe interno.
**Tests**: unit
**Gate**: quick
**Commit**: `feat(m1): cria tela da fila de revisao`
**Status**: ⬜ Pending

### T125: Construir a curadoria da taxonomia

**What**: Criar lista de candidatos e formulários de aprovação, rejeição e edição.
**Where**: `src/app/operador/taxonomia/`
**Depends on**: T124
**Requirement**: BANCO-10, SEC-01, SEC-02, SEC-06
**Done when**: candidato mostra ocorrências; aprovação escolhe matéria/nome; edição exige motivo; desativação é explícita.
**Tests**: unit
**Gate**: quick
**Commit**: `feat(m1): cria tela da taxonomia`
**Status**: ⬜ Pending

### T126: Construir administração de configuração

**What**: Criar catálogo editável com vigente, motivo e histórico por chave.
**Where**: `src/app/operador/configuracao/`
**Depends on**: T125
**Requirement**: INFRA-11, SEC-01…SEC-06
**Done when**: flag tem controle booleano; JSON é validado; histórico mostra antes/depois, autor, data e motivo; build gate passa.
**Tests**: unit + integration
**Gate**: build
**Commit**: `feat(m9): cria tela de configuracao`
**Status**: ⬜ Pending

## Diagram-Definition Cross-Check

| Task | Depends on | Diagram | Status |
| --- | --- | --- | --- |
| T118 | None | início | ✅ |
| T119 | T118 | T118 → T119 | ✅ |
| T120 | T119 | T119 → T120 | ✅ |
| T121 | T120 | T120 → T121 | ✅ |
| T122 | T121 | T121 → T122 | ✅ |
| T123 | T122 | T122 → T123 | ✅ |
| T124 | T123 | T123 → T124 | ✅ |
| T125 | T124 | T124 → T125 | ✅ |
| T126 | T125 | T125 → T126 | ✅ |

## Test Co-location Validation

| Task | Layer | Matrix requires | Task says | Status |
| --- | --- | --- | --- | --- |
| T118 | schema/config | integration | integration | ✅ |
| T119 | funções da fila | integration | integration | ✅ |
| T120 | funções da taxonomia | integration | integration | ✅ |
| T121 | configuração | unit + integration | unit + integration | ✅ |
| T122 | domínio/server-side | unit | unit | ✅ |
| T123 | rota/layout | unit | unit | ✅ |
| T124 | action/componente | unit | unit | ✅ |
| T125 | action/componente | unit | unit | ✅ |
| T126 | config/action/componente | unit + integration | unit + integration | ✅ |

## Traceability Plan

| Requirement | Tasks |
| --- | --- |
| BANCO-07 | T119, T122, T124 |
| BANCO-10 | T120, T122, T125 |
| INFRA-11 | T118, T121, T122, T126 |
| SEC-01…SEC-06 | T118…T126 |

## Closing Protocol

Depois de T126: Verificador GPT-5.6 Terra com reasoning `max`, Ritual B, Success Criteria com evidência
`file:line`, sem sensor. Gaps viram tasks de correção e nova verificação antes de `validate_state.py`.
