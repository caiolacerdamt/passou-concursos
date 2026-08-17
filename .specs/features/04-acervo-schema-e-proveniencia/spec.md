# SPEC 04 — Acervo: schema, taxonomia e proveniência

| | |
| --- | --- |
| **Ordem** | 04 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 02, SPEC 03 |
| **Habilita** | SPEC 05 (o log referencia questão), 08, 09, 10, 11, 26 |
| **Tasks (estimativa)** | ~10 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **BANCO-01**, **BANCO-02**, **BANCO-05** (parte: taxonomia), **BANCO-09** (parte: schema e índices), **BANCO-13** |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` |

## Problem Statement

`tentativas` (SPEC 05) referencia questão, tópico e matéria; o Raio-X (SPEC 26) conta questão por
banca e por ano; a fábrica de explicação (SPEC 13) escreve por `(questao_id, questao_versao)`. Todos
esses contratos são de **estrutura**, não de pipeline. Modelar o acervo primeiro elimina o stub que
a rodada 1 do M4 previa (T10) e faz o log nascer apontando para tabelas de verdade.

## Goals

- [ ] `questoes` existe com o contrato fechado nos AD-039/AD-040 e versionamento desde o dia 1.
- [ ] Nenhuma questão real chega a `publicada` sem `fonte_citacao` — a trava é do banco, não do job.
- [ ] Matéria/tópico existem como taxonomia editável, com candidato a tópico novo separado do canônico.
- [ ] `provas` registra o catálogo-alvo (banca/ano/órgão/cargo) e o estado da ingestão.
- [ ] As colunas e índices de busca (`embedding` HNSW, `fts` PT) existem — **preencher é a SPEC 11**.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-09 | enums (`tipo_questao`, `origem`, `status` incl. `precisa_ocr`), `alternativas` jsonb, `imagens` jsonb, `anulada`, `gabarito_versao`, `dificuldade`, `confianca_ia`, coluna+índice de embedding e de fts | §P1: Schema + busca híbrida (AC3) |
| BANCO-13 | `questao_versao`, classificação **cosmética × substantiva** no momento em que a versão nasce (IA-09 AC4 depende dela) | §P1: Cruzamento de gabarito (AC3) |
| BANCO-01 | `fonte_citacao` obrigatória para `origem='real'`; trava de publicação sem proveniência | §P1: Proveniência visível |
| BANCO-02 | tabela `provas` com banca/ano/órgão/cargo + estado; o alvo do AD-009 deixou de ser pré-requisito de lançamento (AD-076), mas o registro continua | §Goals + AD-009 |
| BANCO-05 (parte) | `materias`, `topicos`, `topico_candidato`; reclassificar tópico **não** desloca histórico | §P3: Tela de curadoria (AC1/AC2) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Extração de PDF, imagens no Storage, `precisa_ocr` preenchido | SPEC 08 |
| Cruzamento de gabarito e classificação por IA | SPEC 09 |
| Fila de revisão, amostra de QA, porta de publicação operada | SPEC 10 |
| Geração de embedding e busca híbrida de fato | SPEC 11 |
| Tela de curadoria da taxonomia (BANCO-10) | SPEC 18 |
| Explicações (`explicacoes`) | SPEC 13 |

## Dependências técnicas

Só precisa de banco e configuração. **Não** depende de IA: nenhuma chamada de modelo entra aqui.

## Contratos que esta spec fixa para as próximas

- O snapshot da SPEC 05 lê **desta** tabela: mudar coluna de `questoes` depois é mudar contrato.
- A frequência do Raio-X (SPEC 26) conta `origem='real'` **e** `status='publicada'` — os dois campos
  nascem aqui.
- Versão nova de questão nunca reescreve a anterior (base do AD-042 e do IA-09).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Escala de `dificuldade` | `smallint` 1–5, estimada pela IA; calibra com uso (SPEC 35) | y (AD-040) |
| Piso de `confianca_ia` para rotear revisão | em configuração, conservador no início | n (calibra) |
| Dimensão do embedding | a do Cohere `embed-v4` — confirmar no Design com Context7 antes de fixar a coluna | n |

## Success Criteria

- [ ] Inserir questão real sem `fonte_citacao` e não conseguir publicá-la
- [ ] Criar versão nova de uma questão e ver a anterior intacta
- [ ] Reclassificar o tópico de uma questão e confirmar que a taxonomia mudou sem tocar em nada mais
- [ ] `EXPLAIN` de uma busca por tópico + status usa índice
