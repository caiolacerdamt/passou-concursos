# SPEC 13 — Onboarding, plano e sessão · Tasks

## Execution Protocol

Implementar estas tarefas seguindo o fluxo Execute da skill `tlc-spec-driven`: uma tarefa por vez,
teste derivado do critério de aceite, gate verde e um commit atômico por tarefa. O Ritual B mantém o
design embutido neste arquivo; não há `design.md` separado.

**Design**: embutido abaixo, conforme o Ritual B da SPEC 13.
**Status**: In Progress

## Design embutido

### Direção visual

- Produto sério, inteligente e premium, com clareza, controle e evolução como eixo.
- A metáfora visual é um caderno editorial de prova: papel claro, tinta azul-marinho, sinalização de
  evidência e progresso real.
- Paleta em tokens globais: tinta `#162438`, papel `#F7F8F6`, painel `#FFFFFF`, ação `#2F64D6`,
  evolução `#238B7A`, atenção `#C8893D`, linha `#D7DEE8`; erro e sucesso preservam pares acessíveis.
- Corpo em sans do sistema para leitura longa, títulos de destaque com serif discreta e dados com fonte
  utilitária. A fonte não depende de download externo.
- Cards têm borda, respiro e hierarquia; não há sombras pesadas, moedas, loja, neon ou decoração gamer.
- A assinatura da superfície é mostrar evidências curtas: `por que hoje`, fonte da questão e próximo
  passo. IA aparece como texto útil, nunca como selo ou robô.

### Layout e interação

- Mobile-first desde 360px. O plano usa uma coluna no telefone e uma grade ampla no desktop; a questão
  mantém coluna de leitura confortável e alternativas fáceis de tocar.
- O mesmo `Shell` continua sendo usado. Ele ganha uma variante de painel, sem duplicar cabeçalho,
  link de pulo ou foco visível.
- Onboarding é uma única sequência curta: concurso-alvo, tempo, agenda e nível. O diagnóstico é
  explicitamente pulável e não bloqueia o plano.
- O plano separa visualmente `piso` e `meta_cheia`. O primeiro é o compromisso mínimo; o segundo é a
  sessão completa. Cada bloco mostra tipo, tempo e motivo.
- A sessão mostra uma questão por vez. Após a resposta, mostra acerto/erro, alternativa correta,
  explicação e fontes. Se não houver explicação aprovada para a versão, mostra `em revisão`.
- A causa do erro aparece somente quando necessária. O avanço fica impossível até uma das seis causas
  ou `não sei dizer` ser enviada.
- Movimento é mínimo, funcional e respeita `prefers-reduced-motion`; estados de carga, vazio, erro e
  degradado usam o componente `Estado` existente.

### Contratos técnicos

- O plano continua sendo escolhido por SQL. A ação do onboarding apenas semeia o perfil e dispara a
  geração do dia; a frase de IA permanece opcional.
- A sessão cria ou retoma um bloco por aluno. O vínculo com `plano_bloco` permite retornar ao mesmo
  conjunto de itens depois de sair.
- Toda resposta passa por `registrarTentativa` usando o cliente da sessão, nunca pela chave de serviço.
- A explicação chega ao navegador somente por uma RPC que exige matrícula ativa e devolve apenas a
  explicação aprovada e vigente da versão solicitada.
- Imagens privadas recebem URL assinada no servidor. O navegador nunca recebe credencial de Storage.

## Test Coverage Matrix

> Gerada a partir de `AGENTS.md`, `CLAUDE.md`, `vitest.config.mts`, `.github/workflows/ci.yml`, dos testes
> existentes e dos critérios da SPEC 13.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domínio e validação | unit | Todos os ramos e cada critério de validação | `src/modules/**/*.test.ts` | `npm run test:unit` |
| Página, ação e componente | unit | Caminho feliz, estados vazios/degradados/erro e regras de interação da superfície | `src/app/**/*.test.tsx`, `src/modules/**/*.test.tsx` | `npm run test:unit` |
| Schema, RLS e RPC | integration | Cada contrato novo, acesso do próprio aluno e recusa do acesso indevido | `tests/db/**/*.test.ts` | `npm run test:db` |
| Tokens e configuração visual | none | Build e lint; sem teste de framework | `src/app/globals.css` | `npm run build` + `npm run lint` |

## Gate Check Commands

> Comandos extraídos de `package.json` e `.github/workflows/ci.yml`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tarefas só com domínio, página ou componente unitário | `npm run test:unit` |
| Full | Tarefas com schema, RLS ou RPC | `npm run test:unit; npm run test:db` |
| Build | Última tarefa e fechamento de fase | `npm run build; npm run lint; npm run test:unit; npm run test:db` |

## Execution Plan

As fases são sequenciais. As tarefas dentro de uma fase também são sequenciais.

### Phase 1: Contratos e base visual

```
T1 → T2
T3
```

### Phase 2: Onboarding e plano

```
T4 → T5
```

### Phase 3: Sessão e resposta

```
T6 → T7
```

### Phase 4: Superfície final

```
T8
```

