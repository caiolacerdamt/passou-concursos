# SPEC 06 — Projeções, revisão espaçada e plano do dia

| | |
| --- | --- |
| **Ordem** | 06 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 05 |
| **Habilita** | SPEC 08 (frase do plano), 11, 13, 14, 19, 20 |
| **Tasks (estimativa)** | ~10 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Difícil |
| **Status** | 🟨 **Design e tasks já escritos** (rodada 1) — Execute não começou |
| **Requisitos** | **ALUNO-02**, **ALUNO-05** (AC1), **ALUNO-06** (parcial), **ALUNO-07**, **ALUNO-08**, **ALUNO-09**, **ALUNO-10**, **ALUNO-11**, **INFRA-03** |
| **Fonte dos requisitos** | `.specs/modulos/m4-coluna-vertebral/spec.md` |

## Problem Statement

O log cru não mostra nada sozinho. Esta spec é o que transforma linha de resposta em: domínio por
tópico, caderno de erros, agenda de revisão e **o plano de hoje** — tudo por regra/SQL, recalculável
do zero, sem uma linha de IA decidindo o que o aluno estuda (invariante nº6).

## Trabalho já feito que esta spec aproveita

| Documento | O que usar |
| --- | --- |
| `.specs/modulos/m4-coluna-vertebral/design.md` | §Projeções · §`recalcula_projecoes()` · §`agendarRevisao` · §Plano · §`perfil_estudo` · §`gera_plano_do_dia()` · §Contrato com o M5 · §Fluxos/Madrugada |
| `.specs/modulos/m4-coluna-vertebral/tasks.md` | **T16** (tabelas de projeção e agenda), **T17** (`recalcula_projecoes()`), **T18** (`agendarRevisao` FSRS), **T19** (plano + view stub), **T20** (`gera_plano_do_dia()`), **T21** (`pg_cron`) |

**T22 (frase do plano) saiu daqui** — é chamada de IA e precisa do gateway: virou escopo da SPEC 08.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| ALUNO-02 | `dominio_topico`, `caderno_erros`, `recalcula_projecoes()` idempotente com `pg_advisory_lock`; chute que acertou é descontado; anulada não conta | §P1: Projeções recalculáveis |
| ALUNO-10 | caderno como projeção sobre `correta=false` + causa, por tópico e por causa | §P2: Caderno de erros |
| ALUNO-09 | `revisao_agenda` + `revisao_evento`; FSRS com parâmetros padrão desde o dia 1; régua fixa 1/3/7/14/30 como plano B na **mesma coluna `due`**; `revisao_evento` guarda percentual **e** nota | §P1: Revisão espaçada (AD-072) |
| ALUNO-05 (AC1) | `perfil_estudo` com `nivel_declarado` e `minutos_por_dia` — o caminho de quem pula o diagnóstico | §P1: Diagnóstico curto |
| ALUNO-07 | nota do tópico = peso do Raio-X × fraqueza × devendo revisão; escolha **só regra/SQL** | §P1: Plano diário |
| ALUNO-08 | blocos Revisar / Avançar / Treinar cabendo no tempo declarado, com `motivo` | §P1: Plano diário |
| ALUNO-11 | dois níveis por plano: `piso` (só as revisões devidas) e `meta_cheia` | §P1: Plano diário (AC4) |
| ALUNO-06 (parcial) | `dominio_topico` alimenta a calibração — a calibração em si é a SPEC 29 | §P1: Projeções |
| INFRA-03 | os dois jobs em `pg_cron` (06:00 e 06:30 UTC), com guarda de reentrância | m9 §P1: Cada carga no seu lar (AC2) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Frase de abertura escrita por IA (ALUNO-12) | SPEC 08 |
| Peso real do Raio-X | SPEC 20 — aqui a view `raiox_peso_topico` devolve **1.0** e é substituída depois **mantendo a assinatura** |
| Diagnóstico adaptativo de ~20 questões (ALUNO-05 AC2) e a chamada de IA do plano inicial (AC3) | SPEC 13 — precisam de acervo e de tela |
| Qualquer tela | SPEC 13, 14 |
| Anel do dia e sequência | SPEC 19 (o plano só **emite** piso e meta cheia) |
| Bloco de simulado ligado | SPEC 32 (`flag.m4.simulado_semanal` nasce desligada) |

## Contratos que esta spec fixa para as próximas

- **`raiox_peso_topico`** é a fronteira com o Raio-X: a SPEC 20 troca o corpo da view sem tocar no
  motor do plano.
- O contrato exposto ao motor pela revisão é só **"está devendo revisão ou não"** — trocar FSRS por
  régua fixa não muda o plano.
- `plano_bloco` com `nivel ∈ {piso, meta_cheia}` é o que a gamificação (SPEC 19) consome.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Conversão "percentual do bloco → nota 1–4 do FSRS" | faixas em configuração (`param.m4.fsrs_faixas_nota`) | n — **adaptação registrada (AD-072)**; `revisao_evento` guarda os dois valores para permitir recalibrar |
| Tamanho de bloco | derivado de `minutos_por_dia` × `param.m4.minutos_por_questao` | n (calibra) |
| `computeParameters` (otimização por aluno) | **fora desta spec** — fast-follow; a chave `param.m4.fsrs_limiar_otimizacao` já existe e ninguém a lê | y |

## Success Criteria

- [ ] Apagar as duas projeções, rodar a função e obter **os mesmos números**
- [ ] Rodar duas vezes seguidas não muda nada; falha no meio deixa defasado, não corrompido
- [ ] Aluno novo, sem histórico, já recebe intervalo do **FSRS** (não a régua)
- [ ] Trocar para `regua_fixa` não perde nenhum agendamento
- [ ] Retrato frio (só `nivel_declarado`) ainda gera plano do 1º dia, com `piso` e `meta_cheia` distintos
- [ ] Rerodar no mesmo dia substitui o plano, não duplica
