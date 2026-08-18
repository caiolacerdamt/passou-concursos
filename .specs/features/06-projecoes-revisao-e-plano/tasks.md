# SPEC 06 — Projeções, revisão espaçada e plano do dia · Tasks

**Spec**: `.specs/features/06-projecoes-revisao-e-plano/spec.md` · **Ritual**: **B**
(design embutido aqui, sem `design.md` próprio; Verificador independente curto no fim deste arquivo)
**Branch**: `feat/m4-p1-projecoes-plano` · **Numeração**: T48…T53 (continua a SPEC 05, que fechou em T47)

Gate de toda task com SQL: `npm test`. Gate de task só de TypeScript: `npm run test:unit`.
Fim da spec: `npm run build && npm run lint && npm test`.
Um commit atômico por task. Teste de banco roda em transação revertida.

**Estimativa do ROADMAP: ~10 tasks. Saíram 6** — as tabelas das camadas 2 e 3 cabem em duas
migrações, não em seis, e T22 (frase do plano) já tinha saído para a SPEC 08.

---

## Design (embutido — Ritual B)

O material de origem é `.specs/modulos/m4-coluna-vertebral/design.md` (§Projeções, §Plano,
§`perfil_estudo`, §`recalcula_projecoes()`, §`gera_plano_do_dia()`, §`agendarRevisao`, §Contrato com
o M5, §Fluxos/Madrugada). Ele **continua valendo** e não é refeito. O que segue é só o que esta
rodada acrescenta ou decide por cima dele.

### As três camadas, e quem escreve em cada uma

| Camada | Tabelas | Quem escreve |
| --- | --- | --- |
| 1 — fato cru (SPEC 05) | `tentativas`, `sessoes`, `sessao_itens`, `tentativa_causa_simulado` | o aluno, por `registrar_tentativa` |
| 2 — projeção | `dominio_topico`, `caderno_erros`, `revisao_agenda`, `revisao_evento` | job (`recalcula_projecoes`) e a requisição que fecha um bloco Revisar |
| 3 — plano | `perfil_estudo`, `plano_dia`, `plano_bloco` | o aluno (só `perfil_estudo`) e o job (`gera_plano_do_dia`) |

Apagar a camada 2 e a 3 inteiras e rodar os dois jobs devolve os mesmos números. É o critério do
ALUNO-02 AC1 e o primeiro Success Criteria da spec.

### Decisões que esta rodada toma

**(a) O FSRS roda sem passos de curto prazo (`enable_short_term: false`) — vira AD-092.**
Medido nesta rodada com `ts-fsrs@5.4.1`: com o default da biblioteca, um cartão novo avaliado `Good`
volta a vencer **10 minutos depois**, porque o FSRS foi desenhado para item de flashcard e usa passos
de aprendizado em minutos. Aqui a unidade é **tópico** e o aluno vê o tópico no máximo uma vez por
dia — um `due` de 10 minutos faria todo tópico recém-revisado nascer "devendo revisão" no mesmo dia,
e o motor de prioridade nunca sairia do lugar. Com `enable_short_term: false` os intervalos do
primeiro dia saem em dias (`Again` 1 · `Hard` 2 · `Good` 3 · `Easy` 8), que é a escala da unidade.
Continua sendo FSRS com os 21 pesos padrão (AD-072) — o que se desliga é o passo de minutos, não o
algoritmo.

**(b) `regua_passo` entra em `revisao_agenda`.** O design não previu onde a régua fixa guarda em que
degrau de 1/3/7/14/30 o tópico está. Derivar de `revisao_evento` daria o número errado depois de uma
nota 1 (que volta ao começo). Coluna própria, escrita só pela régua, ignorada pelo FSRS — e o `due`
continua sendo **a mesma coluna** nos dois algoritmos, que é o que o ALUNO-09 AC4 exige.

**(c) A conta do FSRS fica em TypeScript; a gravação fica numa função SQL.** `agendarRevisao` lê a
agenda, calcula em TS e chama `public.registrar_revisao(...)`, que faz o `upsert` na agenda e o
`insert` no evento **numa transação só**. É o mesmo motivo de `registrar_tentativa` na SPEC 05: duas
escritas que podem divergir não podem ser duas idas ao banco.

