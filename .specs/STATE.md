# STATE

> **Fonte da verdade viva.** Decisão nova entra aqui, append-only, como `AD-NNN`. AD maior vence AD
> menor. **Nunca edite uma AD existente** — AD nova que diz o que substitui.
>
> O log de `AD-001` … `AD-088` mora em **`.specs/STATE-ARQUIVO.md`**. Consulte-o quando precisar do
> texto de uma AD específica; **não** o leia por rotina (AD-090).
>
> Projeto: SaaS de Concursos (bancário — foco BB). Módulos: M1 banco de questões · M2 camada de IA ·
> M3 áudio · M4 coluna vertebral · M5 Raio-X · M6 gamificação · M7 LGPD/flywheel · M8 negócio ·
> M9 infra.

## Decisions

### AD-089
- **Decision**: **O trabalho é recortado em 36 specs, com o MVP fechando na SPEC 14** — substitui o
  recorte de 42 da AD-086, que mantinha o lançamento no fim da 32. A ordem passa a ser por **valor
  entregue**, não por camada de arquitetura: a fundação da interface sai da posição 15 para a **07**
  (ela só depende do Sentry, nunca dependeu do acervo), e o acervo, a oferta e o dinheiro vêm logo
  atrás. As specs de 15 a 36 são a mesma matéria de antes, renumeradas e reordenadas; **nenhum
  requisito dos 9 módulos foi descartado** — o que mudou foi *quando* cada um é construído. Ficam
  fundidas: extração + gabarito (nova 09), QA + explicações (nova 10), interface + conta + deploy
  (nova 07), checkout + funil (nova 12), onboarding + plano + sessão (nova 13). O mapa velho → novo
  está no cabeçalho de cada spec, no campo `Vem de`.
- **Reason**: Dividir 9 specs temáticas em 42 numeradas não dividiu o trabalho — dividiu o entregável
  e **multiplicou o custo fixo por rodada**. Esse custo (ler todo o contexto, produzir 4 documentos,
  rodar verificação independente) é quase o mesmo numa spec de 5 tasks e numa de 30, então passar de
  9 para 42 rodadas multiplicou o pedágio por ~4,7 sem aumentar o trabalho útil. Medido nas quatro
  specs concluídas: 2.150 linhas de documento de processo para 18 tasks, e 2.846 linhas de teste
  contra 2.562 de código de aplicação. Pior que o custo era o **sequenciamento**: quatro specs
  concluídas e nenhuma tela; o lançamento a 28 specs de distância. O produto precisa existir para ser
  vendido, e o acervo — não a interface — é o caminho crítico.
- **Trade-off**: Perde-se a granularidade fina de commit por fronteira temática: cinco pares de specs
  agora sobem juntos, e um erro numa delas tem blast radius maior. As specs 09, 10, 12 e 13 ficam no
  teto de 12 tasks, sem folga — se o Tasks desmentir para cima, dividir **antes** de entrar em
  Execute. A renumeração invalida toda referência "SPEC NN" escrita antes desta data em qualquer
  documento fora de `.specs/` — inclusive nas conversas anteriores.
- **Scope**: transversal — `.specs/ROADMAP.md`, `.specs/features/**`, `AGENTS.md`, `CLAUDE.md`.
- **Date**: 2026-08-17
- **Status**: active

### AD-090
- **Decision**: Três mudanças de método, válidas de agora em diante. **(a) Ritual proporcional ao
  risco.** Cada spec declara `Ritual` no cabeçalho: **A** (design.md próprio + tasks + validation +
  **Verificador independente completo**, AC por AC com sensor de mutação) só para dinheiro, dado
  imutável e apagamento irreversível — são 7 das 36 (05, 12, 14, 18, 24, 28, 33); **B** (design
  embutido no tasks.md + **Verificador independente curto**: só os Success Criteria, com evidência
  `file:line`, **sem sensor de mutação**) é o caso comum; **C** (tasks direto + autoverificação do
  autor) para mudança mecânica. **`autor ≠ verificador` não cai em nenhum ritual** — o que o B corta
  é o escopo do verificador, não a independência dele. A skill `tlc-spec-driven` roda o Verificador
  completo por padrão; **o ritual declarado na spec substitui esse padrão**, porque as regras do
  projeto vencem as da skill. `tasks.md` tem teto de ~10 linhas por task, e **meta numérica de teste está
  proibida** — nada de `+8 testes (total ≥ 151)`. **(b) O `STATE.md` foi cortado em dois**: handoff e
  decisões novas ficam aqui; `AD-001…AD-088` foram para `.specs/STATE-ARQUIVO.md`, que **não** é
  leitura de rotina. **(c) Cortes de escopo do MVP**, cada um com o destino registrado: tutor → 24;
  Raio-X núcleo × condicional e atualidade → 20/27; anel, "no prazo" e progresso → 19; painel do
  operador → 15; verificação quantitativa por fórmulas → 22 (no 1º lote a conta é conferida à mão);
  busca híbrida → 23; ciclo de vida da explicação e botões de feedback → 21; diagnóstico adaptativo e
  IA do plano inicial → 32; staging por branch e link mágico → 25; **LGPD formal (grupos, auditoria,
  canal do titular, retenção automática) → 16/17/18**. O primeiro lote de acervo é **focado**: 3–4
  provas nas matérias de maior peso, não 10 anos das 3 bancas.
