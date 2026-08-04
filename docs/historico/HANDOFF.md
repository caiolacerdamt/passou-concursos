# HANDOFF — SaaS de Concursos (bancário)

> Arquivo de continuidade. Se a sessão do Claude estourar, cole/aponte este arquivo na próxima
> sessão para retomar de onde paramos. Atualizado ao longo da conversa.
> **Última atualização:** 2026-07-04

---

## 0. Como retomar
Estamos numa sessão de **/grill-me** (entrevista de decisões) para produir um documento de
**decisões técnicas** → depois um **PRD** → depois specs via **/tlc-spec-driven**.
Modo de conversa: falar como para um leigo, sem analogias, honesto/sócio-direto.
O documento vivo de decisões é `DECISOES-TECNICAS.md`.

## 1. O que é o projeto (resumo de 1 parágrafo)
SaaS self-service de preparação para concursos, **nicho: carreiras bancárias**, primeiro alvo
**Banco do Brasil**. Diferencial = **método + IA + direção** (ensinar a "fazer a prova"), não
volume de conteúdo. 3 sócios que programam. Capital de validação ~R$15 mil. Filosofia
"progresso e depois ordem": vender cedo, mas reter (qualidade importa).

## 1.5 Mental model do app (uma aplicação, multi-concurso) — esclarecido 2026-07-03
- **É UM app, não "antes/depois do edital".** O mesmo sistema lê um **"perfil de concurso"** (órgão,
  banca, programa, data_prova, formato). Antes do edital os campos são palpite; depois, confirmados. As
  telas recalculam sozinhas quando os campos mudam — possível porque tudo é **projeção por cima de dados
  (D15) + plano regra/SQL (D18)**, não código chumbado.
- **BB é o primeiro perfil.** Core (banco multi-banca, taxonomia de carreira, coluna vertebral, motor,
  IA, áudio) é **agnóstico** → Caixa/BNB/BASA = adicionar perfil + ingerir provas. Plataforma = **motor
  multi-concurso**; no limite, sair do bancário = trocar o "pacote de conteúdo", não reescrever o app.
- **Camadas:** (1) Acervo/fosso (banco de questões + taxonomia + base + explicações/áudio) → (2) Aluno
  (log `tentativas` + projeções) → (3) Motor (diagnóstico → Raio-X × fraqueza × revisão → plano) → (4)
  Superfícies (estudo, questões/simulados, tutor, progresso, caderno, gamificação). O "perfil de concurso"
  fica por cima, fininho, e re-mira a máquina.
- **Over-engineering? Desenho coerente; risco = sequência.** Antídoto = D1 (modular/incremental): lançar o
  **loop central primeiro** (banco + estudar por questões + explicação + plano simples); tutor ao vivo,
  áudio, FSRS real, pivot automático do edital e Raio-X multi-sinal entram em cima (fast-follow). Única
  aposta fundacional que TEM que ser bem-feita = **log imutável + projeções (D15)**.

## 2. Decisões já FECHADAS (não reabrir sem motivo forte)
- Nicho: carreiras **bancárias**; 1º foco **BB**.
- Reaproveitável = **conteúdo da carreira** (Port., Mat., Mat. Financeira, Conhec. Bancários,
  Informática, Atualidades do mercado, Atendimento), **NÃO a banca**.
- Gancho: dominar **Matemática Financeira** e **Conhecimentos Bancários**.
- Funcionalidades da VISÃO (todas): diagnóstico adaptativo, plano IA que mira passar,
  questões+simulados, banco de questões por banca + geração de questões inéditas, caderno de
  erros com taxonomia de causa, gamificação de hábito (sem prêmio $), edital verticalizado +
  Raio-X da banca, currículo de "fazer a prova", IA com grounding+citação obrigatórios,
  explicação em áudio das questões, flywheel de dados.
- Rejeitado: prêmio em dinheiro; nicho segurança/militar; virar estúdio de conteúdo dia 1;
  ser wrapper genérico de ChatGPT.
- Restrições de execução: ~R$15k; sem prazo fixo (quanto antes); custo real = tempo dos sócios;
  produto self-service.

## 3. Tensão principal — RESOLVIDA (D1)
Decisão do sócio: construir a **plataforma completa**, mas **modular/incremental** (cada feature
usável/vendável quando pronta). Orçamento e tempo **removidos** como limitadores desta discussão —
otimizar pela melhor plataforma. (O consultor sugeria enxuto; o sócio optou por full-modular.)

## 4. Pesquisa de mercado (verificada em 2026-07-01)
- BB: edital ainda sem data. **Banca NÃO decidida** — disputa Cesgranrio x Cebraspe x FGV.
  Cargo Escriturário (agente comercial + agente de tecnologia), ~7 mil vagas esperadas,
  salário inicial ~R$4,2 mil. → Não dá para fixar Raio-X banca-específico ainda.
- Durabilidade OK: Caixa (válido até ago/2026), BNB (novo edital em andamento), BASA (até 2027),
  Banrisul TI (até 2027).
