# SPEC 08 — Extração de provas (PDF → JSON)

| | |
| --- | --- |
| **Ordem** | 08 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 04, SPEC 07 |
| **Habilita** | SPEC 09, 10, 11, 26 |
| **Tasks (estimativa)** | ~11 |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **BANCO-03**, **BANCO-11**, **BANCO-12**, **IA-17** |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` · `.specs/modulos/m2-camada-ia/spec.md` (IA-17) |

## Problem Statement

O acervo é o fosso e não existe API pronta: ele sai do PDF oficial da banca. Sem extração
automatizada não há o que estudar, o que explicar nem sobre o que projetar o Raio-X — e digitar à
mão não escala.

## Goals

- [ ] PDF com texto nativo vira N questões estruturadas com `confianca_ia` preenchida.
- [ ] Nenhum pedido ao modelo passa de 272K tokens — a prova vai em blocos de questões.
- [ ] Imagem de questão vai para o Supabase Storage e é servida junto do enunciado.
- [ ] PDF escaneado cai em `precisa_ocr` e **não** é extraído no MVP.
- [ ] Tudo roda em script disparado por GitHub Actions / Batch API, retomável por chave de dedup.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-03 | saída estruturada por schema; entrada de PDF nativa do provedor; questão nasce `rascunho`/`em_revisao`, nunca `publicada`; `numero` oficial preservado | m1 §P1: Extração PDF → JSON |
| IA-17 | fatiamento em blocos + `detail: low` sem figura — o degrau de preço acima de 272K anula o desconto do modelo | m2 §P1: Gateway (AC10) |
| BANCO-11 | imagem extraída para o Storage, `imagens` jsonb com ref + posição; imagem que falhou manda a questão para revisão | m1 §P1: Extração (AC4) |
| BANCO-12 | detecção de PDF sem texto nativo → `status='precisa_ocr'`, fila para fast-follow | m1 §P1: Extração (AC3) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Gabarito, anuladas, retificação, classificação no tópico | SPEC 09 |
| Fila de revisão humana e publicação | SPEC 10 |
| Embedding e busca | SPEC 11 |
| OCR de escaneada | fora do MVP (AD-041) — só a fila existe |
| Questões inéditas | SPEC 37 |

## Dependências técnicas

Precisa da SPEC 04 (onde a questão é gravada) e da SPEC 07 (a chamada de IA é uma tarefa do
gateway; o nome do modelo não entra neste código).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Tamanho do bloco de fatiamento | a definir no Design, medindo tokens de uma prova real | n |
| Extração e explicação em chamadas separadas | **obrigatório** (invariante nº12) | y |
| Fonte legal | PDF oficial da banca (ato oficial, Lei 9.610/1998 art. 8º IV); **nunca raspar concorrente** | y (AD-003) |

**Pendências externas:** `OPENAI_API_KEY` e **2–3 PDFs de prova oficial** para o teste real.

## Success Criteria

- [ ] Prova real nativa vira N linhas estruturadas com `confianca_ia`
- [ ] Prova longa é enviada em blocos; nenhum pedido passa de 272K tokens
- [ ] Prova escaneada cai em `precisa_ocr` sem tentativa de extração
- [ ] Mesma prova submetida duas vezes não duplica questão
- [ ] Interromper no meio e retomar não reprocessa o que já saiu
- [ ] Nenhuma linha do pipeline roda em função da Vercel