- **Reason**: O `STATE.md` tinha 104 KB e é lido em toda fase de toda spec — ~26 mil tokens por
  leitura, crescendo a cada AD por ser append-only. Era o desperdício isolado mais caro do projeto. O
  ritual uniforme era o segundo: sensor de mutação numa tabela de configuração custa o mesmo que num
  webhook de pagamento e vale muito menos. Os cortes do item (c) seguem um critério único — o que não
  está na frase "o aluno vê a página, paga, cria conta, recebe o plano, responde questões com
  explicação, vê o progresso e volta amanhã" não entra.
- **Trade-off**: ⚠️ **O mais pesado é o LGPD.** No lançamento, o pedido de exclusão é atendido por
  **procedimento manual documentado** (a rotina de apagamento existe e é testada na SPEC 14; o que
  falta é o canal formal com prazo de 15 dias, a exportação, a auditoria e a retenção automática).
  Isso é defensável com dezenas de alunos e **deixa de ser** com milhares — a SPEC 18 vira urgente
  antes disso, e a política sobe com redação própria porque o advogado ainda não respondeu.
  Em segundo lugar, o **Ritual B abre mão do sensor de mutação** na maioria das specs: sem sensor
  sobra teste que passa sem provar nada, e foi exatamente isso que a SPEC 04 mostrou (4 de 6 mutações
  medidas, uma contada por raciocínio). O verificador continua independente, mas confere menos
  superfície — aceito conscientemente fora dos caminhos de dinheiro e de dado. Em terceiro, cortar o
  tutor tira da página de vendas o argumento mais vistoso — **a página SHALL NOT prometê-lo**.
- **Scope**: transversal — método de trabalho e escopo do lançamento.
- **Date**: 2026-08-17
- **Status**: active

### AD-091
- **Decision**: Em **tabela particionada append-only**, a trava de três camadas do AD-084 **não
  basta** — ela protege a tabela-pai e deixa cada partição aberta. Toda tabela particionada do
  projeto passa a exigir mais três peças, aplicadas **por partição**: (1) `revoke all` de
  `anon`/`authenticated`; (2) `enable row level security` sem policy nenhuma; (3) o gatilho
  `before truncate for each statement`. Como partição nova nasce a cada mês, isso vira uma **função
  idempotente** (`public.endurecer_particoes_de_tentativas()`, `security definer`, `search_path`
  vazio) chamada em dois lugares: no fim da migração que cria o particionamento e no job de
  `pg_cron`, **logo depois** de `partman.run_maintenance_proc()`, na mesma transação do job. No
  `part_config`, `inherit_privileges = true`. O acesso legítimo não é afetado: o Postgres checa
  privilégio **na tabela-pai**, então revogar tudo na partição fecha só a porta dos fundos.
- **Reason**: Medido no banco de desenvolvimento, com a trava do AD-084 aplicada só no pai:
  `update` e `delete` são bloqueados tanto via pai quanto direto na partição (o Postgres **clona**
  gatilho de linha — era a pergunta aberta que o design do M4 deixou), mas **`truncate` direto na
  partição passou**: gatilho de statement não é clonado. Pior que isso, partição criada em `public`
  nasce com os privilégios do `alter default privileges` do Supabase (`arwdDxtm` para `anon` e
  `authenticated`) e **sem RLS**, porque RLS não se herda — e o PostgREST expõe tudo que está em
  `public`. Ou seja: cada partição era uma cópia de `tentativas` legível inteira, de todos os alunos,
  por qualquer aluno autenticado, por fora de toda policy. Não é risco teórico e não é regressão
  futura: era o estado da tabela no minuto em que ela nasceu.
- **Trade-off**: Sobra uma **janela**: partição criada fora do job (por `create_parent` numa migração
  nova, ou à mão) fica sem RLS e sem gatilho até a próxima manutenção. O `inherit_privileges` já
  entrega o `revoke` no instante da criação, que é a metade que mais importa, mas a janela existe e
  está aceita conscientemente — fechá-la de vez exigiria um **event trigger** em `CREATE TABLE`, que
  é peça global e cara para o tamanho de hoje. Se o risco crescer, a SPEC 16 a fecha. Segundo custo:
  o linter do Supabase passa a reportar `rls_enabled_no_policy` (nível INFO) em cada partição — é o
  desenho, não um defeito, e quem "corrigir" criando policy reabre o buraco.
- **Scope**: `tentativas` (SPEC 05) e toda tabela particionada futura. Complementa o AD-084, não o
  substitui.
- **Date**: 2026-08-17
- **Status**: active

### AD-092
- **Decision**: O **FSRS roda com `enable_short_term: false`** — sem os passos de aprendizado em
  minutos. Continua sendo FSRS com os 21 pesos padrão da biblioteca desde o dia 1 (AD-072); o que se
  desliga é o passo de minutos, não o algoritmo. O valor mora em `param.m4.fsrs_passos_curtos`, para
  o dia em que a unidade da revisão deixar de ser o tópico.
- **Reason**: Medido nesta rodada com `ts-fsrs@5.4.1`: com o default da biblioteca, um cartão novo
  avaliado `Good` volta a vencer **10 minutos depois**. É correto para flashcard, que é o que o FSRS
  foi desenhado para agendar. Aqui a unidade é **tópico** (AD-018/AD-072) e o aluno o vê no máximo
  uma vez por dia — um `due` de 10 minutos faria todo tópico recém-revisado nascer "devendo revisão"
  no mesmo dia, e o motor de prioridade do plano nunca sairia do lugar. Com o passo curto desligado,
  os intervalos da primeira revisão saem em dias: `Again` 1 · `Hard` 2 · `Good` 3 · `Easy` 8.