- IA é requisito de entrada: Gran MAIA, Bizzu (R$10/mês), Qconcursos Avalea (gera questão por
  banca), Concursa AI, Concurso AI.

## 5. Log de decisões técnicas tomadas (ver `DECISOES-TECNICAS.md` para o detalhe)
- **D1 — Construção:** plataforma completa, modular/incremental (feature usável/vendável quando
  pronta). Orçamento/tempo removidos da discussão → otimizar por qualidade.
- **D2 — Stack:** TypeScript, monólito modular + feature flags. Next.js + Supabase (Postgres,
  Auth, Storage, RLS, pgvector) + Claude (SDK TS `@anthropic-ai/sdk`) + n8n (bastidores).
- **D3–D9 — Banco de questões (foco desta sessão):**
  - Fontes: (1) provas reais oficiais direto das bancas [núcleo/fosso], (2) inéditas geradas por
    IA revisadas, (3) explicações sempre nossas. Não raspar concorrentes. Questão de concurso =
    ato oficial (reproduzível com citação). Validar com advogado antes de escalar.
  - Sem API pronta → **pipeline de ingestão**: catálogo-alvo (manual) → baixar PDFs → Claude
    extrai JSON estruturado (Batch API, 50% off) → cruza gabarito definitivo (marca anuladas) →
    classifica na taxonomia (edital verticalizado) → dedup por embedding → QA → explicações com
    citação → embeddings/índice → publica (feature flag).
  - Formatos: Cesgranrio/FGV = múltipla escolha A–E; Cebraspe = Certo/Errado (anulações). Schema
    guarda `tipo_questao`, proveniência, gabarito definitivo, embedding + fts (busca híbrida).
  - Embeddings: **Cohere embed-v4** (PT) recomendado; alternativa Voyage. Anthropic não faz embed.
  - QA: **misto por fonte** (reais = auto-check + amostra; geradas = 100% revisão no início).
  - Escopo Fase 1: bancário Cesgranrio+FGV+Cebraspe, **~10 anos**. Custo de API baixo; custo real
    = tempo de curadoria.
- **D10 — Camada de IA, arquitetura de custo (FECHADO):** "pré-computa primeiro". IA gerada 1×
  nos bastidores e servida do banco (custo/aluno ≈ 0) em tudo; ÚNICA superfície ao vivo do
  lançamento = **tutor de dúvidas** (com rate limit + cache semântico + contexto injetado).
  Plano diário = job agendado 1×/dia (não recalcula ao vivo). Áudio TTS nunca ao vivo.
- **D11 — Modelos por tarefa (FECHADO, equilíbrio qualidade×preço):** ver matriz completa em
  DECISOES-TECNICAS. Resumo: **Claude Sonnet 5** = extração PDF (Batch) + explicação final +
  diagnóstico; **Claude Haiku 4.5** = tutor ao vivo (padrão, por PT-BR+LGPD; cai p/ barato só se
  passar no eval cego); **GLM 5.2** = rascunho de inéditas; **DeepSeek V4 Pro** = classificação;
  **DeepSeek V4 Flash** = frase do plano diário; **Cohere embed-v4** = dedup/embeddings.
  Princípio durável: gateway de IA trocável (Claude via SDK direto; baratos via OpenRouter) +
  eval cego de PT-BR como porteiro. Claude nativo (Batch −50%, citações, PDF) só via SDK Anthropic.
- **D15 — Coluna vertebral do aluno / `tentativas` (FECHADO, 2026-07-02):** `tentativas` é **registro
  de eventos imutável** (só INSERT; nunca UPDATE/DELETE-por-edição) = fonte da verdade crua. Domínio por
  tópico, caderno de erros, Raio-X e hábito **não** são guardados como número solto — são **telas
  calculadas por cima do log** (projeção/tabela materializada, recalculável do zero). Cada linha carrega
  **snapshot congelado** da etiqueta (matéria/tópico/banca/tipo/dificuldade/origem) no momento da
  resposta → história sobrevive a reclassificação (D4). Rejeitado o "Jeito 1" (só o placar, sobrescrito):
  descarta o histórico e impede reprocessar o passado. Verificado por pesquisa (knowledge tracing usa a
  sequência ordenada; padrão edtech xAPI/LRS grava statements imutáveis; padrão de software = event
  sourcing + read models). Stack aguenta (Postgres `pg_partman` particiona por mês + visões
  materializadas). Custos aceitos: camada calculada desde o dia 1, placar com pequeno atraso (job, não ao
  vivo — coerente D10), particionar a maior tabela, disciplina de nunca dar UPDATE, LGPD = imutável ≠
  não-apagável (DELETE por user_id p/ direito ao esquecimento).
