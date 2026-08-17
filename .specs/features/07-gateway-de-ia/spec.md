# SPEC 07 — Gateway de IA

| | |
| --- | --- |
| **Ordem** | 07 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 02, SPEC 03, SPEC 06 |
| **Habilita** | SPEC 08, 09, 12, 13, 24, 29, 36, 37, 39 |
| **Tasks (estimativa)** | ~11 |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **IA-02**, **IA-16**, **IA-14**, **IA-13** (mecanismo), **IA-12**, **IA-01** (parte: batch/síncrono), **INFRA-02**, **ALUNO-12** |
| **Fonte dos requisitos** | `.specs/modulos/m2-camada-ia/spec.md` · `.specs/modulos/m4-coluna-vertebral/spec.md` (ALUNO-12) |

## Problem Statement

Toda chamada de IA do produto — extração, explicação, verificação, classificação, tutor, frase do
plano — precisa resolver modelo, esforço, batch, cache e fallback **por configuração**. Construir
qualquer pipeline antes do gateway é espalhar nome de modelo pelo código, que é proibição do
`AGENTS.md`. Esta spec entrega o gateway **e a primeira tarefa real que passa por ele**, para que ele
nasça provado e não vire abstração sem consumidor.

## Goals

- [ ] `tarefa → (modelo, versão fixada, esforço, batch, cache, fallback, parâmetros)` sai da configuração.
- [ ] Nenhum trecho de código e **nenhum teste** depende de nome de modelo nem de nível de esforço.
- [ ] Toda geração grava modelo, versão, esforço e versão do prompt.
- [ ] Chave de dedup: rerodar um job não regera nem cobre de novo.
- [ ] Gasto mensal de IA é acompanhado e **alerta** — sem desligar nada sozinho.
- [ ] O plano do dia ganha a frase de abertura, e falhar nisso não derruba o plano.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| IA-02 | o gateway em si; a lista fechada de tarefas; matriz em configuração; fallback com registro; parada visível quando o fallback também falha | m2 §P1: Gateway de modelos |
| IA-16 | **SDK nativo da OpenAI** (Responses API), adapter único; OpenRouter fica fora da produção | m2 §P1: Gateway (AC3) |
| IA-14 | chave de dedup (`questao_id` + `questao_versao` + tarefa + versão do prompt) e o registro de versões | m2 §Assumptions + AC8 |
| IA-13 | o **mecanismo** de refazer exatamente 1× escalando modelo e esforço (quem o usa é a SPEC 12) | m2 §P1: Verificação (AC5) |
| IA-12 | acompanhamento de gasto + alerta uma vez por período | m2 §P1: Tutor (AC6) |
| IA-01 (parte) | tarefa marcada `batch: não` usa chamada síncrona; as demais vão para Batch com prompt caching | m2 §P1: Pré-computa (AC1/AC5) |
| INFRA-02 | o padrão "script standalone disparado por GitHub Actions"; nunca função da Vercel | m9 §P1: Cada carga no seu lar |
| ALUNO-12 | `scripts/jobs/frase-do-plano.ts` + workflow às 07:00 UTC; **síncrona, não Batch** (AD-080); falha de um aluno deixa `frase = null` e não derruba os outros | m4 §P1: Plano diário (AC1) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Extração de PDF (IA-17, fatiamento) | SPEC 08 |
| Verificação quantitativa (IA-06/IA-15) | SPEC 12 |
| Explicação, grounding e citação (IA-04/IA-08) | SPEC 13 |
| Eval cego como porteiro de modelo (IA-03) e revisão periódica da matriz (IA-11) | SPEC 36 |
| Tutor (IA-10) e streaming (INFRA-05) | SPEC 29 |
| Embeddings | **nunca passam pelo gateway** — chamada direta ao Cohere (SPEC 11, AD-005) |

## Contratos que esta spec fixa para as próximas

- **Nenhuma chamada de IA fora do gateway.** Spec que precisar de tarefa nova acrescenta a linha na
  matriz de configuração, não um cliente novo.
- Duas chamadas ainda **não** estão na lista fechada do IA-02 e precisam de decisão registrada antes
  de serem construídas: pré-diagnóstico de questão suspeita (SPEC 35) e extração do programa do
  edital (SPEC 34).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Matriz de modelos | `gpt-5.6-luna` em todas as tarefas, `gpt-5.6-terra` no refaz 1× (AD-073) | y (tabela) / n (nomes envelhecem — vivem só em config) |
| Esforço por tarefa | `high` na fábrica, `max` na verificação e no refaz, `medium` no tutor | y |
| Custo da fábrica | ordem de US$15–30 para ~10 mil questões | n (estimativa) |

**Pendência externa:** `OPENAI_API_KEY` provisionada.

## Success Criteria

- [ ] Trocar o modelo de uma tarefa na configuração muda o comportamento sem alteração de código
- [ ] Mudar o esforço de **uma** tarefa não afeta as demais
- [ ] Derrubar o principal faz o fallback assumir, com registro
- [ ] Rerodar o job da frase não regera frase já escrita nem cobra de novo
- [ ] IA fora do ar: o plano continua saindo, sem frase
