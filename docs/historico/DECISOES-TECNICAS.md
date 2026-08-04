# Decisões Técnicas — SaaS de Concursos (bancário)

> Documento vivo. Cada linha = uma decisão fechada na sessão de /grill-me.
> Vira insumo do PRD e das specs (/tlc-spec-driven).
> **Início:** 2026-07-01

## Índice de áreas a decidir
1. Estratégia de lançamento — ✅ FECHADO (ver abaixo)
2. Stack e arquitetura — ✅ FECHADO (ver D2)
3. Banco de questões (origem, pipeline, schema, legalidade) — ✅ FECHADO (D3–D9)
4. Camada de IA — custo/arquitetura (D10) + modelos por tarefa (D11) ✅ FECHADO; conferência da explicação (D12) ✅ FECHADO (pré-computada D12.1 + base/mecanismo D12.2 + conta por código D12.3); feedback do aluno (D13) ✅ FECHADO; TTS/áudio EM ABERTO (fecha o Tema 1)
5. **Coluna vertebral do aluno** — ✅ TEMA FECHADO: `tentativas` (D15) + causa do erro (D16) + diagnóstico inicial (D17) + plano diário (D18)
6. Caderno de erros + taxonomia de causa — ✅ coberto (projeção por cima do log D15 + causa D16; alimenta o bloco "Revisar" do plano D18) — sem decisão própria
7. Raio-X da banca (usa o banco de questões como fonte) — ✅ TEMA FECHADO: arquitetura (D19) + pesos (D20) + atualidade (D21) + formato/transição/pivot (D22)
8. Explicação em áudio (TTS, custo, cache) — PRÓXIMA SESSÃO
9. **Gamificação de hábito** — ✅ FECHADA (Tema 4, D23–D25): o que recompensa (D23) + perdão da sequência (D24) + onde para (D25)
10. **Dados/analytics (flywheel) e privacidade (LGPD)** — ✅ TEMA FECHADO (Tema 4): base legal (D26) + 3 grupos identificado×anônimo×pseudonimizado (D27) + retenção (D28) + direito ao esquecimento (D29) + pipeline do flywheel/auditoria (D30). **→ TEMA 4 COMPLETO (D23–D30).**
11. **Autenticação, pagamentos, infra operacional** — ✅ FECHADO (Tema 5): gateway Asaas (D33) + auth/fluxo de entrada (D34) + infra Vercel+Supabase SP (D35)
12. **Modelo de negócio / preço / cobrança** — ✅ FECHADO (Tema 5): monetização/porta paga-primeiro (D31) + um plano único (D32); preço fino/renovação = afinação de PRD

---

## Decisões fechadas

### D1 — Estratégia de construção/lançamento
**Decisão:** Construir a **plataforma completa** (as 12 funcionalidades da visão), porém de forma
**modular e incremental**: cada funcionalidade é entregue de modo que já possa ser **usada e
vendida** assim que fica pronta, sem esperar o todo.
**Restrição removida:** por decisão do sócio, orçamento (~R$15k) e tempo NÃO são mais limitadores
desta discussão — otimizar pela melhor plataforma, não pela mais barata/rápida.
**Consequência técnica:** a arquitetura precisa permitir ligar/desligar features de forma
independente (feature flags) e compartilhar um núcleo de dados comum (histórico do aluno).

### D2 — Stack e arquitetura
**Decisão:** stack único em **TypeScript**, formato **monólito modular** (um projeto, módulos
independentes, feature flags para ligar/vender cada feature). Componentes:
- **Next.js** (parte visual + lógica de servidor no mesmo projeto).
- **Supabase**: PostgreSQL (banco), Auth (login), Storage (arquivos, ex.: áudios), RLS
  (segurança por linha), **pgvector** (busca por similaridade para grounding da IA).
- **Claude (Anthropic)** como IA principal, via **SDK oficial TypeScript** (`@anthropic-ai/sdk`),
  rodando no servidor Next.js. (Modelo exato/custos definidos na decisão da camada de IA.)
- **n8n**: automações **de bastidores** (não visível ao usuário) — fábrica de questões, fábrica
  de áudio, importação/classificação, rotinas agendadas. NÃO usar para lógica ao vivo do aluno.
  Opcional no início; entra quando a fábrica de conteúdo crescer.
- Hospedagem provável: Vercel (Next) + Supabase Cloud (a confirmar na decisão de infra).
**Racional:** uma linguagem de ponta a ponta reduz atrito para o time de 3; monólito modular >
microserviços nesse tamanho de time.

---

# BANCO DE QUESTÕES — estratégia completa (foco da sessão de 2026-07-01)

> Esta é a decisão central do projeto. O banco de questões é o **fosso** (ativo que ninguém
> copia) e alimenta quase todas as outras features (simulados, Raio-X, caderno de erros, plano,
> motor adaptativo). Foco fechado: **Cesgranrio, FGV, Cebraspe** em **carreira bancária**.

## D3 — Fontes e legalidade
**Decisão:** o banco se monta de **3 fontes**, nesta prioridade:
1. **Questões reais oficiais**, coletadas **direto da fonte** (PDFs de prova + gabarito
   publicados pelas próprias bancas). É o núcleo e o fosso.
2. **Questões inéditas geradas pelo Claude** (no padrão da banca, sempre revisadas).
3. **Explicações/comentários = sempre nossos** (gerados pela IA com fonte citada + conferência).
**Legalidade (base, não é aconselhamento jurídico — validar com advogado antes de escalar):**
- Questões de prova de concurso público são **atos oficiais** → **fora da proteção autoral**
  (Lei 9.610/1998, art. 8º, IV). Podem ser reproduzidas **com citação da fonte** (banca/ano/
  órgão/cargo) e **sem** fingir autoria.
- **Nunca raspar (scraping) concorrentes** (Qconcursos, Tec, Gran): o site, a organização do
  banco de dados e principalmente os **comentários deles** são protegidos + fere termos de uso.
- Fonte legal = **provas direto das bancas** (públicas por lei de acesso à informação).
- Guardar **proveniência** de cada questão (obrigatório para a citação e para o Raio-X).

## D3.1 — De onde baixar (fontes oficiais confirmadas em 2026-07-01)
- **Cesgranrio:** `cesgranrio.org.br` e `inscricao.cesgranrio.com.br` — URLs de PDF estruturadas
  por concurso (ex.: `/pdf/bb0122/provas/...`). Provas: BB (2018/2021/2022), BNB 2024, Caixa etc.
- **FGV:** `conhecimento.fgv.br/sites/default/files/concursos/...` — prova + gabarito preliminar
  + gabarito definitivo + "gabarito após recursos". Ex. bancário: BANESTES.
- **Cebraspe:** portal do Cebraspe — provas + gabaritos preliminar/definitivo + anulações.
- **PCI Concursos** serve como **localizador/índice** das provas; baixar sempre que possível
  da banca original.
- **NÃO existe API pronta** de questões de concurso; o ENEM tem APIs abertas (só serve p/
  Português/Matemática gerais, não bancário).

## D3.2 — Formatos por banca (impacta o modelo de dados)
- **Cesgranrio e FGV:** múltipla escolha, **5 alternativas (A–E)**.
- **Cebraspe (CESPE):** **Certo/Errado (C/E)** — formato diferente, tipicamente 120 itens, com
  regra "uma errada anula uma certa" e muitas **questões anuladas**. (A gestão de risco do
  C/E é, ela própria, conteúdo do currículo "fazer a prova".)
- Consequência: o schema guarda `tipo_questao` = `multipla_escolha` | `certo_errado`, e trata
  **gabarito definitivo** + flag `anulada`.

## D4 — Pipeline de ingestão (o que é automático vs manual)
Ordem de produção (roda nos bastidores; **Batch API do Claude = 50% de desconto** para volume):
1. **Catálogo-alvo** *(manual + apoio de IA)*: montar a lista dos concursos bancários das 3
   bancas (~10 anos). Localizar os PDFs de prova+gabarito. — parte mais manual, pois cada banca
   organiza o site de um jeito.
2. **Download dos PDFs** *(automático)* uma vez que as URLs estão no catálogo.
3. **Extração** *(automático — Claude)*: Claude lê o PDF nativamente (document block; até 600
   páginas/requisição; OCR/visão de alta resolução embutidos) e devolve **JSON estruturado**
   (saída estruturada por schema): enunciado, alternativas, número, matéria/tópico sugerido,
   dificuldade estimada, `confianca` do parser, e figuras/tabelas detectadas.
4. **Cruzamento com gabarito** *(automático)*: parsear o PDF de gabarito → mapear número→resposta
   → preencher `resposta_correta`; marcar `anulada` quando for o caso; usar sempre o **definitivo**.
5. **Classificação/taxonomia** *(automático + curadoria)*: alinhar cada questão ao **edital
   verticalizado** (matéria → tópico). A taxonomia é curada por nós uma vez e reusada.
6. **Deduplicação** *(automático)*: usar embeddings para achar questões repetidas entre anos.
7. **Controle de qualidade (D6)**.
8. **Explicações** *(automático + revisão)*: Claude gera comentário **com grounding + citação**;
   áudio (TTS) vem depois (feature de áudio, sessão futura).
9. **Embeddings + índice** *(automático)*: gerar vetor, salvar, indexar (HNSW).
10. **Publicação** *(feature flag)*.
**Orquestração:** começar em **código (Next.js + scripts/Batch API)**; migrar os fluxos que
mudam muito para **n8n** quando a fábrica crescer. Partes **inerentemente manuais**: montar o
catálogo-alvo, localizar PDFs sem link estável, curar a taxonomia, revisão por amostra, aprovar
inéditas.

## D5 — Armazenamento e schema (Supabase / PostgreSQL + pgvector)
Tabelas principais (nomes provisórios):
- `bancas` (Cesgranrio, FGV, Cebraspe…) · `orgaos` (BB, Caixa, BNB…) ·
  `concursos` (banca, órgão, ano, cargo, edital) · `provas` (concurso, tipo/versão da prova,
  `pdf_prova_url`, `pdf_gabarito_url`, `status_ingestao`).
- `materias` · `topicos` (hierárquico = edital verticalizado).
- `questoes`: `prova_id` (proveniência), `numero`, `tipo_questao`
  (`multipla_escolha`|`certo_errado`), `enunciado`, `alternativas` (jsonb; null p/ C-E),
  `resposta_correta` (`A`–`E` ou `C`/`E`), `materia_id`, `topico_id`, `dificuldade`,
  `anulada` (bool), `gabarito_versao`, `origem` (`real`|`gerada_ia`),
  `status` (`rascunho`|`em_revisao`|`publicada`|`rejeitada`), `confianca_ia`,
  `imagens` (jsonb → arquivos no Supabase Storage), `fonte_citacao`,
  **`embedding` (vector, índice HNSW)** e **`fts` (tsvector em português)** → **busca híbrida**
  (palavra + significado).
- `explicacoes` (questao_id, texto, `audio_url`, `fontes_citadas` jsonb, gerada_por, revisada).
- `questao_revisoes` (auditoria da revisão humana).
- (Futuro, "coluna vertebral" do aluno) `tentativas` liga usuário↔questão↔acerto/erro/tempo/causa
  — alimenta plano, caderno de erros e Raio-X. (Detalhar em sessão futura.)
**Embeddings:** provedor recomendado **Cohere embed-v4** (melhor multilíngue/português) —
alternativa **Voyage** (parceiro da Anthropic). Guardar `modelo_embedding` + dimensões; trocar
depois = re-embeddar (barato, scriptável). Anthropic **não** faz embeddings.

## D6 — Controle de qualidade: MISTO POR FONTE (decidido)
- **Questões reais:** checagem automática (resposta extraída x gabarito oficial) + revisão
  humana **só por amostra** e nos casos de **baixa confiança** do parser.
- **Questões geradas por IA:** **100% revisão humana** no início; afrouxar conforme a acurácia
  comprovada sobe.
- Todo item publicado tem `status` e trilha em `questao_revisoes`. Aluno pode **reportar erro**
  (loop de correção contínua).

## D7 — Grounding + citação (não ensinar errado)
- **Extração** usa saída estruturada (JSON por schema). **Explicações** usam o recurso nativo de
  **citações do Claude** (localização por página/trecho na fonte). *Obs.: citações e saída
  estruturada não podem ser usadas na MESMA chamada → são chamadas separadas.*
- Para fatos de **Conhecimentos Bancários / Mat. Financeira**, montar aos poucos uma **base de
  conhecimento curada** (normas BACEN/CMN, materiais próprios) e fazer as explicações citarem
  essa base (RAG) — reduz "invenção" da IA. (Aprofundar na sessão da camada de IA.)

## D8 — Geração de questões inéditas
- Claude gera no **padrão da banca** (respeitando `tipo_questao`), etiquetada por matéria/tópico,
  marcada `origem='gerada_ia'`, e passa por **100% de revisão** (D6) antes de publicar.
- Serve para volume, "nível certo" (mais didático) e treino direcionado por causa de erro.

