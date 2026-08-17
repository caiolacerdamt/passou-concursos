# ROADMAP das specs — a ordem oficial de implementação

> **Para que serve.** Este arquivo é a **sequência única e inequívoca** de desenvolvimento. Abra uma
> sessão nova e diga apenas: **"Desenvolva a SPEC XX seguindo a `/tlc-spec-driven`"**. A spec XX vive
> em `.specs/features/XX-<nome>/spec.md` e já traz escopo, dependências e o que está fora.
>
> **Regra dura:** uma spec **só pode depender dela mesma ou de specs de número menor**. Se durante o
> Design aparecer uma dependência para frente, isso é bug do roadmap — registre uma AD nova no
> `.specs/STATE.md` e corrija aqui, não improvise no código.

## Como os documentos se dividem

| Onde | O que é | Quem manda |
| --- | --- | --- |
| `.specs/STATE.md` | log append-only de decisões `AD-NNN` | **verdade máxima** (AD maior vence AD menor) |
| `.specs/modulos/m*/spec.md` | as 9 specs temáticas — **texto dos requisitos** (`BANCO-`, `IA-`, `ALUNO-`…), critérios de aceite, edge cases | verdade sobre **o que** cada requisito exige |
| `.specs/ROADMAP.md` (este) + `.specs/features/NN-*/spec.md` | **ordem, fronteira e escopo** de cada rodada de implementação | verdade sobre **quando** e **em qual spec** cada requisito é construído |

Se as duas discordarem: **conteúdo do requisito** → vence o módulo; **em qual spec ele entra** →
vence o roadmap. Requisito nunca é copiado para os dois lugares justamente para não divergir.

`.specs/modulos/` guarda também os documentos das rodadas já feitas (`design.md`, `tasks.md`,
`validation.md` de M9 e M4). Eles continuam válidos e as specs numeradas apontam para eles — nada
daquele trabalho é refeito.

## Marcos

| Marco | Specs | O que existe ao fim |
| --- | --- | --- |
| **Fundação** | 01–03 | projeto, configuração/flags, erro visível |
| **Espinha do aluno (servidor)** | 04–06 | acervo modelado, log imutável, projeções, plano do dia por regra |
| **Acervo real e IA** | 07–14 | gateway, provas ingeridas, gabarito conferido, explicação com fonte |
| **Interface, conta e dinheiro** | 15–21 | UI, deploy, login, checkout Asaas, página de vendas |
| **Superfícies do aluno** | 22–25 | as 4 telas que o AD-076 manda nascer ligadas |
| **Raio-X e hábito** | 26–29 | fator "quanto cai" real no plano, 4 sinais, tutor |
| **LGPD** | 30–32 | grupos, auditoria, esquecimento e retenção |
| 🚀 **LANÇAMENTO** | fim da 32 | tudo que o AD-076 exige construído; o que é P2/P3 nasce atrás de flag |
| **Fast-follow** | 33–42 | perdão da sequência, atualidade, flywheel, inéditas, simulado, áudio |

---

## A sequência

