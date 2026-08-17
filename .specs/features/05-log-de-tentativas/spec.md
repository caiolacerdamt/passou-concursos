# SPEC 05 — Log de tentativas

| | |
| --- | --- |
| **Ordem** | 05 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 04 |
| **Habilita** | SPEC 06, 11 (indireto), 13, 16, 18 |
| **Tasks (estimativa)** | ~8 |
| **Ritual** | **A — completo** (`design.md` próprio + Verificador independente com sensor de mutação) |
| **Dificuldade** | Difícil |
| **Status** | 🟨 **Design e tasks já escritos** (rodada 1) — Execute não começou |
| **Requisitos** | **ALUNO-01**, **ALUNO-03** (servidor), **ALUNO-04**, **INFRA-04** |
| **Fonte dos requisitos** | `.specs/modulos/m4-coluna-vertebral/spec.md` · `.specs/modulos/m9-infra/spec.md` §P1: `tentativas` particionada |

## Problem Statement

`tentativas` é a aposta fundacional (AD-015): toda projeção do produto é reconstruída dela. Precisa
nascer certa — particionada, só-INSERT, com snapshot congelado — porque reparticionar e destravar
depois é caro e arriscado.

## Trabalho já feito que esta spec aproveita

O Design e as Tasks da rodada 1 cobrem esta spec quase inteira. **Não refazer**, revisar e continuar:

| Documento | O que usar |
| --- | --- |
| `.specs/modulos/m4-coluna-vertebral/design.md` | §`tentativas` — o fato cru · §A trava do só-INSERT · §RLS · §Sessão · §Causa do simulado · §`registrarTentativa` |
| `.specs/modulos/m4-coluna-vertebral/tasks.md` | **T11** (tabela), **T12** (trava + RLS), **T13** (pg_partman), **T14** (sessões), **T15** (`registrarTentativa`) |
| `.specs/modulos/m9-infra/design.md` | §Particionamento de `tentativas` |

**Duas correções obrigatórias em cima daquele material:**

1. A trava é de **3 camadas** (**AD-084**), não 2: `REVOKE`+RLS, gatilho, **e a retirada do TRUNCATE**
   de `anon`/`authenticated` — RLS não governa TRUNCATE, então sem isso a tabela append-only podia ser
   esvaziada inteira. O AD-082 (2 camadas) está substituído.
2. A **T10 morreu**: as tabelas mínimas de questão que ela criava agora são a SPEC 04 inteira. Os
   enums do log (`contexto_tentativa`, `causa_erro`, `causa_origem`) continuam nesta spec.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| ALUNO-01 | tabela particionada por `respondida_em`, snapshot congelado (id **e** rótulo), só-INSERT com porta nomeada de esquecimento, RLS por `auth.uid()` | m4 §P1: Log imutável |
| ALUNO-04 | enum das 6 causas + `nao_sei_dizer` + `faltou_tempo`; `tentativa_causa_simulado` como tabela vizinha (nunca UPDATE no fato) | m4 §P1: Causa do erro |
| ALUNO-03 | `causa_erro` obrigatória no treino gravada **no próprio INSERT**; `causa_origem='aluno'`; `nao_sei_dizer` é resposta válida | m4 §P1: Causa do erro |
| INFRA-04 | `pg_partman` mensal, 3 meses pré-criados, partition pruning provado, retenção desligada (partição nunca é dropada, AD-067) | m9 §P1: `tentativas` particionada |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Projeções, caderno, agenda de revisão, plano | SPEC 06 |
| Qualquer tela (responder questão, escolher causa) | SPEC 13 |
| DELETE-por-esquecimento operado de fato | SPEC 18 — aqui só a **porta** existe |
| Classificação de grupo LGPD e auditoria | SPEC 16 |

## Contratos que esta spec fixa para as próximas

- **Invariante nº1:** `tentativas` só recebe INSERT. Correção = linha nova ou tabela vizinha.
- O DELETE por `user_id` passa pela porta nomeada `app.esquecimento_user_id` — a SPEC 18 usa **essa**
  porta, não um privilégio genérico de administrador.
- O snapshot é congelado: reclassificar assunto na SPEC 09/15 não desloca histórico nenhum.

## Assumptions & Open Questions

| Pergunta aberta (herdada do Design) | Como resolver |
| --- | --- |
| Gatilho `BEFORE UPDATE OR DELETE ... FOR EACH ROW` na tabela-pai propaga para as partições? | Postgres suporta desde a 13 e o projeto roda 17.6, mas é afirmação a **verificar aplicando**. Se não propagar: criar por partição via template do `pg_partman` e registrar o achado no `.specs/STATE.md` |
| Dedup de resposta dupla | `UPDATE` condicional em `sessao_itens` por `(sessao_id, questao_id, ordem)` |

## Success Criteria

- [ ] UPDATE recusado inclusive para o papel de serviço; TRUNCATE recusado
- [ ] DELETE só passa quando a sessão declara o `user_id` correto
- [ ] Reclassificar a questão não muda o snapshot da tentativa antiga
- [ ] Erro no treino sem causa é recusado **antes** do INSERT, com mensagem própria
- [ ] Duplo-clique produz **uma** tentativa
- [ ] `EXPLAIN` por `user_id` + período faz pruning para uma partição só
