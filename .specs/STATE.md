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

### AD-118
- **Decision**: A causa do erro passa a ser exigida também no contexto **`revisao`**. A lista vive
  num lugar só, `PEDE_CAUSA` em `tentativas/registrar.ts`: `["treino", "plano", "revisao"]`.
  `simulado` e `diagnostico` ficam de fora. **Sem migração**: o `CHECK` da tabela e a
  `public.registrar_tentativa` só *exigem* a causa em `treino`/`plano`, mas nenhum dos dois a
  **proíbe** em `revisao` — a coluna aceita, e para esse contexto o gate do cliente passa a ser a
  única exigência.
- **Reason**: O ALUNO-03 AC1 fala em "treino"; a migração do grupo 2 estendeu para "plano". Mas
  `contextoDoBloco` mapeia bloco `revisar` → contexto `revisao`, e o **piso do dia é feito só de
  blocos `revisar`**. Resultado: o aluno que cumpre o mínimo nunca caía no caminho que pede a causa,
  e o caderno de erros nascia vazio — um dia com nove erros e nenhum registrado. Sem causa não há
  caderno, sem caderno não há refação, e a espinha do método fica sem entrada.
- **Trade-off**: Regra declarada num requisito passa a valer mais largamente do que o texto do
  requisito diz — quem ler só o M4 não descobre. E a exigência em `revisao` é assimétrica: o cliente
  cobra, o banco não. Quem gravasse por outro caminho gravaria erro de revisão sem causa. Alinhar o
  SQL é migração de outra rodada; o lugar de alinhar está marcado no jsdoc de `validarResposta`.
  `simulado` fora é decisão, não esquecimento: prova curta cronometrada não para a cada erro.
- **Scope**: `src/modules/aluno/tentativas/registrar.ts`.
- **Date**: 2026-09-01
- **Status**: active

### AD-119
- **Decision**: O gerador do plano continua gravando o bloco de revisão **duas vezes** (uma em
  `piso`, uma em `meta_cheia`), e a correção da duplicidade é **no app**: depois de carregar as
  conclusões, `propagarConclusaoEntreGemeas` casa blocos por `tipo|topicoId` e copia a conclusão para
  a gêmea vazia, nos dois sentidos. `topicoId === null` nunca pareia (é o simulado).
- **Reason**: Terminar o bloco do MÍNIMO deixava o cartão do piso verde e o da META ainda "Em foco ·
  Revisar", com o mesmo assunto — mandando o aluno refazer o que acabou de fazer. As duas linhas são
  **intencionais** no modelo: a gamificação conta a missão do dia pelo piso e o gerador calcula a
  capacidade do dia pela meta cheia. O erro estava na leitura, que casa sessão com bloco por
  `plano_bloco.id`.
- **Trade-off**: O app passa a saber de um detalhe do modelo do SQL — se um dia o gerador parar de
  duplicar, esta função vira código morto silencioso. Foi preferida a mexer no gerador, que é grande,
  arriscado (os dois níveis têm contadores próprios) e não é o que o sintoma pede. A chave
  `tipo|topicoId` só é única porque o gerador guarda `v_usados_topicos` e não repete tópico no dia:
  se essa garantia cair, a propagação passa a casar blocos que não são gêmeos.
- **Scope**: `src/modules/aluno/plano.ts`.
- **Date**: 2026-09-01
- **Status**: active

### AD-120
- **Decision**: Toda rota de `/app/*` ganha fronteira de suspense. `src/modules/ui/esqueleto.tsx`
  traz as primitivas (`Bloco`, `CartaoEsqueleto`, `CabecalhoEsqueleto`, `Carregando`), oito
  `loading.tsx` espelham a forma da sua tela, e `PontoDeCarga` (`useLinkStatus`) acende dentro do
  `<Link>` enquanto a navegação não respondeu. Um `role="status"` por tela, com o nome da tela como
  rótulo. Nenhuma cor nova: `bg-linha`, que o DESIGN.md já define como preenchimento decorativo.
- **Reason**: A navegação parecia travada — clicar numa aba não trocava nada de tela até o servidor
  terminar. Não era lentidão de query: o projeto não tinha **nenhum** `loading.tsx`, e toda rota de
  `/app/*` é `force-dynamic`. A doc do Next 16 instalado é explícita: em rota dinâmica o prefetch é
  pulado a menos que exista `loading.tsx`, que é o que habilita prefetch parcial e navegação imediata.
