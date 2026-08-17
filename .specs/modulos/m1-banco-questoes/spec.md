# M1 — Banco de Questões & Pipeline de Ingestão · Especificação

> 🧭 **Spec temática — fonte de requisito, não unidade de implementação.** A ordem de construção é a
> de [`.specs/ROADMAP.md`](../../ROADMAP.md); estes requisitos são construídos pelas specs numeradas
> em `.specs/features/NN-*/`. Aqui mora o **texto** do requisito; lá mora **quando** ele entra.
> M1 → specs **04, 08, 09, 10, 11, 18, 37**.

> Fonte: `PRD.md` §M1, §4.1, §7.1, §9. Decisões: AD-003, AD-004, AD-005, AD-006, AD-008,
> AD-009 (+ AD-035/AD-036 p/ onde a fábrica roda). Contratos fixados nesta rodada:
> AD-039 (versionamento/enums de `questoes`), AD-040 (formato de dados da questão),
> AD-041 (escopo MVP: imagens sim, escaneadas não, inéditas P2).
>
> **Migração de modelos (2026-08-04):** a extração passa a usar `gpt-5.6-luna` com esforço `high`, por SDK
> nativo da OpenAI (**AD-073/AD-074**), com **fatiamento obrigatório do PDF** por causa do degrau de preço
> acima de 272K tokens. Embeddings **permanecem** em Cohere embed-v4 (AD-005): a Luna não expõe endpoint de
> embeddings. Rascunho de inéditas passa de GLM 5.2 para `gpt-5.6-luna`.

## Problem Statement

Não existe API pronta de questões de concurso. O acervo — o fosso do produto — precisa ser montado a
partir dos PDFs oficiais das bancas (Cesgranrio, FGV, Cebraspe), classificado por edital verticalizado,
deduplicado e publicado, **com proveniência** de cada questão. Sem esse banco não há o que estudar (M4),
o que explicar (M2), nem sobre o que projetar o Raio-X (M5). A fonte legal é a prova direto da banca
(ato oficial, Lei 9.610/1998 art. 8º IV; validar com advogado antes de escalar); concorrente nunca se
raspa.

## Goals

- [ ] Popular o banco a partir de PDFs oficiais sem digitação manual, com extração estruturada por IA.
- [ ] Toda questão publicada carrega proveniência (banca/ano/órgão/cargo/número) e gabarito conferido.
- [ ] Publicar só o que está correto: gabarito definitivo cruzado, anuladas marcadas, baixa confiança e
      inéditas passam por revisão humana.
- [ ] Cada questão tem `id` estável + versão; correção nunca reescreve o que já foi respondido (base p/
      o log imutável do M4).
- [ ] Schema com busca híbrida (embedding HNSW + fts PT) pronto p/ grounding (M2), dedup e Raio-X (M5).

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| Explicações em si (texto/áudio) | É M2/M3; o pipeline apenas **dispara** a geração via flag |
| Busca semântica ao vivo do aluno / tutor | É M2; M1 só provê o índice (embedding + fts) |
| OCR de provas escaneadas | Adiado (AD-041); escaneadas vão pra fila `precisa_ocr` no MVP |
| Inéditas geradas (`origem='gerada_ia`) na leva de lançamento | §4.1 lança só reais; inédita é P2/fast-follow |
| Peso/fórmula do Raio-X e frequência | É M5 (M1 só guarda a proveniência que alimenta a contagem) |
| Scraping de qualquer fonte / concorrente | Ilegal/proibido (invariante) |
| OCR de manuscrito | Fora de escopo |

---

