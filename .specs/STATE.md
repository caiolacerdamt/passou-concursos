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

### AD-098
- **Decision**: A SPEC 10 fecha a publicação em duas camadas. No banco, um gatilho exige proveniência,
  gabarito oficial, explicação aprovada vigente e, quando aplicável, revisão humana por baixa confiança,
  amostra determinística ou origem `gerada_ia`; a função de publicação só fica disponível ao serviço.
  Na fábrica, a referência é documento `conferido` do tópico — oficial antes de resumo nosso — ou uma
  fonte mínima composta pela questão e pelo gabarito. A saída estruturada exige citações e o código
  compara cada trecho normalizado com a referência entregue. Resultado inválido não publica: fica fora
  de vigência e abre a fila única `questao_revisoes`. A execução acontece no job standalone
  `scripts/jobs/explicacoes.mts`, nunca no pedido do aluno.
- **Reason**: A alternativa correta é verdade do gabarito, não da IA; a explicação precisa justificar
  sem criar uma segunda fonte de verdade. O gatilho protege mesmo chamadas diretas ao banco, e a chave
  de dedup do gateway mais a unicidade de `explicacoes` torna a retomada segura.
- **Trade-off**: Sem documento curado, a explicação pode usar apenas a fonte mínima e a base entra na
  fila para construção. A operação da fila continua no Supabase Studio até a SPEC 15; o job manual não
  liga nenhuma tela e, sem chave de IA, sai limpo sem impedir o núcleo do produto.
- **Scope**: SPEC 10 · M1/M2 · `questao_revisoes`, `base_referencia`, `explicacoes`, porta de publicação,
  contrato de explicação e job standalone.
- **Date**: 2026-08-21
- **Status**: active

### AD-099
- **Decision**: O roteamento de QA da SPEC 10 acontece automaticamente em trigger `AFTER INSERT` da
  questão e em alteração de origem/confiança: baixa confiança, amostra real determinística e origem
  `gerada_ia` abrem uma pendência em `questao_revisoes` antes da publicação. Para fonte mínima, além
  da declaração estruturada da IA, a conferência local rejeita marcadores de norma, prazo, percentual
  e regra externa no texto.
- **Reason**: A trava de publicação sozinha detectava a falta de revisão, mas não deixava trabalho
  persistido para o operador; e uma lista declaratória não é prova de que o texto não contém fato
  externo. O caminho seguro é abrir a fila no nascimento da questão e falhar fechado na conferência.
- **Trade-off**: A guarda textual é conservadora e pode enviar uma explicação válida para revisão
  humana. Isso é preferível a publicar uma afirmação externa sem documento; a base mínima continua
  permitindo explicações que não usam esses marcadores.
- **Scope**: `supabase/migrations/20260821093000_roteamento_qa_spec10.sql`,
  `src/modules/ia/explicacao.ts`, testes da SPEC 10.
- **Date**: 2026-08-21
- **Status**: active

### AD-100
- **Decision**: A SPEC 11 modela `perfil_concurso` como cadastro global multi-concurso, com no máximo
  um perfil `ativo`. No MVP, `programa_edital` é um array JSON de UUIDs canônicos de `topicos`; quando
  `banca='indefinida'`, a frequência combina as bancas declaradas em `param.m5.bancas`. A tela nasce
  atrás de `flag.m5.raiox=false`; sem perfil ativo, a view mantém o fallback `1.0` da SPEC 06 para não
  quebrar o plano antes da configuração do edital.
- **Reason**: A primeira versão precisa persistir o esqueleto do edital sem antecipar o diff com citações
  da SPEC 27, atender o BB antes da banca ser anunciada e manter o contrato do motor do plano durante a
  transição entre as specs.
- **Trade-off**: O array de UUIDs não guarda ainda a citação ou a redação do edital; essa estrutura entra
  quando o pivot do edital for construído. A combinação de bancas não entrega núcleo/condicional, que fica
  para a SPEC 20.
- **Scope**: SPEC 11 · `perfil_concurso`, `raiox_projecoes`, configuração M5 e tela do Raio-X.
- **Date**: 2026-08-21
- **Status**: active

### AD-101
- **Decision**: A projeção do Raio-X usa amortecimento suave em direção à média, sem teto absoluto de
  posição baseado apenas em `n_questoes`. O recálculo é idempotente nos valores de negócio; a coluna
  `atualizado_em` registra cada execução para observabilidade. Fora do programa, o tópico é omitido da
  view do plano, representando peso lógico zero.
- **Reason**: O contrato da SPEC 11 exige reduzir a instabilidade de amostras pequenas, preservar a
  projeção anterior quando o job falha e deixar o motor do plano inalterado. Um teto rígido de ranking
  seria uma regra adicional de ordenação não prevista no requisito formal.
- **Trade-off**: Uma amostra pequena pode continuar em posição alta se a evidência amortizada ainda for
  maior; a tela explicita `amostra_baixa`. Reexecutar não repete os valores de negócio, mas muda o
  timestamp operacional.
- **Scope**: SPEC 11 · `recalcula_raiox`, `raiox_projecoes`, `raiox_peso_topico` e tela do Raio-X.
- **Date**: 2026-08-21
- **Status**: active

