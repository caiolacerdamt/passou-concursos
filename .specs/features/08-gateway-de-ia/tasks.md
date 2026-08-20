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
