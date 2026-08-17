# SPEC 20 — Raio-X: amortecimento, núcleo × condicional e integração com o plano

| | |
| --- | --- |
| **Ordem** | 20 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 06, SPEC 11 |
| **Habilita** | SPEC 27, 32; e reordena a fila da base de referência da SPEC 10 |
| **Tasks (estimativa)** | ~10 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **RAIOX-12**, **RAIOX-02**, **RAIOX-03**, **RAIOX-06**, **RAIOX-13**, **RAIOX-15** |
| **Fonte dos requisitos** | `.specs/modulos/m5-raiox-banca/spec.md` |

## Problem Statement

Taxa crua manda o aluno estudar coincidência estatística: um tópico com 3 aparições em 10 anos pode
liderar a lista. E com a banca indefinida, um número único esconderia a incerteza. Esta spec fecha a
política dos três sinais e **substitui a view stub** `raiox_peso_topico` — o momento em que o plano
diário passa a apontar para a prova de verdade.

## Goals

- [ ] Amostra pequena puxa a taxa para a média da banca, com rótulo `amostra_baixa` visível.
- [ ] Com banca indefinida, cada tópico sai como `nucleo` ou `condicional` em duas faixas nomeadas.
- [ ] Edital é **porteiro binário** (fora do programa = zero); frequência é o motor; atualidade é empurrão com teto.
- [ ] A view `raiox_peso_topico` passa a devolver o peso real, **mantendo a assinatura** — sem tocar no motor.
- [ ] A fila da base de referência (SPEC 10) sai ordenada por frequência real amortecida.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| RAIOX-12 | amortecimento inversamente proporcional à amostra, `amostra_baixa`, tópico do edital com `n_questoes = 0` recebe a média (não zero) | §P1: Amortecimento |
| RAIOX-02 / RAIOX-13 | forte = acima do corte **de posição dentro da própria banca**; forte nas 3 = `nucleo`, em 1–2 = `condicional`; banca definida usa a coluna dela | §P1: Visão combinada |
| RAIOX-03 / RAIOX-06 | porteiro binário do edital, motor da frequência, empurrão com teto por posição, faixa especial exigindo **as duas** condições (recém-incluído **e** sinalizado), sinais visíveis separadamente | §P1: Três sinais separados |
| RAIOX-15 | ordenação exposta para a fila da base de referência do M2 | §P2: Fila da base de referência |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Registro e curadoria do empurrão de atualidade, validade, tela | SPEC 27 (aqui entra o **teto** e como o empurrão entra na conta) |
| Diff do edital | SPEC 27 |
| Módulo de formato A–E × Certo/Errado | SPEC 32 |

## Contratos que esta spec fixa para as próximas

- Depois desta spec, **o plano do dia muda de comportamento** sem nenhuma alteração no motor — é o
  teste que prova que o contrato da view foi respeitado.
- O teto do empurrão **não é contornável pela tela** (SPEC 27).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Percentil de corte núcleo/condicional | configuração, início no terço superior de cada banca | n (calibra) |
| Percentil-teto do empurrão | configuração, início: não entra no decil superior | n (calibra) |
| Constante `k` do amortecimento e piso de `n_questoes` | configuração | n (calibra) |

## Success Criteria

- [ ] Tópico com 3 questões e taxa bruta altíssima **não** aparece entre os prioritários, e a tela mostra "pouca amostra"
- [ ] Tópico forte nas 3 bancas sai como núcleo; forte só numa sai como condicional; definir a banca sobe o segundo
- [ ] Tópico fora do edital permanece zero mesmo com empurrão aplicado
- [ ] Trocar a view stub pelo peso real reordena o plano do dia seguinte sem alterar o motor
