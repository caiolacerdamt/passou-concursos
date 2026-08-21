# SPEC 10 — Publicação do acervo e explicações do lote

| | |
| --- | --- |
| **Ordem** | 10 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 09 |
| **Habilita** | SPEC 11, 13, 15, 21, 22, 23, 24, 30, 31, 35 |
| **Tasks (estimativa)** | ~11 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Status** | ✅ Concluída |
| **Requisitos** | **BANCO-07**, **BANCO-01** (execução da trava), **IA-04**, **IA-08**, **IA-05**, **IA-01** (execução) |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` · `.specs/modulos/m2-camada-ia/spec.md` |
| **Vem de** | SPEC 10 + SPEC 13 do recorte de 42, **fundidas e enxugadas** (AD-089) |

## Problem Statement

Sem explicação conferida, o banco de questões é só uma lista — e é o ponto de maior risco do
produto. A IA nunca decide a alternativa correta (isso é o gabarito), mas escreve o **porquê**. A
defesa é grounding em documento entregue no mesmo pedido + citação conferida **por código**.

QA e explicação viram uma spec só porque compartilham a mesma peça: **a fila de revisão humana**.
Publicar e explicar são as duas portas que a alimentam.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-07 | piso de `confianca_ia` em config; amostra de auditoria sobre real de alta confiança; `questao_revisoes`; **uma** fila de revisão com prioridade e motivo | m1 §P1: QA misto por fonte |
| BANCO-01 | a trava efetiva: questão real sem `fonte_citacao` **não** publica | m1 §P1: Proveniência |
| IA-04 | tabela `explicacoes`; documento de referência entregue no mesmo pedido; citações em saída estruturada; **conferência por código** de que cada trecho existe literalmente (comparação normalizada); `fontes_citadas`; rejeição vai para a fila (AD-075) | m2 §P1: Explicação conferida |
| IA-08 | fonte mínima quando não há documento (prova + gabarito) e **veto a citar norma, prazo ou percentual externo** | m2 §P1: Explicação conferida (AC4) |
| IA-05 | `base_referencia` por tópico com `origem` (oficial × resumo nosso) e `status`; oficial preferido; resumo só se conferido por humano | m2 §P2: Base de referência |
| IA-01 | geração na fábrica, 1× por `(questao_id, questao_versao)`, nunca no pedido do aluno | m2 §P1: Pré-computa primeiro |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| A tela onde o operador revisa a fila | SPEC 15 — no MVP a fila é operada pelo Supabase Studio |
| Exibir a explicação na tela do aluno | SPEC 13 |
| Invalidação automática por versão nova e feedback que regera (IA-09/IA-07) | SPEC 21 — aqui `explicacoes` já nasce com `status`, que a tela lê |
| Verificação da conta em questão quantitativa (IA-06/IA-15) | SPEC 22 — **no lote inicial, quantitativa vai para a fila humana** |
| Recorte de documento grande por busca híbrida | SPEC 23 — ver Assumptions |
| Ordenar a fila da base por frequência real | SPEC 20 |
| Questão suspeita por estatística | SPEC 29 |
| Áudio da explicação | SPEC 35 |

## Contratos que esta spec fixa para as próximas

- **A fila de revisão é uma só.** SPEC 13 (report do aluno), 22 (conta que não fecha), 29 (questão
  suspeita) enfileiram aqui, com motivo distinto.
- `explicacoes` referencia `questao_id` **e** `questao_versao`, com versão própria e `status` — é o
  que torna a SPEC 21 possível sem migração.
- O tutor (SPEC 24) injeta **explicação e fontes já aprovadas**; nunca faz busca própria.
- Publicação é irreversível para o histórico: tentativa antiga continua apontando para a versão que
  respondeu.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Documento maior que a janela de contexto | **no MVP não acontece**: a base do primeiro lote é curada por tópico, em documentos pequenos, enviados inteiros. Quando não couber, é a SPEC 23 | y (AD-090) |
| Questão de conta no lote inicial | roteada para revisão humana; a verificação por catálogo de fórmulas é a SPEC 22 | y (AD-090) |
| Explicação personalizada por aluno | **não existe** — contraria o pré-computa (AD-010) | y |
| Piso de `confianca_ia` e taxa de amostra | em configuração, conservadores no início | n (calibra) |
| Ator | papel único **operador de conteúdo** | y |

## Success Criteria

- [x] Baixar a `confianca_ia` de uma questão real abaixo do piso a manda para revisão
- [x] Real sem proveniência não publica
- [x] Explicação de tópico com documento grava as citações conferidas
- [x] Citação que não bate literalmente com a fonte é rejeitada e vai à fila
- [x] Explicação que contradiz o gabarito é rejeitada
- [x] Explicação de tópico sem documento não cita nenhuma norma externa
- [x] Duas execuções da fábrica sobre a mesma questão gravam **uma** explicação
- [x] Desligar a chave de API não impede responder questão, ver plano e projeções
- [x] Decisão de revisão fica registrada com quem e quando
