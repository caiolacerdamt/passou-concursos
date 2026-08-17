# SPEC 13 — Onboarding, plano na tela e sessão de questões

| | |
| --- | --- |
| **Ordem** | 13 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** · **é o loop central** |
| **Depende de** | SPEC 06, SPEC 07, SPEC 10, SPEC 12 |
| **Habilita** | SPEC 14, 19, 21, 24, 32 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **B — normal** |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-14**, **ALUNO-08** (superfície), **ALUNO-11** (superfície), **ALUNO-03** (superfície), **ALUNO-01** (superfície), **BANCO-01** (AC2), **IA-04** (superfície), **IA-09** (AC5) |
| **Fonte dos requisitos** | `.specs/modulos/m4-coluna-vertebral/spec.md` · `.specs/modulos/m8-negocio-pagamentos/spec.md` · `.specs/modulos/m2-camada-ia/spec.md` · `.specs/modulos/m1-banco-questoes/spec.md` |
| **Vem de** | SPEC 22 + SPEC 23 + parte da SPEC 24 do recorte de 42, **fundidas** (AD-089) |

## Problem Statement

Toda a máquina das SPECs 04–12 só vira produto aqui. É a ativação e o loop no mesmo lugar: pagar e
não saber o que fazer é reembolso na certa, e responder sem entender por que errou é a lista de
questões que o produto promete não ser.

Onboarding, plano e sessão viram uma spec só porque são **uma sessão contínua do aluno**: ele paga,
define a senha, diz a meta e cai no primeiro bloco sem sair da tela.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| PAG-14 | encadeamento pagamento → primeiro login → onboarding → plano do 1º dia, na mesma sessão | m8 §P1: Entrar e chegar ao plano |
| ALUNO-05 (AC1, superfície) | onboarding: concurso alvo, minutos por dia, agenda declarada e **nível declarado** — o caminho de quem não faz diagnóstico | m4 §P1: Diagnóstico curto |
| ALUNO-08 / ALUNO-11 (superfície) | tela do plano do dia: blocos Revisar / Avançar / Treinar, **motivo visível** de cada bloco, `piso` e `meta_cheia` como coisas distintas | m4 §P1: Plano diário |
| ALUNO-01 (superfície) | a sessão chama `registrarTentativa`; `tempo_ms`, `marcou_chute`, contexto correto por bloco; duplo-clique não cria duas | m4 §P1: Log imutável |
| ALUNO-03 (superfície) | causa do erro **obrigatória antes de avançar** no treino: 6 causas + "não sei dizer" | m4 §P1: Causa do erro |
| BANCO-01 (AC2) | proveniência (banca/ano/órgão/cargo) visível junto do enunciado; questão com imagem servida com a imagem; anulada não vira treino | m1 §P1: Proveniência visível |
| IA-04 (superfície) | explicação servida do banco por `(questao_id, questao_versao)`, com `fontes_citadas` visíveis | m2 §P1: Explicação conferida (AC7) |
| IA-09 (AC5) | questão sem explicação válida aparece com aviso de **"em revisão"** — nunca com a explicação antiga | m2 §P1: Explicação amarrada à versão |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| **Diagnóstico adaptativo de ~20 questões** (ALUNO-05 AC2) e **a chamada de IA do plano inicial** (AC3/AC4) | SPEC 32 — o diagnóstico é pulável por invariante (nº5) e o plano diário já ganha frase de IA na SPEC 08 |
| **"Foi útil?" e "reportar erro"** (IA-07 superfície) | SPEC 21 — o produto lança sem os botões de feedback |
| Caderno de erros, histórico, sequência | SPEC 14 |
| Anel do dia, "no prazo", progresso desde o ponto de partida | SPEC 19 (nascem atrás de flag por AD-076) |
| Motor de prioridade e geração do plano | SPEC 06 |
| Tutor de dúvidas | SPEC 24 |
| Simulado | SPEC 32 |
| Lembrete e notificação | SPEC 26 — a **declaração** do horário e da agenda entra aqui |

## Contratos que esta spec fixa para as próximas

- O anel da SPEC 19 conta **bloco concluído**, e bloco com erro só fecha depois de a causa de cada
  erro ter sido declarada (AD-060) — a tela já deixa esse estado explícito.
- Sair no meio da sessão não desfaz nada: o item fica com `respondido_em` nulo.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Tamanho de bloco | derivado de `minutos_por_dia` × `param.m4.minutos_por_questao` | n (calibra) |
| Questão sem explicação válida | mostra a questão com aviso de "em revisão" **ou** retira de circulação, conforme configuração | y (IA-09 AC5) |
| Repetição de questão | `param.m4.dias_sem_repetir_questao` evita a mesma questão recente | y |
| Acervo fino no bloco | tópico sem questão publicada é pulado, sem bloco vazio na tela | y (edge case) |

## Success Criteria

- [ ] Pagar, definir senha, declarar "iniciante" e ver o plano do 1º dia **na mesma sessão**
- [ ] A tela do plano mostra `piso` e `meta_cheia` como coisas distintas, com o motivo de cada bloco
- [ ] Errar no treino e não conseguir avançar sem marcar a causa; "não sei dizer" é aceito
- [ ] Duplo-clique gera **uma** tentativa
- [ ] Sair no meio e voltar não perde nem duplica resposta
- [ ] A fonte da questão real aparece na tela
- [ ] Bloco com questão anulada fecha sem ela
- [ ] A explicação exibida é a da versão que o aluno respondeu, com as fontes
- [ ] Explicação inválida faz a tela mostrar o aviso, nunca o texto antigo
