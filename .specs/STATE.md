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
- **Next step**: **SPEC 06 — Projeções, revisão espaçada e plano do dia**
  (`.specs/features/06-projecoes-revisao-e-plano/spec.md`). **Ritual B.** O `design.md` e o
  `tasks.md` de `.specs/modulos/m4-coluna-vertebral/` cobrem **T16–T21** e continuam valendo. Ela
  acrescenta `plano_dia_id` a `sessoes` (a SPEC 05 deixou a coluna de fora de propósito: `plano_dia`
  é dela) e é onde entram as chaves `param.m4.*` — a SPEC 05 não declarou nenhuma, para não deixar
  chave órfã.

### Dívida aberta

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
6. Minor — `provas.atualizada_em` sem gatilho de carimbo (`questoes` tem). Barato na SPEC 09.
7. Minor — `fts` indexa só o `enunciado`; a SPEC 23 estende com dado real.
8. Minor — precedência `.env` × ambiente duplicada em três scripts, uma cópia sem teste.

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
11. `registrar_tentativa(...)` é o **único** caminho de escrita em `tentativas`. `security invoker`:
    a RLS vale dentro dela. Quem gravar por INSERT direto (SPEC 09/13) repete o snapshot na mão.
12. Schema: AD-039/040 (questão, **implementados**), AD-042/043/044 (log e projeções), AD-046
    (acumulador anônimo), AD-052 (explicação × versão), AD-056/057 (fórmula do Raio-X), AD-060 (anel
    por bloco), AD-063 (áudio × versão), AD-078/AD-081 (config), AD-082 **substituído pela AD-084**,
    AD-083 (ambiente de teste), AD-085 (cache fora de requisição), AD-086 **substituído pela AD-089**.

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
T16–T21 → **SPEC 06**; T22 (frase do plano) → **SPEC 08**. **T10 morreu** (virou a SPEC 04).
Duas correções obrigatórias sobre esse material: (a) a trava de `tentativas` é de **3 camadas**
(AD-084, substitui a receita de 2 do AD-082) — `REVOKE`+RLS, gatilho de linha, e gatilho de TRUNCATE;
(b) `unstable_cache` só vale dentro de requisição do Next (AD-085) — job e script leem direto.

### Perguntas abertas que a próxima spec resolve aplicando

- ~~**SPEC 05**: o gatilho de linha propaga para as partições?~~ **Respondida medindo: propaga.** O
  Postgres clona `BEFORE UPDATE OR DELETE ... FOR EACH ROW` para cada partição, presente e futura, e
  atacar a partição direto também é bloqueado. O que **não** propaga é o gatilho de `TRUNCATE`, e daí
  saiu a **AD-091**.
- **SPEC 07**: é a única spec sem requisito numerado de origem. Precisa de **Specify curto** criando
  requisitos `UI-NN`, e a escolha da camada de estilo vira **AD nova**.
- **Duas chamadas de IA fora da lista fechada do IA-02**, cada uma travando o Design da sua spec:
  pré-diagnóstico de questão suspeita (**SPEC 29**) e extração do programa do edital (**SPEC 27**).

### Ambiente

- **In-progress** (file:line): none.
- **Branch**: `chore/roadmap-mvp-14-specs`. `main` protegida pelo hook local `.githooks/pre-push` (a
  proteção do GitHub não funciona em repositório privado no plano Free) — ativar por clone com
  `git config core.hooksPath .githooks`.
- **Infra provisionada**: Supabase **`kfpmetkmhjtmgwgaaerl`**, org "Passou Concursos", **sa-east-1
  (SP)**, Postgres 17.6, plano Free · extensões: `pg_cron` (SPEC 03) e `vector` 0.8.2 (SPEC 04) ·
  **Sentry** org e projeto `passou-concursos`, Free, região **EUA** (AD-087g), alerta por e-mail
  funcionando. **Não provisionados**: Vercel (SPEC 07), OpenAI (SPEC 08/09), Asaas + CNPJ (SPEC 12),
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