### AD-102
- **Decision**: O e-mail de definição/recuperação de senha disparado por código de servidor usa o
  fluxo SSR de **`token_hash`**: o template do Supabase aponta para `/auth/confirm`, o handler aceita
  somente `type=recovery`, chama `verifyOtp` no cliente de sessão e encaminha para `/definir-senha`.
  O callback PKCE `/auth/callback` continua sendo o caminho de OAuth e das recuperações iniciadas
  pelo navegador.
- **Reason**: O cliente de serviço que roda após o webhook não compartilha com o navegador o verifier
  PKCE. Com o template padrão, o Supabase devolve os tokens em um fragmento (`#...`), que nunca chega
  ao servidor; o teste manual comprovou que o aluno caía na home/login em vez de definir a senha.
  `token_hash` é o formato que o fluxo SSR consegue verificar no servidor e transformar em cookie.
- **Trade-off**: A instalação precisa trocar uma vez o link do template **Reset Password** e incluir
  `/auth/confirm` nas Redirect URLs do Supabase. Se isso não for feito, o código permanece seguro,
  mas o link falha fechado e volta ao login. O token não é repassado à tela nem gravado em log.
- **Scope**: SPEC 12 · `src/app/auth/confirm/route.ts`, `src/modules/pagamentos/repositorio.ts`,
  template de e-mail e `docs/DEPLOY.md`. Complementa o contrato de sessão das specs 07/12.
- **Date**: 2026-08-21
- **Status**: active

### AD-103
- **Decision**: **Integração de dinheiro trata confirmação do gateway como assíncrona por padrão.**
  Nenhuma operação financeira externa pode depender de a resposta da própria chamada já trazer o
  estado final: pede-se, registra-se o pedido com a hora local, e o fechamento acontece quando o
  evento de confirmação chega. Vale para estorno (implementado na SPEC 12) e SHALL valer para
  antecipação, renovação e conciliação de NF na SPEC 28. Junto disso, três regras de método para
  spec de dinheiro: **(a)** o gateway falso prova o fluxo, nunca o contrato externo — nem o endereço
  da chamada nem o tempo da resposta; **(b)** homologação em sandbox exige **lastro real** no
  ambiente (no Asaas, pagar a própria cobrança por Pix copia e cola; confirmar por botão ativa mas
  não estorna); **(c)** dependência que o caminho principal precisa é **obrigatória no tipo** — a
  opcional que ninguém ligou vira no-op silenciosa em produção, e nenhum teste pega, porque o teste
  liga a sua própria.
- **Reason**: Os quatro defeitos da homologação da SPEC 12 têm a mesma raiz. F-11 (endpoint errado do
  estorno de parcelamento), F-15 (reembolso nunca fechava porque nada tratava a confirmação tardia) e
  F-16 (registro do pedido nulo porque a dependência opcional não foi ligada) passaram por toda a
  bateria de testes com gateway falso — que aceitava qualquer id, respondia na hora e trazia as
  próprias dependências. O dia de homologação também custou duas tentativas de estorno perdidas por
  uma instrução errada registrada na rodada anterior ("use Confirmar pagamento"), que ativa a conta
  sem criar lastro.
- **Trade-off**: Assumir assincronia encarece o caminho simples: exige evento de confirmação
  assinado, estado intermediário visível ao usuário ("pedido em análise") e pendência operacional
  para o que não fecha sozinho. Aceito — o custo do contrário é dinheiro devolvido com acesso ligado.
  Fica em aberto o estorno de **cartão parcelado**, provado só por teste e doc; o primeiro em
  produção SHALL ser acompanhado.
- **Scope**: `.specs/features/12-*`, SPEC 28, e toda integração de pagamento futura.
- **Date**: 2026-08-22
- **Status**: active

### AD-104
- **Decision**: A suíte `db` continua sequencial contra o Supabase de desenvolvimento, mas reutiliza
  uma conexão PostgreSQL em um pool de tamanho 1 durante o worker. Cada teste conserva sua própria
  transação revertida. O projeto Vitest de banco compartilha módulos no worker único. Na CI, o banco
  roda em job separado do build/lint/unitários; execução obsoleta do mesmo PR é cancelada e somente
  um job acessa o banco de desenvolvimento por vez.
- **Reason**: A suíte abriu e encerrou cerca de 326 conexões por execução. Na CI, o handshake remoto
  e as viagens serializadas ao banco consumiram de 588 a 894 segundos, enquanto build, lint e testes
  unitários ficaram perto de um minuto.
- **Trade-off**: Estado de módulo passa a sobreviver entre arquivos do projeto `db`. A execução
  sequencial e o `ROLLBACK` por teste preservam o isolamento de dados; módulos com cache continuam
  responsáveis por restaurar seu próprio estado nos hooks. A reescrita de fixtures só entra depois
  de medir esta etapa.
- **Scope**: `tests/db/conexao.ts`, `vitest.config.mts` e `.github/workflows/ci.yml`.
- **Date**: 2026-08-22
- **Status**: active

### AD-105
- **Decision**: A confirmação do direito ao esquecimento será enviada pelo servidor ao Resend via HTTPS,
  usando apenas o e-mail do titular e um texto mínimo; sem `RESEND_API_KEY` ou remetente verificado, a
  operação SHALL falhar fechada e SHALL NOT invalidar a conta como se tivesse concluído.