## Task Breakdown

### Phase 1

### T1: Persistir onboarding, retomada e leitura segura da explicação

**What**: Adicionar os campos declarados do onboarding, vincular sessão ao bloco e criar a RPC de
leitura da explicação aprovada por questão-versão.
**Where**: `supabase/migrations/20260822220000_spec13_onboarding_e_sessao.sql`
**Depends on**: None
**Reuses**: `perfil_estudo`, `sessoes`, `plano_bloco`, `tem_matricula_ativa()`
**Requirement**: PAG-14, ALUNO-05, ALUNO-01, IA-04, IA-09
**Tools**: MCP: NONE · Skill: `tlc-spec-driven`
**Done when**:

- [x] Perfil guarda concurso, agenda, horário e conclusão sem quebrar o caminho antigo do plano.
- [x] Sessão pode apontar para `plano_bloco` sem apagar histórico quando o plano for removido.
- [x] RPC só devolve explicação `vigente` e `aprovada` para matrícula ativa; sem explicação válida,
      devolve zero linha.
- [x] Testes em `tests/db/spec13-onboarding.test.ts` cobrem schema, RLS, RPC e acesso indevido.

**Tests**: integration (`tests/db/spec13-onboarding.test.ts`)
**Gate**: full
**Commit**: `feat(m4): cria contratos da spec 13`

### T2: Validar e ler o perfil de onboarding

**What**: Criar o contrato de domínio para validar concurso, minutos, agenda, horário e nível, além da
leitura do perfil da sessão.
**Where**: `src/modules/aluno/onboarding.ts`
**Depends on**: T1
**Reuses**: vocabulário de `perfil_estudo` e `CAUSAS_DO_TREINO`
**Requirement**: ALUNO-05
**Tools**: MCP: NONE · Skill: `tlc-spec-driven`
**Done when**:

- [x] Validação recusa payload incompleto, minutos fora do intervalo, agenda vazia e nível desconhecido.
- [x] Validação devolve dados normalizados para a ação, sem confiar em texto de erro do banco.
- [x] Testes unitários cobrem caminho válido e cada recusa.

**Tests**: unit (`src/modules/aluno/onboarding.test.ts`)
**Gate**: quick
**Commit**: `feat(m4): valida perfil de onboarding`

### Phase 1

### T3: Criar tokens e variante de shell para a superfície logada

**What**: Aplicar a direção visual aprovada em tokens globais e permitir que plano e sessão usem uma
largura de painel sem duplicar o shell.
**Where**: `src/app/globals.css`
**Depends on**: None
**Reuses**: `src/modules/ui/shell.tsx`, `src/modules/ui/estado.tsx`
**Requirement**: ALUNO-08, ALUNO-11 e contratos UI-01/UI-03 da SPEC 07
**Tools**: MCP: NONE · Skill: `frontend-design`
**Done when**:

- [x] Cores, tipografia, raios, espaçamento e larguras ficam centralizados em tokens.
- [x] A variante de painel permanece responsiva a 360px e mantém foco/link de pulo.
- [x] Testes do shell continuam passando e cobrem a nova variante.

**Tests**: unit (`src/modules/ui/shell.test.tsx`)
**Gate**: quick
**Commit**: `feat(ui): cria tokens da superfície de estudo`

### Phase 2

### T4: Consultar e modelar o plano do dia

**What**: Criar a leitura autenticada do plano, seus dois níveis e seus blocos em um modelo próprio para
a tela.
**Where**: `src/modules/aluno/plano.ts`
**Depends on**: T1
**Reuses**: tabelas `plano_dia`/`plano_bloco` e RLS da SPEC 06
**Requirement**: ALUNO-08, ALUNO-11
**Tools**: MCP: NONE · Skill: `tlc-spec-driven`
**Done when**:

- [x] Leitura retorna `piso` e `meta_cheia` separados, em ordem e com motivo/tempo.
- [x] Frase nula não impede a entrega do plano.
- [x] Falha de leitura vira erro nomeado sem expor mensagem técnica ao aluno.
- [x] Testes unitários cobrem plano completo, plano sem blocos e frase ausente.

**Tests**: unit (`src/modules/aluno/plano.test.ts`)
**Gate**: quick
**Commit**: `feat(m4): expõe leitura do plano diário`

### Phase 2

### T5: Implementar onboarding e entrega do primeiro plano

**What**: Conectar a página `/app` à guarda de matrícula, ao onboarding, ao perfil e à geração imediata do
plano do dia.
**Where**: `src/app/app/page.tsx`
**Depends on**: T2, T3, T4
**Reuses**: `exigirMatriculaAtiva()`, `clienteDaSessao()`, `Shell`, `Estado`
**Requirement**: PAG-14, ALUNO-05
**Tools**: MCP: NONE · Skill: `frontend-design`
**Done when**:

- [x] Primeiro acesso mostra formulário responsivo com concurso, minutos, agenda, horário e nível.
- [x] Envio grava o perfil do próprio aluno, marca onboarding concluído e gera o plano por SQL.
- [x] Retorno mostra o plano na mesma sessão e não bloqueia por frase de IA nula.
- [x] Matrícula ausente continua redirecionando antes de qualquer conteúdo.
- [x] Testes da página e da ação cobrem primeiro acesso, retorno com plano, erro seguro e paywall.

