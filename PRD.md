# PRD — SaaS de Preparação para Concursos (carreira bancária, foco Banco do Brasil)

> **Documento de Requisitos de Produto.** Consolida as **35 decisões técnicas (D1–D35)** fechadas em
> 5 sessões de `/grill-me`. Fonte da verdade das decisões = `DECISOES-TECNICAS.md`; contexto de
> continuidade = `HANDOFF.md`; munição de oferta = `EVIDENCIAS-CIENTIFICAS.md`.
>
> **Objetivo deste PRD:** ser insumo direto para a skill `/tlc-spec-driven`, que trabalha com dois
> artefatos — (1) `.specs/STATE.md` = log de decisões `AD-NNN` (ver **§11**, mapeia D1–D35 um-para-um);
> (2) `.specs/features/[feature]/spec.md` = uma spec por módulo (sementes em **§5**).
>
> **Regras deste documento:** linguagem de leigo, sem analogias; todo termo técnico vem com o que
> significa em concreto. Números voláteis (preço, modelo de IA, taxa) estão marcados **[provisório]** ou
> **[hipótese]** — são o retrato de jul/2026, para reconfirmar, **não** foram reabertos aqui.
>
> **Datas:** projeto iniciado 2026-07-01; decisões fechadas entre 2026-07-01 e 2026-07-04. Este PRD:
> 2026-07-04.

---

## 1. Visão & posicionamento

### 1.1 O que é
Uma plataforma **self-service** (o aluno se cadastra e usa sozinho, sem vendedor) de preparação para
**concursos de carreira bancária**, com **primeiro alvo o Banco do Brasil (BB), cargo Escriturário**.

O diferencial **não é volume de conteúdo** — é **método + IA + direção**: o produto ensina a *fazer a
prova* e diz **o que estudar, em que ordem e quando revisar**, movido pelos dados do próprio aluno e
pela frequência real da banca. Concretamente, o app combina três coisas que hoje o aluno junta na mão:
1. **Banco de questões reais** das provas (o "fosso" — ativo que ninguém copia), com explicações
   próprias conferidas para **não ensinar errado**;
2. **Um plano diário** que escolhe o assunto por regra objetiva (o que mais cai × onde você é fraco ×
   o que está "vencendo" de revisão) e orquestra as duas técnicas de estudo com mais evidência
   científica (resolver questões + revisão espaçada);
3. **IA de bastidor** (gerada uma vez, guardada e servida a todos) que escreve explicações, gera
   questões inéditas no padrão da banca e monta o plano — **sem** virar um "chat genérico".

### 1.2 Para quem
Concurseiro adulto mirando o BB (detalhe da persona em **§2**). Público de **aposta alta** (o concurso
decide a vida financeira), **rotina irregular** e **ansioso** — o que molda decisões de gamificação
(D23–D25) e de honestidade do sistema (nunca fingir progresso).

### 1.3 Mental model do produto — **uma aplicação, multi-concurso** (HANDOFF §1.5)
É **um app só**, não "um antes e outro depois do edital". O mesmo sistema lê um **"perfil de concurso"**
(órgão, banca, programa/edital, data da prova, formato de questão). Antes do edital, esses campos são
**palpite**; quando o edital sai, viram **confirmados** — e todas as telas **recalculam sozinhas**,
porque tudo é **projeção por cima de dados** (D15) e **plano por regra/SQL** (D18), não código chumbado.
- **BB é o primeiro perfil.** O núcleo (banco multi-banca, taxonomia da carreira, coluna vertebral do
  aluno, motor de plano, IA, áudio) é **agnóstico ao concurso** → Caixa/BNB/BASA/Banrisul = *adicionar
  um perfil e ingerir provas*, não reescrever o app.
- **Quatro camadas:** (1) **Acervo/fosso** (banco de questões + taxonomia + base de referência +
  explicações/áudio) → (2) **Aluno** (log `tentativas` + projeções) → (3) **Motor** (diagnóstico →
  Raio-X × fraqueza × revisão espaçada → plano) → (4) **Superfícies** (estudo, questões/simulados,
  tutor, progresso, caderno de erros, gamificação). O "perfil de concurso" fica por cima, fininho, e
  re-mira a máquina.

### 1.4 Não-objetivos (rejeitados explicitamente)
- **Prêmio em dinheiro** por engajamento/ranking. Rejeitado.
- **Nicho de segurança/militar.** Fora de escopo; o foco é carreira bancária.
- **Virar estúdio de conteúdo no dia 1** (videoaulas próprias, professores gravando). O produto é
  método+dados; conteúdo de terceiros não é a aposta.
- **Ser wrapper genérico de ChatGPT** (um chat solto respondendo qualquer coisa ao vivo). A IA é
  **pré-computada e cercada** (D10); a única superfície ao vivo do lançamento é o tutor **com trava**.
- **Raspar (scraping) concorrentes** (Qconcursos/Tec/Gran). Ilegal/antiético; o acervo vem **direto das
  bancas** (D3).
- **Ranking/liga pública** no lançamento (D25) — público compete por vaga real, ranking seria tóxico.
- **Assinatura mensal, freemium ou trial** no lançamento (D31) — o modelo é **paga-primeiro**, compra
  anual; mensal/freemium ficam como opções futuras, não são o lançamento.

### 1.5 Diferencial defensável (o "fosso")
O que é difícil de copiar, em ordem: (1) o **banco de questões reais** classificado por edital
verticalizado; (2) a **base de dados do aluno** (log imutável `tentativas`) que calibra dificuldade
real, Raio-X e plano com o uso; (3) as **explicações próprias conferidas** (grounding + código). Nada
disso é um recurso de IA que o concorrente liga num fim de semana — é **acervo + dado acumulado**.

---

## 2. Persona & tarefa central (JTBD — *Job To Be Done*, "a tarefa que a pessoa contrata o produto para fazer")

### 2.1 Persona primária — "o concurseiro bancário mirando o BB"
- **Quem:** adulto (tipicamente 20–40 anos), muitas vezes já trabalha ou estuda, mirando o cargo de
  **Escriturário do BB** (agente comercial ou agente de tecnologia; ~7 mil vagas esperadas; salário
  inicial ~R$4,2 mil — pesquisa de mercado, `HANDOFF §4`, **[provisório]**).
- **Contexto:** **rotina irregular** (nem todo dia tem o mesmo tempo), **ansioso** (aposta alta, medo de
  perder o edital), **aposta de vida** (a vaga muda a renda). **Compete de verdade** por vaga limitada —
  por isso nada de ranking que exponha o mais fraco (D25).
- **Dores concretas:**
  1. *"Não sei o que estudar / estudo o que não cai."* → Raio-X + plano (M4/M5).
  2. *"Estudo mas esqueço."* → revisão espaçada (D18) + caderno de erros (D16).
  3. *"Monto plano na mão e não sigo."* → plano diário automático + gamificação de hábito (M4/M6).
  4. *"Tenho medo de aprender errado."* → explicação conferida (grounding + código, M2).
  5. *"O edital ainda não saiu e não sei nem a banca."* → app multi-concurso que já prepara o núcleo
     e vira a chave sozinho quando o edital sai (M5).

### 2.2 Tarefa central (JTBD)
> *"Me faça passar no concurso bancário (BB): diga o que estudar hoje, do jeito que a ciência mostra que
> funciona, encaixando na minha rotina irregular, sem eu ter que montar meu próprio plano nem ter medo
> de aprender coisa errada — e me mantenha estudando até a prova."*

### 2.3 Personas secundárias (não são foco do MVP, mas o app não pode atrapalhá-las)
- **Concurseiro de outros bancos** (Caixa/BNB/BASA/Banrisul): atendido por "adicionar perfil" no futuro.
- **Operador interno** (os 3 sócios): faz curadoria de taxonomia, revisa questões/explicações, confirma
  candidatos do Raio-X, confirma diagnósticos do flywheel. **Não** analisa questão por questão (D30).

---

## 3. Objetivos & métricas de sucesso

> Todos os números abaixo são **[hipótese]** — chute inicial para calibrar com dado real. O que **não** é
> hipótese é a *escolha* de qual métrica importa.

### 3.1 North Star (métrica-guia)
**Nº de alunos que mantêm o hábito de estudo pelo método**, medido como: alunos que **cumprem o piso do
plano** (o bloco *Revisar* — revisão espaçada, D18/D23) em **≥ N dias por semana**, semana após semana.
- **Por que essa e não receita:** o valor do produto é *compounding* (só aparece em semanas: revisão
  espaçada, FSRS, "acertava 3/10 → hoje 7/10"). A compra é **anual** (D31), então receita mensal
  recorrente não serve de guia. Constância no método é a **causa**; retenção e renovação são a
  consequência.

### 3.2 Funil e alvos [hipótese — calibrar]
| Etapa | Definição concreta | Alvo inicial [hipótese] |
|---|---|---|
| **Conversão do paywall** | visitante único da página de vendas → **compra aprovada** (D31/D34) | 2–4% |
| **Reembolso na janela** | % que pede reembolso nos 7 dias de garantia (D31) — sinal de promessa honesta | < 10% |
| **Ativação** | em ≤48h da 1ª entrada: definiu **meta** + viu **plano do 1º dia** + respondeu **≥ 1 sessão** (~10 questões). Diagnóstico conta como bônus, **não** requisito (é pulável, D17) | ≥ 40% |
| **Retenção D7 / D30** | aluno ativo (respondeu ≥1 questão) 7 e 30 dias após entrar | D7 ≥ 50% · D30 ≥ 25% |
| **Constância (north star)** | semanas com **piso cumprido** ≥ N dias | mediana ≥ 3 dias/sem |
| **Renovação** | recompra no ciclo seguinte do concurso (liga à janela de 24 meses, D28) | medir a partir do ano 2 |

### 3.3 Guarda-corpos de qualidade (não são metas de crescimento, são limites que não podem quebrar)
- **"Não ensinar errado":** taxa de erro comprovado em explicação publicada tende a **zero** (verdade =
  gabarito + código + base revisada, D12). Reportes de erro procedem → correção com trilha de auditoria.
