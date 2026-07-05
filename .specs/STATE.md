# STATE

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
- **Status**: active (nomes de modelo **[provisível]**)

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

## Handoff

- **Feature**: — (nenhuma feature iniciada; STATE.md recém-inicializado a partir do PRD)
- **Phase / Task**: Bootstrap do `.specs/` concluído — Decisions AD-001…AD-035 importados do PRD §11
- **Completed**: STATE.md (Decisions log)
- **In-progress** (file:line): none
- **Next step**: Rodar Specify no MVP começando pelo loop central — M1 (banco) → M4 (log imutável/coluna vertebral, com o maior cuidado na fundação AD-015) → M2 (IA) → M8 (negócio/auth/pagamentos). Primeira feature sugerida: M4 / fundação de `tentativas` como event sourcing.
- **Blockers**: none
- **Uncommitted files**: `.specs/STATE.md`
- **Branch**: — (projeto não é repositório git)