**(d) O caderno de erros inclui a causa do simulado.** `tentativa_causa_simulado` é onde a causa do
simulado vive (ALUNO-04 AC3). Um caderno que só lesse `tentativas.causa_erro` perderia todo erro de
simulado. A projeção lê os dois e soma — e é por isso que `faltou_tempo` aparece no caderno.

**(e) Recalcular apaga e reconstrói dentro da própria função.** Sem `on conflict`: `delete` + `insert`
do escopo recalculado, tudo numa chamada. Como função plpgsql é atômica, falha no meio faz rollback e
os números **anteriores** continuam de pé — "defasado, não corrompido" (ALUNO-02 AC4) é consequência
da atomicidade, não de tratamento de erro.

**(f) `sessoes.plano_dia_id` entra aqui.** A SPEC 05 deixou a coluna de fora de propósito porque
`plano_dia` é desta spec (Handoff do `STATE.md`).

**(g) A poda de `cron.job_run_details` entra aqui.** A SPEC 03 registrou que a poda entra junto do
primeiro job de verdade. Este é o primeiro.

### Nota do tópico (ALUNO-07 AC2)

```
nota = peso_raiox × fraqueza × devendo_revisao
```

- `peso_raiox` — da view `raiox_peso_topico`. Devolve `1.0` até a SPEC 11 trocar o corpo dela.
- `fraqueza` — `1 - dominio_topico.score`. Sem linha na projeção (retrato frio), vem da semente do
  `nivel_declarado`, em configuração (`param.m4.fraqueza_por_nivel`).
- `devendo_revisao` — `param.m4.peso_devendo_revisao` quando `revisao_agenda.due <= hoje`; `1.0` caso
  contrário.

Tópico **sem questão publicada** é excluído antes da ordenação (edge case do acervo frio): o motor só
considera tópico com pelo menos uma questão `status = 'publicada' and not anulada and vigente`.

### Os dois níveis (ALUNO-11)

| Nível | O que contém |
| --- | --- |
| `piso` | **só** os blocos `revisar` dos tópicos com revisão vencida. É o que mantém a sequência. |
| `meta_cheia` | os mesmos blocos `revisar`, mais `avancar` (tópico de maior nota sem revisão vencida) e `treinar` (misto), somando `minutos_estimados` **até caber** em `perfil_estudo.minutos_por_dia` |

Aluno sem revisão vencida nenhuma tem `piso` **vazio** e `meta_cheia` com Avançar e Treinar — é o
plano do primeiro dia, e é por isso que os dois níveis são distintos por construção.
`minutos_estimados` de um bloco = `param.m4.questoes_por_bloco × param.m4.minutos_por_questao`.

### Chaves de configuração novas

Todas com `moduloDono: 'm4'`, default `[provisório]` como as outras (AD-078 exige default declarado
em código; calibram sem deploy).

| Chave | Default | Para quê |
| --- | --- | --- |
| `param.m4.questoes_por_bloco` | `10` | tamanho de um bloco do plano |
| `param.m4.fraqueza_por_nivel` | `{"iniciante":0.9,"intermediario":0.6,"avancado":0.35}` | semente do retrato frio |
| `param.m4.fsrs_passos_curtos` | `false` | AD-092 — passo de minutos do FSRS, desligado |
| `param.m4.regua_fixa_dias` | `[1,3,7,14,30]` | a régua do plano B, sem número solto em código |
| `param.m4.retencao_historico_cron_dias` | `30` | poda de `cron.job_run_details` |

### O que esta spec NÃO faz

Frase de IA (SPEC 08) · peso real do Raio-X (SPEC 11) · `computeParameters` (fast-follow) ·
diagnóstico adaptativo (SPEC 13) · qualquer tela · anel e sequência (SPEC 19) · bloco de simulado
ligado (SPEC 32 — a flag nasce desligada e a função respeita).

---

## Ordem

```
T48 → T49 ─┐
  └→ T50   ├→ T51 → T52 → T53
```

T50 depende só de T48 (as tabelas da agenda); T51 depende de T49 e T50 estarem no lugar para o motor
ter o que ler.

---