- **Custo de IA por aluno** previsível e baixo (concentrado no tutor com trava, D10).
- **LGPD:** DELETE cumprido em prazo (~15–30 dias, inclusive backups, D29); nenhum acesso a dado com
  nome sem registro (D30).

---

## 4. Escopo & roadmap por fases (regra D1: modular e incremental)

**Regra durável (D1):** construir a plataforma completa, porém **modular e incremental** — cada
funcionalidade nasce **usável e vendável** quando fica pronta (feature flags = chaves que ligam/desligam
recurso por conta). O risco não é o desenho (coerente); é a **sequência de construção** (D22). Antídoto =
lançar o **loop central primeiro**.

### 4.1 MVP — o **loop central** (o que vai ao ar primeiro)
O ciclo mínimo que já entrega valor e já é vendável:
1. **Banco de questões** — ingestão inicial (uma primeira leva de provas reais das 3 bancas, classificada)
   + explicações pré-computadas com grounding (M1/M2).
2. **Estudar por questões** — responder questão, ver **explicação conferida**, marcar **causa do erro**
   (M4).
3. **Plano simples** — plano diário por **regra/SQL** com **revisão espaçada de régua fixa** (1/3/7/14/30)
   e blocos Revisar/Avançar/Treinar; o motor de prioridade usa **Raio-X só por frequência real** (M4/M5).
4. **Paywall + onboarding** — página de vendas → checkout Asaas → conta automática → onboarding (meta +
   **diagnóstico pulável**) → plano do 1º dia (M8).
5. **Gamificação básica** — sequência de barra baixa (piso do plano) + meta/anel do dia (M6).
6. **Aposta fundacional (tem de ser bem-feita):** **log imutável `tentativas` + projeções (D15)** — é a
   base de tudo; se essa peça for mal-feita, o resto rui.

**Raio-X no MVP:** pode ser **só frequência real** (semeado à mão se o acervo ainda for fino) + **visão
combinada** (núcleo que cai nas 3 bancas + condicional rotulado), sem multi-sinal completo.

### 4.2 Fast-follow (entra em cima do loop central, não no dia 1)
- **Tutor de dúvidas ao vivo** (Claude Haiku, com rate limit + cache semântico + contexto injetado, D10).
- **Áudio/TTS das explicações** (D14) — voz por teste cego + normalização de número/sigla.
- **FSRS real** (revisão espaçada personalizada por aluno/assunto, D18) — substitui a régua fixa quando o
  log enche.
- **Raio-X multi-sinal** (edital como porteiro + atualidade com teto + faixa "novo no edital", D19–D21).
- **Pivot automático do edital** (extrair + diff por embeddings + humano confere só o diff, D22).
- **Flywheel grupo 3 / knowledge tracing** (sequência pseudonimizada, D27) — o mais avançado do motor
  adaptativo.
- **Social opt-in** (grupo privado de responsabilidade, **sem ranking**, D25).
- **Escada de tiers / mensalidade (Leitura B)** (D31/D32) — só com dado do flywheel.

### 4.3 Fora de escopo (agora)
Videoaulas próprias; correção de redação humana; app mobile nativo (web responsivo primeiro);
multi-idioma; concursos não-bancários; ranking/liga; scraping de qualquer fonte.

---

## 5. Módulos (cada um = semente de uma `spec.md`)

> Formato por módulo: **Problema · User Stories P1/P2/P3 · Critérios de aceite (WHEN/THEN/SHALL) ·
> Out of Scope · IDs rastreáveis · Decisões D# que encarna.** As histórias P1 são o **MVP** do módulo;
> P2/P3 são fast-follow. Os critérios são os *principais* — a spec detalha o resto e os edge cases.

---

### M1 — Banco de questões & pipeline de ingestão
**Decisões:** D3, D3.1, D3.2, D4, D5, D6, D7, D8, D9.

**Problema.** Não existe API pronta de questões de concurso. O acervo — o fosso do produto — precisa ser
**montado** a partir dos PDFs oficiais das bancas (Cesgranrio, FGV, Cebraspe), classificado por edital
verticalizado, deduplicado e publicado, **com proveniência** (de onde veio cada questão) para citação e
para o Raio-X. Fonte legal = **provas direto das bancas** (ato oficial, fora da proteção autoral —
Lei 9.610/1998, art. 8º, IV; validar com advogado antes de escalar). **Nunca** raspar concorrentes.

**User Stories.**
- **P1 (operador) —** *Como operador de conteúdo, quero baixar o PDF de uma prova oficial e ter a IA
  extrair as questões em dados estruturados, para popular o banco sem digitar à mão.*
- **P1 (operador) —** *Quero cruzar automaticamente o gabarito oficial (definitivo) com as questões
  extraídas, marcando as anuladas, para publicar só o que está correto.*
- **P1 (aluno) —** *Como aluno, quero ver a fonte de cada questão (banca/ano/órgão/cargo), para confiar
  que é prova real.*
- **P2 (operador) —** *Quero deduplicar questões repetidas entre anos por similaridade, para não repetir
  a mesma questão como se fossem duas.*
- **P2 (operador) —** *Quero gerar questões inéditas no padrão da banca, etiquetadas, para treino
  direcionado por causa de erro.*
- **P3 (operador) —** *Quero uma tela de curadoria da taxonomia (matéria→tópico), para manter o edital
  verticalizado e aprovar candidatos a tópico novo.*

**Critérios de aceite (principais).**
- **WHEN** um PDF de prova oficial é submetido ao pipeline, **THEN** o sistema **SHALL** extrair cada
  questão em JSON estruturado (enunciado, alternativas, número, matéria/tópico sugerido, `tipo_questao`,
  `confianca_ia`) usando **saída estruturada por schema** e PDF nativo do Claude.
- **WHEN** o gabarito **definitivo** é processado, **THEN** o sistema **SHALL** preencher
  `resposta_correta` por número de questão e **SHALL** marcar `anulada = true` quando o gabarito indicar.
- **WHEN** a questão é `origem='real'`, **THEN** o sistema **SHALL** persistir `fonte_citacao`
  (banca/ano/órgão/cargo) e **SHALL NOT** publicar sem proveniência.
- **WHEN** `confianca_ia` da extração está abaixo do piso, **THEN** o sistema **SHALL** rotear a questão
  para **revisão humana** antes de publicar (QA misto por fonte, D6).
- **WHEN** a questão é `origem='gerada_ia'` (inédita), **THEN** o sistema **SHALL** exigir **100% de
  revisão humana** antes de `status='publicada'` (afrouxa só com acurácia comprovada).
- **WHEN** duas questões têm similaridade de embedding acima do limite, **THEN** o sistema **SHALL**
  sinalizá-las como candidatas a duplicata para decisão.
- O `tipo_questao` **SHALL** ser `multipla_escolha` (A–E, Cesgranrio/FGV) **ou** `certo_errado`
  (C/E, Cebraspe), e o schema **SHALL** guardar `gabarito_versao` e `anulada`.

**Out of Scope.** Áudio (M3); explicações em si (M2 — o pipeline apenas *dispara* a geração); busca ao
vivo; qualquer scraping de concorrente; OCR de manuscrito.

**IDs rastreáveis (sugeridos):** BANCO-01 fontes legais/proveniência (D3) · BANCO-02 catálogo-alvo
(D4.1) · BANCO-03 extração PDF→JSON (D4.3) · BANCO-04 cruzamento de gabarito + anuladas (D4.4/D3.2) ·
BANCO-05 taxonomia/classificação (D4.5) · BANCO-06 dedup por embedding (D4.6) · BANCO-07 QA misto por
fonte (D6) · BANCO-08 inéditas geradas (D8) · BANCO-09 schema + embedding + fts busca híbrida (D5) ·
BANCO-10 tela de curadoria da taxonomia (D4.5/liga D21).

---

### M2 — Camada de IA
**Decisões:** D10, D11, D12 (D12.1/D12.2/D12.3), D13.

**Problema.** A IA precisa custar pouco por aluno e **nunca ensinar errado**. Duas exigências: (1)
**arquitetura de custo** — a IA roda **pré-computada** (gerada 1× nos bastidores, guardada, servida a
todos) em tudo, exceto o tutor ao vivo (com trava); (2) **conferência da explicação** — a resposta certa
vem do **gabarito oficial** (a IA não decide qual alternativa é a correta); o risco está na **explicação**
(o "porquê", escrito pela IA) e no tutor. Defesa em dois trilhos: **norma citável** (RAG — a IA escreve
só com base num documento entregue e cita a fonte) e **cálculo verificado por código** (o número é
conferido rodando a conta num programa).

**User Stories.**
- **P1 (aluno) —** *Como aluno, quero uma explicação escrita e confiável de por que a resposta é aquela,
  com a fonte citada, para aprender sem medo de decorar erro.*
- **P1 (sistema) —** *Como plataforma, quero que cada tarefa de IA aponte um modelo por configuração
  (gateway trocável) com versão fixada + fallback, para trocar de modelo sem reescrever código.*
- **P1 (operador) —** *Quero que questões quantitativas (Mat. Financeira/RLM) só publiquem se o número
  for calculado por código e bater com o gabarito e com o texto da explicação, para não publicar conta
  errada.*
- **P2 (aluno) —** *Quero marcar "foi útil?" (👍/👎) e "reportar erro" numa explicação, para pedir
  melhoria — sabendo que meu voto não muda a explicação sozinho.*
- **P2 (aluno) —** *Como aluno, quero um tutor de dúvidas que responda com base na explicação já
  aprovada, com limite diário, para tirar dúvida sem o app virar um chat solto.*

**Critérios de aceite (principais).**
- **WHEN** uma explicação é gerada na fábrica, **THEN** o sistema **SHALL** entregar à IA o **documento
  de referência** do tópico (por etiqueta de assunto) e **SHALL** exigir que todo fato/número/regra
  afirmado esteja no material, com **citação** gravada em `explicacoes.fontes_citadas`.
- **WHEN** a IA não encontra base para um fato, **THEN** ela **SHALL NOT** afirmá-lo (sem invenção).
- **WHEN** a questão é quantitativa, **THEN** o sistema **SHALL** calcular o resultado por **execução de
  código** e **SHALL** publicar somente se (a) o resultado bate com a alternativa correta oficial **e**
  (b) o número na explicação é igual ao executado; **WHEN** falha, **THEN SHALL** refazer 1× automático
  e, persistindo, **SHALL** enviar à fila de revisão humana.
