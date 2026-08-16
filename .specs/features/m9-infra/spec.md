# M9 — Infra & Operações · Especificação

> Fonte: `PRD.md` §M9, §6, §7, §8, §9. Decisões: AD-035 (com dependências em AD-002,
> AD-004, AD-010, AD-015, AD-018, AD-029). Refinamentos desta rodada: AD-036 (fábrica),
> AD-037 (observabilidade), AD-038 (backup 7d).

## Problem Statement

O produto precisa rodar em produção com um time de 3 devs e **sem time de operações**. A
arquitetura tem cargas de natureza muito diferente (funções web curtas, jobs leves recorrentes,
e trabalho pesado de minutos/horas) que não podem morar no mesmo lugar sem estourar timeout ou
custo. A infra define ONDE cada carga roda, como o dado cresce sem degradar, e como backup/DELETE
convivem com a LGPD — decisões que todas as outras features (M1–M8) herdam.

## Goals

- [ ] Cada tipo de carga tem um lar definido: web curta (Vercel), job leve (pg_cron), trabalho
      longo (GitHub Actions + Batch API), tutor ao vivo (streaming Vercel Pro).
- [ ] `tentativas` particionada por mês desde o dia 1, com índices definidos, pronta pra crescer
      para sempre sem ficar lenta.
- [ ] Backup e política de DELETE (D29) casam sem furo de LGPD, com prazo documentado.
- [ ] Ambiente 100% na região São Paulo, gerenciado, com staging isolado por branch.
- [ ] Erro em produção é visível e alertável antes de o aluno reclamar.
- [ ] Existe **um** lugar para flags e parâmetros de produto, trocável sem deploy e com registro de
      quem mudou o quê — de onde M1–M8 leem tudo que suas specs mandaram para "configuração".
- [ ] O funil pré-login é medido sem nenhum dado pessoal, e o produto funciona igual se a medição
      cair.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| n8n no lançamento | Adiado (AD-035/AD-002); a fábrica começa em scripts + Batch, n8n vira rotina depois |
| Kubernetes / infra própria / self-hosting | 3 devs sem ops; combo gerenciado resolve |
| Multi-região / failover geográfico | Latência BR + LGPD favorecem SP única; complexidade não se paga no MVP |
| Lógica de rate-limit / cache semântico do tutor | É M2 (a infra só provê o lar do store e a função de streaming) |
| Definição das queries de projeção e do plano | É M4 (a infra só provê pg_cron e o particionamento) |
| Pipeline de conteúdo em si (extração, explicação, áudio) | É M1/M2/M3 (a infra só define que roda em GitHub Actions + Batch) |
| CDN / otimização de mídia pesada | Storage Supabase + Vercel bastam no MVP |

---

## Assumptions & Open Questions

