# SPEC 08 — Gateway de IA · Design embutido + Tasks

> **Ritual B** (AD-090): design embutido aqui no topo, sem `design.md` separado. Verificador
> independente **curto** (só os *Success Criteria*, com evidência `file:line`, sem sensor de mutação)
> como seção no fim deste arquivo.
>
> Numeração: **T65…T74** (a SPEC 07 fechou em T64).

---

## Design (embutido)

### O problema em uma frase

Toda chamada de IA do produto precisa resolver `tarefa → (modelo, versão, esforço, batch, cache,
fallback, preço)` **em configuração**, e nenhuma linha de código nem de teste pode citar o nome de um
modelo. Sem esse ponto único, a SPEC 09 (extração) e a SPEC 10 (explicação) espalhariam clientes de
IA pelo repositório.

### Decisão central: a matriz nasce vazia no catálogo

O `AGENTS.md` proíbe nome de modelo em código; o AD-078 exige default declarado em código. Os dois
só cabem juntos de um jeito: o default de `param.m2.matriz_de_modelos` no catálogo é **`{}`**, e a
matriz real é **linha na tabela `configuracoes`**, inserida por um operador (`setConfig`) ou pelo
script `scripts/matriz-de-modelos.mjs`. Consequências, todas desejadas:

- nenhum nome de modelo em `src/`, em `scripts/` ou em `tests/`;
- tarefa sem perfil na matriz é **recusa visível** (`TarefaSemPerfil`), nunca um modelo adivinhado —
  é a mesma regra do "config ilegível deixa a flag desligada";
- os defaults vigentes (AD-073) ficam escritos em `docs/IA.md`, que é documento e **pode** citá-los.

### Peças

| Arquivo | O que é |
| --- | --- |
| `src/modules/ia/tarefas.ts` | a **lista fechada** de tarefas do IA-02 AC2 e a versão de prompt de cada uma |
| `src/modules/ia/matriz.ts` | resolve `tarefa → perfil` a partir de `param.m2.matriz_de_modelos`; recusa visível |
| `src/modules/ia/adaptador-openai.ts` | o **único** adapter: Responses API do SDK nativo (AD-074), síncrono e linha de lote |
| `src/modules/ia/gateway.ts` | fallback com registro, parada visível, dedup, refaz 1×, registro de gasto |
| `src/modules/ia/gasto.ts` | soma do mês + alerta uma vez por período, sem desligar nada |
| `src/modules/ia/index.ts` | interface pública do módulo (AD-002) |
| `supabase/migrations/*_ia_geracoes.sql` | `ia_geracoes` (dedup + auditoria + custo) e `ia_alerta_de_gasto` |
| `scripts/jobs/frase-do-plano.ts` | a 1ª tarefa real que passa pelo gateway (ALUNO-12) |

### Fluxo de uma chamada

```
executarTarefa({ tarefa, entrada, dedup })
  │
  ├─ matriz: perfil da tarefa (config)      → sem perfil? TarefaSemPerfil (parada visível)
  ├─ dedup:  já existe geração com a chave? → devolve a de antes, custo zero, sem chamar o modelo
  ├─ adapter: modelo principal
  │     └─ falhou? → registra o evento → adapter com o `fallback` do perfil
  │           └─ falhou também? → GatewayParou (visível/alertado), sem resultado parcial
  ├─ grava em `ia_geracoes`: modelo, versão, esforço, versão do prompt, tokens, custo, se usou fallback
  └─ gasto: soma o mês e alerta **uma vez** por período quando passa do teto
```

`refazerUmaVez()` (IA-13) é um envelope em volta disso: chama a tarefa, e se o conferidor que o
chamador passou reprovar, chama **uma única vez** a tarefa de reprocessamento — que na matriz aponta
outro modelo e outro esforço. Nunca uma terceira vez. Quem usa é a SPEC 22.

### Batch

