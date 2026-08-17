# M7 — LGPD & Flywheel de Dados · Especificação

> 🧭 **Spec temática — fonte de requisito, não unidade de implementação.** A ordem de construção é a
> de [`.specs/ROADMAP.md`](../../ROADMAP.md); estes requisitos são construídos pelas specs numeradas
> em `.specs/features/NN-*/`. Aqui mora o **texto** do requisito; lá mora **quando** ele entra.
> M7 → specs **30, 31, 32, 35, 41**.

> Fonte: `PRD.md` §M7, §6 (LGPD/Segurança), §7.5, §9 (invariantes 8/9/10/13), §10 (aberta nº10).
> Decisões: AD-026, AD-027, AD-028, AD-029, AD-030. Herda contratos: **AD-042** (log `tentativas`:
> só-INSERT, DELETE por `user_id` permitido, snapshot congelado, particionada por mês), **AD-043**
> (causa do erro; no simulado vive em linha/tabela vizinha ligada à tentativa), **AD-044** (projeções
> recalculáveis), **AD-038** (backup 7 dias, sem PITR), **AD-037** (Sentry — observabilidade técnica,
> distinta da trilha de auditoria LGPD). Gray zone resolvida em Discuss (2026-07-23): AD-045 (retenção
> parametrizada), AD-046 (grupo 2 = acumulador que sobrevive ao DELETE), AD-047 (declaração 18+),
> AD-048 (auto-aplicação por lista fechada reversível).

## Problem Statement

O mesmo log `tentativas` que **opera** o produto também **melhora** a plataforma (flywheel). Os dois usos
têm base legal diferente e prazo de vida diferente, e a lei dá ao aluno o direito de mandar apagar tudo.
Se isso não for separado desde o dia 1, ou o produto trava atrás de um checkbox de consentimento (mata a
ativação) ou o "apaga tudo meu" destrói o aprendizado coletivo que a plataforma já acumulou. A solução é
estrutural: **base legal por finalidade**, **3 grupos de dado** com ciclos de vida distintos, e um
flywheel que roda em cima do **agregado anônimo** — que sobrevive ao DELETE porque não identifica
ninguém (art. 12).

## Goals

- [ ] O núcleo do produto funciona sem nenhum checkbox de consentimento, com política em português claro.
- [ ] Todo dado do aluno está classificado em 1 dos 3 grupos, e cada grupo tem regra de vida escrita.
- [ ] "Apague tudo meu" apaga de fato — banco, projeções e backups — em prazo definido e auditável, sem
      destruir a estatística anônima.
- [ ] O flywheel roda no dia 1 sobre o grupo 2 (agregado anônimo, risco ~zero), com opt-out.
- [ ] Todo acesso a dado com nome é mínimo (RLS) e deixa rastro (auditoria).

## Out of Scope

| Feature | Motivo |
| ------- | ------ |
| Vender/compartilhar dado com terceiros | Não é o modelo (PRD §M7) |
| Consentimento granular (tela de switches por finalidade) | Rejeitado em D26/AD-026 |
| Retreinar modelo de IA por causa de um aluno | Fora do desenho (pré-computa, AD-010) |
| Schema do log `tentativas`, causa do erro, projeções | É M4 (AD-042/043/044); M7 só define ciclo de vida e acesso |
| Backup/PITR/região em si | É M9 (INFRA-06 / AD-038); M7 herda o prazo |
| Checkout, e-mail transacional, matrícula | É M8 (M7 só dita o que o checkout SHALL coletar/declarar) |
| Grupo 3 (sequência pseudonimizada) implementado | Fast-follow — só o contrato fica escrito (P3) |
| Faturas/NF e retenção fiscal | É M8; M7 só marca que sobrevivem ao DELETE |

---