## D9 — Escopo/fases e custo
- **Fase 1 (decidida):** provas **bancárias** de **Cesgranrio + FGV + Cebraspe**, **~10 anos**
  (~2015→2025). Cobre o BB independentemente de qual banca vencer, e os estaduais.
- **Custo de API para montar o banco é BAIXO** (ordem de baixas centenas de R$/USD mesmo usando
  Opus via Batch + embeddings baratos). **O custo real é tempo de curadoria** (catálogo, taxonomia,
  revisão por amostra). ⇒ Alinhado com "esqueça 15k/tempo": otimizar por qualidade do banco.
- **Riscos/pendências:** localizar PDFs de provas antigas (links instáveis); qualidade de OCR em
  provas escaneadas antigas; validar a base legal com advogado antes de escalar; definir a base de
  conhecimento para grounding de Conhecimentos Bancários.

---

# CAMADA DE IA — a fundo (sessão de 2026-07-01, continuação)

## D10 — Arquitetura de custo: "pré-computa primeiro" (FECHADO)
**Decisão:** a IA roda **pré-computada** (gerada uma vez nos bastidores, guardada no Postgres,
servida a todos os alunos com custo marginal ≈ zero) em tudo, EXCETO a **única** superfície ao
vivo do lançamento: o **tutor de dúvidas (chat)** — e mesmo ele com trava.
- **Balde pré-computado (n8n + Batch API −50%, servido do banco):** explicações das questões;
  áudio TTS (1 vez por explicação, arquivo no Storage — nunca ao vivo); questões inéditas
  direcionadas por causa de erro (lote noturno → fila de revisão → publica por feature flag);
  plano diário adaptativo (**job agendado 1×/dia por aluno**, ou recálculo por regras em SQL sem
  IA); diagnóstico inicial (1 chamada por aluno na vida).
- **Balde ao vivo (chamada por aluno, com trava):** tutor de dúvidas — rate limit (N perguntas/
  dia), cache semântico (mesma pergunta na mesma questão reaproveita), modelo mais barato com
  contexto injetado (explicação pronta + trecho da base entram no prompt → o modelo só reformula).
**Racional:** custo de IA por aluno previsível e baixo (concentrado em 1 feature com trava, não
espalhado); o core (questões/explicações/plano) funciona mesmo se a API da IA cair; a fábrica
concentra o gasto no lado barato (Batch). Alinhado à rejeição de "wrapper genérico de ChatGPT".

## D11 — Modelos por tarefa (multi-modelo, equilíbrio qualidade×preço) — FECHADO (sócio pode vetar célula)
**Princípio durável (mais importante que o nome do modelo — o líder muda a cada semana):**
1. **Gateway de IA trocável:** cada tarefa aponta o modelo por config/feature-flag, com versão
   fixada + fallback. Claude vai pelo SDK direto da Anthropic (recursos nativos: Batch −50%,
   citações, PDF nativo — NÃO expostos via OpenRouter). Modelos baratos vão via OpenRouter.
2. **Eval cego de PT-BR próprio:** ~50 questões com gabarito de "explicação boa", rodado
   automático em qualquer modelo candidato. É o porteiro de qualidade — não leaderboard (medido
   em inglês/código). Só entra no lugar sensível quem passa.

**Matriz (preços jul/2026, por 1M tokens, entrada/saída — voláteis):**

| Tarefa | Onde | Modelo | Escalar/Trocar | Por que o equilíbrio |
|---|---|---|---|---|
| Extração PDF → JSON | lote (Batch) | **Claude Sonnet 5** ($3/$15) | Opus 4.8 em páginas baixa confiança | fosso; PDF nativo + citação + fidelidade; barato não tem visão de doc confiável |
| Classificação matéria→tópico | lote | **DeepSeek V4 Pro** ($0,435/$0,87) | GLM 5.2 | erro polui Raio-X/plano → modelo médio forte, não o Flash |
| Dedup | lote | **Cohere embed-v4** (D5) | Voyage | embedding, fora da disputa de chat |
| Rascunho de inéditas | lote | **GLM 5.2** ($0,94/$3) | DeepSeek V4 Pro | rascunho melhor = menos tempo de revisor (custo real, D9); vale > que o Flash |
| Explicação final publicada | lote | **Claude Sonnet 5** + citação | Opus 4.8 em Mat. Financeira | prosa que o aluno lê; qualidade PT-BR máxima; cacheada (custo 1×) |
| Tutor de dúvidas | **ao vivo** | **Claude Haiku 4.5** ($1/$5) | barato (DeepSeek V4/GLM 5.2) SE passar no eval PT-BR | cara do aluno + LGPD (dado do aluno) + cache; só reformula explicação pronta |
| Diagnóstico inicial | job (1×/aluno) | **Claude Sonnet 5** | — | 1× por aluno, custo desprezível, define o plano → vale a qualidade |
| Texto do plano diário | job (1×/dia/aluno) | **DeepSeek V4 Flash** ($0,098/$0,196) | Haiku 4.5 | lógica é SQL/regras (sem IA); IA só escreve a frase curta → baixo risco, volume diário |

**Fora desta matriz (decisões próprias):** TTS/áudio (provedor de voz, não LLM de chat) e a base
de conhecimento para grounding — próximas perguntas da sessão.

## D12 — Conferência da explicação ("não ensinar errado") — ✅ FECHADO (D12.1 + D12.2 + D12.3)
**Esclarecimento importante (levantado pelo sócio — refina o D7):** grounding **NÃO** é para a
questão nem para o gabarito. Esses são **oficiais**: o enunciado vem da prova real e a resposta
correta vem do gabarito oficial cruzado (D4) — a IA **não** decide qual alternativa é a certa.
Grounding protege **a EXPLICAÇÃO** (o "porquê", que é sempre gerado pela IA — D3) e o **tutor ao
vivo**. Vale para explicações de questões **reais E inéditas**: mesmo numa questão real com
gabarito oficial, a IA ainda escreve o porquê — e é aí que ela pode inventar (ex.: citar uma
Resolução do BACEN que não diz aquilo). É o "não ensinar errado".

**Proposta na mesa (pendente decisão do sócio):** dois trilhos de grounding, não um.
1. **Trilho "norma citável"** (Conhec. Bancários, Atualidades, Atendimento, Informática): **RAG**
   (a IA busca o trecho real numa base sua e cita) sobre corpus de **fontes primárias oficiais**
   (BACEN/CMN/CVM — públicas, mesma lógica legal do D3) + material próprio, com citação obrigatória.
2. **Trilho "cálculo verificado"** (Mat. Financeira, Matemática, RLM): passo a passo numérico com
   o resultado **conferido por código** (execução determinística que valida o número). RAG não
   resolve erro de conta. Sem citação de norma.
- Construção priorizada pela **frequência do banco de questões** (o que mais cai, primeiro; não
  cobrir tudo no dia 1).
**Alternativa (rejeitável):** um único trilho RAG para tudo — mais simples, mas não protege contra
erro de conta em Mat. Financeira, que é um dos dois ganchos do produto.

---

### D12.1 — Conferência da explicação é PRÉ-COMPUTADA, não ao vivo (FECHADO — sócio bateu o martelo, 2026-07-02)
> "Grounding" traduzido para linguagem leiga: **impedir a IA de ensinar coisa errada na explicação
> e no chat.** A resposta certa vem do gabarito oficial (a IA não decide); o risco é só na
> EXPLICAÇÃO (o "porquê", escrito pela IA) e no tutor ao vivo.

**Decisão:** a conferência da fonte da explicação é feita **1× na fábrica** (no pipeline em lote,
junto da geração da explicação — D4 passo 8), **nunca** a cada abertura de questão. A referência
conferida fica gravada com a explicação (`explicacoes.fontes_citadas`). O **tutor ao vivo NÃO faz
busca própria** — serve a explicação + fonte **já aprovadas** (coerente com D10). **Não haverá
sistema de busca ao vivo no lançamento**; se um dia o tutor precisar responder além da explicação
pronta, reavaliar busca ao vivo como decisão futura.

**Dois tipos de erro → duas defesas (confirmadas pelo sócio, na linguagem dele):**
1. **Regra/fato errado:** obrigar a IA a **citar de onde tirou** e **entregar a ela um material
   próprio** de onde ela deve extrair o conteúdo. → o QUE entra nesse material = **D12.2 (aberto)**.
2. **Conta errada:** **verificar o número por execução de código** (rodar a própria conta num
   programa e comparar com o que a IA escreveu). Correção registrada: **não** é uma "API de conta"
   pronta; é código nosso executando de forma determinística. → mecanismo exato = **D12.3 (aberto)**.

**Em aberto:** D12.2 (corpus/base de referência: o que entra e como construir) e D12.3 (como a
conta é verificada por código).

---

### D12.2 — Como a IA recebe o material + o que entra na base de referência
**Parte A — mecanismo (FECHADO, 2026-07-02):** a explicação é escrita pelo **Caminho 3** — a gente
**entrega o documento certo** junto com a questão e a IA escreve **só com base nele** (raciocina e
redige livremente, mas todo **fato/número/regra** que afirmar tem que estar no material entregue, e
ela cita de onde tirou; se não está no material, não afirma). Descartados: **Caminho 1** (deixar a
IA pesquisar/usar só a memória dela → é onde ela inventa; é o "ChatGPT genérico" já rejeitado) e
**Caminho 2** (humano escrever a explicação inteira → não escala; só exceção rara de questão muito
difícil e muito frequente). O documento certo chega **por etiqueta de assunto (3a)**: a questão já
vem classificada por tópico no pipeline (D4 passo 5) e a base de referência é organizada pelos
mesmos tópicos → casamento automático e previsível. Busca por similaridade (3b) fica **só de
reforço**, quando a etiqueta de assunto não bastar.
**Parte B — conteúdo da base (FECHADO, 2026-07-02 — Jeito B):** cada assunto do edital tem um
documento na base; ele é **oficial quando existe** (aponta/cita a norma real — Pix, FGC, sigilo
bancário LC 105, lavagem Lei 9.613 etc.) e um **resumo curto escrito por nós e conferido** quando
**não existe** norma oficial limpa (o que é CDB, LCI×LCA, crédito rotativo, noções de mercado).
Descartado "só oficial" (deixaria a IA muda em ~metade da matéria → volta a inventar, bem onde mais
dói). Custo controlado por: (1) construir **por frequência** (assuntos que mais caem primeiro —
sinal vindo do próprio banco de questões, reusa o Raio-X); (2) **IA rascunha, humano confere**
(custo vira "validar", não "escrever do zero"). A base própria vira **ativo** revisado (como o
banco de questões); resumo nosso errado = IA cita nosso erro com confiança → revisão obrigatória
com trilha em auditoria.
### D12.3 — Verificação de conta por código (FECHADO, 2026-07-02)
**Decisão:** questão quantitativa (Mat. Financeira, Matemática, RLM) só publica se o número for
**calculado por um programa de verdade** (não "de cabeça" da IA) e passar num **cruzamento duplo**:
(1) o resultado executado **bate com a alternativa correta oficial** (gabarito cruzado, D4) **e**
(2) o número **escrito na explicação** é igual ao executado. Falhou → **não publica**: **refaz
automático 1×; se falhar de novo, vai pra fila de revisão humana**.
**Onde o código roda:** começar com a **ferramenta de execução de código da Anthropic** (Python em
container isolado; faixa grátis grande + ~US$0,05/container-hora além dela — jul/2026, reconfirmar)
durante a geração; manter **sandbox próprio rodando o código emitido** como plano B (princípio
"gateway trocável", D11). Combina com os dois trilhos: rail "conta" usa execução de código e **não**
usa citação de norma; rail "fato" usa documento injetado + citação (D12.2) — chamadas separadas.
**Bônus:** vira **detector de erro gratuito** do banco de quantitativas — se a conta honesta não
alcança o gabarito, algo está errado (método, extração dos números, ou questão anulada) → sinaliza.

---

### D13 — Feedback do aluno na explicação (FECHADO, 2026-07-02)
**Decisão:** **dois sinais SEPARADOS**, e **nenhum muda a explicação automaticamente** — a verdade
continua = **gabarito oficial + verificação por código (D12.3) + base revisada (D12.2)**; o
feedback do aluno **só dispara revisão humana**.
1. **"Foi útil?"** (👍/👎) = satisfação → agregado por explicação → prioriza quais melhorar +
   alimenta o **eval cego de PT-BR** (D11) com sinal real de qual modelo escreve melhor + vira
   **ativo de dados** (flywheel).
2. **"Reportar erro"** (campo curto "o que está errado?") = denúncia → **fila de revisão**, com
   **prioridade quando vários alunos apontam a mesma questão**; humano decide; correção reaproveita
   a trilha de auditoria (D6).
**Armadilha registrada:** o aluno **não é autoridade sobre correção** (muito "está errado" = aluno
que errou e não aceita) → voto do aluno nunca sobrepõe gabarito/código/base.
**Schema** (aluno ↔ explicação ↔ feedback) detalhado junto da **coluna vertebral** (Tema 2) e do
**flywheel/LGPD** (Tema 4).

