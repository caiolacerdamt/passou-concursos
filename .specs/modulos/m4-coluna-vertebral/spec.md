# M4 — Coluna Vertebral do Aluno · Especificação

> 🧭 **Spec temática — fonte de requisito, não unidade de implementação.** A ordem de construção é a
> de [`.specs/ROADMAP.md`](../../ROADMAP.md); estes requisitos são construídos pelas specs numeradas
> em `.specs/features/NN-*/`. Aqui mora o **texto** do requisito; lá mora **quando** ele entra.
> M4 → specs **05, 06, 07, 22, 24, 25, 38**. O `design.md` e o `tasks.md` desta pasta são da rodada 1
> e continuam válidos: as specs 05 e 06 os aproveitam (T11–T21). **A T10 foi absorvida pela spec 04.**

> Fonte: `PRD.md` §M4, §4.1, §7.2, §9; `docs/historico/DECISOES-TECNICAS.md` D15–D18. Decisões: AD-015,
> AD-016, AD-017, AD-018. Herda contratos: AD-039/AD-040 (questão: id+versão, enums,
> dificuldade), AD-035/AD-036 (pg_cron/partição, fábrica). Contratos fixados nesta rodada:
> AD-042 (log `tentativas`), AD-043 (taxonomia de causa), AD-044 (projeções + plano).

## Problem Statement

O histórico de respostas é o coração do produto: alimenta diagnóstico, plano, caderno de erros, Raio-X e
flywheel. Ele precisa ser guardado como **fato cru imutável** (`tentativas`, só INSERT) com **snapshot
congelado** da etiqueta no momento da resposta, e todo "estado atual do aluno" precisa ser **calculado
por cima do log** (projeção recalculável), nunca guardado como número solto. A causa de cada erro vem do
**auto-relato do aluno**. O diagnóstico inicial é curto e pulável (só semente). O plano diário roda 1×/dia
com a lógica em regra/SQL (a IA só escreve a frase). Se essa fundação for mal-feita, o resto do produto
rui (aposta fundacional, §4.1 item 6).

## Goals

- [ ] `tentativas` grava cada resposta como linha permanente (só-INSERT) com snapshot congelado, de onde
      qualquer projeção pode ser reconstruída do zero.
- [ ] Ao errar no treino, o aluno declara a causa (6 causas + "não sei"), e isso muda o plano de verdade.
- [ ] Diagnóstico curto, pulável, semeia o retrato; o log recalibra pra sempre.
- [ ] Plano diário por regra/SQL diz o que estudar hoje (Revisar/Avançar/Treinar) cabendo no tempo
      declarado, emitindo dois níveis (piso + meta cheia).
- [ ] Toda projeção (domínio, caderno, hábito) é recalculável por job (pg_cron), placar com pequeno
      atraso — exceto `anel do dia` e `sequência`, calculados na abertura da tela (AD-071).

## Out of Scope

| Feature | Motivo |
| ------- | ------ |
| Peso/fórmula e frequência do Raio-X | É M5 (M4 só consome a "nota de quanto cai" como fator) |
| Gamificação, sequência, anel, no-prazo | É M6 (M4 emite piso/meta cheia; M6 transforma em jogo) |
| Knowledge tracing avançado (grupo 3 / sequência pseudonimizada) | É M7 fast-follow |
| Particionamento e pg_cron em si | É M9 (M4 usa; INFRA-03/INFRA-04) |
| RLS / DELETE-por-esquecimento (mecânica) | É M7 (M4 só garante que só-INSERT não impede DELETE por `user_id`) |
| Extração/edição de questões | É M1 (M4 só lê a questão publicada por id+versão) |
| Simulado no formato exato da banca | Formato herda de M5 (banca indefinida); MVP entrega simulado genérico (P3) |

---

