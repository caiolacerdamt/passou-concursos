# ROADMAP das specs — a ordem oficial de implementação

> **Para que serve.** Este arquivo é a **sequência única e inequívoca** de desenvolvimento. Abra uma
> sessão nova e diga apenas: **"Desenvolva a SPEC XX seguindo a `/tlc-spec-driven`"**. A spec XX vive
> em `.specs/features/XX-<nome>/spec.md` e já traz escopo, dependências, ritual e o que está fora.
>
> **Regra dura:** uma spec **só pode depender dela mesma ou de specs de número menor**. Se durante o
> Design aparecer uma dependência para frente, isso é bug do roadmap — registre uma AD nova no
> `.specs/STATE.md` e corrija aqui, não improvise no código.

## O corte do MVP (AD-089 / AD-090)

**As specs 01–14 são o MVP.** Ao fim da 14 o produto está no ar, vendendo e entregando. Da **15 em
diante** é evolução — nada ali bloqueia o lançamento.

O recorte anterior tinha 42 specs e marcava o lançamento no fim da 32. Ele era **ordenado por
arquitetura**, não por valor: as quatro primeiras specs não produziram nada que um aluno visse, e a
primeira tela só aparecia na spec 15. O recorte novo tem **36 specs**, com o lançamento na 14 e a
primeira tela na **07**.

| | Recorte de 42 (AD-086) | Recorte de 36 (AD-089) |
| --- | --- | --- |
| Specs até o lançamento | 32 | **14** |
| Tasks até o lançamento | ~270 restantes | **~107 restantes** |
| Primeira tela na spec | 15 | **07** |
| Documento de processo por spec | 4 arquivos, ~1.000 linhas | **1 ou 2 arquivos** (ver Ritual) |

## Ritual por spec — proporcional ao risco, não ao tamanho

O custo por rodada era quase o mesmo para uma tabela de configuração e para um webhook de pagamento.
Não é mais. Cada spec declara o seu ritual no cabeçalho:

| Ritual | O que produz | Quando |
| --- | --- | --- |
| **A — completo** | `design.md` próprio + `tasks.md` + `validation.md` + **Verificador independente completo**: AC por AC, com **sensor de mutação** | dinheiro, dado imutável e apagamento irreversível. **7 specs das 36** |
| **B — normal** | `tasks.md` com o design embutido numa seção curta no topo + **Verificador independente curto**: só os *Success Criteria*, com evidência `file:line`, **sem sensor de mutação**, relatório como seção no fim do `tasks.md` | o caso comum |
| **C — leve** | `tasks.md` direto + autoverificação do próprio autor contra os *Success Criteria* | mudança mecânica, configuração, ambiente |

**O que nunca cai, em nenhum ritual: autor ≠ verificador.** É a propriedade que pega erro de
verdade — a SPEC 04 se verificou sozinha e abriu dívida `Major` no mesmo dia. O que o Ritual B corta
é o **escopo** do verificador (Success Criteria em vez de todo AC, sem sensor de mutação), não a
independência dele. O Ritual C só é aceitável onde não há comportamento novo a quebrar.

Regras que valem para os três:

1. **`tasks.md` é checklist, não documento.** Teto de ~10 linhas por task. As tasks da SPEC 03 tinham
   46 linhas cada — não repetir.
2. **Sem meta numérica de teste.** Nada de `+8 testes (total ≥ 151)`. Testa-se o que quebra.
3. **Um PR por spec**, merge `--no-ff`, um commit atômico por task (`docs/GITFLOW.md`).
4. Ritual A **não** é negociável para baixo. Ritual B pode subir para A se o Design revelar risco novo
   — vira AD.
5. **A skill `tlc-spec-driven` roda o Verificador completo por padrão.** O ritual declarado na spec
   **substitui** esse padrão (as regras do projeto vencem as da skill, AD-090). Quem executar precisa
   dizer, em voz alta, qual ritual está seguindo antes de começar.

## Como os documentos se dividem

