# SPEC 03 — Observabilidade e segredos

| | |
| --- | --- |
| **Ordem** | 03 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** · ✅ concluída |
| **Depende de** | SPEC 01, SPEC 02 |
| **Habilita** | todas — a partir daqui "SHALL alertar" deixa de ser promessa |
| **Tasks (estimativa)** | ~8 → **10 na prática** (T23–T32) |
| **Dificuldade** | Média |
| **Status** | ✅ Concluída — ver `design.md`, `tasks.md` e `validation.md` |
| **Requisitos** | **INFRA-09**, **INFRA-10** (segredos; a verificação do webhook do Asaas é da SPEC 12) |
| **Fonte dos requisitos** | `.specs/modulos/m9-infra/spec.md` §P2: Erro visível e alertável · §Edge Cases (segredo) |

## Problem Statement

Dezenas de critérios de aceite das 9 specs terminam em "e **SHALL alertar**". Hoje não existe para
onde alertar: o `reportarFalhaDeConfig` da SPEC 02 cai no `console.error` e um job que morrer de
madrugada morre em silêncio. Construir mais oito specs em cima disso é acumular falha invisível.

## Goals

- [x] Erro não tratado no front e no servidor chega ao Sentry com contexto (rota, release) e alerta.
- [x] Falha de job (`pg_cron` e GitHub Actions) é visível e alertada — nunca silenciosa.
- [x] O ponto único de reporte da configuração passa a escrever no Sentry sem mudar a assinatura.
- [x] Segredo mora em Vercel/Supabase env + GitHub Secrets; a CI reprova segredo commitado.
- [x] Migração de schema chega ao banco por CI a partir de merge, não por clique.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| INFRA-09 | Sentry no Next (front + servidor), contexto de rota/release, regra de alerta, visibilidade de falha de job, uso dos advisors do Supabase como fonte complementar | `modulos/m9-infra/spec.md` §P2 |
| INFRA-10 | inventário de segredos, onde cada um vive, guarda na CI contra commit de segredo, `.env.example` sem valor | `modulos/m9-infra/spec.md` §Edge Cases |
| — | aplicação de migração por CI (a assumption "migrações versionadas em git, aplicadas via GitHub Actions" do M9) | `modulos/m9-infra/spec.md` §Assumptions |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Preview por branch, branch do Supabase, deploy na Vercel (INFRA-01/07) | SPEC 25 |
| Analytics de produto / PostHog (INFRA-12) | SPEC 12 — erro ≠ comportamento (AD-079) |
| Trilha de auditoria da LGPD (DADOS-07) | SPEC 16 — é outra coisa: acesso a dado pessoal, não defeito |
| Streaming e Vercel Pro (INFRA-05) | SPEC 24 |

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

- [x] Erro proposital numa rota aparece no Sentry com alerta
- [x] `pg_cron` forçado a falhar dispara alerta
- [x] Config ilegível continua deixando a flag desligada **e** agora também alerta
- [x] Tentativa de commitar segredo é reprovada pela CI

**Como cada um foi provado** (detalhe em `validation.md`):

| Critério | Prova |
| --- | --- |
| nº1 | Ao vivo em 2026-08-17, servidor local com DSN real: a rota lançou (`HTTP 500`) e o SDK registrou `Captured error event` → `Flushing events` → `Done flushing events`. **O porteiro da flag foi contornado por edição local revertida**, porque ligar a flag exige linha em `configuracoes`, que exige usuário em `auth.users`, que só nasce na SPEC 07. Os dois lados do porteiro têm teste `unit`; o que ficou sem prova ao vivo é a flag, não o caminho até o Sentry. |
| nº2 | Ao vivo em 2026-08-16: job `teste-falha-spec03` quebrado de propósito → view `public.jobs_falhados` → vigia → e-mail `PASSOU-CONCURSOS-2` recebido. Job e execuções removidos depois. |
| nº3 | Teste `unit` em `src/modules/config/leitura.test.ts` (flag continua desligada) somado ao destino de observabilidade espionado recebendo o contexto `{ modulo: "config" }`. |
| nº4 | Ao vivo pelo Verifier, em repositório git descartável: segredo plantado ⇒ saída ≠ 0; limpo ⇒ 0; `.env` versionado ⇒ ≠ 0; DSN no `.env.example` **não** dispara. |

**Limitação de evidência declarada:** nenhum dos 4 workflows novos jamais executou no GitHub — a branch não foi
empurrada até o fechamento desta spec. Eles têm prova de sintaxe e de conteúdo, não de gatilho. O `paths:` do
`migracao.yml` só se prova num merge real.