- **Reason**: O produto precisa confirmar o apagamento antes de invalidar o endereço, mas ainda não possui
  provedor transacional. Um no-op silencioso deixaria o titular sem prova e repetiria a falha de dependência
  opcional registrada na AD-103.
- **Trade-off**: Resend se torna operador internacional declarado na política e exige configuração de domínio
  e credencial antes do go-live; o ganho é uma confirmação verificável e uma etapa retomável.
- **Scope**: SPEC 14 e futuras notificações transacionais de privacidade, até decisão posterior.
- **Date**: 2026-08-22
- **Status**: active

### AD-106
- **Decision**: A ilustração da landing SHALL ser render 3D chunky com fundo recortado, revogando a
  regra de `DESIGN.md` §Ilustração que proíbe render 3D e manda *flat paper-cut vector*. A proibição
  segue valendo para qualquer outra superfície; o que muda é só a landing. Junto entram no `@theme`
  os tokens do lado escuro (`--color-breu*`), os dois de preenchimento do movimento assinatura
  (`--color-pilha-papel`, `--color-pilha-sedimento`) e as duas sombras da landing.
- **Reason**: O dono escolheu explicitamente o 3D chunky depois de ver as duas opções lado a lado, na
  rodada de protótipo em `scrollcraft/builds/passou-lp`. A regra do paper-cut nasceu de uma limitação
  do `gpt-image-2` via OpenRouter, que não aceitava transparência; a série nova tem alfa de verdade e
  senta direto no chão da seção, sem moldura. Escolha de direção de arte, não descuido.
- **Trade-off**: A landing passa a ter uma linguagem de ilustração diferente do resto do produto — o
  que é aceitável porque o app não tem ilustração nenhuma (`DESIGN.md`, modo Operate). O custo real é
  peso: sete PNG de ~1 MB em `public/arte/`, servidos por `next/image`, dois deles com `priority`.
- **Scope**: Rota `/` e os componentes de `src/modules/ui/landing/`. Substitui a linha "proibido:
  render 3D" de `DESIGN.md` §Ilustração **apenas** para a landing.
- **Date**: 2026-08-25
- **Status**: active

### AD-107
- **Decision**: O motor de scroll `scrollcraft.js` SHALL entrar como asset estático não editado em
  `public/motor/`, montado por um client component após a hidratação; as sete seções SHALL continuar
  server components, expondo só ganchos `data-sc-*`. O comportamento próprio da página (barra,
  movimento assinatura e contador) SHALL viver em `src/modules/ui/landing/assinatura.ts` e SHALL NOT
  depender de ordem de execução em relação ao motor.
- **Reason**: O motor é JS vanilla que escreve em `window` no topo do arquivo; importá-lo quebraria a
  renderização no servidor, e "adaptar para importar" seria editar o motor pela porta dos fundos. A
  independência de ordem não é preferência: com `<Script afterInteractive>` o motor monta depois do
  `useEffect`, e a primeira medida do gráfico caía num palco ainda sem altura — os 86 chips ficavam
  empilhados e o pico inteiro nascia em branco. O conserto é um `ResizeObserver` no campo, que mede
  de novo quando a caixa muda, venha a mudança do motor, da fonte ou da janela.
- **Trade-off**: O motor fica fora do lint (`eslint.config.mjs` ignora `public/motor/**`) e fora do
  matcher do `proxy.ts` — sem essa segunda exceção o visitante deslogado recebia o HTML de `/entrar`
  no lugar do script. Em troca, atualizar o motor é trocar um arquivo.
- **Scope**: Rota `/`. Não vale para o app logado, que não usa o motor.
- **Date**: 2026-08-25
- **Status**: active

### AD-108
- **Decision**: A frequência real que a landing mostra SHALL sair do banco por
  `consultarFrequenciaReal()` (módulo do acervo, cache de 1 h), contando somente `origem = 'real'`
  entre as questões vigentes, e SHALL cair no extrato congelado de 2026-08-25 em qualquer falha de
  leitura, reportando o erro. Nenhum número da página SHALL ser escrito na copy — incluindo o selo de
  economia da oferta, que é a subtração entre os dois preços da configuração.
- **Reason**: O protótipo trazia um `raiox.js` congelado. Congelado, ele mente na próxima prova
  ingerida — e a página inteira existe para dizer que a medida é real. A queda existe porque a
  alternativa a um número velho não é um gráfico vazio: é o último número verdadeiro que temos, com o
  erro no Sentry. A cláusula `origem = 'real'` é o invariante 3 do `AGENTS.md` e vem de dentro da view
  `inventario_acervo`, na coluna `importadas`.
- **Trade-off**: A landing passa a depender do cliente de serviço do Supabase (a view é fechada para
  `anon`), e o extrato precisa ser regerado quando o acervo crescer — `frequencia.test.ts` falha se um
  dos números que a copy cita mudar, que é o alarme desejado.
- **Scope**: Rota `/` e `src/modules/acervo/frequencia.ts`. A tela do Raio-X do aluno (SPEC 11) segue
  na sua própria consulta.