### T48 — Tabelas de projeção e agenda de revisão

**Onde**: `supabase/migrations/<ts>_projecoes.sql`, `tests/db/projecoes-schema.test.ts`
**Requisito**: ALUNO-02 AC1 · ALUNO-09 AC1/AC4 · ALUNO-10 AC1 · AD-044

- [ ] `dominio_topico`, `caderno_erros`, `revisao_agenda` (+ `regua_passo`), `revisao_evento` com as
      PKs do design; FK de `topico_id` para `topicos`
- [ ] `revisao_agenda.algoritmo` aceita só `'fsrs'`/`'regua_fixa'`; `due` é a **mesma coluna** nos dois
- [ ] `revisao_evento` append-only pela trava do AD-084 (revoke + gatilho de linha + gatilho de
      TRUNCATE), com a porta nomeada do esquecimento (AD-029)
- [ ] RLS nas quatro: o aluno lê só o próprio; nenhuma policy de escrita (quem escreve é o job)
- [ ] Teste: `revisao_evento` recusa UPDATE e DELETE, e aceita DELETE pela porta do esquecimento
- [ ] Teste: `nota` fora de 1–4 é recusada; `percentual` e `nota` convivem na mesma linha
- [ ] Teste: um aluno não enxerga a projeção do outro

**Commit**: `feat(m4): cria as tabelas de projecao e a agenda de revisao`

---

### T49 — `recalcula_projecoes()` — reconstruir tudo a partir do log

**Onde**: `supabase/migrations/<ts>_recalcula_projecoes.sql`, `tests/db/recalcula-projecoes.test.ts`
**Requisito**: ALUNO-02 AC1/AC3/AC4 · ALUNO-06 · ALUNO-10 AC1 — **Independent Test da spec**

- [ ] Função `security definer`, `search_path` vazio, `pg_try_advisory_xact_lock`; devolve `-1` quando
      outro recalculo já está rodando, sem erro
- [ ] `dominio_topico`: `score = (n_acertos - n_chute_certo) / n_respostas`, nunca negativo
- [ ] Questão `anulada` não entra na conta (AC3); acerto com `marcou_chute` é descontado (AC3)
- [ ] `caderno_erros` agrupa por tópico **e** causa, somando `tentativas` e `tentativa_causa_simulado`
- [ ] Teste do AC1: apagar as duas projeções, rodar e obter **os mesmos números**
- [ ] Teste: rodar duas vezes seguidas não muda nada (AC4)
- [ ] Teste: falha no meio deixa a projeção anterior intacta (AC4)

**Commit**: `feat(m4): recalcula as projecoes a partir do log`

---

### T50 — `agendarRevisao` — FSRS com régua fixa como plano B

**Onde**: `src/modules/aluno/revisao/{contrato,agendar,index}.ts`,
`src/modules/aluno/revisao/agendar.test.ts`, `supabase/migrations/<ts>_registrar_revisao.sql`,
`tests/db/agendar-revisao.test.ts` · **Requisito**: ALUNO-09 AC1/AC2/AC3/AC4 · AD-072 · **AD-092**

- [ ] `ts-fsrs` na dependência; `fsrs({ enable_short_term: false })` (AD-092)
- [ ] `param.m4.fsrs_faixas_nota` converte percentual em `Rating` 1–4; bordas testadas
- [ ] `registrar_revisao(...)`: `upsert` na agenda + `insert` no evento numa transação só
- [ ] Teste do AC1: aluno **sem histórico nenhum** recebe intervalo do FSRS, em dias, não a régua
- [ ] Teste do AC4: com `param.m4.algoritmo_revisao = 'regua_fixa'` a data sai de 1/3/7/14/30 na
      **mesma coluna `due`**, e o agendamento que já existia continua lá
- [ ] Teste: nada além de `due` sai do módulo (AC3)

**Commit**: `feat(m4): agenda revisao por fsrs com regua fixa como plano b`

---

### T51 — Perfil de estudo, plano e a view stub do Raio-X

**Onde**: `supabase/migrations/<ts>_plano.sql`, `tests/db/plano-schema.test.ts`
**Requisito**: ALUNO-05 AC1 · ALUNO-11 · AD-044 · AD-056/AD-057 (assinatura da view)