| Onde | O que é | Quem manda |
| --- | --- | --- |
| `.specs/STATE.md` | handoff vivo + contratos vigentes + decisões novas | **verdade máxima** (AD maior vence AD menor) |
| `.specs/STATE-ARQUIVO.md` | log histórico `AD-001`…`AD-087` | consulta, não leitura de rotina |
| `.specs/modulos/m*/spec.md` | as 9 specs temáticas — **texto dos requisitos** (`BANCO-`, `IA-`, `ALUNO-`…), critérios de aceite, edge cases | verdade sobre **o que** cada requisito exige |
| `.specs/ROADMAP.md` (este) + `.specs/features/NN-*/spec.md` | **ordem, fronteira, ritual e escopo** de cada rodada | verdade sobre **quando** e **em qual spec** |

Se discordarem: **conteúdo do requisito** → vence o módulo; **em qual spec ele entra** → vence o
roadmap. Requisito nunca é copiado para os dois lugares.

`.specs/modulos/` guarda também os documentos das rodadas já feitas (`design.md`, `tasks.md`,
`validation.md` de M9 e M4). Continuam válidos e as specs numeradas apontam para eles — nada daquele
trabalho é refeito.

---

## Marcos

| Marco | Specs | O que existe ao fim |
| --- | --- | --- |
| **Fundação** | 01–04 ✅ | projeto, configuração/flags, erro visível, acervo modelado |
| **Espinha do aluno** | 05–06 | log imutável, projeções, FSRS, plano do dia por regra |
| **A primeira tela** | 07 | site no ar, login, paywall testável |
| **Acervo real** | 08–10 | gateway de IA, primeiro lote ingerido, gabarito conferido, explicação com fonte |
| **A oferta** | 11 | Raio-X calculado, pesando o plano e visível na tela |
| **Dinheiro** | 12 | página de vendas, checkout Asaas, ativação automática |
| **O loop** | 13–14 | onboarding, plano, sessão, explicação, progresso, sequência, LGPD mínima |
| 🚀 **LANÇAMENTO** | **fim da 14** | — |
| **Operação e lei** | 15–18 | painel do operador, LGPD completa |
| **Retenção e profundidade** | 19–24 | quatro sinais, Raio-X completo, verificações, busca, tutor |
| **Evolução** | 25–36 | staging, notificação, flywheel, inéditas, simulado, tiers, áudio |

---

## O MVP — specs 01 a 14

| # | Spec | Resumo | Depende de | Tasks | Ritual | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Fundação do projeto | Next.js + TypeScript, Vitest (`unit`/`db`), Supabase CLI, CI | — | 4 | — | ✅ Concluída |
| 02 | Configuração e feature flags | tabela append-only `configuracoes`, catálogo em código, leitura com cache e queda segura | 01 | 5 | — | ✅ Concluída |
| 03 | Observabilidade e segredos | Sentry no ponto único de reporte, falha de job visível, migração aplicada por CI | 01, 02 | 10 | — | ✅ Concluída |
| 04 | Acervo — schema, taxonomia e proveniência | `provas`, `questoes` + versão, matérias/tópicos, enums, colunas de busca, trava de publicação | 02, 03 | 8 | — | ✅ Concluída (verificação **não independente**) |
| 05 | Log de tentativas | `tentativas` particionada, snapshot congelado, trava de 3 camadas **+ endurecimento por partição (AD-091)**, RLS, `registrarTentativa` | 04 | 7 | **A** | ✅ Concluída (T41–T47) |
| 06 | Projeções, revisão espaçada e plano do dia | `dominio_topico`, `caderno_erros`, FSRS, `recalcula_projecoes()`, `gera_plano_do_dia()`, `pg_cron` | 05 | **6** | B | ✅ Concluída (T48–T53) |
| 07 | **Interface, conta e deploy** | camada de estilo, shell responsivo, 4 estados, login e-mail+Google, `matricula` como chave única, Vercel no ar | 03 | **11** | B | ✅ Concluída (T54–T64) |
| 08 | Gateway de IA | `tarefa → modelo/esforço/batch/cache/fallback` por configuração, dedup, alerta de gasto; 1ª tarefa real = frase do plano | 02, 03, 06 | **10** | B | ✅ Concluída (T65–T74) |
| 09 | **Ingestão do primeiro lote** | PDF → questão estruturada + gabarito cruzado + classificação no tópico, por script em GitHub Actions | 04, 08 | 12 | B | ⬜ Não iniciada |
| 10 | **Publicação e explicações** | piso de confiança, fila humana única, porta de publicação, fábrica de explicação com citação conferida por código | 09 | 11 | B | ⬜ Não iniciada |
| 11 | **Raio-X — frequência, peso e tela** | taxa só de `origem='real'` com decaimento e amortecimento, porteiro do edital, substitui a view stub do plano, tela de leitura | 06, 07, 10 | 11 | B | ⬜ Não iniciada |
| 12 | **Checkout, funil e ativação** | página de vendas, Asaas cartão/Pix/boleto, webhook verificado e idempotente, reconciliação, garantia de 7 dias, 18+ | 07 | 12 | **A** | ⬜ Não iniciada |
| 13 | **Onboarding, plano e sessão** | pagar → senha → meta → plano do 1º dia → responder com causa do erro → explicação com fonte. **É o loop central** | 06, 07, 10, 12 | 12 | B | ⬜ Não iniciada |
| 14 | **Progresso, LGPD mínima e go-live** | caderno de erros, histórico, sequência, apagamento por pedido, política publicada, checklist de lançamento | 06, 11, 13 | 10 | **A** | ⬜ Não iniciada |
| — | 🚀 **LANÇAMENTO** | — | — | — | — | — |

