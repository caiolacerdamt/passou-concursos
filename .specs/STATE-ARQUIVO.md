# STATE — ARQUIVO das decisões AD-001 … AD-088

> **Congelado por leitura de rotina.** Este arquivo existe para consulta pontual: "o que a AD-057
> decidiu?". Ele **não** é lido em toda fase de toda spec — era isso que fazia cada rodada custar
> ~26 mil tokens só para abrir o log.
>
> As decisões aqui continuam **válidas e vinculantes**. A hierarquia não mudou: AD maior vence AD
> menor. Decisão **nova** entra em `.specs/STATE.md`, nunca aqui.
>
> Projeto: SaaS de Concursos (bancário — foco BB). Log gerado a partir de `PRD.md` §11
> (AD-001 … AD-035). Numeração preservada de D# → AD-NNN para rastreabilidade.
> Módulos: M1 banco de questões · M2 camada de IA · M3 áudio · M4 coluna vertebral
> (log + plano) · M5 Raio-X da banca · M6 gamificação · M7 LGPD/flywheel ·
> M8 negócio/auth/pagamentos · M9 infra.

## Decisions

### AD-001
- **Decision**: Construir a plataforma completa, porém modular e incremental — cada feature usável/vendável quando pronta, via feature flags.
- **Reason**: Time de 3; querem o melhor produto sem esperar o todo.
- **Trade-off**: Mais peças a coordenar; o risco mora na sequência de construção.
- **Scope**: Arquitetura geral.
- **Date**: 2026-07-01
- **Status**: active

### AD-002
- **Decision**: Stack único em TypeScript, monólito modular — Next.js + Supabase (Postgres/Auth/Storage/RLS/pgvector) + Claude via SDK TS + n8n (bastidor).
- **Reason**: Uma linguagem ponta a ponta; monólito > microserviços neste tamanho.
- **Trade-off**: Acopla mais que microserviços.
- **Scope**: Stack.
- **Date**: 2026-07-01
- **Status**: active

### AD-003
- **Decision**: Banco de questões de 3 fontes — reais oficiais direto das bancas (fosso), inéditas de IA revisadas, explicações sempre nossas; nunca raspar concorrentes; guardar proveniência.
- **Reason**: Legalidade (ato oficial, art. 8º IV) + qualidade + defensabilidade.
- **Trade-off**: Curadoria manual; validar com advogado antes de escalar.
- **Scope**: M1.
- **Date**: 2026-07-01
- **Status**: active

### AD-004
- **Decision**: Pipeline de ingestão (catálogo → download → extração Claude PDF→JSON → cruza gabarito definitivo/anuladas → classifica na taxonomia → dedup por embedding → QA → explicações → embeddings/índice → publica por flag), em código+Batch, n8n depois.
- **Reason**: Não há API pronta de questões.
- **Trade-off**: Partes inerentemente manuais.
- **Scope**: M1.
- **Date**: 2026-07-01
- **Status**: active

### AD-005
- **Decision**: Schema Supabase/Postgres+pgvector com `questoes` (origem, tipo, gabarito_versao, anulada, status, embedding HNSW + fts) e `explicacoes`; embeddings = Cohere embed-v4 (alt. Voyage).
- **Reason**: Busca híbrida + grounding + dedup.
- **Trade-off**: Trocar embedding = re-embeddar (barato).
- **Scope**: M1/M2.
- **Date**: 2026-07-01
- **Status**: active

### AD-006
- **Decision**: QA misto por fonte — reais = auto-check + amostra/baixa confiança; geradas = 100% revisão no início; aluno reporta erro.
- **Reason**: Confiança sem revisar tudo.
- **Trade-off**: Dado inicial imperfeito.
- **Scope**: M1.
- **Date**: 2026-07-01
- **Status**: active

### AD-007
- **Decision**: Grounding + citação — extração por saída estruturada; explicação por citações do Claude (chamadas separadas); base curada para Conhecimentos Bancários.
- **Reason**: Não ensinar errado.
- **Trade-off**: Duas chamadas; base a construir.
- **Scope**: M2.
- **Date**: 2026-07-01
- **Status**: active

### AD-008
- **Decision**: Geração de inéditas no padrão da banca, etiquetadas, `origem='gerada_ia'`, 100% revisão antes de publicar.
- **Reason**: Volume + treino direcionado.
- **Trade-off**: Custo de revisão.
- **Scope**: M1.
- **Date**: 2026-07-01
- **Status**: active

### AD-009
- **Decision**: Escopo Fase 1 = bancário Cesgranrio+FGV+Cebraspe, ~10 anos; custo de API baixo, custo real = tempo de curadoria.
- **Reason**: Cobre o BB independente da banca.
- **Trade-off**: PDFs antigos/OCR.
- **Scope**: M1.
- **Date**: 2026-07-01
- **Status**: active

### AD-010
- **Decision**: Pré-computa primeiro — IA gerada 1× nos bastidores e servida do banco (custo/aluno ≈ 0); única superfície ao vivo = tutor com trava (rate limit + cache semântico + contexto injetado).
- **Reason**: Custo previsível; core resiste a queda da API.
- **Trade-off**: Menos "mágica ao vivo".
- **Scope**: M2.
- **Date**: 2026-07-01
- **Status**: active

### AD-011
- **Decision**: Modelos por tarefa (gateway trocável + versão fixada + fallback + eval cego PT-BR como porteiro): Sonnet 5 (extração/explicação/diagnóstico), Haiku 4.5 (tutor), GLM 5.2 (rascunho inéditas), DeepSeek V4 Pro (classificação), DeepSeek V4 Flash (frase do plano), Cohere embed-v4 (embeddings).
- **Reason**: Equilíbrio qualidade×preço; o líder muda toda semana.
- **Trade-off**: Manter gateway + evals.
- **Scope**: M2.
- **Date**: 2026-07-01
- **Status**: **superseded pela AD-073** quanto aos **nomes de modelo**. Continua **active** quanto ao **princípio**: gateway trocável + versão fixada + fallback + eval cego PT-BR como porteiro.

### AD-012
- **Decision**: Conferência da explicação pré-computada (1× na fábrica, gravada), dois trilhos — norma citável (documento por etiqueta + citação; base oficial-quando-existe + resumo nosso conferido) e cálculo verificado por código (cruzamento duplo: bate com gabarito e com o texto; refaz 1×, senão humano). Tutor não faz busca ao vivo.
- **Reason**: Não ensinar errado sem custo ao vivo.
- **Trade-off**: Construir base + sandbox de código.
- **Scope**: M2.
- **Date**: 2026-07-02
- **Status**: active

### AD-013
- **Decision**: Feedback do aluno = 2 sinais separados ("foi útil?" → melhora/eval/flywheel; "reportar erro" → fila priorizada por volume); nada muda a explicação sozinho (verdade = gabarito + código + base).
- **Reason**: Aluno é sinal, não autoridade.
- **Trade-off**: Correção depende de humano.
- **Scope**: M2.
- **Date**: 2026-07-02
- **Status**: active

### AD-014
- **Decision**: Áudio TTS gerado 1×/explicação com máxima qualidade; voz por teste cego (lê número/sigla certo), 1 voz, camada trocável — ElevenLabs `eleven_v3` principal + fallback barato; normalização de número/sigla antes da voz; áudio por frequência, refeito quando o texto muda.
- **Reason**: Qualidade num produto bancário; latência não importa.
- **Trade-off**: Voz específica pendente (teste cego).
- **Scope**: M3.
- **Date**: 2026-07-02
- **Status**: active

### AD-015
- **Decision**: `tentativas` = event sourcing (só-INSERT, imutável) + snapshot congelado da etiqueta; todo "estado atual" = projeção recalculável por job; particionada por mês.
- **Reason**: Knowledge tracing/reprocessamento/vários relatórios da mesma base; aposta fundacional.
- **Trade-off**: Camada calculada desde o dia 1; placar com atraso; disciplina de nunca dar UPDATE.
- **Scope**: M4 (fundação de todo o produto).
- **Date**: 2026-07-02
- **Status**: active

### AD-016
- **Decision**: Causa do erro = auto-relato do aluno, obrigatório ao errar, com "não sei dizer" válido; taxonomia enxuta (6 causas + "faltou tempo" só no simulado); dedução automática rebaixada a enriquecimento futuro.
- **Reason**: Só o aluno sabe o porquê; cada causa dispara remédio distinto.
- **Trade-off**: Dado inicial incompleto/enviesado.
- **Scope**: M4.
- **Date**: 2026-07-02
- **Status**: active

### AD-017
- **Decision**: Diagnóstico inicial = teste curto adaptativo-simplificado, opcional (pulável), ~20 questões reais, só semente (log recalibra pra sempre); 1 chamada de IA/aluno escreve o plano inicial.
- **Reason**: Medir sem cansar; não forçar prova na entrada.
- **Trade-off**: Estimativa grosseira no começo (calibra com uso).
- **Scope**: M4/M8.
- **Date**: 2026-07-02
- **Status**: active

### AD-018
- **Decision**: Plano diário 1×/dia, lógica em regra/SQL (IA só escreve a frase); motor de prioridade (quanto cai × fraqueza × devendo revisão); blocos Revisar/Avançar/Treinar/Simulado + intercalação; revisão espaçada régua fixa 1/3/7/14/30 → FSRS com o uso; emite piso + meta cheia.
- **Reason**: Orquestrar as 2 técnicas com mais evidência.
- **Trade-off**: Cold-start do FSRS; "revisar em vez de avançar" precisa ser explicado.
- **Scope**: M4.
- **Date**: 2026-07-02
- **Status**: active

### AD-019
- **Decision**: Raio-X = projeção sobre o banco, conteúdo-primeiro (esqueleto único do edital; banca = coluna); visão combinada (núcleo+condicional) antes da banca; 3 sinais com frequência real mandando; anti-viés (só `origem='real'` como taxa); guarda `n_questoes`+`tendencia`; formato só resolve com a banca.
- **Reason**: Aluno do BB não pode ficar órfão até o edital.
- **Trade-off**: Formato na gaveta.
- **Scope**: M5.
- **Date**: 2026-07-03
- **Status**: active

### AD-020
- **Decision**: Pesos — edital = porteiro binário; frequência real = motor da ordem; atualidade = empurrão com teto (auditável); faixa especial "novo no edital + sinalizado".
- **Reason**: Frequência não pode ser cega a assunto novo de alto valor (Pix).
- **Trade-off**: Faixa/empurrão dependem de julgamento humano.
- **Scope**: M5.
- **Date**: 2026-07-03
- **Status**: active (números **[provisório]**)

### AD-021
- **Decision**: Sinal #3 (atualidade) sem radar de internet; sai de 3 camadas quase de graça (passagem de edital humana + detecção pelo banco ~R$0 + skim leve mensal), registrado em tela de curadoria; rede dupla (se esquecer, a frequência assume).
- **Reason**: Problema pequeno e visível; radar = caro/ruidoso.
- **Trade-off**: Depende de disciplina humana leve.
- **Scope**: M5.
- **Date**: 2026-07-03
- **Status**: active

### AD-022
- **Decision**: "Fazer a prova" = núcleo universal já (reaproveita causa de erro) + módulo de formato na gaveta (A–E × C/E); antes×depois do edital = UMA app lendo perfil de concurso; pivot do edital otimizado (extração+citações → diff por embeddings → humano confere só o diff → propaga com snapshot).
- **Reason**: Girar no mesmo dia do edital; multi-concurso.
- **Trade-off**: Complexidade adiada (fast-follow).
- **Scope**: M5.
- **Date**: 2026-07-03
- **Status**: active

### AD-023
- **Decision**: Gamificação = 4 sinais separados — sequência barra-baixa dentro do plano (piso = revisões); meta/anel; "no prazo" anti-coasting; progresso = ponto de partida (nunca a moeda).
- **Reason**: Motivar sem corromper o método.
- **Trade-off**: AD-018 emite 2 níveis/dia.
- **Scope**: M6.
- **Date**: 2026-07-03
- **Status**: active

### AD-024
- **Decision**: Perdão da sequência generoso — mede compromisso com a agenda do aluno + escudo/folga + reset suave, nunca a zero; isolado do sinal "no prazo".
- **Reason**: Corrige o abandono nº 1 do streak "tudo ou nada"; público ansioso.
- **Trade-off**: Sequência "quase nunca quebra" (aceito).
- **Scope**: M6.
- **Date**: 2026-07-03
- **Status**: active

### AD-025
- **Decision**: Limites da gamificação — notificação leve (teto ~1/dia, tom de treinador, nunca mentir); anti-trapaça (resposta rápida-demais não conta; anel com teto no plano); 100% solo, sem ranking (social opt-in no futuro).
- **Reason**: Ranking é tóxico p/ quem compete por vaga real.
- **Trade-off**: Abre mão do engajamento mais forte.
- **Scope**: M6.
- **Date**: 2026-07-03
- **Status**: active