- **Trade-off**: Perde-se o reforço no mesmo dia para o assunto que o aluno acabou de errar feio — com
  `Again`, o mínimo passa a ser amanhã. É aceito porque o caderno de erros e o bloco Revisar do dia
  seguinte já cobrem esse caso, e porque um `due` no mesmo dia colidiria com o plano diário, que é
  gerado uma vez por dia por `pg_cron`.
- **Scope**: `src/modules/aluno/revisao` (SPEC 06). Complementa a AD-072, não a substitui.
- **Date**: 2026-08-17
- **Status**: active


### AD-093
- **Decision**: A camada de estilo do produto e o **Tailwind CSS v4**, sem biblioteca de componentes.
  Os tokens (paleta, fonte, largura de leitura) moram num unico bloco `@theme` em
  `src/app/globals.css` — a v4 nao tem `tailwind.config.js`. O foco visivel e regra **global** no
  mesmo arquivo, nao decisao de cada componente. Tema claro/escuro fica fora do lancamento.
- **Reason**: O requisito duro da SPEC 07 e **mobile-first sem rolagem horizontal de 360px a
  desktop** (UI-01 AC1/AC2). O Tailwind e mobile-first por construcao: `sm:`/`md:` acrescentam e
  nunca desfazem, que e literalmente o que o AC2 exige. Some-se: zero runtime no cliente, um lugar
  so para token, e nenhum design system para manter antes de existir aluno pagante.
- **Trade-off**: O estilo passa a viver no `className` do JSX — diff de componente fica mais
  ruidoso, e quem le CSS separado estranha. Descartados: **CSS Modules puro**, que obrigaria
  escrever a mao a escala de breakpoints, os tokens e o reset (trabalho que nao e o do produto), e
  **shadcn/ui + Radix**, que traz um design system inteiro e ~20 dependencias para 5 telas. Se o
  produto ganhar um design system de verdade, a troca custa reescrever o `className` das telas —
  aceito, porque sao poucas.
- **Scope**: `src/app/globals.css`, `postcss.config.mjs`, todo componente de UI. Fecha a linha
  "Camada de estilo — em aberto" das Assumptions da SPEC 07.
- **Date**: 2026-08-19
- **Status**: active


### AD-094
- **Decision**: A **matriz de modelos nasce vazia no catálogo de configuração**
  (`param.m2.matriz_de_modelos` e `param.m2.precos_por_modelo` têm default `{}`), e os valores reais
  vivem **só** como linha na tabela `configuracoes`, provisionada por uma pessoa com o SQL de
  `docs/IA.md`. Tarefa sem perfil na matriz é **parada visível** (`TarefaSemPerfil`), nunca um modelo
  adivinhado. Um sensor de varredura (`src/modules/ia/sem-nome-de-modelo.test.ts`) falha se qualquer
  arquivo de `src/`, `scripts/` ou `tests/` citar família de modelo — `gpt-`, `claude-N`, `gemini-`,
  `llama-`, `oN-mini/pro`. Documento continua podendo citar (AD-068).
- **Reason**: O `AGENTS.md` proíbe nome de modelo em código e o AD-078 exige default declarado em
  código. Os dois só cabem juntos se o default for "não há matriz". Qualquer outra saída — default
  com o nome de hoje, `z.enum` com os modelos conhecidos, constante de fallback — reintroduziria o
  acoplamento que o IA-02 AC1 existe para impedir, e o teste que o proíbe é o que faz a regra durar
  depois desta sessão.
- **Trade-off**: Banco novo (dev, preview, produção no dia 1) sobe com **nenhuma tarefa de IA
  funcionando** até alguém rodar o INSERT — é um passo manual a mais em toda instalação, e ele não
  falha ruidosamente: o produto simplesmente não escreve frase, não extrai PDF e não explica. Pior:
  **um perfil malformado invalida a matriz inteira**, não só a linha errada, porque a validação é do
  valor `jsonb` completo. Queda segura, mas um erro de digitação derruba toda a IA de uma vez —
  `npm run ia:matriz` existe para conferir depois de trocar. Se isso incomodar quando houver mais
  tarefas, a saída é validar perfil a perfil e descartar só o inválido, o que exige AD nova.
- **Scope**: `src/modules/config/catalogo.ts`, `src/modules/ia/**`, `docs/IA.md`. Aplica o AD-068 e o
  AD-073; não substitui nenhum.
- **Date**: 2026-08-20
- **Status**: active

### AD-095
- **Decision**: **Job da fábrica é TypeScript rodado por `tsx`**, com extensão **`.mts`**. O primeiro
  é `scripts/jobs/frase-do-plano.mts`. Os `.mjs` que já existem (vigia, db-push, advisors,
  varredura) continuam como estão — não há reescrita. O job lê configuração injetando o próprio
  leitor por `definirLeitorDeConfig` (que passa a ser público) por cima da conexão `pg` do
  `DATABASE_URL`, em vez de reimplementar a leitura em SQL solto.