- **WHEN** extração (saída estruturada) e explicação (citações) são necessárias, **THEN** o sistema
  **SHALL** fazê-las em **chamadas separadas** (não podem coexistir na mesma chamada).
- **WHEN** o tutor ao vivo é acionado, **THEN** o sistema **SHALL** servir a explicação + fonte **já
  aprovadas** (sem busca própria ao vivo), **SHALL** aplicar rate limit (N perguntas/dia) e **SHALL**
  reaproveitar cache semântico (mesma pergunta na mesma questão).
- **WHEN** o feedback do aluno chega (👍/👎 ou "reportar erro"), **THEN** o sistema **SHALL** registrá-lo
  como sinal e **SHALL NOT** alterar a explicação automaticamente (só dispara revisão humana; prioriza
  quando vários apontam a mesma questão).
- **WHEN** um modelo candidato entra numa tarefa sensível, **THEN** ele **SHALL** passar antes no **eval
  cego de PT-BR** (~50 questões com gabarito de "explicação boa").

**Out of Scope.** Definição de qual voz/TTS (M3); construção física da base de referência item a item
(fica na esteira do operador, por frequência); busca ao vivo na internet (não existe no lançamento).

**IDs rastreáveis:** IA-01 pré-computa primeiro/balde ao vivo com trava (D10) · IA-02 gateway trocável +
matriz de modelos por tarefa (D11) · IA-03 eval cego PT-BR (D11) · IA-04 grounding por documento
entregue + etiqueta (D12.1/D12.2) · IA-05 base de referência oficial-quando-existe + resumo conferido
(D12.2) · IA-06 verificação de conta por código + cruzamento duplo (D12.3) · IA-07 dois sinais de
feedback, nada muda a explicação sozinho (D13).

---

### M3 — Áudio/TTS das explicações
**Decisões:** D14.

**Problema.** As explicações têm áudio para o aluno ouvir. Como o áudio é gerado **1× por explicação** e
guardado (Storage), **latência não importa** → usar o modelo de **máxima qualidade**. Num produto
bancário, o risco é o áudio **ler número/sigla errado** ("R$ 1.250,00", "12,5%", "CDB", "Selic") → há um
passo de **normalização** (transforma número/símbolo em palavra + dicionário de siglas) **antes** da voz.
A camada de voz é **trocável** (gateway): ElevenLabs `eleven_v3` como principal + provedor barato de
fallback.

**User Stories.**
- **P1 (aluno) —** *Como aluno, quero ouvir a explicação da questão com a leitura correta dos números e
  siglas, para estudar em deslocamento sem entender errado.*
- **P2 (operador) —** *Quero gerar áudio só das explicações publicadas, por frequência (as que mais caem
  primeiro), para controlar custo e cobrir o que importa.*
- **P3 (operador) —** *Quero trocar o provedor de voz por configuração, para baratear sem reescrever o
  pipeline.*

**Critérios de aceite (principais).**
- **WHEN** uma explicação vai virar áudio, **THEN** o sistema **SHALL** rodar a **normalização** (número
  → extenso; expansão de siglas) **antes** de chamar a voz.
- **WHEN** o áudio é gerado, **THEN** o sistema **SHALL** usar o modelo de **máxima qualidade** (não o
  "fast/flash") e **SHALL** guardar o arquivo no Storage amarrado à **versão da explicação**.
- **WHEN** o texto da explicação muda (correção por feedback/código, D12.3/D13), **THEN** o sistema
  **SHALL** descartar o áudio antigo e **SHALL** refazê-lo.
- **WHEN** o provedor de voz é trocado por configuração, **THEN** o pipeline **SHALL** funcionar sem
  alteração de código do restante.

**Out of Scope.** Voz ao vivo (nunca); escolha *final* da voz específica (pendência prática = teste cego
entre as 8 vozes ElevenLabs candidatas — **§10**); dublagem/entonação avançada.

**IDs rastreáveis:** TTS-01 geração 1×, máxima qualidade, amarrada à versão (D14) · TTS-02 normalização
número/sigla antes da voz (D14.B) · TTS-03 camada de voz trocável, ElevenLabs principal + fallback barato
(D14.A) · TTS-04 escopo por frequência, refaz quando o texto muda (D14.B).

---

### M4 — Coluna vertebral do aluno
**Decisões:** D15, D16, D17, D18. (Caderno de erros = projeção por cima do log, sem decisão própria.)

**Problema.** O histórico de respostas é o coração do produto: alimenta diagnóstico, plano, caderno de
erros, Raio-X e flywheel. Precisa ser **guardado como fato cru imutável** (`tentativas`, só INSERT) com
**snapshot congelado** da etiqueta no momento da resposta, e tudo que é "estado atual do aluno" precisa
ser **calculado por cima do log** (projeção recalculável), não guardado como número solto. A causa de
cada erro vem do **auto-relato do aluno** (obrigatório ao errar, com "não sei dizer" válido). O
diagnóstico inicial é **curto, adaptativo-simplificado e pulável** (só semente). O plano diário roda
**1×/dia**, com a lógica em **regra/SQL** (a IA só escreve a frase).

**User Stories.**
- **P1 (sistema) —** *Como plataforma, quero gravar cada resposta como uma linha permanente com snapshot
  da etiqueta, para reconstruir qualquer projeção do zero e sobreviver a reclassificação.*
- **P1 (aluno) —** *Como aluno, quero, ao errar no treino, dizer por que errei (6 causas + "não sei"),
  para o plano me dar o remédio certo — e ver que isso mexeu no plano de verdade.*
- **P1 (aluno) —** *Quero um diagnóstico curto e pulável ao entrar, para começar com um plano sem ser
  obrigado a fazer prova de 3 horas.*
- **P1 (aluno) —** *Quero um plano diário que me diga o que estudar hoje (Revisar/Avançar/Treinar),
  cabendo no tempo que declarei.*
- **P2 (aluno) —** *Quero um caderno de erros que junte o que errei e por quê, para revisar direcionado.*
- **P2 (sistema) —** *Quero migrar a revisão espaçada da régua fixa para FSRS personalizado conforme o
  log enche, para revisar menos e reter igual.*
- **P3 (aluno) —** *Quero um simulado 1×/semana no formato da prova, para treinar sob pressão.*

**Critérios de aceite (principais).**
- A tabela `tentativas` **SHALL** aceitar **apenas INSERT**; **SHALL NOT** sofrer UPDATE nem
  DELETE-por-edição. (Correção = linha nova ou tabela vizinha; DELETE-por-esquecimento por `user_id` é
  permitido — LGPD, M7.)
- **WHEN** uma resposta é registrada, **THEN** a linha **SHALL** conter o **snapshot congelado**
  (`materia`, `topico`, `banca`, `tipo_questao`, `dificuldade`, `origem`) + `questao_id`/`questao_versao`
  + `contexto` (diagnóstico/plano/treino/simulado/revisão) + `resposta_dada`/`correta` + `tempo_ms` +
  `marcou_chute` + `respondida_em`.
- **WHEN** o aluno erra no modo **treino**, **THEN** o sistema **SHALL** exigir a **causa do erro** (6
  causas + "não sei dizer") antes de avançar, gravando `causa_erro` + `causa_origem='aluno'` **sem**
  alterar o fato; **WHEN** o contexto é **simulado**, **THEN SHALL** coletar a causa na **revisão
  pós-prova** (não interrompe a prova).
- **WHEN** o aluno abre o diagnóstico, **THEN** o sistema **SHALL** permitir **pular** declarando o nível;
  **WHEN** ele faz, **THEN SHALL** aplicar ~20 questões reais adaptativas (acertou→sobe, errou→desce),
  gravando cada uma como `tentativa` com `contexto='diagnostico'`, **sem** perguntar causa.
- **WHEN** o diagnóstico termina, **THEN** o sistema **SHALL** montar o retrato inicial (projeção) e
  **SHALL** fazer **uma** chamada de IA por aluno (Sonnet) que **lê** retrato+meta+Raio-X e **escreve** o
  plano inicial (não corrige, não mede).
- **WHEN** o plano diário roda (job 1×/dia), **THEN** a escolha do que estudar **SHALL** ser por
  **regra/SQL** (a IA **SHALL** apenas escrever a frase de abertura); a nota por tópico **SHALL** = quanto
  cai (Raio-X) × quão fraco (log) × quão "devendo revisão"; e o plano **SHALL** emitir **dois níveis**:
  `piso` (mantém a sequência) e `meta cheia` (enche o anel) — necessário para M6.
- O projetor de estado (domínio, caderno, Raio-X, hábito) **SHALL** ser recalculável do zero a partir do
  log; o número mostrado ao aluno **SHALL** ser atualizado por job (placar com pequeno atraso), não ao
  vivo.
- **WHEN** há histórico de revisões suficiente, **THEN** o sistema **SHALL** migrar da régua fixa
  (1/3/7/14/30) para **FSRS** personalizado.

**Out of Scope.** Peso/fórmula do Raio-X (M5); gamificação/sequência (M6); knowledge tracing avançado
(M7, grupo 3). Parâmetros finos (FSRS default, tamanho de bloco) ficam na spec.

**IDs rastreáveis:** ALUNO-01 `tentativas` só-INSERT + snapshot congelado (D15) · ALUNO-02 projeções
recalculáveis por cima do log (D15) · ALUNO-03 causa do erro por auto-relato obrigatório + "não sei"
(D16) · ALUNO-04 taxonomia enxuta (6 causas + faltou-tempo no simulado) (D16) · ALUNO-05 diagnóstico
curto adaptativo pulável (D17) · ALUNO-06 calibração da dificuldade real pelo uso (D17) · ALUNO-07 motor
de prioridade (D18) · ALUNO-08 blocos Revisar/Avançar/Treinar/Simulado + intercalação (D18) · ALUNO-09
revisão espaçada régua→FSRS (D18) · ALUNO-10 caderno de erros como projeção (D15/D16).

---

### M5 — Raio-X da banca
**Decisões:** D19, D20, D21, D22.

