# SPEC 26 — Raio-X: perfil de concurso e frequência real

| | |
| --- | --- |
| **Ordem** | 26 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 04, SPEC 10 |
| **Habilita** | SPEC 27, 28 (o sinal "no prazo" lê `data_prova`), 34, 37, 38 |
| **Tasks (estimativa)** | ~11 |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **RAIOX-08**, **RAIOX-01**, **RAIOX-04**, **RAIOX-05**, **RAIOX-11**, **RAIOX-14** |
| **Fonte dos requisitos** | `.specs/modulos/m5-raiox-banca/spec.md` |

## Problem Statement

O motor do plano (SPEC 06) multiplica "quanto o assunto cai" pela fraqueza do aluno — e hoje o
primeiro fator é uma view stub devolvendo **1.0**. O AD-076 exige a conta do Raio-X ligada desde o
dia 1, então esta spec é **pré-lançamento**, não sexta na fila. E a banca do BB ainda não foi
definida: o Raio-X precisa responder útil antes de saber quem faz a prova.

## Goals

- [ ] `perfil_concurso` com órgão, banca (aceitando `indefinida`), programa do edital, `data_prova` (aceitando vazio) e formato.
- [ ] Taxa por tópico e por banca contando **só** `origem='real'` e `status='publicada'`.
- [ ] Taxa é **participação**, não contagem bruta — mais provas de uma banca não distorce a comparação.
- [ ] Ano recente pesa mais por **decaimento gradual**; nenhum ano é descartado por corte de janela.
- [ ] Cada linha guarda `n_questoes` e `tendencia ∈ {subindo, estavel, caindo}`.
- [ ] Projeção recalculável do zero por job, idempotente, que **não lê `tentativas`**.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| RAIOX-08 | `perfil_concurso`, multi-concurso no mesmo banco de assuntos, sem duplicar questão nem taxonomia | §P1: Perfil de concurso |
| RAIOX-01 / RAIOX-04 | taxa só de prova real, como participação; inédita nunca entra; anulada **conta** na frequência | §P1: Frequência real |
| RAIOX-11 | decaimento gradual por ano, fator em configuração | §P1: Frequência real (AC3) |
| RAIOX-05 | `n_questoes` e `tendencia` por linha | §P1: Frequência real (AC4) |
| RAIOX-14 | job agendado, idempotente, com trava de execução única; falha deixa a projeção defasada, não corrompida | §Out of Scope + §Edge Cases |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Amortecimento por amostra pequena, núcleo × condicional, porteiro do edital, empurrão | SPEC 27 |
| Integração com o motor do plano (substituir a view stub) | SPEC 27 |
| Curadoria de atualidade, tela do Raio-X, pivot do edital | SPEC 34 |
| Fraqueza do aluno, domínio, caderno | SPEC 06 — o Raio-X **não lê `tentativas`** |

## Contratos que esta spec fixa para as próximas

- Questão com **versão nova** conta uma vez só; **duplicata** confirmada conta a canônica, uma vez
  por prova em que apareceu.
- `data_prova` vazio é estado normal — a SPEC 28 troca o modo do sinal "no prazo" sozinha quando ele
  passar a existir.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Meia-vida do decaimento | configuração, início conservador (~5 anos) | n (calibra) |
| Bancas na coluna | Cesgranrio, FGV, Cebraspe; coluna nova é linha de config | y (AD-009) |
| Anulada na frequência | **conta** (a banca cobrou o assunto) | n (default registrado) |
| Acervo vazio | devolve todas as linhas do edital com nota amortecida, nunca lista vazia | y (edge case) |

## Success Criteria

- [ ] Publicar 50 inéditas de um tópico **não** muda a taxa dele
- [ ] Uma prova real recente move a taxa mais do que uma de 10 anos atrás
- [ ] Rerodar o job produz exatamente o mesmo resultado
- [ ] Trocar a banca do perfil não exige migração de dado nem reconstrução do esqueleto de assuntos
