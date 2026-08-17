# SPEC 25 — Ambientes, staging e deploy

| | |
| --- | --- |
| **Ordem** | 25 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 03, SPEC 07 |
| **Habilita** | — (endurece o ambiente que a SPEC 07 entregou) |
| **Tasks (estimativa)** | ~8 |
| **Ritual** | **C — leve** (tasks direto, sem documento de design separado) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **INFRA-01**, **INFRA-07** |
| **Fonte dos requisitos** | `.specs/modulos/m9-infra/spec.md` §P1: Região SP, gerenciado, staging isolado |

## Problem Statement

A partir da SPEC 12 existe um webhook de pagamento: alguém paga e o dinheiro chega a um endpoint que
precisa existir na internet. E testar migração e tela contra produção com três pessoas é como se
quebra produção. Precisa de ambiente antes de precisar do ambiente.

## Goals

- [ ] Produção e banco na **região São Paulo**, tudo gerenciado.
- [ ] Branch de git abre preview isolado (Vercel preview + branch do Supabase).
- [ ] Migração chega à produção **só por merge aprovado** — nunca clicando no painel.
- [ ] Segredo de cada ambiente separado, sem cruzamento entre staging e produção.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| INFRA-01 | provisionamento e região; o projeto Supabase `kfpmetkmhjtmgwgaaerl` (sa-east-1) já existe desde a SPEC 01 — falta a Vercel | §P1: Região SP (AC1) |
| INFRA-07 | preview por branch, branch do Supabase, promoção de migração por merge | §P1: Região SP (AC2/AC3) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Vercel **Pro** e streaming | SPEC 24 (só o tutor exige o Pro — AD-066) |
| Sentry, alertas, segredos no código | SPEC 03 |
| Analytics e proxy reverso | SPEC 12 |
| Multi-região, failover, Kubernetes | fora de escopo declarado (M9) |

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Plano Supabase | **Pro** é o que habilita branch de staging e backup diário | n — **decisão de custo do sócio** |
| Plano Vercel | Hobby basta até o tutor entrar (SPEC 24) | y (AD-066) |
| RPO/RTO | RPO ≈ 24h (snapshot diário), sem PITR | y (AD-038) |

**Pendências externas:** conta na Vercel; decisão sobre o Supabase Pro.

## Success Criteria

- [ ] Abrir branch levanta preview + banco isolado
- [ ] Migração aplicada em staging não muda produção até o merge
- [ ] Produção responde num domínio próprio, na região SP
