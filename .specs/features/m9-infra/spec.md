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

**Open questions:** none — tudo acima resolvido ou registrado. (Custo exato do compute Supabase e
do plano Vercel Pro é due-diligence de orçamento, não decisão de arquitetura.)

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

**ID format:** `[CATEGORY]-[NUMBER]` → `INFRA-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10 requisitos, 0 mapeados a tasks ainda (Specify), 0 sem cobertura de story ⚠️ (todos
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