- **D16 — Causa do erro (FECHADO, 2026-07-02):** causa vem do **auto-relato do aluno** (ele marca por
  que errou), **obrigatório ao errar**, mas com **"não sei dizer"** como opção válida. **Rejeitada a
  dedução automática como fonte principal** (sócio: não dá p/ deduzir 100% a causa pela alternativa
  marcada → seria só palpite); o "mapa de distratores" pré-computado fica como enriquecimento opcional
  futuro, nunca sentença. Anti-lixo: "não sei" válido + fechar o ciclo (mostrar que a resposta mexeu no
  plano) + treino pergunta na hora / simulado coleta na revisão pós-prova. Taxonomia enxuta (princípio:
  só registra causa que dispara ação de plano distinta): **6 causas + "não sei"** (não sabia conteúdo /
  errei a conta / entendi errado o enunciado / confundi conceitos / fiquei na dúvida e mudei / chutei),
  + "faltou tempo" só no simulado. Preenche `causa_erro`/`causa_origem` do D15 sem alterar o fato.
- **D17 — Diagnóstico inicial (FECHADO, 2026-07-02):** teste **curto adaptativo-simplificado, opcional
  (pulável)**, que é só **semente** — retrato recalibrado pra sempre pelo log (D15). **~20 questões**
  (~10 min): ~7 Mat. Financeira + ~7 Conhec. Bancários (ganchos) + 1–2 nas outras matérias; questões
  reais do banco; acertou→sobe / errou→desce. **PEGA:** IRT "de livro" precisa de dificuldade real
  (centenas de alunos), que não temos → começa com dificuldade **estimada** (D5) e **calibra a real com
  o uso** (vira ativo p/ simulado/plano/inéditas). Fluxo: pergunta meta (sem IA) → teste (não pergunta
  causa D16) → monta retrato → **1 chamada de IA/aluno** (Sonnet, D10/D11) lê retrato+meta+Raio-X e
  **escreve o plano inicial** (não corrige/mede) → aluno vê retrato como **ponto de partida (não
  veredito)** + plano do 1º dia. Cascata: semeia plano diário (D18), calibração de dificuldade da
  plataforma, eixo "fraqueza" do Raio-X (Tema 3), progresso mostrado como ponto de partida (Tema 4),
  flywheel, ativação (Tema 5).
- **D18 — Plano diário (FECHADO, 2026-07-02) → FECHA O TEMA 2:** roda 1×/dia (job, D10); lógica de
  o-quê-estudar em **regra/SQL** (IA só escreve a frase, D11); orquestra as **2 técnicas de estudo com
  mais evidência** (resolver questões = recordação ativa + revisão espaçada — Donoghue & Hattie 2021,
  242 estudos). **Motor de prioridade:** nota por tópico = quanto cai (Raio-X) × quão fraco (log D15) ×
  quão "devendo revisão" → escolhe o que cabe no tempo do dia (= "ciclo de estudos" movido a dado).
  **Blocos fixos:** Revisar (revisão espaçada + erros do caderno, assuntos misturados) / Avançar (tópico
  novo em bloco concentrado) / Treinar (questões de tipos+assuntos misturados) / Simulado 1×/semana.
  **Intercalação:** novo=bloco, revisar/treinar=misturado (piora curto prazo, melhora retenção).
  **Revisão espaçada = adaptativa estilo FSRS** (20–30% menos revisões p/ mesma retenção); PEGA
  cold-start = lançar com régua 1/3/7/14/30 como piso e migrar p/ FSRS conforme o log enche.
  Base científica das decisões em **`EVIDENCIAS-CIENTIFICAS.md`** (fontes p/ a oferta). Caderno de erros
  = projeção por cima do log (sem decisão própria). → **TEMA 2 COMPLETO.**
- **D19 — Raio-X da banca, arquitetura (FECHADO, 2026-07-03) → ABRE O TEMA 3:** Raio-X = **projeção
  calculada por cima do banco** (filosofia D15), responde "quanto cada assunto cai" = fator "quanto cai"
  do plano (D18). **(1) Conteúdo-primeiro (Jeito 2):** esqueleto único = edital verticalizado; banca =
  **coluna** de peso (não três mapas). Rejeitado banca-primeiro (aluno BB órfão até o edital). **(2) Antes
  da banca:** visão combinada = **núcleo** (cai nas 3, prioridade máxima) + **condicional** (cai em só uma,
  peso menor, rotulado). **(3) Três sinais separados, frequência real manda:** frequência real (fosso) +
  edital (porteiro liga/desliga) + atualidade (empurrão pequeno, humano, auditável à la D12.2). **(4)
  Anti-viés:** Raio-X **só conta `origem='real'`** como **taxa** (inédita D8 é treino, nunca medida) → encher
  o banco de inéditas não infla o "quanto cai". **(5)** guarda `n_questoes` (confiança) + `tendencia`. **(6)
  Duas camadas:** conteúdo (combinável já) vs formato/estilo C/E×A–E (só resolve com a banca). **(7) Virada
  quando a banca sair:** troca de coluna (flag, sem retrabalho); núcleo sobrevive, só a borda re-pesa;
  módulos de formato prontos na gaveta p/ as 3; atualiza porteiro c/ edital real; evento de produto/notícia
  boa. Próximo = **D20 (peso entre os três sinais)**.