**Tests**: unit (`src/app/app/page.test.tsx`, `src/app/app/acoes.test.ts`)
**Gate**: quick
**Commit**: `feat(aluno): entrega onboarding e primeiro plano`

### Phase 3

### T6: Criar ou retomar uma sessão do plano

**What**: Implementar a preparação de uma sessão por bloco, seleção de questões publicadas e retomada de
itens ainda sem resposta.
**Where**: `src/modules/aluno/sessao.ts`
**Depends on**: T1, T4
**Reuses**: `sessoes`, `sessao_itens`, cliente autenticado e parâmetro de questões por bloco
**Requirement**: ALUNO-01, BANCO-01
**Tools**: MCP: NONE · Skill: `tlc-spec-driven`
**Done when**:

- [x] Só questões publicadas, vigentes e não anuladas entram na sessão.
- [x] `treinar` mistura questões; blocos por tópico respeitam o tópico do plano.
- [x] Uma sessão aberta do mesmo bloco é retomada, sem duplicar itens.
- [x] A leitura retorna proveniência, alternativas e imagens com URLs assinadas, sem gabarito para o
      navegador antes da resposta.
- [x] Testes unitários cobrem acervo vazio, anulada, retomada e imagem.

**Tests**: unit (`src/modules/aluno/sessao.test.ts`)
**Gate**: quick
**Commit**: `feat(aluno): cria e retoma sessao de estudo`

### Phase 3

### T7: Registrar resposta e entregar correção versionada

**What**: Criar a ação autenticada que deriva o contexto da sessão, chama `registrarTentativa` com o
cliente da sessão, exige causa no erro e devolve correção/explanação da versão respondida.
**Where**: `src/app/app/sessao/acoes.ts`
**Depends on**: T6
**Reuses**: `registrarTentativa`, `validarResposta`, RPC `ler_explicacao_publica`
**Requirement**: ALUNO-01, ALUNO-03, IA-04, IA-09
**Tools**: MCP: NONE · Skill: `tlc-spec-driven`
**Done when**:

- [x] Usuário e contexto são derivados da sessão, nunca aceitos como autoridade do formulário.
- [x] Duplo-clique devolve o resultado existente sem novo INSERT.
- [x] Erro no treino sem causa retorna estado nomeado e não avança; `nao_sei_dizer` passa.
- [x] Correção mostra alternativa correta, fontes da explicação aprovada e aviso `em revisão` quando a
      versão não tem explicação válida.
- [x] Ao responder o último item, a sessão é encerrada; ao sair antes, os itens pendentes permanecem.
- [x] Testes unitários cobrem caminho feliz, recusa de causa, duplicidade, versão e falha segura.

**Tests**: unit (`src/app/app/sessao/acoes.test.ts`)
**Gate**: quick
**Commit**: `feat(aluno): registra resposta com explicacao versionada`

### Phase 4

### T8: Construir a tela responsiva da sessão de questões

**What**: Implementar a rota e o componente client da sessão, com questão uma por vez, alternativas,
causa do erro, correção, fontes e retomada visual.
**Where**: `src/app/app/sessao/[id]/page.tsx`
**Depends on**: T5, T7
**Reuses**: `Shell`, `Estado`, tokens da T3 e ações da T7
**Requirement**: ALUNO-01, ALUNO-03, BANCO-01, IA-04, IA-09
**Tools**: MCP: NONE · Skill: `frontend-design`
**Done when**:

- [ ] Questão, fonte e alternativas são legíveis no mobile e no desktop, sem rolagem horizontal.
- [ ] O aluno não avança sem enviar causa quando o resultado é erro no treino.
- [ ] A correção mostra acerto/erro, alternativa correta, explicação e fontes sem inventar conteúdo.
- [ ] Questão sem explicação válida mostra `em revisão`; imagem, quando existente, aparece com texto
      alternativo.
- [ ] Saída e retorno preservam itens já respondidos e não criam duplicidade.
- [ ] Testes de página/componente cobrem estados de resposta, causa, revisão, erro e conclusão.
- [ ] Build, lint e suítes unitária e de banco passam.

**Tests**: unit (`src/app/app/sessao/[id]/page.test.tsx`, `src/modules/aluno/sessao/tela.test.tsx`)
**Gate**: build
**Commit**: `feat(aluno): entrega sessao responsiva de questoes`

## Phase Execution Map

```
Phase 1:
T1 → T2
T3

Phase 2:
T4 → T5

Phase 3:
T6 → T7

Phase 4:
T8
```

## Task Validation

| Check | Result |
| --- | --- |
| Granularidade | ✅ Oito entregáveis, cada um com uma fronteira funcional clara |
| Dependências | ✅ Nenhuma tarefa depende de fase futura |
| Testes co-localizados | ✅ Cada camada com teste exigido inclui o teste na própria tarefa |
