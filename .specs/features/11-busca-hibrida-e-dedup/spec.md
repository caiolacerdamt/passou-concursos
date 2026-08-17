# SPEC 11 — Busca híbrida, embeddings e dedup

| | |
| --- | --- |
| **Ordem** | 11 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 04, SPEC 10 |
| **Habilita** | SPEC 13 (grounding busca trecho), 34 (diff do edital), 37 |
| **Tasks (estimativa)** | ~9 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **BANCO-09** (execução: embedding + fts), **BANCO-06** |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` |

## Problem Statement

O grounding da explicação (SPEC 13) precisa achar o trecho certo do documento de referência, e o
acervo repete questão entre anos. As duas coisas saem do mesmo índice: embedding (HNSW) + fts em
português, com busca híbrida.

## Goals

- [ ] Toda questão publicada tem `embedding` e `fts` preenchidos; versão nova regera o embedding.
- [ ] Existe uma função de busca híbrida reutilizável, testada.
- [ ] Par de questões parecidas é **sinalizado** como candidato a duplicata — nunca mesclado sozinho.
- [ ] Trocar de provedor de embedding é re-embeddar em lote, sem tocar no fato da questão.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-09 | geração de embedding (Cohere `embed-v4`, chamada **direta**, fora do gateway — AD-005), `tsvector` PT, busca híbrida, regeração por versão | §P1: Schema + busca híbrida |
| BANCO-06 | limite de similaridade em configuração; candidata a duplicata para decisão humana; canônica × vinculada mantendo a proveniência das duas | §P2: Dedup por embedding |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Busca semântica ao vivo para o aluno | não existe no lançamento (AD-012) |
| Base de referência e uso do índice na explicação | SPEC 13 |
| Contagem da frequência do Raio-X | SPEC 26 (duplicata confirmada conta uma vez — a regra nasce aqui) |

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Provedor de embedding | **Cohere embed-v4** (alternativa: Voyage) | y (AD-005) / **n (preço não confirmado)** |
| Limite de similaridade | em configuração (cosine) | n (calibra) |
| Embedding fora do gateway de IA | sim — `gpt-5.6-luna` não expõe endpoint de embeddings | y (AD-073) |

**Pendência externa:** chave da Cohere e confirmação do preço do `embed-v4`.

## Success Criteria

- [ ] Duas questões parecidas se aproximam numa busca por similaridade
- [ ] A mesma questão em dois anos aparece como par candidato, sem mesclagem automática
- [ ] Versão nova de questão regera o embedding
- [ ] Re-embeddar o acervo inteiro não altera nenhuma linha do fato da questão