- [ ] `perfil_estudo` com `nivel_declarado` restrito aos três valores e `minutos_por_dia not null`
- [ ] `plano_dia` com `unique (user_id, data)` e `frase` **anulável**
- [ ] `plano_bloco` com `nivel ∈ {piso, meta_cheia}`, `ordem`, `motivo`, `unique (plano_dia_id, nivel, ordem)`
- [ ] `sessoes.plano_dia_id` (a coluna que a SPEC 05 deixou para cá)
- [ ] View `raiox_peso_topico` devolvendo `1.0`, com comentário dizendo que a SPEC 11 troca o corpo
      **mantendo a assinatura**
- [ ] RLS: o aluno escreve o próprio `perfil_estudo` e só **lê** plano e blocos
- [ ] Teste: `frase` nula é aceita (ALUNO-05 AC4 / ALUNO-12)

**Commit**: `feat(m4): cria perfil de estudo, plano do dia e o stub do raio-x`

---

### T52 — `gera_plano_do_dia()` — o motor de prioridade

**Onde**: `supabase/migrations/<ts>_gera_plano_do_dia.sql`, `tests/db/gera-plano.test.ts`
**Requisito**: ALUNO-07 · ALUNO-08 · ALUNO-11 — **Independent Test da spec**

- [ ] Nota = `peso_raiox × fraqueza × devendo_revisao`, sem uma linha de IA (invariante nº6)
- [ ] `piso` só com as revisões devidas; `meta_cheia` cabendo em `minutos_por_dia`
- [ ] `motivo` preenchido no bloco `revisar` (ALUNO-08 AC5)
- [ ] Tópico sem questão publicada é pulado; o motor pega o próximo de maior nota
- [ ] Retrato frio (só `nivel_declarado`) gera plano do 1º dia
- [ ] Rerodar no mesmo dia **substitui** o plano, não duplica
- [ ] Bloco `simulado` não sai enquanto `flag.m4.simulado_semanal` estiver desligada

**Commit**: `feat(m4): gera o plano do dia por regra`

---

### T53 — Os dois jobs no `pg_cron` e a poda do histórico

**Onde**: `supabase/migrations/<ts>_cron_m4.sql`, `tests/db/cron-m4.test.ts`
**Requisito**: ALUNO-02 AC2 · ALUNO-07 AC1 · INFRA-03

- [ ] `recalcula_projecoes()` às 06:00 UTC e `gera_plano_do_dia()` às 06:30 UTC (03:00/03:30 BRT)
- [ ] Poda diária de `cron.job_run_details` por `param.m4.retencao_historico_cron_dias`
      (dívida deixada pela SPEC 03)
- [ ] Teste: os três jobs existem, ativos, nos horários e com o comando esperado
- [ ] Teste: chamar o recalculo com o lock já tomado devolve `-1` e não levanta erro

**Commit**: `feat(m4): agenda os jobs de projecao e de plano no pg_cron`

---

## Relatório do Verificador independente (Ritual B)

**Veredito global: FAIL.** Os 6 Success Criteria da spec passam, com evidência. O FAIL vem de dois
defeitos fora da lista mas dentro do que a spec toca: uma **falha de autorização** em
`registrar_revisao` (qualquer aluno autenticado escreve a agenda e o log append-only de outro) e a
**semente do retrato frio invertida** no motor de prioridade (ALUNO-07 AC2). Nenhum dos dois é pego
por teste.

**Faixa verificada**: `main` = `653a8fb692743fe901abe2ac03715039f9f5c222` …
`feat/m4-p1-projecoes-plano` = `f261589631f5659c396ff3c83670d64b2040edce`
**Gate**: `npm test` → 45 arquivos, 407 testes, 0 falha (rodado pelo verificador).

### Success Criteria