Toda ambiguidade está resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| Onde roda a fábrica pesada | **GitHub Actions** (workflows agendados/manuais) | Sem servidor pra manter, segredos geridos, reproduzível/registrado; Batch API é submeter+aguardar, encaixa | **y** (Discuss) → AD-036 |
| Observabilidade de erros/uptime | **Sentry** (erros front/servidor) + logs nativos Vercel/Supabase + `get_advisors` | Free tier, padrão da stack Next.js, alerta proativo | **y** (Discuss) → AD-037 |
| Retenção de backup | **7 dias** (padrão diário do Supabase Pro) | Mais barato (sem add-on PITR) e cumpre o DELETE-dos-backups (D29) mais rápido por expiração natural | **y** (Discuss, refina AD-035) → AD-038 |
| Plano Vercel | **Pro** | Necessário p/ streaming do tutor (timeout ~60s vs ~10s Hobby) e preview deploys; como o tutor é MVP (AD-051/AD-066), o Pro é **requisito do lançamento**, não custo opcional | **y** (AD-066) |
| Plano Supabase | **Pro** | Necessário p/ branching (staging), backups diários, compute add-on se preciso; pgvector/pg_cron/pg_partman disponíveis | n (derivado do requisito) |
| Store do rate-limit do tutor (M2) | **Postgres** (tabela + contagem), sem Redis novo | Evita nova dependência de infra; carga do MVP não exige Redis dedicado; revisar se o volume pedir | n |
| Gestão de migrações de schema | **Supabase CLI**, migrações versionadas em git, aplicadas via GitHub Actions; prod exige merge aprovado | Reproduzível, staging→prod controlado, sem clicar em produção | n |
| Ciclo de vida das partições de `tentativas` | Partições **nunca dropadas** (é a verdade crua). Na retenção dos 24m, as **linhas daquele `user_id` são APAGADAS** (DADOS-03), não anonimizadas in-place — a contribuição estatística já foi consolidada antes no acumulador anônimo do grupo 2 (AD-046) | Linha sem `user_id` mas com `sessao_id` ainda é uma sequência de uma pessoa só = **pseudonimizado**, que continua sendo dado pessoal; manter teria custo e nenhum ganho, já que o grupo 2 não depende dessas linhas. Corrige contradição com M7 (**AD-067**) | **y** (AD-067) |
| RPO/RTO com backup diário 7d | RPO ≈ até 24h (último snapshot diário); RTO = tempo de restore Supabase | Sem PITR não há recuperação a ponto arbitrário; aceito no MVP | n |
| Onde vivem flags e parâmetros de config | **Tabela versionada no Postgres** (Supabase), com cache curto na aplicação; env var só para o que precede o banco (URL/chave do Supabase, segredos) | **AD-078** — o requisito real é trocar valor **sem deploy**, e o GITFLOW depende disso ("deploy ≠ release"); env var obrigaria deploy para ligar uma flag | **y** |
| Granularidade da flag no lançamento | **Booleana global** por módulo/superfície; sem rollout percentual, sem segmentação por aluno, sem A/B | AD-078 — o AD-076 pede liga/desliga para todos, não rollout gradual; serviço externo custaria subprocessador novo para entregar o que ninguém pediu | **y** |
| Ferramenta de analytics de produto | **PostHog Cloud, região Estados Unidos** (org criada em 2026-08-16), com proxy reverso no domínio próprio | **AD-079** — não há região BR; self-host excluído por este mesmo M9 ("3 devs sem ops"). Região é de mão única no plano gratuito: migrar US→UE exige Scale/Enterprise | **y** (ferramenta e região) / **n** (base legal **e instrumento** da transferência — advogado, junto do M7) |
| Escopo do analytics no lançamento | **Só o funil pré-login** (página de vendas + checkout), em modo anônimo. Superfície logada nasce **atrás de flag desligada**, com 3 condições escritas | AD-079 — pré-login não tem `user_id` e não entra nos grupos do AD-027; a superfície logada esbarra em DADOS-02 e precisa da deleção amarrada antes | **y** |
| Session replay | **Não usar**, em nenhuma etapa | AD-079 — grava a tela do aluno; contraria DADOS-07 AC6 mais fortemente que um log de erro | **y** |
| Sentry × PostHog | **Coexistem com papéis distintos**: Sentry = defeito (INFRA-09), PostHog = comportamento (INFRA-12). Error tracking do PostHog fica desligado | AD-079 — ferramentas respondem perguntas diferentes; ligar as duas para erro é custo duplicado e alerta duplicado | **y** |
| Custo do PostHog no lançamento | Plano gratuito **provavelmente** suficiente no volume pré-lançamento (ordem de grandeza divulgada: ~1M eventos/mês, 1 projeto, retenção 1 ano) | Volume de visitante pré-lançamento é baixo; **número não confirmado em fonte primária de preço** — conferir antes de ligar | **n** (a confirmar) |

**Open questions:** none — tudo acima resolvido ou registrado. (Custo exato do compute Supabase, do
plano Vercel Pro e do PostHog é due-diligence de orçamento, não decisão de arquitetura. A base legal
do evento pré-login entra na mesma lista de confirmação jurídica que o M7 já mantém.)

---

## User Stories

### P1: Cada carga no seu lar (roteamento de compute) ⭐ MVP

**User Story**: Como plataforma, quero que trabalho longo rode fora do serverless e jobs leves em
pg_cron, para nada estourar timeout nem custo de função.

**Why P1**: É a regra de ouro do AD-035; violá-la quebra ingestão e projeções em produção.

**Acceptance Criteria**:

1. WHEN um trabalho longo (minutos/horas: extração PDF, explicações, embeddings, áudio, inéditas)
   precisa rodar, THEN o sistema SHALL executá-lo em **script standalone disparado por GitHub
   Actions** e/ou **Batch API**, e SHALL NOT executá-lo em função serverless da Vercel.
