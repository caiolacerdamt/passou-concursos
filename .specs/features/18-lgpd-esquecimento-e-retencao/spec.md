# SPEC 18 — LGPD: esquecimento, retenção e canal do titular

| | |
| --- | --- |
| **Ordem** | 18 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 16, SPEC 17 |
| **Habilita** | SPEC 33 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **A — completo** (`design.md` próprio + Verificador independente com sensor de mutação) |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **DADOS-04**, **DADOS-03**, **DADOS-10**, **DADOS-15**, **INFRA-06** |
| **Fonte dos requisitos** | `.specs/modulos/m7-lgpd-flywheel/spec.md` · `.specs/modulos/m9-infra/spec.md` §P1: Backup ↔ DELETE |

## Problem Statement

Direito, não feature (art. 18, VI). Vem por último de propósito: o DELETE precisa alcançar **todas**
as tabelas de grupo 1, e só depois das SPECs 05–29 se sabe quais são. O invariante nº8 exige que o
esquecimento apague o grupo 1 inclusive dos backups, enquanto o agregado anônimo do grupo 2
sobrevive (art. 12).

## Goals

- [ ] Pedido de exclusão apaga **todo** o grupo 1 daquele `user_id` em ≤7 dias, idempotente e retomável.
- [ ] Backup expira naturalmente em ≤7 dias — o dado não volta por restauração.
- [ ] Retenção: inatividade de `retencao_meses` consolida no grupo 2 e **apaga** o grupo 1 (nunca anonimiza in-place).
- [ ] Canal do titular: exclusão, exportação em JSON e correção, com resposta em ≤15 dias.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| DADOS-04 | tela de confirmação dizendo o que some e o que fica; DELETE por `user_id` passando pela **porta nomeada** da SPEC 05; grupo 2 intacto; faturas retidas por prazo fiscal; auditoria e e-mail de confirmação | §P1: Direito ao esquecimento |
| DADOS-15 | o DELETE alcança **operador externo**: chama a API de deleção de pessoa, confere o **status de conclusão** e não fecha o pedido sem a confirmação; com a flag do analytics logado desligada é um **no-op verificável**, para que ligar a flag no futuro não deixe o DELETE incompleto | §P1: Direito ao esquecimento (AC10/AC11) |
| DADOS-03 | janela contada da última atividade **ou** do fim da matrícula (o mais recente); aviso 30 dias antes; volta dentro da janela reinicia o relógio; job idempotente com auditoria | §P1: Retenção |
| DADOS-10 | encarregado na política; exclusão, exportação (JSON) e correção na conta; prazo de 15 dias; correção de fato do log vai em **linha vizinha**, nunca UPDATE | §P1: Canal do titular |
| INFRA-06 | retenção de backup de 7 dias documentada e casada com o prazo do DELETE; RPO declarado | m9 §P1: Backup ↔ DELETE |

## Contratos que esta spec fixa para as próximas

⚠️ **Regra permanente:** toda spec posterior que criar dado do grupo 1 (SPEC 26, 33 e o que vier)
**estende a rotina de exclusão e o teste dela na mesma task**. O Design desta spec precisa escolher
um mecanismo que force isso — uma tabela nova com `user_id` que ninguém registrou tem que fazer o
teste falhar, não passar em silêncio.

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Base legal, política, consentimento | SPEC 17 |
| Grupo 3 pseudonimizado | SPEC 33 (quando existir, some no DELETE junto com a correspondência) |
| Reembolso | SPEC 28 — DELETE e reembolso são pedidos distintos; reembolso primeiro |

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| `retencao_meses` | 24, em configuração, declarado na política | n (advogado) |
| Backup | diário, retenção 7 dias, **sem PITR** | y (AD-038) |
| Partições | nunca dropadas; a retenção apaga **linhas** daquele `user_id` | y (AD-067) |

## Success Criteria

- [ ] Aluno com 30 questões respondidas pede exclusão: nenhuma linha com `user_id` sobrevive em nenhuma tabela, partição ou projeção
- [ ] O contador da questão no grupo 2 **não** cai; a fatura permanece
- [ ] Reexecutar o DELETE depois de falha parcial chega ao mesmo estado final
- [ ] Conta inativa há `retencao_meses + 1` tem grupo 1 zerado, grupo 2 preservado e auditoria escrita
- [ ] Exportação devolve JSON só com dados daquele aluno
- [ ] Correção de um fato do log entra como linha vizinha, sem UPDATE