| Success Criteria | Veredito | Evidência | Observação |
| --- | --- | --- | --- |
| Apagar as duas projeções, rodar a função e obter os mesmos números | **PASS** | `tests/db/recalcula-projecoes.test.ts:73` · `supabase/migrations/20260817131000_recalcula_projecoes.sql:44` | O teste compara domínio **e** caderno, não só um dos dois. Prova de fato o AC1. |
| Rodar duas vezes seguidas não muda nada; falha no meio deixa defasado, não corrompido | **PASS** | `tests/db/recalcula-projecoes.test.ts:115` (idempotência) e `tests/db/recalcula-projecoes.test.ts:281` (sabotagem por `check ... not valid`) | A sabotagem quebra a **segunda** metade da função depois de a primeira já ter escrito — é o único jeito de testar a atomicidade sem mock. Não é tautológico. |
| Aluno novo, sem histórico, já recebe intervalo do FSRS (não a régua) | **PASS** | `tests/db/agendar-revisao.test.ts:80` · `src/modules/aluno/revisao/agendar.ts:126` | `dias >= 1` sozinho não separaria FSRS de régua (o 1º degrau da régua também é 1 dia); o que separa são `algoritmo = 'fsrs'` e o `fsrs_card` gravado com `stability`, ambos asseridos. |
| Trocar para `regua_fixa` não perde nenhum agendamento | **PASS** | `tests/db/agendar-revisao.test.ts:220` (troca de chave, `fsrs_card` preservado, 1 linha) e `tests/db/agendar-revisao.test.ts:170` (degraus `[1,3,7,14,30,30]`) | Quem sustenta a asserção é o `coalesce(excluded.fsrs_card, a.fsrs_card)` em `supabase/migrations/20260817132000_registrar_revisao.sql:52` — e a asserção é sobre o dado gravado, não sobre o setup. |
| Retrato frio (só `nivel_declarado`) ainda gera plano do 1º dia, com `piso` e `meta_cheia` distintos | **PASS (com ressalva)** | `tests/db/gera-plano.test.ts:335` (retrato frio gera plano) + `tests/db/gera-plano.test.ts:157` (`piso` vazio, `meta_cheia` não) | Os "dois níveis distintos" **no retrato frio** são provados por composição de dois testes; o teste do retrato frio em si só olha `blocos.length` e o tipo `avancar`, sem assertar `nivel`. Ver `G4`. |
| Rerodar no mesmo dia substitui o plano, não duplica | **PASS** | `tests/db/gera-plano.test.ts:369` (`toEqual` nos blocos + `count(plano_dia) = 1`) · `supabase/migrations/20260817134000_gera_plano_do_dia.sql:101` | Há também teste de que o plano novo zera `frase` (`tests/db/gera-plano.test.ts:390`), que é o que o invariante nº7 pede. |

### Invariantes do projeto tocados pela spec

| Invariante | Veredito | Evidência |
| --- | --- | --- |
| nº1 — `tentativas` só INSERT | **PASS** | Nada nesta spec escreve em `tentativas`; a spec só lê (`supabase/migrations/20260817131000_recalcula_projecoes.sql:74`). `revisao_evento` recebe a mesma trava de 3 camadas (`supabase/migrations/20260817130000_projecoes.sql:186`), testada em `tests/db/projecoes-schema.test.ts:213`, `:242` e `:275`. |
| nº2 — snapshot congelado | **PASS** | A projeção agrupa por `t.topico_id` (o do log), nunca por `questoes.topico_id` — `supabase/migrations/20260817131000_recalcula_projecoes.sql:81`. |
| nº6 — plano é regra/SQL | **PASS** | `gera_plano_do_dia` é plpgsql puro, sem chamada externa — `supabase/migrations/20260817134000_gera_plano_do_dia.sql:33`. |
| nº7 — pré-computa primeiro | **PASS** | `plano_dia.frase` anulável (`supabase/migrations/20260817133000_plano.sql:57`), testado em `tests/db/plano-schema.test.ts:96`. |
| Escrita da projeção só pelo job / RLS | **FAIL** | `supabase/migrations/20260817132000_registrar_revisao.sql:67` — ver `G1`. |

### Gaps

