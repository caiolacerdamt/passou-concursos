# SPEC 16 — LGPD: grupos de dado, RLS e auditoria

| | |
| --- | --- |
| **Ordem** | 16 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 05, SPEC 12, SPEC 14 |
| **Habilita** | SPEC 17, 18, 29, 33 |
| **Tasks (estimativa)** | ~10 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **DADOS-02**, **DADOS-07**, **DADOS-08** |
| **Fonte dos requisitos** | `.specs/modulos/m7-lgpd-flywheel/spec.md` |

> **Nota da AD-089.** Esta spec dependia das SPECs de gamificação e tutor no recorte de 42 porque
> classificava as tabelas delas. Não depende mais: a regra permanente da SPEC 14 obriga toda spec
> posterior a declarar o grupo e estender a rotina de apagamento **na mesma task**. Aqui se classifica
> o que existe; o que vier depois se classifica sozinho.

## Problem Statement

É a decisão estrutural da qual todo o resto do M7 depende (AD-027): sem cada dado classificado em um
dos três grupos, ninguém sabe o que morre no DELETE e o que sobrevive. Esta spec vem **depois** de as
tabelas existirem justamente para classificar o que existe, não o que se imagina.

## Goals

- [ ] Todo dado pessoal pertence a exatamente **um** grupo, declarado no schema.
- [ ] Grupo 2 é acumulador materializado, sem `user_id` nem pseudônimo, com piso de respondentes.
- [ ] RLS em toda tabela de grupo 1; acesso escalonado por sensibilidade.
- [ ] `auditoria` só-INSERT registra quem, quando, o quê e por quê em acesso a dado com nome.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| DADOS-02 | classificação obrigatória no schema; dia 1 sobe só com grupos 1 e 2 | §P1: Três grupos de dado |
| DADOS-08 | acumulador anônimo por questão/tópico, incrementado por job **idempotente** com marca d'água; `n_respondentes >= piso_anonimato` (default 20, em configuração) para exibir ou usar | §P1: Três grupos (AC4–AC6) |
| DADOS-07 | RLS por sensibilidade; `auditoria` só-INSERT e não apagável por quem opera; auditoria LGPD **distinta** da observabilidade da SPEC 03; log sem dado pessoal em claro; `service_role` só em job | §P1: Acesso mínimo + trilha |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Política de privacidade, base legal, consentimento, opt-out | SPEC 17 |
| DELETE, retenção, exportação, correção | SPEC 18 |
| Esteiras do flywheel que **leem** o grupo 2 | SPEC 29 |
| Grupo 3 pseudonimizado | SPEC 33 |

## Contratos que esta spec fixa para as próximas

- **Toda tabela nova com dado de aluno declara o grupo na própria migração** — vale para as SPECs
  33, 41 e qualquer outra depois desta.
- O grupo 2 **não é recalculado do zero** a partir do log corrente: ele precisa preservar a
  contribuição de quem já exerceu o DELETE (art. 12).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| `piso_anonimato` | 20, em configuração | y (AD-046) |
| Inventário do grupo 1 no lançamento | `auth.users`, perfil, meta, `sessoes`, `tentativas`, causa do simulado, `feedback_explicacao`, perguntas do tutor, projeções de M4 e M6 | y (DADOS-02 AC1) |

## Success Criteria

- [ ] Listar todas as tabelas com dado de aluno e cada uma tem grupo declarado
- [ ] 19 respondentes deixam a estatística indisponível; a 20ª libera
- [ ] Reprocessar a mesma janela do acumulador não conta duas vezes
- [ ] Aluno A não lê tentativa do aluno B
- [ ] Consulta administrativa sobre grupo 1 aparece na `auditoria`
