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
  | **09 — Ingestão do primeiro lote** | T75–T86 | ✅ **449 unit + 306 db**. Ritual B — **PASS** independente. **Rodou com as 3 provas reais do BB 2021**: 205 questões no acervo, US$ 0,045/prova. Cinco defeitos que só apareceram com prova de verdade, todos corrigidos — ver o fim de `.specs/features/09-*/tasks.md` |
  | **10 — Publicação e explicações** | T87–T97 | ✅ **480 unit + 319 db**. Verificador independente encontrou duas lacunas na 1ª rodada; ambas foram corrigidas e os gates finais passaram. Porta de publicação, fila, referência, citações e job entregues. |
  | **11 — Raio-X: frequência, peso e tela** | T98–T105 | ✅ **490 unit + 332 db**. Lint e build verdes. Ritual B — **PASS parcial** independente; limitações de ranking absoluto e timestamp registradas em `.specs/features/11-*/validation.md`. |
  | **12 — Checkout, funil e ativação** | T106–T117 | ✅ **Implementada; gates técnicos PASS** — 80 arquivos/567 unitários, 24/24 DB específicos, TypeScript e build verdes. O webhook Asaas foi exercitado no Sandbox e ativou a conta; falta concluir o reteste do e-mail de senha após a configuração SSR do template Supabase, além das integrações externas opcionais e da tela autenticada de reembolso. |
- **Retomada imediata da SPEC 12**: aplicar no Supabase o template documentado em
  `docs/DEPLOY.md` (*Reset Password* com `{{ .TokenHash }}`), acrescentar
  `http://localhost:3000/auth/confirm` nas Redirect URLs, pedir um novo link em
  `/recuperar-senha`, clicar nele e confirmar que `/definir-senha` aparece e leva ao login com a senha
  nova. O código e o handoff técnico desta correção estão no commit `fd896a3`;
  depois do reteste, atualizar `validation.md` e criar o commit de fechamento E2E.
- **O que ainda falta para fechar oficialmente**: (1) reteste E2E do link de definição de senha;
  (2) conferência autenticada de `/app/reembolso`; (3) testes externos adicionais Asaas Sandbox
  (cartão/boleto, reconciliação e reembolso); (4) CNPJ/regime/configuração fiscal para NF; e
  (5) configurar PostHog e conferir os quatro eventos anônimos. Nenhum segredo deve entrar nos
  documentos ou commits.
- **Next step depois do fechamento**: **SPEC 13 — Onboarding, plano e sessão**
  (`.specs/features/13-*/spec.md`, conforme `.specs/ROADMAP.md`). A SPEC 12 deixa
  checkout, webhook, ativação, reconciliação, garantia, fatura e paywall prontos; a SPEC 13 pode
  consumir a matrícula ativa sem criar dependência para uma spec de número maior.