- **Trade-off**: O esqueleto copia a forma da tela real, então **ele desatualiza junto com ela**: uma
  tela redesenhada e um esqueleto esquecido produzem salto de layout. Foi preferido a um esqueleto
  genérico centralizado, que é pior que spinner — mente sobre o que vai aparecer. O `AppShell` faz
  `await cookies()` no layout, e a doc avisa que dado de runtime no layout impede o fallback; na
  prática isso só pesa no primeiro carregamento, mas **isso não foi conferido no navegador**. Se não
  aparecer, a saída é `<Suspense>` dentro do `AppShell` ou tirar o cookie do layout.
- **Scope**: `src/modules/ui/esqueleto.tsx`, `src/modules/ui/ponto-de-carga.tsx`, oito
  `src/app/app/**/loading.tsx`, `barra-lateral.tsx`, `barra-do-celular.tsx`.
- **Date**: 2026-09-01
- **Status**: active

### AD-121
- **Decision**: No celular, o topo fica **só com a marca** e a conta vira a **sexta aba** da barra de
  baixo — um `<button>` que abre uma folha de baixo para cima com Preferências · Conta · Reembolso ·
  Sair. `ItemDaNavegacao` ganha `nomeCurto`, lido **só** pelo celular; a barra lateral continua em
  `nome`. A área segura do aparelho entra como `mb-`, não `pb-`, porque a barra flutua a 1rem do pé.
  O fechamento por mudança de rota é ajuste de estado **durante o render**, não `useEffect`.
- **Reason**: Em 375px o topo renderizava inline os três itens de conta com os nomes inteiros mais o
  formulário de sair: os itens se espremiam, o texto cortava e a marca perdia espaço. E a barra de
  baixo usava `item.nome`, com "Questões e revisões" truncado numa aba de ~60px — truncado ele não
  diz nada. Conta é assunto ocasional, não tarefa diária: não disputa o topo com a marca.
- **Trade-off**: Seis abas em 360px dão ~53px cada; se na tela ficar espremido, a saída registrada é
  mover **Progresso** para dentro da folha e ficar com cinco. A folha é modal desenhada à mão (sem
  `<dialog>`): trava scroll, fecha com `Escape`, com toque no fundo e ao mudar de rota, e devolve o
  foco — mas **não tem captura de foco em ciclo**, então o `Tab` sai dela. Sem jsdom (AD-083) o
  clique não tem teste: o que se afirma é o primeiro quadro.
- **Scope**: `src/modules/ui/navegacao.tsx`, `src/modules/ui/barra-do-celular.tsx`,
  `src/modules/ui/app-shell.tsx`.
- **Date**: 2026-09-01
- **Status**: active

### AD-122
- **Decision**: Feature nova **Trajetória** — cobertura do edital e previsão de término —, atrás de
  `flag.m4.trajetoria`, que nasce **desligada**. Sem tabela nova: universo = o mesmo do gerador
  (tópico ativo, matéria ativa, com questão publicada/vigente/não anulada); tocado e dominado de
  `dominio_topico` com a faixa do Raio-X; peso de `raiox_projecoes` e `raiox_projecoes_materia`;
  prazo de `perfil_estudo.data_prova`; ritmo das tentativas das últimas 4 semanas. Acervo e projeção
  pela chave de serviço, dado do aluno pelo cliente da sessão. **A flag é registrada no catálogo**
  (`src/modules/config/catalogo.ts`), não numa migração de seed: é ali que a chave passa a existir, e
  o default `false` já é a flag desligada num banco sem linha.
- **Reason**: "Como eu sei que estou terminando o edital?" não tinha resposta em tela nenhuma. O
  Progresso mostra domínio por tópico, o Raio-X mostra o que mais cai; nenhum dos dois cruza quanto
  do edital já foi tocado com quanto tempo falta.
- **Trade-off**: Três regras duras seguram o número. (1) **Cobertura ponderada manda** — cobrir 40%
  vale mais se forem os que mais caem; sem projeção do Raio-X ainda, ela cai na fração simples em vez
  de dividir 0 por 0. (2) **Nunca inventar data** — menos de 2 semanas de histórico ou ritmo zero
  devolve `null`, e o ritmo conta tópicos **novos**, derivados de comparar a contagem na janela com o
  `n_respostas` acumulado; contar tópico revisitado faria quem revisa os mesmos vinte assuntos
  aparecer terminando o edital amanhã. (3) **Tocado ≠ dominado**, duas faixas no mesmo traço. O
  custo: a leitura são cinco consultas na abertura de tela (exceção do AD-071, a mesma do anel do
  dia), e uma delas varre `topico_id` de todas as questões publicadas — hoje 205 linhas, mas cresce
  com o acervo. Se ficar lenta vira projeção materializada; não vira laço. A previsão é linear e
  ignora a dificuldade do que resta: é estimativa de ritmo, não promessa.
  **Corrigido pelo AD-124**: o número "205" estava errado (são 1375) e a varredura de `questoes`
  batia no teto de 1000 linhas do PostgREST, encolhendo o edital em silêncio. A leitura passou para
  `inventario_acervo`.