- **D20 — Peso entre os sinais (FECHADO, 2026-07-03):** **(1)** edital = **porteiro binário** (fora do
  programa → zero; dentro → elegível; não dá nota); **(2)** frequência real = **motor da ordem**; **(3)**
  atualidade = **empurrão com TETO** (aparece no radar, não domina os que caem todo ano; auditável); **(4)**
  **faixa especial "novo no edital + sinalizado"** (assunto recém-incluído, frequência zero por definição →
  entra em faixa alta só se está no edital E foi sinalizado; ex.: Pix, IA). Rejeitados "só desempate" (cego
  p/ novo) e "atualidade domina" (achismo). Números exatos = PRD. Próximo = **D21 (radar de atualidades)**.
- **D21 — Mecanismo do sinal #3 / atualidade (FECHADO, 2026-07-03):** sócio não confiava no radar → **revisto.
  REJEITADO o radar automático de internet** (caro/ruidoso p/ problema pequeno e visível; edital é o sinal mais
  forte). Sinal #3 vem de **3 camadas quase de graça**: **(1)** passagem de edital (humana, 1×/edital, alimenta
  a faixa especial D20); **(2)** **detecção pelo banco (~R$0)** — a classificação do D4 já dá confiança →
  questão que não encaixa vira fila "candidato a tópico novo" com prova de origem (sinal REAL, IA trabalha pro
  humano); **(3)** skim humano leve, opcional, mensal. Humano registra numa **tela de curadoria** (item curto,
  ~2 min) e quase sempre só **confirma** candidato que edital/banco entregaram — plano é regra/SQL, só lê o
  número. **Rede dupla:** esqueceu de marcar → quando cai, detecção pega e frequência assume. Constrói o
  mínimo (persistir flag já calculada + tela). Próximo = **D22 (camada de formato/estilo do Raio-X)**.
- **D22 — Formato + transição do edital + pivot otimizado (FECHADO, 2026-07-03) → FECHA O TEMA 3:** **(A)**
  "fazer a prova" = **núcleo universal** treinado já (leitura/tempo/eliminação/não-se-trair, reaproveita o
  motor de causa de erro D16) + **módulo de formato** na gaveta pras 3 (A–E × C/E "uma anula uma"), liga
  quando a banca sair; C/E opcional antecipado; simulado alterna antes / trava depois. **(B)** antes×depois
  = **UMA app** lendo um "perfil de concurso"; edital traz **data** (plano vira contagem regressiva) +
  **programa** (fecha o porteiro); núcleo sobrevive (re-foco, não recomeço). **(C)** **pivot otimizado**
  (pesquisado): extrair (Claude saída estruturada + citações página/linha, PDF nativo) → diff por embeddings
  (Cohere embed-v4: bate sozinho / dúvida→IA / novo→humano; + sumiu→porteiro off) → humano confere só o diff
  pré-citado (~1h) → propaga automático (snapshot D15 protege histórico); tópico novo enfileira inéditas D8 +
  base D12.2; humano sempre confere o porteiro. **Multi-concurso:** BB = 1º perfil; core agnóstico. **Verdict
  over-engineering:** desenho coerente, risco = sequência → lançar loop central primeiro (D1). → **TEMA 3
  COMPLETO.**

- **D23 — Gamificação, o que recompensa (FECHADO, 2026-07-03) → ABRE O TEMA 4:** não escolhe entre "presença
  (Duolingo)" e "trabalho certo (plano)" → **4 sinais separados**. Insight: no Duolingo a **sequência** não
  garante "fez certo" (a **trilha** garante) → como o **plano D18 é nossa trilha**, a sequência pode ter **barra
  baixa** sem virar trapaça; e como o mínimo do plano é o bloco **Revisar** (revisão espaçada), a barra baixa
  **já é** o trabalho de maior valor. Sinais: **(1) sequência/streak** = aparecer todo dia, barra baixa = fechar
  o **piso** do plano (revisões devidas); **(2) meta do dia/anel** = quanto fez (cheia = plano completo); **(3)
  no prazo/avanço** = anda a tempo da prova? (nosso, trava anti-coasting — concurseiro que só revisa nunca faz o
  bloco Avançar e não passa); **(4) progresso/domínio** = crescimento desde o **ponto de partida** (D17), nunca
  a moeda do hábito. Adota do Duolingo por inteiro (contador, congelamento, celebrações, lembretes); 2 correções
  nossas (barra dentro do plano + sinal separado de suficiência). Rejeitados: presença pura (corrompe D18) e
  domínio como moeda (lento/ruidoso + fere D17). Custo: D18 emite **piso + meta cheia** (2 níveis/dia). Próximo =
  **D24 (perdão da sequência)**.

- **D24 — Perdão da sequência (FECHADO, 2026-07-03):** sequência **generosa por construção** (função = trazer o
  aluno todo dia); honestidade sobre passar mora no sinal "no prazo" (D23), que **não dá pra congelar**. Corrige o
  abandono nº 1 do streak "tudo ou nada". **Frente 1:** mede **compromisso com a agenda do próprio aluno** (dias/sem
  declarados no D17), não presença diária crua → folga marcada não quebra. **Frente 2 (tudo grátis):** escudo/
  congelamento automático (teto baixo) + folga programada + **reset suave, nunca a zero** (tropeça e recupera com dia
  forte). **Trava:** perdão só na sequência; não toca o "no prazo" (contagem regressiva não congela). Generosos com a
  motivação, honestos com a preparação (integridade D13/D16). Rejeitado zerar-a-zero (Duolingo zera pra vender reparo;
  nós não vendemos → só custo). Exemplos didáticos (Maria/João) validados na sessão. Próximo = **D25 (onde a
  gamificação para: notificação/anti-spam + anti-"jogar o metric" + social/ranking vs. solo)**.