## Assumptions & Open Questions

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| Janela de retenção do com-nome | **24 meses** de inatividade como default, mas o número vive em **configuração** (`retencao_meses`); a regra/comportamento é que é dura | Discuss 2026-07-23 (AD-045); ciclo anual do concurso; trocar 24→18/36 = config, não código | n (pendente advogado) |
| Piso de respondentes p/ tratar agregado como anônimo | **≥20** como default em configuração; a regra é dura (abaixo do piso não exibe nem usa) | Discuss 2026-07-23; PRD §7.5 "~20"; permite subir sem mexer no código | y (regra) / n (número) |
| Menores de idade | **Declaração 18+** no checkout + termos limitando a maiores + canal para o responsável pedir exclusão | Discuss 2026-07-23 (AD-047); resolve a aberta nº10 do PRD sem atrito no checkout de e-mail-só (AD-034) | y |
| Grupo 2 sobrevive ao DELETE | O agregado é **acumulador materializado** (contadores incrementados por job), **não** recalculado do zero após um DELETE — senão a contribuição do apagado sumiria e o art. 12 não se cumpriria | Consequência forçada de AD-029 × AD-015; ver AD-046 e a nota de tensão abaixo | y (forçado por lei) |
| Prazo de resposta ao titular | **15 dias** para os pedidos (art. 19, II LGPD); DELETE efetivo no banco em **≤7 dias** e some dos backups por expiração natural em **≤7 dias** | AD-038 (backup 7d) cumpre o "~15–30 dias" do AD-029 com folga | n (prazo legal a confirmar) |
| Encarregado (DPO) | Um dos sócios nomeado, com e-mail público na política | LGPD art. 41; obrigação leve p/ o porte | n (confirmar advogado) |
| Auto-aplicação pela IA | Permitida **só** numa lista fechada, explícita, reversível e auditada (AD-048); lista inicial = **aposentar distrator com 0 marcações em ≥N respostas**, N configurável e alto | Discuss 2026-07-23; ganha velocidade sem abrir a porta toda | y (regra) / n (N) |
| LIA (teste de balanceamento) | Documento escrito **antes** de ligar o flywheel; é um artefato, não código | AD-026; PRD §M7 critério final | n (a redigir) |
| Onde vive o opt-out do flywheel | Tela de conta/privacidade, 1 chave, sem ginástica; opt-out **não** degrada o produto do aluno | AD-026 (legítimo interesse exige opt-out real) | y |
| Analytics de produto como operador | **PostHog Cloud região Estados Unidos** (AD-079/INFRA-12). No lançamento mede **só o funil pré-login**, em modo anônimo, sem `user_id`/e-mail/nome/CPF. É o **primeiro subprocessador fora do Brasil** do projeto | Pré-login não é aluno: não tem `user_id` e não entra nos 3 grupos. Ainda assim o evento carrega IP e id de dispositivo — risco **menor, não nulo** | y (ferramenta e escopo) / **n** (base legal — advogado) |
| Instrumento da transferência internacional | Os **EUA não têm decisão de adequação da ANPD** → a transferência precisa de outro mecanismo do **art. 33** da LGPD (cláusulas-padrão contratuais é o caminho usual, aprovadas por resolução da ANPD). SHALL ser resolvido **antes** de ligar a flag da superfície logada | AD-079 — com o destino EUA, o item do advogado deixa de ser só "qual base legal" e passa a incluir "qual instrumento"; no escopo pré-login o risco é menor, não nulo | **n** (advogado) |
| Superfície logada no analytics | Nasce **atrás de flag desligada**; ligar exige as 3 condições do AD-079 — política nomeando operador + transferência internacional, deleção amarrada ao DADOS-04, lista de eventos fechada e revisada | DADOS-02 exige todo dado pessoal **declarado no schema**; evento com `user_id` em serviço de terceiro é grupo 1 fora do schema | y |
| Session replay | **Proibido** em qualquer etapa | Grava a tela do aluno — contraria DADOS-07 AC6 mais fortemente que um log de erro (AD-079) | y |

**Tensão registrada (importante para o Design):** AD-015/AD-044 dizem que *toda* projeção é recalculável
do zero a partir do log. O **grupo 2 é a exceção deliberada** — ele precisa ser um acumulador que
sobrevive à remoção da fonte. Design SHALL tratar `estatisticas_*` (grupo 2) como store próprio, não como
projeção rebuildável. Consequência aceita: após DELETEs, um rebuild total do log produziria números
**menores** que o acumulador; o acumulador é a autoridade do grupo 2.

**Open questions:** none — as pendências jurídicas acima são *due diligence* (não travam Design) e estão
registradas como assumptions com default escolhido.

---

## User Stories

### P1: Núcleo sem checkbox + base legal por finalidade ⭐ MVP

**User Story**: Como aluno, quero usar o produto sem marcar "aceito que usem meus dados", porque o log é o
produto que eu contratei — e quero uma política clara em português.

**Why P1**: Invariante nº9 do PRD. Um checkbox na entrada mata a ativação e é juridicamente errado
(operar o produto é execução de contrato, não consentimento).