### AD-026
- **Decision**: Base legal por finalidade — contrato (operar), legítimo interesse +LIA+ transparência+opt-out (flywheel), consentimento (marketing); núcleo nunca atrás de checkbox; consentimento granular = não.
- **Reason**: Separar usos; proteger ativação.
- **Trade-off**: LIA a redigir; legítimo interesse cai sem transparência.
- **Scope**: M7.
- **Date**: 2026-07-03
- **Status**: active

### AD-027
- **Decision**: 3 grupos de dado — (1) operacional com nome (some no DELETE), (2) estatística somada anônima (art. 12, sobrevive), (3) sequência pseudonimizada (código, some no DELETE, fast-follow). Dia 1 = grupos 1+2.
- **Reason**: O valor do flywheel está no agregado; "anônimo" tem de ser merecido.
- **Trade-off**: Knowledge tracing (grupo 3) adiado.
- **Scope**: M7.
- **Date**: 2026-07-03
- **Status**: active

### AD-028
- **Decision**: Retenção — com-nome vive conta ativa + 24 meses → anonimiza p/ grupo 2 e apaga; agregado anônimo pra sempre; fiscal pelo prazo legal (~5–11 anos).
- **Reason**: Ciclo anual do concurso; guardar só enquanto serve.
- **Trade-off**: Janela precisa ser escrita/avisada.
- **Scope**: M7.
- **Date**: 2026-07-04
- **Status**: active (números confirmar c/ advogado/contador)

### AD-029
- **Decision**: Direito ao esquecimento — DELETE apaga com-nome (grupo 1) + código (grupo 3), inclusive backups (~15–30 dias); agregado anônimo (grupo 2) sobrevive (art. 12); faturas ficam. Travas: ≥ ~20 respondentes + apagar backups.
- **Reason**: Convive o "apaga tudo meu" com manter o aprendizado somado.
- **Trade-off**: Disciplina de backup + piso de respondentes.
- **Scope**: M7.
- **Date**: 2026-07-04
- **Status**: active

### AD-030
- **Decision**: Flywheel = 3 esteiras (1 automática: dificuldade/frequência/índice de discriminação; 2 IA peneira+pré-diagnostica, humano confirma ~1h/sem; 3 100% humano raro = mudar gabarito); acesso mínimo por RLS + trilha de auditoria; automação só no seguro.
- **Reason**: Não analisar questão por questão; proteger o "não ensinar errado".
- **Trade-off**: Discriminação só confia com volume (cold-start = amostra).
- **Scope**: M7.
- **Date**: 2026-07-04
- **Status**: active

### AD-031
- **Decision**: Paga-primeiro (paywall) + compra anual 12x no cartão + porta Pix/boleto à vista + garantia 7 dias; preço-âncora ~R$197/ano.
- **Reason**: Caixa imediato + filtro de sério + trava o valor de compounding por 1 ano.
- **Trade-off**: Paywall converte pouco do topo (mitigado por garantia + Pix).
- **Scope**: M8.
- **Date**: 2026-07-04
- **Status**: active (**provisório** — "pode mudar"; mensal Leitura B guardada p/ futuro)

### AD-032
- **Decision**: Um plano único no lançamento (sem tiers).
- **Reason**: Checkout simples converte mais; sem dado ainda p/ desenhar tier; produto fino; tutor já cercado por rate limit; tier é trivial depois.
- **Trade-off**: Deixa dinheiro de mentoria/humano na mesa (upsell futuro).
- **Scope**: M8.
- **Date**: 2026-07-04
- **Status**: active

### AD-033
- **Decision**: Gateway Asaas em checkout próprio (Pix + boleto + cartão 12x + NF nativa + webhook + antecipação).
- **Reason**: Único que faz tudo num lugar, nacional, sem mensalidade; NF = decisivo.
- **Trade-off**: Confirmar tabela do cartão + CNPJ/regime p/ NF.
- **Scope**: M8.
- **Date**: 2026-07-04
- **Status**: active

### AD-034
- **Decision**: Auth Supabase, fluxo buy-then-activate (paga → webhook cria conta + matrícula 12 meses → e-mail define senha → onboarding meta+diagnóstico → plano do 1º dia); login e-mail+senha + Google + link mágico.
- **Reason**: Menor atrito; "só e-mail e paga".
- **Trade-off**: O "uau" pré-compra mora na página de vendas (método + evidências + garantia).
- **Scope**: M8.
- **Date**: 2026-07-04
- **Status**: active

### AD-035
- **Decision**: Infra Vercel + Supabase Cloud (São Paulo), gerenciado; trabalho longo FORA do serverless (fábrica em scripts+Batch; jobs leves em pg_cron; tutor por streaming); n8n adiado; backup ~30 dias alinhado ao DELETE (AD-029); staging por branch.
- **Reason**: 3 devs sem ops; Postgres particionado + pooler aguentam.
- **Trade-off**: Disciplina de onde cada carga roda.
- **Scope**: M9.
- **Date**: 2026-07-04
- **Status**: active

### AD-036
- **Decision**: A fábrica pesada (extração PDF, explicações, embeddings, áudio, inéditas) roda em **scripts standalone disparados por GitHub Actions** (workflows agendados/manuais) + Batch API — nunca em função da Vercel. Jobs da fábrica são retomáveis por chave de dedup (submeter+poll).
- **Reason**: 3 devs sem ops; sem servidor pra manter; segredos geridos (GitHub Secrets); reproduzível e registrado; Batch é submeter+aguardar, encaixa.
- **Trade-off**: Latência de agendamento do Actions; disciplina de idempotência.
- **Scope**: M9 (contrato p/ M1/M2/M3 — todo pipeline pesado tem esse lar).
- **Date**: 2026-07-23
- **Status**: active

### AD-037
- **Decision**: Observabilidade da aplicação = **Sentry** (erros de front/servidor Next.js, com contexto e alerta) + **logs nativos** Vercel/Supabase + **advisors** Supabase (segurança/performance). Falha de pg_cron ou de workflow GitHub Actions SHALL ser visível/alertada, nunca silenciosa. Distinta da trilha de auditoria LGPD (D30/AD-030, M7).
- **Reason**: Produção sem ops precisa de erro visível e alertável; Sentry tem free tier e é padrão da stack.
- **Trade-off**: Mais uma integração; custo do Sentry acima do free tier no futuro.
- **Scope**: M9 (transversal — todas as features reportam erro por aqui).
- **Date**: 2026-07-23
- **Status**: active

### AD-038
- **Decision**: Retenção de backup = **7 dias** (backup diário padrão do Supabase Pro), sem PITR. O DELETE-por-esquecimento (D29/AD-029) some dos backups por **expiração natural em ≤7 dias**, cumprindo o prazo "~15–30 dias" com folga. RPO ≈ até 24h; sem recuperação a ponto arbitrário. **Refina o "~30 dias" do AD-035** (AD-035 permanece; este ajusta o número após Discuss).
- **Reason**: Mais barato (sem add-on PITR) e retenção menor cumpre o DELETE-dos-backups mais rápido (melhor p/ LGPD).
- **Trade-off**: Janela de recuperação de desastre menor (7d, RPO ~24h) do que 30d/PITR.
- **Scope**: M9/M7 (contrato de retenção que a spec de LGPD herda).
- **Date**: 2026-07-23
- **Status**: active

### AD-039
- **Decision**: Contrato de identidade/versionamento de `questoes` que M4/M2 herdam: `id` estável (uuid) + `questao_versao` (int, começa 1). Correção de questão publicada (inclusive retificação/mudança de gabarito, decisão humana D30) = **nova versão**, nunca reescreve a anterior; `tentativas` (M4) referencia `questao_id`+`questao_versao` e segue apontando p/ a versão respondida. Enums fixos: `tipo_questao ∈ {multipla_escolha, certo_errado}`, `origem ∈ {real, gerada_ia}`, `status ∈ {rascunho, em_revisao, publicada, rejeitada, precisa_ocr}`.
- **Reason**: O log imutável do M4 exige que o fato respondido nunca mude sob os pés; enums estáveis são o snapshot congelado.
- **Trade-off**: Guardar múltiplas versões da mesma questão; projeções recalculam em cima.
- **Scope**: M1 (contrato p/ M4 snapshot + M2 explicação + M7 flywheel).
- **Date**: 2026-07-23
- **Status**: active

### AD-040
- **Decision**: Formato de dados da questão: `alternativas` jsonb = array `[{ "letra": "A|B|C|D|E", "texto": "..." }]` p/ `multipla_escolha`, `null` p/ `certo_errado`; `resposta_correta` = letra (A–E) p/ múltipla ou `C`/`E` p/ certo-errado; `imagens` jsonb = array `[{ "storage_path", "posicao": "enunciado|alternativa_X", "alt_text" }]` (Supabase Storage); `fonte_citacao` (banca/ano/órgão/cargo/número) obrigatório quando `origem='real'`; `dificuldade` = `smallint` 1–5 estimada pela IA no MVP, calibra pelo uso (grupo 2, M7); `embedding` (Cohere embed-v4, HNSW) + `fts` (tsvector PT) = busca híbrida.
- **Reason**: Contrato único de leitura p/ M2 (grounding/explicação), M4 (renderizar questão) e M5 (Raio-X).
- **Trade-off**: Escala de dificuldade 1–5 é grosseira no cold-start.
- **Scope**: M1 (formato herdado por M2/M4/M5).
- **Date**: 2026-07-23
- **Status**: active

### AD-041
- **Decision**: Escopo M1-MVP fechado no Discuss: (1) questões com **imagem** → extrair a imagem pro **Supabase Storage** e servir desde o dia 1 (`imagens` populado); (2) provas **escaneadas** (sem texto nativo) → **adiadas**, entram em `status='precisa_ocr'` (fast-follow), MVP ingere só texto nativo; (3) **inéditas** (`gerada_ia`) fora da leva de lançamento (§4.1 = só reais), permanecem P2.
- **Reason**: Acervo real nativo limpo primeiro, com imagens completas; OCR e inéditas adicionam erro/curadoria e ficam p/ depois.
- **Trade-off**: Provas antigas escaneadas ficam de fora no lançamento; acervo inicial menor.
- **Scope**: M1.
- **Date**: 2026-07-23
- **Status**: active

### AD-042
- **Decision**: Contrato do log `tentativas` (fundação de todo o produto): **só-INSERT**, nunca UPDATE nem DELETE-por-edição (DELETE por `user_id` permitido — LGPD). Colunas: quem/o quê (`user_id`, `questao_id`, `questao_versao`); **snapshot congelado** no insert (`materia_id`+rótulo, `topico_id`+rótulo, `banca`, `tipo_questao`, `dificuldade`, `origem`); contexto (`sessao_id`, `contexto ∈ {diagnostico, plano, treino, simulado, revisao}`); resultado (`resposta_dada`, `correta`); sinais crus (`tempo_ms`, `marcou_chute`); causa no treino (`causa_erro`, `causa_origem` — no próprio insert); tempo (`respondida_em`). Particionada por mês (INFRA-04). Snapshot guarda id **e** rótulo congelado p/ reclassificação futura não deslocar o histórico. Todo "estado atual" = projeção recalculável do zero.
- **Reason**: Event sourcing = auditoria + reprocessamento + várias projeções da mesma base (AD-015).
- **Trade-off**: Camada calculada desde o dia 1; placar com atraso; disciplina de nunca dar UPDATE.
- **Scope**: M4 (contrato herdado por M5 Raio-X, M6 hábito, M7 flywheel/grupos de dado).
- **Date**: 2026-07-23
- **Status**: active

### AD-043
- **Decision**: Taxonomia de causa do erro = auto-relato do aluno (`causa_origem='aluno'` no MVP; dedução IA rebaixada a 'sistema' futuro). Enum das **6 causas + "não sei"**: `nao_sabia_conteudo`, `errei_a_conta`, `entendi_errado_enunciado`, `confundi_conceitos`, `fiquei_na_duvida`, `chutei`, `nao_sei_dizer`; causa extra `faltou_tempo` **só** em `contexto='simulado'`. **Momento/gravação (respeita só-INSERT AD-042)**: no **treino** a causa entra no próprio INSERT da tentativa (obrigatória ao errar, antes de avançar); no **simulado** a causa é coletada na revisão pós-prova e gravada em **linha/tabela vizinha** ligada à tentativa — nunca UPDATE no fato. Cada causa amarra um remédio distinto no plano.
- **Reason**: Só o aluno sabe o porquê; cada causa dispara ação diferente; só registra causa que muda o plano (D16).
- **Trade-off**: Dado inicial incompleto/enviesado; encorpa com o uso.
- **Scope**: M4 (herdado por caderno de erros, motor do plano, M7).
- **Date**: 2026-07-23
- **Status**: active