2. WHEN um job leve recorrente (projeções D15, plano diário D18) precisa rodar, THEN o sistema
   SHALL agendá-lo em **pg_cron** (dentro do Postgres, sem timeout de serverless), e SHALL NOT
   depender de Vercel Cron (teto ~60s).
3. WHEN o tutor ao vivo é acionado, THEN o sistema SHALL servi-lo como função da Vercel **Pro com
   streaming**, mantendo a conexão além do timeout curto.
4. WHEN um job da fábrica (Batch API) é interrompido no meio, THEN o sistema SHALL poder retomá-lo
   por chave de deduplicação (submeter+poll), sem duplicar registros já processados.

**Independent Test**: Disparar o workflow de extração no GitHub Actions e ver o job concluir com o
Vercel intocado; confirmar que a projeção roda por pg_cron; abrir o tutor e ver streaming.

---

### P1: `tentativas` particionada e indexada desde o dia 1 ⭐ MVP

**User Story**: Como plataforma, quero a maior tabela particionada por mês com índices desde o
início, para crescer para sempre e continuar rápida.

**Why P1**: `tentativas` é a verdade crua de todo o produto (AD-015); reparticionar depois é caro e
arriscado. Precisa nascer certa.

**Acceptance Criteria**:

1. WHEN o schema é criado, THEN `tentativas` SHALL ser particionada por mês via **pg_partman**
   (`RANGE` em `respondida_em`), com uma partição futura pré-criada.
2. WHEN uma consulta filtra por `user_id` e período, THEN o plano SHALL usar partition pruning +
   índice, e SHALL NOT varrer a tabela inteira.
3. WHEN uma nova partição de mês é necessária, THEN a manutenção do pg_partman SHALL criá-la
   automaticamente antes de o mês virar.
4. WHEN o particionamento é definido, THEN os índices de acesso (por `user_id`, por
   `sessao_id`, por `questao_id`) SHALL existir desde a primeira migração.

**Independent Test**: Inserir linhas em meses diferentes, rodar `EXPLAIN` numa consulta por
`user_id`+período e confirmar pruning para uma única partição.

---

### P1: Região SP, gerenciado, staging isolado ⭐ MVP

**User Story**: Como plataforma, quero tudo em SP num combo gerenciado, com staging por branch,
para conforto LGPD e para testar sem tocar produção.

**Why P1**: Dado no Brasil é premissa LGPD (AD-035); staging seguro evita quebrar produção com 3
devs.

**Acceptance Criteria**:

1. WHEN o projeto Supabase e os deploys Vercel são provisionados, THEN SHALL ficar na **região São
   Paulo**.
2. WHEN um branch de git é aberto para uma feature, THEN o sistema SHALL prover um ambiente de
   **staging** (Supabase branch + preview deploy Vercel) isolado de produção.
3. WHEN uma migração de schema é feita, THEN SHALL ser versionada em git (Supabase CLI) e aplicada
   a produção só após passar por staging e merge aprovado; SHALL NOT ser aplicada clicando direto
   em produção.

**Independent Test**: Abrir um branch, ver o preview Vercel + branch Supabase subirem; aplicar uma
migração em staging e confirmar que produção não mudou até o merge.

---

### P1: Backup ↔ DELETE sem furo de LGPD ⭐ MVP

**User Story**: Como plataforma, quero backup com retenção documentada que case com o prazo do
DELETE (D29), para o esquecimento não vazar por backup.

**Why P1**: Invariante dura #8/#13; sem isso o direito ao esquecimento fica furado.

**Acceptance Criteria**:

1. WHEN backups são configurados, THEN a retenção SHALL ser **7 dias** (backup diário padrão do
   Supabase Pro) e SHALL ser documentada na spec de infra.
2. WHEN um DELETE-por-esquecimento apaga o dado com-nome do banco vivo, THEN o mesmo dado SHALL
   sair de todos os backups por **expiração natural em ≤ 7 dias** (nenhum backup mais novo o
   contém), satisfazendo o prazo "~15–30 dias" do D29 com folga.
3. WHEN se avalia recuperação de desastre, THEN o RPO documentado SHALL ser "até ~24h (último
   snapshot diário)" e o sistema SHALL NOT prometer recuperação a ponto arbitrário (sem PITR).