**Problema.** O Raio-X responde **"quanto cada assunto cai na prova"** — é o fator "quanto cai" que o
plano (D18) multiplica pela fraqueza do aluno. É uma **projeção calculada por cima do banco** (mesma
filosofia do log: banco = verdade crua; Raio-X = tabela recalculável, nunca congela). Trava do tema: a
**banca do BB ainda não foi definida** → o Raio-X precisa funcionar **antes** de saber a banca.
Arquitetura: **conteúdo-primeiro** (esqueleto único = edital verticalizado; banca = **coluna** de peso,
não três mapas separados); **três sinais separados** com a **frequência real mandando**; **anti-viés**: o
Raio-X **só conta `origem='real'`** como taxa.

**User Stories.**
- **P1 (aluno) —** *Como aluno do BB sem banca definida, quero um Raio-X que já priorize o que cai nas 3
  bancas (núcleo) e rotule o que "depende da banca" (condicional), para estudar o que importa desde já.*
- **P1 (sistema) —** *Quero calcular a frequência real por banca/tópico como taxa, contando só questões
  reais, para não inflar o "quanto cai" com inéditas.*
- **P2 (operador) —** *Quero uma faixa especial "novo no edital + sinalizado" (ex.: Pix), para priorizar
  assunto emergente que ainda não caiu.*
- **P2 (operador) —** *Quero uma fila "candidato a tópico novo" alimentada pela baixa confiança da
  classificação, para achar assunto novo quase de graça (sem radar de internet).*
- **P3 (sistema) —** *Quando a banca do BB for anunciada, quero trocar a coluna ativa (flag) e girar o
  edital por diff automático, para virar a chave no mesmo dia sem retrabalho.*

**Critérios de aceite (principais).**
- **WHEN** o Raio-X calcula "quanto cai", **THEN** ele **SHALL** contar **apenas** `origem='real'`, como
  **taxa** (% dentro das provas da banca), com ano recente pesando mais; **SHALL NOT** contar inéditas.
- **WHEN** a banca do concurso está **indefinida**, **THEN** o sistema **SHALL** produzir a **visão
  combinada**: **núcleo** (cai forte nas 3 → prioridade máxima) + **condicional** (cai forte em uma só →
  peso menor + rótulo "depende da banca").
- O edital **SHALL** funcionar como **porteiro binário** (tópico fora do programa → zero; dentro →
  elegível; não dá nota); a frequência real **SHALL** ser o **motor da ordem** entre elegíveis; a
  atualidade **SHALL** ser **empurrão com teto** (não domina os que caem todo ano) e **SHALL** ser
  registrada/auditável.
- **WHEN** um assunto é recém-incluído no edital **E** sinalizado, **THEN** o sistema **SHALL** colocá-lo
  na **faixa especial** (alta prioridade apesar de frequência zero).
- Cada linha do Raio-X **SHALL** guardar `n_questoes` (confiança da taxa) e `tendencia` (subindo/estável/
  caindo).
- **WHEN** a banca é anunciada, **THEN** o sistema **SHALL** trocar a coluna ativa por flag no **perfil de
  concurso**, preservando o histórico (snapshot D15), e **SHALL** processar o edital por **diff**
  (extração com citações + comparação por embeddings; humano confere só o diff).

**Out of Scope.** Radar automático de internet (rejeitado, D21); camada de **formato/estilo** só resolve
com a banca (módulos A–E × C/E prontos na gaveta); números exatos dos pesos (ficam na spec/§10).

**IDs rastreáveis:** RAIOX-01 conteúdo-primeiro, banca = coluna (D19) · RAIOX-02 visão combinada
núcleo/condicional (D19) · RAIOX-03 três sinais, frequência real manda (D19/D20) · RAIOX-04 anti-viés só
`origem='real'` como taxa (D19) · RAIOX-05 `n_questoes` + `tendencia` (D19) · RAIOX-06 edital porteiro
binário + atualidade com teto + faixa nova (D20) · RAIOX-07 sinal #3 sem radar (edital + detecção pelo
banco + skim leve) + tela de curadoria (D21) · RAIOX-08 perfil de concurso / uma app multi-concurso (D22)
· RAIOX-09 módulo de formato na gaveta (A–E × C/E) (D22) · RAIOX-10 pivot do edital por diff (D22).

---

### M6 — Gamificação de hábito
**Decisões:** D23, D24, D25.

**Problema.** Manter um adulto ansioso estudando por meses **sem** corromper o método e **sem** ranking
tóxico. Solução: **4 sinais separados** (não um número que finge dizer tudo) — sequência de **barra baixa
dentro do plano** (o piso = revisões devidas, já é o trabalho de maior valor); meta/anel do dia
(quanto fez); "no prazo/avanço" (anti-*coasting* — o concurseiro que só revisa nunca avança e não passa);
progresso/domínio (crescimento desde o ponto de partida, D17 — nunca a moeda do hábito). **Perdão da
sequência** generoso (mede compromisso com a agenda do próprio aluno + escudo + reset suave, **nunca a
zero**), isolado do "no prazo". **100% solo, sem ranking.**

**User Stories.**
- **P1 (aluno) —** *Como aluno, quero manter uma sequência cumprindo o piso do plano (~5–10 min de
  revisões), para criar hábito sem precisar fazer tudo todo dia.*
- **P1 (aluno) —** *Quero um anel/meta do dia que enche quando faço o plano (não quando moio questões),
  para ver meu esforço sem farmar número.*
- **P2 (aluno) —** *Quero que minha folga marcada e escudos automáticos protejam a sequência num dia
  perdido, para não ser punido por uma rotina irregular.*
- **P2 (aluno) —** *Quero um sinal honesto "no prazo" que me avise se estou só revisando e não avançando,
  para não me acomodar e reprovar.*
- **P3 (aluno) —** *Quero, no futuro, um grupo privado de responsabilidade opt-in (sem ranking), para me
  cobrar com quem eu escolher.*

**Critérios de aceite (principais).**
- **WHEN** o aluno cumpre o **piso** do plano do dia, **THEN** o sistema **SHALL** manter/incrementar a
  sequência; a barra do piso **SHALL** ser a tarefa **entregue pelo sistema** (regra/SQL), não escolha
  livre do aluno (nada a trapacear).
- **WHEN** o aluno declara uma agenda (dias/semana, no D17), **THEN** a sequência **SHALL** medir
  **compromisso com essa agenda**, não presença diária crua (folga marcada **SHALL NOT** quebrar).
- **WHEN** um dia é perdido inesperadamente, **THEN** o sistema **SHALL** gastar um **escudo**
  automaticamente (teto baixo); **WHEN** os escudos acabam, **THEN** a sequência **SHALL** dar um "reset
  suave" (recuperável) e **SHALL NOT** zerar.
- **WHEN** uma resposta vem **rápida demais** (abaixo do piso de tempo, `tempo_ms`), **THEN** ela **SHALL
  NOT** contar para o anel nem para a sequência (sem punição, só não vale).
- O anel do dia **SHALL** ter **teto no plano do dia** (não dá para moer 500 questões por um número
  maior).
- O perdão **SHALL** valer **só** para a sequência; **SHALL NOT** congelar o sinal "no prazo" (contagem
  regressiva não congela).
- O lançamento **SHALL NOT** ter ranking, liga ou placar entre alunos.

**Out of Scope.** Prêmio em dinheiro (rejeitado); ranking (rejeitado no lançamento); social competitivo.

**IDs rastreáveis:** GAM-01 4 sinais separados (D23) · GAM-02 sequência barra-baixa dentro do plano
(piso) (D23) · GAM-03 sinal "no prazo" anti-coasting (D23) · GAM-04 progresso = ponto de partida (D23/
D17) · GAM-05 perdão: compromisso com a agenda + escudo + reset suave nunca-a-zero (D24) · GAM-06
notificação leve (teto ~1/dia, nunca mentir) (D25) · GAM-07 anti-trapaça por tempo + teto no plano (D25)
· GAM-08 100% solo, sem ranking; social opt-in futuro (D25).

---

### M7 — LGPD & flywheel de dados
**Decisões:** D26, D27, D28, D29, D30.

**Problema.** O mesmo log `tentativas` que opera o produto também melhora a plataforma (flywheel) — sem
ferir privacidade. Base legal é **por finalidade** (não um consentimento único): operar o produto =
**execução de contrato** (sem clique); flywheel = **legítimo interesse** (sem clique, mas com LIA +
transparência + opt-out); marketing = **consentimento** (com clique). Os dados vivem em **3 grupos**:
(1) operacional **com nome** (some no DELETE), (2) **estatística somada anônima** (sobrevive ao DELETE —
art. 12), (3) **sequência pseudonimizada** (código; ainda é dado pessoal, some no DELETE). Retenção:
com-nome vive conta ativa + **24 meses**, depois anonimiza e apaga; agregado anônimo **pra sempre**;
fiscal pelo prazo legal. Direito ao esquecimento: DELETE apaga o com-nome, **o agregado anônimo
sobrevive**. Flywheel processa por **3 esteiras** (automática × IA-peneira-humano-confirma × 100% humano
raro), com **acesso mínimo por RLS + trilha de auditoria**.

**User Stories.**
- **P1 (aluno) —** *Como aluno, quero usar o produto sem marcar checkbox de "aceito usarem meus dados",
  porque o log é o produto que contratei — e quero uma política clara em português.*
- **P1 (aluno) —** *Quero pedir "apague tudo meu" e ter meus dados com nome removidos (inclusive de
  backups) em prazo definido, entendendo que estatísticas anônimas que não me identificam permanecem.*
- **P1 (sistema) —** *Quero separar o dado em 3 grupos, calculando o flywheel do dia 1 sobre o agregado
  anônimo (grupo 2), para o risco ser ~zero e sobreviver ao DELETE.*
- **P2 (operador) —** *Quero que a matemática (índice de discriminação) delate questões quebradas sozinha
  e que a IA me entregue o diagnóstico pronto, para eu só confirmar ~1h/semana (não questão por questão).*
- **P2 (sistema) —** *Quero acesso mínimo por sensibilidade (RLS) + trilha de auditoria de todo acesso a
  dado com nome, para prestação de contas LGPD.*
- **P3 (sistema) —** *Quero, como fast-follow, a sequência pseudonimizada (grupo 3) para knowledge
  tracing, aceitando que ela some no DELETE.*