---

### D14 — Áudio (TTS) das explicações — arquitetura FECHADA; voz por teste cego (2026-07-02)
**Contexto:** áudio gerado **1× por explicação** e guardado no Storage (D10) → **latência não
importa** → usar o modelo de **MÁXIMA qualidade** (não o "fast/flash", que existe pra chat ao
vivo). Custo é **único e baixo** (banco de lançamento ~milhares de explicações; ordem de centenas
de USD, uma vez) → como orçamento está fora da discussão, **qualidade manda**.

**Parte A — escolha da voz (método FECHADO; pick = tarefa prática):** a voz sai de um **teste cego
de escuta** (irmão do eval de PT-BR do D11), sobre 3–4 explicações reais cheias de número/R$/%/
sigla, pontuando **quem lê o número/termo financeiro certo** — não por ranking (mede inglês). Uma
**voz só**, consistente, atrás de uma **camada de voz trocável** (princípio "gateway trocável",
D11). Candidatas atuais (jul/2026 — reconfirmar; preços por 1M de caracteres / grátis p/ teste):
ElevenLabs Multilingual (~$100 / ~10k mês), Google **Chirp 3 HD** ($30 / **1M mês**), OpenAI
gpt-4o-mini-tts (~$15 / sem free), **Fish Audio** (~$15, nº1 ranking 2026 / trial), Amazon Polly
Generative/Neural voz Camila (~$16 / 1M mês no 1º ano), Azure Neural pt-BR voz Francisca (~$15 /
500k mês). ElevenLabs é 3–6× mais cara → só ganha se a qualidade justificar.

**DECISÃO (2026-07-02, após teste real de 19 vozes com o texto normalizado):** provedor **HÍBRIDO**
— **ElevenLabs (modelo `eleven_v3`) como voz principal**; um provedor **mais barato** fica como
alternativa na camada trocável (Fish Audio `s2.1-pro` ou OpenAI `gpt-4o-mini-tts`) para quando
quisermos baratear. A **voz específica ainda NÃO foi escolhida** — as **8 vozes ElevenLabs testadas
ficam como candidatas** (Voice IDs abaixo). Amostras geradas em `experiments/tts-comparacao/out/`
(2 explicações × 19 vozes).
- **8 vozes ElevenLabs candidatas (Voice IDs):** `Qrdut83w0Cr152Yb4Xn3`, `ORgG8rwdAiMYRug8RJwR`,
  `tS45q0QcrDHqHoaWdCDR`, `CstacWqMhJQlnfLPxRG4`, `YNOujSUmHtgN6anjqXPf`, `33B4UnXyTNbgLmdEDh5P`,
  `lWq4KDY8znfkV0DrK8Vb`, `ycxdm1PRMs962FxyyuJ0`.
- **Fallback barato testado:** Fish `s2.1-pro-free` (7 vozes, reference_ids em
  `experiments/tts-comparacao/`) e OpenAI `gpt-4o-mini-tts` (coral, onyx, nova, shimmer).
- **Confirmado no teste:** com texto normalizado (número por extenso) o erro de número some em
  todos → o desempate vira naturalidade/sotaque/leitura de siglas. Custo real da rodada: ElevenLabs
  **3.504 caracteres** (header `character-cost`); OpenAI ~centavos; Fish `s2.1-pro-free` ≈ US$0.
- **Pendência prática (não bloqueia o produto):** escolher **1 voz ElevenLabs** entre as 8 + fixar
  **qual provedor barato** de fallback.
- **Ferramenta de teste reaproveitável:** `experiments/tts-comparacao/` (script `compare.mjs`,
  aceita várias vozes por provedor; será reusada quando surgir voz/modelo novo).

**Parte B — pipeline de áudio (FECHADO, confirmado pelo sócio):**
1. **Normalização antes da voz:** passo que transforma número/símbolo em palavra ("R$ 1.250,00" →
   "mil duzentos e cinquenta reais"; "12,5%" → "doze vírgula cinco por cento") e expande um
   **dicionário de termos/siglas** (CDB, LCI, Selic, IOF, FGC, BACEN, Pix...). Protege a qualidade
   do áudio num produto bancário; ranking de voz não cobre isso.
2. **Escopo:** áudio só de explicações **publicadas**, gerado **por frequência** (as que mais caem
   primeiro; não 100% no dia 1), **amarrado à versão da explicação** — se o texto muda (correção
   por feedback/código, D12.3/D13), o áudio antigo é descartado e refeito.

**Ação prática pendente (não bloqueia o Tema 1):** rodar o teste cego de escuta entre as candidatas
e travar a voz. Preparar texto-teste ("pior caso" de número/jargão) + script que chama cada API.

---

# COLUNA VERTEBRAL DO ALUNO — Tema 2 (sessão de 2026-07-02)

> O histórico de respostas do aluno é o coração do produto: alimenta diagnóstico, plano diário,
> caderno de erros, Raio-X e o flywheel de dados. Concretiza o gancho deixado no D5.

## D15 — `tentativas` é registro de eventos IMUTÁVEL + telas calculadas por cima (FECHADO, 2026-07-02)
**Decisão:** cada resposta do aluno vira **uma linha permanente** em `tentativas`, que **só recebe
INSERT — nunca UPDATE, nunca DELETE por edição**. A tabela é a **fonte da verdade crua**. Tudo que é
"estado atual do aluno" — domínio por matéria/tópico, caderno de erros, Raio-X da banca, sequência de
hábito — **não é guardado como número solto**: é **calculado por cima do log** por um job (tabela
materializada / projeção) e pode ser **reconstruído do zero a qualquer momento**. Rejeitado o "Jeito 1"
(guardar só o placar e ir sobrescrevendo): é mais fácil no começo, mas descarta os fatos crus → impede
reprocessar o passado quando a fórmula do diagnóstico melhorar → teto permanente no motor adaptativo e
no flywheel.

**Snapshot obrigatório na linha (defesa contra reclassificação):** no momento da resposta, copiar para
a própria `tentativa` a etiqueta do assunto **congelada** — `materia`, `topico`, `banca`,
`tipo_questao`, `dificuldade`, `origem` — além do `questao_id`/`questao_versao`. Se o pipeline (D4)
reclassificar a questão depois, o histórico do aluno **não se desloca**: o passado continua contando
como era no dia.

**Por que é a melhor ideia (verificado por pesquisa, 2026-07-02, não é opinião solta):**
1. **Domínio (estudo adaptativo):** *knowledge tracing* — a técnica que estima o que o aluno sabe —
   consome como entrada a **sequência ordenada de cada resposta no tempo**. Sem o log resposta-a-resposta,
   esses modelos nunca rodam. Jeito 1 = teto permanente.
2. **Padrão de mercado edtech:** o formato oficial de registro de aprendizado (**xAPI / LRS**) grava
   cada interação como **registro imutável** (não edita nem apaga, só "anula"). É o Jeito 2 virado norma.
3. **Engenharia de software:** o padrão tem nome — *event sourcing* (guardar eventos) + *read models*
   (telas calculadas). Recomendado exatamente quando se quer auditoria, **reprocessar histórico** e
   **vários relatórios saindo da mesma base** — nosso caso (plano, caderno, Raio-X, flywheel = 4 leituras
   do mesmo log).

**Nossa stack aguarda (confirmado via Context7/Supabase):** Postgres particiona a tabela por mês
automaticamente (`pg_partman`) → cresce pra sempre e continua rápida; visões materializadas guardam os
resumos; índices definidos **desde o início**. Sem parede técnica.

**Custos assumidos conscientemente (o que isso cobra lá na frente):**
- **Camada calculada obrigatória desde o dia 1:** o log cru não mostra nada ao aluno; um job transforma
  em "domínio 62%". Mais peças móveis — e o maior risco operacional passa a ser **manter as projeções em
  dia e corretas** (não a pilha de eventos em si).
- **Placar com pequeno atraso:** o número "quanto sei" é recalculado por job, não a cada clique
  (coerente com D10 — pré-computa; nada de recálculo ao vivo).
- **Maior tabela do sistema, só cresce:** exige particionar por mês + índices certos **desde o começo**.
- **LGPD (liga ao Tema 4):** "imutável" = não **reescrever** o fato; **não** impede apagar. Direito ao
  esquecimento = `DELETE` de todas as linhas do `user_id`. Imutabilidade e exclusão legal convivem.
- **Disciplina de time:** ninguém dá `UPDATE`/`DELETE`-por-edição numa tentativa. Correção = linha nova
  ou anotação em tabela vizinha.

**Núcleo mínimo da linha `tentativas` (provisório — refina no PRD):**

| grupo | campos | por quê |
|---|---|---|
| quem/o quê | `user_id`, `questao_id`, `questao_versao` | liga aluno↔questão↔versão do enunciado |
| **snapshot congelado** | `materia`, `topico`, `banca`, `tipo_questao`, `dificuldade`, `origem` | história sobrevive à reclassificação (D4) |
| contexto | `sessao_id`, `contexto` (diagnóstico/plano/treino livre/simulado/revisão) | separa "chutou no simulado" de "errou estudando" |
| resultado | `resposta_dada`, `correta` | o fato objetivo |
| sinais crus (no insert) | `tempo_ms`, `marcou_chute` | matéria-prima da causa do erro (D16) |
| enriquecido depois (nulo no insert) | `causa_erro`, `causa_origem` | preenchido por auto-relato/heurística/IA **sem alterar o fato** |
| tempo | `respondida_em` | ordena a sequência (entrada do knowledge tracing) |

**Projeções recalculáveis por cima (não são fonte da verdade):** `dominio_topico`
(user↔tópico↔score↔n_tentativas), caderno de erros (consulta sobre `correta=false` + `causa_erro`),
Raio-X da banca (agrega por banca/tópico/frequência), hábito/streak. Todas reconstrutíveis do log.

**Em aberto (próxima decisão — D16):** de onde vem a **causa do erro** — o aluno marca (auto-relato),
o sistema deduz (heurística por tempo/alternativa escolhida), ou a IA classifica — e **quão detalhada**
precisa ser a taxonomia de causa para o caderno de erros valer sem virar burocracia.

## D16 — Causa do erro: auto-relato obrigatório do aluno, taxonomia enxuta (FECHADO, 2026-07-02)
**Decisão:** a causa de cada erro vem do **auto-relato do aluno** (ele marca por que errou), e é
**obrigatório ao errar** — porém com **"não sei dizer"** como opção válida (não é um pulo). É o aluno
que preenche `causa_erro` (D15); `causa_origem = 'aluno'`.

**Rejeitada a dedução automática como fonte principal** (levantado pelo sócio, decisivo): **não dá para
deduzir 100%** a causa a partir da alternativa marcada — quem marca "B" pode ter marcado por qualquer
motivo, não necessariamente a confusão que o distrator representa. Logo a dedução seria só **palpite**,
nunca verdade, e o aluno é o único que sabe o que passou na cabeça dele. O **"mapa de distratores"**
(significado pré-computado de cada alternativa errada) fica **rebaixado a enriquecimento opcional e
futuro** — pode nem valer construir; se um dia entrar, só adiciona o *detalhe* de "quais dois conceitos"
ao botão "confundi conceitos", nunca como sentença. Coerente com D13 (aluno = sinal, não autoridade).