| # | Spec | Resumo | Depende de | Tasks (est.) | Dificuldade | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Fundação do projeto | Next.js + TypeScript, Vitest (`unit`/`db`), Supabase CLI, CI de build/lint/teste | — | 4 | Fácil | ✅ Concluída |
| 02 | Configuração e feature flags | Tabela append-only `configuracoes`, catálogo em código, leitura com cache e queda segura, escrita com autor | 01 | 5 | Média | ✅ Concluída |
| 03 | Observabilidade e segredos | Sentry ligado ao ponto único de reporte, falha de job visível, disciplina de segredo, migração aplicada por CI | 01, 02 | 10 | Média | ✅ Concluída |
| 04 | Acervo — schema, taxonomia e proveniência | `provas`, `questoes` + versão, matérias/tópicos, enums, colunas de busca, trava de publicação sem proveniência | 02, 03 | **8** | Média | ✅ Concluída (verificação **não independente** — ver `validation.md`) |
| 05 | Log de tentativas | `tentativas` particionada, snapshot congelado, trava de 3 camadas, RLS, sessões, `registrarTentativa` | 04 | 8 | Difícil | 🟨 Design e tasks prontos (T11–T15) |
| 06 | Projeções, revisão espaçada e plano do dia | `dominio_topico`, `caderno_erros`, FSRS, `recalcula_projecoes()`, `gera_plano_do_dia()`, `pg_cron` | 05 | 10 | Difícil | 🟨 Design e tasks prontos (T16–T21) |
| 07 | Gateway de IA | `tarefa → modelo/esforço/batch/cache/fallback` por configuração, chave de dedup, versão de prompt, alerta de gasto; 1ª tarefa real = frase do plano | 02, 03, 06 | 11 | Difícil | ⬜ Não iniciada |
| 08 | Extração de provas (PDF → JSON) | Fatiamento por blocos, saída estruturada, imagens no Storage, `precisa_ocr`, retomada por dedup, GitHub Actions | 04, 07 | 11 | Difícil | ⬜ Não iniciada |
| 09 | Gabarito, versões e classificação | Cruzamento do gabarito definitivo, anuladas, retificação vira versão nova, classificação no tópico | 08 | 9 | Média | ⬜ Não iniciada |
| 10 | QA e publicação do acervo | Piso de confiança, amostra de auditoria, fila humana, `questao_revisoes`, porta de publicação | 09 | 9 | Média | ⬜ Não iniciada |
| 11 | Busca híbrida, embeddings e dedup | Embedding Cohere + HNSW, `tsvector` PT, busca híbrida, candidatas a duplicata | 04, 10 | 9 | Média | ⬜ Não iniciada |
| 12 | Verificação quantitativa | Catálogo fechado de fórmulas + funções nossas testadas, cruzamento duplo, refaz 1×, taxa de não-cobertura | 07, 10 | 9 | Média | ⬜ Não iniciada |
| 13 | Base de referência e fábrica de explicações | `base_referencia`, grounding por documento entregue, citação conferida por código, fonte mínima | 11, 12 | 11 | Difícil | ⬜ Não iniciada |
| 14 | Ciclo de vida da explicação | Invalidação por mudança substantiva, fila de revisão, cosmético não regera, feedback do aluno | 13 | 8 | Média | ⬜ Não iniciada |
| 15 | Fundação da interface | Camada de estilo, shell responsivo, estados de carga/erro/vazio, acessibilidade base | 03 | 8 | Média | ⬜ Não iniciada |
| 16 | Ambientes, staging e deploy | Vercel ligado ao repo, preview por branch, branch do Supabase, migração para produção só por merge | 03, 15 | 8 | Média | ⬜ Não iniciada |
| 17 | Conta, login e papéis | E-mail+senha, Google, link mágico, `matricula` como única chave do conteúdo, papel de operador | 15, 16 | 10 | Média | ⬜ Não iniciada |
| 18 | Painel do operador | Fila de revisão de questões, curadoria da taxonomia, tela de configuração com histórico | 10, 17 | 10 | Média | ⬜ Não iniciada |
| 19 | Checkout e ativação (Asaas) | Checkout próprio, cartão 12x/Pix/boleto, webhook verificado e idempotente, reconciliação, NF, 18+ | 16, 17 | 12 | Difícil | ⬜ Não iniciada |
| 20 | Garantia, antecipação e fim da matrícula | Janela de 7 dias, venda não-antecipável, avisos de 30/7 dias, histórico preservado, conciliação | 19 | 9 | Média | ⬜ Não iniciada |
| 21 | Página de vendas e funil pré-login | Método, evidências, preço nos dois formatos, eventos anônimos por proxy reverso | 19, 20 | 9 | Média | ⬜ Não iniciada |
| 22 | Sessão de questões | Abrir bloco do plano, responder, causa do erro obrigatória no treino, dedup, proveniência visível | 06, 10, 17 | 11 | Difícil | ⬜ Não iniciada |
| 23 | Explicação e feedback na tela | Explicação servida do banco, questão sem explicação válida, "foi útil?" e "reportar erro" | 14, 22 | 8 | Média | ⬜ Não iniciada |
| 24 | Onboarding, diagnóstico e plano na tela | Meta e nível declarado, diagnóstico pulável (adaptativo atrás de flag), plano do 1º dia, tela do plano | 06, 07, 19, 22 | 11 | Difícil | ⬜ Não iniciada |
| 25 | Progresso — caderno de erros e histórico | Caderno filtrável por causa e tópico, histórico do aluno, estado inicial explícito | 06, 24 | 7 | Média | ⬜ Não iniciada |
| 26 | Raio-X — perfil de concurso e frequência real | `perfil_concurso` multi-concurso, taxa só de `origem='real'` com decaimento por ano, `n_questoes`, tendência, job | 04, 10 | 11 | Difícil | ⬜ Não iniciada |
| 27 | Raio-X — amortecimento, núcleo × condicional e plano | Amortecimento por amostra, corte por posição, porteiro do edital, empurrão com teto; substitui a view stub do plano | 06, 26 | 10 | Difícil | ⬜ Não iniciada |
| 28 | Gamificação — os quatro sinais | Sequência pelo piso, anel por bloco com teto, "no prazo", progresso desde o ponto de partida, tela | 24, 25, 27 | 12 | Difícil | ⬜ Não iniciada |
| 29 | Tutor de dúvidas | Streaming na Vercel Pro, contexto injetado, teto diário, cache de pergunta repetida, degradação limpa | 07, 13, 22 | 11 | Difícil | ⬜ Não iniciada |
| 30 | LGPD — grupos, RLS e auditoria | Classificação dos 3 grupos no schema, acumulador anônimo com piso, RLS por sensibilidade, `auditoria` só-INSERT | 05, 19, 28, 29 | 10 | Média | ⬜ Não iniciada |
| 31 | LGPD — política, base legal e consentimento | Política em PT-BR com finalidades e operadores, opt-out do flywheel, consentimento só de marketing, 18+ nos termos | 19, 30 | 8 | Média | ⬜ Não iniciada |
| 32 | LGPD — esquecimento, retenção e canal do titular | DELETE seletivo idempotente (inclui backups), retenção por inatividade, exportação, correção, prazo de 15 dias | 30, 31 | 12 | Difícil | ⬜ Não iniciada |
| — | 🚀 **LANÇAMENTO** | — | — | — | — | — |
| 33 | Gamificação — perdão, notificação e limites | Escudos com teto 2, reset suave, folga programada, 1 lembrete/dia com consentimento, sem ranking | 28, 31 | 10 | Média | ⬜ Não iniciada |
| 34 | Raio-X — atualidade, curadoria e pivot do edital | Candidato a tópico novo, empurrão registrado com validade, tela do Raio-X, diff do edital | 18, 27 | 10 | Média | ⬜ Não iniciada |
| 35 | Flywheel — esteiras 1 e 2 | Índice de discriminação, dificuldade calibrada, pré-diagnóstico por IA, auto-aplicação por lista fechada reversível | 18, 30, 31 | 11 | Difícil | ⬜ Não iniciada |
| 36 | Eval cego e revisão da matriz de modelos | ~50 questões avaliadas às cegas como porteiro de modelo, rotina periódica de revisão da matriz | 07, 13 | 8 | Média | ⬜ Não iniciada |
| 37 | Questões inéditas | Rascunho no padrão da banca, `origem='gerada_ia'`, 100% de revisão humana, fora da taxa do Raio-X | 10, 26 | 9 | Média | ⬜ Não iniciada |
| 38 | Simulado semanal e formato da banca | Bloco de simulado, causa na revisão pós-prova com `faltou_tempo`, módulo de formato A–E × Certo/Errado | 22, 27 | 9 | Média | ⬜ Não iniciada |
| 39 | Áudio — fábrica de voz | Teste cego como porteiro, normalização antes da voz, geração 1× por versão, questão + explicação num arquivo | 14, 30 | 11 | Difícil | 🧊 Congelada (AD-064) |
| 40 | Áudio — escopo, controles e reserva | Escopo por frequência, teto de gasto por lote, provedor reserva em standby, controles de escuta | 39 | 9 | Média | 🧊 Congelada (AD-064) |
| 41 | Grupo 3 — sequência pseudonimizada | Código por aluno, tabela de correspondência separada, some no DELETE, LIA antes de ligar | 32, 35 | 7 | Média | ⬜ Não iniciada |
| 42 | Tiers e mensalidade | Modelo de dados para mais de um plano sem migração destrutiva, decidido com dado do flywheel | 20, 35 | 6 | Média | ⬜ Não iniciada |