- **Scope**: `src/modules/aluno/trajetoria.ts`, `trajetoria-tela.tsx`, `trajetoria-opcional.ts`,
  `painel-do-dia.ts`, `painel-do-dia-tela.tsx`, `src/app/app/progresso/page.tsx`,
  `src/modules/config/catalogo.ts`.
- **Date**: 2026-09-01
- **Status**: active

### AD-123
- **Decision**: `partman.part_config.infinite_time_partitions = true` para `public.tentativas`. A
  folga de três meses do INFRA-04 AC3 passa a andar pelo **calendário**, não pelo fluxo de INSERT.
  O teste do `part_config` passa a afirmar `infinite_time_partitions` e `automatic_maintenance`
  junto de `premake` — os dois primeiros descrevem a intenção, o terceiro sozinho não a cumpre.
- **Reason**: em 2026-09-01 o `tentativas-particao.test.ts` reprovou pedindo
  `tentativas_p20261201`: o conjunto de partições estava exatamente como o `create_parent` de
  2026-08-17 o deixou, sem avançar um mês em quinze dias. **Não era o job.** O log do Postgres
  mostra o job das 05:17 UTC terminando limpo (`COMMAND completed: CALL`); a correção do
  `invalid transaction termination` (migração `20260822190000`) funcionou. A causa é o default do
  pg_partman: com `infinite_time_partitions = false` a criação de partição futura anda a reboque do
  dado que chega, e num banco onde quase todo teste roda em transação revertida o dado não chega.
- **Trade-off**: ~12 tabelas vazias por ano. Pelo AD-067 partição nunca é dropada, então não há
  interação com retenção. O que se compra: o modo de falha antigo era silencioso dos dois lados —
  a `jobs_falhados` (SPEC 03) vigia job que **falha**, e este tinha sucesso sem fazer nada, então
  qualquer período quieto (pré-lançamento, feriado, queda na virada do mês) consumia a folga sem
  acender alerta, até o Postgres recusar o INSERT de um aluno. Pelo invariante 1 essa resposta não
  tem reenvio. Fica registrado o que **não** foi feito: a `jobs_falhados` continua sem enxergar job
  que teve sucesso e não trabalhou.
- **Scope**: `supabase/migrations/20260901150000_particao_folga_incondicional.sql`,
  `tests/db/tentativas-particao.test.ts`.
- **Date**: 2026-09-01
- **Status**: active

### AD-124
- **Decision**: A trajetória lê o universo do edital pela view `public.inventario_acervo`
  (uma linha por tópico, `aptas_sessao` já agregado em SQL), **nunca varrendo `questoes`**. O teste
  afirma que `questoes` não é lida — a mutação que volta a varrer reprova 4 testes.
- **Reason**: a consulta que o AD-122 descreveu como "varre `topico_id` de todas as questões
  publicadas — hoje 205 linhas" estava errada em dois pontos, e o segundo é bug. O número real hoje
  é **1375**, e o PostgREST corta em **1000 linhas**: a chamada exata da trajetória responde
  `206 Partial Content`, `Content-Range: 0-999/1375`. O supabase-js **não trata 206 como erro** —
  `error` vem `null` —, então o `try/catch` do `consultarTrajetoriaOpcional` nunca dispara. Tópico
  cujas questões caíssem no pedaço cortado sumia do universo: edital menor, cobertura e previsão
  **otimistas, em silêncio**. Isso contradiz a regra que sustenta a própria feature (AD-122: nunca
  inventar data). Medido pela API com a chave de serviço: `questoes` → 206, 1000/1375;
  `inventario_acervo` → 200, 98/98.