**Independent Test**: Documento de infra declara retenção 7d + mecânica de rollover; simular DELETE
e confirmar que nenhum backup > 7 dias após o DELETE contém o dado.

---

### P2: Erro visível e alertável (observabilidade)

**User Story**: Como time, quero ver e ser alertado de erros de aplicação em produção, para
consertar antes de o aluno reclamar.

**Why P2**: Não bloqueia o loop central, mas em produção sem ops é o que evita apagão silencioso.
(Distinto da trilha de auditoria LGPD do D30, que é M7.)

**Acceptance Criteria**:

1. WHEN um erro não tratado ocorre no front ou no servidor Next.js, THEN o sistema SHALL capturá-lo
   no **Sentry** com contexto (rota, release), e SHALL alertar o time conforme regra configurada.
2. WHEN um job de pg_cron ou um workflow de GitHub Actions falha, THEN a falha SHALL ser visível
   (log + alerta), e SHALL NOT falhar em silêncio.
3. WHEN se investiga saúde do banco, THEN o time SHALL usar os logs nativos do Supabase + Vercel e
   os **advisors** (segurança/performance) como fonte complementar.

**Independent Test**: Lançar um erro proposital numa rota e vê-lo aparecer no Sentry com alerta;
forçar um pg_cron a falhar e confirmar que o alerta dispara.

---

### P1: Tutor ao vivo por streaming (infra) ⭐ MVP

**User Story**: Como plataforma, quero a função do tutor com streaming na Vercel Pro, para manter a
conexão além do timeout curto.

**Why P1**: O tutor **entra no lançamento** (AD-051/IA-10), então a infra que o sustenta sobe junto. Esta
história era P3 enquanto o `PRD.md` §4.2 tratava o tutor como fast-follow — contradição corrigida em
**AD-066**. O core pré-computado continua funcionando sem ela (AC2), mas ela **não** é opcional no dia 1.

**Acceptance Criteria**:

1. WHEN o tutor responde, THEN a função SHALL usar streaming (resposta incremental) e SHALL rodar
   no plano Vercel Pro (timeout compatível).
2. WHEN a API de IA cai, THEN o core pré-computado (questões, explicações, plano) SHALL continuar
   funcionando; apenas o tutor ao vivo SHALL degradar.

**Independent Test**: Derrubar a chave da API de IA em staging e confirmar que só o tutor cai; o
resto do app responde do banco.

---

### P1: Configuração e feature flags sem deploy ⭐ MVP

**User Story**: Como time, quero ligar/desligar uma superfície e trocar um parâmetro de produto sem
fazer deploy, para o "deploy ≠ release" do GITFLOW ser verdade e o Design dos módulos ter onde
guardar os números que as specs já mandaram para "configuração".

**Why P1**: O AD-001 escolheu flag como mecanismo e o AD-076 pôs 5 superfícies atrás de flag
desligada, mas nenhuma spec dizia onde o valor mora. Sem isto, M1–M8 não têm onde ler dezenas de
parâmetros já especificados — e o Design do M4 para na primeira história.

**Acceptance Criteria**:

1. O sistema SHALL manter **uma** fonte de configuração — tabela versionada no **Postgres** — que
   guarda tanto **feature flags** quanto **parâmetros de produto**; SHALL NOT espalhar esses valores
   por variável de ambiente, constante em código ou arquivo por ambiente.
2. Variável de ambiente SHALL ser usada **apenas** para o que precisa existir antes de o banco
   responder (URL/chave do Supabase, segredos de provedor); SHALL NOT hospedar flag nem parâmetro de
   produto.
3. WHEN o valor de uma flag ou de um parâmetro muda, THEN a mudança SHALL passar a valer **sem novo
   deploy**, dentro da janela de cache configurada.
4. A flag SHALL ser **booleana e global** por módulo/superfície; o sistema SHALL NOT oferecer rollout
   percentual, segmentação por aluno nem teste A/B no lançamento (AD-078).
5. WHEN a aplicação lê uma flag, THEN a leitura SHALL usar **cache curto**; SHALL NOT consultar o
   banco a cada verificação dentro da mesma requisição.
