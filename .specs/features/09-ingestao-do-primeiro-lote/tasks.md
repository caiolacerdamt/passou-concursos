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

---

## Desvios registrados (o que saiu diferente do que este documento previa)

1. **O texto é extraído por nós; o PDF nativo não vai ao provedor.** É metade do BANCO-03 AC1, e a
   troca está registrada como **AD-096**, com o motivo medido: mandar o PDF nativo por bloco ou
   reenvia a prova inteira a cada pedido (o que o AC2 proíbe e o que estoura o teto do IA-17) ou
   exige um cortador de PDF. O `precisa_ocr` do BANCO-12 já obriga a ler o PDF do lado de cá.
2. **Toda questão com figura nasce `em_revisao`**, não só quando a imagem falha — **AD-097**. O
   `alt_text` acessível não existe até uma pessoa olhar a figura.
3. **Três migrações, não uma.** O `tasks.md` previa `cruzar_gabarito()` na mesma migração da T79.
   Migração já aplicada não re-roda (armadilha nº5 do `STATE.md`), e cada task fechou com commit
   atômico — então saíram `20260820110000_ingestao_lote`, `20260820120000_topico_candidato`,
   `20260820130000_cruzar_gabarito` e `20260820140000_prova_lote_destino`.
4. **`prova_lote` ganhou a coluna `destino`**, que o design não previa. Descoberto ao escrever a
   colheita: envio e colheita são execuções separadas por até 24 horas, e a matriz pode ter mudado de
   modelo no meio (AD-078). Ler a matriz na colheita registraria em `ia_geracoes` um modelo que não
   produziu aquele bloco — auditoria mentirosa (IA-02 AC4).
5. **A T81 trouxe migração junto** (`registrar_topico_candidato` + índice único parcial), que o
   `Where` da task não previa. Sem ela, a mesma sugestão viraria N linhas iguais e `ocorrencias`
   nunca sairia de 1 — o número que a tela da SPEC 15 usa para ordenar a fila.
6. **A verificação independente não foi rodada nesta sessão.** Fica como pendência declarada e como
   dívida `Major` no `STATE.md`, não como omissão silenciosa.

---

## Autoverificação do autor (Ritual B — **não** substitui o verificador independente)

Escopo: os 8 *Success Criteria* da spec, com evidência `file:line`. Sem sensor de mutação.
**Isto não cumpre `autor ≠ verificador`** — quem escreveu o código escreveu esta tabela.

| Success Criterion | Veredito | Evidência (`file:line`) |
| --- | --- | --- |
| 1. Prova real nativa vira N linhas estruturadas com `confianca_ia` | **PASS parcial** | código: `src/modules/acervo/pdf.ts:317` (lê o PDF), `fatiamento.ts:110` (blocos), `extracao.ts:66` (schema), `ingestao.ts:187` (grava) · teste: `tests/db/ingestao-questoes.test.ts:47` (insere de verdade, `confianca_ia` incluída), `scripts/jobs/ingestao-de-prova.test.ts` (`lote pronto grava as questoes`). **Parcial porque "prova real" não existe**: nenhum PDF oficial está na mão. O caminho é exercido ponta a ponta com PDF sintético e cliente duplo |
| 2. Nenhum pedido ao modelo passa de 272K tokens | **PASS** | código: `src/modules/acervo/fatiamento.ts:135` (fecha o bloco antes de estourar), `:130` (página sozinha maior que o teto **para**, não trunca), `:69` (teto × margem, os dois de configuração) · teste: `fatiamento.test.ts` (`nenhum deles passa do teto`, `pagina sozinha acima do teto e parada visivel`, `o fatiamento respeita o teto que a configuracao mandar`) |
| 3. Prova escaneada cai em `precisa_ocr` sem tentativa de extração | **PASS** | código: `scripts/jobs/ingestao-de-prova.mts:113` (a decisão vem antes de qualquer gasto) · teste: `scripts/jobs/ingestao-de-prova.test.ts` (`PDF sem texto nativo cai em precisa_ocr sem enviar lote nenhum` — assere que o cliente de lote recebeu **zero** chamadas e que nenhum bloco foi registrado), `src/modules/acervo/pdf.test.ts` (`PDF sem operador de texto nenhum e escaneado`) |
| 4. Mesma prova duas vezes não duplica; interromper e retomar não reprocessa | **PASS** | código: `src/modules/acervo/ingestao.ts:124` (`on conflict (prova_id, bloco) do nothing`), `:229` (`on conflict (prova_id, numero) where vigente`) · teste **de comportamento contra o banco**: `tests/db/ingestao-questoes.test.ts` (`colher o mesmo bloco duas vezes nao cria a segunda questao` — conta as linhas), `tests/db/ingestao-lote.test.ts` (as duas unicidades) · retomada do envio: `scripts/jobs/ingestao-de-prova.test.ts` (`reenviar nao remonta bloco que ja tem linha`) |
| 5. Rodar o gabarito preenche `resposta_correta` + `gabarito_versao` e marca as anuladas | **PASS** | código: `supabase/migrations/20260820130000_cruzar_gabarito.sql` (ramo "ainda sem gabarito") · teste: `tests/db/cruzar-gabarito.test.ts` (`preenche resposta_correta e gabarito_versao e marca as anuladas`) — anulada é mantida em **uma** versão, conferido |
| 6. Retificar gabarito de questão respondida cria versão nova; a tentativa antiga segue apontando para a versão que respondeu | **PASS** | código: mesma migração, ramo da retificação (INSERT com o mesmo `id`) · teste: `tests/db/cruzar-gabarito.test.ts` (`retificacao cria versao nova... sem reescrever a anterior` e **`a tentativa antiga continua apontando para a versao que o aluno respondeu`**, que grava uma tentativa de verdade antes de retificar) |
| 7. Tópico sugerido inexistente vira candidato e não cria tópico canônico | **PASS** | código: `src/modules/acervo/classificacao.ts:109` (só casa ou enfileira; não há `insert into topicos` no arquivo) · teste: `classificacao.test.ts` (`nunca escreve em topicos` varre o SQL emitido), `tests/db/topico-candidato.test.ts` (`nao cria topico canonico: a taxonomia nao muda de tamanho`, e a soma de `ocorrencias`) |
| 8. Nenhuma linha do pipeline roda em função da Vercel | **PASS** | sensor: `src/modules/acervo/fora-da-vercel.test.ts` — varre `src/app/`, `src/proxy.ts` e `src/lib/` por caminho **e** por símbolo reexportado, tem autoteste contra sensor cego, e assere que os jobs existem como `.mts` fora do build do Next |