**Critérios de aceite (principais).**
- O núcleo do produto **SHALL NOT** ficar atrás de checkbox de consentimento; **SHALL** haver **uma**
  política clara + **um** consentimento apenas para marketing/notificação; o flywheel **SHALL** rodar em
  **opt-out**.
- **WHEN** o dado alimenta o flywheel, **THEN** ele **SHALL** vir do **grupo 2 (agregado anônimo)** por
  padrão; o grupo 3 (código) **SHALL** entrar só no fast-follow.
- **WHEN** um agregado é calculado/usado, **THEN** ele **SHALL** exigir **número mínimo de respondentes**
  (≥ ~20) para ser tratado como anônimo.
- **WHEN** o aluno pede DELETE (art. 18, VI), **THEN** o sistema **SHALL** apagar conta + `tentativas` com
  nome (grupo 1) + sequência-código (grupo 3), **inclusive dos backups** em prazo definido (~15–30 dias);
  **SHALL** manter faturas pelo prazo legal e o agregado anônimo (grupo 2).
- **WHEN** uma conta é cancelada e passa a **janela de 24 meses** sem retorno, **THEN** o sistema **SHALL**
  anonimizar o operacional para o grupo 2 e apagar o com-nome.
- **WHEN** o flywheel processa questões, **THEN** a **esteira 1** (dificuldade real, frequência, índice de
  discriminação) **SHALL** ser 100% automática; correções **arriscadas** (mudar o que se ensina, mudar
  gabarito) **SHALL** exigir decisão humana (esteiras 2/3).
- Todo acesso/alteração a dado **com nome** **SHALL** gerar registro de auditoria (quem/quando/porquê); o
  acesso **SHALL** ser mínimo por sensibilidade via RLS.
- O LIA (teste de balanceamento do legítimo interesse) **SHALL** existir **antes** de ligar o flywheel.

**Out of Scope.** Vender/compartilhar dado com terceiros (não é o modelo); consentimento granular (tela
de switches — rejeitado); retreinar modelo por causa de 1 aluno.

**IDs rastreáveis:** DADOS-01 base legal por finalidade (contrato/legítimo interesse+LIA+opt-out/
consentimento) (D26) · DADOS-02 3 grupos identificado×anônimo×pseudonimizado (D27) · DADOS-03 retenção
(janela 24m → anonimiza+apaga; agregado pra sempre; fiscal por lei) (D28) · DADOS-04 direito ao
esquecimento + travas (nº mínimo respondentes + apagar backups) (D29) · DADOS-05 flywheel 3 esteiras
(D30) · DADOS-06 índice de discriminação delata questão ruim (D30) · DADOS-07 acesso mínimo por RLS +
trilha de auditoria (D30).

---

### M8 — Negócio, pagamentos & onboarding
**Decisões:** D31, D32, D33, D34.

**Problema.** Modelo **paga-primeiro (paywall)**: o aluno paga **antes** de usar. Cobrança = **compra de
1 ano** parcelada **12x no cartão** (modelo "curso", venda única, sem cancelar no meio) **+ porta
Pix/boleto à vista** (para quem não tem cartão). **Garantia de 7 dias.** **Um plano único** no
lançamento. Gateway = **Asaas** em **checkout próprio** (Pix + boleto + cartão parcelado + **nota fiscal
nativa** — fator decisivo). Fluxo de entrada = **buy-then-activate**: pagamento aprovado → **webhook**
cria a conta no Supabase + matrícula validade 12 meses → e-mail "defina a senha" → onboarding (meta +
diagnóstico) → plano do 1º dia. Como o produto está atrás do muro, o "uau" mora na **página de vendas**
(método + evidências científicas + garantia). Preço-âncora **~R$197/ano [provisório]**.

**User Stories.**
- **P1 (visitante) —** *Como visitante, quero comprar informando só o e-mail e pagar (cartão 12x ou
  Pix/boleto), para entrar com o mínimo de atrito.*
- **P1 (sistema) —** *Quando o pagamento é aprovado, quero criar a conta automaticamente via webhook e
  registrar a matrícula de 12 meses, para o aluno acessar sem cadastro manual antes de pagar.*
- **P1 (aluno) —** *Quero definir a senha por e-mail e entrar, e ter login por e-mail+senha, Google e
  link mágico, para não travar no "esqueci a senha".*
- **P1 (aluno) —** *Quero garantia de 7 dias, para testar sem risco numa marca nova.*
- **P2 (operador) —** *Quero emitir nota fiscal nativa pelo gateway, para cumprir a obrigação B2C sem 2º
  serviço.*
- **P3 (negócio) —** *Quero, como fast-follow, escada de tiers / mensalidade (Leitura B), desenhada com
  dado do flywheel.*

**Critérios de aceite (principais).**
- O checkout **SHALL** oferecer **cartão parcelado 12x**, **Pix** e **boleto** à vista, e **SHALL** pedir
  **só o e-mail** antes do pagamento.
- **WHEN** o Asaas confirma o pagamento (webhook), **THEN** o sistema **SHALL** criar o usuário no
  Supabase + registrar **matrícula com validade de 12 meses** (é o que o RLS/app checa para liberar
  conteúdo) e **SHALL** disparar o e-mail "defina sua senha".
- O login **SHALL** oferecer e-mail+senha, **Google OAuth** e **link mágico** (passwordless).
- **WHEN** o aluno pede reembolso dentro de 7 dias, **THEN** o sistema **SHALL** processar a devolução e
  encerrar o acesso.
- O lançamento **SHALL** vender **um plano único** (sem tiers) e **SHALL NOT** cobrar mensalidade
  recorrente.
- **WHEN** a compra é concluída, **THEN** o sistema **SHALL** emitir **nota fiscal** pelo gateway.

**Out of Scope.** Escada de tiers, mensalidade recorrente, cupons/afiliados complexos, Kiwify como espinha
(só campanha pontual, se algum dia). A mecânica exata de reembolso sobre parcela antecipada = **§10**.

**IDs rastreáveis:** PAG-01 paga-primeiro/paywall (D31) · PAG-02 compra anual 12x cartão + Pix/boleto à
vista (D31) · PAG-03 garantia 7 dias (D31) · PAG-04 um plano único (D32) · PAG-05 gateway Asaas checkout
próprio + Pix+boleto+12x+NF (D33) · PAG-06 auth Supabase + buy-then-activate por webhook + matrícula 12m
(D34) · PAG-07 login e-mail/Google/link mágico (D34) · PAG-08 página de vendas = superfície de conversão
(método + evidências + garantia) (D34).

---

### M9 — Infra & operações
**Decisões:** D35 (com dependências em D2, D4, D10, D15, D18, D29).

**Problema.** Rodar tudo com **3 devs, sem time de operações**. Combo gerenciado **Vercel (Next.js) +
Supabase Cloud** (Postgres + Auth + Storage + RLS + pgvector), **região São Paulo** (latência BR +
conforto LGPD, dado no Brasil). **Regra de ouro:** **trabalho longo FORA do serverless** (a função da
Vercel expira: Hobby ~10s, Pro ~60s) — fábrica pesada em **scripts standalone + Batch API**; jobs leves
em **pg_cron** (dentro do banco, sem timeout); tutor ao vivo por **streaming** (Vercel Pro). n8n
**adiado**. Backup **alinhado ao D29** (apagar dado da pessoa dos backups em ~15–30 dias). Staging por
branch.

**User Stories.**
- **P1 (sistema) —** *Quero a tabela `tentativas` particionada por mês (pg_partman) com índices desde o
  início, para crescer para sempre e continuar rápida.*
- **P1 (sistema) —** *Quero rodar as projeções (D15) e o plano diário (D18) em pg_cron, para jobs leves
  sem estourar timeout de serverless.*
- **P1 (sistema) —** *Quero que a fábrica pesada (extração PDF, explicações, inéditas, áudio, embeddings)
  rode em scripts + Batch API, nunca em função da Vercel.*
- **P2 (sistema) —** *Quero o tutor ao vivo como função com streaming (Vercel Pro), para manter a conexão
  além do timeout curto.*
- **P2 (sistema) —** *Quero retenção de backup ~30 dias documentada, para casar com o prazo do DELETE
  (D29) e não virar furo de LGPD.*
- **P3 (sistema) —** *Quero staging por branch (Supabase branch + preview Vercel), para testar sem tocar
  produção.*

**Critérios de aceite (principais).**
- Trabalho longo (minutos/horas) **SHALL** rodar em scripts standalone / Batch API; **SHALL NOT** rodar
  em função serverless da Vercel.
- Jobs agendados leves (projeções, plano diário) **SHALL** usar **pg_cron**; **SHALL NOT** depender de
  Vercel Cron (teto ~60s).
- A tabela de eventos (`tentativas`) **SHALL** ser particionada por mês com índices definidos desde o
  início.
- A retenção de backup **SHALL** ser ~30 dias e **SHALL** casar com o prazo de DELETE do D29 (documentado
  na spec de infra).
- O ambiente **SHALL** ficar na **região São Paulo**.

**Out of Scope.** n8n no lançamento (adiado); Kubernetes/infra própria; multi-região.

**IDs rastreáveis:** INFRA-01 Vercel + Supabase Cloud SP gerenciado (D35) · INFRA-02 trabalho longo fora
do serverless (D35) · INFRA-03 pg_cron para jobs leves (D35) · INFRA-04 pg_partman/particionamento (D35/
D15) · INFRA-05 tutor ao vivo por streaming (D35/D10) · INFRA-06 backup alinhado ao DELETE (D35/D29) ·
INFRA-07 staging por branch (D35) · INFRA-08 n8n adiado (D35/D2).

---

## 6. Requisitos não-funcionais transversais

- **LGPD (privacidade).** Base legal **por finalidade** (contrato / legítimo interesse com LIA+opt-out /
  consentimento só marketing, D26); **3 grupos** de dado (D27); retenção (com-nome vive conta ativa + 24
  meses → anonimiza e apaga; agregado anônimo pra sempre; fiscal por lei, D28); **DELETE** apaga o
  com-nome inclusive de backups em ~15–30 dias, agregado anônimo sobrevive (D29); política em português
  claro, sem letra miúda.
