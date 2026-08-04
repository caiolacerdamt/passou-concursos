# PROMPT — Gerar o PRD do SaaS de Concursos (colar numa sessão NOVA)

> Copie tudo abaixo da linha e cole numa sessão nova do Claude Code, dentro da pasta do projeto
> (`saas_concurso`). Ele lê os arquivos de decisão e gera o PRD no formato que a skill
> **/tlc-spec-driven** consome. **Não** cria código — para no PRD.

---

Você é meu sócio técnico ajudando a transformar decisões já fechadas num **PRD** (documento de
requisitos de produto). Estou construindo um **SaaS de preparação para concursos** (nicho: carreira
bancária, foco Banco do Brasil). Passamos por 5 sessões de `/grill-me` e fechamos **35 decisões
técnicas (D1–D35)**. Agora quero o PRD, e depois vou gerar as specs com `/tlc-spec-driven`.

## Regras de trabalho (siga à risca)
- Fale como para um leigo, **sem analogias**; todo termo técnico vem seguido do que significa em
  concreto. Seja direto e honesto (sócio, não vendedor); aponte furos e riscos.
- **NÃO reabra decisões fechadas.** Os arquivos de decisão são a **fonte da verdade**. Se achar um furo,
  registre como "questão em aberto", não mude a decisão sozinho.
- **Pesquise dados voláteis** (preços, modelos de IA, regras de LGPD, editais) antes de afirmar; use o
  **MCP do Context7** para docs de biblioteca. Se não achar, diga "não sei" — nunca invente API/número.
- Não escreva código nem crie a estrutura `.specs/` ainda. **Pare no PRD** e me proponha o próximo passo.

## Passo 1 — Ler tudo antes de escrever (obrigatório)
Leia **na íntegra**, na raiz do projeto:
1. `DECISOES-TECNICAS.md` — as 35 decisões detalhadas (D1–D35). **Fonte da verdade.**
2. `HANDOFF.md` — resumo de continuidade + o "mental model" do app (§1.5, uma app multi-concurso).
3. `EVIDENCIAS-CIENTIFICAS.md` — estudos que embasam o método (munição de página de vendas).
Além disso, a **memória do projeto** carrega os fatos principais (índice em `MEMORY.md`).

## Passo 2 — Gerar `PRD.md` na raiz do projeto
Escreva um PRD que sirva de **insumo direto** para a `/tlc-spec-driven`. Essa skill trabalha com dois
formatos, então **estruture o PRD para alimentar os dois**:
- **`.specs/STATE.md`** → um **log de decisões `AD-NNN`** (campos: Decision, Reason, Trade-off, Scope,
  Date, Status). Nossos **D1–D35 mapeiam 1-para-1** nisso.
- **`.specs/features/[feature]/spec.md`** → por módulo: Problem Statement, Goals, Out of Scope,
  Assumptions & Open Questions, **User Stories P1/P2/P3** com critérios **WHEN/THEN/SHALL**, Edge Cases,
  **Requirement Traceability (IDs tipo `BANCO-01`)**, Success Criteria.

### Estrutura obrigatória do `PRD.md`
1. **Visão & posicionamento** — o que é, para quem, o diferencial (**método + IA + direção**, não volume
   de conteúdo). **Não-objetivos** explícitos (rejeitados: prêmio em dinheiro; nicho militar; virar
   estúdio de conteúdo no dia 1; ser wrapper genérico de ChatGPT).
2. **Persona & tarefa central (JTBD)** — concurseiro bancário mirando o BB; dores; contexto (adulto,
   rotina irregular, ansioso, aposta alta).
3. **Objetivos & métricas de sucesso** — north star + ativação, retenção, conversão do paywall. Números
   provisórios; marque como hipótese.
4. **Escopo & roadmap por fases (regra D1: modular/incremental).** Deixe claro o **MVP = loop central**
   (banco de questões + estudar por questões + explicação + plano simples + paywall + onboarding com
   diagnóstico) e o que é **fast-follow** (tutor ao vivo, áudio TTS, FSRS real, Raio-X multi-sinal, pivot
   automático do edital, flywheel grupo 3/knowledge tracing, social/ranking). Aposta fundacional que TEM
   de ser bem-feita = **log imutável + projeções (D15)**.