## Assumptions & Open Questions

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| Questões com imagem no MVP | **Extrair imagem → Supabase Storage** e servir junto do enunciado | Discuss desta rodada | **y** → AD-041 |
| Provas escaneadas (sem texto nativo) no MVP | **Adiar**: `status='precisa_ocr'`, fila p/ fast-follow; ingerir só texto nativo | Discuss desta rodada; menos erro de extração no lançamento | **y** → AD-041 |
| Inéditas (`gerada_ia`) no lançamento | **Não** entram na leva de lançamento; ficam P2 | §4.1 lança só reais | y (PRD) |
| Piso de `confianca_ia` p/ rotear a revisão | Config trocável; início conservador (revisar tudo abaixo de confiança alta) | Risco #11: "detalhe de spec, calibra com uso"; não inventar número duro | n (calibra) |
| Taxa de amostra de QA p/ reais de alta confiança | Config; início com amostra alta, afrouxa com acurácia provada | AD-006 fixou a postura; só o número calibra | n (calibra) |
| Threshold de similaridade p/ candidata a duplicata | Config trocável (cosine sobre embedding) | Risco #11 | n (calibra) |
| Escala de `dificuldade` | `smallint` 1–5 estimada pela IA no MVP; calibra com taxa de erro real (grupo 2, M7) | Cold-start (risco #2); M4 só faz snapshot do valor | n (calibra) |
| Papel do ator de curadoria | Um papel único **operador de conteúdo** no MVP; fila interna de revisão, sem papéis separados | Time de 3; separar revisor/admin é refino de M8/M7 | n |
| Provedor de embedding | **Cohere embed-v4** (alt. Voyage) | AD-005 | y |
| Onde o pipeline pesado roda | **GitHub Actions + Batch API** (nunca serverless) | AD-035/AD-036 | y |

**Open questions:** none — tudo resolvido ou registrado como calibração acima.

---

## User Stories

### P1: Extração PDF → JSON estruturado (operador) ⭐ MVP

**User Story**: Como operador de conteúdo, quero submeter o PDF de uma prova oficial e ter a IA extrair
as questões em dados estruturados, para popular o banco sem digitar à mão.

**Why P1**: Sem extração automatizada não há acervo; digitar à mão não escala.

**Acceptance Criteria**:

1. WHEN um PDF de prova oficial **com texto nativo** é submetido ao pipeline, THEN o sistema SHALL
   extrair cada questão em JSON estruturado (`enunciado`, `alternativas`, `numero`, `materia/topico`
   sugeridos, `tipo_questao`, `confianca_ia`) usando **saída estruturada por schema** e **entrada de PDF
   nativa do provedor configurado** (default hoje `gpt-5.6-luna` pela Responses API — AD-073; o nome vive
   só na config, IA-02).
2. WHEN o PDF é enviado ao modelo, THEN o sistema SHALL fatiá-lo em **blocos de questões** e SHALL NOT
   enviar a prova inteira num único pedido; SHALL usar `detail: low` para questão sem gráfico/figura.
   Requisição acima de **272K tokens** é cobrada a 2× entrada e 1,5× saída, o que anularia o ganho de preço
   do modelo (AD-073/IA-17).
3. WHEN o PDF **não tem texto nativo** (escaneado), THEN o sistema SHALL registrar a prova como
   `status='precisa_ocr'` e SHALL NOT tentar extrair no MVP.
4. WHEN uma questão contém imagem (gráfico/tabela/figura), THEN o sistema SHALL extrair a imagem para o
   **Supabase Storage** e SHALL preencher `imagens` (jsonb com ref + posição), servindo-a junto do
   enunciado.
5. WHEN a extração roda, THEN SHALL executar em **script standalone / Batch API disparado por GitHub
   Actions**, e SHALL NOT rodar em função da Vercel (AD-036).
6. WHEN a extração termina, THEN cada questão nasce com `status='rascunho'` ou `'em_revisao'` (nunca
   `'publicada'` direto).

**Independent Test**: Submeter uma prova real nativa e ver N questões viram linhas estruturadas com
`confianca_ia` preenchida; submeter uma escaneada e ver a prova cair em `precisa_ocr`; submeter uma prova
longa e confirmar que ela foi enviada em blocos, nenhum pedido passando de 272K tokens.

---

### P1: Cruzamento de gabarito definitivo + anuladas (operador) ⭐ MVP

**User Story**: Como operador, quero cruzar automaticamente o gabarito oficial definitivo com as questões
extraídas, marcando as anuladas, para publicar só o que está correto.

**Why P1**: Publicar questão com gabarito errado quebra o invariante "não ensinar errado".

**Acceptance Criteria**:

1. WHEN o gabarito **definitivo** é processado, THEN o sistema SHALL preencher `resposta_correta` por
   `numero` de questão e SHALL registrar `gabarito_versao`.
2. WHEN o gabarito indica anulação, THEN o sistema SHALL marcar `anulada = true`; questão anulada SHALL
   NOT contar como conteúdo de estudo válido (não vira treino), mas SHALL ser mantida (histórico).
3. WHEN há retificação de gabarito depois de publicada, THEN a correção SHALL gerar **nova
   `questao_versao`** (não reescreve a versão anterior); tentativas (M4) já feitas seguem apontando p/ a
   versão que responderam.

**Independent Test**: Rodar o gabarito de uma prova e ver `resposta_correta`+`gabarito_versao`
preenchidos e as anuladas marcadas.

---

### P1: Proveniência visível ao aluno ⭐ MVP

**User Story**: Como aluno, quero ver a fonte de cada questão (banca/ano/órgão/cargo), para confiar que é
prova real.

**Why P1**: A proveniência é o fosso e a base da confiança + do Raio-X.

**Acceptance Criteria**:

1. WHEN a questão é `origem='real'`, THEN o sistema SHALL persistir `fonte_citacao`
   (banca/ano/órgão/cargo/número) e SHALL NOT publicar sem proveniência.
2. WHEN o aluno vê uma questão real, THEN a fonte SHALL estar disponível pra exibição.

**Independent Test**: Tentar publicar uma questão real sem `fonte_citacao` e ver o pipeline bloquear.

---

### P1: Schema + busca híbrida (embedding + fts) ⭐ MVP

**User Story**: Como plataforma, quero cada questão com embedding (HNSW) e fts (tsvector PT), para
grounding, dedup e busca híbrida.

**Why P1**: M2 (grounding), M1 (dedup) e M5 (Raio-X) dependem do índice.

**Acceptance Criteria**:

1. WHEN uma questão é criada/atualizada, THEN o sistema SHALL gerar `embedding` (Cohere embed-v4, índice
   HNSW) e `fts` (tsvector PT).
2. WHEN a questão muda de versão, THEN o embedding SHALL ser regerado p/ a nova versão.
3. O schema SHALL guardar os enums e o versionamento do contrato (AD-039/AD-040): `tipo_questao ∈
   {multipla_escolha, certo_errado}`, `origem ∈ {real, gerada_ia}`, `status ∈ {rascunho, em_revisao,
   publicada, rejeitada, precisa_ocr}`, `id` + `questao_versao`, `alternativas` jsonb (ou null p/ C-E),
   `imagens` jsonb, `anulada`, `gabarito_versao`, `dificuldade`, `confianca_ia`.

**Independent Test**: Inserir 2 questões parecidas e rodar uma busca por similaridade que as aproxime.

---

### P1: QA misto por fonte + revisão de baixa confiança ⭐ MVP

**User Story**: Como operador, quero que a IA de baixa confiança e as inéditas passem por revisão humana
antes de publicar, para confiar sem revisar 100% do acervo real.

**Why P1**: AD-006; controla qualidade sem travar a escala.

**Acceptance Criteria**:

1. WHEN `confianca_ia` da extração está abaixo do piso (config), THEN o sistema SHALL rotear a questão
   para **revisão humana** antes de publicar.
2. WHEN a questão é `origem='gerada_ia'`, THEN o sistema SHALL exigir **100% de revisão humana** antes de
   `status='publicada'` (afrouxa só com acurácia comprovada).
3. WHEN uma questão real de alta confiança é publicada, THEN o sistema SHALL registrar a decisão (auditoria
   da revisão, `questao_revisoes`), e uma **amostra** (config) SHALL cair em revisão mesmo assim.
4. WHEN um aluno reporta erro numa questão (M2/M7), THEN o report SHALL entrar em fila; SHALL NOT alterar
   a questão sozinho (decisão humana — invariante).

**Independent Test**: Publicar uma inédita sem revisão → bloqueado; baixar `confianca_ia` de uma real
abaixo do piso → cai em revisão.

---

### P2: Dedup por embedding (operador)

**User Story**: Como operador, quero deduplicar questões repetidas entre anos por similaridade, para não
mostrar a mesma questão como se fossem duas.

**Why P2**: Melhora qualidade do acervo; não bloqueia o lançamento com leva inicial pequena.

**Acceptance Criteria**:

1. WHEN duas questões têm similaridade de embedding **acima do limite** (config), THEN o sistema SHALL
   sinalizá-las como **candidatas a duplicata** para decisão humana; SHALL NOT mesclar automaticamente.
2. WHEN o operador confirma a duplicata, THEN uma SHALL ser marcada como canônica e a outra vinculada
   (mantém proveniência das duas).

**Independent Test**: Inserir a mesma questão de 2 anos e ver o par sinalizado como candidato.

---

### P2: Geração de inéditas no padrão da banca (operador)

**User Story**: Como operador, quero gerar questões inéditas no padrão da banca, etiquetadas, para treino
direcionado por causa de erro.

**Why P2**: Volume + treino direcionado; entra depois do acervo real (§4.1).

**Acceptance Criteria**:

1. WHEN uma inédita é gerada, THEN SHALL nascer `origem='gerada_ia'`, etiquetada (matéria/tópico/banca),
   `status='em_revisao'`.
2. WHEN uma inédita é publicada, THEN SHALL ter passado por 100% de revisão humana (P1 acima).
3. Inédita SHALL NOT entrar na **taxa de frequência** do Raio-X (só `origem='real'` conta — invariante).

**Independent Test**: Gerar uma inédita e confirmar que não pode publicar sem revisão e não infla o
Raio-X.

---

### P3: Tela de curadoria da taxonomia (operador)

**User Story**: Como operador, quero uma tela de curadoria da taxonomia (matéria→tópico), para manter o
edital verticalizado e aprovar candidatos a tópico novo.

**Why P3**: Qualidade da classificação melhora com uso; não bloqueia o loop central.

**Acceptance Criteria**:

1. WHEN a IA sugere um tópico que não existe na taxonomia, THEN o sistema SHALL marcá-lo como **candidato
   a tópico novo** e SHALL NOT criar tópico canônico sozinho.
2. WHEN o operador aprova/edita a taxonomia, THEN a mudança SHALL refletir na classificação futura sem
   deslocar o histórico (M4 usa snapshot congelado da etiqueta).

**Independent Test**: A IA sugere tópico inexistente → aparece como candidato na tela; aprovar cria o
tópico.

---

## Edge Cases

- WHEN o PDF tem numeração fora de ordem / questões em duas colunas, THEN a extração SHALL preservar o
  `numero` oficial da banca (não a ordem de leitura).
- WHEN o gabarito definitivo chega **antes** da extração terminar, THEN o cruzamento SHALL aguardar as
  questões existirem (idempotente, retomável — AD-036).
- WHEN a mesma prova é submetida duas vezes, THEN o pipeline SHALL deduplicar por `prova_id` e SHALL NOT
  duplicar questões.
- WHEN a extração falha no meio de um Batch, THEN SHALL retomar por chave de dedup sem reprocessar o já
  extraído.
- WHEN uma questão real chega sem `fonte_citacao`, THEN SHALL NOT poder ir a `publicada`.
- WHEN uma imagem não pôde ser extraída, THEN a questão SHALL cair em revisão (não publicar meia-imagem).
- WHEN se troca o provedor de embedding, THEN SHALL ser possível re-embeddar em lote (barato) sem tocar
  no fato da questão.

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| BANCO-01 | P1: Proveniência visível / fontes legais (AD-003) | Design | Pending |
| BANCO-02 | P1: Catálogo-alvo de provas (AD-009) | Design | Pending |
| BANCO-03 | P1: Extração PDF→JSON (AD-004) | Design | Pending |
| BANCO-04 | P1: Cruzamento gabarito + anuladas (AD-004) | Design | Pending |
| BANCO-05 | P1/P3: Taxonomia + classificação (AD-004) | Design | Pending |
| BANCO-06 | P2: Dedup por embedding (AD-004) | Design | Pending |
| BANCO-07 | P1: QA misto por fonte (AD-006) | Design | Pending |
| BANCO-08 | P2: Inéditas geradas (AD-008) | Design | Pending |
| BANCO-09 | P1: Schema + embedding + fts busca híbrida (AD-005) | Design | Pending |
| BANCO-10 | P3: Tela de curadoria da taxonomia (AD-004) | Design | Pending |
| BANCO-11 | P1: Imagens extraídas → Storage (AD-041) | Design | Pending |
| BANCO-12 | P1: Fila `precisa_ocr` p/ escaneadas (AD-041) | Design | Pending |
| BANCO-13 | P1: Versionamento de questão (`questao_versao`, AD-039) | Design | Pending |

**ID format:** `BANCO-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 13 requisitos, 0 mapeados a tasks (Specify), 0 sem cobertura de story.

---

## Success Criteria

- [ ] Uma leva inicial de provas reais nativas das 3 bancas é extraída, cruzada com gabarito e publicada.
- [ ] Nenhuma questão real publicada sem `fonte_citacao`; nenhuma inédita publicada sem 100% de revisão.
- [ ] Anuladas marcadas e fora do treino; escaneadas isoladas em `precisa_ocr`.
- [ ] Imagens de questões servidas do Storage junto do enunciado.
- [ ] Busca híbrida (embedding + fts) retorna questões relevantes; par duplicado é sinalizado.
- [ ] Correção de questão publicada gera nova versão sem reescrever versões anteriores.
- [ ] Todo o pipeline pesado roda em GitHub Actions/Batch, zero em função da Vercel.