- **Performance & custo.** **Pré-computa primeiro** (D10): quase tudo é gerado 1× e servido do banco;
  projeções recalculáveis por job (placar com **pequeno atraso**, não ao vivo); tabela de eventos
  **particionada por mês**; custo de IA concentrado no tutor com trava (Batch −50%, cache semântico, eval
  cego PT-BR como porteiro). O core funciona mesmo se a API de IA cair.
- **Segurança.** **RLS** (segurança por linha) com **acesso mínimo por sensibilidade** (anônimo = time
  amplo; com-nome = pouca gente, registrado; código = restrito); **trilha de auditoria** de todo acesso/
  alteração a dado com nome (D30); segredos fora do código; webhook do Asaas verificado.
- **Confiabilidade da verdade.** Explicação nunca publicada sem passar pela conferência (grounding +
  código, D12); feedback do aluno nunca altera explicação sozinho (D13); automação só mexe em número
  seguro (D30).
- **PT-BR & acessibilidade.** Todo conteúdo e voz em **português do Brasil**; TTS com **normalização** de
  número/sigla (D14); leitura clara; contraste/tamanho de fonte adequados; app **web responsivo** (mobile
  nativo é fora de escopo agora).

---

## 7. Modelo de dados (núcleo)

> Nomes provisórios; a spec de M4/M1 fecha os detalhes. Princípio: **`tentativas` = verdade crua
> imutável; todo "estado atual" = projeção recalculável por cima.**

### 7.1 Acervo / fosso (M1/M2/M3)
- `bancas`, `orgaos`, `concursos`, `provas` (`pdf_prova_url`, `pdf_gabarito_url`, `status_ingestao`).
- `materias`, `topicos` (hierárquico = edital verticalizado; a taxonomia curada).
- `questoes`: `prova_id` (proveniência), `numero`, `tipo_questao` (`multipla_escolha`|`certo_errado`),
  `enunciado`, `alternativas` (jsonb; null p/ C-E), `resposta_correta`, `materia_id`, `topico_id`,
  `dificuldade` (estimada, calibra com o uso), `anulada`, `gabarito_versao`, `origem`
  (`real`|`gerada_ia`), `status` (`rascunho`|`em_revisao`|`publicada`|`rejeitada`), `confianca_ia`,
  `imagens` (jsonb → Storage), `fonte_citacao`, **`embedding`** (vector, índice HNSW) + **`fts`**
  (tsvector PT) → **busca híbrida**.
- `explicacoes`: `questao_id`, `texto`, `audio_url`, `fontes_citadas` (jsonb), `gerada_por`, `revisada`,
  `versao`.
- `base_referencia` (documentos por tópico p/ grounding, D12.2), `questao_revisoes` (auditoria da revisão,
  D6), `feedback_explicacao` (aluno↔explicação: `foi_util`, `reportou_erro`, `texto`, D13).

### 7.2 Aluno (M4) — **event sourcing**
- **`tentativas`** (a maior tabela; **só-INSERT**; **particionada por mês**, pg_partman): grupos do D15 —
  quem/o quê (`user_id`, `questao_id`, `questao_versao`); **snapshot congelado** (`materia`, `topico`,
  `banca`, `tipo_questao`, `dificuldade`, `origem`); contexto (`sessao_id`, `contexto`); resultado
  (`resposta_dada`, `correta`); sinais crus (`tempo_ms`, `marcou_chute`); enriquecido depois (`causa_erro`,
  `causa_origem`); tempo (`respondida_em`).
