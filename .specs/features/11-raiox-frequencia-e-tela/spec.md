# SPEC 11 — Raio-X: frequência real, peso no plano e tela

| | |
| --- | --- |
| **Ordem** | 11 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 06, SPEC 07, SPEC 10 |
| **Habilita** | SPEC 14, 19, 20, 27, 31, 32 |
| **Tasks (estimativa)** | ~11 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **RAIOX-08**, **RAIOX-01**, **RAIOX-04**, **RAIOX-05**, **RAIOX-11**, **RAIOX-12**, **RAIOX-03** (porteiro do edital), **RAIOX-14** |
| **Fonte dos requisitos** | `.specs/modulos/m5-raiox-banca/spec.md` |
| **Vem de** | SPEC 26 + parte da SPEC 27 do recorte de 42, **com a tela puxada para dentro** (AD-089) |

## Problem Statement

O Raio-X é **a cara do produto e o argumento da oferta** — por isso fica no MVP mesmo com o resto do
M5 adiado (AD-090). E é funcional, não decorativo: o motor do plano (SPEC 06) multiplica "quanto o
assunto cai" pela fraqueza do aluno, e hoje o primeiro fator é uma view stub devolvendo **1.0**.

Com acervo pequeno, taxa crua **mente**: um tópico com 3 aparições pode liderar a lista. Por isso o
amortecimento por amostra entra junto e não depois — sem ele, o Raio-X do lançamento é propaganda
enganosa contra o próprio aluno.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| RAIOX-08 | `perfil_concurso` com órgão, banca (aceitando `indefinida`), programa do edital, `data_prova` (aceitando vazio) e formato; multi-concurso **modelado**, um concurso ativo | §P1: Perfil de concurso |
| RAIOX-01 / RAIOX-04 | taxa por tópico e banca contando **só** `origem='real' and status='publicada'`; taxa é **participação**, não contagem bruta; inédita nunca entra; anulada **conta** | §P1: Frequência real |
| RAIOX-11 | ano recente pesa mais por **decaimento gradual**, fator em configuração; nenhum ano é descartado por corte de janela | §P1: Frequência real (AC3) |
| RAIOX-05 | `n_questoes` e `tendencia ∈ {subindo, estavel, caindo}` por linha | §P1: Frequência real (AC4) |
| RAIOX-12 | amortecimento inversamente proporcional à amostra; rótulo `amostra_baixa` **visível na tela**; tópico do edital com `n_questoes = 0` recebe a média, não zero | §P1: Amortecimento |
| RAIOX-03 (parte) | edital como **porteiro binário**: fora do programa = peso zero | §P1: Três sinais separados |
| RAIOX-14 | job agendado, idempotente, trava de execução única; falha deixa a projeção defasada, não corrompida; **não lê `tentativas`** | §Edge Cases |
| — (superfície) | tela de leitura do Raio-X: tópicos ordenados por peso, com `n_questoes`, tendência e o aviso de pouca amostra | esta spec |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Núcleo × condicional em faixas nomeadas (RAIOX-02/13) | SPEC 20 |
| Empurrão de atualidade com teto (RAIOX-06) e sua curadoria (RAIOX-07) | SPEC 20, 27 |
| Diff do edital e pivot automático (RAIOX-10) | SPEC 27 |
| Ordenar a fila da base de referência (RAIOX-15) | SPEC 20 |
| Fraqueza do aluno, domínio, caderno | SPEC 06 — o Raio-X **não lê `tentativas`** |
| Módulo de formato A–E × Certo/Errado | SPEC 32 |

---

## User Stories

- **P1 — Frequência real:** o aluno vê quanto cada tópico aparece nas provas reais, sem que questões inéditas alterem a medida.
- **P1 — Peso honesto:** o plano usa a frequência amortecida, com pouca amostra explicitamente identificada.
- **P1 — Porteiro do edital:** tópicos fora do programa não entram no plano; os tópicos do edital continuam visíveis mesmo sem questões publicadas.
- **P1 — Perfil e leitura:** o sistema mantém perfis de concurso, recalcula a projeção por job e exibe a lista ordenada na área logada.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RAIOX-01 | P1: Frequência real | Design | Pending |
| RAIOX-03 | P1: Porteiro do edital | Design | Pending |
| RAIOX-04 | P1: Frequência real | Design | Pending |
| RAIOX-05 | P1: Frequência real | Design | Pending |
| RAIOX-08 | P1: Perfil e leitura | Design | Pending |
| RAIOX-11 | P1: Frequência real | Design | Pending |
| RAIOX-12 | P1: Peso honesto | Design | Pending |
| RAIOX-14 | P1: Perfil e leitura | Design | Pending |

**Coverage:** 8 total, 0 mapped to tasks, 8 pending.

## Contratos que esta spec fixa para as próximas

- A view **`raiox_peso_topico`** passa a devolver o peso real **mantendo a assinatura** da SPEC 06 —
  o plano do dia muda de comportamento sem uma linha alterada no motor. É o teste que prova o contrato.
- Questão com **versão nova** conta uma vez só; duplicata confirmada conta a canônica.
- `data_prova` vazio é estado normal — a SPEC 19 troca o modo do sinal "no prazo" sozinha quando ele
  passar a existir.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Meia-vida do decaimento | configuração, início conservador (~5 anos) | n (calibra) |
| Constante `k` do amortecimento e piso de `n_questoes` | configuração | n (calibra) |
| Bancas na coluna | Cesgranrio, FGV, Cebraspe; coluna nova é linha de config | y (AD-009) |
| Acervo pequeno no lançamento | **a maioria das linhas sai com `amostra_baixa=true` e isso é dito na tela**, não escondido | y (AD-090) |
| Acervo vazio | devolve as linhas do edital com nota amortecida, nunca lista vazia | y (edge case) |
| Formato de `programa_edital` no MVP | array JSON de UUIDs dos tópicos canônicos; citações e redação entram no pivot do edital | mantém a fronteira da SPEC 27 sem bloquear o primeiro Raio-X | y (AD-100) |
| Banca `indefinida` | combina as bancas de `param.m5.bancas`, sem classificar núcleo/condicional | entrega leitura antes da banca sem antecipar RAIOX-02/13 | y (AD-100) |
| Perfil sem `ativo` | a tela fica sem perfil e a view preserva o fallback `1.0` do M4 | configuração do edital não pode quebrar o plano existente | y (AD-100) |
| Flag da tela | `flag.m5.raiox` nasce desligada | AD-076 constrói a superfície antes de ligá-la no lançamento | y (AD-076/100) |

**Open questions:** none — defaults de calibração ficam no catálogo de configuração.

## Success Criteria

- [ ] Publicar 50 inéditas de um tópico **não** muda a taxa dele
- [ ] Uma prova real recente move a taxa mais do que uma de 10 anos atrás
- [ ] Tópico com 3 questões e taxa bruta altíssima **não** lidera a lista, e a tela mostra "pouca amostra"
- [ ] Tópico fora do programa do edital fica com peso zero
- [ ] Rerodar o job produz exatamente o mesmo resultado
- [ ] Trocar a view stub pelo peso real reordena o plano do dia seguinte **sem alterar o motor**
- [ ] A tela abre com acervo fino sem mentir: toda linha amortecida aparece rotulada