- **Trade-off**: o AD-122 previa "se ficar lenta vira projeção materializada". O risco real não era
  lentidão, era resposta errada — e a view já existia desde a W6-A, concedida ao `service_role`.
  Fica registrado o que **não** foi varrido: as outras leituras sem `.range()` do módulo. As de
  acervo são limitadas pelo edital (98 tópicos) e estão longe do teto; a de `tentativas` na janela
  de 28 dias pode passar de 1000 num aluno intenso e truncar o **ritmo** — o erro ali é conservador
  (data mais tarde, não mais cedo) e nenhum aluno tem esse volume hoje, então fica como dívida
  anotada, não corrigida às cegas.
- **Scope**: `src/modules/aluno/trajetoria.ts`, `src/modules/aluno/trajetoria.test.ts`.
- **Date**: 2026-09-01
- **Status**: active

### AD-125
- **Decision**: A trilha da sessão deixa de ser dez tracinhos e passa a ser **quadrado numerado**,
  com seta nas pontas para andar de uma em uma. Cor continua sendo estado — verde acertou, vermelho
  para revisar, anel onde o aluno está —, e o resumo usa exatamente o mesmo componente visual.
- **Reason**: o tracinho dizia "quanto falta" e mais nada. Para ir da questão 1 para a 7 era preciso
  acertar um alvo de 1px de altura sem saber qual era qual: navegação que existia no código e não
  existia na tela. O número é o que torna o atalho utilizável, e o alvo passa a ter 38px.
- **Trade-off**: com 20+ questões numa sessão os quadrados ficam estreitos. Hoje o bloco é de 10 e
  não há caso maior; se aparecer, a saída é rolagem horizontal na faixa, não voltar ao tracinho.
- **Scope**: `src/modules/aluno/sessao/tela.tsx`, `src/modules/aluno/resumo-tela.tsx`.
- **Date**: 2026-09-01
- **Status**: active

### AD-126
- **Decision**: Errar passa a ter **uma tela só**: gabarito, resposta dada e as sete causas juntos, e
  o `Registrar e continuar` leva direto à próxima questão. O checkbox "marcar como chute" **sai** da
  tela de responder; `marcou_chute` passa a ser derivado da causa `chutei` na server action.
- **Reason**: eram dois passos para fechar uma questão errada, e o primeiro pedia a causa **antes**
  de revelar o gabarito — o aluno dizia por que errou sem saber ainda o que era certo. O checkbox
  perguntava, antes de responder, a mesma coisa que a tela seguinte pergunta depois.
- **Trade-off**: perde-se o sinal "acertei mas chutei", que só o checkbox capturava — a causa só é
  pedida no erro. Aceito: era um checkbox que quase ninguém marcava e que cobrava do aluno uma
  confissão antes da correção. Segundo ponto: mostrar o gabarito antes de gravar abre a janela de
  editar o `respostaDada` do formulário e registrar acerto. Não é vantagem para ninguém — não há
  ranking (invariante 15) e o plano se ajusta ao que o aluno registra —, então não entra assinatura
  de campo. O log não muda: a função SQL continua recusando o INSERT sem causa e a linha é gravada
  uma vez só (invariante 1).
- **Scope**: `src/modules/aluno/sessao/tela.tsx`, `src/app/app/sessao/acoes.ts`.
- **Date**: 2026-09-01
- **Status**: active

### AD-127
- **Decision**: O resumo da sessão mostra **uma questão por vez** e passa a trazer o enunciado
  inteiro (com o texto de apoio recolhido), **todas as alternativas** com gabarito e resposta dada
  marcados, e a causa que o aluno registrou. A consulta busca `alternativas` e `causa_erro`.
- **Reason**: dez cartões empilhados faziam uma página que não acabava, e cada cartão trazia só duas
  letras — "Sua resposta D · Gabarito E" não lembra nada uma semana depois, que é justamente quando
  a revisão traz o assunto de volta.
- **Trade-off**: `alternativas` inválida no resumo **derruba a tela** em vez de degradar, mesmo
  sendo tela de leitura. É o mesmo padrão da sessão e o mesmo CHECK do banco: questão de múltipla
  escolha sem lista válida é dado quebrado, não caso de uso. Os rótulos das causas saíram de
  `progresso.ts` para `causas.ts` porque a tela virou cliente e `progresso.ts` carrega o cliente
  Supabase de serviço; `progresso.ts` reexporta, então nenhum import existente mudou.
- **Scope**: `src/modules/aluno/resumo-sessao.ts`, `src/modules/aluno/resumo-tela.tsx`,
  `src/modules/aluno/causas.ts`, `src/modules/aluno/progresso.ts`.