**Moldura anti-lixo (para "obrigar" não gerar cliques aleatórios):**
1. **"Não sei dizer" é opção legítima** — obrigado a responder, não a inventar.
2. **Fechar o ciclo:** mostrar ao aluno que a resposta mexeu no plano de verdade ("marcou 'errei a conta'
   3× essa semana → treino de cálculo amanhã") → ele leva a sério em vez de clicar no automático.
3. **Momento:** modo **treino** = pergunta na hora do erro; **simulado** = coletada na **revisão
   pós-prova** (no simulado o gabarito só aparece no fim, não se interrompe a prova).

**Princípio da taxonomia (durável):** só registra uma causa se ela **dispara uma ação diferente no
plano** — senão é burocracia. Lista que o aluno vê (**6 causas + "não sei"**), cada uma amarrada a um
remédio distinto:

| Botão que o aluno vê | Remédio que o plano dispara (mecanismo exato = D17) |
|---|---|
| Não sabia o conteúdo (nunca vi / não lembrava) | reestudar a teoria do tópico |
| Sabia, mas errei a conta | treino de cálculo — **não** reestudar teoria |
| Entendi errado o enunciado (li com pressa / interpretei mal) | treino de leitura de comando |
| Confundi dois conceitos parecidos | revisar aquela confusão específica |
| Sabia, mas fiquei na dúvida e mudei (me traí) | reforço + estratégia de confiança |
| Chutei / não fazia ideia | conta como lacuna, mas registra que foi chute |
| Não sei dizer | fica em aberto (saída honesta; nunca sentença) |

**Só no simulado**, entra mais uma (só faz sentido com relógio): **"Faltou tempo / me apressei"** →
estratégia de prova.

**Custo honesto assumido:** no começo o dado de causa vem **incompleto e um pouco enviesado** (o aluno
às vezes marca "não sei" ou se protege) → o caderno de erros arranca mais fraco e encorpa com o tempo.
Aceitável: troca "perfeito no dia 1" por "no ar rápido".

**Em aberto (próxima decisão — D17):** o **motor adaptativo** — como o diagnóstico inicial e o plano
diário **usam** essas causas + o log de `tentativas` (D15) para montar a tarefa de cada dia.

## D17 — Diagnóstico inicial: teste curto adaptativo-simplificado + recalibração contínua (FECHADO, 2026-07-02)
**Decisão:** quando um aluno novo entra, o retrato do que ele sabe vem de um **teste curto adaptativo-
simplificado**, **opcional (pulável)**, que serve só de **semente** — o retrato é **recalibrado pra
sempre** pelo log de `tentativas` (D15). Verificado por pesquisa (2026-07-02): teste adaptativo dá
medida confiável com **8–12 questões por área** (não precisa dos 60–100 de uma prova longa, que só
aumenta desistência); os melhores produtos (Duolingo/Khan) **não forçam** teste na entrada — perguntam a
meta, deixam o teste opcional, entregam vitória rápida; e "partida a frio" é inevitável (qualquer
estimativa é grosseira nas primeiras respostas → recalibrar do log é obrigatório, não opcional).

**PEGA da pesquisa (assumido):** teste adaptativo "de livro" (IRT) exige a **dificuldade real** de cada
questão, medida em **centenas de alunos reais** — que **não temos no lançamento** (o banco só tem
dificuldade **estimada pela IA**, D5). Logo, dia 1 roda **adaptativo-simplificado** (regra: acertou →
sobe a dificuldade estimada; errou → desce), e a **dificuldade real se calibra sozinha** conforme os
alunos respondem (o log D15 acumula acerto real por questão). Essa calibração vira **ativo da plataforma
toda** (usada em simulado, plano e geração de inéditas D8).

**Fluxo completo (do clique de entrada ao início do estudo):**
1. **Antes (~1 min, sem IA):** pergunta a **meta** (concurso/BB, data, tempo/dia) — personaliza e é a
   vitória rápida da entrada. Oferece o teste **com opção de pular declarando o nível** (iniciante/
   intermediário/avançado = semente grosseira; pode testar depois). Ninguém é obrigado a fazer prova pra
   entrar.
2. **Teste (~10 min): ~20 questões** (dial ajustável) — **~7 Mat. Financeira + ~7 Conhec. Bancários**
   (os ganchos, onde vale medir bem) + **1–2 em cada outra matéria** (Português, Matemática, Informática,
   Atualidades, Atendimento) só pra não começar no escuro. Questões **reais do banco** (fosso, já
   classificadas). Começa em nível médio; adapta a dificuldade a cada resposta. Cada resposta = uma
   `tentativa` com `contexto='diagnostico'` (D15), corrigida pelo gabarito oficial. **NÃO pergunta causa
   do erro (D16)** — aqui o foco é medir, não incomodar; a causa entra depois, no treino.
3. **Depois:** o sistema monta o **retrato inicial** (nível estimado por matéria/tópico = primeira tela
   calculada por cima do log). Entra a **única chamada de IA por aluno** (D10/D11, Claude Sonnet): ela
   **não corrige nem mede** — **lê** o retrato + a meta + o Raio-X (o que mais cai) e **escreve o plano
   inicial**, priorizando o que é **fraco E cai muito**. O aluno vê (a) o retrato como **ponto de
   partida**, não veredito (nada de "você sabe 43%") e (b) o **plano do 1º dia/semana já montado** →
   começa a estudar com um caminho na mão.
4. **Dali em diante:** o retrato **nunca congela** — cada resposta no uso normal recalibra o nível do
   aluno e a dificuldade real das questões; o plano diário (D18) roda 1×/dia lendo o retrato atualizado.
   Se o aluno pulou o teste, o plano arranca do nível declarado + prioridade do Raio-X e calibra rápido.

**Efeito cascata (por que essa decisão importa além dela mesma):** semeia o **plano diário** (estado
inicial, D18); dispara a **calibração de dificuldade real** que beneficia simulado/plano/inéditas;
fornece o eixo "onde **você** é fraco" que o **Raio-X** (Tema 3, eixo "o que mais **cai**") multiplica;
manda **mostrar progresso como ponto de partida, não veredito** (Tema 4); cada resposta alimenta o
**flywheel** (D15 + knowledge tracing futuro); e curto+pulável **protege a ativação/conversão** (Tema 5).

**Em aberto (próxima decisão — D18):** o **plano diário** — a lógica que, lendo o retrato + o Raio-X +
as causas de erro, monta a tarefa de cada dia (job 1×/dia, D10; regras/SQL, IA só escreve a frase, D11).

## D18 — Plano diário: motor de prioridade + blocos + revisão espaçada adaptativa (FECHADO, 2026-07-02)
**Decisão:** o plano diário roda **1×/dia** (job, D10), com a **lógica de o-quê-estudar em regra/SQL**
(a IA só escreve a frase de abertura, D11), e **orquestra as duas técnicas de estudo com mais evidência
científica** (ver `EVIDENCIAS-CIENTIFICAS.md`): **resolver questões** (recordação ativa) e **revisão
espaçada**. Verificado por pesquisa (2026-07-02): a maior meta-análise de técnicas de estudo (Donoghue &
Hattie 2021, 242 estudos, 169 mil pessoas) aponta essas duas como as **mais eficazes** — que são
exatamente os eixos do produto; e o mundo dos concursos converge no mesmo (resolver questões = "eixo
estrutural" + revisão espaçada + ciclo de estudos).

**1. Motor de prioridade (escolhe O QUE estudar):** nota por tópico = **quanto cai (Raio-X, Tema 3) ×
quão fraco o aluno é (retrato/log D15) × quão "devendo revisão" está** (agenda de revisão espaçada).
Escolhe os de maior nota que **cabem no tempo/dia** que o aluno declarou. Na prática é o **"ciclo de
estudos"** que aprova em concurso — só que movido a dado, não a agenda manual.

**2. Tarefa em blocos fixos (cada bloco = uma técnica comprovada):**
| Bloco | Técnica | O que é |
|---|---|---|
| **Revisar** | revisão espaçada + recordação ativa | questões dos tópicos "vencendo" + erros do caderno, **misturando assuntos** (intercalação) |
| **Avançar** | aprendizado em bloco | tópico novo/fraco prioritário, estudado concentrado (teoria + questões do tema) |
| **Treinar** | recordação ativa + intercalação | leva de questões de **tipos e assuntos misturados** |
| **Simulado (1×/semana)** | teste de prática sob pressão | formato que a ciência aponta como o que mais firma pra prova |

**3. Intercalação (misturar assuntos):** evidência = intercalar **piora o curto prazo, melhora retenção/
transferência**. Por isso **conteúdo novo = bloco concentrado** ("Avançar") e **revisão/treino =
misturados** ("Revisar"/"Treinar"). O produto tem que **explicar** isso ao aluno (misturar parece mais
difícil na hora), senão ele acha que está indo mal.

**4. Revisão espaçada = adaptativa estilo FSRS (não a régua fixa):** o FSRS (default do Anki hoje)
calcula **por aluno e por assunto** quando ele está prestes a esquecer e traz a revisão nesse ponto —
**20–30% menos revisões para a mesma retenção** que a régua antiga (o tempo limitado do aluno rende
mais). **PEGA cold-start (igual ao D17):** FSRS precisa de histórico de revisões para se personalizar,
que não temos no lançamento → **começa com intervalos-padrão bons / régua clássica 1/3/7/14/30 como
piso** e **migra para FSRS personalizado conforme o log (D15) enche**.

**Custos honestos assumidos:** (a) a revisão espaçada às vezes manda **revisar em vez de avançar** →
sensação de lentidão → mitigar mostrando o porquê ("revisar hoje = não perder o que já conquistou");
(b) intercalação parece mais difícil na hora → o produto explica; (c) o FSRS só fica bom com uso.

**Fecha o Tema 2 (coluna vertebral).** O **caderno de erros** não é decisão própria: é uma projeção por
cima do log (D15) filtrada por `correta=false` + `causa_erro` (D16), e já alimenta o bloco "Revisar".
Detalhes finos (parâmetros FSRS default, tamanho de cada bloco) ficam para o PRD/spec — não bloqueiam.


---

# RAIO-X DA BANCA — Tema 3 (sessão de 2026-07-03)

> O Raio-X responde **"quanto cada assunto cai na prova"** — é o fator **"quanto cai"** que o plano
> diário (D18) multiplica pela fraqueza do aluno (retrato/log D15). É uma **projeção calculada por cima
> do banco de questões** (mesma filosofia do D15: banco = verdade crua; Raio-X = tabela recalculável por
> cima, nunca congela). Trava do tema: a **banca do BB ainda não foi definida** (Cesgranrio × FGV ×
> Cebraspe) → o Raio-X precisa funcionar **antes** de saber a banca.

## D19 — Arquitetura do Raio-X: conteúdo-primeiro + multi-sinal + anti-viés (FECHADO, 2026-07-03)

**1. Conteúdo-primeiro (Jeito 2), banca como coluna.** O Raio-X é **um esqueleto único** = o edital
verticalizado da carreira bancária (matéria → tópico → subtópico, a taxonomia curada em D5). Para cada
tópico, o "quanto cai" existe **por banca** (uma coluna Cesgranrio, uma FGV, uma Cebraspe) penduradas no
mesmo esqueleto — **não** três mapas separados. **Rejeitado o "Jeito 1" (banca-primeiro):** três produtos
paralelos e o aluno do BB fica **sem Raio-X nenhum** até o edital sair — justo o público a capturar cedo.
Coerente com decisão de base (HANDOFF §2): o reaproveitável é o **conteúdo da carreira, não a banca**.

**2. Antes de saber a banca do BB — visão combinada em duas faixas:**
- **Núcleo:** tópicos que caem forte **nas três** bancas → prioridade máxima (acerta com qualquer banca
  que venha). É a maior parte do plano e o que dá robustez à indefinição.
- **Condicional:** tópico que cai forte em **só uma** → peso menor + rótulo "depende de quem for a banca".

**3. Três sinais separados, nunca um número opaco único (a frequência real MANDA):**

| Sinal | O que é | Peso | Quem produz |
|---|---|---|---|
| **Frequência real** | contagem das provas reais, **só `origem='real'`**, como **taxa** (% dentro daquela banca), ano recente pesa mais | **principal (fosso)** | automático (contagem do banco) |
| **Edital (porteiro)** | o tópico está no programa oficial? | liga/desliga | do edital |
| **Atualidade/tendência** | empurrão para assunto emergente (nova norma BACEN, Pix, Open Finance, DREX, tema quente) | pequeno, explícito | **pesquisa humana** (IA rascunha candidatos varrendo normas/notícias; humano confirma; trilha de auditoria, à la D12.2) |

Regras: frequência real manda; as outras **ajustam, não substituem**. Edital = porteiro (tópico no
programa não zera mesmo se nunca caiu; tópico fora do programa fica fora do plano). Empurrão de atualidade
é **registrado e reversível** (quem/porquê/quando) → achismo não vira frequência sorrateiramente.

**4. Anti-viés (armadilha levantada pelo sócio):** se o Raio-X contasse **todas** as questões, encher o
banco de **inéditas** (`origem='gerada_ia'`, D8) de um tópico inflaria o "quanto cai" artificialmente.
**Trava:** o Raio-X **só conta questão real** (`origem='real'`, campo já no schema D5); inédita gerada
serve para **treino**, nunca para medir frequência. E o número é **taxa** (% dentro das provas da banca),
não contagem bruta → mais provas de uma banca não distorcem.

**5. Guardar por linha (para não confundir sorte com tendência):** `n_questoes` (em quantas questões reais
a taxa se baseia → confiança "muito/pouco") e `tendencia` (direção recente: subindo/estável/caindo). Um
tópico com 3 aparições em 10 anos é frágil e precisa ser sinalizado como tal.

**6. Duas camadas do Raio-X — só uma é combinável:**
- **Conteúdo** (quais assuntos caem) → **combinável já** (é o item 2).
- **Formato/estilo** (Cesgranrio/FGV = múltipla escolha A–E; Cebraspe = Certo/Errado + regra "uma errada
  anula uma certa") → **não combina** ("não se treina meio C/E"); só resolve de vez quando a banca sair.

**7. Virada quando a banca do BB for anunciada (ex.: FGV):**
- **Dados = quase um botão:** as três colunas já existem (Jeito 2) → o plano passa a **ler a coluna da
  banca anunciada**. O "condicional" resolve na hora (alguns sobem, outros caem). Sem retrabalho.
- **Não explode o plano do aluno:** o **núcleo sobrevive** intacto; só a **borda condicional** se re-pesa
  — suavidade por construção, não por sorte.
- **Formato precisa estar pronto na gaveta para as três** (crítico se sair Cebraspe C/E): conteúdo de
  "fazer a prova" + formato de simulado prontos antes do anúncio.
- **Edital real do BB** sai junto → atualiza o "porteiro"; simulado passa a copiar formato/peso exatos.
- **Tratar como evento de produto / notícia boa:** "Saiu a banca: FGV. Seu plano já ajustou o foco." O
  anúncio do edital é o momento de pânico do concurseiro → virar a chave sozinho é conversão.
- **Risco registrado:** se o BB pegar a banca com **menos acervo** nosso (coluna fina, `n_questoes`
  baixo) → edital + atualidade pesam mais + aprender o **estilo** por provas dessa banca em **outros
  setores** (não bancário); o núcleo de carreira segue valendo.

**Em aberto (próxima decisão — D20):** o **peso entre os três sinais** — quanto atualidade e edital podem,
na prática, mexer na ordem que a frequência real definiu (só desempate vs. forte o bastante para colocar
um assunto que nunca caiu lá em cima quando a pesquisa disser que vem).

## D20 — Peso entre os sinais: porteiro + empurrão com teto + faixa nova-do-edital (FECHADO, 2026-07-03)
**Decisão (política; números exatos = afinação de PRD):**
1. **Edital = porteiro binário (liga/desliga), não intensidade.** Fora do programa → o assunto é **zero**
   (não entra no plano por mais que tenha caído no passado). Dentro → elegível. O edital filtra, não dá nota.
2. **Frequência real = motor da ordem** entre os elegíveis (ranqueia por padrão).
3. **Atualidade = empurrão com TETO.** Sobe um assunto emergente até uma faixa definida (aparece no radar),
   mas **não** o bastante para, de rotina, passar na frente dos que caem muito todo ano. Todo empurrão é
   **registrado/auditável** (quem, por quê).
4. **Faixa especial "novo no edital + sinalizado".** Assunto recém-incluído no edital tem frequência **zero
   por definição** (ainda não teve chance de cair) → entra direto numa **faixa alta**, mas **só** quando as
   duas coisas batem: está no edital **E** foi sinalizado na pesquisa. Estreito e explícito, não é override.

**Efeito nos exemplos:** *juros compostos* (cai muito) → topo pela frequência sozinha; *Pix ao entrar no
edital* (zero histórico + sinalizado) → faixa especial, alta prioridade; *hype de cursinho fora do edital*
→ porteiro zera (hype não vira plano).

**Risco assumido:** a faixa especial e o empurrão dependem de **julgamento humano** na pesquisa; se
sinalizar errado, o aluno gasta tempo num assunto que não veio. Mitigado: é conteúdo do edital de qualquer
forma (retido pela revisão espaçada, não é lixo) + teto (não domina o plano) + auditável (revisável).

**Rejeitados:** "só desempate" (seguro contra achismo, mas cego para assunto novo de alto valor — Pix,
IA, Open Finance); "atualidade pode dominar" (reabre a porta do achismo que o D19 fechou).

**Em aberto (próxima decisão — D21):** o **mecanismo de pesquisa de atualidades** (o "radar" que produz o
sinal #3 — como a IA varre fontes e propõe candidatos, com humano confirmando).

## D21 — Mecanismo do sinal #3 (atualidade): SEM radar de internet; edital + detecção grátis pelo banco + skim leve (FECHADO, 2026-07-03)
**Reconsideração pedida pelo sócio (não estava confiante no radar) → recomendação revista.**
**Rejeitado o radar automático de internet** (varredura de notícia): **máquina cara e ruidosa pra problema
pequeno e barulhento** — assunto novo de alto valor é um **filete** (punhado/ano) e **muito visível** (Pix,
IA ficam meses no noticiário antes de cair); o **edital é o sinal mais forte** e já é lido. Custo recorrente
(busca web + modelo julgando + curadoria de fonte + workflow n8n + triagem de ruído) **sem ganho real** sobre
um humano que lê notícia.

**Decisão — o sinal #3 sai de 3 camadas, quase de graça, todas na mesma coluna auditável (D19) com portão
humano + teto (D20):**
1. **Passagem de edital (âncora, humana, 1×/edital):** lê o edital novo contra a taxonomia, marca o que
   entrou/mudou → alimenta a **faixa especial do D20**. Maior valor e se faz de qualquer jeito.
2. **Detecção pelo banco (automática, ~R$0):** a classificação do D4 (passo 5) **já calcula confiança** →
   questão de baixa confiança / que não encaixa vira fila **"candidato a tópico novo"** com a prova de origem
   + exemplos. Sinal **real** (apareceu em prova de banco/órgão vizinho), quase sem falso positivo. Aqui a IA
   trabalha **pro humano**, não o contrário.
3. **Skim humano leve (opcional, mensal ~1–2h):** caso raro "fervendo antes de cair"; o humano nota (ex.: IA
   em alta em prova de tecnologia). Sem IA, sem infra — e humano é bom nisso (temas quentes são óbvios).

**Como o humano "passa pra IA" (esclarece dúvida do sócio):** NÃO é conversar com um robô. O **plano diário
é regra/SQL, não IA pensante** (D18) — ele só **lê um número**. O humano registra um item curto numa **tela de
curadoria** (assunto · situação "em alta" · empurrão dentro do teto D20 · nota do porquê), ~2 min. E na maior
parte das vezes ele **só confirma** um candidato que a camada 1 (edital) ou a camada 2 (banco) **já entregou**
— raramente parte do zero.

**Duas das três camadas não são sinal novo — são manter frescos os sinais que já existem:** camada 1 = manter
o **porteiro (edital)** em dia; camada 2 = deixar a **frequência real** achar o novo rápido. Só a camada 3 é
"atualidade" genuína, e é pequena.

**Rede dupla (tira a pressão do humano):** se esquecer de marcar um assunto, quando ele cair a **detecção pelo
banco** pega e a **frequência real assume** sozinha. O registro manual só **adianta** o que é muito quente —
não é a única rede.

**O que se constrói (mínimo):** persistir a flag de baixa confiança que o pipeline **já calcula** numa fila +
uma **tela de curadoria** (aprovar/rejeitar candidato + definir empurrão) — tela que já se quer pra manter a
taxonomia. **Sem scanner, sem busca web no lançamento.**
**Custo:** camada 1 = horas humanas; camada 2 = **~R$0** (reusa D4); camada 3 = R$0 de infra. Reavaliar um
**resumo automático barato** só se o skim virar peso real de tempo — e como conveniência, não peça central.

**Em aberto (próxima decisão — D22):** a **camada de formato/estilo** do Raio-X (D19 item 6) — como o produto
treina "fazer a prova" (formato A–E × Certo/Errado, estratégia de prova) **antes** de saber a banca do BB.

## D22 — Formato/estilo + transição do edital (UMA app) + pivot otimizado (FECHADO, 2026-07-03) → FECHA O TEMA 3

**Parte A — "fazer a prova" = núcleo universal (já) + módulo de formato (gaveta):**
- **Núcleo universal treinado desde o dia 1** (leitura de comando, gestão de tempo, eliminação, não se trair)
  — **reaproveita o motor de causa de erro do D16**, não é conteúdo novo.
- **Módulo de formato banca-específico pronto na gaveta pras 3** (A–E Cesgranrio/FGV; C/E Cebraspe + regra
  "uma errada anula uma certa" = conta de risco de responder×deixar em branco), **liga quando a banca sair**.
- **Estratégia C/E liberada como opcional antecipado** (só vale se Cebraspe; não força, mas disponibiliza).
- Treino de conteúdo usa questões reais **das 3 bancas** (conteúdo transfere). Simulado **alterna** formatos
  enquanto a banca é indefinida (prontidão ampla, vira argumento de venda) e **trava** no formato quando sai.

**Parte B — antes × depois do edital = UMA aplicação, não duas (esclarece dúvida do sócio):**
- **Não são dois apps.** É o mesmo sistema lendo um **"perfil de concurso"** (órgão, banca, programa,
  data_prova, formato). `banca` indefinida → coluna combinada; `banca=FGV` → coluna FGV. `data_prova` nula →
  plano **aberto**; com data → **contagem regressiva**. Mesmo código, entradas diferentes — possível porque
  tudo é **projeção por cima de dados (D15) + plano regra/SQL (D18)**.
- O edital traz **2 coisas novas**: a **data** (o plano ganha prazo → contagem regressiva, versão macro do
  "cabe no tempo" do D18) e o **programa oficial** (fecha o porteiro do D19/D20).
- **Núcleo sobrevive à virada** → o edital é **re-foco, não recomeço**; só a borda condicional se re-pesa.

**Parte C — pivot do edital OTIMIZADO (pesquisado 2026-07-03):** girar o produto no mesmo dia (vantagem sobre
o cursinho que verticaliza na mão em horas/dias). Receita = **embeddings casam o grosso de graça + IA só no
ambíguo + citações fazem o humano validar o diff em ~1h + snapshot D15 protege o histórico**. Fases:
1. **Extrair** (Claude, saída estruturada + **citações** por página/linha, PDF nativo) → conteúdo programático
   em árvore (= "edital verticalizado" instantâneo, cada tópico com o trecho do edital do lado).
2. **Comparar/diff** (Cohere embed-v4, D5) → 3 baldes por similaridade: **bate forte** (casa sozinho, sem IA)
   / **dúvida** (só esses vão pra IA julgar mesmo×renome×mudou-escopo) / **não bate** (candidato a tópico novo
   → humano); + tópico nosso que **sumiu** do edital → porteiro desliga. Saída = diff (entrou/saiu/renome/
   escopo) com citação + nº de questões afetadas.
3. **Humano confere só o diff** pré-citado (minutos–1h, não o edital do zero) + confirma banca/data/estrutura.
4. **Propagar automático:** re-etiqueta questões (snapshot D15 mantém histórico), vira coluna, atualiza
   porteiro, seta prazo, trava simulado. Tudo que o aluno vê recalcula sozinho.
- **Tópico novo também enfileira** geração de inéditas (D8) + doc da base de conhecimento (D12.2) — o diff
  vira lista de tarefas de conteúdo, não só reajuste de peso.
- **Trava:** humano **sempre** confere o porteiro (documento que direciona milhares de alunos) — nunca aplica
  sozinho (disciplina D6/D12.2; a própria pesquisa acadêmica aponta a validação humana como parte da receita).
- **Automático = propagação ao aluno; setup manual = poucas entradas** (flip banca, data, estrutura, conferir
  diff). Detecção do edital = humano percebe (notícia nacional), sem scanner.

**Multi-concurso (esclarece 2ª dúvida do sócio):** BB = **primeiro perfil de concurso**. O core (banco
multi-banca, taxonomia de carreira, coluna vertebral D15–D18, motor, IA, áudio) é **agnóstico** → Caixa/BNB/
BASA/Banrisul = **adicionar perfil + ingerir provas** (+ estender taxonomia só se carreira nova). No limite,
fora do bancário = trocar o "pacote de conteúdo", não reescrever o app. Plataforma = **motor multi-concurso**.

**Verdict de over-engineering (sócio pediu honestidade):** desenho coerente; risco não é o desenho, é a
**sequência de construção**. Decisões foram tomadas pra **adiar custo** (pré-computa, FSRS só quando o log
enche, radar morto→quase-grátis, atualidade humana leve). Antídoto = a própria regra D1 (modular/incremental):
**lançar o loop central primeiro** (banco + estudar por questões + explicação + plano simples); tutor ao vivo,
áudio, FSRS real, pivot automático e Raio-X multi-sinal entram **em cima** (fast-follow, não dia 1). No
lançamento o Raio-X pode ser **só frequência** (até semeado à mão) + visão combinada. Única aposta fundacional
que TEM que ser bem-feita = **log imutável + projeções (D15)**. → **FECHA O TEMA 3.**


---

# GAMIFICAÇÃO DE HÁBITO + LGPD/FLYWHEEL — Tema 4 (sessão de 2026-07-03)

> As duas últimas projeções por cima do log `tentativas` (D15): a **gamificação** (o que o sistema
> recompensa para criar hábito, sem prêmio em dinheiro) e o **flywheel/LGPD** (como esse mesmo log
> vira melhoria do produto sem ferir privacidade). Gamificação = camada de motivação por cima do
> plano (D18); LGPD = o contrato legal por cima do log.

## D23 — O que a gamificação recompensa: 4 sinais separados, hábito de barra baixa DENTRO do plano (FECHADO, 2026-07-03)
**Decisão:** a gamificação **não escolhe entre "presença (Duolingo)" e "trabalho certo (plano)"** — separa
em **4 sinais, cada um com uma função só**, adotando a máquina de hábito do Duolingo por inteiro com **duas
correções nossas**. O insight que dissolve a tensão: no Duolingo a **sequência não precisa** garantir "fez a
coisa certa" porque a **trilha** (o caminho de lições) já garante — a sequência só serve pra te fazer aparecer.
**O nosso plano diário (D18) é a nossa trilha:** o motor de prioridade já rota pro trabalho certo, então a
sequência pode ter **barra baixa** sem virar trapaça. E como a **primeira fatia do plano é o bloco Revisar
(revisão espaçada, D18)**, o "mínimo" que mantém a sequência **já é, por construção, o trabalho de maior valor**
(o que nunca se pode pular) → barra baixa **E** trabalho certo ao mesmo tempo, sem escolher.

| Sinal | Função | Barra | Origem |
|---|---|---|---|
| **Sequência (streak)** | fazer o aluno aparecer todo dia (hábito) | **baixa** = fechar o **piso** do plano (revisões devidas de hoje, ~5–10 min) | Duolingo (motor emocional inteiro) |
| **Meta do dia (anel)** | quanto fez hoje (esforço/satisfação) | cheia = plano completo (Revisar + Avançar + Treinar) | Duolingo (meta ajustável) |
| **No prazo / avanço** | está andando no conteúdo **a tempo da prova**? | honesto, ligado à contagem regressiva quando sai a data (D22) | **nosso** — trava anti-coasting |
| **Progresso / domínio** | crescimento desde o **ponto de partida** (D17) | nunca é a moeda do hábito; é tela de orgulho | **nosso** — respeita D17 (ponto de partida, não veredito) |

**Adotado do Duolingo sem mexer:** contador de dias, congelamento de sequência (=D24), celebrações, lembretes.
**Duas correções nossas:** (1) a **barra da sequência fica dentro do plano** — mínimo = revisões devidas (alto
valor), não "qualquer questão fácil" → não há o que trapacear porque o sistema **entrega** a tarefa (regra/SQL,
não escolha do aluno); (2) existe um **sinal separado "no prazo/avanço"** porque barra baixa tem um preço
**específico do nosso público**: aluno de idioma que faz 5 min/dia progride devagar, mas concurseiro que faz
**só o mínimo (só revisão) todo dia nunca faz o bloco Avançar** — nunca aprende matéria nova — e **não passa**,
por mais linda que esteja a sequência ("coasting"/acomodação no mínimo eterno). Esse sinal mora **longe** da
sequência de propósito: sequência = **constância**; "no prazo" = **suficiência** — duas verdades diferentes
(mesmo instinto de D13/D16: dois sinais separados > um número que finge dizer tudo).

**Rejeitados:** "recompensar presença pura" (opção Duolingo cru — premia aparecer, não progredir; corrompe o
D18 ensinando o aluno a fugir do trabalho difícil que o motor escolheu; vende o oposto do posicionamento
"método e direção"); "recompensar ganho de domínio" (aprendizado é lento/ruidoso, péssimo pra laço diário, e
bate de frente com o "ponto de partida, não veredito" do D17).

**Custo técnico assumido:** o D18 passa a emitir **dois níveis por dia** — um `piso` (mantém a sequência) e uma
`meta cheia` (enche o anel) — não um plano único. Detalhe de spec, nasce aqui.

**Em aberto (próxima decisão — D24):** o **perdão da sequência** (congelamento/reparo) — como não matar o aluno
no dia que ele falha (onde a maioria dos apps de streak perde o usuário), e como a forgiveness convive com a
honestidade do sinal "no prazo".

## D24 — Perdão da sequência: compromisso com a agenda do aluno + escudo + reset suave, isolado do "no prazo" (FECHADO, 2026-07-03)
**Decisão:** a sequência é **generosa por construção**, porque a função dela é só trazer o aluno todo dia; a
honestidade sobre passar/não passar mora em **outro** indicador (o "no prazo" do D23), que **não dá pra congelar**.
Corrige o defeito fatal do streak diário "tudo ou nada" (Duolingo): quando quebra, a mesma força que segurava (medo
de perder o construído) vira contra você → abandono nº 1. Agravante nosso: público **adulto, rotina irregular, já
ansioso** (aposta alta = concurso).

**Frente 1 — o que a sequência mede (vantagem que o Duolingo não tem):** o plano (D18) já sabe a **agenda que o
aluno declarou** (dias/semana, no D17) **e a data da prova** (D22). Então a sequência mede **compromisso cumprido
com a agenda do próprio aluno**, não presença diária crua: quem declarou "5 dias/semana" mantém sequência perfeita
cumprindo esses 5 — a folga que ele mesmo marcou **não quebra nada**. Remove metade das quebras injustas de saída e
é mais honesto (recompensa fazer o que **você** se comprometeu).

**Frente 2 — amortecedor no dia que ele falha de verdade (tudo de graça: sem prêmio $, sem anúncio):**
1. **Escudo/congelamento:** acumula 1–2 escudos por consistência; gasto **automático** num dia perdido inesperado
   → sequência sobrevive. Teto baixo (não vira "sumir a semana toda").
2. **Folga sem culpa:** folga programada (viagem, prova na faculdade) declarada não conta contra.
3. **Reset suave, nunca a zero:** estourou os escudos → sequência **tropeça** (marca visível) e é **recuperável**
   com um dia forte em janela curta. O Duolingo zera a zero **de propósito** porque é assim que ele **vende** o
   reparo; como não vendemos isso, zerar só entrega o custo (abandono) sem ganho.

**Trava que amarra com o D23:** o perdão vale **só para a sequência** (hábito/motivação). **Não** toca no sinal "no
prazo/avanço" — dá pra congelar a sequência, **não** a contagem regressiva até a prova. Ficou pra trás do que precisa
pro edital → o "no prazo" fala a verdade do mesmo jeito. **Generosos com a motivação, honestos com a preparação**
(mantém a integridade D13/D16: o sistema nunca finge pro aluno).

**Custo honesto:** modelo "bonzinho"; crítico diria que sequência que quase nunca quebra "perde o peso". Rejeitado
pro nosso caso: o peso emocional vem do **número crescendo** + **avanço rumo à prova**, não da ameaça de perder
tudo; objetivo = reter adulto ansioso por meses, não vender reparo na quebra.

**Exemplos didáticos validados na sessão** (Maria 5 dias/sem, ~120 dias pra prova): terça só-piso (10 min) mantém
sequência; quinta esquecida → escudo automático; fim de semana de folga não conta; semana 2 estoura escudos →
tropeça, não zera, recupera com dia forte. Caso "coasting" (João, 15 dias de streak só fazendo o piso) → 🎯 No prazo
vira amarelo e fala a verdade ("não avança há 8 dias, cobre ~60% do edital nesse ritmo") sem tirar o mérito da
constância. Progresso mostrado como "acertava 3/10 → hoje 7/10" (ponto de partida, nunca "você sabe 43%").

**Em aberto (próxima decisão — D25):** **onde a gamificação para** pra não estragar o método — dose de notificação
(anti-spam), anti-"estudar pra alimentar o app" (jogar o metric em vez de aprender), e se há comparação social/
ranking ou se é 100% solo.

## D25 — Onde a gamificação para: notificação leve + anti-trapaça + solo no lançamento (FECHADO, 2026-07-03) → FECHA A GAMIFICAÇÃO
**Princípio (linha única):** a gamificação existe pra fazer o aluno estudar o certo; **no minuto em que competir com
isso, ela para**. Três lugares concretos onde para:

**1. Notificação = lembrete, nunca chantagem (sócio pediu explicitamente "bem leve, sem ficar no pé").** O Duolingo
ficou famoso pela notificação que culpa — com adulto disputando concurso (culpa/ansiedade de sobra) isso **queima o
produto**. Decisão: **poucas e na hora certa** — cai no **horário que o aluno declarou** estudar (D17), não aleatório;
teto de **1 lembrete de estudo/dia** + no máximo **1 aviso de "sequência em risco"** no fim do dia (e o sócio inclina
pro lado mais gentil ainda); **tom de treinador, não de cobrador**; **configurável + horário de silêncio**; **nunca
mentir** pra criar urgência (nada de "outros já estudaram" fabricado — integridade D13/D16).

**2. Anti-"jogar pra alimentar o app" — recompensar o certo, nunca volume nem velocidade.** O D23 já mata quase tudo
(sistema **entrega** a tarefa; **não existe métrica de volume** pra farmar — anel enche em "fiz o plano", não em "X
questões"). Duas travas extras: **(a)** resposta **rápida demais** (abaixo de um piso de tempo, impossível ter lido —
usa o `tempo_ms` já gravado no D15) **não conta** pro anel nem pra sequência (sem punição, só não vale); **(b)** o anel
tem **teto no plano do dia** → não dá pra moer 500 questões por um número maior (protege também contra excesso/burnout
do ansioso). Rede real: mesmo burlando a sequência, os **dois sinais honestos** (📈 progresso e 🎯 no prazo) **não se
deixam enganar** — quem clica sem ler continua errando e a verdade aparece.

**3. Comparação social = 100% solo no lançamento.** Ranking/liga é o que mais engaja **e** o mais criticado (ansiedade,
desmotiva o mais fraco = justo quem mais precisa reter, vira trapaça). **Agravante único nosso:** os alunos **competem
de verdade** por vaga limitada → ranking público de candidatos do BB seria tóxico (último colocado **some**, e era quem
a gente queria segurar). Decisão: **única comparação é com você mesmo** (o "acertava 3/10, hoje 7/10", ponto de partida
D17); **sem ranking, sem liga, sem placar** no lançamento; social só **opt-in e sem cabo-de-guerra** no futuro (grupo
privado de responsabilidade que o aluno escolhe criar — fast-follow, nunca expor um aluno ao fracasso na frente de outro).

**Custo honesto assumido:** abrir mão do ranking = abrir mão do combustível de engajamento **mais forte** que existe.
Aceito de olhos abertos — pro nosso público e posicionamento (método sério, honesto, sem ansiedade fabricada), o ranking
dá mais churn que retenção.

**→ FECHA A METADE DE GAMIFICAÇÃO DO TEMA 4 (D23–D25).** Falta a metade **LGPD/flywheel** (próxima sessão).


## D26 — LGPD/flywheel: base legal por finalidade, não consentimento único (FECHADO, 2026-07-03) → ABRE A 2ª METADE DO TEMA 4
**Reframe que dissolve a pergunta "usar consentimento ou não":** a LGPD exige **base legal por FINALIDADE**
(por uso do dado), não uma chave única global (mesmo instinto dos "2 sinais separados" D13 e "4 sinais" D23:
separa os usos, cada um recebe sua base). O log `tentativas` (D15) tem três usos, três bases:

| Uso do log | O que é, em concreto | Base legal | Pede clique? |
|---|---|---|---|
| **Operar o produto pro aluno** | gravar respostas, montar plano, progresso, diagnóstico, tutor | **Execução de contrato** (art. 7º, V) | **Não** — o log é o produto que ele contratou |
| **Melhorar a plataforma pra todos (flywheel)** | calibrar dificuldade real, knowledge tracing, afinar eval (D11/D13), dirigir inéditas (D8) | **Legítimo interesse** (art. 7º, IX) | **Não**, mas exige LIA + transparência + **opt-out** |
| **Marketing / notificação / e-mail** | avisar, vender, engajar fora do produto | **Consentimento** (art. 7º, I) | **Sim** |

**Decisão:** (1) **núcleo do produto NÃO fica atrás de checkbox** — se dependesse de "aceito que usem meus dados"
e o aluno desmarcasse, não dá nem pra entregar o plano; contrato + legítimo interesse cobrem o produto **sem
fricção no cadastro** (protege ativação, Tema 5). (2) **Consentimento granular = NÃO** (nada de tela de switches);
uma **política de privacidade clara** + **um** consentimento só pra notificação/marketing. Flywheel roda em
**opt-out**, não opt-in. (3) **Fazer o LIA agora** (teste de balanceamento — documento de ~½ página, 1×, barato)
e guardar; é exatamente o que a ANPD cobra se questionar.

**Estado da LGPD conferido (jul/2026):** legítimo interesse (art. 7º, IX) é base consolidada — ANPD publicou
**Guia Orientativo** exigindo LIA + transparência + direito de oposição. Notícia abr/2026: diretor da ANPD
sinaliza legítimo interesse **para treinar modelos de IA** (vento a favor do flywheel). Dado **anonimizado**
(art. 12) deixa de ser dado pessoal se a anonimização for **irreversível** → gancho pro DELETE (D29, adiante).

**Furo registrado (legítimo interesse ≠ passe livre):** cai se não houver LIA, transparência real e respeito ao
opt-out. Delicadeza: o log revela **fraqueza cognitiva** do aluno — **não** é dado sensível legal (art. 5º, II =
raça/saúde/biometria; desempenho não entra), mas é reputacionalmente delicado → transparência honesta, não letra
miúda (coerente D13/D16: o sistema nunca finge pro aluno).

**Rejeitado:** consentimento explícito pro flywheel ("mais seguro na aparência") — gera fricção no cadastro E
deixa o aluno desligar os dados de melhoria a qualquer hora, minando o ativo (D15) sem ganho legal real.

**Em aberto (próxima — D27):** separar o **dado operacional identificado** (ligado ao `user_id`) do **dado
analítico anonimizado/pseudonimizado** que alimenta o flywheel — o que exatamente vira anônimo, e como.

## D27 — Separar dado "com nome" do dado "sem nome": três grupos (FECHADO, 2026-07-03)
**Termos (LGPD):** **anonimizar** = tirar a identidade de forma **irreversível** (nem o controlador reverte) →
art. 12: deixa de ser dado pessoal, sai da LGPD, **único jeito de sobreviver ao DELETE**. **Pseudonimizar** =
trocar o id por um **código** guardando a chave → reversível → **continua dado pessoal**, continua na LGPD (é
medida de segurança, não saída). ANPD tem estudo técnico confirmando a distinção.

**Insight:** a maior parte do valor do flywheel está em **contagens somadas de muita gente**, não na linha de
um aluno. "Questão X: 3.200 respostas, 47% acerto, tempo médio 40s" calibra dificuldade (D17) + Raio-X + eval —
é conta sobre milhares → **anônimo de verdade** → sobrevive ao DELETE. Só o **knowledge tracing** (estima o que
o aluno sabe pela **sequência** ordenada dele) precisa acompanhar o indivíduo no tempo → não dá pra anonimizar
(a sequência identifica) → fica **pseudonimizado**.

**Decisão — três grupos:**

| Grupo | O que tem | Base legal | Some no DELETE? |
|---|---|---|---|
| **1. Operacional (com nome)** | `tentativas` ligado ao `user_id` — plano, progresso, tutor daquele aluno | contrato (D26) | **Sim** |
| **2. Estatística somada (anônimo de verdade)** | contagens por questão/tópico: acertos, tempo médio, dificuldade, frequência | fora da LGPD (art. 12) | **Não — sobrevive** |
| **3. Sequência com código (pseudonimizada)** | fluxo de respostas por aluno-código, só quando treinar knowledge tracing | legítimo interesse (D26) | **Sim** (ainda é pessoal) |

**Sequência de construção:** o flywheel do **dia 1** (calibrar dificuldade, Raio-X, achar questão fácil/difícil
demais, sinal de eval) roda **todo no grupo 2** (anônimo → risco ~zero + sobrevive ao DELETE). Grupo 3 (knowledge
tracing) é **fast-follow** (entra quando o loop central já roda — coerente D22/D1); nele aceita-se que o dado some
no DELETE. Lançamento efetivo = grupos 1 + 2; grupo 3 depois.

**Furo registrado:** "anônimo" tem que ser **merecido**, não declarado. "Uma linha por resposta com código no
lugar do nome" **NÃO é anônimo** (a sequência sozinha reidentifica) → só o **agregado somado de muita gente** é
anônimo de verdade. Por isso três grupos, não dois: grupo 2 = agregado (anônimo mesmo); grupo 3 = código (segue
pessoal, sem fingir que é anônimo). Erro clássico a evitar: chamar pseudonimização de anonimização.

**Em aberto (próxima — D28):** **retenção** — quanto tempo cada grupo vive (o operacional com nome; o agregado
anônimo; a sequência pseudonimizada), e o que dispara o descarte.

## D28 — Retenção: guardar só enquanto serve, anonimizar em vez de acumular (FECHADO, 2026-07-04)
**Regra LGPD (art. 15–16):** dado **com nome** só se guarda **enquanto serve ao propósito** — "guardar pra
sempre porque é útil" é **proibido** p/ dado pessoal. Fogem da regra: dado **anonimizado** (grupo 2, art. 12 —
fica pra sempre) e dado que a **lei obriga guardar** (fiscal/cobrança — sobrevive até a pedido de exclusão).
**Sacada:** apagar o dado com nome **não** perde o aprendizado, porque o valor já foi pro grupo 2 (contagens
somadas). **Nuance do público:** concurso é anual → aluno que não passou **volta** e quer o histórico → apagar
no cancelamento machuca quem volta.

**Decisão (números = confirmar c/ advogado/contador no PRD):**

| Dado | Quanto vive | Gatilho do descarte |
|---|---|---|
| **Cobrança / nota fiscal** | prazo legal (~5 anos; NF-e pode chegar a ~11) | prazo fiscal — **sobrevive ao "esquecer meus dados"** (lei obriga) |
| **Operacional com nome** (conta + `tentativas` grupo 1) | conta ativa **+ janela de 24 meses** parado após cancelamento | passou a janela sem voltar → **anonimiza pro grupo 2 e apaga o com-nome** |
| **Estatística somada** (grupo 2, anônimo) | **pra sempre** | só se a questão for removida |
| **Sequência com código** (grupo 3) | enquanto treina modelo, **teto 24–36 meses** | fim do teto ou pedido de DELETE (D29) |

**Por que 24 meses:** é o ciclo do concurso — quem volta dentro dela acha o histórico intacto (bom pro aluno e
pra retenção); quem some de vez tem o dado com nome apagado, mas o aprendizado já ficou no grupo 2. Honra
"guardar só enquanto serve" **sem** jogar valor fora.

**Furo registrado:** "guardar tudo com nome pra sempre, vai que serve" é proibido **e** é risco (dado com nome
parado = mais estrago se vazar). Disciplina = **anonimizar em vez de acumular**; a janela de 24 meses tem que
ser **escrita e avisada**, não "a gente vê depois". Rejeitados: janela de 12 meses (enxuta demais p/ o ciclo
anual — perde o concurseiro de 2 tentativas) e "sem prazo" (ilegal).

**Em aberto (próxima — D29):** **direito ao esquecimento** — quando o aluno pede DELETE do `user_id`, o que
some e o que fica; a tensão central: o **agregado anônimo (grupo 2) sobrevive** ao DELETE porque não é mais
dado pessoal (art. 12) — desde que a anonimização seja mesmo irreversível.

## D29 — Direito ao esquecimento: DELETE apaga o com-nome, agregado anônimo sobrevive (FECHADO, 2026-07-04)
**Direito de eliminação (art. 18, VI).** Resolve a tensão central do Tema 4 (levantada na abertura): o DELETE
por `user_id` (D15) **convive** com manter o aprendizado somado.

**Decisão — no pedido de "apaga tudo meu":**
| Dado | Some? | Por quê |
|---|---|---|
| Conta + `tentativas` com nome (grupo 1) | **Some** | é dado dele |
| Sequência com código (grupo 3) | **Some** | reversível → ainda é dado dele |
| Faturas | **Fica** o que a lei obriga (~5 anos) | obrigação legal acima do pedido (art. 16, I) |
| Contagens somadas (grupo 2) | **Fica** | não é mais dado pessoal (art. 12); a resposta dele já dissolveu na conta de milhares |

**Princípio do sócio, traduzido:** "guardar o que precisa e é legal guardar" = **exatamente o grupo 2** (anônimo,
pra sempre — onde mora o valor estatístico). O que a lei **não** deixa segurar (dado com nome além do propósito)
é apagado — e **não se perde valor**, porque o grupo 2 já capturou. Guarda-se **tudo que é legal e útil**; apaga-se
só o que a lei manda.

**Duas travas que fazem o "sobrevive ao DELETE" ser real (senão é furo):**
1. **Número mínimo de respondentes:** só manter/usar agregado calculado sobre **gente suficiente** (ex.: ≥ ~20).
   Contagem sobre 3 pessoas praticamente reidentifica → não é anônimo. Abaixo do piso, espera acumular / não usa.
2. **Apagar inclusive dos backups:** DELETE na tabela viva é fácil; o furo é esquecer as **cópias de segurança** →
   o apagamento alcança os backups no ciclo normal deles; cumprir o pedido em **prazo definido (~15–30 dias)**.

**Transparência (liga D26):** política em português claro — "apagamos seus dados pessoais; estatísticas anônimas
que **não identificam você** permanecem". Sem letra miúda (honestidade D13/D16).

**Modelos de IA:** não se retreina modelo por causa de 1 aluno — apagam-se os dados crus dele e o **próximo treino
não o inclui** (ANPD abr/2026 sinaliza legítimo interesse p/ treino de IA como aceitável).

**Furo registrado:** o erro clássico é chamar de "anônimo" **uma linha por pessoa com código** — isso NÃO sobrevive
ao DELETE (reidentificável). Só o **agregado sobre muita gente** sobrevive → a trava do número mínimo é obrigatória.
**Rejeitado** o ultraconservador "apagar até o agregado no DELETE" (perde flywheel sem ganho — a lei não exige,
já que o agregado não é dado pessoal).

**Em aberto (próxima — D30, ÚLTIMA do Tema 4):** o **pipeline do flywheel** — como o log vira melhoria de fato
(o cano que roda as contagens do grupo 2 e alimenta calibração/eval/inéditas), **quem** na equipe acessa o quê,
e a **trilha de auditoria** (registro de quem mexeu no dado do aluno).

## D30 — Pipeline do flywheel: máquina de 3 esteiras, humano fora do "questão por questão" (FECHADO, 2026-07-04) → FECHA O TEMA 4
**Pergunta do sócio que puxou a decisão certa:** "eu vou ter que analisar questão por questão?" **Não.** Existe
campo maduro (psicometria = ciência de medir prova) que **automatiza quase tudo**; a IA mastiga o que sobra.
Mesmo padrão do D22 (bate sozinho / dúvida→IA / novo→humano) e do "IA trabalha pro humano" (D21).

**Três esteiras, da mais automática pra menos:**

**Esteira 1 — 100% automática, humano nenhum (roda p/ todas as questões, sempre):** dificuldade real (p-value =
% que acertou); frequência/Raio-X (contagem); **índice de discriminação** (point-biserial) por questão. Só números
se calibrando. **O truque que dispensa o humano — índice de discriminação = "os alunos bons acertam essa questão?"**
Questão saudável: quem vai bem no todo tende a acertá-la. Questão quebrada (gabarito trocado / enunciado dúbio): os
**melhores erram** → o número fica **perto de zero ou negativo** → a **própria matemática dedura a questão ruim,
sem leitura humana**. Regra conhecida (pesquisa 2026): bom ≥ +0,30; item defeituoso tende a difícil **e** pouco
discriminativo (rpb baixo/negativo). Ex.: nº 4.812 marcada "fácil" mas os que gabaritam o resto erram justo ela →
🚩 automático.

**Esteira 2 — IA peneira E pré-diagnostica; humano só confirma (~1h/semana):** (1) a máquina **junta a pilha** de
suspeitas (poucas centenas ao longo do tempo, não as 10 mil); (2) **Claude olha cada uma antes do humano** — lê
questão + estatísticas + gabarito oficial e escreve o **diagnóstico pronto** ("provável gabarito trocado: fortes
marcam C, oficial diz B" / "distrator D ambíguo"); (3) humano vê **frases prontas**, confirma/descarta em ~30s.
Mesma esteira serve p/ **qualidade de explicação** (👍/👎 rankeiam as piores → IA reescreve → humano aprova, D13) e
**lacuna → inéditas** (máquina acha o buraco → IA gera → humano revisa, D8/D6).

**Esteira 3 — só o irredutivelmente humano (raríssimo):** **mudar gabarito oficial** (milhares veem, aposta alta) —
máquina sinaliza, IA diagnostica, **decisão final humana**. Punhados/mês, não questão por questão.

**Segurança:** a automação só mexe em **coisa segura** (números que ajustam o plano de leve). Tudo arriscado —
mudar o que se ensina, mudar gabarito — para na mão humana → **protege o "não ensinar errado" (D12)**: automação
nunca ensina errado sozinha.

**Acesso mínimo por sensibilidade (RLS do Supabase, D2 — quanto mais aponta pra pessoa, menos gente vê):** grupo 2
(anônimo) = time amplo (painel de produto, sem nome); grupo 1 (com nome) = pouquíssima gente, só quando o suporte
precisa, **e fica registrado**; grupo 3 (código) = restrito, chave à parte. **Trilha de auditoria:** todo acesso/
alteração a dado com nome gera registro (quem/quando/porquê) = prestação de contas LGPD (art. 6º, X), reusa a
disciplina de log imutável do D15. Humanos trabalham em cima do grupo 2; ninguém "passeia" no grupo 1 sem motivo.

**Furo registrado:** índice de discriminação **só confia com volume** (dezenas de respostas/questão) → cold-start
(poucos alunos no comecinho) = revisão **por amostra** (D6) nos primeiros meses; a esteira 1 "liga" sozinha conforme
os alunos entram. Mesmo cold-start do D17/D18 — nada novo.

**Deferido pro PRD:** deixar a IA **aplicar sozinha** correções de **baixíssimo** risco (ex.: aposentar um distrator
que ninguém marca) sem passar por humano — afinação fina, não decisão de arquitetura.

**Maior risco de privacidade na prática = acesso interno demais** (time inteiro no banco de produção com nomes), não
hacker → proteção real = acesso mínimo + auditoria (decidido acima). **→ FECHA O TEMA 4 (D23–D30).**


---

# MODELO DE NEGÓCIO / PREÇO + PAGAMENTOS + AUTH + INFRA — Tema 5 (sessão de 2026-07-04)

> Última frente antes do PRD. Ordem escolhida: **modelo de negócio primeiro** (é o porteiro), depois pagamentos/cobrança,
> autenticação e infra — porque as três técnicas derivam do modelo (assinatura×compra única muda o gateway; paywall×freemium
> muda o onboarding/auth; o funil dimensiona a infra). Depois: PRD + specs via /tlc-spec-driven.

## D31 — Monetização: paga-primeiro + compra anual 12x no cartão + porta Pix/boleto + garantia de 7 dias (FECHADO provisório, 2026-07-04) → ABRE O TEMA 5
**Decisão (provisória por escolha do sócio — "podemos mudar depois"; nível fino de preço = D32):**

**1. Forma de monetização = paga-primeiro (paywall).** O aluno paga **antes** de usar o produto. **Rejeitados por ora:**
freemium (grátis pra sempre num pedaço com teto) e trial (grátis por tempo limitado). O consultor havia recomendado
**freemium com teto** por três motivos — (a) o valor do produto é de **compounding** (revisão espaçada, FSRS, progresso
"3/10→7/10" do D17 só aparecem em semanas → trial que expira corta o aluno antes do payoff); (b) o **custo marginal por aluno
é ≈0** (D10: quase tudo é IA pré-computada; só tutor ao vivo + áudio custam por aluno → dava pra trancar só esses no pago);
(c) **marca nova sem confiança** num nicho onde o Bizzu cobra R$5. O **sócio optou por paga-primeiro** (caixa imediato +
filtro de aluno sério + build mais simples, sem lógica de tier grátis). Decisão respeitada e marcada como mudável.

**2. Cobrança = Leitura A (compra de 1 ano parcelada no cartão, modelo "curso").** Venda **ÚNICA** de 12 meses de acesso; o
**cartão do aluno** divide em **12x de ~R$16**. **Não** é assinatura mensal: não há "cancelar no meio" (o cartão já
comprometeu o valor); renovação = compra nova no ano seguinte. Requer cartão de crédito com limite. **Racional:** o produto só
entrega valor depois de **meses** de uso constante → travar o aluno por 1 ano remove a decisão mensal de "continuo pagando?"
justo no período sem payoff (por isso curso de concurso é anual). **Rejeitada por ora a Leitura B** (assinatura mensal
recorrente ~R$16–20/mês, cancelável, com churn mensal) → **guardada como "entrada barata" futura** (cartão recorrente / Pix
Automático), não é o lançamento.

**3. Porta Pix/boleto à vista (obrigatória).** Parcelamento 12x só existe no cartão; boa parte do concurseiro **não tem cartão
ou está com o limite estourado** (o sócio priorizou o Pix desde o início) → oferecer **Pix/boleto à vista** (R$197 de uma vez,
podendo ganhar desconto vs. cartão — detalhe D32/pagamentos). Sem essa porta, exclui-se público que compraria.

**4. Garantia de reembolso = 7 dias.** "Não gostou nesse prazo, devolvo." Motivo: o **CDC art. 49** já obriga 7 dias de
arrependimento em compra online → o prazo é dado de qualquer forma; esticar (7→30) custa quase nada, **derruba o furo do
paywall** (pagar sem prova numa marca nova) e vira **argumento de venda** ("teste sem risco"). Entra com 7 dias, esticável.

**5. Preço-âncora = ~R$197 por 1 ano** (provisório; nível fino + estrutura de planos = D32). Posição de mercado (jul/2026,
pesquisado): **Bizzu ~R$60/ano** (R$5/mês no anual), **Concursa.ai ~R$360/ano** (~R$30/mês, freemium + oferta fundador
vitalícia), **Gran ~R$660/ano** (assinatura ilimitada premium). R$197/ano = **acessível, acima do mais barato, bem abaixo do
premium**.

**Furo assumido:** paywall em marca nova converte pouco do topo do funil (a pesquisa mostrou mercado **freemium-dominante** —
Bizzu e Concursa.ai dão porta grátis) → mitigado por **garantia de 7 dias + porta Pix/boleto**. O valor de compounding é
protegido pela compra anual (trava 1 ano) — vantagem da Leitura A sobre a mensal.

**Em aberto (próxima — D32):** estrutura de planos (**um plano só × escada de tiers**) + nível fino de preço + política de
**renovação** (concurso é sazonal, aluno volta — liga D28: janela de 24 meses).

## D32 — Estrutura de planos: um plano único no lançamento, tiers só depois com dado (FECHADO, 2026-07-04)
**Decisão:** vender **um pacote único** (tudo incluído por um preço), **não** escada de planos (básico/premium) no lançamento.
A escada de tiers fica **fast-follow, desenhada com dado do flywheel** (D26–D30). Motivos:
1. **Paywall já é fricção** — cada decisão a mais no checkout derruba conversão; marca nova precisa de "um preço, um botão".
2. **Não se sabe ainda por qual recurso alguém pagaria a mais** → tier bem desenhado exige ver o uso dos power users (dado que
   só vem depois de meses de uso).
3. **Produto ainda "fino" no começo** (D1: loop central primeiro) → fatiar um catálogo pequeno deixa o "básico" pobre demais e
   confunde o posicionamento ("método e direção", não "versão capada").
4. **O caro-por-aluno já está cercado sem precisar de tier:** o tutor ao vivo (única superfície com custo real por aluno, D10) é
   contido por **rate limit dentro do plano** — não é preciso um "premium" só pra proteger custo.
5. **Adicionar tier depois é trivial** (feature flags D1/D2) → começar simples não fecha porta nenhuma.
**Furo assumido:** um plano só **deixa dinheiro na mesa** de quem pagaria por acompanhamento humano / mentoria / correção de
redação — mas isso é **upsell futuro**, e o risco de fatiar cedo (confundir + converter menos) supera o de adiar o upgrade.
**Em aberto:** nível fino de preço (âncora ~R$197, provisório) + **renovação** (concurso sazonal, aluno volta — D28) ficam como
afinação de PRD. **Próxima frente = pagamentos/cobrança:** o gateway que faça **12x no cartão + Pix + boleto + nota fiscal**.

## D33 — Gateway de pagamento: Asaas (checkout próprio); AbacatePay no radar; Kiwify só campanha (FECHADO, 2026-07-04)
**Decisão:** o pagamento roda em **checkout próprio integrado ao Next.js/Supabase (D2)** usando o **Asaas** como gateway. Pesquisa
(jul/2026) comparou **Asaas × AbacatePay × Stripe × Kiwify** pelos critérios do D31: cartão parcelado 12x + Pix + boleto + nota
fiscal + ser dono do dado.

| Critério | **Asaas** | AbacatePay | Stripe | Kiwify (infoproduto) |
|---|---|---|---|---|
| Pix | R$1,99 | **R$0,80** | 1,19% (só por convite) | incluso |
| Cartão 12x | ~3% + R$0,49¹ | 3,5% + R$0,60 (parcelamento novo abr/2026) | ~3,99%+ | incluso |
| Boleto | R$1,99 | R$2,50 | R$3,45 | incluso |
| Nota fiscal | ✅ nativo | ❓ provável não | ❌ (externo) | ✅ (eles) |
| Taxa/mensalidade | baixa, sem mensalidade | baixa | média-alta | **~9% + R$2,49/venda** |
| Maturidade | madura | **muito nova** (cartão ~3 meses) | sólida global | madura |
| Dono do dado | **você** | você | você | **fragmentado** |

¹ Asaas tem tiers no cartão → confirmar tabela exata do 12x na abertura da conta.

**Por que Asaas:** **único que faz Pix + boleto + cartão parcelado 12x + emissão de nota fiscal nativa num lugar só e nativo do
Brasil**, **sem mensalidade**, com **antecipação** (~1,25%/mês, pra pegar as 12x à vista) e API de assinatura (futura Leitura B/
renovação). **NF nativa = fator decisivo** (liga D28 retenção fiscal; obrigação B2C). Dono do dado = coerente D26–D30.
**Rejeitados:** **AbacatePay** (Pix mais barato + "feito pra SaaS", mas cartão/parcelamento é feature de **abr/2026** e o fluxo
principal é 12x no cartão + provável que **não emita NF** → precisaria de 2º serviço; fica **no radar**); **Stripe** (Pix **só por
convite** no BR + **não emite NF brasileira** + mais caro; ótimo DX mas Brasil-first pede gateway nacional); **Kiwify** (~9% +
R$2,49/venda + **fragmenta o dado** → só serve pra **campanha pontual** com afiliados, nunca a espinha do app).
**Detalhe de caixa (PRD):** receber as 12x ao longo de 12 meses (D+30/parcela) vs. **antecipar** (~1,25%/mês) — provável antecipar
no começo (caixa R$15k). **Due diligence (não trava):** confirmar tabela exata do cartão do Asaas + **CNPJ/regime tributário** pra
emitir NF (MEI provavelmente não cobre → ME no Simples) + se AbacatePay passou a emitir NF.
**Em aberto:** próxima frente = **autenticação/contas** (fluxo de entrada paywall → conta → diagnóstico D17), depois infra.

## D34 — Autenticação + fluxo de entrada: paga-primeiro, conta automática na aprovação (FECHADO, 2026-07-04)
**Decisão:** login em **Supabase Auth (D2)**. Fluxo de entrada = **buy-then-activate** (paga primeiro; a conta nasce como
consequência da compra):
1. **Página de vendas** (oferta + método + garantia) → "Assinar".
2. **Checkout Asaas (D33)** pedindo **só o e-mail** + pagamento (cartão 12x ou Pix/boleto à vista).
3. **Pagamento aprovado → webhook do Asaas** → cria usuário no Supabase + registra **matrícula com validade de 12 meses** (é o
   que o RLS/app checa pra liberar conteúdo — liga D15/D28).
4. **E-mail automático** "defina sua senha / entre".
5. **1º login → onboarding:** pergunta meta + **diagnóstico D17** → plano do 1º dia.
**Login:** e-mail+senha (base) + **Google OAuth** + **link mágico** (passwordless — mata o "esqueci a senha", dor nº1 de suporte
nesse público).
**Racional:** cada campo antes do pagamento derruba conversão → "só e-mail e paga" = menor atrito.
**Consequência explícita do paywall (D31):** como o produto (diagnóstico/plano/método) está **atrás do muro**, quem converte é a
**página de vendas** — o "uau" pré-compra mora na oferta: **método + evidências científicas** (EVIDENCIAS-CIENTIFICAS.md vira
munição de copy) **+ garantia de 7 dias** como rede. Não muda arquitetura; define **onde mora o esforço de conversão**.
**Em aberto:** última frente do Tema 5 = **infra/hospedagem operacional** (confirmar Vercel + Supabase Cloud, região, backups
D29, jobs agendados, n8n, staging).

## D35 — Infra/hospedagem: Vercel + Supabase Cloud (São Paulo); trabalho longo FORA do serverless (FECHADO, 2026-07-04) → FECHA O TEMA 5
**Decisão (confirmada com pesquisa jul/2026):** combo gerenciado **Vercel (Next.js) + Supabase Cloud** (Postgres + Auth + Storage
+ RLS + pgvector), **região São Paulo** (latência BR + conforto LGPD, dado no Brasil), sem time de operações (3 devs).
**A pesquisa confirma que aguenta o caso:** Supabase documenta **particionamento + pg_partman** (pra tabela de eventos do D15 que
só cresce), **pg_cron** (roda projeções D15 + plano diário D18 dentro do banco), **pgvector** (embeddings D5); o pooler
**Supavisor** escala a milhões de conexões (resolve o gargalo de conexão do serverless). Escala não é gargalo (Postgres
particionado + projeções materializadas + pooler). Terceiros (MakerKit 2026) apontam Supabase como melhor banco pra SaaS web.
**Regra de ouro que a pesquisa afiou — trabalho longo FORA do Vercel** (função serverless expira: Hobby 10s, Pro ~60s):
- **Fábrica pesada** (extração PDF, explicações, inéditas, áudio, embeddings — minutos/horas) = **scripts standalone + Batch API**
  (ou n8n depois), **nunca** função Vercel.
- **Jobs agendados leves** (projeções D15, plano diário D18) = **pg_cron do Supabase** (no banco, sem timeout), não Vercel Cron
  (teto 60s).
- **Tutor ao vivo** (Haiku, D10/D11) = função Vercel **com streaming** (mantém a conexão viva além dos 10s), no plano Pro.
**Planos pagos implícitos** (baratos; orçamento fora da discussão D1): Vercel Pro (~US$20/mês) + **Supabase Pro** (~US$25/mês — dá
PITR/backup, sem auto-pausa).
**n8n adiado** (D2/D4: opcional no começo) — fábrica inicial em scripts; n8n (self-host Railway/Hetzner ou n8n Cloud) entra
quando a produção de conteúdo virar rotina.
**Backup × direito ao esquecimento (D29):** Supabase faz backup automático + PITR (Pro); a **retenção de backup tem que casar com
o prazo do D29** (apagar o dado da pessoa dos backups em ~15–30 dias no DELETE) → alinhar retenção a ~30 dias e **documentar na
spec de infra** (senão vira furo de LGPD).
**Staging:** branch do Supabase + preview da Vercel.
**→ FECHA O TEMA 5 (D31–D35).** Próxima etapa = **PRD + specs via /tlc-spec-driven** (prompt de geração pronto em `PROMPT-PRD.md`).