- **Reason**: A partir da SPEC 08 todo job da fábrica precisa importar módulo do `src/` — o gateway,
  o repositório, o catálogo de configuração. `.mjs` com JSDoc não alcança isso sem reescrever o
  módulo inteiro fora do TypeScript. `node --experimental-strip-types` foi medido e descartado: não
  resolve o atalho `@/` do `tsconfig`. O `.mts` (em vez de `.ts`) é obrigatório porque o pacote não é
  `type: module`: com `.ts`, o `tsx` compila como CommonJS e o `await` de topo — o padrão de todos os
  scripts do projeto — não compila.
- **Trade-off**: Uma dependência de desenvolvimento a mais (`tsx`, que traz o esbuild) e **duas
  convenções de script convivendo** no mesmo diretório — quem abrir `scripts/jobs/` vai ver `.mjs` e
  `.mts` lado a lado sem regra óbvia. O `tsconfig.json` também ganhou
  `allowImportingTsExtensions`, para o teste importar o `.mts` pelo nome real. Aceito porque
  reescrever os quatro `.mjs` existentes seria mexer em código testado e estável para ganhar
  uniformidade e nada mais.
- **Scope**: `scripts/jobs/**`, `package.json`, `tsconfig.json`, `src/modules/config/index.ts`.
- **Date**: 2026-08-20
- **Status**: active


### AD-096
- **Decision**: **A extração de PDF manda ao modelo o texto lido por nós, e não o arquivo PDF como
  entrada nativa do provedor.** O leitor mínimo é `src/modules/acervo/pdf.ts`, sem dependência nova:
  `node:zlib` para os `stream` Flate, os operadores de texto do PDF para o conteúdo, e os `XObject`
  `DCTDecode` para as imagens. Isto **substitui a metade "entrada de PDF nativa do provedor" do
  BANCO-03 AC1**; o resto do AC (saída estruturada por schema) continua valendo e está implementado.
- **Reason**: O BANCO-03 AC2 e o IA-17 exigem que a prova vá em **blocos** e que nenhum pedido passe
  de 272K tokens. Mandar o PDF nativo em cada bloco só tem duas formas: reenviar a prova inteira a
  cada pedido — que é exatamente o que o AC2 proíbe e o que estoura o teto — ou escrever um cortador
  de PDF que produza um sub-PDF por bloco, o que é uma indústria no caminho crítico de um produto que
  vai ingerir 3–4 provas. Além disso, o BANCO-12 AC3 (`precisa_ocr`) **já obriga** a ler o PDF do
  lado de cá: não existe outra forma de afirmar que um PDF não tem texto nativo. Feito o trabalho uma
  vez, usar o resultado é o caminho barato.
- **Trade-off**: O texto sai decodificado como Latin-1, que é o que `WinAnsiEncoding` produz na
  prática. Fonte com codificação própria sai com acento torto; fonte assim na prova inteira faz a
  prova cair em `precisa_ocr`, que é o lado seguro do erro. Perde-se também a chance de o modelo ver
  o **layout** da página — questão em duas colunas depende do `numero` impresso vir no texto, o que a
  instrução cobra explicitamente. Se o primeiro lote real mostrar que o layout importa, a decisão
  volta com o custo medido, não estimado.
- **Scope**: `src/modules/acervo/pdf.ts`, `src/modules/acervo/fatiamento.ts`,
  `scripts/jobs/ingestao-de-prova.mts`.
- **Date**: 2026-08-20
- **Status**: active

### AD-097
- **Decision**: **Toda questão com imagem nasce `em_revisao`**, mesmo quando a imagem sobe ao Storage
  sem erro. Só imagem `DCTDecode` (JPEG) é extraída; qualquer outro formato deixa `imagens` vazio e a
  questão também vai para revisão.
- **Reason**: O BANCO-11 AC4 exige `alt_text` em cada imagem, e o AD-040 o exige não vazio. Esse
  texto é descrição acessível de uma figura — e o modelo leu o **texto** da prova, nunca a imagem.
  Gerar um `alt_text` a partir do enunciado seria inventar descrição, que é pior do que não ter. O
  M1 já manda "imagem que não pôde ser extraída → questão em revisão"; estender isso a "imagem sem
  descrição conferida" é a mesma regra, e no primeiro lote o humano confere na mão de qualquer jeito
  (AD-090).
- **Trade-off**: A fila de revisão da SPEC 10 nasce maior. Aceito: acervo pequeno e certo vale mais
  que acervo grande e torto, e é o fosso que está em jogo. Bitmap inflado exigiria um codificador PNG
  — registrado como limite conhecido em `docs/INGESTAO.md`, não como esquecimento.
- **Scope**: `src/modules/acervo/ingestao.ts`, `src/modules/acervo/pdf.ts`.
- **Date**: 2026-08-20
- **Status**: active

## Handoff

- **Onde o projeto está**: unidade de trabalho é a **spec numerada**. `.specs/ROADMAP.md` tem a
  sequência oficial de **36 specs**; **as 01–14 são o MVP** e o lançamento é o fim da 14 (AD-089).
  Para trabalhar: *"Desenvolva a SPEC XX seguindo a `/tlc-spec-driven`"*, respeitando o `Ritual`
  declarado no cabeçalho da spec (AD-090).