**Total estimado:** ~391 tasks em 42 specs (média de 9,3 por spec). Nenhuma spec passa de 12 — e se a
fase Tasks desmentir para cima, a spec se divide antes de entrar em Execute.

**Cobertura:** os 126 requisitos das specs temáticas estão citados nas specs numeradas, com uma
exceção declarada: **INFRA-08** (n8n) é fora de escopo por decisão registrada (AD-035/AD-002).

---

## Regras que valem para toda spec daqui para frente

1. **Flag primeiro.** Todo módulo entra atrás de flag (AD-001). O AD-076 define quais nascem ligadas:
   plano do dia, sessão de questões, progresso e conta. Todo o resto nasce desligado — e **mesmo
   desligado é construído**.
2. **Toda chave de configuração nova entra no catálogo** (`src/modules/config/catalogo.ts`) na mesma
   task que a usa. Chave órfã reprova no teste da spec 02.
3. **Tabela com `user_id` é grupo 1.** Toda spec que criar uma precisa (a) declarar o grupo,
   (b) ligar RLS na própria migração e (c) **entrar na rotina de esquecimento da spec 32**. Specs
   posteriores à 32 estendem a rotina **e** o teste dela na mesma task — não depois.
4. **Nada de IA fora do gateway** (spec 07). Nome de modelo em código ou em teste é proibição do
   `AGENTS.md`.