- **Date**: 2026-08-25
- **Status**: active

### AD-109
- **Decision**: O movimento da landing SHALL ser contínuo e dirigido por `--sc-p`, nunca por
  revelação de `clip-path` disparada uma vez. As artes das seções 5, 6 e 7 e os dois cartões
  `hoje × ainda não` SHALL usar transform contínuo; `data-sc-reveal` fica apenas na seção 3, que o
  dono aprovou. O herói SHALL ter **uma** ilustração (`/arte/heroi-medida.png`), não duas sobrepostas.
  E os 86 chips do pico SHALL cair **em cascata por posto**, com o nome do tópico escrito no papel
  desde o repouso em telas ≥ 900px.
- **Reason**: Revisão de design pedida pelo dono depois de ver a página no ar. Três queixas, três
  causas: (a) as duas artes do herói eram peças posicionadas em absoluto — só ficam juntas na largura
  em que foram posicionadas, e no celular saíam cortadas por bordas diferentes; (b) o corte de
  `clip-path` é um evento que dispara e termina, e três deles na mesma página viram tique — pior nos
  cartões, onde o corte decepa texto no meio da palavra; (c) o pico movia os 86 papéis com uma curva
  só e sem rótulo visível, então o leitor via um monte virar outro monte sem ver a regra sendo
  aplicada. O nome no papel é o que transforma 86 retângulos em 86 tópicos do edital.
- **Trade-off**: O rótulo na pilha custa uma leitura de `offsetWidth` por chip em cada `medir()` (para
  a escala caber na folha) e fica **desligado abaixo de 900px** — lá a folha não comporta texto
  legível e 86 escritas de estilo a mais por quadro não se pagam. No celular a leitura fica só com a
  cascata e o eixo. A fita de tópicos do herói é `aria-hidden`: é a mesma informação que o pico
  entrega em texto de verdade.
- **Scope**: Rota `/` — `secoes.tsx`, `assinatura.ts`, `landing.css` e a arte nova. Motor
  (`public/motor/scrollcraft.js`) intocado, como manda a skill.
- **Date**: 2026-08-25
- **Status**: active