- **Concluído**:
  | Spec | Tasks | Estado |
  | --- | --- | --- |
  | **01 — Fundação** | T1–T4 | ✅ build, lint, teste e CI de pé |
  | **02 — Configuração e flags** | T5–T9 | ✅ **PASS** independente — 8/8 AC, sensor 4/4, 41 testes |
  | **03 — Observabilidade e segredos** | T23–T32 | ✅ **PASS** independente — sensor 6/6, 143 testes, 7 gaps não bloqueantes |
  | **04 — Acervo: schema, taxonomia e proveniência** | T33–T40 | ✅ **PASS** — 9/9 AC + 4 Success Criteria com evidência, **251 testes**. **Verificação NÃO independente** |
  | **05 — Log de tentativas** | T41–T47 | ✅ **333 testes**. Ritual A — verificação independente em `.specs/features/05-*/validation.md` |
  | **06 — Projeções, revisão e plano** | T48–T53 | ✅ **412 testes**. Ritual B — verificação independente no fim de `.specs/features/06-*/tasks.md`. FAIL na 1ª passada (2 `Major`), **corrigidos e reverificados** |
  | **07 — Interface, conta e deploy** | T54–T64 | ✅ **465 testes** (199 unit + 266 db). Ritual B — **PASS** independente, 0 `Major`, 6 `Minor` (3 fechados na rodada). Relatório no fim de `.specs/features/07-*/tasks.md` |
  | **08 — Gateway de IA** | T65–T74 | ✅ **562 testes** (284 unit + 278 db). Ritual B — **PASS** independente, 1 `Major` e 4 `Minor`; o `Major` e 3 `Minor` fechados na rodada, relatório no fim de `.specs/features/08-*/tasks.md` |
  | **09 — Ingestão do primeiro lote** | T75–T86 | ✅ Ritual B. PDF → questões, Batch API, gabarito cruzado. **Verificação independente pendente** — ver `## Dívida aberta` |
- **Next step**: **SPEC 10 — Publicação e explicações**
  (`.specs/features/10-publicacao-e-explicacoes/spec.md`). **Ritual B**. Depende da SPEC 09, agora
  concluída. ⚠️ **As duas travas externas da SPEC 09 continuam de pé e agora bloqueiam valor real**:
  `OPENAI_API_KEY` não provisionada e **nenhum PDF de prova oficial na mão** — o pipeline está
  construído e testado ponta a ponta com PDF sintético e cliente duplo, mas **nenhuma questão real
  existe no banco**.
  O que a SPEC 09 deixou pronto: `scripts/jobs/ingestao-de-prova.mts` (`enviar`/`colher`) e
  `scripts/jobs/cruzar-gabarito.mts`, os dois em `.github/workflows/ingestao.yml` por disparo manual;
  `src/modules/acervo` passou a ser o pipeline inteiro (`pdf`, `fatiamento`, `extracao`,
  `classificacao`, `ingestao`, `gabarito`); `src/modules/ia/lote.ts` é o envio e a colheita da Batch
  API que a SPEC 08 tinha deixado para cá. Toda questão nasce `rascunho` ou `em_revisao` — **a porta
  de publicação é da SPEC 10**, e é ela que vai ler `confianca_ia` e a fila de revisão. Passo a passo
  do operador em `docs/INGESTAO.md`.

### Dívida aberta

0. **Major (SPEC 09) — a verificação independente ainda não foi rodada.** O autor rodou a
   autoverificação contra os 8 *Success Criteria* e registrou o resultado no fim de
   `.specs/features/09-*/tasks.md`, mas `autor ≠ verificador` **não** foi cumprido nesta rodada. É a
   mesma dívida que a SPEC 04 abriu e a SPEC 08 fechou; fica declarada, não silenciosa. O que mais
   precisa de olho de fora: o leitor de PDF (`src/modules/acervo/pdf.ts`), que é código novo sem
   nenhum PDF real para conferir, e o `cruzar_gabarito()`, que mexe em dado imutável.

0b. **Minor (SPEC 08) — `npm run test:db` é instável contra o banco de desenvolvimento.** Medido na
   verificação independente: três execuções seguidas deram 2 falhas, 1 falha e 0 falhas, em
   `tests/db/gera-plano.test.ts` e `tests/db/tentativas-particao-endurecida.test.ts` — arquivos que a
   SPEC 08 não toca e que **passam quando rodados isolados**. Não é regressão desta spec; é o banco
   compartilhado. Vai morder a CI da **SPEC 09**, que é quem escreve muito no banco. Um ponto cego
   sobrou aberto de propósito no sensor de nome de modelo: `git ls-files` só enxerga arquivo
   rastreado, então arquivo novo sem `git add` escapa localmente (fecha no stage; a CI sempre roda
   sobre árvore commitada).
1. **Major — a SPEC 04 foi verificada pelo próprio autor.** O sensor rodou 4 mutações das 6, e uma
   (flip de `vigente` no `AFTER INSERT`) foi contada por raciocínio, não por medição. Detalhe em
   `.specs/features/04-*/validation.md`. ⚠️ **A SPEC 05 apoiou `tentativas` neste schema sem que o
   Verifier de `5630e06..f2f1850` fosse rodado** — a recomendação continua de pé e agora tem uma
   tabela em cima dela.