5. **Módulos (cada um = seed de uma `spec.md`).** Para CADA módulo escreva: problema, **User Stories
   P1/P2/P3**, os **critérios de aceite principais em WHEN/THEN/SHALL**, Out of Scope, IDs rastreáveis
   sugeridos, e as **decisões D# que ele encarna**. Módulos:
   - **M1 — Banco de questões & pipeline de ingestão** (D3–D9): fontes legais, extração PDF, cruzamento de
     gabarito, taxonomia, dedup, QA misto por fonte, inéditas, schema/embeddings.
   - **M2 — Camada de IA** (D10–D13): pré-computa primeiro; modelos por tarefa; grounding 2 trilhos
     (norma citável × conta verificada por código); feedback do aluno = 2 sinais que nunca mudam a
     explicação sozinhos.
   - **M3 — Áudio/TTS das explicações** (D14): geração 1×, normalização de número/sigla, voz por teste
     cego, camada trocável (ElevenLabs principal + fallback barato).
   - **M4 — Coluna vertebral do aluno** (D15–D18): `tentativas` = log imutável só-INSERT + snapshot
     congelado da etiqueta; causa do erro = auto-relato obrigatório + "não sei"; diagnóstico curto
     adaptativo **pulável** (semente recalibrada pelo log); plano diário (job 1×/dia, regra/SQL, IA só
     escreve a frase; motor de prioridade + blocos Revisar/Avançar/Treinar/Simulado; revisão espaçada
     estilo FSRS com piso 1/3/7/14/30 no cold-start).
   - **M5 — Raio-X da banca** (D19–D22): projeção por cima do banco; conteúdo-primeiro (banca = coluna);
     3 sinais (frequência real manda; edital = porteiro binário; atualidade = empurrão com teto + faixa
     "novo no edital"); **anti-viés: só conta `origem='real'` como taxa**; formato na gaveta; pivot do
     edital otimizado; **uma app multi-concurso** com "perfil de concurso".
   - **M6 — Gamificação de hábito** (D23–D25): 4 sinais (sequência barra-baixa DENTRO do plano; anel/meta;
     "no prazo" anti-coasting; progresso = ponto de partida); perdão da sequência (agenda do aluno +
     escudo + reset suave nunca-a-zero); notificação leve; anti-trapaça; **100% solo, sem ranking**.
   - **M7 — LGPD & flywheel de dados** (D26–D30): base legal por finalidade (contrato/legítimo interesse
     +LIA+opt-out/consentimento só marketing); **3 grupos** (operacional com-nome × estatística somada
     anônima × sequência pseudonimizada); retenção (janela 24 meses → anonimiza e apaga; agregado pra
     sempre; fiscal por lei); direito ao esquecimento (**DELETE apaga com-nome, agregado anônimo
     sobrevive**; travas = nº mínimo de respondentes + apagar backups); pipeline de 3 esteiras
     (automática × IA-peneira-humano-confirma × 100% humano raro); acesso mínimo por RLS + auditoria.
   - **M8 — Negócio, pagamentos & onboarding** (D31–D34): **paga-primeiro (paywall)**; **compra anual 12x
     no cartão + porta Pix/boleto à vista**; garantia 7 dias; um plano único; **gateway Asaas** em
     checkout próprio (Pix + boleto + cartão parcelado + nota fiscal); auth Supabase (paga → conta criada
     na aprovação via webhook → matrícula validade 12 meses → onboarding meta + diagnóstico); login
     e-mail+senha + Google + link mágico. **Preço-âncora ~R$197/ano (provisório).**
   - **M9 — Infra & operações** (D35): Vercel + Supabase Cloud (São Paulo); trabalho longo FORA do
     serverless (fábrica em scripts+Batch; jobs leves em pg_cron; tutor ao vivo por streaming); n8n
     adiado; backup alinhado ao D29; staging por branch.
6. **Requisitos não-funcionais transversais** — LGPD (bases legais, retenção, DELETE, backups),
   performance (pré-computa; projeções recalculáveis; placar com atraso de job), segurança (RLS, acesso
   mínimo, trilha de auditoria), custo de IA controlado, PT-BR/acessibilidade.
7. **Modelo de dados (núcleo)** — `tentativas` (event-sourcing, só-INSERT, snapshot congelado, particionada
   por mês); `questoes`/`explicacoes` (origem, tipo, embedding+fts, citação); projeções (domínio por
   tópico, caderno de erros, Raio-X, hábito); `matricula`/assinatura (validade 12 meses, webhook Asaas);
   os 3 grupos de dado do D27.
8. **Integrações & stack** — Next.js + Supabase (Postgres/Auth/Storage/RLS/pgvector) + Claude SDK TS +
   Cohere embed-v4 + ElevenLabs TTS + Asaas (pagamentos/NF) + Vercel; n8n depois.
9. **Invariantes / regras de negócio que NÃO podem se perder** — liste como restrições duras: log nunca
   recebe UPDATE/DELETE-por-edição; Raio-X só conta `origem='real'`; verdade da explicação = gabarito
   oficial + código + base revisada (feedback nunca muda sozinho); diagnóstico é opcional; plano é
   regra/SQL (IA só escreve a frase); pré-computa primeiro (única superfície ao vivo = tutor com trava);
   DELETE apaga o com-nome mas o agregado anônimo sobrevive.
10. **Riscos & questões em aberto** — banca do BB indefinida (Cesgranrio×FGV×Cebraspe); cold-start
    (IRT/FSRS/índice de discriminação só calibram com volume); CNPJ/regime tributário para emitir NF
    (MEI provavelmente não cobre → ME no Simples); voz específica do ElevenLabs pendente (teste cego);
    preço fino e política de renovação (concurso é sazonal, D28); validar base legal das questões com
    advogado antes de escalar.
11. **Log de decisões pré-formatado `AD-001`…`AD-035`** — converta D1–D35 para o formato da
    `/tlc-spec-driven` (Decision / Reason / Trade-off / Scope / Date / Status: active), pronto pra colar
    em `.specs/STATE.md`. Mantenha o número (D7 → AD-007) pra rastreabilidade.

## Passo 3 — Fechar
Depois de escrever `PRD.md`, me mostre um **resumo de 1 tela** (visão + fases + módulos + top riscos) e
me proponha o próximo passo: rodar `/tlc-spec-driven` para **inicializar o projeto** (STATE.md a partir
do log AD-NNN) e depois **Specify** módulo a módulo (começando pelo MVP = loop central). **Não** comece a
implementar nem crie `.specs/` sem eu confirmar.