- **Date**: 2026-09-01
- **Status**: active

### AD-128
- **Decision**: Enunciado é renderizado com um **conjunto fechado** de marcas
  (`**negrito**`, `*itálico*`, parágrafo por linha em branco, lista com `- ` e lista numerada), por
  parser próprio em `src/modules/ui/enunciado.tsx`. Sem biblioteca de markdown, sem
  `dangerouslySetInnerHTML`. O que estiver fora da lista sai como texto literal. O mesmo módulo
  separa o texto de apoio do comando: o comando é o último bloco, que é como a ingestão grava.
- **Reason**: a tela imprimia a marcação crua ("**Povos da floresta.**") porque o acervo guarda o
  texto original da banca com marcação e ninguém interpretava. Enunciado atravessa PDF, OCR e IA:
  liberar HTML aí seria injeção numa superfície que o aluno lê logado.
- **Trade-off**: tabela e fórmula que a ingestão grava como texto (`Tabela:
…`) continuam saindo
  como parágrafo — formatá-las é outra rodada. E a separação apoio/comando depende do formato do
  `enunciadoComBlocos`; questão importada por outro caminho, sem linha em branco, cai no caso de um
  bloco só e aparece inteira, que é o comportamento antigo.
- **Scope**: `src/modules/ui/enunciado.tsx`, `src/modules/aluno/sessao/tela.tsx`,
  `src/modules/aluno/resumo-tela.tsx`.
- **Date**: 2026-09-01
- **Status**: active

### AD-129
- **Decision**: O filtro de `/app/progresso` deixa de ser aplicado **no banco** e passa a ser recorte
  em memória. `dominio_topico` e `caderno_erros` são lidos **sem filtro**; `caderno_erros` ganha
  `.range(0, 799)` com `count: "exact"`, e `DadosProgresso.cadernoTruncado` diz quando o corte pegou.
  Toda linha do progresso passa a carregar `materiaId`/`materia` (uma consulta nova a `materias`, por
  ids, depois de `topicos`), e o contrato ganha `historicoPorMateria`, `cadernoPorAssunto` (grão
  tópico, com as causas dentro), `materias` e `filtros.materiaId`. `RelatorioSemanal` ganha
  `percentualAnterior`. `historico` e `caderno` (grão `tópico × causa`, filtrado) **continuam** no
  contrato: `painel-do-dia.ts` consome o segundo.
- **Reason**: Três defeitos de uma origem só. (1) `filtros.topicoId` era aplicado também em
  `dominio_topico`, então filtrar um erro encolhia "Progresso por assunto" para um item — o filtro
  mora dentro da seção do caderno e reescrevia a seção de cima. (2) As opções do `<select>` de
  assunto nasciam do resultado **já filtrado**: escolher "Câmbio" deixava o dropdown com só "Câmbio",
  e não havia como trocar sem limpar. (3) `topicos_nome_unico_na_materia` permite o mesmo nome de
  tópico em matérias diferentes, e a tela lia só `nome`: dois cartões "Geral" e duas opções "Geral"
  indistinguíveis. Não existia filtro por matéria porque `materia_id` nunca era consultado aqui.
- **Trade-off**: A tela passa a trazer o caderno inteiro do titular (grão `tópico × causa`) para
  filtrar em memória. O teto real é `tópicos da taxonomia × 8 causas`; 800 fica abaixo do corte de
  1000 linhas do PostgREST, e o `count` denuncia o excesso — é o oposto do que a AD-124 pegou, que
  era truncar em silêncio. Se um dia passar de 800, a saída registrada é filtrar a **lista** no banco
  e manter uma segunda consulta só de `topico_id` para as opções; não é voltar a filtrar as duas.
  Segundo custo: `consultarProgresso` faz uma consulta a mais (`materias`), sequencial depois de
  `topicos` porque depende dos ids dela. A tendência da matéria é maioria simples entre os tópicos e
  **não** é recalculada das tentativas: o número que a linha fechada resume e o que o tópico mostra
  aberto têm que sair da mesma conta, senão abrir a matéria contradiz o que ela dizia. Empate vira
  `sem_base`.
- **Scope**: `src/modules/aluno/progresso.ts` e as fixtures que montam `DadosProgresso`.
- **Date**: 2026-09-03
- **Status**: active

