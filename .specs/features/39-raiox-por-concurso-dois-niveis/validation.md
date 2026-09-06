# SPEC 39 — Validação

- **Data**: 2026-09-06
- **Feature/spec**: `.specs/features/39-raiox-por-concurso-dois-niveis/spec.md`
- **Branch**: `feat/spec39-raiox-dois-niveis`
- **Ritual**: **A** — `design.md` + `tasks.md` + este documento + Verificador independente completo
  com sensor de mutação (AD-090).
- **Requisitos**: RAIOX-16, RAIOX-17, RAIOX-18 · AD-138 (revoga RAIOX-04 AC2), AD-056, AD-057, AD-142.
- **Verificador independente**: rodou contra `d68b9cd`, com escopo de leitura mais testes próprios de
  sondagem (apagados ao fim); não alterou código, migration nem spec. **Veredito: APROVADO COM
  RESSALVAS** — 1 Major e 6 Minor, todos tratados abaixo.

Abreviações usadas nas evidências:

| Sigla | Arquivo |
| --- | --- |
| `LASTRO` | `supabase/migrations/20260908120000_spec39_lastro_e_grade.sql` |
| `RECALC` | `supabase/migrations/20260908121000_spec39_recalculo_dois_niveis.sql` |
| `FRONT` | `supabase/migrations/20260908122000_spec39_fronteira_sem_lastro.sql` |
| `T39` | `tests/db/spec39-raiox-dois-niveis.test.ts` |
| `TREC` | `tests/db/raiox-recalculo.test.ts` |
| `DTO` | `src/modules/raiox/index.ts` |
| `TDTO` | `src/modules/raiox/index.test.ts` |
| `TELA` | `src/modules/raiox/tela.tsx` |
| `TTELA` | `src/modules/raiox/tela.test.tsx` |

## Gates

| Gate | Resultado |
| --- | --- |
| `npm run test:unit` | **1247 testes / 0 falhas** |
| `npm run test:db` | **506 testes / 0 falhas** |
| `npx tsc --noEmit` | limpo |
| `npx eslint src scripts tests` | 0 erros; 2 warnings **pré-existentes** (`scripts/jobs/grupo3-classificacao.mts:396`, `scripts/jobs/importar-questoes-json.test.ts:11`), nenhum em arquivo desta rodada |
| `npm run db:push` | as 3 migrations aplicadas no Supabase de desenvolvimento |

O verificador independente rodou os seus próprios gates e chegou aos mesmos números no recorte que
executou (60 testes de banco no bloco M4/M5, 74 de unidade, `tsc` limpo, mesmos 2 warnings).

## Acceptance Criteria — RAIOX-16 (peso em dois níveis)

| AC | Veredito | Evidência |
| --- | --- | --- |
| AC1 — `peso = peso_oficial(matéria) × share(assunto\|matéria)` | OK | `RECALC:547` · `T39:208`, `T39:430` |
| AC2 — peso oficial da grade ou do edital, nunca da contagem | OK | grade `RECALC:304`; edital `RECALC:329`; sobra para a não declarada `RECALC:354` · `LASTRO:24`, `LASTRO:159` · `T39:208` (zerar etiquetas não muda o peso), `T39:430` (só edital), `T39:480` (edital com prova própria), `T39:546` (a sobra) |
| AC3 — share só de item real, amortecido contra a média **da matéria**, soma 1 | OK | `RECALC:501` (`1/m.a_m`), `RECALC:515` (normalização) · `T39:261` (0,83333/0,16667 exatos e soma 1) |
| AC4 — matéria sem item: partes iguais + `amostra_baixa` | OK | `RECALC:501` com `n_m = 0`; `RECALC:564` · `T39:208` |
| AC5 — porteiro do edital zera antes de multiplicar | OK | `RECALC:276` — o join com `tmp39_programa` **define o conjunto**; `a_m` também sai dele · `T39:308` |

O verificador tinha marcado o AC2 como **PARCIAL** (Achado 1, Major). Corrigido nesta rodada — ver
§Achados.

## Acceptance Criteria — RAIOX-17 (a prova é a unidade)

| AC | Veredito | Evidência |
| --- | --- | --- |
| AC1 — taxa por prova, média ponderada pelo decaimento, sem denominador único | OK | `RECALC:446` (share dentro da prova), `RECALC:465` (média ponderada), `RECALC:304` (nível 1 pela média) · `T39:30` (40 × 15 pesam igual), `T39:350` (a média não é a soma) |
| AC2 — prova abaixo do piso fica fora e entra na lista de pendentes | OK | `RECALC:230` · `LASTRO:280` · `T39:85` |
| AC3 — caderno irmão conta uma vez | OK | a fonte é `provas_medidas`, com o `distinct on` da SPEC 38 · `T39:136` |
| AC4 — a linha persiste quantas provas e quais anos | OK | `LASTRO:235`/`242` · `RECALC:432` (o degrau 2 sustentado pela grade cita as provas que **declararam** a matéria) · `T39:30`, `T39:602` |
| AC5 — idempotente e sem ler `tentativas` | OK | `T39:869` (apagar e recalcular devolve `toEqual`), `T39:927` · `TREC:169` |