- **D26 — LGPD/flywheel, base legal (FECHADO, 2026-07-03) → ABRE A 2ª METADE DO TEMA 4:** base legal é **por
  finalidade**, não consentimento único (mesmo instinto D13/D23: separa os usos). Três usos do log D15, três bases:
  **(1) operar o produto pro aluno** = execução de contrato (art. 7º V), **sem clique** (o log é o produto que ele
  contratou); **(2) flywheel** (calibrar dificuldade, knowledge tracing, eval, dirigir inéditas D8) = **legítimo
  interesse** (art. 7º IX), sem clique mas com **LIA + transparência + opt-out**; **(3) marketing/notificação** =
  **consentimento** (art. 7º I), com clique. **Regras:** núcleo NUNCA atrás de checkbox (senão desmarcar quebra o
  plano + espanta no cadastro); consentimento granular = NÃO (uma política clara + 1 consentimento só p/ marketing);
  flywheel = **opt-out**, não opt-in; fazer o **LIA agora** (½ página, 1×). LGPD conferido: ANPD Guia do legítimo
  interesse (exige LIA); abr/2026 ANPD sinaliza legítimo interesse p/ treinar IA; anonimizado (art. 12) sai da LGPD
  se **irreversível** (gancho p/ DELETE). Furo: legítimo interesse cai sem LIA/transparência/opt-out; log revela
  fraqueza cognitiva (não é dado sensível legal, mas delicado → transparência honesta, D13/D16). Rejeitado
  consentimento pro flywheel (fricção + aluno desliga o ativo). Próximo = **D27 (separar identificado × anônimo)**.
- **D27 — Separar dado "com nome" do "sem nome": 3 grupos (FECHADO, 2026-07-03):** anonimizar = irreversível →
  sai da LGPD (art. 12), **único jeito de sobreviver ao DELETE**; pseudonimizar = trocar id por código guardando
  a chave → reversível → **continua dado pessoal**. Insight: maior parte do valor do flywheel = **contagens
  somadas de muita gente** (anônimo de verdade), não a linha do aluno. **3 grupos:** (1) **operacional com nome**
  (`tentativas`+`user_id`, contrato, some no DELETE); (2) **estatística somada** (dificuldade/acerto/tempo/
  frequência por questão-tópico; anônimo art. 12, **sobrevive ao DELETE**); (3) **sequência pseudonimizada** (só
  p/ knowledge tracing, legítimo interesse, ainda some no DELETE). Dia 1 = grupos 1+2; grupo 3 = fast-follow.
  Furo: "anônimo" tem que ser merecido — linha-por-resposta-com-código NÃO é anônimo (sequência reidentifica);
  só o **agregado somado** é. Erro a evitar: chamar pseudonimização de anonimização. Próximo = **D28 (retenção)**.
- **D28 — Retenção (FECHADO, 2026-07-04):** dado com nome só se guarda **enquanto serve** (art. 15–16; "pra
  sempre porque é útil" = proibido). Fogem: anonimizado (art. 12, pra sempre) e fiscal (lei obriga ~5 anos, NF-e
  até ~11). Sacada: apagar o com-nome não perde o aprendizado (já foi pro grupo 2). Nuance: concurso é anual →
  aluno volta. **Política:** faturas = prazo legal (sobrevive ao DELETE); **operacional com nome = conta ativa +
  janela 24 meses** após cancelar → depois **anonimiza pro grupo 2 e apaga**; agregado grupo 2 = pra sempre;
  sequência grupo 3 = teto 24–36 meses. Furo: acumular com-nome é proibido E é risco → **anonimizar em vez de
  acumular**; janela escrita/avisada. Rejeitado 12 meses (curto pro ciclo) e "sem prazo" (ilegal). Próximo =
  **D29 (direito ao esquecimento: agregado anônimo sobrevive ao DELETE — art. 12)**.
- **D29 — Direito ao esquecimento (FECHADO, 2026-07-04):** resolve a tensão central do Tema 4 — DELETE por
  `user_id` (D15) **convive** com manter o aprendizado somado. No "apaga tudo meu" (art. 18 VI): **somem** conta +
  `tentativas` com nome (grupo 1) + sequência-código (grupo 3); **ficam** faturas (lei, ~5 anos) + contagens
  somadas (grupo 2, não é mais dado pessoal, art. 12). Princípio do sócio "guarde o que precisa e pode" = guardar
  **tudo que é legal e útil (o anônimo, pra sempre)**, apagar só o com-nome (que a lei não deixa segurar; sem perda,
  o valor já está no grupo 2). **2 travas:** número mínimo de respondentes (≥ ~20; contagem sobre poucos
  reidentifica) + apagar **inclusive dos backups** em ~15–30 dias. Transparência em pt claro; modelo de IA não
  retreina por 1 aluno (próximo treino não o inclui). Furo: "linha-com-código" NÃO é anônimo → só o agregado
  sobrevive. Rejeitado apagar até o agregado (perde flywheel sem ganho legal). Próximo = **D30 (pipeline do
  flywheel + auditoria — ÚLTIMA do Tema 4)**.