## Assumptions & Open Questions

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| Parâmetros FSRS (cold-start) | **FSRS com parâmetros padrão da biblioteca desde o dia 1**; régua fixa **1/3/7/14/30** fica como **plano B** selecionável por config; a *otimização* por aluno (`computeParameters`) é que é fast-follow | **AD-072** — documentação do `ts-fsrs` confirmada em 2026-07-23: `default_w` (21 pesos) vem treinado e funciona sem histórico; só `computeParameters` exige histórico. Revisa a leitura do AD-018 | **y** |
| Conversão desempenho do bloco → nota FSRS (1–4) | Tabela de faixas em configuração (ex.: `<50%` errei · `50–70%` difícil · `70–90%` bom · `>90%` fácil) | O FSRS foi desenhado para revisão item a item com nota do próprio aluno; aqui a unidade é o tópico. **É adaptação, não uso padrão** — validar no Design | n (calibra / risco registrado) |
| Tamanho de cada bloco (Revisar/Avançar/Treinar) | Derivado do **tempo/dia declarado**; nº de questões por bloco é config | AD-018; risco #11 | n (calibra) |
| Tamanho do diagnóstico | **~20 questões reais** (dial ajustável), ~repartidas por área (ex.: Mat. Financeira / Conhec. Bancários) | D17 | n (calibra) |
| Passo do adaptativo-simplificado | acertou → sobe dificuldade estimada; errou → desce (regra, não IRT) | D17 (cold-start) | y (regra) / n (números) |
| Escala de `dificuldade` no snapshot | `smallint` 1–5 (vem do M1, AD-040); calibra pela taxa de erro real (grupo 2, M7) | AD-040 | n (calibra) |
| Unidade da revisão espaçada | **por assunto/tópico** (FSRS "por aluno e por assunto"), + erros específicos do caderno no bloco Revisar | D18 (linha 550: "por assunto") | y |
| Chute correto no domínio | `marcou_chute=true` que acerta **não** conta como domínio seguro (é descontado) | Anti-coasting (invariante #14/M6); acerto por sorte não é maestria | n |
| Placar (projeção) | Atualizado por **job pg_cron**, não ao vivo (pequeno atraso aceito). **Exceção:** `anel do dia` e `sequência` são calculados na abertura da tela (**AD-071**/GAM-14) — consulta de 1 aluno × 1 dia | Invariante #7 (pré-computa) proíbe IA ao vivo e conta pesada ao vivo, não uma leitura pequena do próprio aluno | y |
| Dedup de resposta dupla | INSERT dedup por `(sessao_id, questao_id, ordem_na_sessao)` — duplo-clique não cria 2 tentativas | Idempotência | n |

**Open questions:** none — arquitetura fechada em D15–D18; itens acima são calibração ou detalhe de
Design, registrados.

---

## User Stories

### P1: Log imutável `tentativas` com snapshot congelado ⭐ MVP

**User Story**: Como plataforma, quero gravar cada resposta como uma linha permanente com snapshot da
etiqueta, para reconstruir qualquer projeção do zero e sobreviver a reclassificação.

**Why P1**: Aposta fundacional (AD-015); tudo depende dela.

**Acceptance Criteria**:

1. A tabela `tentativas` SHALL aceitar **apenas INSERT**; SHALL NOT sofrer UPDATE nem DELETE-por-edição.
   (Correção = linha nova ou tabela vizinha; DELETE-por-esquecimento por `user_id` é permitido — LGPD, M7.)
2. WHEN uma resposta é registrada, THEN a linha SHALL conter o **snapshot congelado** — `materia`,
   `topico` (id **e** rótulo congelado), `banca`, `tipo_questao`, `dificuldade`, `origem` — mais
   `questao_id`/`questao_versao`, `sessao_id`, `contexto`, `resposta_dada`/`correta`, `tempo_ms`,
   `marcou_chute`, `respondida_em`.
3. WHEN a questão é reclassificada depois (M1 muda tópico), THEN o snapshot da tentativa antiga SHALL
   permanecer inalterado (histórico não se desloca).
4. WHEN `contexto` é gravado, THEN SHALL pertencer a `{diagnostico, plano, treino, simulado, revisao}`.
5. `tentativas` SHALL ser particionada por mês (INFRA-04) e SHALL ser recalculável do zero.

**Independent Test**: Inserir uma tentativa, reclassificar a questão no M1 e confirmar que o snapshot da
tentativa não mudou; tentar UPDATE e ver bloqueio.

---

### P1: Causa do erro por auto-relato ⭐ MVP

**User Story**: Como aluno, quero, ao errar no treino, dizer por que errei (6 causas + "não sei"), para o
plano me dar o remédio certo — e ver que isso mexeu no plano de verdade.

**Why P1**: Só o aluno sabe o porquê; cada causa dispara um remédio distinto (D16).

**Acceptance Criteria**:

1. WHEN o aluno erra no modo **treino**, THEN o sistema SHALL exigir a **causa do erro** antes de avançar,
   gravando `causa_erro` + `causa_origem='aluno'` **no próprio INSERT** da tentativa (sem alterar o fato
   depois).
2. A lista de causas visível SHALL ser as **6** + "não sei dizer": `nao_sabia_conteudo`, `errei_a_conta`,
   `entendi_errado_enunciado`, `confundi_conceitos`, `fiquei_na_duvida`, `chutei`, `nao_sei_dizer`.
3. WHEN o `contexto` é **simulado**, THEN o sistema SHALL coletar a causa na **revisão pós-prova** (não
   interrompe a prova), gravando-a em **linha/tabela vizinha** ligada à tentativa — SHALL NOT dar UPDATE
   na tentativa original; e SHALL disponibilizar a causa extra `faltou_tempo` só neste contexto.
4. WHEN o aluno escolhe "não sei dizer", THEN SHALL ser aceito como resposta válida (não é um pulo,
   nunca sentença).
5. WHEN uma causa é registrada, THEN ela SHALL alimentar o remédio correspondente no plano (P1 plano):
   conteúdo→reestudar teoria, conta→treino de cálculo, enunciado→leitura de comando, confusão→revisar a
   confusão, dúvida→reforço/confiança, chute→lacuna marcada como chute.

**Independent Test**: Errar no treino → é obrigado a marcar causa antes de avançar; marcar "conta" e ver
o plano do dia seguinte puxar treino de cálculo, não teoria.

---

### P1: Diagnóstico curto e pulável ⭐ MVP

**User Story**: Como aluno, quero um diagnóstico curto e pulável ao entrar, para começar com um plano sem
ser obrigado a fazer prova de 3 horas.

**Why P1**: Medir sem cansar; não forçar prova na entrada (D17).

**Acceptance Criteria**:

1. WHEN o aluno abre o diagnóstico, THEN o sistema SHALL permitir **pular** declarando o nível
   (iniciante/intermediário/avançado = semente grosseira).
2. WHEN ele faz o diagnóstico, THEN o sistema SHALL aplicar **~20 questões reais adaptativas**
   (acertou→sobe a dificuldade estimada; errou→desce), gravando cada uma como `tentativa` com
   `contexto='diagnostico'`, **sem** perguntar causa.
3. WHEN o diagnóstico termina (ou é pulado), THEN o sistema SHALL montar o retrato inicial (projeção) e
   SHALL fazer **uma** chamada de IA por aluno que **lê** retrato+meta+Raio-X e **escreve** o plano
   inicial — não corrige, não mede. Essa chamada SHALL ser uma **tarefa própria do gateway** ("plano inicial
   pós-diagnóstico", IA-02), distinta da "frase do plano diário": default hoje `gpt-5.6-luna` com esforço
   `high`, síncrona (sem Batch), com cache (**AD-073**).
4. WHEN a chamada de IA do plano inicial falha, THEN o sistema SHALL entregar o plano por **regra/SQL**
   mesmo assim (sem a frase escrita pela IA), pois o núcleo não depende de IA ao vivo (invariante #7).

**Independent Test**: Pular o diagnóstico declarando "iniciante" e ainda assim receber o plano do 1º dia;
fazer o diagnóstico e ver ~20 tentativas com `contexto='diagnostico'` e nenhuma pergunta de causa.

---

### P1: Plano diário por regra/SQL (Revisar/Avançar/Treinar) ⭐ MVP

**User Story**: Como aluno, quero um plano diário que me diga o que estudar hoje, cabendo no tempo que
declarei.

**Why P1**: Orquestra as duas técnicas com mais evidência (questões + revisão espaçada, D18).

**Acceptance Criteria**:

1. WHEN o plano diário roda (job pg_cron 1×/dia), THEN a escolha do que estudar SHALL ser por
   **regra/SQL**; a IA SHALL apenas escrever a **frase de abertura** (invariante #6).
2. A nota por tópico SHALL = **quanto cai** (Raio-X, M5) × **quão fraco** (log/retrato) × **quão
   "devendo revisão"** (agenda de revisão espaçada); o plano SHALL escolher os de maior nota que **cabem
   no tempo/dia declarado**.
3. O plano SHALL organizar a tarefa em blocos: **Revisar** (tópicos vencendo + erros do caderno,
   intercalando assuntos), **Avançar** (tópico novo/fraco em bloco concentrado), **Treinar** (questões de
   tipos/assuntos misturados); **Simulado** é 1×/semana (P3).
4. O plano SHALL emitir **dois níveis**: `piso` (mantém a sequência — as revisões devidas) e `meta_cheia`
   (enche o anel do dia) — necessário para M6.
5. WHEN a revisão manda "revisar em vez de avançar", THEN o plano SHALL expor o **porquê** ("revisar hoje
   = não perder o que já conquistou").

**Independent Test**: Rodar o job com um retrato semeado e ver blocos Revisar/Avançar/Treinar cabendo no
tempo declarado, com piso e meta cheia distintos.

---

### P1: Projeções recalculáveis por cima do log ⭐ MVP

**User Story**: Como plataforma, quero que domínio/caderno/hábito sejam calculados por job a partir do
log, para nunca guardar "estado" como número solto e poder reprocessar tudo.

**Why P1**: Consequência direta de AD-015; sem isso o log cru não mostra nada.

**Acceptance Criteria**:

1. O projetor de estado (`dominio_topico`, `caderno_erros`, agenda de revisão; hábito é M6, Raio-X é M5)
   SHALL ser **recalculável do zero** a partir do log.
2. O número mostrado ao aluno SHALL ser atualizado por **job** (placar com pequeno atraso), SHALL NOT ao
   vivo a cada clique. **Exceção (AD-071):** `anel do dia` e `sequência` (M6/GAM-14) SHALL ser calculados
   na abertura da tela — são consulta de 1 aluno × 1 dia, não projeção pesada sobre todo o histórico.
3. WHEN a projeção é recalculada, THEN um `marcou_chute=true` que acertou SHALL ser descontado do domínio
   seguro (não conta como maestria); questão `anulada` SHALL NOT contar.
4. WHEN o job de projeção falha, THEN o placar SHALL ficar defasado (não corrompido) e a falha SHALL ser
   visível/alertada (INFRA-09); rerodar SHALL reconstruir o mesmo resultado (idempotente).

**Independent Test**: Apagar as projeções e reconstruí-las só do log, obtendo os mesmos números.

---

### P2: Caderno de erros (projeção)

**User Story**: Como aluno, quero um caderno de erros que junte o que errei e por quê, para revisar
direcionado.

**Why P2**: Melhora o direcionamento; não bloqueia o loop central mínimo.

**Acceptance Criteria**:

1. O caderno SHALL ser uma **projeção** sobre `correta=false` + `causa_erro` (sem decisão própria), por
   tópico e por causa.
2. WHEN o aluno abre o caderno, THEN SHALL poder filtrar por causa e por tópico, e o bloco **Revisar** do
   plano SHALL puxar esses erros.

**Independent Test**: Errar 3 questões com causas diferentes e ver o caderno agrupar por causa/tópico.

---

### P1: Revisão espaçada com FSRS de parâmetros padrão ⭐ MVP

**User Story**: Como aluno, quero que o sistema calcule quando eu preciso revisar cada assunto pelo
algoritmo mais eficiente disponível desde o primeiro dia, para revisar menos e lembrar igual.

**Why P1**: O FSRS **não precisa de histórico para funcionar** — a biblioteca (`ts-fsrs`) já vem com
parâmetros padrão treinados (`default_w`, 21 pesos). O que precisa de histórico é a *otimização* desses
parâmetros (`computeParameters`), que é uma função separada e opcional. Lançar com régua fixa e migrar
depois obrigaria a mexer nos intervalos de todos os alunos de uma vez, sem ganho nenhum (**AD-072**,
corrige a leitura de cold-start do AD-018).

**Acceptance Criteria**:

1. A agenda de revisão SHALL usar **FSRS com os parâmetros padrão da biblioteca** desde o dia 1, por
   **aluno e por assunto** (a unidade continua sendo tópico, não item — AD-018).
2. Como o FSRS espera uma **nota de 1 a 4** por revisão e aqui a unidade é o assunto, o sistema SHALL
   derivar a nota do **desempenho do bloco Revisar** naquele tópico, por uma tabela de faixas em
   **configuração** (ex.: `<50%` → errei · `50–70%` → difícil · `70–90%` → bom · `>90%` → fácil).
3. O contrato exposto ao motor de prioridade SHALL continuar sendo **"este tópico está devendo revisão ou
   não"** — trocar o algoritmo por baixo SHALL NOT exigir mudança no plano diário (ALUNO-07).
4. A **régua fixa 1/3/7/14/30 SHALL permanecer implementada como plano B**, selecionável por
   configuração; WHEN a conversão de nota (AC2) se mostrar ruim na prática, THEN o sistema SHALL poder
   voltar à régua sem migração de dados.
5. WHEN houver histórico de revisões suficiente (limiar em config), THEN o sistema SHALL **otimizar** os
   parâmetros por aluno (`computeParameters`) — isso é o fast-follow, não o FSRS em si.

**Independent Test**: Semear um aluno novo, sem nenhum histórico, e confirmar que a agenda já devolve
intervalos FSRS (não a régua fixa); trocar a chave de configuração e ver a régua fixa assumir sem perder
nenhum agendamento.

---

### P3: Simulado semanal

**User Story**: Como aluno, quero um simulado 1×/semana no formato da prova, para treinar sob pressão.

**Why P3**: Firma pra prova; formato exato herda de M5 (banca indefinida).

**Acceptance Criteria**:

1. WHEN o simulado roda, THEN cada resposta SHALL virar `tentativa` com `contexto='simulado'`, sem
   interromper a prova para pedir causa.
2. WHEN a prova termina, THEN a causa dos erros SHALL ser coletada na **revisão pós-prova** (P1 causa,
   AC3), incluindo `faltou_tempo`.

**Independent Test**: Fazer um simulado e, no fim, marcar causas (inclusive "faltou tempo") na revisão.

---

## Edge Cases

- WHEN o aluno dá duplo-clique/reenvia a mesma resposta, THEN o sistema SHALL deduplicar por
  `(sessao_id, questao_id, ordem_na_sessao)` e SHALL NOT gravar duas tentativas.
- WHEN um tópico não tem questão publicada no banco (acervo frio), THEN o plano SHALL NOT alocar treino
  nesse tópico e SHALL escolher o próximo de maior nota.
- WHEN o aluno responde fora de ordem/sai no meio da sessão, THEN cada resposta já registrada SHALL
  permanecer (log cru); nada é desfeito.
- WHEN `resposta_dada` não é uma alternativa válida (A–E ou C/E conforme `tipo_questao`), THEN o INSERT
  SHALL ser rejeitado (validação).
- WHEN chega um DELETE-por-esquecimento (M7) por `user_id`, THEN o só-INSERT SHALL NOT impedir o DELETE
  das linhas daquele `user_id`.
- WHEN o retrato ainda está frio (poucas respostas), THEN o plano SHALL funcionar mesmo assim (semente do
  diagnóstico/nível declarado) e recalibrar com o uso.
- WHEN a mesma questão volta num bloco Treinar, THEN o sistema SHALL evitar repetir a mesma questão
  recente (config), preferindo questões não vistas do tópico.

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| ALUNO-01 | P1: `tentativas` só-INSERT + snapshot congelado (AD-015) | Execute | In Tasks (T11, T12) |
| ALUNO-02 | P1: Projeções recalculáveis por cima do log (AD-015) | Execute | In Tasks (T17, T21) |
| ALUNO-03 | P1: Causa do erro auto-relato obrigatório + "não sei" (AD-016) | Execute | In Tasks (T11, T15) |
| ALUNO-04 | P1: Taxonomia enxuta 6 causas + faltou-tempo no simulado (AD-016) | Execute | In Tasks (T10, T11, T14) |
| ALUNO-05 | P1: Diagnóstico curto adaptativo pulável (AD-017) | Execute | In Tasks (T19) — parcial, ver lacunas em tasks.md |
| ALUNO-06 | P1/P2: Calibração da dificuldade real pelo uso (AD-017) | Execute | In Tasks (T17) — parcial, a calibração em si é M7 |
| ALUNO-07 | P1: Motor de prioridade (quanto cai × fraqueza × devendo revisão) (AD-018) | Execute | In Tasks (T20) |
| ALUNO-08 | P1: Blocos Revisar/Avançar/Treinar/Simulado + intercalação (AD-018) | Execute | In Tasks (T20) |
| ALUNO-09 | P1: Revisão espaçada em **FSRS com parâmetros padrão** desde o dia 1; régua fixa = plano B; otimização por aluno = fast-follow (AD-018/AD-072) | Execute | In Tasks (T16, T18) |
| ALUNO-10 | P2: Caderno de erros como projeção (AD-015/AD-016) | Execute | In Tasks (T16, T17) |
| ALUNO-11 | P1: Plano emite dois níveis piso/meta cheia (AD-018, p/ M6) | Execute | In Tasks (T19, T20) |
| ALUNO-12 | P1: Uma chamada de IA escreve o plano inicial — **tarefa própria do gateway**, default `gpt-5.6-luna`/`high` (AD-017/AD-018/**AD-073**) | Execute | In Tasks (T22) |

**ID format:** `ALUNO-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 12 requisitos, **12 mapeados a tasks** (`.specs/modulos/m4-coluna-vertebral/tasks.md`),
0 sem cobertura de story. **2 AC ficaram sem componente no design** e estão listados como lacunas no
tasks.md: ALUNO-05 AC2 (diagnóstico adaptativo) e ALUNO-05 AC3 (chamada de IA do plano inicial).

---

## Success Criteria

- [ ] `tentativas` reconstrói qualquer projeção do zero; UPDATE/DELETE-por-edição são impossíveis por
      desenho; DELETE por `user_id` é possível.
- [ ] Errar no treino sempre pede causa (com "não sei" válido); a causa muda o remédio no plano seguinte.
- [ ] Diagnóstico é pulável e ainda gera plano do 1º dia; a única chamada de IA falhando não derruba o
      plano.
- [ ] Plano diário sai por regra/SQL, cabe no tempo declarado, com piso e meta cheia.
- [ ] Placar (domínio/caderno) recalculado por pg_cron reproduz o mesmo número a partir do log.
- [ ] Simulado coleta causa na revisão pós-prova sem interromper a prova; `faltou_tempo` só aparece lá.