**Acceptance Criteria**:

1. O núcleo do produto (responder questão, ver explicação, plano, projeções) SHALL NOT ficar atrás de
   checkbox de consentimento; SHALL operar sob a base legal **execução de contrato**.
2. O sistema SHALL manter **uma** política de privacidade em português claro, sem letra miúda, que declare
   explicitamente as **três finalidades** e sua base legal: operar (contrato) · melhorar a plataforma
   (legítimo interesse) · marketing/notificação (consentimento).
3. O **flywheel** SHALL rodar sob **legítimo interesse**, em regime de **opt-out**: exige (a) LIA escrito
   e arquivado **antes** de ser ligado, (b) transparência na política, (c) chave de opt-out acessível na
   conta.
4. WHEN o aluno aciona o opt-out do flywheel, THEN o sistema SHALL parar de incluir os dados dele nos
   grupos 2 e 3 daí em diante e SHALL NOT degradar nenhuma função do produto que ele pagou.
5. Marketing/notificação SHALL exigir **consentimento** afirmativo (clique), separado, revogável; SHALL NOT
   vir pré-marcado; revogar SHALL NOT afetar o acesso ao produto.
6. WHEN o aluno revoga o consentimento de marketing, THEN o sistema SHALL parar os envios em ≤ 48h e SHALL
   registrar a revogação (data/hora).
7. SHALL NOT existir tela de consentimento granular por finalidade (switches) — rejeitada em AD-026.
8. A política SHALL nomear os **operadores** que tratam dado pessoal por nossa conta e SHALL declarar toda
   **transferência internacional** — qual serviço, para que finalidade, em que país/região. Isso inclui a
   ferramenta de analytics (AD-079/INFRA-12, região **Estados Unidos**), primeiro tratamento fora do
   Brasil do projeto.
   WHEN um operador novo passa a tratar dado pessoal, THEN a política SHALL ser atualizada e versionada
   **antes** de o tratamento começar; SHALL NOT existir operador não declarado.

**Independent Test**: Criar conta, nunca marcar nada, e completar o loop central inteiro; ligar o opt-out
do flywheel e confirmar que o plano/questões continuam idênticos; conferir que todo serviço que recebe
dado pessoal aparece nomeado na política, com a região onde trata.

---

### P1: Três grupos de dado com ciclo de vida separado ⭐ MVP

**User Story**: Como plataforma, quero cada dado do aluno classificado em um dos 3 grupos, para saber
exatamente o que morre no DELETE e o que sobrevive.

**Why P1**: É a decisão estrutural (AD-027) da qual todo o resto do M7 depende.

**Acceptance Criteria**:

1. Todo dado pessoal do aluno SHALL pertencer a exatamente **um** dos grupos, declarado no schema:
   - **Grupo 1 — operacional com nome**: `auth.users`, perfil, meta, `sessoes`, `tentativas` (via
     `user_id`), a linha vizinha de causa do simulado (AD-043), `feedback_explicacao`, e **todas as
     projeções de M4/M6** (`dominio_topico`, `caderno_erros`, agenda de revisão, hábito). Base = contrato.
     **Some no DELETE.**
   - **Grupo 2 — estatística somada anônima**: contadores **por questão/tópico** (`n_respostas`,
     acertos, tempo médio, dificuldade real, índice de discriminação). **SHALL NOT** conter
     `user_id`, id pseudonimizado, nem qualquer coluna que permita voltar ao indivíduo. Fora da LGPD
     (art. 12). **Sobrevive ao DELETE.**
   - **Grupo 3 — sequência pseudonimizada**: fluxo por aluno-código, só p/ knowledge tracing. Ainda é dado
     pessoal. **Some no DELETE.** Fast-follow (P3).
2. WHEN o dia 1 sobe, THEN SHALL existir apenas os grupos **1 e 2**; o grupo 3 SHALL NOT ser criado antes
   do fast-follow.
3. WHEN o flywheel lê dado, THEN ele SHALL ler do **grupo 2** por padrão; SHALL NOT ler `tentativas` com
   `user_id` para fins de melhoria da plataforma.
4. WHEN um agregado do grupo 2 é **calculado, exibido ou usado** para decidir algo, THEN ele SHALL ter
   `n_respondentes >= piso_anonimato` (default **20**, em configuração); WHEN abaixo do piso, THEN o
   sistema SHALL tratá-lo como indisponível — SHALL NOT exibir, SHALL NOT usar como sinal.
