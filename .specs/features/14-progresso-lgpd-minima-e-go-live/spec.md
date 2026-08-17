# SPEC 14 — Progresso, sequência, LGPD mínima e go-live

| | |
| --- | --- |
| **Ordem** | 14 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** · 🚀 **última spec antes do lançamento** |
| **Depende de** | SPEC 06, SPEC 11, SPEC 13 |
| **Habilita** | SPEC 16, 19 |
| **Tasks (estimativa)** | ~10 |
| **Ritual** | **A — completo** (o apagamento é irreversível: `design.md` próprio + Verificador independente com sensor de mutação) |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **ALUNO-10** (superfície), **ALUNO-02** (AC2), **GAM-02**, **GAM-08**, **DADOS-04** (parte), **DADOS-01** (parte) |
| **Fonte dos requisitos** | `.specs/modulos/m4-coluna-vertebral/spec.md` · `.specs/modulos/m6-gamificacao/spec.md` · `.specs/modulos/m7-lgpd-flywheel/spec.md` |
| **Vem de** | SPEC 25 + parte da SPEC 28 + pedaços das SPECs 30/31/32 do recorte de 42 (AD-089) |

## Problem Statement

Duas coisas fecham o lançamento. A primeira é **o aluno ver que está avançando**: o caderno de erros
já é uma projeção pronta desde a SPEC 06 e não tem nenhuma tela; sem ela o aluno erra e não tem para
onde voltar. A segunda é **poder apagar o dado de quem pedir** — obrigação desde o primeiro aluno
pagante, não feature.

Esta é a versão mínima honesta da LGPD, e o que ela **não** cobre está declarado abaixo como risco
assumido, não como esquecimento.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| ALUNO-10 | tela do caderno de erros filtrável **por causa** e **por tópico**, os dois juntos | m4 §P2: Caderno de erros |
| ALUNO-02 (AC2) | histórico legível a partir do log; número vem da projeção do job, sem cálculo pesado ao vivo; aluno sem histórico vê **estado inicial explícito**, nunca zero apresentado como fracasso | m4 §P1: Projeções |
| GAM-02 | **sequência de barra baixa**: mantida ao cumprir o `piso` entregue pelo sistema, respeitando a agenda declarada; folga declarada não conta contra; calculada na abertura da tela (AD-071) | m6 §P1: Sequência de barra baixa |
| GAM-08 | sem ranking, liga, placar ou percentil entre alunos — em nenhuma tela | m6 §P2: 100% solo |
| DADOS-04 (parte) | rotina de apagamento por `user_id` passando pela **porta nomeada** da SPEC 05; alcança todas as tabelas de grupo 1 existentes; idempotente e retomável; `faturas` retidas por prazo fiscal; e-mail de confirmação | m7 §P1: Direito ao esquecimento |
| DADOS-01 (parte) | política de privacidade e termos publicados em PT-BR, versionados, ligados da página de vendas e do checkout; **núcleo sem checkbox** (invariante nº9) | m7 §P1: Núcleo sem checkbox |
| — | **checklist de go-live**: flags do AD-076 conferidas uma a uma, domínio no ar, Sentry recebendo, Raio-X e plano respondendo com o acervo real | esta spec |

## Out of Scope — e o que isso significa

| O que fica de fora | Onde entra | Risco assumido no lançamento |
| --- | --- | --- |
| Classificação formal dos 3 grupos no schema, acumulador anônimo, `auditoria` só-INSERT (DADOS-02/07/08) | SPEC 16 | RLS já protege desde a SPEC 07; a trilha formal de acesso não existe até lá |
| Base legal declarada por finalidade, opt-out do flywheel, consentimento de marketing (DADOS-09/14) | SPEC 17 | o flywheel **não roda** no lançamento, então não há o que optar por sair |
| Canal do titular com prazo de 15 dias, exportação JSON, correção, retenção automática por inatividade (DADOS-03/10/15) | SPEC 18 | **o pedido é atendido por procedimento manual documentado** — aceitável com dezenas de alunos, não com milhares |
| Anel do dia, "no prazo", progresso desde o ponto de partida (GAM-01/03/04/07) | SPEC 19 | nascem atrás de flag desligada por AD-076 |
| Escudos, perdão, reset suave, notificação | SPEC 26 | — |
| Exportação de dados do titular | SPEC 18 | — |

⚠️ **Este quadro é decisão consciente do sócio (AD-090), com o advogado ainda pendente.** Se o
volume de alunos passar de dezenas antes da SPEC 18, o procedimento manual deixa de ser defensável.

## Contratos que esta spec fixa para as próximas

⚠️ **Regra permanente:** toda spec posterior que criar tabela com `user_id` **estende a rotina de
apagamento e o teste dela na mesma task**. O Design precisa escolher um mecanismo que force isso —
tabela nova que ninguém registrou tem que fazer o teste **falhar**, não passar em silêncio. A SPEC 18
endurece a rotina; ela não a inventa do zero.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Prazo do apagamento | ≤7 dias, casado com a retenção de backup de 7 dias (AD-038) | y |
| Backup | diário, retenção 7 dias, sem PITR | y (AD-038) |
| Partições | nunca dropadas; a rotina apaga **linhas** daquele `user_id` (AD-067) | y |
| Encarregado (DPO) | nome, função e e-mail ativo na política | **n — decisão do sócio** |
| Texto da política | revisão do advogado **pendente**; sobe com redação própria e é revisado depois | n — risco assumido (AD-090) |
| Fuso do aluno | sequência usa o fuso declarado vigente; virada do dia não retroage | y (edge case) |

## Success Criteria

- [ ] Errar 3 questões com causas diferentes e ver o caderno agrupar por causa e por tópico
- [ ] Filtrar por causa e por tópico funciona junto
- [ ] Aluno novo vê estado inicial explícito
- [ ] Cumprir só o piso em 5 dias declarados mantém a sequência depois de um fim de semana sem estudar
- [ ] Nenhuma tela exibe posição relativa entre alunos
- [ ] Aluno com 30 questões respondidas pede exclusão: **nenhuma linha com `user_id` sobrevive** em nenhuma tabela, partição ou projeção
- [ ] A fatura permanece; reexecutar a rotina depois de falha parcial chega ao mesmo estado final
- [ ] Criar conta, nunca marcar nada e completar o loop central inteiro
- [ ] Checklist de go-live percorrido com as flags do AD-076 conferidas uma a uma