### AD-130
- **Decision**: `consultar_gamificacao_do_dia` passa a devolver **`pontos.discriminacao_total`** (a
  mesma discriminação, sem filtro de data, somada de `gamificacao_ponto_evento`) e
  **`progresso_conquistas`** (progresso e meta das quatro conquistas do catálogo; as duas binárias
  saem com meta 1 para a tela tratar as quatro igual). Sem tabela nova e sem escrita nova. No
  contrato TS os dois blocos são **opcionais**: ausente vira `null`, nunca zero.
- **Reason**: A tela mostrava "300 no total" com quatro zeros embaixo, e isso foi lido como defeito
  de cálculo. Não era: a `materializar_gamificacao` grava em `gamificacao_pontos_dia` a discriminação
  **do dia** (filtro `e.data = v_data`) e em `gamificacao_pontos` o acumulado de sempre — as duas
  certas. A RPC devolvia as duas no mesmo objeto sem nomear a janela de nenhuma, e `pontos.dia`, que
  existia no contrato, não era exibido em lugar nenhum. As metas das conquistas já eram calculadas
  para decidir o desbloqueio e não saíam, por isso a tela só sabia dizer "Ainda não".
- **Trade-off**: A leitura ganha duas varreduras por abertura de tela — os eventos do titular e um
  `count(*)` em `tentativas`, que é particionada. Ambas já aconteciam dentro da
  `materializar_gamificacao`, que a mesma RPC chama uma linha antes, então o custo é uma repetição,
  não uma novidade; se pesar, a saída é materializar a discriminação vitalícia junto do acumulado em
  `gamificacao_pontos`. `null` em vez de zero é deliberado: zero afirmaria que o aluno não andou
  nada, que é a mesma mentira pequena que esta rodada existe para tirar da tela. E os valores por
  origem ("10 / bloco") vivem **no componente**, não em consulta: se a configuração mudar sem a
  lista mudar junto, o que fica errado é a explicação, nunca o placar.
- **Scope**: `supabase/migrations/20260903120000_gamificacao_leitura_vitalicia.sql`,
  `src/modules/aluno/gamificacao/contrato.ts`, `tests/db/gamificacao.test.ts`.
- **Date**: 2026-09-03
- **Status**: active

### AD-131
- **Decision**: `prepararSessaoDeRefacao` aceita o qualificador **`todas`** no lugar da causa. A
  chave vira `topico|todas`, no mesmo campo `refacao_chave` que já carrega `topico|causa` e
  `topico|revisao_avulsa` (AD-115). **Sem migração.**
- **Reason**: O caderno agrupado por assunto precisa de uma ação que valha o assunto inteiro; quatro
  cartões "Interpretação" com quatro botões eram exatamente o que o agrupamento desfaz.
- **Trade-off**: Uma terceira família de chave no mesmo campo de texto. `todas` não colide com
  nenhum valor de `causa_erro` nem com `revisao_avulsa`, e o teste afirma isso — mas a garantia é um
  teste, não um `CHECK`: uma causa nova chamada `todas` quebraria as duas famílias em silêncio. A
  função já carregava **todas** as tentativas erradas do tópico e só depois filtrava pela causa, e a
  leitura de `tentativa_causa_simulado` deixa de acontecer nesse ramo porque não serve mais a nada.
- **Scope**: `src/modules/aluno/sessao.ts`, `src/app/app/sessao/page.tsx`.
- **Date**: 2026-09-03
- **Status**: active

### AD-132
- **Decision**: Redesenho de `/app/progresso`. (a) O cartão da sequência e o relatório semanal viram
  **um** cartão, "Últimos 7 dias", e ele é o **cartão breu desta tela** — a cota que a AD-111
  raciona, gasta aqui como o Raio-X gasta a dele no maior ganho. É o único lugar que lê o `porDia` da
  AD-112. (b) Os **dois** grids de quatro cartões de métrica saem: o do relatório vira linha de
  fatos, o dos pontos vira tabela de duas colunas nomeadas (Hoje × Total). (c) "Progresso por
  assunto" vira lista de matérias com `<details>`, na anatomia de linha do Raio-X — **sem** componente
  cliente. (d) O caderno vira um cartão por assunto com as causas como chips, filtro de três campos
  (matéria, assunto em `<optgroup>` por matéria, causa) e paginação por `mostrar` na query string,
  limitada pela rota a 60. (e) Aluno sem histórico recebe **uma** tela, não cinco caixas vazias.