6. WHEN a fonte de configuração está indisponível, THEN o sistema SHALL assumir o **default
   declarado em código** para cada chave e SHALL alertar (AD-037); uma flag sem valor legível SHALL
   ser tratada como **desligada**, nunca como ligada.
7. WHEN uma flag ou parâmetro é alterado, THEN o sistema SHALL registrar **quem, quando, valor
   anterior e valor novo**; SHALL NOT permitir alteração anônima.
8. Toda chave SHALL ter **dono declarado** (o módulo que a consome) e um default; SHALL NOT existir
   chave órfã lida por dois módulos com significados diferentes.

**Independent Test**: Ligar uma flag pela tabela e ver a superfície aparecer sem deploy; derrubar a
leitura da config e confirmar que a superfície fica desligada (não ligada) e que o alerta dispara;
mudar `piso_anonimato` e ver a linha de registro com valor antigo e novo.

---

### P2: Analytics do funil pré-login

**User Story**: Como negócio, quero ver onde o visitante desiste entre a página de vendas e o
pagamento confirmado, para não gastar em tráfego às cegas — sabendo que o Sentry nunca vai me
contar isso, porque não é defeito.

**Why P2**: Não bloqueia o loop central nem a ativação, mas o produto está inteiro atrás do paywall
(AD-031) e a página de vendas é a única superfície de conversão (PAG-08). Um funil que converte mal
sem nenhum erro é invisível para o INFRA-09.

**Acceptance Criteria**:

1. O sistema SHALL instrumentar o **funil pré-login** (página de vendas → checkout → confirmação do
   pagamento) na ferramenta de analytics configurada (default hoje **PostHog Cloud região Estados
   Unidos**, AD-079; host e chave vivem na configuração, INFRA-11 — SHALL NOT ser fixados em código).
2. Os eventos pré-login SHALL ser enviados em **modo anônimo**, sem criar perfil de pessoa, e SHALL
   NOT conter `user_id`, e-mail, nome, CPF nem qualquer campo de meio de pagamento. Propriedade
   sensível SHALL ser barrada **na origem** (lista de bloqueio no SDK), não filtrada depois.
3. A ferramenta SHALL ser servida pelo **domínio próprio via proxy reverso** do Next.js; SHALL NOT
   ser carregada direto do domínio do fornecedor (bloqueador de anúncio derrubaria a medição).
4. A superfície **logada** (ativação, uso do plano, sessão de questões) SHALL nascer **atrás de flag
   desligada** e SHALL NOT ser ligada antes de as três condições do AD-079 estarem cumpridas:
   (a) política nomeando o operador e a transferência internacional, **com o instrumento da
   transferência para os EUA resolvido** (art. 33 LGPD); (b) deleção amarrada ao DADOS-04 com
   confirmação de conclusão; (c) lista de eventos e propriedades fechada e revisada.
5. O sistema SHALL NOT usar **session replay** em nenhuma etapa (AD-079).
6. O analytics SHALL NOT substituir a observabilidade do INFRA-09; o **error tracking** da
   ferramenta de analytics SHALL NOT ser ligado, e o Sentry SHALL continuar sendo a fonte de defeito.
7. A ferramenta de analytics SHALL NOT ser fonte de feature flag — flags vivem no INFRA-11 (AD-078).
8. WHEN o analytics fica indisponível ou é bloqueado no navegador, THEN a página de vendas e o
   checkout SHALL funcionar integralmente; SHALL NOT haver caminho de compra que dependa dele.

**Independent Test**: Percorrer o funil num ambiente de teste e ver os passos aparecerem sem nenhum
dado pessoal nas propriedades; bloquear a ferramenta no navegador e concluir a compra normalmente;
confirmar que a flag da superfície logada está desligada.

---

## Edge Cases

- WHEN uma função da Vercel tenta processar trabalho longo (regressão de código), THEN o desenho
  SHALL torná-lo impossível/óbvio (o job só existe como script de GitHub Actions/Batch, não como
  rota).
- WHEN dois disparos de pg_cron do mesmo job se sobrepõem, THEN o job SHALL ter guarda de
  reentrância (lock/advisory lock) e SHALL ser idempotente (recalculável do zero — D15).
- WHEN o pg_partman não roda a manutenção a tempo, THEN deve existir partição futura pré-criada
  como colchão; a falta de partição SHALL alertar (observabilidade), não perder INSERT.