**Restam ~73 tasks em 6 specs** para lançar.

## Depois do lançamento — specs 15 a 36

| # | Spec | Resumo | Depende de | Tasks | Ritual |
| --- | --- | --- | --- | --- | --- |
| 15 | Painel do operador | fila de revisão na tela, curadoria da taxonomia, tela de configuração com histórico | 07, 10 | 10 | B |
| 16 | LGPD — grupos, RLS e auditoria | classificação dos 3 grupos no schema, acumulador anônimo com piso, `auditoria` só-INSERT | 05, 12, 14 | 10 | B |
| 17 | LGPD — política, base legal e consentimento | finalidades e bases declaradas, opt-out do flywheel, consentimento só de marketing | 12, 16 | 8 | C |
| 18 | LGPD — esquecimento, retenção e canal do titular | rotina endurecida com backups, retenção por inatividade, exportação, correção, prazo de 15 dias | 16, 17 | 12 | **A** |
| 19 | Gamificação — os quatro sinais | anel por bloco com teto, "no prazo", progresso desde o ponto de partida | 11, 13, 14 | 12 | B |
| 20 | Raio-X — núcleo × condicional e atualidade | corte por posição dentro da banca, empurrão com teto, fila da base ordenada | 06, 11 | 10 | B |
| 21 | Ciclo de vida da explicação | invalidação por mudança substantiva, fila de revisão, "foi útil?" e "reportar erro" | 10 | 9 | B |
| 22 | Verificação quantitativa | catálogo fechado de fórmulas + funções nossas testadas, cruzamento duplo, refaz 1× | 08, 10 | 9 | B |
| 23 | Busca híbrida, embeddings e dedup | embedding Cohere + HNSW, `tsvector` PT, busca híbrida, candidatas a duplicata | 04, 10 | 9 | B |
| 24 | Tutor de dúvidas | streaming na Vercel Pro, contexto injetado, teto diário, cache, degradação limpa | 08, 10, 13 | 11 | **A** |
| 25 | Ambientes, staging e preview por branch | preview por branch, branch do Supabase, link mágico como 3º login | 07 | 8 | C |
| 26 | Gamificação — perdão, notificação e limites | escudos com teto 2, reset suave, folga programada, 1 lembrete/dia com consentimento | 17, 19 | 10 | B |
| 27 | Raio-X — curadoria e pivot do edital | candidato a tópico novo, empurrão registrado com validade, diff do edital | 15, 20 | 10 | B |
| 28 | Antecipação, fim da matrícula e conciliação | venda não-antecipável, avisos de 30/7 dias, renovação, relatório de conciliação, reemissão de NF | 12 | 9 | **A** |
| 29 | Flywheel — esteiras 1 e 2 | índice de discriminação, dificuldade calibrada, pré-diagnóstico por IA, auto-aplicação reversível | 15, 16, 17 | 11 | B |
| 30 | Eval cego e revisão da matriz de modelos | ~50 questões avaliadas às cegas como porteiro de modelo | 08, 10 | 8 | C |
| 31 | Questões inéditas | rascunho no padrão da banca, `origem='gerada_ia'`, 100% de revisão humana, fora da taxa do Raio-X | 10, 11, 15 | 9 | B |
| 32 | Simulado, diagnóstico adaptativo e formato da banca | bloco de simulado, causa na revisão pós-prova, diagnóstico de ~20 questões, módulo A–E × Certo/Errado | 08, 13, 20 | 12 | B |
| 33 | Grupo 3 — sequência pseudonimizada | código por aluno, tabela de correspondência separada, some no DELETE, LIA antes de ligar | 18, 29 | 7 | **A** |
| 34 | Tiers e mensalidade | mais de um plano sem migração destrutiva, decidido com dado do flywheel | 28, 29 | 6 | B |
| 35 | Áudio — fábrica de voz | teste cego como porteiro, normalização antes da voz, geração 1× por versão | 16, 21 | 11 | B · 🧊 Congelada (AD-064) |
| 36 | Áudio — escopo, controles e reserva | escopo por frequência, teto de gasto por lote, provedor reserva, controles de escuta | 35 | 9 | B · 🧊 Congelada (AD-064) |

