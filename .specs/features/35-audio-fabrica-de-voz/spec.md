# SPEC 35 — Áudio: fábrica de voz

| | |
| --- | --- |
| **Ordem** | 35 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 21, SPEC 16 |
| **Tasks (estimativa)** | ~11 |
| **Ritual** | **B — normal** (design como seção do `tasks.md`, autoverificação com evidência) |
| **Dificuldade** | Difícil |
| **Status** | 🧊 **Congelada** — SHALL NOT entrar em Design enquanto a flag de áudio não estiver perto de ligar (AD-064) |
| **Requisitos** | **TTS-06**, **TTS-02**, **TTS-01**, **TTS-05**, **TTS-09**, **TTS-10** |
| **Fonte dos requisitos** | `.specs/modulos/m3-audio/spec.md` |

## Problem Statement

Áudio é o diferencial de quem estuda no deslocamento, e áudio ruim queima a marca mais rápido do que
áudio nenhum. Por isso o porteiro do módulo não é técnico: é o **teste cego de voz**, que ainda não
foi feito — e ele trava o primeiro lote.

## Goals

- [ ] Voz escolhida por teste cego, travada e registrada, antes de gerar qualquer lote.
- [ ] Número e sigla normalizados **antes** de virar voz.
- [ ] Áudio gerado 1× por versão, em máxima qualidade, narrando questão + explicação num arquivo contínuo.
- [ ] Questão com imagem **não** recebe áudio, com motivo registrado.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| TTS-06 | teste cego como porteiro do primeiro lote; voz registrada | §P1: Teste cego da voz |
| TTS-02 | normalizador de número e sigla, com versão própria gravada | §P1: Normalização |
| TTS-01 / TTS-05 | geração 1× amarrada à versão da explicação; questão + explicação num arquivo | §P1: Áudio de máxima qualidade |
| TTS-09 | questão com imagem fica sem áudio, com motivo | §P1: Áudio narra a questão |
| TTS-10 | chave de dedup + versão de voz/normalizador por áudio | §Assumptions (AD-036) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Escopo por frequência, teto de gasto, provedor reserva, controles de escuta | SPEC 36 |
| Áudio ao vivo | **nunca** (invariante nº7) |

## Contrato herdado

Quando a explicação é invalidada (SPEC 21), **o áudio daquela versão é descartado e refeito**
(TTS-04/AD-014).

**Pendências externas:** teste cego da voz (ferramenta em `experiments/tts-comparacao/`, incluir
Inworld e Hume — AD-062/065) e reconfirmar preços de TTS em fonte oficial.

## Success Criteria

- [ ] Nenhum lote gerado antes do teste cego registrado
- [ ] "R$ 1.250,00" e "CDB" saem falados corretamente
- [ ] Rerodar a fábrica não regera áudio já existente da mesma versão
- [ ] Questão com gráfico não tem áudio, e o motivo está registrado