- WHEN a Batch API retorna parcialmente, THEN o retomar SHALL usar chave de dedup e SHALL NOT
  duplicar.
- WHEN um segredo (chave de API, service_role) seria commitado, THEN SHALL residir em Vercel/
  Supabase env + GitHub Secrets, nunca no código.
- WHEN o webhook do Asaas chega (M8), THEN a infra SHALL exigir verificação de assinatura antes de
  processar (a lógica é M8; a infra garante o endpoint e o segredo).
- WHEN a tabela de configuração fica indisponível, THEN cada chave SHALL cair no default declarado em
  código e toda flag sem valor legível SHALL ficar **desligada** — falha de config SHALL NOT ligar
  superfície que estava desligada.
- WHEN uma flag é ligada e desligada em seguida, THEN a janela de cache SHALL fazer a mudança demorar
  no máximo o tempo configurado; o comportamento SHALL NOT variar entre instâncias por mais que isso.
- WHEN alguém altera um parâmetro que a política de privacidade declara em número (`retencao_meses`,
  DADOS-03 AC5), THEN a alteração SHALL exigir revisão da política — política e config SHALL NOT
  divergir por mudança silenciosa na tabela.
- WHEN o bloqueador de anúncio do visitante derruba o script de analytics, THEN o checkout SHALL
  concluir normalmente e a venda SHALL ser registrada pelo Asaas — a medição SHALL NOT ser caminho
  crítico de nenhuma compra.

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| INFRA-01 | P1: Região SP, gerenciado | Design | Pending |
| INFRA-02 | P1: Cada carga no seu lar (trabalho longo → GitHub Actions/Batch) | Design | Pending |
| INFRA-03 | P1: Cada carga no seu lar (jobs leves → pg_cron) | Design | Pending |
| INFRA-04 | P1: `tentativas` particionada + indexada (pg_partman) | Design | Pending |
| INFRA-05 | P1: Tutor ao vivo por streaming (Vercel Pro) (AD-051/AD-066) | Design | Pending |
| INFRA-06 | P1: Backup 7d ↔ DELETE D29 | Design | Pending |
| INFRA-07 | P1: Staging por branch | Design | Pending |
| INFRA-08 | (Out of scope reforçado) n8n adiado | - | Pending |
| INFRA-09 | P2: Observabilidade (Sentry + logs nativos + advisors) | Design | Pending |
| INFRA-10 | P1/P2: Segredos fora do código + webhook Asaas verificado | Design | Pending |
| INFRA-11 | P1: Configuração + feature flags em tabela Postgres, sem deploy, com registro de alteração (AD-078) | Design | Pending |
| INFRA-12 | P2: Analytics do funil pré-login, anônimo, por proxy reverso; superfície logada atrás de flag (AD-079) | Design | Pending |

**ID format:** `[CATEGORY]-[NUMBER]` → `INFRA-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 12 requisitos, 0 mapeados a tasks ainda (Specify), 0 sem cobertura de story ⚠️ (todos
ligados a uma story ou ao Out of Scope).

---

## Success Criteria

- [ ] Nenhum trabalho longo roda em função da Vercel (auditável no código: só GitHub Actions/Batch).
- [ ] `EXPLAIN` numa consulta típica de `tentativas` mostra partition pruning para 1 partição.
- [ ] Projeções e plano diário rodam por pg_cron sem estourar timeout.
- [ ] Ambiente confirmado na região SP; staging por branch sobe e desce sem tocar produção.
- [ ] Retenção de backup = 7d documentada; DELETE some do backup em ≤7d (teste de rollover).
- [ ] Erro proposital aparece no Sentry com alerta; falha de pg_cron/GitHub Actions não é silenciosa.
- [ ] Com a API de IA fora do ar, o core pré-computado responde normalmente.
- [ ] Ligar e desligar uma superfície é mudar uma linha na tabela de config — nenhum deploy, e a
      alteração fica registrada com autor.
- [ ] Config ilegível deixa toda flag **desligada** e dispara alerta; nunca liga nada por omissão.
- [ ] Nenhum evento de analytics carrega dado pessoal; a compra se conclui com o analytics bloqueado.
- [ ] A flag da superfície logada do analytics está desligada no lançamento e nenhuma tela usa
      session replay.