- **D30 — Pipeline do flywheel (FECHADO, 2026-07-04) → FECHA O TEMA 4:** sócio perguntou "vou analisar questão
  por questão?" → **Não.** Psicometria automatiza quase tudo; IA mastiga o resto (padrão D22/D21). **3 esteiras:**
  **(1) 100% automática** (dificuldade real = %acerto, frequência, **índice de discriminação** por questão) — o
  índice "os alunos bons acertam?" fica negativo em questão quebrada (gabarito trocado/enunciado dúbio) → **a
  matemática dedura sozinha** (bom ≥ +0,30); **(2) IA peneira + pré-diagnostica, humano confirma ~1h/semana** —
  máquina junta a pilha de suspeitas, Claude escreve o diagnóstico pronto, humano confirma em ~30s (idem qualidade
  de explicação D13 e lacuna→inéditas D8/D6); **(3) 100% humano, raro** — só mudar **gabarito oficial** (aposta
  alta). Automação só mexe em número seguro; risco = humano (protege D12). **Acesso mínimo por sensibilidade** via
  RLS Supabase (anônimo = time vê; com-nome = pouca gente + registrado; código = restrito) + **trilha de auditoria**
  (prestação de contas LGPD art. 6º X, reusa disciplina D15). Furo: discriminação só confia com **volume** →
  cold-start = revisão por amostra (D6) no começo, liga sozinha depois. Maior risco real = **acesso interno demais**,
  não hacker. Deferido pro PRD: IA aplicar sozinha correção de baixíssimo risco (aposentar distrator morto). **→
  FECHA O TEMA 4 (D23–D30).**