### O que a autoverificação **não** conseguiu provar

- **O leitor de PDF contra um PDF real.** Todos os testes usam PDF montado no próprio teste. Ele
  cobre o que uma banca publica (objetos diretos, Flate, árvore de páginas normal), mas isso é
  afirmação minha, não medição. É o item de maior risco desta spec.
- **A forma da resposta do provedor.** `lote.test.ts` monta a linha de saída da Batch API a partir da
  documentação; nenhuma linha real da OpenAI passou por aqui, porque não há chave.
- **Que o `alt_text` provisório é aceitável.** Ele é provisório por decisão (AD-097) e a questão vai
  para revisão por causa dele — mas ninguém revisou nenhuma ainda.

### Comandos rodados (números reais)

| Comando | Resultado |
| --- | --- |
| `npm run test:unit` | **404 testes, 404 passando**, 0 falhas |
| `npm run test:db` | **306 testes, 306 passando**, 0 falhas |
| `npm run lint` | `ESLint: No issues found` |
| `npm run build` | verde, 9 rotas |
| `npx tsc --noEmit` | `No errors found` |


---

## Verificação independente (Ritual B) — rodada em sessão separada

Verificador: sessão separada, não escreveu o código. Escopo do Ritual B: **só os Success Criteria**,
evidência `file:line`, sem sensor de mutação. Gates que ele rodou: `npm run test:unit` (408 testes,
0 falhas) e `npm run lint` (limpo). Ele **não** rodou `test:db` (banco compartilhado) — e disse isso.

**Veredito geral: aprovado.** Os 8 critérios cumpridos. 1 gap `Major`, 4 `Minor`.

Ele confirmou o que a autoverificação já dizia (SC1 é parcial: "prova real" não era verificável no
momento em que ele rodou) e **discordou num ponto** — encontrou um buraco operacional que a
autoverificação não viu:

| Gap | O que era | O que foi feito |
| --- | --- | --- |
| **G1 `Major`** — bloco `falhou` fica preso (`ingestao-de-prova.mts:249`) | `enviar` não remonta (a linha já existe) e `colher` não enxerga (só olha `enviado`); como fechar a prova exige todos `colhido`, a prova **nunca fechava**. A saída seria editar o banco na mão | **Fechado.** `blocosParaEnviar()` devolve `montado` **e** `falhou`; o reenvio limpa o `erro`. Teste: `ingestao-de-prova.test.ts` (`bloco que falhou volta a ser enviado`) |
| **G2 `Minor`** — teste com nome que promete medir token e não mede | "prova longa vira mais de um bloco **e nenhum passa do teto**" só assertava contagem de bloco | **Fechado.** Renomeado para o que ele afirma, com o ponteiro para onde o teto é provado de verdade |
| **G3 `Minor`** — o teto media o bloco, não o pedido | a instrução estável + o schema (~3 mil tokens) viajam em toda linha do lote e não entravam na conta | **Fechado.** `fatiarEmBlocos(..., custoFixo)`, descontado do teto útil. Dois testes, incluindo o contrafactual |
| **G4 `Minor`** — SC5/SC6 sem cobertura em `test:unit` | a regra do BANCO-04 vive em plpgsql e só é exercida em `test:db` | **Não fechado, aceito.** Reimplementar a regra em TS para ter teste unitário criaria duas fontes da mesma verdade. A CI roda `test:db` (`ci.yml:117`) |
| **G5 `Minor`** — dedup de questão, no unitário, é decidida pelo dublê | `bancoFalso({questaoJaExiste:true})` devolve `[]` por decreto | **Não fechado, aceito.** A dedup real é provada em `tests/db/ingestao-questoes.test.ts`, contra o banco. O verificador conferiu à mão que o predicado do índice casa com o do `on conflict` |