**Total:** ~344 tasks em 36 specs (era ~391 em 42). Nenhuma spec passa de 12 — e se a fase Tasks
desmentir para cima, a spec se divide antes de entrar em Execute.

---

## O que o MVP corta, e o que isso custa

Nada abaixo é esquecimento. Cada linha é decisão registrada na AD-090.

| Cortado do lançamento | Vai para | O que se perde até lá |
| --- | --- | --- |
| **Tutor de dúvidas** | 24 | a feature mais vistosa da oferta. Também a mais cara e a que exige Vercel Pro. A página de vendas **não pode prometê-la** |
| **Raio-X: núcleo × condicional e atualidade** | 20, 27 | o Raio-X do lançamento é frequência real amortecida — honesto e suficiente para o plano e para a oferta |
| Anel do dia, "no prazo", progresso desde o ponto de partida | 19 | fica só a sequência. É o sinal que sustenta o hábito |
| Painel do operador na tela | 15 | você opera a fila de revisão pelo Supabase Studio |
| Verificação quantitativa por catálogo de fórmulas | 22 | **no primeiro lote a conta é conferida à mão** e a questão de conta vai para a fila humana |
| Busca híbrida, embeddings e dedup por similaridade | 23 | a base de referência do primeiro lote é curada em documentos pequenos, enviados inteiros |
| Ciclo de vida da explicação e botões de feedback | 21 | retificação de gabarito exige ação manual até lá |
| Diagnóstico adaptativo e IA do plano inicial | 32 | o onboarding pergunta o nível. O diagnóstico é pulável por invariante (nº5) |
| Preview por branch, branch do Supabase, link mágico | 25 | deploy da `main`; evita o custo do Supabase Pro sem aluno pagante |
| **LGPD: grupos formais, auditoria, canal do titular, retenção automática** | 16, 17, 18 | ⚠️ o pedido de exclusão é atendido por **procedimento manual documentado**. Aceitável com dezenas de alunos, **não** com milhares |
| Antecipação, avisos de vencimento, conciliação | 28 | a validade da matrícula já corta o acesso; o resto só importa 12 meses depois |
| Inéditas, simulado, flywheel, eval cego, tiers, áudio, grupo 3 | 29–36 | nenhum vende a primeira assinatura |

