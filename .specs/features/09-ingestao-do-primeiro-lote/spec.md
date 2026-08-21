# SPEC 09 — Ingestão do primeiro lote: PDF → questão com gabarito

| | |
| --- | --- |
| **Ordem** | 09 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 04, SPEC 08 |
| **Habilita** | SPEC 10, 11, 15, 22, 23, 31 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Status** | ✅ Concluída (T75–T86) |
| **Requisitos** | **BANCO-03**, **BANCO-11**, **BANCO-12**, **IA-17**, **BANCO-04**, **BANCO-13** (comportamento), **BANCO-05** (parte: classificação) |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` · `.specs/modulos/m2-camada-ia/spec.md` (IA-17) |
| **Vem de** | SPEC 08 + SPEC 09 do recorte de 42, **fundidas** (AD-089) |

## Problem Statement

O acervo é o fosso e não existe API pronta: ele sai do PDF oficial da banca. Sem acervo, tudo que
foi construído até aqui é casca. Extração e gabarito viram **uma spec só** porque são a mesma
passada sobre a mesma prova — separá-las era pedágio de processo, não fronteira técnica.

**Isto é um script, não uma indústria.** O alvo desta spec é o primeiro lote real de provas na mão,
não um pipeline que engole qualquer PDF do mundo.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-03 | saída estruturada por schema; questão nasce `rascunho`/`em_revisao`, nunca `publicada`; `numero` oficial preservado | m1 §P1: Extração PDF → JSON |
| IA-17 | fatiamento em blocos de questões; nenhum pedido passa de 272K tokens (o degrau de preço anula o desconto do modelo) | m2 §P1: Gateway (AC10) |
| BANCO-11 | imagem para o Supabase Storage, `imagens` jsonb com ref + posição; imagem que falhou manda a questão para revisão | m1 §P1: Extração (AC4) |
| BANCO-12 | PDF sem texto nativo → `status='precisa_ocr'`, fila para depois; **não** é extraído no MVP | m1 §P1: Extração (AC3) |
| BANCO-04 | cruzamento com o gabarito definitivo por `numero`; `anulada = true` mantendo a questão; retificação → `questao_versao` nova sem reescrever a anterior | m1 §P1: Cruzamento de gabarito |
| BANCO-13 | marcação **cosmética × substantiva** registrada no momento em que a versão nasce | m1 §P1: Cruzamento (AC3) + m2 IA-09 AC4 |
| BANCO-05 (parte) | classificação da questão no tópico como tarefa do gateway; tópico inexistente vira **candidato**, nunca canônico | m1 §P3: Tela de curadoria (AC1) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Piso de confiança, fila de revisão, porta de publicação | SPEC 10 |
| Explicação | SPEC 10 |
| Verificação da conta em questão quantitativa | SPEC 22 — **no primeiro lote, o humano confere na mão** |
| Embedding, busca híbrida e dedup por similaridade | SPEC 23 — a dedup aqui é por `(prova, numero)`, não por semelhança |
| Tela de curadoria da taxonomia | SPEC 15 |
| OCR de escaneada | fora do MVP (AD-041) — só a fila existe |
| Questões inéditas | SPEC 31 |

## Contratos que esta spec fixa para as próximas

- Questão **anulada** conta na frequência do Raio-X (a banca cobrou o assunto) e **não** vira treino
  — as duas regras vivem em specs diferentes (11 e 06) e nascem deste campo.
- A classificação "cosmética × substantiva" **SHALL NOT** ser inferida depois pela IA.
- Extração e explicação são **chamadas separadas** ao modelo (invariante nº12).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Tamanho do bloco de fatiamento | definido nas Tasks, medindo tokens de uma prova real | n |
| Fonte legal | PDF oficial da banca (Lei 9.610/1998 art. 8º IV); **nunca raspar concorrente** | y (AD-003) |
| Gabarito antes ou depois da extração | o cruzamento é idempotente e espera as questões existirem | y (edge case do M1) |
| Tamanho do primeiro lote | 3–4 provas, foco nas matérias de maior peso — **não** 10 anos das 3 bancas | y (AD-090) |

**Pendências externas:** `OPENAI_API_KEY` e **os PDFs de prova oficial na mão**.

## Success Criteria

- [ ] Prova real nativa vira N linhas estruturadas com `confianca_ia`
- [ ] Nenhum pedido ao modelo passa de 272K tokens
- [ ] Prova escaneada cai em `precisa_ocr` sem tentativa de extração
- [ ] Mesma prova submetida duas vezes não duplica questão; interromper e retomar não reprocessa
- [ ] Rodar o gabarito preenche `resposta_correta` + `gabarito_versao` e marca as anuladas
- [ ] Retificar gabarito de questão respondida cria versão nova; a tentativa antiga segue apontando para a versão que respondeu
- [ ] Tópico sugerido inexistente vira candidato e **não** cria tópico canônico
- [ ] Nenhuma linha do pipeline roda em função da Vercel