### AD-044
- **Decision**: Projeções do M4 (read models recalculáveis, NÃO fonte da verdade): `dominio_topico` (user↔tópico↔score↔n), `caderno_erros` (projeção sobre `correta=false`+`causa_erro`), agenda de revisão espaçada. Revisão espaçada opera **por assunto/tópico** — régua fixa 1/3/7/14/30 como piso, migra p/ **FSRS por aluno e por assunto** quando o log encher. Motor de prioridade = quanto cai (Raio-X/M5) × fraqueza (log) × devendo-revisão. Plano diário roda por job pg_cron 1×/dia, escolha em regra/SQL (IA só a frase, 1 chamada Sonnet), e **emite dois níveis: `piso` e `meta_cheia`** (contrato que M6 consome). Placar atualizado por job (pequeno atraso), nunca ao vivo. Chute correto (`marcou_chute`) descontado do domínio; anulada não conta.
- **Reason**: Orquestrar as 2 técnicas com mais evidência; pré-computa primeiro (invariantes #6/#7).
- **Trade-off**: Cold-start do FSRS; "revisar em vez de avançar" precisa ser explicado ao aluno.
- **Scope**: M4 (piso/meta herdados por M6; nota Raio-X vem de M5; projeções por M7).
- **Date**: 2026-07-23
- **Status**: active

### AD-045
- **Decision**: Retenção do dado com-nome = **comportamento fixo, número parametrizado**: conta inativa por `retencao_meses` (default **24**, em configuração) contados da última atividade **ou** do fim da matrícula (o que for mais recente) → consolida no grupo 2 e apaga o grupo 1. Aviso ao titular **30 dias antes**; login dentro da janela reinicia o relógio. A política de privacidade lê o número da **mesma** configuração (política e código nunca divergem). **Refina AD-028** (que permanece; este parametriza o número pendente de validação jurídica).
- **Reason**: Discuss 2026-07-23 — o advogado ainda não validou 24m; travar o número em código obrigaria mudar código depois.
- **Trade-off**: Um parâmetro a mais para governar; a política vira conteúdo dinâmico.
- **Scope**: M7 (herdado por M8 — fim da matrícula alimenta o relógio).
- **Date**: 2026-07-23
- **Status**: active (número **[provisório]** — confirmar advogado)

### AD-046
- **Decision**: Grupo 2 (estatística somada anônima) = **acumulador materializado** (contadores por questão/tópico incrementados por job idempotente com marca d'água), **NÃO** projeção recalculável do zero — porque precisa preservar a contribuição de quem já exerceu o DELETE (art. 12). **Exceção deliberada ao AD-015/AD-044**. `piso_anonimato` (default **20**, em configuração) é regra dura: abaixo do piso, o agregado é indisponível — não exibe, não usa como sinal. DELETE **não decrementa** o acumulador.
- **Reason**: Sem isso o "apaga tudo meu" destruiria o aprendizado coletivo e o art. 12 não se cumpriria; forçado por lei, não é escolha de arquitetura.
- **Trade-off**: Após DELETEs, um rebuild total do log daria números menores que o acumulador — o acumulador é a autoridade do grupo 2.
- **Scope**: M7 (contrato p/ M5 Raio-X e M4 calibração de dificuldade, que consomem o grupo 2).
- **Date**: 2026-07-23
- **Status**: active

### AD-047
- **Decision**: Menores de idade = **declaração afirmativa de 18+ no checkout** (registrada com data/hora) + termos declarando serviço para maiores + canal do titular para o responsável pedir exclusão. **SHALL NOT** coletar data de nascimento para essa finalidade (minimização). Resolve a questão aberta nº10 do PRD.
- **Reason**: Discuss 2026-07-23 — cobre a obrigação sem atrito no checkout de e-mail-só (AD-034) e sem criar mais um dado pessoal.
- **Trade-off**: Não impede tecnicamente um menor de comprar; depende da declaração.
- **Scope**: M7 (requisito que **M8 implementa no checkout**).
- **Date**: 2026-07-23
- **Status**: active

### AD-048
- **Decision**: Auto-aplicação de correção pela IA (deferido do D30) = permitida **só** numa **lista fechada, explícita, versionada em config**, com toda ação **reversível em um passo** e **auditada**. Lista inicial = **apenas** "aposentar distrator com 0 marcações em ≥N respostas" (N configurável e alto), exigindo também `n_respondentes >= piso_anonimato`. Ampliar a lista = decisão humana registrada (novo AD), nunca inferência da IA. Gabarito/enunciado/explicação continuam 100% humanos (invariantes 4 e 10).
- **Reason**: Discuss 2026-07-23 — ganha velocidade de curadoria sem abrir a porta para automação mexer no que se ensina.
- **Trade-off**: Cold-start: com poucos alunos o sinal "ninguém marcou" é fraco — por isso N alto + piso.
- **Scope**: M7 (esteira 2; consome contrato de versionamento AD-039 do M1).
- **Date**: 2026-07-23
- **Status**: active

### AD-049
- **Decision**: Matriz de modelos por tarefa **pesquisada em 2026-07-23** (OpenRouter, preços USD/M tokens entrada/saída) e fixada em **configuração** — nenhum requisito/teste depende do nome:
  · extração de PDF → `anthropic/claude-sonnet-5` (SDK direto, $2/$10, Batch −50%) — único com PDF nativo + citações + execução de código; text-only (DeepSeek/GLM/Qwen-max) é **desqualificado** aqui
  · explicação → `anthropic/claude-sonnet-5` (Batch)
  · reprocessamento do "refaz 1×" → `anthropic/claude-opus-4.8` ($5/$25)
  · classificação no tópico → `deepseek/deepseek-v4-pro` ($0,435/$0,87); fallback `minimax/minimax-m3` ($0,30/$1,20)
  · frase do plano diário → `minimax/minimax-m3`
  · tutor → `minimax/minimax-m3` (ver AD-051)
  · rascunho de inéditas (P2) → `z-ai/glm-5.2` ($0,78/$2,45)
  · embeddings → **Cohere embed-v4, chamada direta — NÃO passa pelo gateway** (confirmado 2026-07-23: OpenRouter não serve embeddings)
  Acrescenta ao AD-011: **rotina periódica** (default trimestral) de revisar a matriz — puxar preços/opções, rodar o eval cego, trocar se houver ganho; data da última revisão registrada. Eval cego PT-BR continua porteiro obrigatório em tarefa sensível. Custo estimado da fábrica: **< US$100 uma vez** p/ ~10 mil questões.
- **Reason**: Discuss 2026-07-23 — o usuário pediu pesquisa de modelos/custos atuais antes de decidir; AD-011 estava [provisível] sem números.
- **Trade-off**: Nomes envelhecem em semanas; a rotina de revisão é a mitigação. Preço do Cohere embed-v4 **não confirmado** (página de pricing só mostra Model Vault).
- **Scope**: M2 (herdado por M1 extração e M4 frase do plano).
- **Date**: 2026-07-23
- **Status**: **superseded pela AD-073** (2026-08-04) quanto à **matriz de modelos e ao custo estimado**. Continua **active** quanto à **rotina trimestral de revisão da matriz** e ao **eval cego como porteiro**, que a AD-073 herda. A justificativa "Sonnet é o único com PDF nativo + citações + execução de código" caiu: execução de código morreu na AD-069, PDF a Luna atende, e as citações foram substituídas pela AD-075.

### AD-050
- **Decision**: Tópico **sem documento de referência** montado → a fábrica **publica** a explicação usando **prova + gabarito oficial** como fonte mínima (ambos são ato oficial, AD-003); a IA pode explicar o raciocínio da questão mas **SHALL NOT** afirmar norma, prazo, percentual ou regra externa que não esteja no material entregue; o tópico entra na fila de construção da base, priorizada por **frequência real**.
- **Reason**: Discuss 2026-07-23 — a base de referência é construída por frequência (PRD §10.8) e não cobre tudo no dia 1; travar a publicação encolheria demais o acervo de lançamento.
- **Trade-off**: Explicação de tópico sem base é mais rasa (raciocínio sem citação de norma).
- **Scope**: M2 (afeta o volume publicável do M1).
- **Date**: 2026-07-23
- **Status**: active

### AD-051
- **Decision**: **Tutor ao vivo ENTRA no MVP (P1)** — muda o `PRD.md` §4.2, que o listava como fast-follow. Configuração: modelo `minimax/minimax-m3`; **teto de 3 perguntas/aluno/dia** (config); **cache de pergunta repetida** na mesma questão (não reaproveita entre questões diferentes); contexto injetado = explicação+fontes já aprovadas, **zero busca ao vivo**; streaming (AD-035). Custo: pior caso absoluto ~US$100/mês com 1.000 alunos; realista ~US$10–17. **Alerta** de gasto mensal ao ultrapassar o limite configurado, **sem desligamento automático** (escolha explícita do usuário). Perguntas do tutor vivem em tabela própria (grupo 1 LGPD), **nunca** em `tentativas`.
- **Reason**: Discuss 2026-07-23 — o usuário optou por lançar com o tutor; a análise de custo mostrou que o teto diário, não o modelo, é a trava que importa (baixar 10→5→3 corta o custo proporcionalmente).
- **Trade-off**: Única peça com custo variável por aluno e única que degrada se a API cair; sem freio automático, o pior caso não tem teto em dinheiro (só teto de perguntas).
- **Scope**: M2 (consome contrato de M4/M7; entra no escopo do MVP §4.1).
- **Date**: 2026-07-23
- **Status**: active — **exceto o modelo**: `minimax/minimax-m3` foi substituído por `gpt-5.6-luna` com esforço **`medium`** (AD-073). Todo o resto (teto de 3/dia, cache de pergunta repetida, contexto injetado, streaming, alerta sem desligamento, tabela própria do grupo 1) permanece. O esforço `medium` é decisão consciente: o tutor é a única superfície ao vivo e tokens de raciocínio custam latência antes da primeira palavra.

### AD-052
- **Decision**: Explicação amarrada a `questao_id` + `questao_versao` (AD-039), com versão e `status` próprios. Nova versão da questão por mudança de **gabarito, enunciado ou alternativas** → explicação **invalidada imediatamente** (sai do ar), regerada e só volta após **revisão humana**; o áudio é descartado e refeito (AD-014). Mudança **cosmética** (typo/formatação/acento) → explicação segue válida, sem regerar. A classificação cosmética×substantiva é **registrada por quem cria a versão** (campo do M1), nunca inferida depois pela IA. Tentativas já gravadas seguem apontando para a versão respondida.
- **Reason**: Discuss 2026-07-23 — sem isso, uma retificação de gabarito deixaria explicação errada no ar; refazer tudo queimaria revisão humana e TTS à toa.
- **Trade-off**: Exige um campo de classificação da mudança no fluxo de edição do M1.
- **Scope**: M2 (contrato herdado por M1 — campo na criação de versão — e por M3 — refazer áudio).
- **Date**: 2026-07-23
- **Status**: active

### AD-053
- **Decision**: Preço = **comportamento fixo, valor parametrizado**. Fixo: um plano único anual, 12x no cartão, Pix/boleto à vista, garantia 7 dias. Parametrizado: **R$197/ano** como âncora no cartão parcelado + **desconto de ~10% à vista** (ex.: **R$177** no Pix/boleto), ambos em configuração e exibidos lado a lado no checkout. Taxas Asaas pesquisadas em 2026-07-23: Pix R$1,99 · boleto R$1,99 · cartão à vista R$0,49+2,99% · **7–12x R$0,49+3,99%** · antecipação 1,25%/mês à vista e **1,70%/mês parcelado** · NF R$0,49 · sem mensalidade/adesão · cartão à vista D+32. Líquido: Pix ≈ R$174,52 · cartão 12x sem antecipar ≈ R$188,16 · cartão 12x antecipando tudo ≈ ~R$167. **Refina AD-031** (que permanece; este parametriza e acrescenta o desconto à vista). Mudança de preço **não** afeta matrículas já vendidas.
- **Reason**: Discuss 2026-07-23 — AD-031 estava [provisório]; o desconto à vista rende mais líquido **e** antecipa o caixa (Pix entra na hora, cartão 12x pinga por 12 meses).
- **Trade-off**: Duas tabelas de preço na página de vendas; margem menor em quem migra pro Pix (compensada pelo caixa).
- **Scope**: M8 (número herdado pela página de vendas e pelo checkout).
- **Date**: 2026-07-23
- **Status**: active (número **[provisório]** — estrutura confirmada)

### AD-054
- **Decision**: Venda dentro da **janela de garantia de 7 dias** SHALL ficar marcada **não-antecipável** e SHALL NOT entrar em nenhuma solicitação de antecipação de recebíveis. Passada a janela sem reembolso, a venda vira antecipável e antecipar é **decisão manual** do time (nunca automática), apoiada por relatório do que está antecipável com líquido estimado. **Resolve a questão aberta nº9 do PRD.**
- **Reason**: Discuss 2026-07-23 — antecipar custa ~11% da venda (1,70%/mês × ~6,5 meses de espera média das 12 parcelas) e esse custo **não volta** num reembolso; esperar 7 dias elimina o buraco sem abrir mão da antecipação.
- **Trade-off**: Caixa das vendas fica retido 7 dias antes de poder ser antecipado.
- **Scope**: M8.
- **Date**: 2026-07-23
- **Status**: active

### AD-055
- **Decision**: Fim dos 12 meses de matrícula = **avisos em 30 e 7 dias** antes com oferta de renovação; no vencimento o **acesso ao conteúdo encerra**; **SHALL NOT** haver cobrança automática de renovação (venda única, AD-031/AD-032). O **histórico do aluno é preservado** (log, projeções, caderno) e o relógio de retenção do M7 passa a contar **a partir do fim da matrícula** (AD-045); renovar dentro da janela traz tudo de volta e reinicia o relógio. Avisos de vencimento são **transacionais** — não dependem do consentimento de marketing (DADOS-01). **Resolve a questão aberta nº5 do PRD.**
- **Reason**: Discuss 2026-07-23 — concurso é anual e o aluno volta; cobrança automática contradiz o modelo de venda única e gera chargeback.
- **Trade-off**: Receita de renovação não é automática — depende da oferta converter.
- **Scope**: M8 (amarra com M7/AD-045 e com as projeções do M4).
- **Date**: 2026-07-23
- **Status**: active

### AD-056
- **Decision**: Fórmula da frequência real do Raio-X: (a) **decaimento gradual por ano** — cada questão entra na taxa com peso decrescente conforme o ano fica mais antigo (fator/meia-vida em configuração), **sem janela de corte** e sem nenhum ano virando zero; (b) **amortecimento por amostra pequena** — quando `n_questoes` é baixo, a taxa usada na ordenação é puxada em direção à média geral dos tópicos daquela banca, com força inversamente proporcional à amostra (constante em config), e a linha recebe `amostra_baixa=true` + rótulo na tela. Tópico no edital com `n_questoes=0` recebe a média amortecida, **nunca zero** (zerar é exclusividade do porteiro). **Refina AD-019/AD-020**, que estavam `[provisório]`.
- **Reason**: Discuss 2026-07-23 — banca muda devagar (corte brusco descarta acervo curado) e taxa de 3 aparições em 10 anos pode ser coincidência; sem amortecimento o motor do plano manda o aluno gastar semanas em assunto raro.
- **Trade-off**: Dois parâmetros a calibrar (fator de decaimento, constante do amortecimento); nota amortecida é menos intuitiva de explicar que contagem crua.
- **Scope**: M5 (fator "quanto cai" herdado pelo motor de prioridade do M4).
- **Date**: 2026-07-23
- **Status**: active (números **[provisório]** — comportamento fixo, valores em configuração)

### AD-057
- **Decision**: Os dois cortes do Raio-X são **por posição**, não por valor absoluto: (a) **teto do empurrão de atualidade** — o empurrão SHALL NOT levar o tópico acima do percentil-teto configurado da lista; a **única** via que ultrapassa é a faixa especial "novo no edital **E** sinalizado"; todo empurrão tem autor, motivo, **validade** e é reversível em um passo, expirando sozinho se não for renovado; (b) **corte núcleo × condicional** — tópico é "forte" numa banca quando está acima do corte de posição **dentro daquela mesma banca** (percentil em config), e não por um % absoluto igual para as três; forte nas 3 = `nucleo`, forte em 1–2 = `condicional` com rótulo visível. **Refina AD-020**.
- **Reason**: Discuss 2026-07-23 — teto por posição é auditável na tela e independe da escala da nota; corte por posição se auto-ajusta a banca com acervo grande ou pequeno (limite absoluto penalizaria banca de prova curta).
- **Trade-off**: Percentis mudam quando a lista muda de tamanho; exige recalcular o corte a cada execução.
- **Scope**: M5.
- **Date**: 2026-07-23
- **Status**: active (percentis **[provisório]** — estrutura confirmada)

### AD-058
- **Decision**: Escudos da sequência são ganhos **por constância** — 1 escudo a cada N dias de agenda cumpridos (default 7) — com **teto de 2** guardados; gasto **automático** e informado ao aluno quando um dia da agenda é perdido. Escudos SHALL NOT ser compráveis, transferíveis nem obtidos por assistir anúncio.
- **Reason**: Discuss 2026-07-23 — prende a proteção ao esforço; quem está falhando para de ganhar escudo justamente quando mais usaria, o que impede virar licença para sumir.
- **Trade-off**: Aluno de rotina muito irregular acumula pouca proteção, que é o caso em que ele mais precisaria.
- **Scope**: M6.
- **Date**: 2026-07-23
- **Status**: active (números em configuração)

### AD-059
- **Decision**: Reset suave = **congela + janela**. Sem escudo disponível, a sequência **congela** no valor atual, é marcada como **tropeçada** e abre uma **janela de recuperação** (default 3 dias); cumprir a **`meta_cheia`** dentro da janela faz a contagem **retomar de onde parou**; a janela vencer faz a sequência cair, com **piso de queda em config — nunca a zero**. O consumo de escudo e o tropeço SHALL ser reproduzíveis de forma determinística no recálculo da projeção.
- **Reason**: Discuss 2026-07-23 — segunda chance com prazo claro e reconquistável; corrige o abandono nº1 do streak "tudo ou nada" sem apagar o construído.
- **Trade-off**: Mais estado a reconstruir na projeção (escudo, tropeço, janela) do que um contador simples.
- **Scope**: M6 (consome `meta_cheia` de AD-044/ALUNO-11).
- **Date**: 2026-07-23
- **Status**: active

### AD-060
- **Decision**: Anti-"clique automático" **sem trava de tempo**. O anel do dia conta **bloco do plano concluído** (Revisar/Avançar/Treinar), **não** questão respondida, e um bloco só fecha quando **cada erro teve a causa declarada** (obrigação que o M4 já impõe, AD-043 — "não sei dizer" conta como causa válida). Nenhuma resposta SHALL ser descartada por ter sido rápida. `tempo_ms` continua **gravado** no log (AD-042) e disponível para relatório interno, mas **SHALL NOT** ser porteiro do anel nem da sequência. **Substitui** a cláusula "resposta rápida demais não conta" do **AD-025** (o resto do AD-025 — teto no plano, notificação leve, sem ranking — permanece).
- **Reason**: Discuss 2026-07-23 — o usuário recusou a trava por tempo: ela invalida em silêncio resposta possivelmente legítima e o aluno não descobre por quê. O freio já existe de graça: quem clica no automático erra quase tudo e é interrompido a cada erro para escolher uma causa.
- **Trade-off**: Um aluno disposto a declarar causa falsa em cada erro consegue fechar blocos sem estudar; aceito porque os dois sinais honestos (progresso e "no prazo") leem acerto real e denunciam.
- **Scope**: M6 (consome AD-043 do M4; altera o critério de aceite do `PRD.md` §M6).
- **Date**: 2026-07-23
- **Status**: active

### AD-061
- **Decision**: O sinal "no prazo" tem **dois modos**: com `data_prova` no perfil de concurso, compara ritmo de cobertura do edital × tempo restante; **sem** `data_prova` (situação atual do BB), vira **ritmo de avanço** — mede se o aluno abriu conteúdo novo (bloco Avançar) dentro da janela configurada ou está só revisando, **sem afirmar nada** sobre cobrir o edital a tempo. A troca de modo é **automática** quando a data entra no perfil. O sinal **SHALL NOT** ser congelável por escudo, folga ou perdão (o perdão vale só para a sequência) nem usar estimativa apresentada como fato para criar urgência.
- **Reason**: Discuss 2026-07-23 — o BB está sem edital e o D25 proíbe fabricar urgência; desligar o sinal removeria a trava anti-acomodamento justamente nos meses em que o aluno mais tende a só revisar.
- **Trade-off**: No modo sem data, o sinal é mais fraco (fala de ritmo, não de suficiência).
- **Scope**: M6 (lê `data_prova` de M5/AD-022).
- **Date**: 2026-07-23
- **Status**: active

### AD-062
- **Decision**: A voz do TTS vive em **configuração** (provedor + voz) e **nenhum requisito, teste ou código cita qual é**; o **teste cego de escuta é porteiro do primeiro lote** — com a configuração de voz vazia ou não travada, o job de geração em massa **SHALL recusar-se a rodar** com mensagem explícita e **SHALL NOT** escolher voz padrão sozinho. A escolha é registrada com **data, critério e responsável**; o critério é a leitura correta de número/valor/percentual/sigla em **português**, nunca ranking geral de qualidade. Trocar a voz depois coloca todo o acervo de áudio na fila de refazer, com o custo apresentado antes da confirmação. **Refina AD-014**.
- **Reason**: Discuss 2026-07-23 — gerar milhares de arquivos com uma voz provisória e trocar depois obriga refazer tudo; travar o lote transforma uma pendência humana em porteiro explícito em vez de risco silencioso.
- **Trade-off**: O lote fica bloqueado por uma tarefa humana de escuta (ferramenta já pronta em `experiments/tts-comparacao/`).
- **Scope**: M3.
- **Date**: 2026-07-23
- **Status**: active (voz específica **pendente** — 8 candidatas ElevenLabs do D14)

### AD-063
- **Decision**: O áudio narra **a questão inteira e a explicação num arquivo contínuo** — enunciado, alternativas (ou a formulação Certo/Errado quando `alternativas` é null) e explicação, com transição audível entre questão e resposta. O áudio **narra, não interpreta**: SHALL NOT reescrever, resumir ou acrescentar conteúdo. **Questão com `imagens` não vazio (gráfico/tabela/figura) SHALL NOT receber áudio** no MVP; fica marcada com o motivo e a interface informa que é só de leitura. Amarração de versão passa a ser `questao_id` + `questao_versao` + `explicacao_versao` (mudança em **qualquer** um invalida o áudio).
- **Reason**: Discuss 2026-07-23 — áudio que começa na explicação só serve para quem já leu a questão, ou seja, para quem está em frente à tela, o que anula a razão de existir do módulo.
- **Trade-off**: ~2,5× mais caracteres por item (ver AD-065) e um ciclo de vida a mais para controlar; questões com figura ficam sem áudio.
- **Scope**: M3 (consome AD-040 do M1 e AD-052 do M2).
- **Date**: 2026-07-23
- **Status**: active

### AD-064
- **Decision**: **M3 é fast-follow** — pipeline completo construído e mantido **atrás de feature flag**; a geração em lote roda **depois do lançamento**, quando o acervo de explicações estabilizar. Com a flag desligada, nenhuma tela promete áudio e o produto funciona integralmente. A fila é ordenada pela **frequência real** (M5/RAIOX-15) e cada execução em lote declara um **teto de gasto** que, ao ser atingido, **interrompe o lote** de forma limpa e retomável (diferente do tutor/AD-051, onde parar não era aceitável). Confirma o risco nº4 do `PRD.md` §10 e resolve a ambiguidade entre "P1 do módulo" e "fast-follow".
- **Reason**: Discuss 2026-07-23 — nas primeiras semanas a taxa de correção de explicação é máxima e cada correção descarta e refaz o áudio (AD-052); gerar cedo é pagar duas vezes, além de colocar a escuta das vozes no caminho crítico do lançamento e adiantar milhares de dólares antes de haver receita.
- **Trade-off**: O argumento de venda "estude no trânsito" não existe no dia do lançamento.
- **Scope**: M3.
- **Date**: 2026-07-23
- **Status**: active

### AD-065
- **Decision**: Provedor de voz — **ElevenLabs `eleven_v3` permanece principal** (única evidência real em pt-BR: teste de 19 vozes do D14) e o **slot de reserva fica deliberadamente vazio (standby)**: a camada trocável é construída, mas nenhum segundo provedor é fixado agora; com o slot vazio e o principal falhando, o lote **para de forma visível** em vez de improvisar. Entram registrados como candidatos à próxima rodada de teste cego dois entrantes que **não existiam** na rodada do D14 e **não têm qualidade em pt-BR verificada**: **Inworld TTS-1.5 Max** (~US$10/1M chars) e **Hume Octave 2** (~US$7,60/1M). **Custo do lote de lançamento revisado** (pesquisa 2026-07-23): com AD-063 (questão+explicação, ~1.800 chars/item) e ~10 mil questões ≈ **18M caracteres** → ElevenLabs **~US$1.800–3.700**, faixa de US$30/1M (Deepgram Aura-2 / Google Chirp 3 HD / Polly Generative) ~US$540, faixa de US$15/1M (Fish via Novita, OpenAI gpt-4o-mini-tts) ~US$270, Inworld ~US$180, Hume ~US$137. **Contraria a estimativa "centenas de USD" do AD-014/D14**, que assumia só a explicação e um acervo menor.
- **Reason**: Discuss 2026-07-23 — o usuário pediu pesquisa antes de escolher a reserva; a pesquisa mostrou que a decisão de escopo (AD-063) e o mercado mudaram a ordem de grandeza do custo, e que escolher reserva por tabela de preço sem escuta em português contraria o critério do D14.
- **Trade-off**: Sem reserva configurada, indisponibilidade do ElevenLabs atrasa o lote (aceitável: é lote, não superfície ao vivo). Preços são de **fontes secundárias**, não das páginas oficiais; cobertura de pt-BR dos entrantes **não confirmada** (Fish Audio lista 10 idiomas sem português explícito na fonte lida).
- **Scope**: M3 (refina AD-014).
- **Date**: 2026-07-23
- **Status**: active (preços **[provisório]** — reconfirmar em fonte oficial antes de contratar)

### AD-066
- **Decision**: **Tutor e Raio-X completo entram no MVP**, e os documentos que discordavam foram alinhados. (a) O tutor é P1 (AD-051): o `PRD.md` §4.2 o listava como fast-follow e o M9 marcava a infra de streaming como P3 — ambos corrigidos; INFRA-05 vira **P1** e o **plano Vercel Pro passa a ser requisito do lançamento**, não custo derivado opcional. (b) O Raio-X entra **completo** (RAIOX-01…08, 11…14), contra o `PRD.md` §4.1 que dizia "pode ser só frequência real, sem multi-sinal completo": é a primeira tela e o argumento de venda, e a matemática é barata (consulta + parâmetros em config). Seguem fast-follow **RAIOX-07** (tela de curadoria do empurrão) e **RAIOX-09/10** (formato e diff de edital), que são caros e não bloqueiam. Registrado como consequência: **a qualidade do Raio-X vem do acervo, não da fórmula** — a ingestão do M1 é o caminho crítico.
- **Reason**: Revisão de consistência de 2026-07-23 encontrou os dois pontos como contradição real entre PRD, M2/M5 e M9. O usuário decidiu: tutor é MVP (M2 estava certo) e Raio-X é o produto principal, robusto desde o dia 1.
- **Trade-off**: O MVP cresce. O tutor traz junto streaming, teto diário, cache, alerta de gasto e uma tabela do grupo 1 da LGPD; o Raio-X completo traz a fórmula inteira. Aceito conscientemente.
- **Scope**: PRD §4.1/§4.2, M2, M5, M9.
- **Date**: 2026-07-23
- **Status**: active

### AD-067
- **Decision**: Na retenção por inatividade (24m), as linhas do aluno em `tentativas` são **APAGADAS**, não "anonimizadas in-place". O M9 dizia anonimizar mantendo a linha; o M7 (DADOS-03) dizia apagar. **Vence o M7**; o M9 foi corrigido. Partições continuam **nunca dropadas**.
- **Reason**: Linha sem `user_id` mas com `sessao_id` continua sendo a sequência de uma pessoa só — é **pseudonimização**, não anonimização, e portanto continua sendo dado pessoal sob a LGPD. Manter teria custo e nenhum ganho legal. Além disso a contribuição estatística já está preservada no acumulador anônimo do grupo 2 (AD-046), que não depende dessas linhas.
- **Trade-off**: Um rebuild total do log depois de retenções produz números menores que o acumulador — consequência já aceita e registrada em AD-046.
- **Scope**: M9 (alinhado a M7/DADOS-03).
- **Date**: 2026-07-23
- **Status**: active

### AD-068
- **Decision**: A regra do IA-02 passa a ser: **nenhum trecho de código nem teste automatizado** pode depender do nome de um modelo — o nome vive só na configuração. **Specs, ADs e comentários PODEM citar o modelo default vigente.**
- **Reason**: A redação anterior ("nenhum requisito, teste ou trecho de código") era violada pela própria spec em três lugares (`anthropic/claude-opus-4.8` em IA-06, `minimax/minimax-m3` no tutor, "Sonnet" em ALUNO-12). O objetivo real é impedir **acoplamento**, não impedir documentação.
- **Trade-off**: Nome citado em spec envelhece. Aceito: envelhecer é o comportamento esperado de documentação, e o teste que garante o desacoplamento continua existindo.
- **Scope**: M2 (afeta a leitura de M4/ALUNO-12).
- **Date**: 2026-07-23
- **Status**: active

### AD-069
- **Decision**: A verificação de conta deixa de ser **execução de código gerado pela IA em sandbox** e passa a ser **catálogo fechado de fórmulas + função própria testada**: a IA devolve, em saída estruturada, apenas **qual fórmula** e **quais parâmetros**; o cálculo é feito por código nosso, coberto por teste unitário. Catálogo mínimo: juros simples e compostos, taxa proporcional × equivalente, desconto simples e composto, séries uniformes, SAC e Price, VP e VF. Quantitativa que **não encaixa** em nenhuma fórmula vai direto à **fila humana**, e a taxa de não-cobertura é medida. O cruzamento duplo (resultado × gabarito × número no texto) permanece, com tolerância de arredondamento em config. **Substitui o sandbox do AD-012.3.**
- **Reason**: Matemática financeira de concurso bancário é um conjunto fechado de fórmulas. Trocar execução de código por catálogo elimina a superfície de segurança (nada gerado por IA é executado), torna o resultado determinístico e testável de uma vez só, e barateia a chamada. O usuário confirmou que conferir centenas de contas à mão não é viável, então a verificação automática **permanece** — muda só o mecanismo.
- **Trade-off**: Risco de cobertura. RLM e pegadinhas de enunciado não têm fórmula e caem na fila humana. **Se a taxa de não-cobertura na primeira leva for alta, a decisão de executar código é reaberta** — está registrado como assumption a medir.
- **Scope**: M2 (IA-06, novo IA-15).
- **Date**: 2026-07-23
- **Status**: active

### AD-070
- **Decision**: A palavra **"frequência" fica reservada ao Raio-X** (M5: quanto o assunto cai na prova). O contador por questão do grupo 2 (M7) passa a se chamar **`n_respostas`** (quantas vezes a questão foi respondida).
- **Reason**: O mesmo termo significava duas coisas incompatíveis em dois módulos, em tabelas diferentes. Colisão de nome que produziria bug de leitura no Design.
- **Trade-off**: Nenhum.
- **Scope**: M7 (esteira 1 e definição do grupo 2).
- **Date**: 2026-07-23
- **Status**: active

### AD-071
- **Decision**: O placar do aluno tem **duas velocidades**. **Na hora (abertura da tela)**: `anel do dia` e `sequência` — consulta de 1 aluno × 1 dia sobre o plano do dia + tentativas de hoje. **Por job**: progresso, domínio por tópico, caderno de erros, Raio-X e histórico da sequência.
- **Reason**: A spec do M6 mandava tudo por job "com pequeno atraso", e o job do plano roda 1×/dia — o aluno fecharia um bloco e não veria o anel mexer até o dia seguinte, o que anula a função do módulo. O invariante nº7 proíbe **IA ao vivo** e conta pesada ao vivo; uma consulta de um aluno num dia não é nenhum dos dois.
- **Trade-off**: Duas rotas de cálculo para os mesmos sinais; o Design tem de garantir que a conta ao vivo e a do job dão o mesmo número.
- **Scope**: M6 (GAM-01, novo GAM-14), M4 (ALUNO-02, AC2).
- **Date**: 2026-07-23
- **Status**: active

### AD-072
- **Decision**: A revisão espaçada usa **FSRS com os parâmetros padrão da biblioteca desde o dia 1**, por aluno e por assunto. A régua fixa 1/3/7/14/30 permanece implementada como **plano B selecionável por configuração**. A **otimização** dos parâmetros por aluno (`computeParameters`) é que é fast-follow. Como o FSRS espera nota de 1 a 4 por revisão e aqui a unidade é o tópico, a nota é derivada do desempenho do bloco Revisar por uma tabela de faixas em configuração.
- **Reason**: Documentação do `ts-fsrs` conferida em 2026-07-23 (Context7): `default_w` traz 21 pesos **já treinados** e o agendador funciona sem nenhum histórico; só `computeParameters` exige histórico de revisões. A leitura anterior (AD-018 e a análise inicial desta revisão) de que "FSRS precisa de volume para funcionar" estava **errada**. Lançar com régua fixa e migrar depois obrigaria a deslocar os intervalos de todos os alunos de uma vez, sem ganho.
- **Trade-off**: O FSRS foi desenhado para revisão **item a item** com nota dada pelo próprio aluno; aqui a unidade é o **tópico** e a nota é derivada. **É adaptação, não uso padrão** — validar no Design, e é por isso que a régua fixa continua como plano B.
- **Scope**: M4 (ALUNO-09 sobe de P2 para P1), PRD §4.1/§4.2.
- **Date**: 2026-07-23
- **Status**: active

### AD-073
- **Decision**: Matriz de modelos migrada para a família **OpenAI GPT-5.6**, pesquisada em **2026-08-04**. **`openai/gpt-5.6-luna` em todas as tarefas do gateway**, com `openai/gpt-5.6-terra` **apenas** no reprocessamento do "refaz 1×". O gateway passa a resolver, por tarefa, **`(modelo, esforço, batch, cache, fallback)`** — não só o modelo:
  · extração de PDF → `gpt-5.6-luna`, esforço `high`, batch **sim**, cache **sim**
  · explicação → `gpt-5.6-luna`, `high`, batch sim, cache sim
  · verificação quantitativa (escolha de fórmula + parâmetros) → `gpt-5.6-luna`, **`max`**, batch sim, cache sim
  · reprocessamento do "refaz 1×" → **`gpt-5.6-terra`**, **`max`**, batch sim, cache sim
  · classificação no tópico → `gpt-5.6-luna`, `high`, batch sim, cache sim
  · **plano inicial pós-diagnóstico** (tarefa própria, ver AD-068/M4) → `gpt-5.6-luna`, `high`, batch **não**, cache sim
  · frase do plano diário → `gpt-5.6-luna`, `high`, batch sim, cache sim
  · tutor → `gpt-5.6-luna`, **`medium`**, batch **não**, cache sim
  · rascunho de inéditas (P2) → `gpt-5.6-luna`, `high`, batch sim, cache sim
  · embeddings → **Cohere embed-v4 permanece**, chamada direta fora do gateway (AD-005): a Luna não expõe endpoint de embeddings.
  Preços de 2026-08-04: Luna **US$0,20/US$1,20** por M tokens (cache de entrada **US$0,02**, escrita de cache 1,25× a entrada); Terra **US$2/US$12**. Batch **−50%**, acumulável com o cache. **Escalonamento do refaz 1× passa a ser por modelo _e_ por esforço** (Luna `max` → Terra `max`), substituindo `anthropic/claude-opus-4.8`. **Consequência operacional obrigatória:** requisição acima de **272K tokens** é cobrada a **2× entrada e 1,5× saída**, e PDF entra no contexto como texto **e** imagem de página (`detail` padrão `high` no GPT-5.6) — a extração **SHALL** fatiar o PDF por blocos de questões e usar `detail: low` quando a questão não tiver gráfico/figura. **Substitui AD-049 e a parte de modelos do AD-011.**
- **Reason**: Corte de preço da OpenAI em 30/07/2026 derrubou a Luna em 80% ($1/$6 → $0,20/$1,20). Contra o Sonnet 5 do AD-049 ($2/$10), isso é **entrada 10× e saída 8,3× mais barata**, com saída estruturada, function calling, Batch, prompt caching explícito, entrada de PDF e níveis de esforço `none…max` — tudo que a fábrica usa. Dos três motivos que elegeram o Sonnet no AD-049, a execução de código já tinha morrido no AD-069 e o PDF nativo a Luna atende; só as citações caem (ver AD-075). Estimativa da fábrica cai de "< US$100" para **ordem de US$15–30** mesmo com esforço alto.
- **Trade-off**: Fornecedor único para tudo que é geração (o risco de indisponibilidade concentra), e tokens de raciocínio são cobrados como **saída** — por isso o tutor fica em `medium`, já que é a única superfície ao vivo e esforço alto custa latência antes da primeira palavra aparecer. Nomes seguem `[provisível]`: o corte de 80% aconteceu 4 dias antes desta decisão, o que é a própria prova de que a rotina trimestral do AD-049/IA-11 é o que importa, não a tabela.
- **Scope**: M2 (IA-02, IA-06, IA-10, IA-13), herdado por M1 (extração) e M4 (plano inicial e frase do plano); PRD §8.
- **Date**: 2026-08-04
- **Status**: active (nomes **[provisível]** — tabela válida em 2026-08-04)

### AD-074
- **Decision**: O acesso aos modelos é por **SDK nativo da OpenAI** (`openai`, Responses API), com **um único adapter de provedor** no gateway no dia 1. A **OpenRouter NÃO entra na fábrica nem no tutor**; fica reservada ao **eval cego trimestral** (IA-11), com chave separada, para testar candidatos de outras famílias sem custo na produção. Adicionar um adapter OpenRouter à produção é decisão registrada (novo AD), seguindo o mesmo padrão de **slot de reserva em standby** do AD-065.
- **Reason**: Com AD-073, **100% das tarefas do gateway vão para modelo OpenAI** — a taxa de plataforma de **5,5%** da OpenRouter compraria uma capacidade multi-modelo que não está em uso. Além disso a economia depende de recursos recém-lançados (`max` effort, modo Pro, controle explícito de cache, `detail` no input de PDF), e agregador é onde parâmetro novo demora a ser repassado: a documentação da OpenRouter descreve cache de entrada a 0,25×–0,50×, enquanto a Luna direta na OpenAI tem cache a **0,1×**. Verificado em 2026-08-04 que a OpenRouter **repassa** o Batch −50% — ou seja, o desconto não é o diferencial; a taxa e o repasse de recursos novos são.
- **Trade-off**: Perde-se a troca instantânea de família de modelo por configuração. Mitigado por: o gateway já é a abstração (IA-02/AD-068), o eval trimestral continua enxergando o mercado inteiro via OpenRouter, e escrever um segundo adapter é trabalho contido.
- **Scope**: M2 (IA-02, IA-11), M9 (chaves e segredos).
- **Date**: 2026-08-04
- **Status**: active

### AD-075
- **Decision**: As citações da explicação (IA-04) deixam de depender de **recurso do fornecedor** e passam a ser **campo de saída estruturada + verificação por código nosso**: a IA devolve `fontes_citadas` como lista de `(doc_id, trecho)`, e o sistema **SHALL** conferir, antes de aceitar, que cada `trecho` **existe literalmente no documento entregue** naquele pedido (comparação normalizada — espaços, acentuação e pontuação). Explicação sem nenhuma citação, ou com citação que não bate com a fonte, **SHALL** ser rejeitada e enviada à fila humana.
- **Reason**: A API de Citations da Anthropic devolvia o trecho citado verificado pelo próprio provedor. A OpenAI só produz anotação de citação para **busca web** e para **file_search com vector store** — não para documento entregue inline, que é exatamente o caso do grounding do AD-012.1. Sem essa substituição, o AC 2 da IA-04 ficaria sem mecanismo. Conferir por código é o mesmo padrão que o AD-069 já adotou para a conta: a verdade é checada por função nossa, testada, e não por promessa do fornecedor.
- **Trade-off**: Uma função de verificação a mais para escrever e manter, e a IA passa a gastar tokens de saída repetindo o trecho citado (a Anthropic não cobrava por esse trecho). Em compensação a verificação passa a ser nossa, auditável e independente de fornecedor — o que também remove um acoplamento que o AD-049 tinha criado sem perceber.
- **Scope**: M2 (IA-04 AC2), herdado por M5 (RAIOX-09, extração do edital com citações).
- **Date**: 2026-08-04
- **Status**: active

### AD-076
- **Decision**: O lançamento passa a separar **o que é construído** de **o que nasce ligado**. Constrói-se tudo o que as 9 specs definem (exceto M3, congelado por AD-064), mas **apenas 4 superfícies nascem ligadas** para o aluno: (1) **plano de hoje** — blocos Revisar/Avançar/Treinar (AD-018); (2) **sessão de questões** — responder → explicação conferida → causa do erro (AD-016); (3) **progresso** — domínio por matéria, caderno de erros e sequência; (4) **conta** — compra, login, senha e matrícula (AD-034). Todo o resto é entregue **atrás de flag desligada** (AD-001) e ligado quando um aluno pagante pedir: **tutor ao vivo**, **tela dedicada do Raio-X**, **gamificação** (M6 além da sequência), **diagnóstico adaptativo** (no lançamento o aluno **só declara o nível**, caminho que o AD-017 já previa como "pular") e **flywheel** (M7 além de política de privacidade e DELETE). O **acervo de lançamento** deixa de ser "~10 anos × 3 bancas" e passa a ser **as últimas 3–4 provas do BB**; os 10 anos do AD-009 viram **meta contínua**, ingerida com o produto já vendendo. **A conta do Raio-X (AD-056/057) roda desde o dia 1** alimentando a nota do plano e aparecendo como número na página de vendas e dentro do plano ("este tópico cai X% da prova") — o que fica desligado é a **tela** dedicada, não o motor. **NÃO descarta AD-066:** tutor e Raio-X completo seguem sendo construídos como MVP de engenharia; muda apenas que não nascem ligados. **Consequência em INFRA-05:** Vercel Pro deixa de ser requisito de *lançamento* e passa a ser requisito de *ligar a flag do tutor*. **Substitui o §4.1 do PRD** (o "loop central" de 7 itens) e **a parte do AD-009 que trata de pré-requisito de lançamento**.
- **Reason**: O time vai construir com IA, o que derruba o custo de escrever código — mas **não** derruba as outras duas grandezas do projeto: (a) as horas humanas de curadoria do acervo e da base de referência (AD-003/AD-006/AD-012.2), que ninguém automatiza e que o próprio Handoff já marca como **caminho crítico**; e (b) o custo de o aluno **entender a tela** no primeiro dia, que não cai com IA nenhuma — piora, porque feature barata de construir incentiva tela cheia. O postmortem estudado em 2026-08-13 (`_wiki/principios/validacao-de-produto.md`) identifica exatamente esses dois modos de falha: meses até o primeiro usuário tocar no produto, e produto tão carregado que quem baixou não soube usar. O sinal de alerta já estava nos nossos arquivos: AD-051 e AD-066 **subiram** tutor e Raio-X completo de fast-follow para MVP com justificativas boas, **sem que existisse um único usuário** — o escopo de lançamento cresceu sozinho. Separar construído × ligado preserva o ganho da IA (constrói tudo) sem pagar o preço da tela inchada, e usa a feature flag que o AD-001 já tinha escolhido como mecanismo. Reduzir o acervo de lançamento tira do caminho crítico a única tarefa que a IA não acelera: 3–4 provas do BB dão semanas de estudo e podem ser curadas **em paralelo ao Design**, sem depender de código pronto.
- **Trade-off**: Constrói-se mais código do que se entrega, e código atrás de flag ainda precisa ser mantido e testado; as flags viram superfície própria de bug. O acervo de 3–4 provas é **magro** para uma promessa de R$197/ano (AD-031), o que obriga a página de vendas a vender **acesso fundador com acervo crescendo toda semana** — e não produto pronto; vender diferente disso transforma a garantia de 7 dias (AD-031) em reembolso em massa e apaga o sinal de validação. Risco residual: aluno dedicado esgota 3–4 provas antes de a ingestão alcançar, o que torna o ritmo de ingestão pós-lançamento uma obrigação, não um desejo.
- **Scope**: Arquitetura geral e sequência de lançamento. Toca PRD §4.1/§4.2, M1 (AD-009, ritmo de ingestão), M2 (tutor atrás de flag), M4 (diagnóstico declarado no lançamento), M5 (motor ligado, tela desligada), M6 (só sequência), M7 (só política + DELETE), M9 (INFRA-05).
- **Date**: 2026-08-13
- **Status**: active

### AD-077
- **Decision**: A superfície do produto é **web responsivo no navegador**, e só. **Sem app nativo** (iOS/Android) e **sem PWA** no lançamento — nem manifest, nem service worker, nem passo de "adicionar à tela de início" no onboarding. A notificação de hábito do AD-025 (teto ~1/dia) é entregue por **e-mail** no lançamento. PWA e WhatsApp ficam registrados como as duas próximas opções, nessa ordem, **caso** a notificação se comprove gargalo de retenção com dado real.
- **Reason**: Três motivos, em ordem de peso. **(1) Cobrança.** O modelo é R$197 anual com **Pix, boleto e cartão 12x pelo Asaas** (AD-031/AD-033), e Pix e boleto **não existem** dentro da compra da Apple. Mesmo depois do acordo Apple × CADE que entrou no **iOS 26.5 em junho/2026**, vender conteúdo digital dentro do app iOS no Brasil custa **10% ou 21%** de comissão (+5% se usar o pagamento da Apple), e **15%** (10% em alguns casos) sobre compra feita no site via link a partir do app — R$20 a R$50 por aluno numa venda de R$197. **(2) Velocidade de correção.** Web sobe e todo mundo está na versão nova; app depende de revisão de loja e de o aluno atualizar, e nos primeiros meses o produto muda toda semana. **(3) Já era a posição implícita** do PRD §4.3 e do AD-035 (Vercel + Next.js) — este AD a registra porque a decisão foi **reaberta e reconfirmada** em 2026-08-13. **PWA fora por ora:** no iPhone o push web só funciona se o aluno adicionar à tela de início **pelo Safari**, e **não existe pop-up automático** pedindo isso (verificado em 2026-08-13) — é uma etapa de onboarding com perda garantida, e não se paga antes de existir retenção medida para comparar.
- **Trade-off**: Sem push no lançamento; o lembrete diário depende de e-mail, que tem abertura menor que notificação de celular — é uma aposta contra o AD-023/AD-025, cujo mecanismo de hábito assume alcançar o aluno. Sem presença em loja, ninguém descobre o produto buscando na App Store — aceitável porque o modelo é paga-primeiro por página de vendas (AD-031), onde descoberta por loja nunca esteve no plano. Caminho registrado se a notificação virar gargalo comprovado: **PWA primeiro** (custo da ordem de 1 dia, reaproveita o mesmo site); **app nativo só depois** e, nesse caso, **a venda continua no site e o app é só login**, para não pagar comissão de loja.
- **Scope**: M8 (superfície de venda e onboarding), M6 (GAM-06, canal da notificação), M9 (INFRA-01). PRD §4.3 e §6.
- **Date**: 2026-08-13
- **Status**: active

### AD-078
- **Decision**: O mecanismo de **configuração e feature flag** é uma **tabela versionada no Postgres** (Supabase), lida pela aplicação com cache curto. **Variável de ambiente** fica reservada ao que precisa existir **antes** do banco responder (URL e chave do próprio Supabase, segredos de provedor) — SHALL NOT ser o lar de flag nem de parâmetro de produto. No lançamento a flag é **booleana e global** por módulo/superfície: SHALL NOT haver rollout percentual, segmentação por aluno nem teste A/B. Mudar o valor de uma flag ou de um parâmetro **SHALL NOT exigir deploy**. Toda alteração SHALL ser registrada (quem, quando, valor anterior e novo). Serviço externo de feature flag (LaunchDarkly, GrowthBook, flags do PostHog) fica **fora do lançamento**; adotar um SHALL exigir AD nova.
- **Reason**: O AD-001 escolheu feature flag como o mecanismo que permite construir modular e incremental, o AD-076 pôs cinco superfícies atrás de flag desligada, o AD-064 pôs o M3 inteiro atrás de flag, e o `docs/GITFLOW.md` construiu o trunk-based em cima dela ("deploy ≠ release; o que decide se o aluno vê é a feature flag"). Mas **nenhuma das 9 specs diz onde o valor da flag mora** — INFRA-01…10 cobre região, partição, backup, observabilidade e segredo, e não cobre isto. O buraco é maior que as flags: dezenas de parâmetros já estão especificados como "vive em configuração" e igualmente sem dono — `retencao_meses` e `piso_anonimato` (M7), preço e desconto à vista (M8), teto do tutor e a matriz de modelos/esforço (M2, IA-02), decaimento e percentis (M5), escudos e janela de recuperação (M6), faixas de conversão do FSRS e tamanho de bloco (M4), voz e teto de gasto do lote (M3). É o mesmo mecanismo, e ele **trava o Design do M4**, que consome config já na primeira história. Tabela no Postgres resolve porque o banco já existe (AD-035), fica na região SP junto do resto e atende o requisito real, que é **trocar valor sem deploy** — variável de ambiente obrigaria um deploy para ligar uma flag, que é exatamente o que o GITFLOW diz que não deve acontecer. Serviço externo custaria um subprocessador novo para entregar rollout percentual e segmentação que o AD-076 não pede.
- **Trade-off**: A leitura da flag entra no caminho da requisição e vira consulta ao banco — o cache curto é obrigatório, não refinamento, e uma tabela mal-cacheada vira ponto quente. Sem rollout percentual nem A/B: ligar uma feature é para todos os alunos de uma vez, e descobrir problema em produção não tem meio-termo além de desligar. E config no banco **não aparece no diff do git** como o resto do projeto aparece — por isso o registro de alteração é requisito, não opcional: sem ele, ninguém sabe quem mudou o preço ou a janela de retenção.
- **Scope**: M9 (**INFRA-11** novo). Consumido por M1…M8 — todo parâmetro marcado "em configuração" nas 8 specs — e por `docs/GITFLOW.md`.
- **Date**: 2026-08-16
- **Status**: active

### AD-079
- **Decision**: A ferramenta de **analytics de produto** é o **PostHog Cloud, região Estados Unidos** — organização criada pelo sócio em 2026-08-16, **antes** desta AD ser fechada; a região registrada aqui é a que existe de fato, não a recomendada na análise. Adotada em **duas etapas de escopo**. **Etapa 1 (lançamento):** mede **apenas o funil pré-login** — página de vendas e checkout até a confirmação do pagamento. SHALL rodar em **modo anônimo** (sem perfil de pessoa), SHALL NOT enviar `user_id`, e-mail, nome, CPF nem qualquer dado de meio de pagamento, e SHALL ser servida pelo **domínio próprio via proxy reverso** do Next.js. **Etapa 2 (atrás de flag desligada, AD-078):** superfície logada — ativação, uso do plano, sessão de questões. SHALL NOT ser ligada antes de as três condições estarem cumpridas: (a) a política de privacidade nomear o PostHog como **operador** e declarar a **transferência internacional**, e o **instrumento** dessa transferência para os EUA estar resolvido (art. 33 LGPD — os EUA não têm decisão de adequação da ANPD); (b) o DELETE do DADOS-04 chamar a **API de deleção de pessoa** do PostHog e conferir o status de conclusão; (c) a lista de eventos e propriedades ser fechada e revisada, sem nenhum dado do grupo 1 em propriedade. **Session replay SHALL NOT ser usado em nenhuma etapa.** O PostHog **SHALL NOT** substituir o Sentry (INFRA-09) nem ser fonte de feature flag (AD-078); seu error tracking SHALL NOT ser ligado.
- **Reason**: O modelo é paga-primeiro (AD-031) com o produto inteiro atrás do muro, o que faz da página de vendas a **única superfície de conversão** (PAG-08) — e o AD-076 apostou em vender "acesso fundador com acervo crescendo", o que torna a taxa de desistência do funil o número que diz se a oferta funciona. **Nada no projeto mede isso hoje:** o Sentry do INFRA-09 só enxerga defeito, e um funil que converte 2% sem nenhum erro é silêncio total para ele. Medir **pré-login** é onde o custo de LGPD é menor: quem está na página de vendas ainda não é aluno, não tem `user_id` e não pertence a nenhum dos 3 grupos do AD-027. A superfície logada é o oposto — DADOS-02 exige que todo dado pessoal esteja **declarado no schema**, e evento com `user_id` num serviço de terceiro é dado do grupo 1 morando fora do schema; daí ela nascer desligada com condições escritas em vez de proibida. O **session replay** grava a tela do aluno, o que contraria DADOS-07 AC6 (nada de dado pessoal em claro fora do schema) de forma mais forte que um log de erro — fica fora por decisão registrada, não por esquecimento. Sobre a **região**: o PostHog não tem região BR, e self-host — a única saída para o dado ficar no Brasil — já estava excluído pelo M9 ("3 devs sem ops"). Restavam EUA e UE; a análise desta rodada recomendou **UE** por ser a residência com regime de proteção mais próximo do que a LGPD espera, mas a organização foi criada nos **EUA** antes do fechamento, e a AD registra o que existe. A diferença é de **regime jurídico do destino**, não de funcionalidade: o produto e o SDK são idênticos nas duas.
- **Trade-off**: Cria o **primeiro subprocessador fora do Brasil** do projeto — até aqui o AD-035 mantinha tudo em SP. Declarar transferência internacional é irreversível no sentido que importa: dá para sair do PostHog depois, não dá para nunca ter declarado. **A região é praticamente de mão única:** migrar US→UE existe, mas só nos planos **Scale/Enterprise**, por ticket e com engenheiro do fornecedor movendo os dados manualmente (verificado em 2026-08-16); no plano gratuito a saída real é **criar organização nova e perder o histórico**. Trocar de ideia é barato **agora**, enquanto não há um único evento gravado, e caro depois. **Consequência jurídica do destino EUA:** os Estados Unidos não têm decisão de adequação da ANPD, então a transferência precisa se apoiar em outro mecanismo do art. 33 da LGPD — cláusulas-padrão contratuais são o caminho usual, e a ANPD as aprovou em resolução própria. Isso **não** inviabiliza; **agrava o item do advogado**, que deixa de ser "confirmar a base legal" e passa a ser "confirmar a base legal **e** o instrumento da transferência". O evento pré-login ainda carrega **IP e identificador de dispositivo**, então é risco **menor, não nulo**. Bloqueador de anúncio derruba parte da medição se o proxy reverso não existir, o que torna o proxy **requisito e não refinamento**. E o número do funil nunca vai bater exatamente com o do Asaas — a conciliação financeira (PAG-15) continua sendo a verdade do dinheiro; o PostHog explica **onde** se perde, nunca **quanto** entrou.
- **Scope**: M9 (**INFRA-12** novo), M8 (**PAG-17** novo — eventos do funil), M7 (DADOS-04 ganha a deleção no PostHog; DADOS-01 ganha a declaração de transferência internacional). SHALL NOT tocar INFRA-09 — o Sentry permanece como está.
- **Date**: 2026-08-16
- **Status**: active

### AD-080
- **Decision**: A **frase de abertura do plano diário** (ALUNO-12) sai da **Batch API** e passa a ser
  chamada **síncrona** no job que roda logo depois do `gera_plano_do_dia()`. Todas as outras tarefas
  da matriz do AD-073 permanecem em Batch. **Substitui apenas a linha "frase do plano diário" do
  AD-073**; o resto do AD-073 (modelo, esforço, cache, fallback, escalonamento do refaz 1×) segue
  íntegro.
- **Reason**: A Batch API não promete prazo — a janela publicada é de até 24h. Toda tarefa da matriz
  tolera isso porque roda de madrugada sem ninguém esperando; a frase do plano é a única com **hora
  marcada**: ela precisa existir quando o aluno abre o app de manhã. Com Batch, um atraso da fila do
  fornecedor entrega o plano sem a frase (o que o ALUNO-05 AC4 já permite, mas como degradação, não
  como rotina). Custo da troca, com os preços do próprio AD-073 (Luna US$0,20/M entrada e US$1,20/M
  saída), 1.000 alunos, ~500 tokens de entrada e ~80 de saída por frase: cerca de **US$6/mês** contra
  **US$3/mês** em Batch. Três dólares por mês para a frase existir todo dia.
- **Trade-off**: Perde-se o desconto de 50% nesta tarefa e some a folga de retomada que o Batch dá de
  graça — o script precisa do próprio tratamento de erro por aluno. Se a base crescer muito além de
  1.000 alunos, o número volta à mesa: a decisão é sobre a ordem de grandeza atual, não sobre
  qualquer escala.
- **Scope**: M4 (ALUNO-12), M2 (matriz do gateway, IA-02).
- **Date**: 2026-08-16
- **Status**: active

### AD-081
- **Decision**: A tabela de configuração e feature flags do AD-078 é **append-only**: trocar um valor
  é **inserir uma linha nova**, e o valor vigente de uma chave é a **última linha** dela. Não há
  UPDATE nem tabela de histórico paralela. Toda chave existente é declarada num **catálogo em
  código** (tipo, default, módulo dono, descrição); o banco guarda apenas o override. Chave sem linha
  no banco vale o default do catálogo — é assim que o sistema sobe em banco vazio. Chave presente no
  banco e ausente do catálogo é **erro**, não configuração. A **janela de cache** é constante em
  código (30s), única exceção declarada ao "todo parâmetro em configuração", porque um TTL guardado
  na própria tabela que ele cacheia não teria como ser corrigido se entrasse errado. **Detalha o
  AD-078**, que permanece.
- **Reason**: O AC7 do INFRA-11 exige registrar quem, quando, valor anterior e valor novo. Com UPDATE
  isso obriga uma tabela de histórico mantida por gatilho — duas peças que podem divergir em silêncio,
  e o histórico é justamente o que não pode. Com INSERT, o valor anterior **é** a penúltima linha: o
  registro não diverge do fato porque é o mesmo dado. É também o padrão que o AD-015 já escolheu para
  `tentativas`, então o projeto passa a ter uma regra só sobre dado que muda, e não duas.
- **Trade-off**: Ler o valor vigente exige `distinct on (chave)` em vez de um `select` direto — custo
  irrisório nesta escala (dezenas de chaves), resolvido por índice e encapsulado numa view. A tabela
  cresce para sempre, o que é irrelevante no volume de mudanças de configuração de um produto.
- **Scope**: M9 (INFRA-11), consumido por M1…M8.
- **Date**: 2026-08-16
- **Status**: active

### AD-082
- **Decision**: O só-INSERT de `tentativas` (AD-015/AD-042) é garantido por **duas camadas**:
  (1) `REVOKE UPDATE, DELETE` dos papéis da aplicação + RLS sem policy de UPDATE/DELETE; (2) um
  **gatilho** que recusa qualquer UPDATE e recusa DELETE **exceto** quando a sessão declara de quem é
  o dado a apagar (`set local app.esquecimento_user_id`). O DELETE-por-esquecimento do M7 (AD-029)
  passa por essa porta nomeada, o que torna a exceção **auditável e nominal** em vez de um privilégio
  genérico de administrador.
- **Reason**: RLS não se aplica ao `service_role`, e a chave de serviço vai existir em scripts de job
  e de fábrica (AD-036). Com uma camada só, qualquer script com essa chave poderia dar UPDATE na
  fundação do produto por engano — e o invariante nº1 do AGENTS.md diz que isso é bug, não escolha. A
  segunda camada custa um gatilho e fecha o buraco.
- **Trade-off**: Todo DELETE legítimo passa a exigir um passo explícito antes; um gatilho por linha
  tem custo em DELETE de volume alto (a rotina de esquecimento apaga por aluno, não em massa, então o
  custo é aceitável).
- **Scope**: M4 (ALUNO-01), contrato consumido por M7 (DADOS-04, rotina de esquecimento).
- **Date**: 2026-08-16
- **Status**: active

### AD-083
- **Decision**: A suíte de testes do projeto é **Vitest**, com dois projetos no mesmo runner:
  `unit` (TypeScript puro, paralelo) e `db` (integração, **sequencial**). O teste de banco roda
  contra o **próprio projeto Supabase de desenvolvimento** (`kfpmetkmhjtmgwgaaerl`, São Paulo) — não
  contra um Postgres local. **Docker não entra no projeto.** Migração é aplicada por
  `supabase db push` / `supabase migration up --linked`, ou pelo `apply_migration` do MCP; nenhum dos
  três usa Docker. Staging isolado (INFRA-06/INFRA-07) segue fast-follow e vira **pré-requisito**
  quando existir aluno pagante.
- **Reason**: O banco de desenvolvimento está vazio, sem aluno e sem dado real — ele *é* o ambiente
  de dev. Um Postgres local por Docker adicionaria dependência de máquina (Docker Desktop no Windows)
  e um segundo ambiente para manter em dia, sem proteger nada que ainda exista. Verificado em fonte
  primária (doc do Supabase CLI, 2026-08-16): só `supabase start`, `db diff` e `db pull` exigem
  Docker — aplicar migração em projeto ligado, não.
- **Trade-off**: Teste de banco escreve no banco de desenvolvimento real, então cada teste precisa
  limpar o que criou e usar `user_id` gerado na hora. Testes de banco não rodam em paralelo (um banco
  só) e não rodam sem `DATABASE_URL` — quem clona o repo sem credencial roda só `test:unit`. No dia
  em que existir aluno pagante, esta decisão deixa de valer e o staging isolado passa a ser
  obrigatório antes de qualquer teste de banco.
- **Scope**: Projeto inteiro (M1…M9), fase Execute.
- **Date**: 2026-08-16
- **Status**: active

### AD-084
- **Decision**: A trava de tabela **append-only** do projeto tem **três** peças, não duas:
  (1) `revoke update, delete, truncate` de `anon`/`authenticated`; (2) gatilho `for each row` em
  `before update or delete`; (3) gatilho `for each statement` em `before truncate`. A função do
  gatilho é declarada com `set search_path = ''`. Substitui a receita de duas peças do **AD-082**,
  que vale para `configuracoes` e **também para `tentativas`** quando o M4 for implementado (T12).
- **Reason**: Inspecionando os privilégios reais depois de aplicar a primeira migração, `anon` e
  `authenticated` ainda tinham **TRUNCATE** — vem do `alter default privileges` do Supabase — e
  **RLS não governa TRUNCATE**. A tabela append-only podia ser esvaziada inteira. O `service_role`
  tem `rolbypassrls` e mantém o privilégio de propósito, então só o gatilho por comando o segura.
  O `search_path` mutável era aviso `function_search_path_mutable` do linter do Supabase.
- **Trade-off**: Mais três linhas por tabela de log. Nenhuma perda: TRUNCATE não é usado em lugar
  nenhum do projeto. Não fecha a porta de esquecimento do AD-029/AD-082 em `tentativas`, que
  continua sendo a única exceção de DELETE e vale só ali — `configuracoes` não tem dado pessoal.
- **Scope**: Toda tabela append-only do projeto: `configuracoes` (INFRA-11) e `tentativas` (M4/T12).
- **Date**: 2026-08-16
- **Status**: active

### AD-085
- **Decision**: A leitura de configuração continua no **`unstable_cache`** do Next, **não** migra
  para a diretiva `use cache`. E o leitor padrão **cai para leitura direta do banco** quando o cache
  do Next não está disponível, em vez de tratar isso como leitura quebrada. A janela segue constante
  em código, 30s. A migração para `use cache` fica como decisão própria, futura.
- **Reason**: O Next 16 substituiu o `unstable_cache` pelo `use cache` (confirmado no Context7 em
  2026-08-16), mas adotar a diretiva exige ligar `cacheComponents` no `next.config`, o que muda o
  comportamento de cache do **app inteiro** — grande demais para entrar de carona numa task de
  leitura de config. Mais sério: o `unstable_cache` **só vale dentro de uma requisição**, e job do
  GitHub Actions e script de linha de comando (AD-035/AD-036) rodam fora dela. Sem a queda para
  leitura direta, o job trataria a ausência de cache como falha e usaria o **default do catálogo em
  silêncio** — trabalhando com configuração errada sem ninguém saber. Há teste provando os dois
  lados: fora de requisição lê direto; banco fora do ar cai no default e reporta.
- **Trade-off**: Fica-se numa API que a Vercel marcou como legada, e a migração vai ter custo depois.
  Job não tem cache de config (1 aluno por execução não precisa). Uma leitura extra ao banco quando
  o banco está mesmo fora do ar, antes de cair no default.
- **Scope**: `src/modules/config` (INFRA-11) e todo consumidor de config em job — M4 em diante.
- **Date**: 2026-08-16
- **Status**: active

### AD-086
- **Decision**: A unidade de implementação do projeto deixa de ser o **módulo** (M1…M9) e passa a ser
  a **spec numerada**, numa sequência única de **42 specs** registrada em `.specs/ROADMAP.md`. As 9
  specs temáticas continuam existindo e continuam sendo a fonte do **texto** de cada requisito
  (`BANCO-`, `IA-`, `TTS-`, `ALUNO-`, `RAIOX-`, `GAM-`, `DADOS-`, `PAG-`, `INFRA-`), mas mudam de
  lugar — de `.specs/features/m*/` para `.specs/modulos/m*/` — e deixam de ser unidade de trabalho.
  `.specs/features/` passa a conter só as specs numeradas `NN-<nome>/spec.md`, na ordem de
  construção. **Regra dura: uma spec só depende dela mesma ou de spec de número menor**; dependência
  para frente é bug do roadmap e exige AD nova, não improviso. Cada spec é dimensionada para caber
  numa sessão — estimativa entre **6 e 12 tasks**, nenhuma acima de 12. Quando os dois documentos
  discordarem: **conteúdo do requisito** vence o módulo; **em qual spec ele entra** vence o roadmap.
  O requisito **SHALL NOT** ser copiado para os dois lugares. Nada do que já foi produzido é refeito:
  os `design.md`, `tasks.md` e `validation.md` das rodadas 1 e 2 continuam válidos dentro de
  `.specs/modulos/` e são apontados pelas specs numeradas que os herdam.
- **Reason**: A ordem por módulo produziu uma primeira leva que misturou INFRA-11 (M9) com o M4 e
  gerou **22 tasks num único documento** — pesado demais para uma sessão, e com uma dependência
  invertida embutida: a T10 criava um **stub** de `questoes`/`materias`/`topicos` só porque o M4 vinha
  antes do M1, quando o schema do acervo é dependência real do log de tentativas. O mesmo padrão
  aparecia em outros pontos: a T22 fazia chamada de IA antes de o gateway do IA-02 existir; o M6 lê
  `data_prova` do perfil de concurso, que é M5; o DELETE do DADOS-04 precisa que **todas** as tabelas
  de grupo 1 já existam; nenhum módulo especificava a camada de interface, e a SPEC 01 registrou isso
  ao criar o projeto sem camada de estilo. Ordenar por dependência técnica real, e não por tema,
  elimina o stub, mata a inversão e torna verdadeira a frase "abra uma sessão e desenvolva a spec
  seguinte". A separação `modulos/` × `features/` existe para que o requisito tenha **um** dono de
  texto: duplicar o critério de aceite nas duas pastas garantiria divergência com o tempo.
- **Trade-off**: São 42 documentos em vez de 9 — mais arquivo para manter, e o Design de cada spec
  passa a ler **dois** documentos (a spec numerada e a seção do módulo que ela cita). Os números das
  tasks da rodada 1 (T1…T22) deixam de formar uma sequência única do projeto e viram histórico de
  duas specs. E a estimativa de tasks do roadmap é **estimativa**: a fase Tasks pode desmentir e, se
  desmentir para cima de 12, a spec se divide — o que muda a numeração das seguintes.
- **Scope**: `.specs/` inteiro. `README.md`, `AGENTS.md` e `CLAUDE.md` atualizados junto.
  **SHALL NOT** alterar nenhuma AD anterior nem `docs/historico/`.
- **Date**: 2026-08-16
- **Status**: active

### AD-087
- **Decision**: A observabilidade do INFRA-09 é montada assim, e estas escolhas valem para todas as
  specs seguintes. **(a) Ponto único de reporte**: `src/modules/observabilidade` (`reportarErro`), com
  destino injetável e **sem importar o SDK do Sentry no núcleo** — quem liga o SDK é o ponto de
  entrada (os três `Sentry.init` do Next e o `scripts/jobs/sentry-node.mjs` dos scripts de job). O
  `reportarFalhaDeConfig` da SPEC 02 passa a delegar para lá **sem mudar de assinatura**.
  **(b) Saneamento obrigatório**: nada sai do processo com dado pessoal em texto claro — valor de
  chave sensível vira `[removido]`, e-mail vira `[email]`, CPF vira `[cpf]` — e isso vale **também
  para o console**, porque log da Vercel e log do GitHub Actions são dado fora do schema do mesmo
  jeito. **(c) Canal do alerta**: e-mail (`passouconcurso@gmail.com`), pela regra padrão do Sentry.
  Discord/Slack fica registrado como próximo passo, sem data. **(d) Gravação de sessão do Sentry
  SHALL NOT ser ligada**, em nenhuma etapa, pela mesma razão que a AD-079 usou contra o mesmo recurso
  no PostHog. **(e) Tracing/desempenho fica desligado** (`tracesSampleRate: 0`). **(f) O DSN não é
  segredo** — vai para o navegador por desenho, e a varredura da CI tem teste negativo para ele; o
  segredo é o `SENTRY_AUTH_TOKEN`. **(g) A organização do Sentry foi criada na região Estados
  Unidos** (`ingest.us.sentry.io`), decisão do sócio em 2026-08-16, antes desta AD.
- **Reason**: Dezenas de critérios de aceite das 9 specs terminam em "e SHALL alertar", e até aqui não
  havia para onde alertar. O núcleo sem SDK resolve três coisas de uma vez: teste `unit` sem rede
  (AD-083), aplicação e script usando pacotes diferentes (`@sentry/nextjs` × `@sentry/node`), e a
  costura de teste que a SPEC 02 já tinha publicado continua valendo. O saneamento pesa dobrado por
  causa do item (g): o dado atravessa fronteira, e a defesa que funciona é não mandar o dado, não o
  contrato com o fornecedor. Tracing e gravação de sessão ficam de fora porque o AD-037 pediu **erro**
  — span consome cota do plano gratuito sem responder pergunta que o projeto tenha hoje, e gravar a
  tela do aluno contraria o DADOS-07 AC6 com mais força do que um log de erro.
- **Trade-off**: Item (g) cria o **segundo subprocessador fora do Brasil** do projeto, depois do
  PostHog. É transferência internacional sob o art. 33 da LGPD, sem decisão de adequação da ANPD para
  os EUA — **o mesmo item do advogado que a AD-079 abriu**, agora com dois destinos em vez de um. A
  região é praticamente de mão única: o Sentry não migra organização entre regiões no plano gratuito,
  então trocar depois significa criar organização nova e perder o histórico. Enquanto havia zero
  evento gravado, trocar para a União Europeia custava uma linha; a partir do primeiro evento, não.
  Foi apresentado ao sócio no Design e a região EUA foi mantida. Sem tracing, não há como responder
  "por que esta tela está lenta" pelo Sentry — a pergunta vai ter de esperar outra ferramenta ou
  outra AD.
- **Scope**: M9 (INFRA-09, INFRA-10), transversal — toda spec daqui para frente reporta por aqui.
- **Date**: 2026-08-17
- **Status**: active

### AD-088
- **Decision**: **A extensão `pg_cron` é instalada pela SPEC 03**, junto da view `public.jobs_falhados`
  e do vigia diário (`scripts/jobs/vigia-de-jobs.mjs` + workflow). A **SPEC 06 continua dona do
  primeiro job de verdade** — a fronteira é "aqui a vigilância, lá o job". Disso saem três regras
  permanentes. **(a) Contrato de job visível**: toda spec que criar um job entrega a falha visível
  **na mesma task** — job de `pg_cron` cai automaticamente na view e no vigia; workflow de GitHub
  Actions precisa de passo `if: failure()` chamando `scripts/jobs/reportar-falha.mjs`. **(b) A janela
  do vigia (26h) é constante em código**, e não parâmetro na tabela de configuração: é a **segunda
  exceção declarada** ao "todo parâmetro em configuração" (a primeira é a janela de cache, AD-081).
  **(c) Ausência de segredo tem três comportamentos distintos e deliberados**: teste de banco sem
  `DATABASE_URL` **pula** (quem clona sem credencial ainda roda `test:unit`); migração por CI sem
  `DATABASE_URL` **falha** (migração que não aplica deixa a `main` e o banco em versões diferentes);
  qualquer peça sem DSN do Sentry **segue e escreve no log** (o alerta é desejável, a visibilidade no
  log é o piso).
- **Reason**: O critério de sucesso da própria SPEC 03 é "pg_cron forçado a falhar dispara alerta", e
  sem a extensão instalada isso é impossível de cumprir — a spec teria de mentir que entregou. Não é
  dependência para frente: instalar a extensão não depende de nada da SPEC 06, e a SPEC 06 passa a
  encontrar a vigilância pronta. A janela em código segue o raciocínio do AD-081 invertido:
  configuração ilegível é **uma das falhas que o vigia existe para denunciar**, então ele não pode
  depender dela para ligar, ou calaria justamente quando importa. Os três comportamentos do item (c)
  parecem inconsistência e não são: pular protege quem clona o repositório, falhar protege o banco, e
  seguir protege o produto.
- **Trade-off**: A SPEC 03 fica com uma migração que "pertenceria" à 06, e quem ler o roadmap sozinho
  pode estranhar. O vigia diário significa que uma falha de `pg_cron` da madrugada pode levar até 24h
  para alertar — deliberado: repositório privado tem cota mensal de minutos de Actions, e vigiar de
  hora em hora gastaria a cota inteira para acompanhar um job que roda uma vez por dia. Quem tem
  pressa dispara o workflow à mão. Fica também uma dívida operacional registrada: o `pg_cron` **não**
  limpa `cron.job_run_details` sozinho, e a poda entra junto do primeiro job de verdade, na SPEC 06.
- **Scope**: M9 (INFRA-09), contrato herdado por toda spec que criar job — SPEC 06 em diante.
- **Date**: 2026-08-17
- **Status**: active