O AC4 estava **PARCIAL** no relatório do verificador (Achado 2, Minor). Corrigido — ver §Achados.

## Acceptance Criteria — RAIOX-18 (degraus de lastro)

| AC | Veredito | Evidência |
| --- | --- | --- |
| AC1 — degrau 1–4 por linha | OK | `RECALC:404` · `LASTRO:235`/`242` (CHECK 1–4) · `T39:30` (1), `T39:430` (2), `T39:639` (3), `T39:703` (4) |
| AC2 — degrau 3 transfere só o desenho; sem documento próprio cai para 4 | OK | `RECALC:407`, `RECALC:501` (`n_ef = n_m × peso_degrau_3`) · `T39:639` (peso da matéria segue 0,6), `T39:703` |
| AC3 — a tela exibe degrau e lastro em texto | OK | `DTO:58`, `DTO:229`, `DTO:526` · `TELA:51`, `TELA:337` · `TDTO:500`, `TTELA:112` |
| AC4 — degrau 2/3/4 apresenta no nível da matéria, sem percentual por assunto | OK | `DTO:40` · `TELA:308`, `TELA:372` · `TDTO:516`, `TTELA:119` (assere `not.toContain` com a matéria **aberta**) |
| AC5 — degraus diferentes coexistem | OK | o degrau é por linha (`RECALC:404`) · `T39:774`, `TTELA:149` |

Ressalva do verificador, aceita e declarada: o degrau **2** cobre também "há prova própria, mas a
matéria não tem nenhum item", que o texto do AC descreve como "grade do edital sem provas". A regra
está em `design.md` §2.4 e o lastro dessa linha agora cita a prova e o ano que a sustentam (`T39:602`).

## Success Criteria da spec

| # | Critério | Veredito | Evidência |
| --- | --- | --- | --- |
| 1 | 40 itens de uma prova e 15 de outra do mesmo ano pesam igual | OK | `T39:30` — 0,41666667, contra 0,45454545 da conta antiga |
| 2 | Zerar a matéria não muda o peso dela; assuntos em partes iguais, rotulados | OK | `T39:208` |
| 3 | Centenas de inéditas não movem nenhuma linha | OK | `T39:809`. O verificador reforçou por auditoria: `recalcula_raiox` **não referencia `questoes`**, então `origem='gerada_ia'` é estruturalmente incapaz de mover linha |
| 4 | Concurso só com edital: peso por matéria, degrau 2, sem percentual por assunto | OK | `T39:430` (dado) + `TTELA:119` (tela) |
| 5 | Degrau 3 muda o desenho de dentro e não o peso da matéria | OK | `T39:639` |
| 6 | Apagar a projeção e recalcular devolve os mesmos números | OK | `T39:869` — `toEqual` em tópicos **e** matérias |
| 7 | Nenhuma consulta do Raio-X toca `tentativas` | OK | `T39:927` + auditoria independente de `recalcula_raiox`, `registrar_grade_declarada`, `registrar_peso_do_edital`, `vincular_bloco_a_materia` e das views `prova_bloco_materia`, `provas_pendentes_de_ingestao`, `provas_medidas`, `cobertura_da_prova`, `raiox_peso_topico` |
| 8 | Sensor de mutação: média da matéria → média geral fica vermelho | OK | mutação **M1** abaixo |

## Sensor de mutação

Cada mutação troca **uma** decisão da fórmula por uma alternativa plausível, aplica a função mutada no
banco de desenvolvimento (`create or replace function`), roda `T39` + `TREC` e restaura a função
original antes da próxima. O script foi descartado ao fim da rodada; as trocas abaixo são exatas e
reproduzem o experimento.