5. O grupo 2 SHALL ser um **acumulador materializado** (incrementado por job a partir de novas
   tentativas), SHALL NOT ser recalculado do zero a partir do log corrente — porque precisa preservar a
   contribuição de quem já exerceu o DELETE (art. 12).
6. O job acumulador SHALL ser **idempotente**: reprocessar a mesma janela SHALL NOT contar duas vezes
   (marca d'água por partição/timestamp processado).

**Independent Test**: Listar todas as tabelas com dado de aluno e confirmar que cada uma tem grupo
declarado; inserir tentativas de 19 alunos numa questão e ver a estatística indisponível; a 20ª libera.

---

### P1: Direito ao esquecimento (DELETE seletivo) ⭐ MVP

**User Story**: Como aluno, quero pedir "apague tudo meu" e ter meus dados com nome removidos — inclusive
dos backups — em prazo definido, entendendo que estatísticas anônimas que não me identificam permanecem.

**Why P1**: Art. 18, VI. Invariante nº8 do PRD. É um direito, não uma feature opcional.

**Acceptance Criteria**:

1. WHEN o aluno solicita a exclusão pela conta, THEN o sistema SHALL exibir, **antes** de confirmar, o que
   será apagado e o que permanece (estatística anônima agregada + faturas por obrigação fiscal), e SHALL
   exigir confirmação explícita.
2. WHEN a exclusão é confirmada, THEN o sistema SHALL apagar, em ≤ **7 dias**, **todo** o grupo 1 daquele
   `user_id`: conta de auth, perfil/meta, `sessoes`, `tentativas` (todas as partições), a linha vizinha de
   causa do simulado, `feedback_explicacao` e **todas as projeções** derivadas — e o grupo 3, quando
   existir.
3. O só-INSERT de `tentativas` (AD-042) SHALL NOT impedir o DELETE por `user_id`; o DELETE-por-esquecimento
   é operação distinta do DELETE-por-edição (que continua proibido).
4. WHEN o DELETE roda, THEN o **grupo 2 (agregado anônimo) SHALL permanecer intacto** — os contadores não
   são decrementados (art. 12).
5. WHEN o DELETE roda, THEN `faturas`/`pagamentos`/NF (M8) SHALL ser retidos pelo prazo legal fiscal e
   SHALL ser reduzidos ao mínimo necessário para a obrigação.
6. Os dados apagados SHALL sumir dos **backups** por **expiração natural em ≤7 dias** (AD-038: backup
   diário, retenção 7 dias, sem PITR), cumprindo o prazo do AD-029; a spec de infra SHALL NOT aumentar a
   retenção sem revisar este requisito.
7. WHEN o DELETE termina, THEN o sistema SHALL registrar na auditoria (quem pediu, quando, o que foi
   apagado, quando expira dos backups) e SHALL enviar confirmação por e-mail ao titular antes de invalidar
   o endereço.
8. WHEN o DELETE é solicitado e a matrícula ainda está válida, THEN o sistema SHALL avisar que o acesso
   pago será encerrado e que não há reembolso automático fora da garantia (M8), e SHALL exigir confirmação.
9. O DELETE SHALL ser **idempotente e retomável**: reexecutar após falha parcial SHALL levar ao mesmo
   estado final, e uma falha SHALL ser visível/alertada (AD-037), nunca silenciosa.
10. O DELETE SHALL alcançar **todo operador** que guarde dado do grupo 1 daquele titular, não apenas o
    banco próprio. WHEN a superfície logada do analytics estiver ligada (AD-079/INFRA-12), THEN o DELETE
    SHALL chamar a **API de deleção de pessoa** do fornecedor pedindo a remoção dos eventos, SHALL
    **conferir o status de conclusão** devolvido por ele, e SHALL NOT dar o pedido por concluído enquanto
    a confirmação não chegar. WHEN a confirmação não chega no prazo, THEN o caso SHALL ser alertado e
    permanecer na fila — SHALL NOT ser encerrado como sucesso.
11. WHEN a superfície logada do analytics está **desligada** (estado de lançamento), THEN não há dado do
    grupo 1 no fornecedor e o AC10 SHALL ser um no-op registrado; a checagem SHALL existir mesmo assim,
    para que ligar a flag no futuro não deixe o DELETE incompleto por esquecimento.

**Independent Test**: Criar aluno, responder 30 questões, pedir exclusão; confirmar que nenhuma linha com
`user_id` sobrevive em nenhuma tabela/partição/projeção, que o contador da questão no grupo 2 **não** caiu,
e que a fatura permanece. Com a flag do analytics logado ligada em staging, confirmar que o DELETE só
fecha depois que o fornecedor confirma a remoção dos eventos daquela pessoa.

---

### P1: Retenção — janela de inatividade → anonimiza e apaga ⭐ MVP

**User Story**: Como plataforma, quero que o dado com nome de quem sumiu não fique guardado para sempre,
para só reter enquanto serve.

**Why P1**: Invariante nº13; princípio da necessidade (art. 6º, III).

**Acceptance Criteria**:

1. WHEN uma conta fica **inativa** por `retencao_meses` (default **24**, em configuração) contados da
   última atividade **ou** do fim da matrícula (o que for mais recente), THEN o sistema SHALL (a)
   consolidar a contribuição dela no grupo 2 e (b) **apagar** todo o grupo 1 dela — inclusive as linhas de
   `tentativas`. O sistema SHALL NOT "anonimizar in-place" (manter a linha sem `user_id`): linha sem nome
   mas com `sessao_id` ainda é sequência de uma pessoa só, ou seja, **pseudonimizada** e portanto dado
   pessoal. A spec de infra (M9) foi alinhada a este requisito em **AD-067**.
2. O job de retenção SHALL rodar agendado (pg_cron, INFRA-03), SHALL ser idempotente e SHALL registrar
   cada anonimização na auditoria.
3. WHEN o aluno volta e faz login **dentro** da janela, THEN o relógio SHALL reiniciar e nada SHALL ser
   apagado (ciclo anual do concurso — o aluno volta no edital seguinte).
4. WHEN faltarem **30 dias** para a anonimização, THEN o sistema SHALL avisar o titular por e-mail,
   informando que voltar preserva o histórico.
5. A política de privacidade SHALL declarar a janela em número, e o número SHALL ser lido da configuração
   (uma fonte só — política e código SHALL NOT divergir).
6. O agregado anônimo (grupo 2) SHALL ser retido **por prazo indeterminado**; dados fiscais, pelo prazo
   legal.

**Independent Test**: Semear uma conta com última atividade há `retencao_meses + 1`, rodar o job, e ver o
grupo 1 zerado, o grupo 2 preservado e a linha de auditoria escrita.

---

### P1: Acesso mínimo (RLS) + trilha de auditoria ⭐ MVP

**User Story**: Como plataforma, quero acesso mínimo por sensibilidade e rastro de todo acesso a dado com
nome, para prestar contas.

**Why P1**: Art. 46/art. 6º VII (segurança e prestação de contas); AD-030.

**Acceptance Criteria**:

1. Toda tabela do **grupo 1** SHALL ter **RLS habilitada**; a política padrão SHALL ser: o aluno lê/escreve
   **apenas as próprias linhas** (`auth.uid() = user_id`).
2. O acesso SHALL ser escalonado por sensibilidade: **grupo 2** (anônimo) = time amplo; **grupo 1**
   (com nome) = poucas pessoas, sempre registrado; **grupo 3** (código) = restrito.
3. WHEN qualquer operador/serviço acessa ou altera dado **com nome** fora do fluxo do próprio titular,
   THEN o sistema SHALL gravar em `auditoria`: **quem**, **quando**, **o quê** (tabela/registro), **por
   quê** (motivo/ticket).
4. `auditoria` SHALL ser **só-INSERT** e SHALL NOT ser apagável por quem opera o produto.
5. A trilha de auditoria LGPD SHALL ser **distinta** da observabilidade técnica (Sentry/logs, AD-037) —
   erro de aplicação SHALL NOT ser gravado como acesso a dado pessoal, e vice-versa.
6. Logs de aplicação e mensagens de erro SHALL NOT conter dado pessoal em texto claro (sem enunciado de
   resposta, e-mail ou nome no corpo do erro).
7. A chave de serviço (`service_role`) SHALL ser usada apenas nos jobs da fábrica/servidor, nunca exposta
   ao cliente, e seu uso sobre grupo 1 SHALL passar pela auditoria.

**Independent Test**: Autenticar como aluno A e tentar ler tentativas do aluno B (deve falhar por RLS);
rodar uma consulta administrativa sobre grupo 1 e ver a linha de auditoria correspondente.

---

### P1: Canal do titular e encarregado ⭐ MVP

**User Story**: Como aluno, quero um caminho claro para exercer meus direitos (ver, corrigir, exportar,
apagar) e saber com quem falar.

**Why P1**: Art. 18 e art. 41. Sem canal, os outros requisitos não têm porta de entrada.

**Acceptance Criteria**:

1. A política SHALL indicar o **encarregado (DPO)** com nome/função e um e-mail de contato ativo.
2. O sistema SHALL oferecer, na conta, pelo menos: **exclusão** (P1 acima), **exportação** dos dados do
   aluno em formato legível por máquina (JSON) e **correção** dos dados cadastrais.
3. WHEN um pedido de titular chega (pela conta ou pelo e-mail do encarregado), THEN o sistema SHALL
   responder em até **15 dias** e SHALL registrar o pedido e a resposta.
4. A exportação SHALL conter os dados do grupo 1 daquele aluno (perfil, tentativas com snapshot, causas,
   projeções) e SHALL NOT conter dado de outros alunos.
5. WHEN o pedido for de correção de um fato do log (`tentativas`), THEN o sistema SHALL registrar a
   correção em **linha vizinha/anexa** — SHALL NOT dar UPDATE no fato (AD-042).

**Independent Test**: Pedir exportação e receber um JSON com as próprias tentativas; pedir correção de
e-mail e ver o cadastro alterado com registro.

---

### P1: Declaração de maioridade no checkout ⭐ MVP

**User Story**: Como plataforma, quero que o serviço seja declaradamente para maiores de 18, para não
tratar dado de menor sem base legal adequada.

**Why P1**: Resolve a questão aberta nº10 do PRD; art. 14 tem regime próprio que este produto não pretende
suportar.

**Acceptance Criteria**:

1. O checkout (M8) SHALL exigir **declaração afirmativa de que o comprador tem 18 anos ou mais**, junto do
   aceite dos termos, e SHALL registrar data/hora da declaração.
2. Os termos de uso e a política SHALL declarar que o serviço **destina-se a maiores de 18 anos**.
3. O sistema SHALL NOT coletar data de nascimento para essa finalidade (minimização — a declaração basta).
4. WHEN o sistema é informado de que um titular é menor de 18, THEN SHALL tratar o caso pelo canal do
   titular, apagar os dados e encerrar o acesso, com registro em auditoria.

**Independent Test**: Tentar concluir o checkout sem marcar a declaração (deve bloquear); conferir o
registro da declaração no cadastro criado.

---

### P2: Flywheel esteira 1 — a matemática delata a questão ruim

**User Story**: Como operador, quero que os números delatem questões quebradas sozinhos, para eu não
revisar questão por questão.

**Why P2**: Melhora o acervo; não bloqueia o loop central. Depende de volume.

**Acceptance Criteria**:

1. A **esteira 1** SHALL ser 100% automática e SHALL calcular, por questão, a partir do grupo 2:
   **dificuldade real** (taxa de acerto), **tempo médio**, **`n_respostas`** (quantas vezes a questão foi
   respondida) e **índice de discriminação** (quanto a questão separa quem vai bem de quem vai mal no
   conjunto). O termo **"frequência" SHALL ser reservado ao Raio-X** (M5: quanto o assunto cai na prova) —
   nomes distintos para conceitos distintos (**AD-070**).
2. WHEN o índice de discriminação de uma questão fica **abaixo do limiar** (config) com
   `n_respondentes >= piso_anonimato`, THEN o sistema SHALL marcá-la como **suspeita** e SHALL colocá-la na
   fila de revisão — SHALL NOT despublicá-la automaticamente.
3. A esteira 1 SHALL poder ajustar **apenas números que afinam o plano de leve** (dificuldade calibrada,
   peso); SHALL NOT alterar enunciado, alternativas, gabarito ou explicação (invariante nº10).
4. WHEN `n_respondentes < piso_anonimato`, THEN nenhum sinal da esteira 1 SHALL ser usado para aquela
   questão (cold-start: a amostra ainda não diz nada).
5. A `dificuldade` calibrada SHALL substituir a estimada pela IA (AD-040) quando houver volume suficiente,
   sem reescrever o snapshot de tentativas antigas (AD-042).

**Independent Test**: Semear respostas em que alunos fortes erram tanto quanto os fracos e ver a questão
virar suspeita na fila, sem sumir do ar.

---

### P2: Esteira 2 (IA peneira, humano confirma) + auto-aplicação por lista fechada

**User Story**: Como operador, quero que a IA me entregue o diagnóstico pronto das questões suspeitas para
eu confirmar em ~1h/semana — e que um punhado de correções triviais e reversíveis se apliquem sozinhas.

**Why P2**: Escala a curadoria sem abrir mão do "não ensinar errado".

**Acceptance Criteria**:

1. WHEN uma questão entra na fila de suspeitas, THEN a IA SHALL pré-diagnosticar (o que parece errado, qual
   evidência, qual correção sugerida) e SHALL apresentá-la numa tela de revisão em lote.
2. Correções **arriscadas** — mudar gabarito, mudar enunciado, mudar o que se ensina — SHALL exigir decisão
   humana (esteiras 2/3); a IA SHALL apenas sugerir.
3. WHEN o humano aprova uma correção de questão publicada, THEN ela SHALL virar **nova versão**
   (`questao_versao + 1`, AD-039) — SHALL NOT reescrever a anterior, e as tentativas antigas SHALL seguir
   apontando para a versão respondida.
4. A **auto-aplicação pela IA** SHALL ser restrita a uma **lista fechada e explícita** de ações; a lista
   inicial contém **apenas**: aposentar distrator com **0 marcações** em `>= N` respostas (N configurável e
   alto). Qualquer ação fora da lista SHALL exigir humano.
5. Toda auto-aplicação SHALL (a) exigir `n_respondentes >= piso_anonimato` **e** o próprio N da regra,
   (b) gravar auditoria (o quê, por qual regra, com qual evidência, quando), (c) ser **reversível em um
   passo** e (d) aparecer num relatório para o humano revisar depois.
6. WHEN a auto-aplicação é revertida, THEN o sistema SHALL registrar a reversão e SHALL NOT reaplicar a
   mesma ação naquela questão sem decisão humana.
7. A lista fechada SHALL viver em configuração versionada; ampliá-la SHALL ser decisão humana registrada
   (novo AD), nunca inferência da IA.

**Independent Test**: Semear uma questão com um distrator de 0 marcações em N+10 respostas, rodar a
esteira, ver o distrator aposentado com auditoria e reverter em um passo.

---

### P3: Grupo 3 — sequência pseudonimizada (fast-follow)

**User Story**: Como plataforma, quero a sequência por aluno-código para knowledge tracing, aceitando que
ela some no DELETE.

**Why P3**: É o motor adaptativo mais avançado; exige volume e não bloqueia o MVP (AD-027).

**Acceptance Criteria**:

1. O grupo 3 SHALL usar um **código por aluno** (pseudônimo), com a tabela de correspondência
   código↔`user_id` guardada **separada** e com acesso restrito.
2. O grupo 3 SHALL ser tratado como **dado pessoal** (pseudonimizar não é anonimizar) e SHALL sumir no
   DELETE, junto com a correspondência.
3. O grupo 3 SHALL rodar sob **legítimo interesse** e SHALL respeitar o opt-out do flywheel.
4. WHEN o grupo 3 é criado, THEN a política e o LIA SHALL ser atualizados **antes** de ligá-lo.

**Independent Test**: Ligar o grupo 3 num aluno de teste, pedir DELETE e confirmar que a sequência e a
tabela de correspondência sumiram.

---

## Edge Cases

- WHEN o aluno pede DELETE e depois compra de novo com o mesmo e-mail, THEN o sistema SHALL criar uma
  conta **nova e vazia** — SHALL NOT ressuscitar o histórico apagado.
- WHEN um DELETE roda no meio de uma sessão de estudo aberta, THEN as tentativas gravadas até ali SHALL ser
  apagadas junto e a sessão SHALL ser encerrada; nada SHALL ficar órfão apontando para o `user_id` morto.
- WHEN uma questão tem exatamente `piso_anonimato - 1` respondentes, THEN a estatística SHALL permanecer
  indisponível (comparação é `>=`, sem arredondar).
- WHEN um DELETE derruba o nº de respondentes de uma questão abaixo do piso, THEN o agregado do grupo 2
  SHALL NOT ser decrementado (o contador é acumulador — AC5 da story de grupos), e a estatística SHALL
  continuar disponível.
- WHEN o job de retenção falha no meio, THEN as contas já processadas SHALL permanecer processadas, o job
  SHALL retomar do ponto e a falha SHALL ser alertada (AD-037).
- WHEN o mesmo pedido de DELETE chega duas vezes, THEN o segundo SHALL ser aceito e resultar no mesmo
  estado (idempotente), sem erro para o titular.
- WHEN alguém tenta exportar dados informando o `user_id` de outra pessoa, THEN a RLS SHALL bloquear e o
  acesso negado SHALL ser registrado.
- WHEN a política de privacidade muda materialmente, THEN o sistema SHALL avisar os titulares e SHALL
  versionar a política (qual versão o titular viu, e quando).
- WHEN o opt-out do flywheel é acionado, THEN as contribuições **já consolidadas** no grupo 2 SHALL
  permanecer (são anônimas e irreversíveis); o opt-out vale daí em diante — e a política SHALL dizer isso.
- WHEN o aluno pede exportação de um volume grande, THEN o arquivo SHALL ser gerado fora do serverless
  (AD-036) e entregue por link expirável, nunca montado numa requisição síncrona.

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| DADOS-01 | P1: Base legal por finalidade — contrato / legítimo interesse+LIA+opt-out / consentimento (AD-026) | Design | Pending |
| DADOS-02 | P1: Três grupos de dado, classificação obrigatória no schema (AD-027) | Design | Pending |
| DADOS-03 | P1: Retenção — janela de inatividade parametrizada → anonimiza e apaga (AD-028/AD-045) | Design | Pending |
| DADOS-04 | P1: Direito ao esquecimento, DELETE seletivo + backups (AD-029/AD-038) | Design | Pending |
| DADOS-05 | P2: Flywheel 3 esteiras, arriscado exige humano (AD-030) | Design | Pending |
| DADOS-06 | P2: Índice de discriminação delata questão ruim (AD-030) | Design | Pending |
| DADOS-07 | P1: RLS acesso mínimo por sensibilidade + trilha de auditoria só-INSERT (AD-030) | Design | Pending |
| DADOS-08 | P1: Grupo 2 = acumulador anônimo com piso de respondentes, sobrevive ao DELETE (AD-046) | Design | Pending |
| DADOS-09 | P1: Opt-out real do flywheel + LIA antes de ligar (AD-026) | Design | Pending |
| DADOS-10 | P1: Canal do titular (exclusão/exportação/correção) + encarregado + prazo 15 dias | Design | Pending |
| DADOS-11 | P1: Declaração 18+ no checkout + termos p/ maiores (AD-047) | Design | Pending |
| DADOS-12 | P2: Auto-aplicação por lista fechada, reversível e auditada (AD-048) | Design | Pending |
| DADOS-13 | P3: Grupo 3 pseudonimizado (fast-follow) (AD-027) | - | Pending |
| DADOS-14 | P1: Operadores nomeados + transferência internacional declarada na política (AD-079) | Design | Pending |
| DADOS-15 | P1: DELETE alcança operador externo com confirmação de conclusão; no-op verificável enquanto a flag está desligada (AD-079) | Design | Pending |

**ID format:** `DADOS-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 requisitos, 0 mapeados a tasks (Specify), 0 sem cobertura de story.

---

## Success Criteria

- [ ] Um aluno completa o loop central inteiro sem marcar um único checkbox de consentimento.
- [ ] Toda tabela com dado de aluno tem grupo declarado; nenhuma coluna do grupo 2 permite voltar ao
      indivíduo.
- [ ] "Apague tudo meu" remove 100% do grupo 1 em ≤7 dias, some dos backups em ≤7 dias, e o contador
      anônimo da questão fica intacto.
- [ ] Todo serviço que trata dado pessoal por nossa conta está nomeado na política, com a região onde
      trata; nenhum operador é silencioso.
- [ ] O DELETE não fecha enquanto um operador externo não confirmar a remoção — e a checagem existe
      mesmo com a flag desligada, para não quebrar no dia em que ela ligar.
- [ ] Conta inativa além da janela é anonimizada e apagada por job, com aviso prévio e auditoria.
- [ ] Nenhum aluno consegue ler dado de outro (RLS); todo acesso administrativo a dado com nome tem linha
      de auditoria.
- [ ] Estatística com menos que o piso de respondentes nunca aparece nem influencia decisão.
- [ ] Nenhuma correção de gabarito/enunciado/explicação acontece sem humano; auto-aplicação só existe
      dentro da lista fechada, sempre reversível.
- [ ] LIA escrito e arquivado antes de o flywheel ser ligado.