- **Reason**: Sete seções-cartão com o mesmo raio, a mesma sombra e um eyebrow cada faziam uma página
  onde nada era importante, e duas delas eram o "grid automático de 3–4 cards de métrica" que o
  anti-slop do `DESIGN.md` proíbe e que a AD-111 já tinha arrancado do `/app`. O desenho foi aprovado
  antes do código, no canvas
  https://claude.ai/code/artifact/59d60e8f-54ee-468a-a87a-ae5babadf446 (fontes em
  `.temp/design/progresso/`).
- **Trade-off**: `<details>` no lugar de estado de cliente custa o controle sobre a animação e sobre
  "abrir todas", e o estado aberto não sobrevive à navegação — aceito para não trazer o primeiro
  `"use client"` para esta tela. A paginação por query string recarrega a página a cada lote, ao
  contrário do `ListaComTeto` da `/app/sessao` (AD-117): aqui é o certo, porque esta é a tela dona da
  lista longa e o filtro já é um `<form method="get">` — dois mecanismos de recorte na mesma tela
  seria pior. `ASSUNTOS_POR_PAGINA = 5` e o teto de 60 são calibração, não medida: vivem no código.
  E o `loading.tsx` foi refeito junto — pelo trade-off da AD-120 ele desatualiza com a tela, e esta
  rodada é a prova de que isso é trabalho recorrente.
- **Scope**: `src/modules/aluno/progresso-tela.tsx`, `src/modules/aluno/painel-do-dia-tela.tsx`
  (`GamificacaoNoProgresso`), `src/app/app/progresso/{page.tsx,loading.tsx}`.
- **Date**: 2026-09-03
- **Status**: active

### AD-133
- **Decision**: O funil deixa de ser **paga-primeiro puro** e passa a ter **conta gratuita com
  trial de 7 dias, sem cartão**, atrás da flag `flag.m8.trial_gratuito` (nasce **desligada**). O
  trial **é uma matrícula** de um produto `trial-7d` (`tipo='trial'`, prazo em dias): a função
  `tem_matricula_ativa()` e as 7 policies que a usam **não mudam**, e o `m8 §P1 AC2` ("a matrícula
  é a única chave, SHALL NOT haver segundo mecanismo de liberação") continua valendo ao pé da
  letra. Uma conta recebe **um** trial na vida, garantido por índice único parcial, não só por
  código. O trial entrega o **loop completo** (plano do dia, sessão, explicação) com **teto diário
  de questões**; o valor acumulado (progresso, Raio-X, caderno de erros) fica em prévia com convite.
  A **garantia de 7 dias continua existindo** depois do pagamento. O checkout direto continua
  funcionando: quem quer pagar sem testar não passa pelo trial. O prazo do trial mora em
  `produtos.dias_de_acesso`, não em parâmetro de configuração — trocar o prazo é um UPDATE numa
  linha, sem deploy, e sem criar duas fontes de verdade para o mesmo número. Retenção do lead que
  testou e nunca pagou passa a ser `param.m7.retencao_trial_meses` (proposta: 6), separada dos 24
  meses do AD-045. Substitui a parte "paga-primeiro" do **AD-031**; não toca no AD-032 (plano
  único, sem recorrência) nem no AD-033 (Asaas).
- **Reason**: R$197 à vista, marca desconhecida, zero prova social e tráfego frio é a pior
  combinação possível para um checkout; o produto vende método, e método só convence sendo usado.
  O desenho "trial = matrícula" foi escolhido entre três porque é o único que não cria um segundo
  caminho de liberação — o que a arquitetura de hoje proíbe explicitamente e o que, em três meses,
  vira o caminho que ninguém lembra de fechar.
- **Trade-off**: ⚠️ **A decisão é anterior ao dado**: o funil pago nunca rodou com tráfego real, e
  é possível que estejamos adiando receita para resolver um problema que não existe. A flag
  desligada é o seguro — lançar com paga-primeiro, medir, e ligar depois custa zero retrabalho.
  Segundo: trial de 7 + garantia de 7 são **14 dias até o dinheiro ser nosso**, com taxa de estorno
  e caixa mais lento. Terceiro: **o trial come o acervo**, que é o fosso — com teto de 10/dia são 70
  questões em 7 dias, e o acervo real precisa ser contado antes de ligar a flag. Quarto: um trial
  autenticado pode ler o acervo publicado por fora da tela, porque a RLS de `questoes` é booleana e
  estreitá-la exigiria refatorar a montagem de sessão (um módulo de 1.100 linhas) sem abuso medido
  que justifique — aceito, com a amostragem determinística (`param.m8.trial_fracao_do_acervo`) como
  saída barata se o risco crescer. Quinto: **e-mail novo = trial novo** é um buraco que não se
  fecha sem cartão nem captcha; o que limita o dano é o teto diário. Sexto: passa a existir uma
  população de titulares LGPD que nunca pagou, com a rotina automática de retenção só na SPEC 18 —
  até lá é procedimento manual, igual ao pedido de exclusão (AD-090). Caminho **não** seguido, e
  registrado para não ser reinventado: amostra pública de 5–10 questões na landing, sem login —
  mais barata, sem LGPD nova e sem abuso, mas prova bem menos porque não mostra o plano nem a
  revisão espaçada, que é o que diferencia o produto.
- **Scope**: `docs/planos/TRIAL-1-*` e `TRIAL-2-*` · `produtos`, `matriculas`,
  `registrar_tentativa`, `sessao.ts`, `ativacao.ts`, `repositorio.ts`, `rotas.ts`, `/auth/confirm`,
  catálogo de configuração, `/termos`, `/privacidade`.
- **Date**: 2026-09-03
- **Status**: active

## Handoff

- **Feature**: Correcoes da plataforma, rodada 3 — a tela `/app/progresso`, a unica das cinco
  principais que nunca passou por redesenho nem por revisao de logica. Fora da numeracao de specs,
  sem ritual. Fecha com **AD-129** a **AD-132**.
- **Phase / Task**: concluida na branch `feat/m4-progresso-redesenho`, cinco commits atomicos.
  Desenho aprovado antes do codigo, no canvas
  https://claude.ai/code/artifact/59d60e8f-54ee-468a-a87a-ae5babadf446 (fontes em
  `.temp/design/progresso/`).