| # | Decisão mutada | Troca | Resultado |
| --- | --- | --- | --- |
| M1 | A âncora do amortecimento | `1::numeric / m.a_m` → `1::numeric / (select count(*) from pg_temp.tmp39_programa)` | **morta** — 2 vermelhos |
| M2 | O peso oficial volta a ser contagem bruta | `sum(b.peso) / nullif(total.peso, 0)` → `sum(b.peso)` | **morta** — 11 vermelhos |
| M3 | Share por prova vira share sobre todas as provas | `over (partition by p.materia_id, p.prova_id)` → `over (partition by p.materia_id)` | **morta** — 1 vermelho |
| M4 | O piso de cobertura para de filtrar | `pm.cobertura >= v_piso_cobertura` → `pm.cobertura >= 0` | **morta** — 1 vermelho |
| M5 | O porteiro sai de antes da multiplicação | join com `tmp39_programa` → join com `topicos` inteiro | **morta** — 1 vermelho |
| M6 | Distribuição emprestada vale como própria | `when fonte = 'vizinha' then 3` → `then 1` | **morta** — 1 vermelho |
| M7 | O sentinela volta a filtrar o cargo | `nullif(v_perfil.concurso_cargo, 'indefinido')` → `v_perfil.concurso_cargo` | **morta** — 1 vermelho |
| M8 | A prova própria volta a descartar o edital inteiro | `if v_tem_edital then` → `if v_tem_edital and not v_tem_propria then` | **morta** — 2 vermelhos |
| M9 | O degrau 2 da grade volta a não citar prova nem ano | `and m.base_do_peso in ('pontos', 'itens');` → `in ('nunca');` | **morta** — 1 vermelho |

**9 mutações injetadas, 9 killed, 0 survived.**

Duas delas (**M3** e **M5**) **sobreviveram na primeira passada** e só morreram depois de dois testes
novos: `T39:350` (duas provas do mesmo ano com distribuições opostas, onde a média por prova dá 0,5 e o
denominador único daria 0,68) e a asserção de `amostra_baixa` em `T39:308` (com o porteiro depois da
multiplicação, `n_m` sobe de 5 para 10 e apaga o rótulo). Isso fica registrado porque é o valor inteiro
do sensor: sem ele, dois testes teriam passado sem provar nada.

## Achados

### Blocker 1 — o sentinela `cargo = 'indefinido'` (encontrado pelo autor) · **corrigido**

O concurso nº 1 foi criado pela migração da SPEC 37 com `cargo = 'indefinido'`, que é o default da
coluna e não o nome de um cargo — mesmo papel de `banca = 'indefinida'`. Filtrando por igualdade
exata, o concurso vigente ficaria sem nenhuma prova própria: todas as linhas em degrau 4, `peso = 0`,
`raiox_peso_topico` vazia e o plano do dia sem tópico.

Correção em `RECALC:194`, teste em `T39:731`, mutação **M7**.

### Blocker 2 — "sem dado" virando "peso zero" na fronteira do M4 (encontrado pelo autor) · **corrigido**

Ensaio da fórmula nova contra o **acervo real**, dentro de uma transação revertida: as 28 provas
catalogadas estão todas em `grade_status = 'ausente'` e não existe uma única etiqueta de item. A
projeção sai correta — 85 linhas em degrau 4, sem peso, porque não há documento medido — mas
`raiox_peso_topico` passava de **85 tópicos para 0**, e o plano do dia ficaria sem nada para ordenar.
O job agendado das 05:30 faria isso em produção na mesma noite.

Correção em `FRONT`: a view (e `raiox_peso_do_aluno`) ganham um terceiro caso, irmão do fallback que já
existia para "sem perfil ativo" — projeção inteira sem lastro entrega o **programa do edital uniforme**,
com o porteiro intacto. O fallback se desliga sozinho na primeira prova medida. Testes em `T39:958`,
`T39:995` e `T39:1027`; ensaio repetido depois da correção devolve os 85 tópicos.

### Major 1 — o edital descartado por completo na presença de qualquer prova própria (verificador) · **corrigido**

`if v_tem_propria then … elsif v_concurso is not null then …`: as duas fontes do nível 1 eram
mutuamente exclusivas **no perfil inteiro**, não por matéria. Entrada reproduzida pelo verificador
contra o banco: edital declarando A=50 e B=50 e uma prova própria cuja grade só tem bloco de A →
`A = 1,00 (degrau 1)` e `B = 0,00 (degrau 4, sem_dado)`. O peso de A inflava de 50% para 100% e a
matéria B sumia do plano do dia, com o documento oficial do próprio concurso declarando 50%.

Correção: **o edital manda na matéria que ele nomeia** — ele fala do concurso que vem, a grade fala do
que passou; as matérias que o edital não nomeia dividem o que sobra na proporção da grade
(`RECALC:329`, `RECALC:354`; regra em `design.md` §3.2). Testes em `T39:480` (50/50 exatos, com o
desenho interno de A ainda vindo da prova própria) e `T39:546` (a sobra volta para quem foi medido).
Mutação **M8**.

### Minor 2 — degrau declarado sem o lastro que o sustenta (verificador) · **corrigido**

`n_provas`/`anos` só eram preenchidos a partir das provas que deram **item**. Uma matéria em degrau 2
sustentada pela grade de uma prova de 2025 gravava `n_provas = 0, anos = {}`, e o texto que chegava ao
aluno dizia "Peso declarado pela grade da prova" sem citar prova nem ano. Correção em `RECALC:432`,
teste em `T39:602`, mutação **M9**.