2. **Minor — 6 gaps abertos da SPEC 05**, nenhum bloqueante, todos com evidência em
   `.specs/features/05-log-de-tentativas/validation.md`: **G2** INFRA-04 AC3 provado no agendamento e
   não no efeito (nenhum teste chama `run_maintenance_proc()`) · **G3** ALUNO-01 AC5 "recalculável do
   zero" sem asserção — é propriedade das projeções, fecha na SPEC 06 · **G4** dedup testado só
   sequencialmente, nunca com dois cliques concorrentes de verdade · **G7** a suíte valida o banco
   aplicado, não o `.sql` versionado · **G8** `not.toMatch(/Seq Scan/)` é tautológico com
   `enable_seqscan = off` · **G10** o contrato SQL↔TS da recusa é mantido por duas asserções
   paralelas, e o teste unitário do mapeamento continua verde quando o banco muda a mensagem — evitar
   esse padrão quando a SPEC 13 mapear mais motivos.
3. **Major — `sanitizar` achata `Date`/`Error`/`Map` em `{}` em silêncio**
   (`src/modules/observabilidade/saneamento.mjs:144`). A AD-087 tornou `reportarErro` transversal: a
   primeira spec que passar `{ causa: erro }` perde a informação sem erro e sem teste vermelho.
4. **Major — `executar()` do vigia sem teste automatizado** (`scripts/jobs/vigia-de-jobs.mjs:113`).
   `new Client()` construído dentro da função, sem ponto de injeção. O padrão que resolve está no
   mesmo diff (`advisors.mjs:105`, `buscar = fetch`).
5. Minor — desvio do "Done when" de T27 sem `// SPEC_DEVIATION` (`ci.yml:128-131`): job agregador em
   vez de `if: failure()` nos três. Job cancelado ou skipado não dispara `failure()`.
6. ~~Minor — `provas.atualizada_em` sem gatilho de carimbo.~~ **Fechada na SPEC 09** (`20260820110000_ingestao_lote.sql`, com teste em `tests/db/ingestao-lote.test.ts`).
7. Minor — `fts` indexa só o `enunciado`; a SPEC 23 estende com dado real.
8. Minor — precedência `.env` × ambiente duplicada em três scripts, uma cópia sem teste.
9. **Minor — default de configuração duplicado entre catálogo e SQL, sem trava contra deriva**
   (gap G6 da SPEC 06). `gera_plano_do_dia()` e `podar_historico_de_jobs()` repetem em `coalesce`
   os defaults que vivem em `src/modules/config/catalogo.ts`. Mudar um lado não quebra teste nenhum.
   É transversal a toda função SQL que lê configuração, não só a estas duas — fecha na **SPEC 15**,
   junto da tela de configuração.
10. **Lição da SPEC 06 — teste de ordenação que semeia os dois lados não testa o caso frio.** O gap
   `Major` G2 (semente do retrato frio invertida) sobreviveu a dois testes de ordenação porque os
   dois semeavam `dominio_topico` nos dois tópicos comparados. Quando a regra tem um ramo de
   ausência (`coalesce`, `left join`, default), o teste tem que comparar **presente contra ausente**.
11. **Lição da SPEC 06 — função `security definer` concedida a `authenticated` precisa amarrar o
   titular.** O gap `Major` G1 deixou um aluno gravar no log append-only de outro. A SPEC 05 já
   resolvia isso em `registrar_tentativa` amarrando ao dono da sessão; a SPEC 06 repetiu a forma
   (`security definer` + `grant`) sem repetir a defesa. Toda função nova nesse molde SHALL checar
   `auth.uid()` ou não ser concedida a `authenticated`.

12. **Minor (SPEC 07) — `overflow-x: hidden` no `body` mascara `scrollWidth`**
    (`src/app/globals.css:75`). A rede protege o aluno e impede a medição: tela nova com tabela larga
    vai **cortar** conteúdo em silêncio em vez de falhar. O sensor de hoje proíbe `w-[NNNpx]` e não
    alcança `min-width`, `nowrap`, grid de coluna fixa nem `<img>` sem `max-width`. Fecha na SPEC 13.
13. **Minor (SPEC 07) — o contrato "quatro estados, componente único" não tem sensor.** O paywall
    ganhou varredura de diretório; este não. A primeira exceção já existe (`src/app/entrar/page.tsx`
    monta a própria apresentação de erro de credencial, com motivo declarado). Fecha na SPEC 13.
14. **Bloqueio da SPEC 13 — `registrar.ts:34` e `agendar.ts:29` usam a chave de serviço**, que passa
    por cima da RLS. Não é defeito hoje: nenhuma rota os alcança. Mas expor a sessão de questões por
    eles sem trocar para `clienteDaSessao()` criaria caminho de leitura **sem** matrícula.

### Contratos vigentes que nenhuma spec pode contrariar

1. `tentativas` (SPEC 05) referencia `questoes (id, questao_versao)` — é a PK. Matéria e rótulo do
   snapshot saem de `topicos` → `materias` por join no INSERT.
2. `explicacoes` (SPEC 10) referencia o mesmo par e lê `mudanca_tipo`: `cosmetica` não regera,
   `substantiva` regera (IA-09 AC4 / AD-052).
3. Raio-X (SPEC 11) conta `origem='real' and status='publicada' and not anulada and vigente` —
   índice `questoes_origem_status_idx` já existe.
4. **Dimensão do embedding = 1536**, `vector_cosine_ops`. Não vive em configuração: é tipo de coluna.
   Espelho em `src/modules/acervo/contrato.ts`, com teste comparando.
5. `questoes` **não** é append-only — difere de `configuracoes` e `tentativas`. UPDATE na versão
   vigente é o caminho normal das SPECs 09/10/23. Imutável: a versão que saiu de cena, a identidade
   (`id`, `questao_versao`) e a existência da linha.
