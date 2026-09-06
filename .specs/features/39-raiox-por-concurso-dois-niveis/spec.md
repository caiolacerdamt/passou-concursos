# SPEC 39 — Raio-X por concurso: dois níveis, a prova como unidade e o lastro na tela

| | |
| --- | --- |
| **Ordem** | 39 de 40 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 11, SPEC 20, SPEC 37, SPEC 38 |
| **Habilita** | SPEC 40 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **A — completo** (`design.md` + `tasks.md` + `validation.md` + Verificador independente completo com sensor de mutação) |
| **Dificuldade** | Difícil |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **RAIOX-16**, **RAIOX-17**, **RAIOX-18** · revisa RAIOX-04, RAIOX-11, RAIOX-12, RAIOX-14 |
| **Fonte dos requisitos** | `.specs/modulos/m5-raiox-banca/spec.md` |
| **Decisões** | **AD-138** (revoga RAIOX-04 AC2) · mantém AD-056 (decaimento, amortecimento) e AD-057 (cortes por posição) |

## Problem Statement

A conta vigente divide o peso do tópico pelo peso de **todas as questões ingeridas** daquela banca
([`recalcula_raiox`, CTE `totais`](../../../supabase/migrations/20260821101000_raiox_recalculo.sql)). O denominador é o acervo, não a banca: ingerir 40
itens de uma prova e 15 de outra faz a primeira pesar 2,7× mais sem que a banca tenha cobrado nada a
mais, e uma prova ingerida pela metade desloca todas as linhas sem sinal visível. Prova oficial não é
amostra — é censo daquela prova; o erro está em agregar censos por soma bruta. Esta spec troca a
fórmula por `peso(assunto) = peso_oficial(matéria) × share(assunto | matéria)`, calculada por prova e
combinada entre provas, e passa a dizer na tela em que evidência cada linha se apoia.

**Por que Ritual A:** é a fórmula que o plano do dia multiplica. Errar aqui manda todo aluno estudar a
coisa errada sem que nada quebre — exatamente o tipo de defeito que só o sensor de mutação pega.

## Goals

- [ ] O peso da matéria vem do documento oficial; só a distribuição interna é estimada.
- [ ] A prova é a unidade de medida; prova pela metade não desloca as outras.
- [ ] Cada linha declara o degrau de lastro e quantas provas e anos a sustentam.
- [ ] Onde a evidência não sustenta detalhe, a tela para na matéria — sem decimal inventado.
- [ ] Apagar a projeção e recalcular do acervo devolve exatamente os mesmos números.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| RAIOX-16 | `peso = peso_oficial(matéria) × share(assunto \| matéria)`; peso oficial da grade (BANCO-15), nunca da contagem do acervo; share só de `origem='real'`, amortecido contra a **média da matéria**, somando 1 dentro dela; matéria sem item divide em partes iguais com `amostra_baixa`; porteiro do edital zera antes de multiplicar | m5 §P1: Peso em dois níveis |
| RAIOX-17 | taxa por prova e média entre provas ponderada pelo decaimento (AD-056); prova abaixo do piso de cobertura fica de fora e entra na lista de pendentes; caderno irmão conta uma vez; a linha persiste quantas provas e quais anos; idempotente e sem ler `tentativas` | m5 §P1: A prova é a unidade de medida |
| RAIOX-18 | degrau 1–4; degrau 3 transfere **só o desenho de dentro da matéria**, nunca o peso da matéria; lastro em texto na tela; degrau 2, 3 ou 4 apresenta no nível da matéria e não exibe percentual por assunto; degraus diferentes coexistem | m5 §P1: Degraus de lastro |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Núcleo × condicional e o empurrão de atualidade | SPEC 20 e SPEC 27 — esta spec **preserva** os dois e só troca a base sobre a qual eles operam |
| Ler prova, grade e etiqueta | SPEC 38 |
| Cadastro de concurso e nomes do edital | SPEC 37 |
| Fluxo de abertura de concurso e telas de aprovação | SPEC 40 |
| Dificuldade real calibrada pelo uso | M7 grupo 2 — não é Raio-X |

## Contratos que esta spec fixa para as próximas

- **A assinatura da view que o plano consome não muda.** O motor do M4 não é tocado; o teste que prova
  o contrato é o plano do dia seguinte reordenar sem alteração no motor — mesmo contrato da SPEC 20.
- **O invariante anti-viés continua intacto**: só `origem='real'` e `status='publicada'` entram; questão
  inédita nunca move nenhuma linha.
- **O Raio-X continua sem ler `tentativas`** (RAIOX-14), e continua job agendado, não cálculo ao vivo.
- O degrau de lastro é público: a SPEC 40 o usa no relatório de abertura de concurso.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Âncora do amortecimento | a média **daquela matéria** naquele concurso, não a média geral | y (AD-138) |
| Meia-vida do decaimento por ano | mantém `param.m5.meia_vida_decaimento_anos` vigente (default 5) | y (herda AD-056) |
| Constante `k` do amortecimento e piso de `amostra_baixa` | mantém `param.m5.amortecimento_k` e `param.m5.piso_amostra_baixa` | y (herda AD-056) |
| Piso de cobertura da prova | `param.m1.cobertura_minima` (SPEC 38) | n (calibra) |
| Peso relativo do degrau 3 | configuração; prova de outro órgão entra com peso menor que prova do próprio concurso | n (calibra) |
| Questão `anulada` | continua contando na frequência e continua fora do treino | y (herda M5) |
| Base do peso quando a prova declara pontuação | pontos; quando não declara, contagem de itens — a linha registra qual foi | y (BANCO-15 AC3) |
| Recálculo | job agendado (pg_cron), uma execução por vez, defasagem de horas aceitável | y (herda AD-035) |

**Open questions:** none — o que resta acima é calibração de parâmetro, com default e local registrados.

## Success Criteria

- [ ] Ingerir 40 itens de uma prova e 15 de outra do mesmo ano: as duas pesam igual
- [ ] Zerar as questões de uma matéria não muda o peso dela; seus assuntos dividem o peso em partes iguais, rotulados
- [ ] Publicar centenas de inéditas não move nenhuma linha
- [ ] Concurso só com edital: a tela mostra peso por matéria, rotula degrau 2 e **não** exibe percentual por assunto
- [ ] Degrau 3 muda o desenho de dentro da matéria e **não** muda o peso da matéria
- [ ] Apagar a projeção e recalcular do acervo devolve exatamente os mesmos números
- [ ] Nenhuma consulta do Raio-X toca `tentativas` (auditável no código)
- [ ] Sensor de mutação: trocar a média da matéria pela média geral no amortecimento deixa o teste vermelho