### Minor 3 — `lastroEmTexto` sem acentuação (verificador) · **corrigido**

Era a única string de UI do módulo sem acento. `DTO:58-78` e os testes que congelavam o texto.

### Minor 4 e 5 — mudanças de significado não registradas (verificador) · **documentadas**

`raiox_projecoes_materia.taxa_bruta` virou cópia de `peso` (no grão da matéria não existe "antes do
amortecimento": o peso oficial vem do documento e não é amortecido), e `amostra_baixa` do assunto passou
a ser um rótulo **da matéria**. Ambas agora estão na tabela de `design.md` §3.4.

### Minor 6 — `tasks.md` T6 descrevia função, a implementação é view · **corrigido**

### Minor 7 — `STATE.md` §Handoff ainda descrevia a SPEC 38 · **corrigido** na T12

### O que o verificador procurou e não encontrou

- **Teste que passa sem provar nada**: nenhum. As asserções críticas são números exatos que
  discriminam a fórmula revogada da nova (0,41666667 × 0,45454545; 0,5 × 0,68; 0,54166667 do degrau 3).
- **Soma dos `share` dentro da matéria ≠ 1**: nenhum caminho. Verificado empiricamente em 4 cenários.
- **`peso` fora de [0,1] ou violação de CHECK**: impossível — `peso_oficial` é média ponderada de
  frações que somam ≤ 1 por prova, `share_norm ∈ [0,1]`, e ainda há `least(…, 1)` e `coalesce(…, 0)`.
- **Inédita movendo linha**: estruturalmente impossível — nenhuma consulta nova lê `questoes`.
- **Concorrência/idempotência**: `pg_try_advisory_xact_lock(8406,3)`; as 7 temporárias são
  `on commit drop` e **todas** aparecem no `truncate` de início de iteração; DELETE+INSERT por perfil;
  `concursos.perfil_concurso_id` é UNIQUE, então o `left join` do laço não duplica perfil.
- **Bloco sem matéria resolvida**: testado (18 itens de A + 2 sem bloco resolvido) → `peso = 0,9`, soma
  abaixo de 1, exatamente como `design.md` §3.1 declara.

## Mudanças de contrato registradas

| O que | Antes | Agora | Onde está dito |
| --- | --- | --- | --- |
| `raiox_projecoes.n_questoes` | questões reais publicadas do tópico | **itens etiquetados** do assunto | `LASTRO` (`comment on column`) · AD-142 (e) |
| `taxa_bruta` (assunto) | participação da questão no acervo | `peso_oficial × share_bruto`, antes do amortecimento | `design.md` §3.4 |
| `taxa_bruta` (matéria) | taxa antes do amortecimento | cópia de `peso` | `design.md` §3.4 |
| `amostra_baixa` | `n_questoes < piso`, por assunto | `n_m < piso` **ou** degrau ≥ 2 — rótulo da matéria | `design.md` §3.4 · `RECALC:564` |
| `raiox_peso_topico` | 2 casos (sem perfil → 1.0; com perfil → projeção) | 3 casos: o terceiro é projeção inteira sem lastro → programa uniforme | `FRONT` · AD-143 |
| `programa_edital` com UUID órfão | derrubava o job na FK | não vira linha; o job não cai | `TREC:169` · AD-142 (e) |
| Rótulos da tela | "questões reais" | "itens medidos" | `TELA` · `TTELA:95` |

O que **não** mudou, e está provado: a assinatura de `raiox_peso_topico` continua `(topico_id, peso)`
(`T39:944`), o motor do M4 não foi tocado, e nenhum caminho novo lê `tentativas`.

## Limites desta rodada

- **`param.m5.peso_degrau_3` = 0,5 é palpite registrado**, não calibração. Só há como calibrá-lo quando
  existir um concurso vivendo de degrau 3 (AD-142).
- **`param.m1.cobertura_minima` = 0,9** segue sem medição, dívida herdada da SPEC 38.
- **Nenhuma prova real foi medida contra a fórmula nova.** Todos os números de teste vêm de fixtures.
  O único contato com dado real foi o ensaio revertido que produziu o Blocker 2: hoje o acervo tem 28
  provas sem grade lida e zero etiquetas, e é exatamente por isso que o fallback da `FRONT` precisa
  existir antes de a SPEC 40 abrir o primeiro concurso de verdade.
- **O vínculo bloco → matéria canônica e o peso do edital não têm tela.** A via automática (moda das
  etiquetas) cobre a prova já etiquetada; a via explícita (`prova_blocos.materia_id`) e o
  `concurso_peso_materia` dependem da SPEC 40 para ter operador — e é lá que o quadro do edital tem de
  ser exigido inteiro, porque declarar metade das matérias é declarar que a outra metade não cai.