6. `status_prova` é o vocabulário do estado da ingestão; quem transiciona é a SPEC 09.
7. **`raiox_peso_topico`** é a fronteira entre plano e Raio-X: a SPEC 11 troca o corpo da view sem
   tocar no motor da SPEC 06.
8. **`matricula` é a chave única** do conteúdo pago (SPEC 07). Nenhuma spec inventa outro caminho.
9. **Toda tabela com `user_id` estende a rotina de apagamento da SPEC 14 e o teste dela na mesma
   task** — tabela nova não registrada tem que fazer o teste falhar, não passar em silêncio.
10. **Tabela particionada nova obedece ao AD-091**: `revoke all` + RLS + gatilho de TRUNCATE em cada
    partição, por função idempotente chamada também pelo job de manutenção. `endurecer_particoes_de_
    tentativas()` é o molde. Quem só copiar o AD-084 deixa a tabela aberta.
11. `registrar_revisao(...)` é o único caminho de escrita em `revisao_agenda`/`revisao_evento`, e
    amarra `auth.uid()` ao `p_user_id` quando há sessão. Toda função `security definer` concedida a
    `authenticated` repete essa amarra.
12. **`raiox_peso_topico` tem assinatura `(topico_id, peso)`** e há teste que quebra se a SPEC 11
    renomear ou acrescentar coluna. Trocar o **corpo** é o caminho previsto; trocar a forma não é.
13. **`plano_bloco.nivel ∈ {piso, meta_cheia}`** é o contrato que a SPEC 19 consome. `piso` contém
    só as revisões devidas e **não** é cortado pelo tempo declarado; o corte vale para Avançar e
    Treinar.
14. `registrar_tentativa(...)` é o **único** caminho de escrita em `tentativas`. `security invoker`:
    a RLS vale dentro dela. Quem gravar por INSERT direto (SPEC 09/13) repete o snapshot na mão.
15. Schema: AD-039/040 (questão, **implementados**), AD-042/043/044 (log e projeções), AD-046
    (acumulador anônimo), AD-052 (explicação × versão), AD-056/057 (fórmula do Raio-X), AD-060 (anel
    por bloco), AD-063 (áudio × versão), AD-078/AD-081 (config), AD-082 **substituído pela AD-084**,
    AD-083 (ambiente de teste), AD-085 (cache fora de requisição), AD-086 **substituído pela AD-089**.
16. **Sessão e paywall são perguntas diferentes** (SPEC 07). `src/proxy.ts` decide sessão; a
    matrícula é decidida por `exigirMatriculaAtiva()` na tela e pela policy de `select` do acervo no
    banco. Toda página sob `src/app/app/` SHALL chamar `exigirMatriculaAtiva()` — há varredura de
    diretório que falha se uma nascer sem ela.
17. **A camada de UI é `<Shell>` + `<Estado>`** (SPEC 07, AD-093). Tela nova não monta o próprio
    shell nem o próprio estado de carga/erro/vazio/degradado. Estilo é Tailwind v4, tokens no
    `@theme` de `src/app/globals.css`.
18. **`src/modules/lgpd/grupo-1.ts` é o inventário das tabelas de aluno.** Tabela nova com `user_id`
    que não entrar lá **faz `tests/db/grupo-1.test.ts` falhar** — é o contrato nº 9 com mecanismo.
    Exceção ao apagamento (`pagamentos`/`faturas` da SPEC 12) vai em `EXCECOES_DO_APAGAMENTO`, com
    motivo escrito.
19. **`prova_lote` é a retomada da extração** (SPEC 09). Reenviar uma prova nunca remonta bloco que
    já tem linha, e a chave de dedup embute a versão do prompt. O **destino do modelo é gravado no
    envio** e lido de volta na colheita — ler a matriz na colheita registraria na auditoria um modelo
    que não produziu aquele bloco (IA-02 AC4).
20. **`cruzar_gabarito(prova, itens, versao)` é o único caminho para `resposta_correta`,
    `gabarito_versao` e `anulada`** (SPEC 09). Gabarito diferente do gravado **nunca** vira UPDATE:
    vira `questao_versao` nova marcada `substantiva`, que é o que a SPEC 10 lê para regerar a
    explicação. Rodar duas vezes o mesmo arquivo não versiona nada.
21. **Toda questão que a ingestão grava nasce `rascunho` ou `em_revisao`.** `publicada` não é
    alcançável a partir da SPEC 09 — nem pelo schema da saída estruturada, que não tem campo de
    status, nem pelo INSERT. A porta de publicação é da SPEC 10.

### Armadilhas de Postgres que já foram pagas (não repetir)

1. Gatilho que valida **antes** do INSERT: apagar o selo de `vigente` num `AFTER` chega tarde.
2. `array_agg(enumlabel)` volta como string crua no driver `pg` — cast para `text[]`.
3. `proconfig` guarda o literal `search_path=""`, com as aspas.
4. **`EXPLAIN` em tabela vazia não prova índice nominal.** Exigir "nenhum Seq Scan" (com
   `enable_seqscan = off`) é o que se pode afirmar; nome de índice só onde nenhum outro tem a coluna
   como primeira.
5. **Migração já aplicada não re-roda.** Para corrigir uma da própria branch em dev vazio: `drop` do
   objeto, apagar a linha em `supabase_migrations.schema_migrations`, e `db:push`.

### Trabalho planejado que continua valendo (não refazer)

