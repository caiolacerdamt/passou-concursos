# SPEC 17 — LGPD: política, base legal e consentimento

| | |
| --- | --- |
| **Ordem** | 17 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 12, SPEC 16 |
| **Habilita** | SPEC 18, 26 (notificação fora do app exige consentimento), 29 |
| **Tasks (estimativa)** | ~8 |
| **Ritual** | **C — leve** (tasks direto, sem documento de design separado) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **DADOS-01**, **DADOS-09**, **DADOS-14**, **DADOS-11** (parte declaratória) |
| **Fonte dos requisitos** | `.specs/modulos/m7-lgpd-flywheel/spec.md` |

## Problem Statement

Invariante nº9: o núcleo do produto **não fica atrás de checkbox**. Operar o produto é execução de
contrato, não consentimento — e um checkbox na entrada mata a ativação e ainda é juridicamente
errado. O que precisa de consentimento é só marketing; o flywheel roda por legítimo interesse com
opt-out real.

## Goals

- [ ] Uma política em português claro declarando as três finalidades e suas bases legais.
- [ ] Opt-out do flywheel acessível na conta, sem degradar nada que o aluno pagou.
- [ ] Consentimento de marketing separado, nunca pré-marcado, revogável em ≤48h.
- [ ] Operadores nomeados e transferência internacional declarada — nenhum operador não declarado.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| DADOS-01 | política versionada, três finalidades, núcleo sem checkbox, marketing por consentimento, sem tela de switches granulares | §P1: Núcleo sem checkbox |
| DADOS-09 | chave de opt-out do flywheel na conta + LIA arquivado **antes** de ligar | §P1: Núcleo sem checkbox (AC3/AC4) |
| DADOS-14 | operadores nomeados; transferência internacional (PostHog, EUA) declarada; política atualizada **antes** de um operador novo começar a tratar | §P1 (AC8) |
| DADOS-11 (parte) | termos e política declarando serviço para maiores de 18 (a declaração no checkout é da SPEC 12) | §P1: Declaração de maioridade |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Classificação de grupos, RLS, auditoria | SPEC 16 |
| Esquecimento, retenção, exportação, correção | SPEC 18 |
| Esteiras do flywheel | SPEC 29 (esta spec entrega a base legal e o opt-out que elas respeitam) |

## Contratos que esta spec fixa para as próximas

- **A janela de retenção declarada na política é lida da configuração** — política e código não podem
  divergir (DADOS-03 AC5). Alterar `retencao_meses` exige revisar a política.
- Notificação fora do app (SPEC 26) só sai com consentimento; aviso dentro do produto, não.

## Assumptions & Open Questions

| Pendência | Situação |
| --- | --- |
| Base legal das questões (AD-003), janela de 24m (AD-045), LIA antes do flywheel (AD-026) | **advogado** |
| Instrumento da transferência para os EUA (art. 33 LGPD, sem decisão de adequação da ANPD) | **advogado** — cláusulas-padrão contratuais são o caminho usual |
| Encarregado (DPO) | nome, função e e-mail ativo — decisão dos sócios |

## Success Criteria

- [ ] Criar conta, nunca marcar nada e completar o loop central inteiro
- [ ] Ligar o opt-out do flywheel e ver plano e questões idênticos
- [ ] Revogar marketing para os envios em ≤48h, com registro, sem afetar o acesso
- [ ] Todo serviço que recebe dado pessoal aparece nomeado na política, com a região onde trata