- **D25 — Onde a gamificação para (FECHADO, 2026-07-03) → FECHA A GAMIFICAÇÃO (D23–D25):** princípio = a
  gamificação serve o método; quando compete com ele, para. **(1) Notificação leve** (sócio pediu "bem leve, sem
  ficar no pé"): no horário que o aluno declarou, teto ~1 lembrete/dia + 1 aviso de sequência em risco, tom de
  treinador, configurável, horário de silêncio, **nunca mentir** pra criar urgência. **(2) Anti-trapaça:** D23 já
  mata quase tudo (sistema entrega a tarefa; sem métrica de volume); travas extras = resposta rápida-demais
  (`tempo_ms` do D15) não conta + anel com teto no plano (protege de burnout); rede = os 2 sinais honestos
  (progresso + no prazo) não se enganam. **(3) Social:** **100% solo no lançamento** (comparação só consigo mesmo,
  o "3/10 → 7/10" do D17); **sem ranking/liga** (agravante: alunos competem por vaga real → ranking tóxico); social
  só opt-in/sem cabo-de-guerra no futuro. Custo aceito: abrir mão do ranking (engajamento mais forte) troca churn
  por retenção no nosso público. **Falta a metade LGPD/flywheel do Tema 4.**

- **D31 — Monetização + porta de entrada (FECHADO provisório, 2026-07-04) → ABRE O TEMA 5:** **paga-primeiro (paywall)** —
  aluno paga antes de usar; rejeitados por ora freemium e trial (sócio priorizou caixa + filtro de sério; consultor sugeria
  freemium pelo valor de compounding + custo marginal ≈0 do D10 + marca nova). **Cobrança = Leitura A** (compra de 1 ano
  parcelada **12x no cartão**, venda ÚNICA modelo "curso", ~R$16/mês, sem cancelar-no-meio; renovação = compra nova) **+ porta
  Pix/boleto à vista** pro público sem cartão (sócio priorizou Pix). **Garantia = 7 dias** de reembolso (CDC art. 49 já obriga 7
  → esticar é quase de graça + derruba o furo do paywall em marca nova + vira argumento de venda). **Preço-âncora ~R$197/ano**
  (provisório, "pode mudar"; fino = D32). Mercado jul/2026: Bizzu ~R$60/ano, Concursa.ai ~R$360/ano, Gran ~R$660/ano → R$197 =
  acessível, acima do mais barato, abaixo do premium. **Assinatura mensal recorrente (Leitura B)** guardada como entrada barata
  futura. Próximo = **D32** (um plano × tiers + preço fino + renovação sazonal).
- **D32 — Estrutura de planos (FECHADO, 2026-07-04):** **um plano único** no lançamento (tudo incluído por um preço), **não**
  escada de tiers (fast-follow com dado do flywheel). Motivos: paywall já é fricção (checkout simples converte mais); não se sabe
  por qual recurso pagariam a mais sem dado; produto ainda fino (D1); tutor ao vivo (único custo real/aluno, D10) já cercado por
  rate limit dentro do plano; adicionar tier depois é trivial (feature flags). Furo: deixa dinheiro na mesa de mentoria/humano =
  upsell futuro. Preço fino + renovação sazonal = parados pro PRD. **Próximo = pagamentos/cobrança (gateway 12x cartão + Pix +
  boleto + nota fiscal).**
- **D33 — Gateway de pagamento (FECHADO, 2026-07-04):** **Asaas** como gateway, em **checkout próprio** integrado ao Next.js/
  Supabase. Único que faz Pix (R$1,99) + boleto (R$1,99) + cartão parcelado 12x + **nota fiscal nativa** num lugar só, sem
  mensalidade, com antecipação (~1,25%/mês) + API de assinatura. **NF nativa = fator decisivo** (liga D28). Rejeitados:
  AbacatePay (Pix R$0,80 barato mas cartão é feature nova de abr/2026 + provável sem NF → no radar), Stripe (Pix só por convite
  no BR + sem NF brasileira + mais caro), Kiwify (~9%/venda + fragmenta o dado → só campanha pontual). Due diligence (não trava):
  confirmar tabela cartão Asaas + **CNPJ/regime** pra emitir NF. **Próximo = auth (fluxo de entrada), depois infra.**
- **D34 — Auth + fluxo de entrada (FECHADO, 2026-07-04):** login = **Supabase Auth (D2)**; fluxo = **paga-primeiro, conta
  automática** (página de vendas → checkout Asaas só com e-mail → pagamento aprovado → webhook cria usuário Supabase + matrícula
  validade 12 meses [RLS libera; liga D15/D28] → e-mail "defina senha" → 1º login → onboarding meta + diagnóstico D17 → plano do
  1º dia). Login: e-mail+senha + Google + **link mágico** (mata "esqueci a senha"). Consequência do paywall (D31): o "uau"
  pré-compra mora na **página de vendas** (método + evidências científicas + garantia 7 dias), não na experiência. **Próximo =
  infra/hospedagem (última frente do Tema 5).**
- **D35 — Infra/hospedagem (FECHADO, 2026-07-04) → FECHA O TEMA 5:** **Vercel (Next.js) + Supabase Cloud** (região São Paulo),
  gerenciado. Pesquisa confirma que aguenta: Supabase tem particionamento/pg_partman (tabela D15), pg_cron (projeções D15 + plano
  D18), pgvector (D5), pooler Supavisor (escala). **Regra:** trabalho longo FORA do Vercel (serverless expira) → fábrica pesada em
  scripts+Batch (n8n depois), jobs leves no pg_cron, tutor ao vivo por streaming (Vercel Pro). Planos: Vercel Pro + Supabase Pro
  (PITR/backup). **Backup alinhado ao D29** (retenção ~30d, documentar). n8n adiado. **→ TEMA 5 COMPLETO (D31–D35). Próxima etapa
  = PRD + /tlc-spec-driven (prompt pronto em `PROMPT-PRD.md`).**

## 6. Próxima sessão — o que decidir (grill continua)
Banco de questões FECHADO. **TEMA 1 (Camada de IA) FECHADO POR INTEIRO** (D10–D14). Fica só a
**tarefa prática** de rodar o teste de voz em `experiments/tts-comparacao/` e travar o provedor.
**TEMA 2 (coluna vertebral do aluno) ✅ COMPLETO:** D15 (`tentativas` = log imutável + telas
calculadas), D16 (causa do erro = auto-relato obrigatório + 6 causas + "não sei"), D17 (diagnóstico =
teste curto adaptativo pulável, recalibrado pelo log), D18 (plano diário = motor de prioridade + blocos
+ revisão espaçada adaptativa FSRS). Caderno de erros = projeção por cima do log (sem decisão própria).
**Novo artefato:** `EVIDENCIAS-CIENTIFICAS.md` (estudos que embasam o método, para a oferta/marketing).
**TEMA 3 ✅ COMPLETO — Raio-X da banca (D19–D22):** D19 arquitetura (conteúdo-primeiro, esqueleto único do
edital + banca = coluna; três sinais com frequência real mandando; anti-viés só conta `origem='real'` como
taxa; duas camadas conteúdo×formato); D20 peso dos sinais (edital = porteiro binário + frequência = motor +
atualidade = empurrão com teto + faixa especial "novo no edital"); D21 mecanismo do sinal #3 (SEM radar de
internet; edital + detecção grátis pelo banco + skim leve); D22 formato/transição (UMA app com "perfil de
concurso", núcleo universal já + módulo de formato na gaveta, pivot do edital otimizado por embeddings +
citações + snapshot D15). **TEMA 4 EM ANDAMENTO — metade GAMIFICAÇÃO ✅ FECHADA (D23–D25):** D23 (o que
recompensa = 4 sinais; streak de barra baixa DENTRO do plano D18, mínimo = revisão; + sinal "no prazo"
anti-coasting; progresso = ponto de partida D17); D24 (perdão da sequência = mede compromisso com a agenda do
aluno + escudo/folga/reset suave nunca-a-zero, isolado do "no prazo"); D25 (onde para = notificação leve +
anti-trapaça por tempo/teto + 100% solo, sem ranking). **2ª metade do TEMA 4 — LGPD + flywheel ✅ COMPLETA (D26–D30):**
D26 (base legal por finalidade: contrato pro core + legítimo interesse c/ LIA+opt-out pro flywheel + consentimento
só p/ marketing; sem consentimento granular); D27 (3 grupos: operacional com-nome × estatística somada anônima ×
sequência pseudonimizada); D28 (retenção: com-nome vive conta ativa + janela 24 meses → anonimiza e apaga; agregado
anônimo pra sempre; fiscal por lei); D29 (direito ao esquecimento: DELETE apaga o com-nome, agregado anônimo
sobrevive — art. 12; travas = número mínimo de respondentes + apagar backups); D30 (flywheel = 3 esteiras, humano
fora do "questão por questão"; acesso mínimo por RLS + auditoria). **→ TEMA 4 COMPLETO (D23–D30).**
**TEMA 5 ✅ COMPLETO (D31–D35):** modelo de negócio (D31 paga-primeiro/paywall + compra anual 12x cartão + Pix/boleto + garantia
7 dias; D32 um plano único), pagamentos (D33 gateway **Asaas** em checkout próprio), auth/fluxo de entrada (D34 paga→conta
automática → onboarding/diagnóstico; login e-mail+Google+link mágico), infra (D35 Vercel + Supabase Cloud SP; trabalho longo fora
do serverless; backup alinhado ao D29). **→ TODOS OS TEMAS (1–5, D1–D35) FECHADOS.**
**PRÓXIMA ETAPA = gerar o PRD e depois as specs via /tlc-spec-driven.** Prompt de geração do PRD pronto em `PROMPT-PRD.md` (raiz
do projeto) — é só colar numa sessão nova. A skill espera: `.specs/STATE.md` (log de decisões **AD-NNN**, mapeia D1–D35) +
`.specs/features/[feature]/spec.md` (User Stories **P1/P2/P3** + critérios **WHEN/THEN/SHALL** + IDs rastreáveis). Para retomar
rápido, cole o conteúdo de `PROMPT-CONTINUACAO.md`.
Histórico do Tema 1 abaixo:
- **D12 — conferência da explicação ("não ensinar errado"):**
  - **D12.1 FECHADO (2026-07-02):** conferência **pré-computada** (1× na fábrica, gravada com a
    explicação); tutor ao vivo **só repete** explicação+fonte já aprovadas; **sem busca ao vivo**
    no lançamento. Duas defesas: (1) regra/fato = IA cita fonte + a gente entrega um material
    próprio; (2) conta = verificar o número por **código nosso** (não "API de conta" pronta).
  - **D12.2 FECHADO (2026-07-02):** IA escreve só com base em documento entregue (Caminho 3), que
    chega **por etiqueta de assunto**; base de referência = **oficial quando existe + resumo nosso
    conferido quando não** (Jeito B), construída **por frequência**, IA rascunha/humano confere.
  - **D12.3 FECHADO (2026-07-02):** conta quantitativa só publica se **calculada por código** e
    bater com **gabarito oficial + texto**; refaz automático 1×, senão humano; roda na ferramenta
    de execução de código da Anthropic (sandbox próprio = plano B). Bônus: detector de erro.
  - **D13 FECHADO (2026-07-02):** feedback do aluno = **2 sinais separados** ("foi útil?" →
    melhora/eval/flywheel; "reportar erro" → fila de revisão priorizada por volume); **nada muda a
    explicação sozinho** (verdade = gabarito+código+base; feedback só dispara revisão humana).