`.specs/modulos/m4-coluna-vertebral/design.md` e `tasks.md` cobrem **T11–T22**: T11–T15 → **SPEC 05**;
T16–T21 → **SPEC 06**; T22 (frase do plano) → **SPEC 08, feita**. **T10 morreu** (virou a SPEC 04).
Duas correções obrigatórias sobre esse material: (a) a trava de `tentativas` é de **3 camadas**
(AD-084, substitui a receita de 2 do AD-082) — `REVOKE`+RLS, gatilho de linha, e gatilho de TRUNCATE;
(b) `unstable_cache` só vale dentro de requisição do Next (AD-085) — job e script leem direto.

### Perguntas abertas que a próxima spec resolve aplicando

- ~~**SPEC 05**: o gatilho de linha propaga para as partições?~~ **Respondida medindo: propaga.** O
  Postgres clona `BEFORE UPDATE OR DELETE ... FOR EACH ROW` para cada partição, presente e futura, e
  atacar a partição direto também é bloqueado. O que **não** propaga é o gatilho de `TRUNCATE`, e daí
  saiu a **AD-091**.
- ~~**SPEC 06**: FSRS por tópico produz intervalo utilizável?~~ **Respondida medindo: só com
  `enable_short_term: false`** (AD-092). Com o default, `Good` num tópico novo devolve 10 minutos.
- **SPEC 07**: é a única spec sem requisito numerado de origem. Precisa de **Specify curto** criando
  requisitos `UI-NN`, e a escolha da camada de estilo vira **AD nova**.
- **Duas chamadas de IA fora da lista fechada do IA-02**, cada uma travando o Design da sua spec:
  pré-diagnóstico de questão suspeita (**SPEC 29**) e extração do programa do edital (**SPEC 27**).

### Ambiente

- **In-progress** (file:line): none.
- **Branch**: `main` (a SPEC 08 foi mergeada; nada em andamento). `main` protegida pelo hook local `.githooks/pre-push` (a
  proteção do GitHub não funciona em repositório privado no plano Free) — ativar por clone com
  `git config core.hooksPath .githooks`.
- **Infra provisionada**: Supabase **`kfpmetkmhjtmgwgaaerl`**, org "Passou Concursos", **sa-east-1
  (SP)**, Postgres 17.6, plano Free · extensões: `pg_cron` (SPEC 03) e `vector` 0.8.2 (SPEC 04) ·
  **Sentry** org e projeto `passou-concursos`, Free, região **EUA** (AD-087g), alerta por e-mail
  funcionando · **OpenAI provisionada em 2026-08-20**: `OPENAI_API_KEY` no `.env`, matriz e preços
  inseridos em `configuracoes` com **`gpt-5.6-luna` nas 9 tarefas** (decisão de 2026-08-20, substitui
  a Terra no refaz do AD-073 — o refaz escala só o esforço, `high` → `max`). Cadeia conferida de
  ponta a ponta com chamada real: `frase_do_plano` respondeu, custo US$ 0,000032 registrado em
  `ia_geracoes`. `npm run ia:matriz` mostra o vigente. **Não provisionados**: **Vercel — o código da SPEC 07 está pronto e o site não sobe sem a conta ligada (`docs/DEPLOY.md`)**, Asaas + CNPJ (SPEC 12),
  PostHog (SPEC 12), Cohere (SPEC 23) — tabela completa no `ROADMAP.md`.
- **Segredos no GitHub**: `DATABASE_URL`, `SENTRY_DSN`, `SUPABASE_ACCESS_TOKEN`. O `SENTRY_DSN` está
  lá por conveniência do YAML, **não porque seja segredo** (AD-087f, com teste negativo na varredura).
- **MCP do Supabase — resolvido, não repetir o erro**: o `${VAR}` do `.mcp.json` expande da variável
  de ambiente do **sistema operacional**; o bloco `env` de `.claude/settings.local.json` **não**
  alimenta essa expansão. A variável global do Windows contém o token de **outra conta**. O servidor
  `supabase-passou` está registrado no **escopo local** (`~/.claude.json`), que vence o `.mcp.json`.
- **Achados de ambiente**: (1) `--env-file` e `process.loadEnvFile()` não sobrescrevem variável já
  existente no sistema; (2) conexão direta `db.<ref>.supabase.co` não resolve nesta máquina — usar o
  **Session pooler, porta 5432**; (3) o Vitest usa reporter `minimal` dentro de agente e esconde
  `console.warn` — depurar com `--reporter=default`; (4) `next build` já é o typecheck, não existe
  script `typecheck`; (5) **Next 16 reescreve o `AGENTS.md` sozinho** (bloco
  `<!-- BEGIN:nextjs-agent-rules -->` a cada `next dev`) — não decidido se aceita ou desliga com
  `agentRules: false`; (6) **RTK filtra saída e esconde erro** — se um comando falhar com resumo sem
  detalhe, repita com `rtk proxy <comando>`.
- **Pendências que não travam o começo**: advogado (base legal das questões AD-003; janela de 24m
  AD-045; LIA AD-026; instrumento da transferência para os EUA, art. 33 LGPD, AD-079; texto da
  política e encarregado, SPEC 14) · contador (**CNPJ/regime — é o bloqueio de calendário mais longo
  do MVP**) · contrato do Asaas · preço do Cohere embed-v4 · teste cego da voz (trava a SPEC 35) ·
  free tier do PostHog em fonte primária · critério de morte do produto.