`batch` é campo do perfil. O gateway **decide** e **monta** a linha de lote (`montarLinhaDeLote`, o
formato JSONL de `/v1/responses`), e recusa executar de forma síncrona uma tarefa marcada
`batch: true`. O **envio e a colheita** do arquivo de lote entram na SPEC 09, que é quem tem volume
para exercitá-los — construí-los aqui seria código sem consumidor e sem prova. Registrado como desvio
consciente, não esquecimento.

### Onde cada coisa roda

O gateway é TypeScript em `src/modules/ia/` e é chamado dos dois lados: dos **scripts de job**
(fábrica, AD-036 — nunca função da Vercel) e da aplicação (tutor, SPEC 24). Os scripts passam a rodar
com `tsx`, porque a partir daqui todo job da fábrica precisa importar módulo do `src/`.

O job da frase abre uma conexão `pg` com `DATABASE_URL` (o mesmo caminho do vigia) e **injeta** esse
leitor na configuração por `definirLeitorDeConfig` — assim ele lê `configuracoes_vigentes` com a
validação e as quedas do módulo de config, sem precisar de um segundo segredo no GitHub.

### Riscos aceitos

| Risco | Decisão |
| --- | --- |
| `OPENAI_API_KEY` não provisionada | tudo é testado com adapter duplo; sem a chave o job sai limpo deixando `frase = null` |
| Matriz vazia num banco novo | é o desenho: recusa visível, e o plano continua saindo sem frase |
| Preço por modelo em config e não em código | preço muda mais que código; entra no mesmo lugar da matriz |

---

## Test Coverage Matrix

| Camada de código | Tipo de teste | Cobertura esperada | Local | Comando |
| --- | --- | --- | --- | --- |
| Módulo TS (`src/modules/ia/*`) | unit | todos os ramos; 1:1 com os Success Criteria | `src/modules/ia/*.test.ts` | `npm run test:unit` |
| Migração SQL (`ia_geracoes`) | integration (banco) | unicidade da chave de dedup, unicidade do alerta por período, privilégios | `tests/db/*.test.ts` | `npm run test:db` |
| Script de job | unit | caminho feliz + falha da IA num aluno + falha de rede + sem chave | `scripts/**/*.test.ts` | `npm run test:unit` |

Nenhum teste cita nome de modelo: os testes montam a própria matriz com rótulos inventados.

---

## Tasks

### T65: Lista fechada de tarefas e as chaves de configuração do M2

**What**: os 9 nomes de tarefa do IA-02 AC2, a versão de prompt de cada uma, e as chaves
`param.m2.matriz_de_modelos`, `param.m2.precos_por_modelo`, `param.m2.teto_gasto_mensal_usd`.
**Where**: `src/modules/ia/tarefas.ts`, `src/modules/config/catalogo.ts`
**Requirement**: IA-02 AC2 · AD-068 · AD-078

**Done when**:

- [ ] `TAREFAS` tem exatamente as 9 da spec, e embeddings **não** está entre elas
- [ ] o default de `matriz_de_modelos` e de `precos_por_modelo` é `{}` — nenhum nome de modelo
- [ ] teste falha se alguém acrescentar tarefa sem passar pela lista
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m2): declara a lista fechada de tarefas de ia`

---

### T66: `ia_geracoes` e `ia_alerta_de_gasto`

**What**: a tabela que serve de chave de dedup, de auditoria (modelo/versão/esforço/prompt) e de
base do gasto; e a que garante alerta uma vez por período.
**Where**: `supabase/migrations/<ts>_ia_geracoes.sql`, `tests/db/ia-geracoes.test.ts`
**Requirement**: IA-14 · IA-02 AC4/AC8 · IA-12

**Done when**:

- [ ] `chave_dedup` é única; INSERT repetido é recusado pelo banco
- [ ] a linha guarda modelo, versão, esforço, versão do prompt, tokens e custo
- [ ] `ia_alerta_de_gasto` tem `periodo` como PK — o segundo alerta do mês não entra
- [ ] as duas fechadas para `anon`/`authenticated` (RLS ligada, sem policy)
- [ ] Gate: `npm test`

**Commit**: `feat(m2): cria o registro de geracoes de ia`

---

### T67: `matriz.ts` — resolver tarefa por configuração

**What**: ler `param.m2.matriz_de_modelos`, validar o perfil, recusar de forma visível quando a
tarefa não tem linha.
**Where**: `src/modules/ia/matriz.ts`, `src/modules/ia/matriz.test.ts`
**Requirement**: IA-02 AC1 · IA-16

**Done when**:

- [ ] trocar o modelo de uma tarefa na config muda o que o gateway usa, sem tocar em código
- [ ] mudar o esforço de **uma** tarefa não altera o perfil das outras
- [ ] perfil malformado e tarefa ausente viram `TarefaSemPerfil`, reportada
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m2): resolve modelo e esforco por tarefa a partir da config`

