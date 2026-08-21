# SPEC 09 — Ingestão do primeiro lote · Design embutido + Tasks

> **Ritual B** (AD-090): design embutido aqui no topo, sem `design.md` separado. Verificador
> independente **curto** (só os *Success Criteria*, com evidência `file:line`, sem sensor de mutação)
> como seção no fim deste arquivo.
>
> Numeração: **T75…T86** (a SPEC 08 fechou em T74).

---

## Design (embutido)

### O problema em uma frase

Um PDF oficial de prova precisa virar N linhas em `questoes`, com proveniência, gabarito conferido e
tópico classificado, **sem** que uma interrupção no meio reprocesse (e recobre) o que já foi feito, e
**sem** que nenhum pedido ao modelo passe de 272K tokens.

### As cinco decisões que explicam o resto

**1. O texto é extraído localmente; o que vai ao modelo é texto, não o binário.**
A alternativa literal do BANCO-03 AC1 ("entrada de PDF nativa do provedor") exige ou mandar a prova
inteira em cada bloco — que é exatamente o que o AC2 proíbe — ou escrever um cortador de PDF que
produz um sub-PDF por bloco. O primeiro estoura o teto de tokens; o segundo é uma indústria, e esta
spec é um script. Extrair o texto nativo página a página resolve os dois ACs de uma vez e é o
**mesmo trabalho** que a decisão de `precisa_ocr` já obriga a fazer: só dá para dizer que um PDF não
tem texto nativo depois de tentar lê-lo. Registrado como desvio consciente no fim deste documento.

**2. O leitor de PDF é nosso, sem dependência nova.** `src/modules/acervo/pdf.ts` faz o mínimo:
conta páginas, inflaciona os `stream` de conteúdo com `node:zlib` e lê os operadores de texto
(`Tj`, `TJ`, `'`, `"`), e localiza os `XObject` de imagem `DCTDecode` (JPEG), que são bytes de JPEG
prontos. É pouco código, é testável com PDF sintético montado no próprio teste, e não coloca um
parser de PDF no caminho crítico de um produto que ingere 3–4 provas.

**3. O fatiamento é por página, com orçamento de tokens.** `fatiamento.ts` agrupa páginas até um
teto de tokens estimado. O teto vem de configuração (`param.m1.teto_tokens_por_pedido`), e existe
uma **trava dura**: bloco que ainda assim estoure o teto **para o job**, não é enviado torto.
Página sozinha maior que o teto vira bloco de uma página e é reportada.

**4. A retomada é uma tabela, não uma flag.** `prova_lote` guarda uma linha por bloco, com chave de
dedup `prova:<id>:bloco:<n>:v<versão do prompt>`. Reenviar a mesma prova não remonta bloco que já
tem linha; colher duas vezes não insere questão duas vezes (o índice único
`questoes_numero_unico_na_prova` é a segunda rede). É o AD-036 aplicado: job retomável, e nada do
que já foi pago é pago de novo.

**5. A extração usa Batch API; a classificação de tópico anda junto do mesmo resultado.**
`extracao_pdf` está marcada `batch: true` na matriz vigente, então o gateway **recusa** a chamada
síncrona (`TarefaEhDeLote`) — e é por isso que o envio e a colheita do lote, que a SPEC 08 deixou de
propósito para cá, entram nesta spec. O tópico sugerido vem no mesmo JSON da extração: pedir de novo
seria uma segunda chamada por questão pelo mesmo texto. A **decisão** sobre o tópico é código nosso:
casa com `topicos` por nome normalizado ou vira `topico_candidato`. Nunca cria tópico canônico.

### Peças

