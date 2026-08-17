# SPEC 15 — Fundação da interface

| | |
| --- | --- |
| **Ordem** | 15 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 03 |
| **Habilita** | SPEC 16, 17, 18, 21, 22, 23, 24, 25, 28 |
| **Tasks (estimativa)** | ~8 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | ⚠️ **nenhum requisito numerado existe** — ver "Lacuna de Specify" abaixo |
| **Fonte** | AD-077 (web responsivo, sem app nativo nem PWA) · AD-076 (quais superfícies nascem ligadas) |

## Problem Statement

Nove specs temáticas descrevem regras de servidor e critérios de aceite de comportamento, e **nenhuma
decide a camada de interface**. A SPEC 01 registrou isso explicitamente ao criar o projeto **sem
Tailwind**: "nenhuma spec decidiu camada de estilo". Sete specs de tela vêm depois desta; começar a
primeira sem shell, sem estilo e sem estado padrão de carga/erro/vazio significa inventar três vezes
e refatorar depois.

## Lacuna de Specify — ler antes do Design

Esta é a **única spec do roadmap sem requisitos numerados de origem**. A fase Specify precisa rodar
aqui (é curta): transformar em critérios de aceite verificáveis o que hoje está espalhado como
consequência de outras specs — responsivo mobile-first (AD-077/PAG-08 AC3), estado inicial explícito
em vez de zero (GAM edge case), degradação clara quando o tutor cai (IA-01 AC3), aviso de "em
revisão" quando não há explicação (IA-09 AC5). **Não pule para Design.** Os requisitos novos ganham
o prefixo `UI-NN` e entram na tabela de rastreio desta spec.

## Goals

- [ ] Uma camada de estilo escolhida e registrada em AD (hoje não existe nenhuma).
- [ ] Shell responsivo mobile-first: navegação, cabeçalho, área de conteúdo.
- [ ] Padrão único de carga, erro, vazio e degradação — usado por todas as telas seguintes.
- [ ] Acessibilidade base (foco visível, contraste, rótulo em controle) como critério, não intenção.
- [ ] Erro de interface chega ao Sentry da SPEC 03.

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Qualquer tela de produto | SPEC 17 em diante |
| App nativo ou PWA | fora do lançamento (AD-077) |
| Design da página de vendas (copy e arte) | SPEC 21 |
| Deploy e preview | SPEC 16 |

## Assumptions & Open Questions

| Pergunta | Situação |
| --- | --- |
| Qual camada de estilo | **em aberto** — decisão do Design, registrada em AD nova |
| Biblioteca de componentes | em aberto; o AGENTS.md manda infra do tamanho do problema de hoje |
| Tema claro/escuro | não decidido; se ficar fora, registrar como fora de escopo |

## Success Criteria

- [ ] Uma página de exemplo funciona de 360px a desktop sem rolagem horizontal
- [ ] Os quatro estados (carga, erro, vazio, degradado) têm componente único e teste
- [ ] Erro não tratado na interface aparece no Sentry
- [ ] Decisão de estilo registrada como AD nova no `.specs/STATE.md`