### AD-110
- **Decision**: A copy da landing SHALL vender o método (o que o aluno recebe), não a ausência de
  aprovação nem o roteiro do que falta construir. Concretamente: (a) o headline, a sub, o CTA do herói
  e o CTA da barra mudam de tom informativo/defensivo para direto; (b) a seção "hoje × ainda não"
  perde o cartão "ainda não" — fica só o que já está de pé, sob o título "O que você recebe quando
  assina"; (c) o headline do fecho deixa de abrir com "Esta página não promete aprovação" e passa a
  fechar em tom positivo, mantendo a mesma ressalva (sem fórmula mágica, sem aprovação garantida) como
  frase de apoio, não como manchete. Isto **revoga**, só para esta página, a AC2 de `m8-negocio-
  pagamentos/spec.md §P1` ("a página SHALL declarar honestamente o que existe hoje e o que não
  existe") e o trecho equivalente da AD-076.
- **Reason**: Pedido direto do dono depois de ler a página no ar: a copy inteira soava genérica,
  defensiva e não deixava claro o que a plataforma entrega nem por que alguém pagaria. Ele foi
  avisado, nesta conversa, de que a seção "ainda não" e o headline "não promete aprovação" vinham de
  uma decisão registrada (AD-076) sobre nunca prometer o que não existe — e manteve a decisão de
  tirar mesmo assim. O produto continua sem prometer nada que não entrega: só deixou de haver, na
  página de vendas, uma seção dedicada a enumerar o que falta.
- **Trade-off**: A landing não avisa mais o comprador, na própria página, sobre tutor de IA, tela do
  Raio-X, diagnóstico adaptativo e gamificação além da sequência ainda não estarem ligados. Esse aviso
  continua valendo como fato do produto (nada disso é vendido em nenhum outro texto da página); só
  deixou de ser exibido como lista. Se isso gerar reclamação ou reembolso por expectativa não batida,
  é o primeiro sinal de que a AD precisa ser revista.
- **Scope**: Rota `/` — `secoes.tsx` (Heroi, Problema, Medida, Metodo, Hoje, Oferta), `estrutura.tsx`
  (barra: CTA + link `/entrar` que faltava) e `landing.css` (regra nova só para o link de entrar).
  `page.test.tsx` ajustado para guardar a AC nova. Nenhum outro módulo muda: a régua de honestidade do
  invariante 14 (`AGENTS.md`) segue valendo para o produto e para qualquer outra superfície.
- **Date**: 2026-08-25
- **Status**: active

### AD-111
- **Decision**: **Rodada de design do app (`/app`)** — a que o `DESIGN.md` deixou marcada quando a
  rodada 1 cobriu só a landing. Três mudanças de fundo. **(a) O breu entra no app.** Os tokens
  `--color-breu-*` deixam de ser exclusivos da landing e passam a valer em `/app/*` sob a MESMA regra
  de racionamento que os governa lá: a barra de navegação (que é chrome, não conteúdo) e **um** cartão
  de conteúdo por tela — o próximo bloco do dia. Nenhum terceiro. Isto **não** é tema escuro, que
  continua fora do escopo. **(b) Duas linhas do `DESIGN.md` caem, com critério**: "sem hero card dentro
  do app" e "app: 14–32px, sem display". O cartão do próximo bloco é cartão-herói e o título dele é
  36px. Só ele — o resto do painel fica dentro da régua antiga. **(c) A ordem da superfície Hoje passa
  a ser**: cabeçalho + cartão do dia (no lugar da caixa "Estado atual") → estudo de hoje → últimos 7
  dias com a contagem da prova ao lado → recuperar erro. Some o grid de quatro cartões de métrica do
  plano, que era exatamente o "grid automático de 3–4 cards de métrica" que o anti-slop proíbe; o
  resumo vira uma linha com uma barra de progresso só.
- **Reason**: A landing e o app pareciam dois produtos. Compartilhar a paleta de neutros não bastou:
  o que dá caráter à landing é a escala tipográfica, o rótulo mono e o racionamento do escuro, e nada
  disso existia do outro lado do login. A régua "sem hero card" foi escrita para impedir decoração,
  não para impedir hierarquia — e a superfície Hoje tem exatamente um item que merece hierarquia, que é
  o próximo bloco. A caixa "Estado atual" dizia o estado do *sistema* ("Plano de hoje disponível"), não
  o do aluno; o cartão do dia responde a pergunta que ele traz ao abrir a tela.
- **Trade-off**: O app ganha uma superfície escura para manter em duas paletas — toda cor nova no
  cartão do próximo bloco precisa de par no breu, e um contribuidor distraído pode pintar um terceiro
  bloco de escuro e furar o racionamento sem que nada quebre. A barra colapsável introduz o primeiro
  componente cliente do shell (estado + cookie), então `AppShell` virou assíncrono e o teste dele passa
  a precisar de `next/headers` mockado.
- **Scope**: `src/modules/ui/{app-shell,barra-lateral,barra-do-celular,navegacao}.tsx`,
  `src/modules/aluno/{plano-pagina,plano-tela,painel-do-dia-tela,progresso}.*`,
  `src/app/globals.css`, `DESIGN.md`.
- **Date**: 2026-08-25
- **Status**: active

### AD-112
- **Decision**: `RelatorioSemanal` ganha `porDia`: sete posições, do mais antigo ao dia de hoje, cada
  uma com `data` (calendário do produto), `questoes` e `acertos`. Sai da **mesma lista de tentativas**
  que já alimenta o total — nenhuma consulta nova, nenhum número estimado. Dia sem tentativa é `0`, e a
  tela desenha coluna de altura mínima em vez de buraco.
- **Reason**: A leitura semanal do painel mostra os sete dias lado a lado e um agregado não sustenta
  essa coluna. A alternativa era desenhar o gráfico sem dado atrás, o que é inventar número — proibido.
  As chaves saem de `dataHojeDoProduto` e não de UTC: uma tentativa das 22h de Brasília cairia no dia
  seguinte e a coluna de hoje apareceria vazia com o aluno tendo estudado.
- **Trade-off**: O contrato de `RelatorioSemanal` fica maior e toda fixture de teste que o monta passa
  a precisar das sete posições.
- **Scope**: `src/modules/aluno/progresso.ts` e as telas que leem o relatório.
- **Date**: 2026-08-25
- **Status**: active

### AD-113
- **Decision**: O Raio-X ganha um **segundo grão de projeção**: a tabela `raiox_projecoes_materia`,
  escrita pela mesma `recalcula_raiox()`, com a mesma fórmula (decaimento por ano, amortecimento por
  amostra, duas janelas de tendência) agrupada por `materia_id` e o **mesmo denominador** da leitura
  por tópico. A tela `/app/raio-x` passa a abrir pela matéria e só revela tópico quando o aluno pede
  — tanto na leitura do edital quanto no Mapa de Prioridade, que ganha duas visualizações à escolha
  (tabela e gráfico peso × domínio). A **normalização para 100% é da borda de leitura**, não do
  banco: `consultarRaioX` devolve `peso` cru e `fatia` normalizada, e a fatia de um tópico é a fatia
  da matéria repartida entre os tópicos dela. A view `raiox_peso_topico` **não muda** — o motor do
  plano (M4) continua raciocinando por tópico.
- **Reason**: A tela mostrava os 86 tópicos do edital numa lista plana, que ninguém termina de ler; a
  matéria é a unidade com que o aluno decide o que estudar. Somar as linhas de tópico para chegar à
  matéria **dá número errado** e foi rejeitado: cada linha já foi amortecida contra a média, então a
  soma acumula o viés uma vez por tópico e uma matéria com muitos tópicos sem questão fica
  artificialmente pesada. Recalcular por matéria com o `n` da matéria inteira faz o amortecimento
  praticamente desaparecer, que é o comportamento correto — uma matéria com 297 questões reais não
  precisa ser puxada para a média. Calcular no `SELECT` (view) ou no front violaria o invariante 7,
  "pré-computa primeiro".
- **Trade-off**: `recalcula_raiox()` passa a varrer `questoes` duas vezes por perfil. O inteiro que
  ela devolve **continua contando só o grão de tópico** — somar a matéria mudaria um contrato de
  quem chama a função sem entregar informação nova, já que os dois grãos vivem na mesma transação.
  Uma matéria fora do
  `programa_edital` some das duas leituras — é o comportamento desejado, mas significa que corrigir o
  programa é pré-requisito para a tela ficar certa. `RaioXTela` vira componente de cliente (abrir,
  fechar e trocar de aba são estado local); nenhum dado pessoal a mais atravessa a fronteira, o DTO
  continua montado no servidor.
- **Scope**: `supabase/migrations/20260830120000_raiox_projecao_por_materia.sql`,
  `src/modules/raiox/{index.ts,mapa-por-materia.ts,tela.tsx}`, `src/app/app/raio-x/page.tsx`.
- **Date**: 2026-08-30
- **Status**: active

### AD-114
- **Decision**: A definição vigente de `gera_plano_do_dia` volta a viver **inteira num arquivo de
  migration**, não como patch de texto sobre outra. A `20260830130000_w2a_reaplica_correcoes.sql`
  reescreve o corpo com as três correções do W2-A embutidas, e a técnica de patchar por
  `pg_get_functiondef` + `replace` (usada na `20260824102100`) fica proibida para função de domínio:
  quem precisar mudar a função copia o corpo **do arquivo mais recente que a cria**, nunca de uma
  migration anterior.
- **Reason**: A `20260825141000` se propôs a acentuar quatro literais de `motivo` e copiou o corpo da
  `20260824102000` — que já não era a definição vigente. Entre as duas, a `20260824102100` havia
  patchado a função em três pontos, e o `create or replace` de corpo inteiro os desfez em silêncio:
  o plano vazio fora da agenda deixou de ser gravado e de contar no retorno, a reserva de um slot
  para o simulado sumiu e o desvio de cobertura virgem voltou a valer sem `perfil_concurso` ativo.
  Só a primeira perda tinha teste — `ciclo-adaptativo` W2-A recebia 0 onde espera 1 —, então duas
  regressões viajaram para a `main` sem nenhum sinal. Enquanto a definição vigente for "arquivo A
  mais patch em B", a próxima cópia de corpo inteiro repete o acidente.
- **Trade-off**: O repositório passa a carregar mais uma cópia de 33 KB da mesma função, e um `diff`
  entre migrations continua sendo a única forma de ver o que mudou de uma versão para a outra. Aceito:
  o custo é disco e ruído de leitura; o custo do outro lado foi regressão silenciosa em produção-
  candidata. As duas correções sem teste (reserva do simulado, porteiro da cobertura) **continuam sem
  teste** — quem mexer na SPEC 32 ou no ciclo adaptativo deve fechar essa lacuna.
- **Scope**: `supabase/migrations/20260830130000_w2a_reaplica_correcoes.sql`,
  `src/modules/lgpd/grupo-1.ts`.
- **Date**: 2026-08-30
- **Status**: active

### AD-115
- **Decision**: `/app/sessao` **deixa de listar bloco do plano do dia** e passa a ser a tela de
  prática: sessão em andamento, revisão vencida que **não** entrou no plano de hoje, caderno de erros
  e histórico de sessões. O plano continua exclusivo de `/app` e `/app/plano`; o único vestígio dele
  aqui é um link no cabeçalho. A tela **não** tem cartão herói nem breu — o AD-111 dá esse tratamento
  ao próximo bloco em `/app`, um por tela, e um segundo aqui seria a segunda infração. A revisão
  avulsa ganha `prepararSessaoDeRevisao`, cujo porteiro é a **agenda**, não o parâmetro: o tópico só
  abre sessão se `revisao_agenda` disser que venceu. A chave contra duplo clique reusa
  `refacao_chave` no formato `tópico|qualificador`, com `revisao_avulsa` como qualificador — não
  pertence a `causa_erro`, então as duas famílias nunca colidem e quem lê a chave segue tirando o
  tópico do primeiro campo.
- **Reason**: `/app` e `/app/plano` já renderizam **o mesmo componente com os mesmos dados**
  (`plano-pagina.tsx` chama `PlanoTela` com o mesmo `consultarPlanoDoDia()` nas duas); a lista de
  blocos em `/app/sessao` era a terceira cópia, e era isso — não o acabamento — que fazia a rota
  parecer supérflua. As quatro peças que sobraram não tinham tela em lugar nenhum: a sessão aberta só
  era alcançável voltando pelo bloco de origem, a revisão vencida que não virou bloco sumia da
  interface, o caderno só existia em `/app` e `/app/progresso`, e o resumo de uma sessão de ontem era
  inalcançável. A tela também repetia a mesma revisão duas vezes (em *Blocos pendentes* e em
  *Revisões devidas*) e terminava numa linha sem ação — "Ainda não há bloco para esta revisão hoje".
- **Trade-off**: A rota passa a fazer seis consultas onde fazia três, e o histórico agrega por sessão
  **em memória** — `tentativas` é particionada, e agregar por `sessao_id` no `SELECT` obrigaria a
  varrer partição por partição para montar um número de dezenas de linhas. O teto de 12 sessões é
  arbitrário: acima disso a leitura é do Progresso. Um bloco **concluído** deixa de proteger o tópico
  contra a lista de revisões — se a revisão dele vencer hoje, ela aparece; esconder seria perder a
  única tela que a mostra. A duplicação `/app` × `/app/plano` **continua de pé** e não é desta
  rodada: o menu ainda promete "Ciclo do edital" numa rota que entrega o plano do dia.
- **Scope**: `src/modules/aluno/sessao/{pratica.ts,pratica-tela.tsx}` (novos),
  `src/modules/aluno/sessao/indice-tela.tsx` (removido), `src/modules/aluno/sessao.ts`,
  `src/app/app/sessao/{page.tsx,acoes.ts}`,
  `supabase/migrations/20260831120000_revisao_avulsa.sql`.
- **Date**: 2026-08-31
- **Status**: active

### AD-116
- **Decision**: A sessão abandonada **não expira por data** e continua listada em `/app/sessao`, mas
  a tela passa a dizer a idade dela ("aberta há 5 dias"); acima de **24 h** ela troca de rótulo
  ("Ficou aberta" / "Uma sessão de outro dia ficou pela metade"), perde o anel de foco e ganha
  **Descartar**. Descartar é `update encerrada_em = now()` — **nunca** DELETE: as tentativas já
  gravadas continuam no histórico, e a sessão vale como o que foi respondido. O dono vem da RLS, não
  de conferência no código; `is('encerrada_em', null)` torna o duplo clique inofensivo.
- **Reason**: Uma sessão só encerra quando **todo** item é respondido (`acoes.ts`), e nada fecha a
  abandonada — ela fica `encerrada_em = null` para sempre. Com a leitura sem corte de data, a sessão
  largada dias atrás aparecia sob "Em andamento · Você parou no meio de uma sessão", o que é mentira
  e foi pego em uso. Cortar por data devolveria a sessão ao buraco de onde a AD-115 a tirou — era
  justamente por não ter tela que ela se perdia. Job de expiração foi recusado: fecharia bloco de dia
  antigo em silêncio e pede infra nova para um problema que ainda não existe em escala.
- **Trade-off**: A tela mostra **uma** sessão aberta, a mais recente; quem largou três vê uma e
  descarta uma por vez. O limiar de 24 h é calibração, não medida — vive no componente, não em
  configuração. E retomar uma sessão antiga conclui o bloco do **dia dela**: `conclusoesDosBlocos` só
  lê blocos do plano de hoje, então esse fechamento não aparece em tela nenhuma (as tentativas
  contam no anel do dia). Comportamento que já existia e que a AD-115 tornou alcançável.
- **Scope**: `src/app/app/sessao/acoes.ts` (`descartarSessao`),
  `src/modules/aluno/sessao/pratica-tela.tsx`.
- **Date**: 2026-08-31
- **Status**: active

### AD-117
- **Decision**: Três mudanças de acabamento em `/app/sessao`, pedidas em uso. (1) **Cor carrega o
  estado**: o cartão da sessão aberta é o único com fundo tingido da tela — `bg-marca-suave` +
  `border-marca/30` enquanto é de hoje, `bg-conquista-fundo` + `border-ouro/45` depois de envelhecer.
  O anel interno do AD-116 sai: com fundo tingido ele vira ruído. Vermelho fica **fora** — sessão
  parada não é erro. (2) **Uma pílula por cartão**: `Descartar` deixa de ser segunda pílula e vira
  `<button type="submit">` de texto sublinhado dentro da frase que já o explicava. A `<form>` continua
  a mesma; muda só a casca. (3) **Teto nos blocos que crescem**: `caderno_erros` e `revisao_agenda`
  ganham `limit(24)` + `count: "exact"`; a tela corta em **4**, abre em lotes de **8** com o rodapé
  `sticky` no pé do cartão, e quando não há mais lote a abrir o rodapé entrega `/app/progresso` em vez
  de mais um lote. O filtro do plano de hoje vai junto **para o banco** (`not.topico_id.in`, só ids
  com formato de uuid). O histórico não entra nisso: já nascia cortado em `SESSOES_NO_HISTORICO`, e
  passa a **dizer** isso em vez de fingir que são todas.
- **Reason**: Os dois cartões de destaque usavam o mesmo `bg-painel` dos blocos comuns e só a borda
  mudava — a um braço de distância nada distingue "isto está andando" de "isto esfriou". As duas
  pílulas empilhadas tinham alturas (48 × 40), corpos (16 × 13) e larguras diferentes: liam como dois
  botões brigando pelo mesmo canto. E as duas consultas sem `limit` traziam **todas** as linhas do
  banco para o HTML com quatro desenhadas na tela: uma linha por tópico vencido e uma por par
  tópico×causa passam das dezenas no fim de um ciclo, e o cartão empurrava o resto da tela para fora
  do campo de visão. Paginação de verdade foi recusada: `/app/progresso` já é a tela dona da lista
  longa, e construir navegação de lista em duas telas é a duplicação que a AD-115 existe para evitar.
- **Trade-off**: A lista entra num componente cliente (`lista-com-teto.tsx`) — o primeiro `"use client"`
  desta tela. O estado aberto **não** sobrevive à navegação, de propósito: lembrá-lo devolveria o rolo
  que o teto evita. O teto de 24 e o lote de 8 são calibração, não medida: vivem no código, não em
  configuração. A contagem do caderno ignora linha com causa fora do domínio (o `flatMap` a descarta
  depois do `count`), então um banco corrompido conta alguns itens a mais — preferível a uma segunda
  consulta só para isso. Sem jsdom no projeto (AD-083), o clique não tem teste: o que os testes
  afirmam é o primeiro quadro de cada estado, que é onde o componente escolhe o ramo.
- **Scope**: `src/modules/aluno/sessao/pratica.ts` (teto, `count`, filtro do plano no banco),
  `src/modules/aluno/sessao/pratica-tela.tsx`, `src/modules/aluno/sessao/lista-com-teto.tsx` (novo).
- **Date**: 2026-08-31
- **Status**: active

## Handoff

- **Feature**: Refatoração de `/app/sessao` — a rota vira **tela de prática** e para de listar bloco
  do plano. Ajuste fora da numeração de specs, pedido direto; fecha com a **AD-115**.
- **Phase / Task**: concluída na branch `feat/sessao-tela-de-pratica`.
- **Completed**: (1) `sessao/pratica.ts` — leitura das quatro peças (sessão aberta com a trilha
  item a item, revisão vencida fora do plano, caderno, histórico agregado por sessão). (2)
  `sessao/pratica-tela.tsx` substitui `indice-tela.tsx`, no vocabulário do resto do app: olho
  `font-utilitaria` de 11px, título de 34px, cartão sem sombra, **sem breu** (AD-111). (3)
  `prepararSessaoDeRevisao` em `sessao.ts`, com a agenda como porteiro e `revisao_indisponivel` novo
  em `SessaoRecusada`. (4) `page.tsx` ganha a entrada `?revisao=<topico>` e passa a excluir da lista
  os tópicos **pendentes** do plano de hoje. (5) Migration só de comentário: `refacao_chave` passa a
  documentar o formato `tópico|qualificador`. (6) **AD-116**: a sessão aberta mostra a idade, e
  acima de 24 h troca de rótulo, perde o destaque e ganha `Descartar` — que carimba `encerrada_em`,
  nunca apaga. (7) **AD-117**, acabamento pedido em uso: fundo tingido no cartão da sessão (verde de
  hoje / ouro da que esfriou), `Descartar` vira link dentro da frase em vez de segunda pílula, e
  `lista-com-teto.tsx` (novo, `"use client"`) corta Memória e Recuperar erro em 4 com lotes de 8,
  rodapé `sticky` e saída para `/app/progresso` quando o teto da consulta cortou antes. A consulta
  ganhou `limit(24)` + `count: "exact"` nas duas tabelas e leva o filtro do plano para o banco.
- **Gates**: `tsc --noEmit` limpo, `eslint` limpo em `src/modules/aluno/sessao/`, `next build`
  compila as 31 rotas, `vitest --project unit` **963/963** (era 905/905 na `main`; +58 testes).
  Sensores conferidos por mutação: o porteiro da agenda, o descarte da revisão que já está no plano,
  a contagem de questões distintas do histórico, o envelhecimento da sessão aberta, o carimbo do
  `Descartar` (trocado por DELETE) e, na AD-117, o `limit` do bloco (24 → 9999), a peneira de uuid do
  filtro do plano, o `sticky` do rodapé, a cor do cartão que envelheceu e a guarda que segura a saída
  para a tela dona enquanto ainda há lote a abrir — todos falham quando invertidos.
- **External checks**: `test:db` **410/411**. A falha é `spec14-sequencia` esperando `fora_agenda` e
  recebendo `plano_indisponivel`, **reproduzida na `main`** com o mesmo comando — é herdada, não
  desta branch. A migration desta rodada é comentário puro e **não foi aplicada** no projeto de
  desenvolvimento. O `test:db` **não foi rodado de novo depois da AD-117**: ela não toca migration
  nem contrato de tabela, só `select`.
- **In-progress** (file:line): falta a **verificação visual** de `/app/sessao` com conta autenticada
  (a rota exige matrícula ativa) — a trilha da sessão aberta a 390px, a coluna dupla revisões ×
  caderno no ponto de quebra `lg`, e agora o rodapé `sticky` no celular (é onde ele mais importa e
  onde barra de navegação do navegador pode disputar o pé da tela). O `Descartar`
  **não foi exercido contra o banco**: só tem teste de unidade com cliente falso, e agora mudou de
  casca — o `<form>` é o mesmo, mas o botão é outro elemento. **O clique de abrir/fechar não tem
  teste**: sem jsdom (AD-083) os testes afirmam o primeiro quadro de cada estado, não a transição.
  Segue pendente a verificação visual do `/app/raio-x`, e as duas
  correções do W2-A sem teste (reserva do simulado, porteiro da cobertura) continuam sem sensor.
- **Next step**: PR desta branch. Depois, a dívida que esta rodada expôs e não resolveu: `/app` e
  `/app/plano` renderizam o mesmo componente com os mesmos dados, e o menu promete "Ciclo do edital"
  numa rota que entrega o plano do dia — decidir se `/app/plano` mostra o ciclo de verdade ou se
  deixa de existir. Ou a `.specs/ROADMAP.md` a partir da SPEC 16.
