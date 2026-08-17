# SPEC 03 — Observabilidade e segredos

| | |
| --- | --- |
| **Ordem** | 03 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 01, SPEC 02 |
| **Habilita** | todas — a partir daqui "SHALL alertar" deixa de ser promessa |
| **Tasks (estimativa)** | ~8 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **INFRA-09**, **INFRA-10** (segredos; a verificação do webhook do Asaas é da SPEC 19) |
| **Fonte dos requisitos** | `.specs/modulos/m9-infra/spec.md` §P2: Erro visível e alertável · §Edge Cases (segredo) |

## Problem Statement

Dezenas de critérios de aceite das 9 specs terminam em "e **SHALL alertar**". Hoje não existe para
onde alertar: o `reportarFalhaDeConfig` da SPEC 02 cai no `console.error` e um job que morrer de
madrugada morre em silêncio. Construir mais oito specs em cima disso é acumular falha invisível.

## Goals

- [ ] Erro não tratado no front e no servidor chega ao Sentry com contexto (rota, release) e alerta.
- [ ] Falha de job (`pg_cron` e GitHub Actions) é visível e alertada — nunca silenciosa.
- [ ] O ponto único de reporte da configuração passa a escrever no Sentry sem mudar a assinatura.
- [ ] Segredo mora em Vercel/Supabase env + GitHub Secrets; a CI reprova segredo commitado.
- [ ] Migração de schema chega ao banco por CI a partir de merge, não por clique.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| INFRA-09 | Sentry no Next (front + servidor), contexto de rota/release, regra de alerta, visibilidade de falha de job, uso dos advisors do Supabase como fonte complementar | `modulos/m9-infra/spec.md` §P2 |
| INFRA-10 | inventário de segredos, onde cada um vive, guarda na CI contra commit de segredo, `.env.example` sem valor | `modulos/m9-infra/spec.md` §Edge Cases |
| — | aplicação de migração por CI (a assumption "migrações versionadas em git, aplicadas via GitHub Actions" do M9) | `modulos/m9-infra/spec.md` §Assumptions |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Preview por branch, branch do Supabase, deploy na Vercel (INFRA-01/07) | SPEC 16 |
| Analytics de produto / PostHog (INFRA-12) | SPEC 21 — erro ≠ comportamento (AD-079) |
| Trilha de auditoria da LGPD (DADOS-07) | SPEC 30 — é outra coisa: acesso a dado pessoal, não defeito |
| Streaming e Vercel Pro (INFRA-05) | SPEC 29 |

## Dependências técnicas

Depende da SPEC 02 porque a regra de alerta e o DSN vivem em configuração/segredo, e porque o ponto
de reporte a ser plugado nasceu lá (`definirReporteDeErro`).

## Contratos para as próximas specs

- Todo job novo (`pg_cron` ou GitHub Actions) **entrega falha visível** — a spec que cria o job cria
  o alerta junto, na mesma task.
- Mensagem de erro **SHALL NOT** conter dado pessoal em texto claro (antecipa DADOS-07 AC6).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Ferramenta de erro | **Sentry** (AD-037), plano gratuito | y (AD) / n (conta ainda não criada) |
| Onde o alerta chega | e-mail do time no lançamento; canal dedicado depois | n (decidir no Design) |

**Pendência externa:** criar a conta no Sentry antes de começar.

## Success Criteria

- [ ] Erro proposital numa rota aparece no Sentry com alerta
- [ ] `pg_cron` forçado a falhar dispara alerta
- [ ] Config ilegível continua deixando a flag desligada **e** agora também alerta
- [ ] Tentativa de commitar segredo é reprovada pela CI
