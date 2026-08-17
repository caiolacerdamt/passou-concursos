# SPEC 26 — Gamificação: perdão, notificação e limites

| | |
| --- | --- |
| **Ordem** | 26 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 19, SPEC 17 |
| **Tasks (estimativa)** | ~10 |
| **Ritual** | **B — normal** (design como seção do `tasks.md`, autoverificação com evidência) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **GAM-05**, **GAM-09**, **GAM-10**, **GAM-06** |
| **Fonte dos requisitos** | `.specs/modulos/m6-gamificacao/spec.md` |

## Problem Statement

O streak "tudo ou nada" tem defeito fatal: um dia perdido apaga meses e o aluno abandona. O núcleo
da SPEC 19 funciona sem perdão, mas a retenção sofre. E lembrete mal calibrado queima a marca com um
público já ansioso.

## Goals

- [ ] Escudos por constância (teto de 2), gastos **automaticamente**, com aviso claro.
- [ ] Sem escudo, a sequência **congela** e abre janela de recuperação — nunca vai a zero.
- [ ] Folga programada declarada não conta contra a sequência.
- [ ] No máximo 1 lembrete/dia + 1 aviso de sequência, no horário declarado, com tom de treinador.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| GAM-09 | escudos por N dias de agenda cumpridos, teto 2, gasto automático; nunca compráveis nem por anúncio | §P2: Perdão da sequência |
| GAM-10 | congelar + marcar tropeço + janela de recuperação; meta cheia dentro da janela retoma de onde parou; vencer a janela derruba com piso, nunca a zero | §P2: Perdão |
| GAM-05 | compromisso com a agenda declarada + folga programada; consumo de escudo reproduzível de forma determinística no recálculo | §P2: Perdão (AC7) |
| GAM-06 | teto de notificação, horário declarado, horário de silêncio, ligar/desligar por tipo, tom de treinador, **nunca mentir**; fora do app exige consentimento (SPEC 17) | §P2: Notificação leve |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Os quatro sinais em si | SPEC 19 |
| Grupo privado de responsabilidade (GAM-08 P3) | fora do roadmap datado — opt-in, sem placar, quando houver demanda |
| Push nativo | fora do lançamento (AD-077: web responsivo, sem app nativo nem PWA) |

⚠️ Preferência de notificação é dado do **grupo 1**: estender a rotina da SPEC 18 na mesma task.

## Success Criteria

- [ ] Perder um dia com escudo mantém a sequência, com aviso do gasto
- [ ] Perder sem escudo congela e marca tropeço; meta cheia no dia seguinte retoma do mesmo número
- [ ] Janela vencida derruba a sequência sem zerar
- [ ] Horário de estudo às 20h e silêncio às 22h: um lembrete às 20h e nada depois das 22h
