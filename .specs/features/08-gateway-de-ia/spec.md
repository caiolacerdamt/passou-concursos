# SPEC 08 — Gateway de IA

| | |
| --- | --- |
| **Ordem** | 08 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 02, SPEC 03, SPEC 06 |
| **Habilita** | SPEC 09, 10, 13, 22, 24, 30, 31, 35 |
| **Tasks (estimativa)** | ~9 |
| **Ritual** | **B — normal** |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **IA-02**, **IA-16**, **IA-14**, **IA-13** (mecanismo), **IA-12**, **IA-01** (parte), **INFRA-02**, **ALUNO-12** |
| **Fonte dos requisitos** | `.specs/modulos/m2-camada-ia/spec.md` · `.specs/modulos/m4-coluna-vertebral/spec.md` (ALUNO-12) |
| **Vem de** | SPEC 07 do recorte de 42 (AD-089) |

## Problem Statement

Toda chamada de IA do produto — extração, explicação, classificação, tutor, frase do plano —
resolve modelo, esforço, batch, cache e fallback **por configuração**. Construir qualquer pipeline
antes do gateway é espalhar nome de modelo pelo código, que é proibição do `AGENTS.md`. Esta spec
entrega o gateway **e a primeira tarefa real que passa por ele**, para nascer provado.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| IA-02 | o gateway; lista fechada de tarefas; matriz em configuração; fallback com registro; parada visível quando o fallback também falha | m2 §P1: Gateway de modelos |
| IA-16 | SDK nativo da OpenAI (Responses API), adapter único; OpenRouter fora da produção | m2 §P1: Gateway (AC3) |
| IA-14 | chave de dedup (`questao_id` + `questao_versao` + tarefa + versão do prompt) e registro de versões | m2 §Assumptions + AC8 |
| IA-13 | o **mecanismo** de refazer exatamente 1× escalando modelo e esforço (quem o usa é a SPEC 22) | m2 §P1: Verificação (AC5) |
| IA-12 | acompanhamento de gasto + alerta uma vez por período; **não desliga nada sozinho** | m2 §P1: Tutor (AC6) |
| IA-01 (parte) | `batch: sim/não` é campo da matriz por tarefa; síncrono e Batch atendidos pelo mesmo gateway | m2 §P1: Pré-computa (AC1/AC5) |
| INFRA-02 | o padrão "script standalone disparado por GitHub Actions"; nunca função da Vercel | m9 §P1: Cada carga no seu lar |
| ALUNO-12 | `scripts/jobs/frase-do-plano.ts` + workflow às 07:00 UTC; síncrona (AD-080); falha de um aluno deixa `frase = null` e não derruba os outros | m4 §P1: Plano diário (AC1) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Extração de PDF (IA-17, fatiamento) | SPEC 09 |
| Explicação, grounding e citação (IA-04/IA-08) | SPEC 10 |
| Verificação quantitativa (IA-06/IA-15) | SPEC 22 — aqui só o mecanismo genérico de refazer 1× |
| Eval cego como porteiro (IA-03) e revisão da matriz (IA-11) | SPEC 30 |
| Tutor (IA-10) e streaming (INFRA-05) | SPEC 24 |
| Embeddings | **nunca passam pelo gateway** — chamada direta ao Cohere (SPEC 23, AD-005) |

## Contratos que esta spec fixa para as próximas

- **Nenhuma chamada de IA fora do gateway.** Spec que precisar de tarefa nova acrescenta linha na
  matriz de configuração, não um cliente novo.
- Duas chamadas ainda **não** estão na lista fechada do IA-02 e exigem decisão registrada antes de
  serem construídas: pré-diagnóstico de questão suspeita (SPEC 29) e extração do programa do edital
  (SPEC 27).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Matriz de modelos | `gpt-5.6-luna` nas tarefas, `gpt-5.6-terra` no refaz 1× (AD-073) | y (tabela) / n (nomes vivem só em config) |
| Esforço por tarefa | `high` na fábrica, `max` no refaz, `medium` no tutor | y |
| Custo da fábrica | ordem de US$15–30 para ~10 mil questões | n (estimativa) |

**Pendência externa:** `OPENAI_API_KEY` provisionada.

## Success Criteria

- [ ] Trocar o modelo de uma tarefa na configuração muda o comportamento sem alteração de código
- [ ] Mudar o esforço de **uma** tarefa não afeta as demais
- [ ] Derrubar o principal faz o fallback assumir, com registro
- [ ] Rerodar o job da frase não regera frase já escrita nem cobra de novo
- [ ] IA fora do ar: o plano continua saindo, sem frase
- [ ] Nenhum teste automatizado cita nome de modelo
