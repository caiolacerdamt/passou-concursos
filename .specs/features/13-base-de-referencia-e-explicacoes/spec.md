# SPEC 13 — Base de referência e fábrica de explicações

| | |
| --- | --- |
| **Ordem** | 13 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 11, SPEC 12 |
| **Habilita** | SPEC 14, 23, 29 (o tutor injeta a explicação aprovada), 39 |
| **Tasks (estimativa)** | ~11 |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **IA-04**, **IA-08**, **IA-05**, **IA-01** (execução) |
| **Fonte dos requisitos** | `.specs/modulos/m2-camada-ia/spec.md` |

## Problem Statement

É o produto: sem explicação conferida, o banco de questões é só uma lista. E é o ponto de maior
risco — a IA nunca decide a alternativa correta (isso é o gabarito), mas ela escreve o **porquê**. A
defesa é grounding em documento entregue no mesmo pedido + citação conferida **por código** antes de
aceitar.

## Goals

- [ ] Explicação gerada **1× por (questão, versão)** e servida do banco para todos.
- [ ] Todo fato afirmado está no material entregue; citação é conferida literalmente contra ele.
- [ ] Tópico sem documento publica com fonte mínima (prova + gabarito) e proibição de citar norma externa.
- [ ] Explicação que contradiz o gabarito é rejeitada e vai à fila humana.
- [ ] Com a API de IA fora do ar, o núcleo do produto continua inteiro.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| IA-04 | tabela `explicacoes`; documento de referência entregue no mesmo pedido; citações em saída estruturada; **conferência por código** de que cada trecho existe literalmente (comparação normalizada); `fontes_citadas`; rejeição para a fila (AD-075) | §P1: Explicação conferida |
| IA-08 | fonte mínima quando não há documento; veto a norma/prazo/percentual externo; tópico entra na fila da base por frequência | §P1: Explicação conferida (AC4) |
| IA-05 | `base_referencia` por tópico com `origem` (oficial × resumo nosso) e `status`; oficial preferido; resumo só se conferido por humano | §P2: Base de referência |
| IA-01 | geração na fábrica (Batch + prompt caching), nunca no pedido do aluno | §P1: Pré-computa primeiro |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Invalidação por versão nova da questão (IA-09) e feedback do aluno (IA-07) | SPEC 14 |
| Exibir a explicação na tela | SPEC 23 |
| Tutor | SPEC 29 |
| Áudio da explicação | SPEC 39 |
| Ordenar a fila da base por frequência real | SPEC 27 (a ordenação existe; a fonte do número é o Raio-X) |
| Construção física dos documentos da base | esteira de curadoria humana — não é código |

## Contratos que esta spec fixa para as próximas

- `explicacoes` referencia `questao_id` **e** `questao_versao`, com versão própria e `status` — é o
  que torna a SPEC 14 possível.
- O tutor (SPEC 29) injeta **explicação e fontes já aprovadas**; nunca faz busca própria.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Documento maior que a janela de contexto | envia só os trechos relevantes (busca híbrida da SPEC 11) e registra quais foram enviados | y (edge case) |
| Explicação personalizada por aluno | **não existe** — contraria o pré-computa (AD-010) | y |
| Nota mínima do eval | a definir; o eval como porteiro é a SPEC 36 | n |

## Success Criteria

- [ ] Explicação de tópico com documento grava as citações conferidas
- [ ] Explicação de tópico sem documento não cita nenhuma norma externa
- [ ] Citação que não bate literalmente com a fonte é rejeitada e vai à fila
- [ ] Explicação que contradiz o gabarito é rejeitada
- [ ] Desligar a chave de API não impede responder questão, ver plano e projeções
- [ ] Duas execuções da fábrica sobre a mesma questão gravam **uma** explicação
