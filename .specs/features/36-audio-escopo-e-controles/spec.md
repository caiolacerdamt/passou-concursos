# SPEC 36 — Áudio: escopo, controles e reserva

| | |
| --- | --- |
| **Ordem** | 36 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 35 |
| **Tasks (estimativa)** | ~9 |
| **Ritual** | **B — normal** (design como seção do `tasks.md`, autoverificação com evidência) |
| **Dificuldade** | Média |
| **Status** | 🧊 **Congelada** (AD-064) |
| **Requisitos** | **TTS-04**, **TTS-07**, **TTS-03**, **TTS-08**, **TTS-11** |
| **Fonte dos requisitos** | `.specs/modulos/m3-audio/spec.md` |

## Problem Statement

Gerar áudio para o acervo inteiro custa caro e a maior parte do valor está nas questões que mais
caem. E se o provedor de voz sair do ar no meio de um lote, improvisar outro provedor entrega uma
voz diferente na mesma trilha — pior do que parar.

## Goals

- [ ] Escopo por frequência (o que mais cai primeiro), atrás de flag, com teto de gasto por lote.
- [ ] Camada de voz trocável, com provedor reserva **em standby** — parar em vez de improvisar.
- [ ] Texto mudou → áudio refeito.
- [ ] Controles de escuta: velocidade e retomada.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| TTS-04 | escopo por frequência (lê o Raio-X) e refação quando o texto muda | §P2: Escopo por frequência |
| TTS-07 | flag do módulo + teto de gasto por lote | §P2: Escopo por frequência |
| TTS-03 / TTS-08 | camada trocável, ElevenLabs principal, reserva em standby | §P2: Camada de voz trocável |
| TTS-11 | velocidade e retomada na tela | §P3: Controles de escuta |

## Success Criteria

- [ ] Lote respeita o teto de gasto e para quando o atinge
- [ ] Provedor principal fora do ar interrompe o lote com alerta, sem trocar de voz sozinho
- [ ] Mudar o texto da explicação refaz o áudio
- [ ] Velocidade e retomada funcionam no celular