---

## O primeiro lote real — medido, não estimado

Rodado nesta mesma rodada, com as 3 provas do BB 2021 (Cesgranrio) e a chave da OpenAI provisionada.

| | Prova A |
| --- | --- |
| Páginas / blocos | 17 / 5 |
| Questões inseridas | **70 de 70**, 0 recusadas |
| `status` | 69 `rascunho`, 1 `em_revisao` (figura), **0 `publicada`** |
| Gabarito | 70 preenchidas, 0 anuladas, 0 retificadas |
| `confianca_ia` | 0,91 a 0,99 |
| Candidatos a tópico abertos | 70 · **0 tópicos canônicos criados** |
| Custo | **US$ 0,045** (21.051 tokens de entrada, 34.083 de saída, Batch) |

O que o PDF real mudou no código, e que nenhum teste sintético teria pego:

1. **A prova inteira cabia num pedido só** — 19 mil tokens contra um teto útil de 218 mil. O teto de
   tokens **nunca** corta uma prova real, e o BANCO-03 AC2 estava sendo cumprido por acaso. Entrou
   `param.m1.paginas_por_bloco`.
2. **Quatro `getParam` em `Promise.all`** são quatro consultas concorrentes na mesma conexão `pg`,
   que o driver deprecou. Virou um `getParams`.
3. **A instrução subiu para a v2**: hífen de quebra de linha, cabeçalho repetido em toda página,
   números de linha do texto de apoio, e a ordem de copiar o texto-base em cada questão que depende
   dele. Sem a última, as 10 primeiras questões de Língua Portuguesa seriam impossíveis de responder
   fora da prova.
4. **O gabarito oficial veio como imagem (PNG)**, não como texto. Transcrito à mão para CSV, um
   arquivo por caderno, conferido linha a linha. Não há OCR no MVP.

---

## O que o primeiro lote real ensinou (rodada de correção)

As três provas foram ingeridas de verdade. **Cinco defeitos apareceram, e nenhum deles teria
aparecido em teste sintético.** Todos foram corrigidos com teste nesta mesma rodada.

| # | O que quebrou | Causa | Correção |
| --- | --- | --- | --- |
| 1 | A prova inteira ia num pedido só | 19 mil tokens contra teto útil de 218 mil: o teto de tokens **nunca** corta uma prova real, e o BANCO-03 AC2 estava sendo cumprido por acaso | `param.m1.paginas_por_bloco` (default 4) — a trava que sempre corta |
| 2 | Aviso do driver `pg` | quatro `getParam` em `Promise.all` são quatro consultas concorrentes na mesma conexão, o que o `pg` deprecou | um `getParams` |
| 3 | Bloco de 17 questões perdido no INSERT | `unsupported Unicode escape sequence`: o modelo devolveu 8 bytes nulos, e o `jsonb` os recusa | `semCaracteresDeControle` na colheita, antes de qualquer gravação |
| 4 | Bloco cortado pelo provedor, sempre no mesmo lugar | a instrução v2 mandava o modelo **repetir o texto-base em cada questão**; numa página de Língua Inglesa com 5 questões sobre uma reportagem, o filtro de conteúdo disparou | instrução **v3**: `textos_base` é campo próprio e a junção é código nosso |
| 5 | Mesmo bloco continuou falhando com a v3 | as quatro páginas juntas ainda disparam, embora **cada uma passe sozinha** — medido | reenvio vai **uma página por linha**; `juntarPaginas` remonta |

Dois erros meus foram encontrados no meio do conserto, e também estão corrigidos: subir a versão
do prompt quebraria a correspondência da colheita (a `chave_dedup` gravada ficaria na versão
antiga), e a decisão de `precisa_ocr` só perguntava se saiu *alguma coisa* — um PDF com fonte de
codificação própria sai cheio de texto ilegível e passaria pela porta.

### Três comandos que faltavam, e por quê

| Comando | Existe porque |
| --- | --- |
| `--acao inspecionar` | as duas primeiras provas foram enviadas sem que ninguém tivesse olhado o texto extraído. Roda sem banco, sem chave e sem gastar |
| `--acao estado` | as duas falhas do primeiro lote foram descobertas **escrevendo SQL na mão**. Isso não pode ser o procedimento |
| reenvio repartido | um bloco falhado reenviado igual falha igual, para sempre |

### A trava de legibilidade não pode reprovar Língua Inglesa

É requisito, não detalhe: toda prova bancária tem seção em inglês, e reprovar essa página mandaria
a prova **inteira** para uma fila de OCR que não existe no MVP — o erro mais caro possível, porque
é silencioso e joga fora acervo bom. A medida é de **escrita alfabética**, não de idioma:
proporção de caracteres plausíveis e proporção de vogais, com teste em português, inglês e
espanhol. Medido nos três cadernos reais: 96% e 34%; os pisos estão em 60% e 15%.