- **Projeções (read models, recalculáveis, NÃO são fonte da verdade):** `dominio_topico`
  (user↔tópico↔score↔n), `caderno_erros` (consulta sobre `correta=false`+`causa_erro`), `raio_x` (por
  banca/tópico: taxa, `n_questoes`, `tendencia), `habito` (streak/anel/no-prazo/progresso).

### 7.3 Perfil de concurso (M5) — o que re-mira a máquina
- `perfil_concurso`: `orgao`, `banca` (pode ser "indefinida"), `programa/edital`, `data_prova`,
  `formato`. Muda estes campos → telas recalculam (projeções + plano regra/SQL).

### 7.4 Matrícula / assinatura (M8)
- `matricula`: `user_id`, `validade` (12 meses), `status`, origem do pagamento; `pagamentos`
  (webhook Asaas, NF), `faturas` (retenção fiscal ~5 anos, sobrevive ao DELETE).

### 7.5 Os 3 grupos de dado (M7 / D27)
- **Grupo 1 — operacional com nome:** `tentativas`+`user_id` (contrato; some no DELETE).
- **Grupo 2 — estatística somada anônima:** contagens por questão/tópico (acertos, tempo médio,
  dificuldade real, frequência, índice de discriminação); **fora da LGPD (art. 12); sobrevive ao DELETE**;
  trava = ≥ ~20 respondentes.
- **Grupo 3 — sequência pseudonimizada:** fluxo por aluno-código, só p/ knowledge tracing (legítimo
  interesse; ainda é pessoal; some no DELETE); **fast-follow**.
- `auditoria` (quem acessou/alterou dado com nome — D30).

---

## 8. Integrações & stack

| Camada | Escolha | Papel | Decisão |
|---|---|---|---|
| Front + servidor | **Next.js** (na **Vercel**) | telas + lógica de servidor; tutor por streaming | D2/D35 |
| Banco/Auth/Storage | **Supabase Cloud** (Postgres, Auth, Storage, RLS, **pgvector**), região **SP** | dados + login + arquivos + busca por similaridade | D2/D35 |
| Partição/jobs | **pg_partman** (partição mensal) + **pg_cron** (projeções, plano) | escala da tabela de eventos + jobs leves | D15/D18/D35 |
| IA principal | **Claude (Anthropic) via SDK TS** `@anthropic-ai/sdk` | Batch −50%, **citações**, **PDF nativo**, **execução de código** (D12.3) | D2/D11/D12 |
| Modelos por tarefa | **Sonnet 5** (extração/explicação/diagnóstico), **Haiku 4.5** (tutor), **GLM 5.2** (rascunho inéditas), **DeepSeek V4 Pro** (classificação), **DeepSeek V4 Flash** (frase do plano) — baratos via **OpenRouter** | equilíbrio qualidade×preço; gateway trocável | D11 |
| Embeddings | **Cohere embed-v4** (alternativa Voyage) | dedup, busca híbrida, diff do edital | D5/D22 |
| TTS | **ElevenLabs `eleven_v3`** (principal) + fallback barato (**Fish `s2.1-pro`** / **OpenAI `gpt-4o-mini-tts`**) | áudio das explicações, camada trocável | D14 |
| Pagamentos/NF | **Asaas** (checkout próprio) | Pix + boleto + cartão 12x + **nota fiscal** + webhook | D33/D34 |
| Automação bastidor | **n8n** (adiado) | fábrica de conteúdo quando virar rotina | D2/D35 |

> Todos os nomes de modelo de IA são **[provisível — trocável por config]**: o princípio durável (D11) é
> o **gateway trocável + eval cego de PT-BR como porteiro**, não o modelo da semana.

---

## 9. Invariantes / regras de negócio que NÃO podem se perder (restrições duras)

1. **Log imutável.** `tentativas` só recebe **INSERT**; nunca UPDATE nem DELETE-por-edição. Correção =
   linha nova ou tabela vizinha. (DELETE-por-esquecimento por `user_id` é permitido — é outra coisa.)
   (D15)
2. **Snapshot congelado.** Cada `tentativa` carrega a etiqueta do assunto no momento da resposta →
   reclassificação futura **não desloca** o histórico. (D15)
3. **Raio-X só conta real.** Só `origem='real'` entra na **taxa** de frequência; inédita nunca infla o
   "quanto cai". (D19)
4. **Verdade da explicação.** = **gabarito oficial + verificação por código (D12.3) + base revisada
   (D12.2)**. A IA **não** decide a alternativa correta. O **feedback do aluno nunca muda a explicação
   sozinho** — só dispara revisão humana. (D12/D13)
5. **Diagnóstico é opcional.** Sempre pulável; é só semente, o log recalibra. (D17)
6. **Plano é regra/SQL.** A lógica de o-quê-estudar é regra/SQL; a IA **só escreve a frase**. (D18/D11)
7. **Pré-computa primeiro.** A única superfície ao vivo do lançamento é o **tutor com trava** (rate limit
   + cache + contexto injetado). Áudio **nunca** ao vivo; projeções por **job**, não a cada clique. (D10)
8. **DELETE seletivo.** O pedido de esquecimento apaga o **com-nome** (grupo 1) e a **sequência-código**
   (grupo 3), **inclusive backups** (~15–30 dias); o **agregado anônimo (grupo 2) sobrevive** (art. 12);
   faturas ficam pelo prazo legal. Travas: ≥ ~20 respondentes + apagar backups. (D29)
9. **Núcleo sem checkbox.** O produto **não** fica atrás de consentimento (contrato + legítimo interesse);
   consentimento existe só para marketing. (D26)
10. **Automação só no seguro.** A automação mexe só em número que ajusta o plano de leve; mudar o que se
    ensina ou o **gabarito oficial** = decisão **humana**. (D30)
11. **Quantitativa conferida.** Questão de conta só publica se o número **calculado por código** bate com
    o gabarito **e** com o texto; falhou → refaz 1×, senão fila humana. (D12.3)
12. **Chamadas separadas.** Extração (saída estruturada) e explicação (citações) são **chamadas distintas**
    do Claude — não coexistem. (D7/D12)
13. **Retenção com prazo.** Com-nome vive conta ativa + 24 meses, depois **anonimiza e apaga**; backup
    casa com o prazo do DELETE. (D28/D35)
14. **Notificação honesta.** Teto ~1 lembrete/dia + 1 aviso de sequência; **nunca mentir** para criar
    urgência. (D25)
15. **Sem ranking.** Nenhum placar/liga entre alunos no lançamento. (D25)

---

## 10. Riscos & questões em aberto

> "Questão em aberto" = furo ou pendência que **não** reabre decisão; registra para a spec/afinação
> resolver.

**Riscos herdados das decisões (já previstos):**
1. **Banca do BB indefinida** (Cesgranrio × FGV × Cebraspe). **Confirmado ainda aberto em 2026-07-04**
   (notícias de abr/2026 e da última semana: BB ainda escolhendo/contratando banca; edital de escriturário
   previsto p/ 2026, sem definição). Mitigado por desenho (M5: conteúdo-primeiro + perfil de concurso +
   pivot por diff). **Não bloqueia o MVP.**
2. **Cold-start (partida a frio).** IRT/FSRS/índice de discriminação/dificuldade real só calibram com
   **volume** de alunos. Mitigação já decidida: lançar com **régua fixa 1/3/7/14/30**, **dificuldade
   estimada** pela IA e **revisão por amostra** (D6); os motores "ligam sozinhos" com o uso (D17/D18/D30).
3. **CNPJ / regime tributário para emitir NF.** MEI provavelmente não cobre → **ME no Simples**.
   Confirmar com contador **antes** de emitir nota fiscal (liga D33/D28). **Due diligence, não trava.**
4. **Voz do ElevenLabs pendente.** Falta o **teste cego de escuta** entre as **8 vozes candidatas** +
   fixar o **provedor barato** de fallback (D14). Ferramenta pronta em `experiments/tts-comparacao/`. Não
   bloqueia o produto (áudio é fast-follow).
5. **Preço fino e renovação sazonal.** Âncora **~R$197/ano [provisório]**; política de renovação (concurso
   é anual, aluno volta — liga D28 janela 24 meses) a fechar. (D31/D32)
6. **Base legal das questões.** Ato oficial (art. 8º, IV, Lei 9.610/1998) é a base, mas **validar com
   advogado antes de escalar** (D3). Também: montar o LIA (legítimo interesse) **antes** de ligar o
   flywheel (D26).
7. **Localizar PDFs antigos + OCR.** Links instáveis de provas antigas; qualidade de OCR em provas
   escaneadas (D9). Custo real = tempo de curadoria.
8. **Base de conhecimento para grounding** de Conhecimentos Bancários a construir **por frequência**
   (D12.2) — assunto que mais cai primeiro; não cobrir tudo no dia 1.

**Questões em aberto novas (levantadas ao montar o PRD — não mudam decisão):**
9. **Mecânica de reembolso da garantia de 7 dias sobre compra parcelada antecipada.** Se as 12x forem
   **antecipadas** no Asaas (D33) e o aluno pedir reembolso, qual o custo/estorno? Confirmar com o Asaas
   como o estorno interage com a antecipação. (Operacional; afeta a spec de M8.)
10. **Tratamento de menores de idade.** O público é adulto, mas o cadastro não impede um menor. LGPD tem
    regra específica para crianças/adolescentes. Decidir na spec de M7 (bloquear no cadastro? consentimento
    de responsável?). Baixa prioridade, mas não endereçado.
11. **Números exatos** dos pesos do Raio-X (D20), parâmetros FSRS default e tamanho dos blocos (D18),
    piso de tempo do anti-trapaça (D25), threshold de dedup e de baixa confiança (M1) — todos **afinação
    de spec**, marcados como "detalhe, não arquitetura".
12. **Deferido para a spec (D30):** deixar a IA aplicar **sozinha** correções de **baixíssimo** risco
    (ex.: aposentar um distrator que ninguém marca) sem passar por humano.

---

## 11. Log de decisões pré-formatado (`AD-001` … `AD-035`) — para colar em `.specs/STATE.md`

> Formato `/tlc-spec-driven`: **Decision · Reason · Trade-off · Scope · Date · Status.** Numeração
> preservada de D# (D7 → AD-007) para rastreabilidade. Todas **active**; onde a própria decisão se
> declarou provisória, está anotado no Trade-off/Scope.

**AD-001** — **Decision:** construir a plataforma completa, mas **modular e incremental** (cada feature
usável/vendável quando pronta, via feature flags). **Reason:** time de 3, quer o melhor produto sem
esperar o todo. **Trade-off:** mais peças a coordenar; risco mora na sequência de construção.
**Scope:** arquitetura geral. **Date:** 2026-07-01. **Status:** active.

**AD-002** — **Decision:** stack único em **TypeScript**, **monólito modular** — Next.js + Supabase
(Postgres/Auth/Storage/RLS/pgvector) + Claude via SDK TS + n8n (bastidor). **Reason:** uma linguagem ponta
a ponta; monólito > microserviços neste tamanho. **Trade-off:** acopla mais que microserviços.
**Scope:** stack. **Date:** 2026-07-01. **Status:** active.

**AD-003** — **Decision:** banco de questões de **3 fontes** (reais oficiais direto das bancas = fosso;
inéditas de IA revisadas; explicações sempre nossas); **nunca** raspar concorrentes; guardar proveniência.
**Reason:** legalidade (ato oficial, art. 8º IV) + qualidade + defensabilidade. **Trade-off:** curadoria
manual; validar com advogado antes de escalar. **Scope:** M1. **Date:** 2026-07-01. **Status:** active.

**AD-004** — **Decision:** **pipeline de ingestão** (catálogo → download → extração Claude PDF→JSON →
cruza gabarito definitivo/anuladas → classifica na taxonomia → dedup por embedding → QA → explicações →
embeddings/índice → publica por flag), em código+Batch, n8n depois. **Reason:** não há API pronta.
**Trade-off:** partes inerentemente manuais. **Scope:** M1. **Date:** 2026-07-01. **Status:** active.

**AD-005** — **Decision:** schema Supabase/Postgres+pgvector com `questoes` (origem, tipo, gabarito_versao,
anulada, status, embedding HNSW + fts) e `explicacoes`; **embeddings = Cohere embed-v4** (alt. Voyage).
**Reason:** busca híbrida + grounding + dedup. **Trade-off:** trocar embedding = re-embeddar (barato).
**Scope:** M1/M2. **Date:** 2026-07-01. **Status:** active.

**AD-006** — **Decision:** QA **misto por fonte** — reais = auto-check + amostra/baixa confiança; geradas
= 100% revisão no início; aluno reporta erro. **Reason:** confiança sem revisar tudo. **Trade-off:** dado
inicial imperfeito. **Scope:** M1. **Date:** 2026-07-01. **Status:** active.

**AD-007** — **Decision:** grounding + citação — extração por **saída estruturada**; explicação por
**citações** do Claude (chamadas **separadas**); base curada para Conhec. Bancários. **Reason:** não
ensinar errado. **Trade-off:** duas chamadas; base a construir. **Scope:** M2. **Date:** 2026-07-01.
**Status:** active.

**AD-008** — **Decision:** geração de **inéditas** no padrão da banca, etiquetadas, `origem='gerada_ia'`,
**100% revisão** antes de publicar. **Reason:** volume + treino direcionado. **Trade-off:** custo de
revisão. **Scope:** M1. **Date:** 2026-07-01. **Status:** active.

**AD-009** — **Decision:** escopo Fase 1 = bancário Cesgranrio+FGV+Cebraspe, **~10 anos**; custo de API
baixo, custo real = tempo de curadoria. **Reason:** cobre o BB independente da banca. **Trade-off:** PDFs
antigos/OCR. **Scope:** M1. **Date:** 2026-07-01. **Status:** active.

**AD-010** — **Decision:** **pré-computa primeiro** — IA gerada 1× nos bastidores e servida do banco
(custo/aluno ≈ 0); única superfície ao vivo = **tutor com trava** (rate limit + cache semântico + contexto
injetado). **Reason:** custo previsível; core resiste a queda da API. **Trade-off:** menos "mágica ao
vivo". **Scope:** M2. **Date:** 2026-07-01. **Status:** active.

**AD-011** — **Decision:** **modelos por tarefa** (gateway trocável + versão fixada + fallback + **eval
cego PT-BR** como porteiro): Sonnet 5 (extração/explicação/diagnóstico), Haiku 4.5 (tutor), GLM 5.2
(rascunho inéditas), DeepSeek V4 Pro (classificação), DeepSeek V4 Flash (frase do plano), Cohere embed-v4
(embeddings). **Reason:** equilíbrio qualidade×preço; o líder muda toda semana. **Trade-off:** manter
gateway + evals. **Scope:** M2. **Date:** 2026-07-01. **Status:** active (nomes de modelo **[provisível]**).

**AD-012** — **Decision:** conferência da explicação **pré-computada** (1× na fábrica, gravada), dois
trilhos — **norma citável** (documento entregue por etiqueta + citação; base oficial-quando-existe +
resumo nosso conferido) e **cálculo verificado por código** (cruzamento duplo: bate com gabarito **e** com
o texto; refaz 1×, senão humano). Tutor não faz busca ao vivo. **Reason:** não ensinar errado sem custo ao
vivo. **Trade-off:** construir base + sandbox de código. **Scope:** M2. **Date:** 2026-07-02.
**Status:** active.

**AD-013** — **Decision:** feedback do aluno = **2 sinais separados** ("foi útil?" → melhora/eval/flywheel;
"reportar erro" → fila priorizada por volume); **nada muda a explicação sozinho** (verdade = gabarito +
código + base). **Reason:** aluno é sinal, não autoridade. **Trade-off:** correção depende de humano.
**Scope:** M2. **Date:** 2026-07-02. **Status:** active.

**AD-014** — **Decision:** áudio TTS gerado **1×/explicação** com **máxima qualidade**; **voz por teste
cego** (lê número/sigla certo), **1 voz**, camada trocável — **ElevenLabs `eleven_v3`** principal +
fallback barato; **normalização** de número/sigla antes da voz; áudio por frequência, refeito quando o
texto muda. **Reason:** qualidade num produto bancário; latência não importa. **Trade-off:** voz específica
pendente (teste cego). **Scope:** M3. **Date:** 2026-07-02. **Status:** active.

**AD-015** — **Decision:** **`tentativas` = event sourcing** (só-INSERT, imutável) + **snapshot
congelado** da etiqueta; todo "estado atual" = **projeção recalculável** por job; particionada por mês.
**Reason:** knowledge tracing/reprocessamento/vários relatórios da mesma base; aposta fundacional.
**Trade-off:** camada calculada desde o dia 1; placar com atraso; disciplina de nunca dar UPDATE.
**Scope:** M4 (fundação de todo o produto). **Date:** 2026-07-02. **Status:** active.

**AD-016** — **Decision:** causa do erro = **auto-relato do aluno**, **obrigatório ao errar**, com "não
sei dizer" válido; taxonomia enxuta (**6 causas** + "faltou tempo" só no simulado); dedução automática
rebaixada a enriquecimento futuro. **Reason:** só o aluno sabe o porquê; cada causa dispara remédio
distinto. **Trade-off:** dado inicial incompleto/enviesado. **Scope:** M4. **Date:** 2026-07-02.
**Status:** active.

**AD-017** — **Decision:** diagnóstico inicial = teste **curto adaptativo-simplificado, opcional
(pulável)**, ~20 questões reais, só **semente** (log recalibra pra sempre); 1 chamada de IA/aluno escreve
o plano inicial. **Reason:** medir sem cansar; não forçar prova na entrada. **Trade-off:** estimativa
grosseira no começo (calibra com uso). **Scope:** M4/M8. **Date:** 2026-07-02. **Status:** active.

**AD-018** — **Decision:** plano diário 1×/dia, lógica em **regra/SQL** (IA só escreve a frase); **motor
de prioridade** (quanto cai × fraqueza × devendo revisão); **blocos** Revisar/Avançar/Treinar/Simulado +
**intercalação**; **revisão espaçada** régua fixa 1/3/7/14/30 → **FSRS** com o uso; emite **piso + meta
cheia**. **Reason:** orquestrar as 2 técnicas com mais evidência. **Trade-off:** cold-start do FSRS;
"revisar em vez de avançar" precisa ser explicado. **Scope:** M4. **Date:** 2026-07-02. **Status:** active.

**AD-019** — **Decision:** Raio-X = projeção sobre o banco, **conteúdo-primeiro** (esqueleto único do
edital; banca = **coluna**); **visão combinada** (núcleo+condicional) antes da banca; **3 sinais** com
**frequência real mandando**; **anti-viés** (só `origem='real'` como taxa); guarda `n_questoes`+`tendencia`;
formato só resolve com a banca. **Reason:** aluno do BB não pode ficar órfão até o edital. **Trade-off:**
formato na gaveta. **Scope:** M5. **Date:** 2026-07-03. **Status:** active.

**AD-020** — **Decision:** pesos — **edital = porteiro binário**; **frequência real = motor da ordem**;
**atualidade = empurrão com teto** (auditável); **faixa especial "novo no edital + sinalizado"**.
**Reason:** frequência não pode ser cega a assunto novo de alto valor (Pix). **Trade-off:** faixa/empurrão
dependem de julgamento humano. **Scope:** M5. **Date:** 2026-07-03. **Status:** active (números
**[provisório]**).

**AD-021** — **Decision:** sinal #3 (atualidade) **sem radar de internet**; sai de 3 camadas quase de
graça (passagem de edital humana + detecção pelo banco ~R$0 + skim leve mensal), registrado em tela de
curadoria; rede dupla (se esquecer, a frequência assume). **Reason:** problema pequeno e visível; radar =
caro/ruidoso. **Trade-off:** depende de disciplina humana leve. **Scope:** M5. **Date:** 2026-07-03.
**Status:** active.

**AD-022** — **Decision:** "fazer a prova" = **núcleo universal** já (reaproveita causa de erro) + **módulo
de formato** na gaveta (A–E × C/E); antes×depois do edital = **UMA app** lendo perfil de concurso; **pivot
do edital otimizado** (extração+citações → diff por embeddings → humano confere só o diff → propaga com
snapshot). **Reason:** girar no mesmo dia do edital; multi-concurso. **Trade-off:** complexidade adiada
(fast-follow). **Scope:** M5. **Date:** 2026-07-03. **Status:** active.

**AD-023** — **Decision:** gamificação = **4 sinais separados** — sequência barra-baixa **dentro do plano**
(piso = revisões); meta/anel; **"no prazo"** anti-coasting; **progresso** = ponto de partida (nunca a
moeda). **Reason:** motivar sem corromper o método. **Trade-off:** D18 emite 2 níveis/dia.
**Scope:** M6. **Date:** 2026-07-03. **Status:** active.

**AD-024** — **Decision:** perdão da sequência generoso — mede **compromisso com a agenda do aluno** +
**escudo/folga** + **reset suave, nunca a zero**; isolado do sinal "no prazo". **Reason:** corrige o
abandono nº 1 do streak "tudo ou nada"; público ansioso. **Trade-off:** sequência "quase nunca quebra"
(aceito). **Scope:** M6. **Date:** 2026-07-03. **Status:** active.

**AD-025** — **Decision:** limites da gamificação — **notificação leve** (teto ~1/dia, tom de treinador,
nunca mentir); **anti-trapaça** (resposta rápida-demais não conta; anel com teto no plano); **100% solo,
sem ranking** (social opt-in no futuro). **Reason:** ranking é tóxico p/ quem compete por vaga real.
**Trade-off:** abre mão do engajamento mais forte. **Scope:** M6. **Date:** 2026-07-03. **Status:** active.

**AD-026** — **Decision:** base legal **por finalidade** — contrato (operar), **legítimo interesse** +LIA+
transparência+opt-out (flywheel), **consentimento** (marketing); núcleo **nunca** atrás de checkbox;
consentimento granular = não. **Reason:** separar usos; proteger ativação. **Trade-off:** LIA a redigir;
legítimo interesse cai sem transparência. **Scope:** M7. **Date:** 2026-07-03. **Status:** active.

**AD-027** — **Decision:** **3 grupos** de dado — (1) operacional com nome (some no DELETE), (2)
**estatística somada anônima** (art. 12, sobrevive), (3) sequência pseudonimizada (código, some no DELETE,
fast-follow). Dia 1 = grupos 1+2. **Reason:** o valor do flywheel está no agregado; "anônimo" tem de ser
merecido. **Trade-off:** knowledge tracing (grupo 3) adiado. **Scope:** M7. **Date:** 2026-07-03.
**Status:** active.

**AD-028** — **Decision:** retenção — com-nome vive **conta ativa + 24 meses** → anonimiza p/ grupo 2 e
apaga; agregado anônimo **pra sempre**; fiscal pelo prazo legal (~5–11 anos). **Reason:** ciclo anual do
concurso; guardar só enquanto serve. **Trade-off:** janela precisa ser escrita/avisada. **Scope:** M7.
**Date:** 2026-07-04. **Status:** active (números confirmar c/ advogado/contador).

**AD-029** — **Decision:** direito ao esquecimento — DELETE apaga com-nome (grupo 1) + código (grupo 3),
**inclusive backups** (~15–30 dias); **agregado anônimo (grupo 2) sobrevive** (art. 12); faturas ficam.
Travas: **≥ ~20 respondentes** + apagar backups. **Reason:** convive o "apaga tudo meu" com manter o
aprendizado somado. **Trade-off:** disciplina de backup + piso de respondentes. **Scope:** M7.
**Date:** 2026-07-04. **Status:** active.

**AD-030** — **Decision:** flywheel = **3 esteiras** (1 automática: dificuldade/frequência/índice de
discriminação; 2 IA peneira+pré-diagnostica, humano confirma ~1h/sem; 3 100% humano raro = mudar
gabarito); **acesso mínimo por RLS + trilha de auditoria**; automação só no seguro. **Reason:** não
analisar questão por questão; proteger o "não ensinar errado". **Trade-off:** discriminação só confia com
volume (cold-start = amostra). **Scope:** M7. **Date:** 2026-07-04. **Status:** active.

**AD-031** — **Decision:** **paga-primeiro (paywall)** + compra anual **12x no cartão** + **porta Pix/
boleto à vista** + **garantia 7 dias**; preço-âncora **~R$197/ano**. **Reason:** caixa imediato + filtro de
sério + trava o valor de compounding por 1 ano. **Trade-off:** paywall converte pouco do topo (mitigado
por garantia + Pix). **Scope:** M8. **Date:** 2026-07-04. **Status:** active (**provisório** — "pode
mudar"; mensal Leitura B guardada p/ futuro).

**AD-032** — **Decision:** **um plano único** no lançamento (sem tiers). **Reason:** checkout simples
converte mais; sem dado ainda p/ desenhar tier; produto fino; tutor já cercado por rate limit; tier é
trivial depois. **Trade-off:** deixa dinheiro de mentoria/humano na mesa (upsell futuro). **Scope:** M8.
**Date:** 2026-07-04. **Status:** active.

**AD-033** — **Decision:** gateway **Asaas** em **checkout próprio** (Pix + boleto + cartão 12x + **NF
nativa** + webhook + antecipação). **Reason:** único que faz tudo num lugar, nacional, sem mensalidade; NF
= decisivo. **Trade-off:** confirmar tabela do cartão + CNPJ/regime p/ NF. **Scope:** M8.
**Date:** 2026-07-04. **Status:** active.

**AD-034** — **Decision:** auth **Supabase**, fluxo **buy-then-activate** (paga → webhook cria conta +
matrícula 12 meses → e-mail define senha → onboarding meta+diagnóstico → plano do 1º dia); login
e-mail+senha + **Google** + **link mágico**. **Reason:** menor atrito; "só e-mail e paga". **Trade-off:** o
"uau" pré-compra mora na página de vendas (método + evidências + garantia). **Scope:** M8.
**Date:** 2026-07-04. **Status:** active.

**AD-035** — **Decision:** infra **Vercel + Supabase Cloud (São Paulo)**, gerenciado; **trabalho longo
FORA do serverless** (fábrica em scripts+Batch; jobs leves em pg_cron; tutor por streaming); n8n adiado;
**backup ~30 dias alinhado ao DELETE (D29)**; staging por branch. **Reason:** 3 devs sem ops; Postgres
particionado + pooler aguentam. **Trade-off:** disciplina de onde cada carga roda. **Scope:** M9.
**Date:** 2026-07-04. **Status:** active.

---

*Fim do PRD. Próximo passo proposto: inicializar `/tlc-spec-driven` a partir do log AD-001…AD-035 e depois
Specify módulo a módulo, começando pelo MVP (loop central: M1 → M4 → M2 → M8), com a fundação M4/D15 (log
imutável + projeções) feita com o maior cuidado.*