| Arquivo | O que é |
| --- | --- |
| `src/modules/acervo/pdf.ts` | leitor mínimo de PDF: páginas, texto nativo, imagens JPEG |
| `src/modules/acervo/fatiamento.ts` | blocos de páginas dentro do teto de tokens (IA-17) |
| `src/modules/acervo/extracao.ts` | instrução, JSON Schema da saída estruturada e validação do que voltou |
| `src/modules/acervo/classificacao.ts` | tópico sugerido → canônico ou candidato (BANCO-05 P3 AC1) |
| `src/modules/acervo/gabarito.ts` | o que o gabarito muda em cada questão, e se isso é versão nova |
| `src/modules/acervo/ingestao.ts` | persistência: prova, blocos, questões, imagens, status |
| `src/modules/ia/lote.ts` | envio e colheita da Batch API, com cliente injetável |
| `supabase/migrations/*_ingestao.sql` | `prova_lote`, carimbo de `provas.atualizada_em`, `cruzar_gabarito()` |
| `scripts/jobs/ingestao-de-prova.mts` | o job: `enviar` e `colher` |
| `scripts/jobs/cruzar-gabarito.mts` | o job do gabarito definitivo |
| `.github/workflows/ingestao.yml` | disparo manual em GitHub Actions — **nunca** Vercel |

### Fluxo

```
ingestao-de-prova --prova <id> --pdf <arquivo> enviar
  ├─ lê o PDF                → sem texto nativo? provas.status = 'precisa_ocr', fim (BANCO-12)
  ├─ fatia em blocos         → nenhum bloco acima do teto de tokens (IA-17)
  ├─ para cada bloco SEM linha em prova_lote:  monta a linha JSONL do gateway
  ├─ envia o arquivo à Batch API, grava o id do lote em prova_lote
  └─ provas.status = 'extraindo'

ingestao-de-prova --prova <id> --pdf <arquivo> colher
  ├─ para cada lote enviado: consulta o provedor; ainda rodando? deixa para depois
  ├─ valida cada resposta contra o schema  → inválida derruba só aquele bloco
  ├─ insere as questões (idempotente por (prova, numero)), status 'rascunho'
  │    ├─ tópico sugerido: casa com `topicos` ou vira `topico_candidato`
  │    └─ questão com imagem: sobe o JPEG ao Storage; falhou → 'em_revisao', imagens = []
  └─ todos os blocos colhidos → provas.status = 'extraida'

cruzar-gabarito --prova <id> --gabarito <arquivo>
  ├─ casa por `numero` com a versão vigente
  ├─ primeira vez: UPDATE (resposta_correta, gabarito_versao, anulada)
  ├─ retificação: INSERT de versão nova, mudanca_tipo = 'substantiva' (BANCO-13)
  └─ provas.status = 'gabarito_cruzado'
```

### O que a IA **não** decide aqui

A alternativa correta (invariante nº4) — vem do gabarito oficial. O tópico canônico
(BANCO-05 P3 AC1) — a IA sugere, o código só casa ou enfileira. O status `publicada` — não é desta
spec (SPEC 10); tudo nasce `rascunho` ou `em_revisao`.

### Riscos aceitos

| Risco | Decisão |
| --- | --- |
| `OPENAI_API_KEY` não provisionada e nenhum PDF real na mão | todo o caminho é testado com cliente duplo e PDF sintético; o job sai limpo sem a chave |
| Imagem que não é JPEG (bitmap inflado) | não é extraída; a questão cai em `em_revisao` — é o que o M1 manda |
| Estimativa de tokens é aproximada (~4 chars/token) | a trava é sobre a **estimativa com margem**, e a margem vive em configuração |
| Prova com numeração fora de ordem | `numero` vem do que o modelo leu na página, nunca do índice do laço |

---

## Test Coverage Matrix

| Camada de código | Tipo de teste | Cobertura esperada | Local | Comando |
| --- | --- | --- | --- | --- |
| Módulo TS (`src/modules/acervo/*`, `src/modules/ia/lote.ts`) | unit | todos os ramos; 1:1 com os Success Criteria | `src/modules/**/*.test.ts` | `npm run test:unit` |
| Migração SQL (`prova_lote`, `cruzar_gabarito`) | integration (banco) | idempotência, versão nova na retificação, privilégios | `tests/db/*.test.ts` | `npm run test:db` |
| Jobs | unit | caminho feliz, escaneada, retomada, sem chave | `scripts/**/*.test.ts` | `npm run test:unit` |

Nenhum teste cita nome de modelo.

---

## Tasks