**G1 — `Major` — `registrar_revisao` deixa um aluno escrever a agenda e o log de outro.**
`supabase/migrations/20260817132000_registrar_revisao.sql:29` a `:67`: a função é `security definer`,
tem `grant execute ... to authenticated`, recebe `p_user_id` como parâmetro e **não confere nada**
contra `auth.uid()`. Verificado no banco de dev, em transação revertida: conectado como
`authenticated` com o JWT do aluno A, a chamada `registrar_revisao(<id do aluno B>, …)` retorna com
sucesso e grava `revisao_agenda` e `revisao_evento` no nome de B. Duas consequências: (a) A pode
adiar ou antecipar a revisão de B, o que altera o plano do dia de B; (b) A grava uma linha num log
**append-only** de B, que nem B nem o suporte conseguem apagar (o DELETE só passa pela porta do
esquecimento, AD-029). A SPEC 05 não tem esse buraco: `registrar_tentativa` amarra o `p_user_id` ao
dono da sessão (`supabase/migrations/20260817125000_registrar_tentativa.sql:51`, comentado em `:132`).
Aqui a defesa equivalente não existe.
**Como fechar**: ou `revoke execute ... from authenticated` — o único chamador hoje é
`clienteDeServico()` (`src/modules/aluno/revisao/agendar.ts:29`), que usa a service role — ou uma
guarda `if p_user_id <> (select auth.uid()) then raise exception` quando `auth.uid()` não é nulo,
mais um teste `comoAluno(A)` chamando com o id de B e esperando recusa.

**G2 — `Major` — a semente do retrato frio entra invertida na nota do tópico (ALUNO-07 AC2).**
`supabase/migrations/20260817134000_gera_plano_do_dia.sql:130`:
`(1 - coalesce(d.score, (v_fraqueza_nivel ->> ...)::numeric))`. O design desta própria rodada diz
(`tasks.md`, §"Nota do tópico"): "`fraqueza` — `1 - dominio_topico.score`. Sem linha na projeção
(retrato frio), **vem da semente** do `nivel_declarado`" — ou seja, a semente **é a fraqueza**, não um
score. O catálogo diz o mesmo: `src/modules/config/catalogo.ts:107` descreve
`param.m4.fraqueza_por_nivel` como "a **fraqueza** que vale enquanto o aluno não tem histórico".
Como está, a semente é tratada como score e a fraqueza do iniciante vira `1 - 0.9 = 0.1` (confirmado
no banco), a do avançado vira `0.65`. Duas inversões concretas: **o iniciante recebe a menor
prioridade possível nos tópicos que nunca viu**, e **o avançado recebe prioridade maior que o
iniciante** no mesmo tópico frio. Num aluno com histórico parcial, todo tópico já tocado
(`score < 0.9`) ganha de todo tópico virgem — o contrário do que o plano do 1º dia quer.
Nenhum teste pega: os testes de ordenação (`tests/db/gera-plano.test.ts:243` e `:265`) semeiam
`dominio_topico` nos **dois** tópicos comparados, e o teste do retrato frio (`:335`) só verifica que
existe bloco, não em que ordem.
**Como fechar**: `coalesce(1 - d.score, semente)` (ou equivalente) e um teste comparando um tópico
frio contra um tópico com `score = 0.5` para um `iniciante` — hoje o frio perde, e deveria ganhar.

**G3 — `Minor` — bloco `treinar` sai com um único `topico_id`, contra o que o próprio schema
documenta.** `supabase/migrations/20260817133000_plano.sql:79` comenta a coluna como "Nulo no bloco
`treinar`, que mistura assuntos de propósito (ALUNO-08 AC3)", e o ALUNO-08 AC3 define Treinar como
"questões de tipos/assuntos **misturados**". O motor insere `v_topico.topico_id` no bloco `treinar`
(`supabase/migrations/20260817134000_gera_plano_do_dia.sql:170`). O teste
`tests/db/plano-schema.test.ts:145` prova que a coluna **aceita** nulo — prova o schema, não o
comportamento do motor; nenhuma asserção cobre o que o motor de fato emite. Fechar: decidir (bloco
misto com `topico_id` nulo, ou corrigir o comentário e registrar que "misturado" fica para a SPEC 13)
e assertar a decisão escolhida.

**G4 — `Minor` — o Success Criteria do retrato frio é provado por composição, não por asserção
direta.** `tests/db/gera-plano.test.ts:335` não olha `nivel` nenhuma vez; quem prova "piso e
meta_cheia distintos" sem revisão vencida é outro teste (`tests/db/gera-plano.test.ts:157`). Fechar:
uma asserção de `nivel` dentro do próprio teste do retrato frio.