- **D14 — áudio (TTS):** arquitetura FECHADA (2026-07-02). Gera 1×/explicação e guarda (D10) →
  usar modelo de **máxima qualidade** (não o rápido). **Voz escolhida por teste cego de escuta**
  (lê número/R$/%/sigla certo > voz bonita), 1 voz, **camada trocável**. **DECIDIDO (2026-07-02):**
  provedor **híbrido — ElevenLabs (`eleven_v3`) principal** + provedor barato de fallback (Fish
  `s2.1-pro`/OpenAI). **8 vozes ElevenLabs candidatas** anotadas em DECISOES (D14); amostras em
  `experiments/tts-comparacao/out/`. Voz específica = pick prático pendente.
  Pipeline: **normalização** (número→palavra + dicionário de siglas) antes da voz; áudio só de
  publicadas, **por frequência**, refeito quando o texto muda. → **Tema 1 fechado.**

Depois do Tema 1, seguir a ordem:
2. "Coluna vertebral" do aluno: schema de `tentativas` (desempenho longitudinal) → motor
   adaptativo (diagnóstico + plano diário) + caderno de erros com taxonomia de causa.
3. Raio-X da banca (usa o banco de questões como fonte).
4. Gamificação de hábito; LGPD/analytics (flywheel).
5. Auth/pagamentos/infra (hospedagem) e modelo de negócio/preço.
→ Depois: PRD e specs via /tlc-spec-driven.
Ver também `PROMPT-CONTINUACAO.md` para retomar rápido.