**O que não foi cortado, e por quê:** `tentativas` só-INSERT (errar aqui obriga a refazer tudo) · RLS
em toda tabela com `user_id` (é segurança, não feature) · webhook do Asaas verificado e idempotente
(é dinheiro) · proveniência da questão e gabarito oficial (é a promessa e é a legalidade) · política
de privacidade e apagamento por pedido (obrigação desde o primeiro pagante).

---

## Regras que valem para toda spec

1. **Flag primeiro.** Todo módulo entra atrás de flag (AD-001). O AD-076 define quais nascem ligadas:
   plano do dia, sessão de questões, progresso e conta. O resto nasce desligado — e **mesmo desligado
   é construído**, quando estiver no escopo da spec.
2. **Toda chave de configuração nova entra no catálogo** (`src/modules/config/catalogo.ts`) na mesma
   task que a usa. Chave órfã reprova no teste da spec 02.
3. **Tabela com `user_id` é grupo 1.** Toda spec que criar uma precisa (a) declarar o grupo,
   (b) ligar RLS na própria migração e (c) **estender a rotina de apagamento da SPEC 14 e o teste
   dela na mesma task** — não depois.
4. **Nada de IA fora do gateway** (spec 08). Nome de modelo em código ou em teste é proibição do
   `AGENTS.md`.
5. **Trabalho longo nunca em serverless** (AD-036): script disparado por GitHub Actions ou Batch API.
   Job leve e recorrente vai em `pg_cron`.

## Pendências externas que travam specs específicas

| Spec | O que falta antes de começar | Urgência |
| --- | --- | --- |
| 07 | conta na Vercel | baixa (grátis, minutos) |
| 08, 09 | `OPENAI_API_KEY` provisionada | **alta** |
| 09 | **3–4 PDFs de prova oficial na mão** | **alta — é o caminho crítico do acervo** |
| 12 | **CNPJ + conta Asaas + contrato lido** (o que volta num estorno, D+ do parcelado) | **a mais longa do MVP — começar hoje, em paralelo** |
| 12 | free tier do PostHog confirmado em fonte primária (AD-079) | média |
| 14 | advogado: texto da política, encarregado (DPO) | média — sobe com redação própria e é revisado (risco registrado na AD-090) |
| 17, 18 | advogado: base legal das questões, janela de 24m, LIA, instrumento da transferência para os EUA | pós-lançamento |
| 23 | chave da Cohere (preço do `embed-v4` ainda não confirmado) | pós-lançamento |
| 24 | **Vercel Pro** (streaming do tutor, INFRA-05/AD-066) | pós-lançamento |
| 25 | **Supabase Pro** se o staging por branch for pra valer | pós-lançamento |
| 35 | **teste cego da voz** — trava o primeiro lote (`experiments/tts-comparacao/`) | congelada |

## Cobertura dos requisitos dos módulos

Os 126 requisitos das 9 specs temáticas continuam todos cobertos — o recorte mudou **quando** cada um
é construído, não **se**. `INFRA-08` (n8n) segue fora de escopo por decisão registrada (AD-035/AD-002).

| Módulo | Requisitos | No MVP (01–14) | Depois (15–36) |
| --- | --- | --- | --- |
| M1 — banco de questões | BANCO-01…13 | 04, 09, 10 | 15, 23, 31 |
| M2 — camada de IA | IA-01…17 | 08, 10 | 21, 22, 24, 30 |
| M3 — áudio | TTS-01…11 | — | 35, 36 |
| M4 — coluna vertebral | ALUNO-01…12 | 05, 06, 08, 13 | 14, 32 |
| M5 — Raio-X | RAIOX-01…15 | 11 | 20, 27, 32 |
| M6 — gamificação | GAM-01…14 | 14 (GAM-02, GAM-08) | 19, 26 |
| M7 — LGPD e flywheel | DADOS-01…15 | 12 (DADOS-11), 14 (parte de 01 e 04) | 16, 17, 18, 29, 33 |
| M8 — negócio e pagamentos | PAG-01…17 | 07, 12, 13 | 28, 34 |
| M9 — infra | INFRA-01…12 | 02 ✅, 03 ✅, 05, 06, 07, 08, 12 | 18, 24, 25 |
