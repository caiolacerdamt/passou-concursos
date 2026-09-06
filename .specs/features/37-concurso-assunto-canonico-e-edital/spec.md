# SPEC 37 — Concurso: assunto canônico, nome do edital e escolha do aluno

| | |
| --- | --- |
| **Ordem** | 37 de 40 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 11, SPEC 13 |
| **Habilita** | SPEC 38, 39, 40 |
| **Tasks (estimativa)** | ~11 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Difícil |
| **Status** | ✅ Concluída (2026-09-06) — `tasks.md` traz o design embutido e a verificação independente |
| **Requisitos** | **RAIOX-19**, **RAIOX-20**, **ALUNO-13**, **RAIOX-08** (estende) |
| **Fonte dos requisitos** | `.specs/modulos/m5-raiox-banca/spec.md` · `.specs/modulos/m4-coluna-vertebral/spec.md` |
| **Decisões** | **AD-139**, AD-140 · herda AD-042 (snapshot), AD-001/AD-078 (flag e config) |

## Problem Statement

A plataforma se diz multi-concurso e não é. `perfil_concurso.ativo` é chave global — a projeção e o
ciclo adaptativo casam por `p.ativo` ([`raiox_integracao.sql:24`](../../../supabase/migrations/20260821102000_raiox_integracao.sql), [`ciclo_adaptativo.sql:78`](../../../supabase/migrations/20260824102000_ciclo_adaptativo.sql)) — e
`perfil_estudo.concurso_alvo` é `text` sem referência ([`spec13:11`](../../../supabase/migrations/20260822220000_spec13_onboarding_e_sessao.sql)): o aluno digita o
concurso e nada acontece. Junto disso, a taxonomia é a do BB: a CAIXA chama **Atendimento Bancário** o
que o BB chama **Vendas e Negociação**, e separa **Probabilidade e Estatística** onde o BB a coloca
dentro de Matemática. Rodar um concurso novo sobre a taxonomia de outro mostra ao aluno um edital que
não é o dele. Esta spec parte a taxonomia em duas camadas e faz o concurso ser escolha do aluno.

## Goals

- [ ] O **assunto canônico** é o átomo: único, compartilhado, e é nele que questão e etiqueta gravam.
- [ ] Cada concurso tem a **lista de matérias do edital dele**, com nome e agrupamento próprios.
- [ ] O aluno escolhe o concurso; plano e Raio-X passam a seguir a escolha, não uma flag global.
- [ ] Renomear ou reagrupar num concurso não toca em nenhum outro.
- [ ] Com a flag desligada o produto é idêntico ao de hoje.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| RAIOX-19 | `concursos`; matérias por concurso com nome e ordem do edital; mapa matéria-do-concurso → assuntos canônicos; a tela do aluno só usa nome do edital dele | m5 §P1: Raio-X por concurso |
| RAIOX-20 | visibilidade `oculto`/`elegivel`/`publicado`; publicação exige ação humana registrada; lista do que falta para o operador | m5 §P1: Prontidão |
| ALUNO-13 | `perfil_estudo` aponta para o concurso por referência; plano e projeção seguem o aluno; histórico intacto na troca; flag desligada = hoje | m4 §P1: O aluno escolhe |
| RAIOX-08 | o `perfil_concurso` vigente vira o primeiro `concurso`, sem migração destrutiva e sem duplicar taxonomia | m5 §P1: Perfil de concurso |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Ler prova, extrair grade, etiquetar item | SPEC 38 |
| A conta nova do Raio-X (dois níveis, degraus, lastro) | SPEC 39 |
| Busca de PDF em fonte oficial, skill e telas de aprovação | SPEC 40 |
| Fusão de assunto quase-duplicado pela tela | SPEC 40 (aqui entra só a **operação** de fundir, sem tela) |
| Tiers, preço por concurso, matrícula por concurso | SPEC 34 |

## Contratos que esta spec fixa para as próximas

- **Assunto canônico é o único lugar onde questão e etiqueta gravam classificação.** A SPEC 38 grava
  etiqueta apontando para ele; a SPEC 39 agrega por ele. Nenhuma das duas grava em matéria de concurso.
- **Nome de concurso nunca vaza para o núcleo.** O peso, a projeção e o plano trabalham em assunto
  canônico; o nome do edital é camada de apresentação.
- **Fundir dois assuntos canônicos é operação suportada e segura** — o histórico está congelado por
  snapshot (AD-042). A SPEC 40 constrói a tela em cima desta operação.
- `tem_matricula_ativa()` continua sendo a única chave de liberação; concurso é **escopo**, não porta.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Nome da flag | `flag.m5.multi_concurso`, nasce **desligada** (AD-001) | y |
| Concurso padrão com a flag desligada | o `perfil_concurso` hoje marcado `ativo`, migrado como concurso nº 1 | y |
| Um aluno estuda um concurso por vez | sim; mais de um simultâneo é evolução, não MVP desta spec | n (default registrado) |
| Chave natural do concurso | `(orgao, cargo)`; edições são os anos das provas | n (default registrado) |
| Cargo que muda de nome entre edições (Escriturário → Agente Comercial) | vínculo confirmado por humano, nunca inferido | y |
| Profundidade da árvore de assunto canônico | dois níveis internos no máximo; o agrupamento do aluno vem do concurso | n (calibra) |
| Piso de prontidão para publicar concurso | configuração (`param.m5.prontidao_piso`), início conservador | n (calibra) |

**Open questions:** none — o que resta acima é calibração de parâmetro, com default e local registrados.

## Success Criteria

- [ ] Dois concursos publicados, dois alunos em concursos diferentes: cada um recebe o plano e a tela do edital dele
- [ ] O mesmo assunto canônico aparece sob nomes de matéria diferentes nos dois, e renomear num não mexe no outro
- [ ] Questão gravada numa prova do BB é servida ao aluno da CAIXA quando o assunto canônico é o mesmo
- [ ] Trocar de concurso preserva `tentativas` e reaproveita o domínio nos assuntos comuns
- [ ] Concurso recém-criado não aparece para o aluno, e o operador vê a lista do que falta para publicá-lo
- [ ] Com `flag.m5.multi_concurso` desligada, o produto se comporta byte a byte como hoje
