# SPEC 15 — Painel do operador

| | |
| --- | --- |
| **Ordem** | 15 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 10, SPEC 07 |
| **Habilita** | SPEC 27, 29 (as telas de curadoria delas herdam este painel) |
| **Tasks (estimativa)** | ~10 |
| **Ritual** | **B — normal** (design como seção do `tasks.md`, autoverificação com evidência) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **BANCO-10**, **BANCO-07** (superfície), **INFRA-11** (tela de administração da configuração) |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` · `.specs/modulos/m9-infra/spec.md` |

## Problem Statement

A SPEC 10 criou a fila de revisão e a porta de publicação; hoje só dá para operá-las por SQL. O
acervo é o fosso e depende de um humano decidindo rápido — a fila precisa de tela. E a configuração
da SPEC 02 tem escrita com autor obrigatório e nenhuma forma de usá-la sem escrever INSERT à mão.

## Goals

- [ ] Operador revisa a fila de questões em lote: aprovar, rejeitar, corrigir gerando versão nova.
- [ ] Taxonomia editável, com aprovação de candidato a tópico novo.
- [ ] Configuração e feature flags trocáveis pela tela, com histórico visível por chave.
- [ ] Toda ação registra quem, quando e por quê.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-07 (superfície) | tela da fila, decisão registrada em `questao_revisoes`, correção vira versão nova | m1 §P1: QA misto |
| BANCO-10 | tela de curadoria da taxonomia; aprovar candidato cria o tópico canônico; mudança vale para classificação futura sem deslocar histórico | m1 §P3: Tela de curadoria |
| INFRA-11 (superfície) | tela de configuração: valor vigente, histórico da chave, `motivo` obrigatório | m9 §P1: Configuração (AC7) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Regras de QA, piso de confiança, amostra | SPEC 10 (aqui é só a tela) |
| Curadoria de atualidade do Raio-X | SPEC 27 |
| Revisão em lote das questões suspeitas do flywheel | SPEC 29 |
| Trilha de auditoria da LGPD | SPEC 16 (esta tela **vira consumidora** dela depois) |

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Quem opera | papel único de operador de conteúdo (time de 3) | y |
| Chave sensível na tela | a tela é de operador autenticado; config nunca vai ao cliente | y (AD-081) |

## Success Criteria

- [ ] Aprovar uma questão da fila a publica e registra a decisão
- [ ] Corrigir uma questão publicada gera versão nova, não reescreve a anterior
- [ ] Aprovar candidato a tópico cria o tópico e não desloca nenhum histórico
- [ ] Trocar uma flag pela tela vale sem deploy e aparece no histórico com autor e motivo