5. **Trabalho longo nunca em serverless** (AD-036): script disparado por GitHub Actions ou Batch API.
   Job leve e recorrente vai em `pg_cron`.
6. **Uma branch por spec**, PR com merge `--no-ff`, um commit atômico por task (`docs/GITFLOW.md`).

## Pendências externas que travam specs específicas

| Spec | O que falta antes de começar |
| --- | --- |
| ~~03~~ | ~~conta no Sentry~~ — criada em 2026-08-16, região **EUA** (AD-087) |
| 07, 08 | `OPENAI_API_KEY` provisionada |
| 08 | **2–3 PDFs de prova oficial** na mão para o teste real |
| 11 | chave da Cohere (preço do `embed-v4` ainda não confirmado) |
| 16 | conta na Vercel; **Supabase Pro** se o staging por branch for pra valer (decisão de custo) |
| 19 | conta Asaas + contrato lido (o que volta num estorno, D+ do parcelado) + CNPJ/regime com o contador |
| 21 | free tier do PostHog confirmado em fonte primária (AD-079) |
| 29 | **Vercel Pro** (streaming do tutor, INFRA-05/AD-066) |
| 31, 32 | advogado: base legal das questões, janela de 24m, LIA, instrumento da transferência para os EUA |
| 39 | **teste cego da voz** — trava o primeiro lote (`experiments/tts-comparacao/`) |

## Cobertura dos requisitos dos módulos

Os 126 requisitos das 9 specs temáticas estão distribuídos assim (o detalhe por requisito está na
seção `Requirement Traceability` de cada spec numerada):

| Módulo | Requisitos | Specs que os constroem |
| --- | --- | --- |
| M1 — banco de questões | BANCO-01…13 | 04, 08, 09, 10, 11, 18, 37 |
| M2 — camada de IA | IA-01…17 | 07, 08, 12, 13, 14, 29, 36 |
| M3 — áudio | TTS-01…11 | 39, 40 |
| M4 — coluna vertebral | ALUNO-01…12 | 05, 06, 07, 22, 24, 25, 38 |
| M5 — Raio-X | RAIOX-01…15 | 26, 27, 34, 38 |
| M6 — gamificação | GAM-01…14 | 28, 33 |
| M7 — LGPD e flywheel | DADOS-01…15 | 30, 31, 32, 35, 41 |
| M8 — negócio e pagamentos | PAG-01…17 | 17, 19, 20, 21, 24, 42 |
| M9 — infra | INFRA-01…12 | 02 ✅, 03 ✅, 05, 06, 07, 16, 21, 29, 32 (INFRA-08 é fora de escopo declarado) |