- **Completed**: (1) **AD-129** — o filtro parou de reescrever o historico e de encolher as proprias
  opcoes; materia entrou em toda linha; `historicoPorMateria`, `cadernoPorAssunto`,
  `cadernoTruncado` e `percentualAnterior` no contrato. (2) **AD-130** — migracao
  `20260903120000_gamificacao_leitura_vitalicia.sql`: `discriminacao_total` e
  `progresso_conquistas` na RPC de leitura, com teste de banco que reproduz o defeito (`dia` 0,
  `total` 80). (3) **AD-131** — refacao de todas as causas de um assunto, chave `topico|todas`, sem
  migracao. (4) **AD-132** — a tela: cartao breu unico da semana, listas com divisor no lugar dos
  dois grids de quatro metricas, caderno por assunto com paginacao, e uma tela so para o aluno sem
  historico. `loading.tsx` refeito junto.
- **Gates**: `vitest --project unit` **1046/1046** (era 1032/1032 na `main`). `test:db`
  **411/411 + 1 novo**, contra o Supabase de dev, com a migracao ja aplicada por `npm run db:push`.
  `eslint src` limpo, `tsc --noEmit` limpo, `next build` compila as 31 rotas.
- **In-progress** (file:line): a **verificacao visual com conta autenticada** e o que falta, e desta
  vez ela pesa em quatro pontos que nenhum teste alcanca. (a) A regua de sete dias com um aluno de
  volume alto e outro de volume baixo: a altura sai do dia mais cheio da propria janela, entao a
  escala e relativa e nunca foi vista com dado real (`src/modules/aluno/progresso-tela.tsx:123`).
  (b) O `<details>` da materia em 375px, onde a linha tem quatro colunas no desktop e duas no
  celular (`progresso-tela.tsx:246`). (c) O `<optgroup>` do filtro de assunto no Safari e no
  celular, que e o que desambigua dois topicos "Geral". (d) Clicar `Refazer os N` de verdade e
  conferir que a sessao abre com as questoes das varias causas — o caminho `todas` so tem teste de
  unidade contra mock (`src/modules/aluno/sessao.ts:460`). Seguem pendentes, das rodadas anteriores:
  as quatro alineas de verificacao visual do AD-125/126/127, as cinco do AD-120/121/122, o
  `Descartar` nunca exercido contra o banco, e as duas correcoes do W2-A sem sensor.
- **Next step**: PR desta branch. Depois, a divida que segue aberta ha tres rodadas: `/app` e
  `/app/plano` renderizam o mesmo componente com os mesmos dados, e o menu promete "Ciclo do edital"
  numa rota que entrega o plano do dia — decidir se `/app/plano` mostra o ciclo de verdade ou se
  deixa de existir. Ou a `.specs/ROADMAP.md` a partir da SPEC 16.
