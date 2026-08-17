# SPEC 24 — Onboarding, diagnóstico e plano do dia na tela

| | |
| --- | --- |
| **Ordem** | 24 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 06, SPEC 07, SPEC 19, SPEC 22 |
| **Habilita** | SPEC 25, 28 |
| **Tasks (estimativa)** | ~11 |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-14**, **ALUNO-05** (AC2, AC3, AC4 — as duas lacunas declaradas na rodada 1), **ALUNO-08** (superfície), **ALUNO-11** (superfície) |
| **Fonte dos requisitos** | `.specs/modulos/m8-negocio-pagamentos/spec.md` · `.specs/modulos/m4-coluna-vertebral/spec.md` |

## Problem Statement

É a ativação: pagar e não saber o que fazer é reembolso na certa. O aluno precisa declarar a meta,
poder **pular** o diagnóstico e ainda assim receber o plano do 1º dia na mesma sessão. Esta spec
também fecha as **duas lacunas** que a rodada 1 do M4 declarou sem componente: o diagnóstico
adaptativo (ALUNO-05 AC2) e a chamada de IA do plano inicial (AC3) — as duas dependiam de acervo, que
agora existe.

## Goals

- [ ] Onboarding: concurso alvo, tempo por dia, agenda declarada e nível — o diagnóstico é sempre pulável.
- [ ] Diagnóstico de ~20 questões reais adaptativas, **atrás de `flag.m4.diagnostico_adaptativo`** (desligada no lançamento, AD-076) e construído mesmo assim.
- [ ] Uma chamada de IA escreve o plano inicial; se falhar, o plano sai pela regra/SQL do mesmo jeito.
- [ ] Tela do plano do dia mostrando os blocos, o `piso` e a `meta_cheia`, com o porquê de cada bloco.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| PAG-14 | encadeamento pagamento → primeiro login → onboarding → plano do 1º dia, na mesma sessão | m8 §P1: Entrar e chegar ao plano |
| ALUNO-05 AC2 | seleção das ~20 questões + passo adaptativo (acertou sobe, errou desce); grava `contexto='diagnostico'` sem pedir causa | m4 §P1: Diagnóstico curto |
| ALUNO-05 AC3 | tarefa própria do gateway "plano inicial pós-diagnóstico" — **distinta** da frase diária (SPEC 07), síncrona, com cache | m4 §P1: Diagnóstico (AC3) + m2 IA-02 (AC2) |
| ALUNO-05 AC4 | falha da IA entrega o plano por regra/SQL, sem frase | m4 §P1: Diagnóstico (AC4) |
| ALUNO-08 / ALUNO-11 (superfície) | tela dos blocos Revisar/Avançar/Treinar, motivo visível, dois níveis | m4 §P1: Plano diário |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Motor de prioridade e geração do plano | SPEC 06 |
| Anel do dia, sequência, "no prazo" | SPEC 28 |
| Caderno de erros e histórico | SPEC 25 |
| Lembrete e horário declarado (notificação) | SPEC 33 (a **declaração** do horário e da agenda entra aqui) |

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Tamanho do diagnóstico | `param.m4.diagnostico_n_questoes` = 20 | n (calibra) |
| Passo do adaptativo | regra simples (sobe/desce dificuldade estimada), não IRT | y (regra) / n (números) |
| Acervo frio no diagnóstico | tópico sem questão publicada é pulado | y (edge case) |

## Success Criteria

- [ ] Pagar, definir senha, **pular** o diagnóstico declarando "iniciante" e ver o plano do 1º dia na mesma sessão
- [ ] Fazer o diagnóstico gera ~20 tentativas com `contexto='diagnostico'` e nenhuma pergunta de causa
- [ ] Derrubar a IA não impede o plano de aparecer
- [ ] A tela mostra `piso` e `meta_cheia` como coisas distintas