### T75: Chaves de configuração do M1 e o teto de tokens

**What**: `param.m1.teto_tokens_por_pedido`, `param.m1.margem_do_teto`, `param.m1.chars_por_token`,
`param.m1.bucket_de_imagens`.
**Where**: `src/modules/config/catalogo.ts`
**Requirement**: IA-17 · AD-078

**Done when**:

- [ ] o teto default é 272000 e é lido da configuração, nunca de constante em código de envio
- [ ] catálogo continua sem chave órfã (`tests/db/catalogo-sem-orfa.test.ts`)
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m1): declara as chaves de configuracao da ingestao`

---

### T76: Leitor mínimo de PDF

**What**: páginas, texto nativo por página, imagens JPEG por página, e a decisão "tem texto nativo".
**Where**: `src/modules/acervo/pdf.ts`, `src/modules/acervo/pdf.test.ts`
**Requirement**: BANCO-12 AC3 · BANCO-11 AC4

**Done when**:

- [ ] PDF com texto nativo devolve o texto por página, na ordem
- [ ] PDF sem operador de texto é reconhecido como escaneado
- [ ] `stream` comprimido com Flate é lido; sem compressão também
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m1): le texto nativo e imagens de um pdf`

---

### T77: Fatiamento em blocos com orçamento de tokens

**What**: agrupar páginas em blocos abaixo do teto; parada visível quando não dá.
**Where**: `src/modules/acervo/fatiamento.ts`, `src/modules/acervo/fatiamento.test.ts`
**Requirement**: IA-17 · BANCO-03 AC2

**Done when**:

- [ ] nenhum bloco produzido passa do teto
- [ ] prova longa vira mais de um bloco; prova curta vira um só
- [ ] página sozinha acima do teto é recusada de forma visível, não truncada
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m1): fatia a prova em blocos dentro do teto de tokens`

---

### T78: Schema da extração e validação do que voltou

**What**: a instrução estável, o JSON Schema `strict` da saída e a validação zod de cada questão.
**Where**: `src/modules/acervo/extracao.ts`, `src/modules/acervo/extracao.test.ts`
**Requirement**: BANCO-03 AC1/AC6

**Done when**:

- [ ] o schema exige `numero`, `enunciado`, `tipo_questao`, `confianca_ia`
- [ ] questão fora do contrato do acervo é rejeitada com motivo, sem derrubar as irmãs
- [ ] nada no schema permite `status = 'publicada'`
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m1): fixa o schema da extracao de questoes`

---

### T79: `prova_lote`, carimbo de `provas` e privilégios

**What**: a tabela de retomada, o gatilho de `atualizada_em` que faltava em `provas` (dívida nº6).
**Where**: `supabase/migrations/<ts>_ingestao.sql`, `tests/db/ingestao-lote.test.ts`
**Requirement**: AD-036 · BANCO-03

**Done when**:

- [ ] `(prova_id, bloco)` é único e a chave de dedup também
- [ ] `provas.atualizada_em` é carimbada no UPDATE
- [ ] fechada para `anon`/`authenticated`, RLS ligada sem policy
- [ ] Gate: `npm run test:db`

**Commit**: `feat(m1): cria a tabela de retomada do lote de extracao`

---

### T80: Envio e colheita da Batch API

**What**: o que a SPEC 08 deixou para cá — subir o JSONL, criar o lote, ler o estado, baixar a saída.
**Where**: `src/modules/ia/lote.ts`, `src/modules/ia/lote.test.ts`
**Requirement**: IA-02 AC9 · AD-036

**Done when**:

- [ ] o arquivo enviado é o JSONL de `montarLinhaDeLote`, uma linha por pedido
- [ ] lote ainda rodando devolve "espera", não erro
- [ ] linha de saída com erro não contamina as outras do mesmo lote
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m2): envia e colhe o lote da batch api`

---

### T81: Classificação de tópico — candidato, nunca canônico

**What**: casar o tópico sugerido com `topicos`; o que não casar vira `topico_candidato`.
**Where**: `src/modules/acervo/classificacao.ts`, `src/modules/acervo/classificacao.test.ts`
**Requirement**: BANCO-05 P3 AC1

**Done when**:

- [ ] tópico existente (mesmo com acento/caixa diferentes) casa e vira `topico_id`
- [ ] tópico inexistente vira candidato pendente e **nenhum** `insert` em `topicos`
- [ ] o mesmo candidato sugerido de novo soma `ocorrencias` em vez de duplicar
- [ ] Gate: `npm run test:unit` e `npm run test:db`

**Commit**: `feat(m1): classifica topico sem criar canonico sozinho`

---

### T82: Persistência das questões extraídas

**What**: inserir o bloco colhido, idempotente, com proveniência da prova e imagens no Storage.
**Where**: `src/modules/acervo/ingestao.ts`, `src/modules/acervo/ingestao.test.ts`
**Requirement**: BANCO-03 AC6 · BANCO-11 AC4 · BANCO-01

**Done when**:

- [ ] questão nasce `rascunho`; imagem que falhou põe a questão em `em_revisao`
- [ ] `fonte_citacao` sai da prova + `numero` oficial da questão
- [ ] colher o mesmo bloco duas vezes não cria a segunda linha
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m1): grava as questoes extraidas de forma idempotente`

---

### T83: Cruzamento de gabarito e retificação

**What**: `cruzar_gabarito()` em SQL: preenche `resposta_correta`/`gabarito_versao`, marca anuladas,
e retificação vira **versão nova**.
**Where**: mesma migração da T79, `src/modules/acervo/gabarito.ts`, `tests/db/cruzar-gabarito.test.ts`
**Requirement**: BANCO-04 AC1/AC2/AC3 · BANCO-13

**Done when**:

- [ ] rodar duas vezes o mesmo gabarito não cria versão nova
- [ ] gabarito diferente do gravado cria versão nova com `mudanca_tipo = 'substantiva'`
- [ ] a tentativa antiga continua apontando para a versão que respondeu
- [ ] gabarito que chega antes da extração não quebra: casa o que existe
- [ ] Gate: `npm run test:db`

**Commit**: `feat(m1): cruza o gabarito definitivo e versiona a retificacao`

---

### T84: Job da ingestão + workflow

**What**: `enviar` e `colher` numa linha de comando só, e o workflow manual do GitHub Actions.
**Where**: `scripts/jobs/ingestao-de-prova.mts`, `scripts/jobs/ingestao-de-prova.test.ts`,
`.github/workflows/ingestao.yml`, `package.json`
**Requirement**: BANCO-03 AC5 · AD-036 · INFRA-02

**Done when**:

- [ ] PDF escaneado põe a prova em `precisa_ocr` e **não** chama o modelo
- [ ] reenviar não remonta bloco que já tem linha
- [ ] sem `OPENAI_API_KEY` o job avisa e sai limpo
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m1): liga o job de ingestao de prova`

---

### T85: Job do gabarito + workflow

**What**: ler o arquivo de gabarito e chamar `cruzar_gabarito()`.
**Where**: `scripts/jobs/cruzar-gabarito.mts`, `scripts/jobs/cruzar-gabarito.test.ts`,
`.github/workflows/ingestao.yml`
**Requirement**: BANCO-04 · AD-036

**Done when**:

- [ ] aceita JSON e CSV `numero,resposta,anulada`
- [ ] gabarito sem `versao` é recusado — versão é o que distingue preliminar de definitivo
- [ ] Gate: `npm run test:unit`

**Commit**: `feat(m1): liga o job de cruzamento de gabarito`

---

### T86: Fechamento — documento, roadmap e handoff

**What**: `docs/INGESTAO.md`, `.env.example`, `ROADMAP.md`, `STATE.md`.
**Where**: `docs/INGESTAO.md`, `.specs/*`
**Requirement**: AD-090

**Done when**:

- [ ] o documento diz como ingerir uma prova do zero, com os dois comandos
- [ ] `ROADMAP.md` e o `## Handoff` do `STATE.md` atualizados
- [ ] Gate: `npm run build && npm run lint && npm test`

**Commit**: `docs(m1): registra o pipeline de ingestao e fecha a spec 09`