---

### T68: Adapter único da OpenAI (Responses API)

**What**: o único caminho até o provedor — `responses.create` com `reasoning.effort`, saída
estruturada opcional, leitura de `usage`; e `montarLinhaDeLote` para o formato JSONL.
**Where**: `src/modules/ia/adaptador-openai.ts`, `src/modules/ia/adaptador-openai.test.ts`
**Requirement**: IA-16 · AD-074 · IA-02 AC9

**Done when**:

- [ ] o adapter recebe o perfil e repassa modelo e esforço sem conhecê-los
- [ ] sem `OPENAI_API_KEY` a falha é clara e não vaza a chave em log
- [ ] `montarLinhaDeLote` produz a linha do lote com o mesmo corpo do pedido síncrono
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m2): liga o adapter unico da openai`

---

### T69: `gateway.ts` — fallback com registro e parada visível

**What**: o ponto único de chamada; fallback do perfil quando o principal falha; parada visível
quando o fallback também falha.
**Where**: `src/modules/ia/gateway.ts`, `src/modules/ia/gateway.test.ts`
**Requirement**: IA-02 AC1/AC4/AC5

**Done when**:

- [ ] principal fora do ar → fallback assume e o evento é registrado
- [ ] fallback também falha → `GatewayParou`, sem resultado parcial
- [ ] a geração grava modelo, versão, esforço e versão do prompt
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m2): aciona fallback e para de forma visivel`

---

### T70: Dedup — rerodar não regera nem cobra

**What**: chave `questao_id + questao_versao + tarefa + versão do prompt` (e uma chave livre para
tarefa que não é de questão), consultada antes de chamar o modelo.
**Where**: `src/modules/ia/gateway.ts`, `src/modules/ia/dedup.test.ts`
**Requirement**: IA-14 · AD-036

**Done when**:

- [ ] segunda chamada com a mesma chave devolve a geração anterior **sem** chamar o adapter
- [ ] a chave muda quando a versão do prompt muda
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m2): dedup impede regerar o que ja existe`

---

### T71: Refaz exatamente 1×, escalando modelo e esforço

**What**: o mecanismo genérico do IA-13 — quem o usa é a SPEC 22.
**Where**: `src/modules/ia/refazer.ts`, `src/modules/ia/refazer.test.ts`
**Requirement**: IA-13 (mecanismo)

**Done when**:

- [ ] reprovado na 1ª → segunda tentativa usa o perfil da tarefa de reprocessamento
- [ ] reprovado na 2ª → devolve reprovado, **sem** terceira chamada
- [ ] aprovado na 1ª → nenhuma segunda chamada
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m2): refaz uma vez escalando modelo e esforco`

---

### T72: Gasto do mês e alerta uma vez por período

**What**: custo por geração a partir de `precos_por_modelo`, soma do mês, alerta único ao passar do
teto. **Não desliga nada.**
**Where**: `src/modules/ia/gasto.ts`, `src/modules/ia/gasto.test.ts`
**Requirement**: IA-12

**Done when**:

- [ ] passar do teto alerta **uma vez**; a geração seguinte no mesmo mês não alerta de novo
- [ ] nenhum caminho do código desliga tarefa por causa de gasto
- [ ] preço ausente na config não derruba a chamada — custa `null` e reporta
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m2): soma o gasto de ia e alerta uma vez por periodo`

---

### T73: `frase-do-plano.ts` — a primeira tarefa real

**What**: o script que escreve a frase de abertura de cada plano do dia sem frase, e o workflow que
o dispara às 07:00 UTC.
**Where**: `scripts/jobs/frase-do-plano.ts`, `scripts/jobs/frase-do-plano.test.ts`,
`.github/workflows/frase-do-plano.yml`, `package.json`
**Requirement**: ALUNO-12 · ALUNO-05 AC4 · AD-080 · AD-036 · INFRA-02

**Done when**:

- [ ] escreve **uma** frase por aluno, síncrona (não Batch)
- [ ] falha num aluno deixa `frase = null` e não derruba os outros
- [ ] IA fora do ar: o script sai limpo e o plano continua valendo
- [ ] rerodar não reescreve frase que já existe
- [ ] workflow às 07:00 UTC, depois dos jobs SQL; não roda em PR
- [ ] Gate: `npm test`

**Commit**: `feat(m4): escreve a frase de abertura do plano do dia`

---

### T74: Fechamento — provisionamento, documento e handoff

**What**: `.env.example`, `docs/IA.md` (os defaults vigentes da matriz, que documento pode citar),
o script de semeadura da matriz, `ROADMAP.md` e `STATE.md`.
**Where**: `.env.example`, `docs/IA.md`, `scripts/matriz-de-modelos.mjs`, `.specs/*`
**Requirement**: AD-068 · AD-078

**Done when**:

- [ ] `docs/IA.md` diz qual é a matriz de hoje e como trocá-la sem deploy
- [ ] `ROADMAP.md` e o `## Handoff` do `STATE.md` atualizados
- [ ] Gate: `npm run build && npm run lint && npm test`

**Commit**: `docs(m2): registra a matriz vigente e fecha a spec 08`


---

## Desvios registrados (o que saiu diferente do que este documento previa)

1. **`scripts/jobs/frase-do-plano.mts`, não `.ts`.** O `package.json` não é `type: module`, então o
   `tsx` trata `.ts` como CommonJS e o `await` de topo não compila. A extensão `.mts` resolve sem
   mexer no resto do projeto. Consequência: `tsconfig.json` ganhou `allowImportingTsExtensions`, para
   o teste importar o script pelo nome real.
2. **`tsx` entrou como dependência de desenvolvimento.** A partir daqui todo job da fábrica importa
   módulo do `src/`, e os `.mjs` de hoje não conseguem. `node --experimental-strip-types` foi
   descartado: não resolve o atalho `@/`.
3. **Envio e colheita do lote não foram construídos** — só a montagem da linha JSONL. Está no design
   acima e repetido em `docs/IA.md`: quem tem volume para exercitá-los é a SPEC 09.
4. **`definirLeitorDeConfig` virou público** em `src/modules/config/index.ts`. Era seam de teste;
   agora é também como um job injeta a leitura por `pg` sem duplicar o default em SQL (AD-085).
5. **A verificação independente não foi rodada nesta sessão** — fica como pendência declarada, não
   como omissão silenciosa.

---

## Verificação independente (Ritual B)

Verificador: sessão separada, não escreveu o código. Escopo do Ritual B: **só os Success Criteria**,
evidência `file:line`, sem sensor de mutação. Branch `feat/m2-p1-gateway-de-ia`, `main..HEAD`
(12 commits, 34 arquivos).

| Success Criterion | Veredito | Evidência (file:line) | Observação |
| --- | --- | --- | --- |
| 1. Trocar o modelo na config muda o comportamento sem alterar código | **PASS** | código: `src/modules/config/catalogo.ts:212` (default `{}`), `src/modules/ia/matriz.ts:47-62`, `src/modules/ia/adaptador-openai.ts:59` · teste: `src/modules/ia/matriz.test.ts:72-80`, `src/modules/ia/adaptador-openai.test.ts:29-33`, `src/modules/ia/gateway.test.ts:107-120` | Cadeia em três elos (config → perfil → `model` do pedido); nenhum teste único cobre a ponta a ponta. O id que vai ao provedor é `versao`, não `modelo` (`adaptador-openai.ts:59`): trocar só `modelo` muda preço e auditoria sem trocar a chamada. Está documentado em `docs/IA.md:85`, mas nada valida a coerência dos dois campos. |
| 2. Mudar o esforço de **uma** tarefa não afeta as demais | **PASS** | código: `src/modules/ia/matriz.ts:52`, `src/modules/ia/gateway.ts:251`, `src/modules/ia/adaptador-openai.ts:68` · teste: `src/modules/ia/matriz.test.ts:82-92`, `src/modules/ia/adaptador-openai.test.ts:36-38` | O teste semeia três tarefas com esforços diferentes e confere as três — não é o caso do "semeia os dois lados e não testa a ausência". O esforço é repassado sem interpretação. |
| 3. Derrubar o principal faz o fallback assumir, com registro | **PASS** | código: `src/modules/ia/gateway.ts:255-284` · teste: `src/modules/ia/gateway.test.ts:192-219` (fallback assume, 1 reporte, linha gravada com `usouFallback: true`), `:221-238` (fallback também falha → `GatewayParou`, `gravadas` vazio), `:240-253` (sem fallback, a falha do principal já é a parada) · coluna no banco: `tests/db/ia-geracoes.test.ts:71-93` | Registro provado nos dois lugares: Sentry e linha de `ia_geracoes`. O ramo "sem fallback configurado" tem teste próprio. |
| 4. Rerodar o job da frase não regera frase já escrita nem cobra de novo | **PASS** (com dívida de teste) | código: `scripts/jobs/frase-do-plano.mts:90-97` (`pd.frase is null`), `:172-175` (UPDATE com `and frase is null`) · teste: `scripts/jobs/frase-do-plano.test.ts:192-198`, `:238-254`, `:301-322` | **A prova é estrutural, não comportamental** — ver gap G1. O mecanismo genérico de dedup (`dedup.test.ts:101-124`) **não** é o que segura este job: a frase roda com `alvo: null` e por desenho nunca reaproveita (`gateway.test.ts:138-150`, `dedup.test.ts:157-166`). As duas metades do critério dependem da mesma cláusula SQL: sem plano na consulta, não há chamada e portanto não há custo. |
| 5. IA fora do ar: o plano continua saindo, sem frase | **PASS** | código: `scripts/jobs/frase-do-plano.mts:209-228` (sem chave → `parar: false`), `:154-187` (try por aluno), `:264-268` (sai 0) · teste: `scripts/jobs/frase-do-plano.test.ts:324-341` (adapter quebra → código 0, `atualizacoes` vazio, 1 reporte), `:282-286`, `:217-236` | O teste que se chama "IA fora do ar" (`:296-299`) prova **só** que o código de saída é 0 — ele retorna em `motivoDeParada` antes de abrir conexão, sem tocar em plano nenhum. Quem prova o critério de verdade é `:324-341`. Ver gap G3. |
| 6. Nenhum teste automatizado cita nome de modelo | **PASS** | sensor: `src/modules/ia/sem-nome-de-modelo.test.ts:17-71` · alcance: `vitest.config.mts` inclui teste só de `src/**` e `scripts/**`, e não há `*.test.ts` rastreado fora de `src/`, `scripts/`, `tests/` | Para o critério **literal** (teste) o alcance é completo. O sensor tem pontos cegos para a proibição mais ampla do `AGENTS.md` — ver gap G2. O auto-teste de `:67-71` impede sensor cego, e `:39-41` exige mais de 50 arquivos varridos. |

**Veredito geral: PASS.** Nenhum dos 6 critérios falha. 1 gap `Major`, 4 `Minor`.

### Gaps

**G1 · `Major` · `scripts/jobs/frase-do-plano.test.ts:301-322` (e `:192-198`)** — o Success Criterion 4
não tem teste comportamental. O único teste que toca a idempotência do job por comportamento usa
`bancoFalso([])`, que devolve as linhas que recebeu **qualquer que seja a consulta**
(`frase-do-plano.test.ts:60-79`): apagar `pd.frase is null` de `CONSULTA_DOS_PLANOS` deixa esse teste
verde. O que sobra como prova é a asserção de substring em `:195` — ela trava o texto contra remoção
acidental, mas não executa a cláusula. É o padrão dos gaps G2/G8 da SPEC 05 (lição 10 do `STATE.md`).
Importa porque este é o critério que protege dinheiro, e porque existe harness de banco vivo com
`plano_dia` (`tests/db/gera-plano.test.ts`, `tests/db/plano-schema.test.ts`) onde um teste de ~10
linhas — dois planos de hoje, um com frase e um sem, rodar `CONSULTA_DOS_PLANOS`, esperar um só —
fecharia as duas metades do critério. O risco residual hoje é baixo (li a consulta e ela está
correta), mas o critério está **assumido**, não provado.

**G2 · `Minor` · `src/modules/ia/sem-nome-de-modelo.test.ts:26,31`** — o que a varredura não alcança:
(a) `git ls-files` só lista arquivo **rastreado** — um teste novo ainda não `git add`ado passa verde
localmente e só quebra depois do stage; (b) `PASTAS_VARRIDAS` cobre `src/`, `scripts/` e `tests/`, e
deixa de fora `.github/workflows/*.yml`, `supabase/migrations/*.sql` e a raiz — nome de modelo
hardcodado numa migração ou num workflow passa (não fere o SC6, que fala de teste, mas fere a
proibição do `AGENTS.md`); (c) `\bgpt-` exige o hífen: `gpt5`, `GPT_5` ou concatenação escapam.
Nenhum desses é violação hoje — conferido em `git ls-files` com a árvore limpa.

**G3 · `Minor` · `scripts/jobs/frase-do-plano.test.ts:296-299`** — o teste chamado "IA fora do ar: sai
limpo, sem escrever nada" não escreve nada porque **não chega a abrir conexão**: `executar` volta em
`motivoDeParada` (`frase-do-plano.mts:236-241`). Ele não observa plano nenhum, então o "sem escrever
nada" do nome não é asserção, é consequência de o teste não ter ido a lugar algum. O nome promete
mais do que o corpo entrega; a prova real do critério 5 está em `:324-341`.

**G4 · `Minor` · `npm run test:db`** — a suíte de banco é **instável** contra o projeto de
desenvolvimento compartilhado. Três execuções seguidas nesta verificação deram resultados diferentes
(números abaixo). Os arquivos que falharam não são tocados por esta spec e passam quando rodados
isolados, então não atribuo a falha à SPEC 08 — mas o gate `npm test` de T73/T74 não é
reprodutivelmente verde, e isso vai morder a SPEC 09 na CI.

**G5 · `Minor` · `scripts/jobs/frase-do-plano.mts:176`** — `escritas += 1` acontece sem olhar
`rowCount`. Quando o `and frase is null` do UPDATE barra a escrita (outra execução escreveu no meio),
o resumo do log conta a frase como escrita. É só relatório, não corrompe dado — mas é o número que
alguém vai olhar para decidir se o job está funcionando.

### Desvios registrados — a justificativa se sustenta?

1. **`.mts` em vez de `.ts`** — sustenta. `npm run build` e `npm run lint` passam, o teste importa
   `./frase-do-plano.mts` (`frase-do-plano.test.ts:30`) e o `allowImportingTsExtensions` do
   `tsconfig.json` é o que torna isso possível. Registrado como AD-095.
2. **`tsx` como dependência de desenvolvimento** — sustenta. O job importa `@/modules/ia` e
   `@/modules/config`; nenhum `.mjs` alcança isso sem reescrever o módulo.
3. **Envio/colheita do lote não construídos** — sustenta, e é o que o `Out of Scope` da spec já dizia
   (SPEC 09). `montarLinhaDeLote` reusa `corpoDoPedido`, então a linha de lote e a chamada síncrona
   não podem divergir (`adaptador-openai.ts:105-117`).
4. **`definirLeitorDeConfig` público** — sustenta. É o que evita duplicar a leitura da configuração
   em SQL solto dentro do job (`frase-do-plano.mts:249`).
5. **"A verificação independente não foi rodada"** — **resolvido por este relatório.** A dívida
   `Major` nº 0 do `## Dívida aberta` do `STATE.md` pode ser fechada; entra no lugar dela a G1.

### Comandos rodados (números reais)

| Comando | Resultado |
| --- | --- |
| `npm run test:unit` | **38 arquivos, 283 testes, 283 passando**, 0 falhas (3,20s) |
| `npm run test:db` (1ª execução) | **2 falhas** — `tests/db/gera-plano.test.ts` ("os edge cases da spec" e "aluno sem perfil nao ganha plano nenhum") |
| `npm run test:db` (2ª execução) | **1 falha** — `tests/db/tentativas-particao-endurecida.test.ts` > "rodar duas vezes nao erra e nao duplica gatilho"; 273/274 |
| `npm run test:db` (3ª execução) | **31 arquivos, 274 testes, 274 passando**, 0 falhas |
| `npx vitest run --project db` nos 2 arquivos que falharam, isolados | **26 passando, 0 falhas** |
| `npm run lint` | `ESLint: No issues found` |
| `npm run build` | verde, 9 rotas geradas |

Os testes de banco desta spec (`tests/db/ia-geracoes.test.ts`) passaram nas três execuções.


### Correção dos gaps (autor, depois do relatório)

| Gap | O que foi feito | Onde |
| --- | --- | --- |
| **G1 `Major`** | **Fechado.** A consulta do job passou a ter teste **contra o banco de verdade**: dois planos de hoje, um com frase e um sem, e a consulta tem que trazer um só. Conferido por mutação — trocar `pd.frase is null` por `true` deixa o teste vermelho. Cobre também "não é de hoje", o `left join` do perfil e o corte por `meta_cheia` na consulta dos blocos | `tests/db/frase-do-plano-consulta.test.ts` |
| **G2 `Minor`** | **Fechado em duas das três pontas.** A varredura passou a cobrir `.github/` e `supabase/`, e o padrão da OpenAI virou `gpt[-_ ]?\d`, que alcança `gpt5` e `GPT_5`. **Continua aberto**: `git ls-files` só enxerga arquivo rastreado, então um arquivo novo ainda não `git add`ado escapa localmente. Fecha no `git add`, e a CI sempre roda sobre árvore commitada | `src/modules/ia/sem-nome-de-modelo.test.ts:17,26-38` |
| **G3 `Minor`** | **Fechado.** O teste foi renomeado para o que ele prova (`sem chave, sai limpo sem nem abrir conexao`) e ganhou a asserção que faltava: o abridor de conexão injetado **levanta erro** se for chamado | `scripts/jobs/frase-do-plano.test.ts` |
| **G4 `Minor`** | **Não fechado — não é desta spec.** A instabilidade é do banco de desenvolvimento compartilhado, em arquivos que a SPEC 08 não toca. Registrado como dívida no `STATE.md` para a SPEC 09, que é quem vai sentir na CI | — |
| **G5 `Minor`** | **Fechado.** `escritas` só conta quando o UPDATE afetou linha (`rowCount`); linha barrada pelo `and frase is null` conta como não escrita. `ClienteSql` passou a expor `rowCount`, e o banco falso do teste unitário passou a devolvê-lo | `scripts/jobs/frase-do-plano.mts`, `src/modules/ia/repositorio-pg.ts:16` |

Gate depois das correções: `test:unit` **284/284**, `test:db` **278/278**, `lint` limpo, `build` verde.