**G5 — `Minor` — "nada além de `due` sai do módulo (AC3)" foi prometido em T50 e não virou
asserção.** O contrato está bem desenhado no tipo (`src/modules/aluno/revisao/contrato.ts:44`) e na
assinatura da função SQL, mas nenhum teste verifica que `Card`, estabilidade e dificuldade não
atravessam a fronteira. É AC coberto por raciocínio, não por asserção. Fechar: assertar as chaves do
objeto devolvido por `agendarRevisao`.

**G6 — `Minor` — os defaults de configuração estão duplicados em SQL, sem trava contra deriva.**
`supabase/migrations/20260817134000_gera_plano_do_dia.sql:69` repete `1.5`, `10`, `2`, o JSON de
`fraqueza_por_nivel` e `false`; `supabase/migrations/20260817135000_cron_m4.sql:60` repete `30`. Os
mesmos valores vivem em `src/modules/config/catalogo.ts:74` em diante. Mudar o default de um lado não
quebra teste nenhum. Fechar: um teste comparando o default do catálogo com o fallback da função, ou
popular `configuracoes` na migração e tirar o literal do SQL.

**G7 — `Minor` — AD-092 é citada por código, migração e `tasks.md`, mas não existe em
`.specs/STATE.md`.** `grep AD-092 .specs/STATE.md` devolve 0 ocorrências, contra as citações do diff
(`src/modules/config/catalogo.ts:78`, `src/modules/aluno/revisao/agendar.ts:110`,
`supabase/migrations/20260817130000_projecoes.sql:1`, entre outras). Pela regra do projeto, decisão
nova é AD nova no `STATE.md`. Fechar no encerramento da rodada, junto do Handoff e da linha do
ROADMAP.

---

## Resposta do autor aos gaps (rodada de correção)

Migração `supabase/migrations/20260817136000_correcoes_do_verificador.sql`, commit próprio.

| Gap | Estado | O que foi feito |
| --- | --- | --- |
| **G1** `Major` | **fechado** | Guarda `auth.uid() is not null and <> p_user_id` em `registrar_revisao`. Mantido o `grant` a `authenticated` — a SPEC 13 chama pela sessão do aluno — e o caminho do job (`auth.uid()` nulo) continua aberto. Dois testes: aluno tentando gravar no nome de outro é recusado, e o job sem sessão continua passando. |
| **G2** `Major` | **fechado** | `coalesce(1 - d.score, semente)` no lugar de `1 - coalesce(d.score, semente)`. Teste novo compara **tópico virgem contra tópico com histórico**, que era o caso que faltava: iniciante prioriza o virgem, avançado prioriza o conhecido. |
| **G3** `Minor` | **fechado** | Decidido a favor do motor: cada bloco `treinar` nomeia um tópico, e a intercalação do ALUNO-08 AC3 acontece **entre** os blocos do dia. O comentário da coluna foi corrigido para descrever isso; `topico_id` segue anulável para o bloco `simulado`. |
| **G4** `Minor` | **fechado** | O teste novo do G2 assere `nivel = 'meta_cheia'` no próprio caso do retrato frio. |
| **G5** `Minor` | **fechado** | `src/modules/aluno/revisao/agendar.test.ts` assere as chaves exportadas por `index.ts` — `Card`, estabilidade e dificuldade não atravessam a fronteira. |
| **G6** `Minor` | **aberto, registrado** | Default de configuração duplicado entre catálogo e fallback SQL, sem trava contra deriva. Vale para toda função SQL que lê configuração, não só esta — a correção é transversal e entra na SPEC 15, junto da tela de configuração. Registrado como dívida no `STATE.md`. |
| **G7** `Minor` | **fechado** | AD-092 registrada no `.specs/STATE.md`. |

### Nota de método

**O sensor de mutação não rodou**, por ser **Ritual B** (AD-090): o escopo do verificador aqui é só
os Success Criteria, com evidência `file:line`. Nenhum código ou teste foi alterado por este
verificador; a única execução com escrita foi uma transação revertida no banco de dev, para
confirmar `G1` e `G2` no comportamento real.
