# SPEC 05 — Log de tentativas · Validação

**Veredito: PASS com dívida `Major` aberta.**

**Ritual A** (AD-090) — verificação AC por AC com sensor de mutação, feita por agente que não
escreveu o código. Regra aplicada: **evidência-ou-zero** — nenhum AC recebeu PASS sem `arquivo:linha`
que o prove.

| | |
| --- | --- |
| **Faixa de diff verificada** | `efe4a87..ok2422956` (branch `feat/m4-p1-log-tentativas`, 8 commits, T41–T47) |
| **Suíte na linha de base** | `npx vitest run` → **333 PASS / 0 FAIL** (unit 152 + db 181) |
| **Lint** | `npm run lint` → sem apontamento |
| **Banco** | projeto Supabase de desenvolvimento `kfpmetkmhjtmgwgaaerl`, Postgres 17.6, pg_partman 5.3.1, `public.tentativas` com 8 partições e 0 linhas |
| **Mutações** | 9 aplicadas, **9 mortas, 0 sobreviventes**; 2 planejadas não puderam ser aplicadas (ver §Não verificado) |
| **Estado do banco ao fim** | restaurado; suíte reexecutada em 333/333 depois da última restauração |

---

## 1. Checagem ancorada na spec — AC por AC

Fonte do texto dos AC: `.specs/modulos/m4-coluna-vertebral/spec.md` §P1 Log imutável (linhas 71–92) e
§P1 Causa do erro por auto-relato (linhas 96–120); `.specs/modulos/m9-infra/spec.md` §P1 `tentativas`
particionada e indexada (linhas 108–128).

### ALUNO-01 — Log imutável com snapshot congelado

| AC | O que a spec exige | Veredito | Evidência |
| --- | --- | --- | --- |
| **AC1** | Só INSERT; sem UPDATE nem DELETE-por-edição; DELETE-por-esquecimento por `user_id` permitido | **PASS** | Trava em 3 camadas: `supabase/migrations/20260817122000_tentativas_trava.sql:25` (revoke), `:69` (gatilho de linha), `:74` (gatilho de truncate). Endurecimento por partição: `20260817123000_tentativas_particao_endurecida.sql:46,51,60`. Provas: `tests/db/tentativas-trava.test.ts:30` (UPDATE recusado para `anon`, `authenticated` **e** `service_role`), `:59` (UPDATE direto na partição), `:74` (TRUNCATE no pai), `tests/db/tentativas-particao-endurecida.test.ts:69` (TRUNCATE direto na partição), `:81` (partição ilegível direto, legível pelo pai). Porta do esquecimento: `tentativas-trava.test.ts:141,153,167,200` |
| **AC2** | Snapshot com `materia`, `topico` (id **e** rótulo), `banca`, `tipo_questao`, `dificuldade`, `origem`, `questao_id`/`questao_versao`, `sessao_id`, `contexto`, `resposta_dada`/`correta`, `tempo_ms`, `marcou_chute`, `respondida_em` | **PASS** | Colunas: `20260817120000_tentativas.sql:57–142`. Existência das 17 colunas do AC: `tests/db/tentativas-schema.test.ts:121–150`. O snapshot **gravado** bate campo a campo com a questão lida no momento: `tests/db/registrar-tentativa.test.ts:49–75` (compara `materia_id`, `materia_rotulo`, `topico_id`, `topico_rotulo`, `banca`, `tipo_questao`, `dificuldade`, `origem`, `questao_id`, `questao_versao`, `sessao_id`). O valor afirmado vem da fixture (`tests/db/aluno.ts:66–77`), não de releitura da tabela — não é teste-espelho |
| **AC3** | Reclassificar a questão depois não desloca o histórico | **PASS** | `tests/db/tentativas-schema.test.ts:356–400`: grava, renomeia o tópico **e** o move para outra matéria, confirma que os 4 campos de snapshot ficaram intactos **e** (linha 394) que o presente mudou de verdade — o teste não passa por nada ter acontecido |
| **AC4** | `contexto ∈ {diagnostico, plano, treino, simulado, revisao}` | **PASS** | Enum: `20260817120000_tentativas.sql:34`. Prova de conteúdo exato: `tests/db/tentativas-schema.test.ts:61–75` (compara a lista literal, ordenada por `enumsortorder`); prova de fechamento: `:87–94` (valor fora do conjunto não existe) |
| **AC5** | Particionada por mês (INFRA-04) **e** recalculável do zero | **PARCIAL** | Particionamento provado: `tests/db/tentativas-schema.test.ts:98–118` (estratégia `r`, chave `RANGE (respondida_em)`, PK `(id, respondida_em)`) e `tests/db/tentativas-particao.test.ts:27–58`. **"Recalculável do zero" não tem asserção nenhuma** nesta spec — é propriedade das projeções, que são SPEC 06. Não é defeito do código; é AC que esta spec não fecha sozinha, e o `design.md` §Requirement Traceability afirma AC5 como coberto ("o log ser a única fonte"), o que é argumento, não evidência |

### ALUNO-03 — Causa do erro por auto-relato (o lado servidor)

| AC | O que a spec exige | Veredito | Evidência |
| --- | --- | --- | --- |
| **AC1** | Errou no treino → exigir a causa **antes de avançar**, gravando `causa_erro` + `causa_origem='aluno'` **no próprio INSERT** | **PARCIAL** | Gravação no próprio INSERT: `20260817125000_registrar_tentativa.sql:109,118,121`; provado em `tests/db/registrar-tentativa.test.ts:104–129` (`causa_erro='errei_a_conta'`, `causa_origem='aluno'`) e `:131–145` (resposta certa não carimba origem). Rede no banco: `CHECK causa_obrigatoria_no_treino` em `20260817120000_tentativas.sql:119`, provado em `tests/db/tentativas-schema.test.ts:239–252`. **A exigência "antes do INSERT, com mensagem própria" mora em `validarResposta` (`src/modules/aluno/tentativas/registrar.ts:124`), que `registrarTentativa` NÃO chama** (`:36` chama só `validar`). Ver gap **G1** |
| **AC2** | Lista visível = as 6 + "não sei dizer" | **PASS** | Enum: `20260817120000_tentativas.sql:45–48`; lista literal conferida em `tests/db/tentativas-schema.test.ts:42–58`. Lado do módulo: `src/modules/aluno/tentativas/contrato.ts:19–27`, conferido causa a causa em `src/modules/aluno/tentativas/registrar.test.ts:49–66` |
| **AC4** | `nao_sei_dizer` é resposta válida, não um pulo | **PASS** | Banco aceita: `tests/db/tentativas-schema.test.ts:254–268`. Módulo aceita sem tratamento especial: `registrar.test.ts:40–47`. E a mensagem de recusa **diz ao aluno** que "não sei" vale: `registrar.ts:127`, afirmado em `registrar.test.ts:36` |

### ALUNO-04 — Taxonomia enxuta e a causa do simulado

| AC | O que a spec exige | Veredito | Evidência |
| --- | --- | --- | --- |
| **AC2** | As 6 causas + "não sei dizer" | **PASS** | Mesma evidência do ALUNO-03 AC2. O teste do enum (`tentativas-schema.test.ts:42`) afirma os 8 valores **e a ordem**, que é o que o AD-043 fixa |
| **AC3** | Simulado coleta na revisão pós-prova, em **tabela vizinha**, SHALL NOT dar UPDATE na tentativa; `faltou_tempo` só neste contexto | **PASS** | Tabela vizinha: `20260817124000_sessoes.sql:75–93`, FK do par `(tentativa_id, respondida_em)` em `:86`. `faltou_tempo` recusado no fato: `CHECK faltou_tempo_so_no_simulado` em `20260817120000_tentativas.sql:131`, provado em `tests/db/tentativas-schema.test.ts:301–316`. Aceito na vizinha: `tests/db/sessoes.test.ts:121–141`. **A tentativa não é tocada**: `tests/db/sessoes.test.ts:143–172` compara a linha inteira (`select *`) antes e depois — asserção forte, não amostragem de coluna |

### INFRA-04 — `tentativas` particionada e indexada desde o dia 1

| AC | O que a spec exige | Veredito | Evidência |
| --- | --- | --- | --- |
| **AC1** | Particionada por mês via pg_partman (`RANGE` em `respondida_em`), com **uma partição futura pré-criada** | **PASS** | `20260817121000_tentativas_particao.sql:18–38` (`create_parent`, `p_interval := '1 month'`, `p_premake := 3`). Config lida do banco: `tests/db/tentativas-particao.test.ts:27–44`. Partições futuras: `:46–58` afirma mês corrente **e os 3 seguintes** — a spec pede uma, a implementação entrega três |
| **AC2** | Consulta por `user_id` + período usa pruning + índice; SHALL NOT varrer a tabela inteira | **PASS** (com ressalva de precisão) | `tests/db/tentativas-particao.test.ts:111–137`: com `enable_seqscan = off`, extrai do `EXPLAIN` os nomes de partição citados e afirma **exatamente uma**. É a asserção que importa e ela é honesta. A asserção auxiliar `expect(plano).not.toMatch(/Seq Scan/)` (linha 135) é quase tautológica com `enable_seqscan = off` ligado — não invalida o teste, mas não acrescenta nada. A partição *default* não aparece no plano, o que confirma a medição do design |
| **AC3** | Manutenção do pg_partman cria a partição nova **automaticamente antes de o mês virar** | **PARCIAL** | Job existe, está ativo, é diário e roda o partman **antes** do endurecimento: `20260817123000_tentativas_particao_endurecida.sql:95–102`, afirmado em `tests/db/tentativas-particao-endurecida.test.ts:194–217` (inclusive a ordem, por `indexOf`). **O que não há é prova de que a manutenção de fato cria partição** — nenhum teste chama `run_maintenance_proc()` e verifica o resultado, porque ela não roda em transação revertida. O `premake = 3` já entrega 3 meses de folga, então o risco prático é baixo, mas a evidência é do agendamento, não do efeito |
| **AC4** | Índices por `user_id`, por `sessao_id`, por `questao_id` desde a **primeira** migração | **PASS** | Os 4 índices na própria migração da tabela: `20260817120000_tentativas.sql:162,166,170,174` — "desde a primeira migração" se lê no arquivo, não em teste. Existência afirmada em `tests/db/tentativas-schema.test.ts:189–205` |

### Lacunas de precisão da spec (não são defeito do código)

1. **ALUNO-01 AC5** junta duas coisas de naturezas diferentes ("particionada" é schema, "recalculável do
   zero" é propriedade das projeções). Só a primeira metade é verificável nesta spec. A segunda deveria
   estar explicitamente adiada para a SPEC 06 no `Escopo`/`Out of Scope` da `spec.md` — não está.
2. **INFRA-04 AC3** diz "criá-la automaticamente antes de o mês virar", mas não diz *como se prova*.
   Como o `create_parent` e o `run_maintenance_proc` não rodam em transação revertida, o AC é, na
   prática, inverificável pela suíte atual. A spec deveria ter dito que a evidência aceita é o
   agendamento + o `premake`.
3. **ALUNO-03 AC1** diz "exigir a causa antes de avançar" sem nomear **onde** a exigência vive. Foi
   essa imprecisão que permitiu o gap G1 passar pela autoverificação do autor.
4. A `spec.md` §Success Criteria não cobre a RLS por aluno nem a leitura direta de partição, que são as
   duas coisas com maior consequência de segurança nesta spec. Os testes existem (`tentativas-trava.test.ts:250,267`,
   `tentativas-particao-endurecida.test.ts:81`) — o critério é que faltou.

---

## 2. Os 6 Success Criteria da `spec.md`

| # | Critério | Veredito | Evidência |
| --- | --- | --- | --- |
| 1 | UPDATE recusado inclusive para o papel de serviço; TRUNCATE recusado | **PASS** | `tests/db/tentativas-trava.test.ts:48–55` (service_role, recusa vem do gatilho e não de privilégio) e `:85–93` (TRUNCATE por service_role → `TRUNCATE proibido`) |
| 2 | DELETE só passa quando a sessão declara o `user_id` correto | **PASS** | Os três casos: sem declarar (`:141`), declarando outro (`:153`), declarando o certo (`:167`, com contagem de 2 linhas apagadas e a do vizinho intacta). Mais `:200` — a porta aberta não libera UPDATE |
| 3 | Reclassificar a questão não muda o snapshot da tentativa antiga | **PASS** | `tests/db/tentativas-schema.test.ts:356–400` |
| 4 | Erro no treino sem causa é recusado **antes** do INSERT, com mensagem própria | **PARCIAL** | `src/modules/aluno/tentativas/registrar.test.ts:28–38` prova a recusa antes do banco **de `validarResposta`**, com `motivo='causa_obrigatoria'` e mensagem própria. Mas o caminho de escrita real (`registrarTentativa`) não passa por `validarResposta` — ver **G1**. No caminho real a recusa vem do `CHECK` do Postgres, com mensagem de banco |
| 5 | Duplo-clique produz **uma** tentativa | **PASS** | `tests/db/registrar-tentativa.test.ts:149–175`: dois cliques, `duplicada` false→true, mesmo `tentativa_id`, `count(*) = 1` e a resposta do **primeiro** clique preservada mesmo com o segundo mandando letra diferente. Ressalva: os cliques são **sequenciais**, não concorrentes — ver **G4** |
| 6 | `EXPLAIN` por `user_id` + período faz pruning para uma partição só | **PASS** | `tests/db/tentativas-particao.test.ts:111–137` |

---

## 3. Sensor de mutação

Método: a migração já aplicada não re-roda (armadilha nº5 do `STATE.md`), então cada mutação de SQL foi
aplicada **direto no banco de dev** por `execute_sql` (`create or replace function`,
`alter table ... drop/add constraint`, `grant`), a suíte foi executada, e o estado original foi
restaurado colando de volta o SQL do arquivo de migração. Ao fim, `npx vitest run` voltou a **333/333**.

| # | Mutação | Suíte ficou vermelha? | Quem pegou |
| --- | --- | --- | --- |
| **a** | `causa_obrigatoria_no_treino` trocado por `check (true)` | **Sim — 2 falhas** | `tests/db/tentativas-schema.test.ts:239` ("o banco aceitou uma linha que deveria ter sido recusada") e `tests/db/registrar-tentativa.test.ts:193` (o teste de atomicidade, que usa essa recusa como gatilho) |
| **b** | `tentativas_bloqueia_mutacao()` deixa UPDATE passar (`return new`) | **Sim — 3 falhas** | `tentativas-trava.test.ts:30` (service_role), `:59` (ataque direto na partição), `:200` (porta não libera UPDATE) |
| **c** | Porta do esquecimento aceita qualquer `user_id` (comparação removida) | **Sim — 3 falhas** | `tentativas-trava.test.ts:141`, `:153`, `:167` — os três casos da porta |
| **d** | `endurecer_particoes_de_tentativas()` para de criar o gatilho de TRUNCATE por partição | **Sim — 2 falhas** | `tentativas-particao-endurecida.test.ts:108` (partição crua fica com 0 gatilhos) e `:151` (a lista de gatilhos volta só com `tentativas_sem_mutacao`) |
| **e** | `endurecer_particoes_de_tentativas()` para de fazer `revoke all` por partição | **Sim — 1 falha** | `tentativas-particao-endurecida.test.ts:108` (partição crua fica com 14 concessões a `anon`/`authenticated` em vez de 0) |
| **f** | `registrar_tentativa` perde o `and i.respondido_em is null` (mata o dedup) | **Sim — 1 falha** | `registrar-tentativa.test.ts:149` (`duplicada` volta `false` no segundo clique) |
| **g** | `validarResposta` para de exigir causa no treino | **Sim — 1 falha** | `src/modules/aluno/tentativas/registrar.test.ts:28` |
| **h** *(extra)* | `grant update, delete, truncate` de volta para `anon`/`authenticated` — desfaz a camada 1 do AD-084 | **Sim — 2 falhas** | `tentativas-trava.test.ts:30` (o UPDATE de `anon` passa) e `:97` (a asserção sobre `role_table_grants`) |
| **k** *(extra)* | `validar()` para de recusar causa fora da lista do treino (deixa `faltou_tempo` entrar) | **Sim — 2 falhas** | `registrar.test.ts:68` (motivo `causa_invalida`) e `:151` (o banco chega a ser chamado com entrada inválida) |

**Placar: 9 mortas, 0 sobreviventes.**

Duas observações que a mutação revelou e que não aparecem em nenhum teste:

- Na mutação **d**, o teste `toda particao tem RLS ligada e o gatilho de TRUNCATE proprio`
  (`tentativas-particao-endurecida.test.ts:45`) **continuou verde**, porque as 8 partições existentes já
  tinham o gatilho de antes. Quem pega a regressão é só o teste da partição crua (`:108`). Está correto —
  mas significa que a suíte depende de **um** teste para essa propriedade, não de dois.
- Na mutação **h**, o teste de TRUNCATE por `anon`/`authenticated` (`:74`) **continuou verde pelo motivo
  errado**: com `TRUNCATE` reconcedido em `tentativas`, o comando ainda falha com `permission denied`
  porque o `cascade` exige `TRUNCATE` em `tentativa_causa_simulado`, que `anon` não tem. A asserção
  `/permission denied/` naquele laço não discrimina bem. Ver **G5**.

---

## 4. Conferência do que o autor declarou

### 4.1 A afirmação central da AD-091 — verificada, não repetida

Medi diretamente no banco de dev, em transação revertida:

```
begin;
drop trigger tentativas_p20260801_sem_truncate on public.tentativas_p20260801;
truncate table public.tentativas_p20260801 cascade;   -- PASSOU
rollback;
```

Com o gatilho próprio da partição removido, **o TRUNCATE direto na partição passa** — o gatilho de
statement do pai não é acionado. Com o gatilho no lugar, o mesmo comando é recusado
(`tentativas-particao-endurecida.test.ts:69`, verde na linha de base). **A afirmação da AD-091 está
correta.** A metade complementar (partição nova nasce com privilégios e sem RLS) já é afirmada pelo
próprio teste, que verifica o estado **antes** de endurecer: `:113–122` exige `rls = false` e
`concessoes > 0` — a asserção "antes" é o que impede o teste de passar por nada.

### 4.2 O `SPEC_DEVIATION` do T46 — o desvio preserva a propriedade

O design pedia "passos 2–4 numa transação no TypeScript"; o Execute entregou a função SQL
`public.registrar_tentativa` (`20260817125000_registrar_tentativa.sql:18`). **Julgamento: o desvio é
legítimo e a propriedade que o design queria está preservada, com dois ganhos e um custo.**

- A propriedade era **atomicidade entre dedup, snapshot e INSERT**. Uma função plpgsql é uma instrução
  só: ou tudo acontece, ou nada. Provado, não assumido: `registrar-tentativa.test.ts:193–230` força a
  recusa do `CHECK` depois do dedup e confirma que `respondido_em` voltou a nulo **e** que o aluno
  consegue responder de novo.
- Ganho 1: a atomicidade deixa de depender de o chamador lembrar de abrir transação — o cliente do
  Supabase de fato não abre.
- Ganho 2: `security invoker` (`:34`, sem `security definer`) mantém a RLS valendo dentro da função. A
  escolha está certa; um `security definer` aqui seria caminho para gravar no nome de outro aluno, e o
  `s.user_id = p_user_id` do passo 1 (`:51`) é a segunda tranca. Provado em `:233–254`.
- Custo: a validação em memória do ALUNO-03 AC1 ficou **fora** do caminho de escrita — é exatamente o
  gap G1. O desvio não causou o gap, mas tornou-o mais fácil de não notar.

### 4.3 `sessoes` sem `plano_dia_id` — nenhuma dependência para frente ficou no código

Busca por `plano_dia` em `src/modules/aluno/**` e em `supabase/migrations/2026081712*.sql`: **zero
ocorrências fora de comentário**. As três menções são o comentário de fronteira em
`20260817124000_sessoes.sql:10–12`, que explica por que a coluna não está lá. A tabela `sessoes`
(`:16–28`) não tem a coluna. Confirmado.

### 4.4 Nenhuma chave de configuração órfã, nenhum nome de modelo

- Busca por `param.`, `configuracoes` (como alvo de INSERT) e por nomes de modelo (`gpt-`, `claude-`,
  `sonnet`, `opus`, `luna`, `modelo`) em `src/modules/aluno/**` e nas 6 migrações da spec: **zero
  ocorrências**. A única menção a `configuracoes` é um comentário comparativo em
  `20260817122000_tentativas_trava.sql:80`. Confere com o que o `design.md` declarou
  ("Nenhuma chave de configuração nova", "Nenhuma feature flag nova").
- Nenhuma feature flag nova foi declarada, o que é coerente: esta spec não tem superfície.

### 4.5 Os testes com `truncate ... cascade` provam o gatilho, não a FK

Verificado por medição, não por leitura. Removendo o gatilho do pai e rodando
`truncate table public.tentativas cascade` como dono, o erro devolvido continuou sendo
`P0001: tentativas e log imutavel: TRUNCATE proibido` — vindo dos gatilhos **das partições** (AD-091), e
**não** `cannot truncate a table referenced in a foreign key constraint`. Ou seja: o `cascade` de fato
passa da FK e a recusa é da trava. As asserções `/TRUNCATE proibido/` em
`tentativas-trava.test.ts:92` e `tentativas-particao-endurecida.test.ts:77` são discriminantes — a
mensagem da FK não casaria com o padrão.

O mesmo vale para a alteração em `tests/db/acervo-versionamento.test.ts:279`: a asserção é
`/nao aceita TRUNCATE/`, que só a trava produz. O `cascade` acrescentado ali não afrouxou o teste.

**Achado de reforço:** essa medição mostra que a trava do TRUNCATE no pai é hoje **redundante** com os
gatilhos das partições — o que é bom, e é o desenho em camadas funcionando.

---

## 5. Gaps, por severidade

### `Major`

**G1 — o caminho de escrita real não exige a causa antes do INSERT.**
`registrarTentativa` (`src/modules/aluno/tentativas/registrar.ts:36`) chama `validar`, que só confere
contexto e lista de causas. Quem exige a causa no treino é `validarResposta` (`:124`), **função separada
que nada obriga o chamador a invocar**. Consequência: se a SPEC 13 chamar só `registrarTentativa`, o erro
no treino sem causa será recusado pelo `CHECK` do Postgres com mensagem de banco, não pelo módulo com
`motivo='causa_obrigatoria'` e a frase que diz ao aluno que "não sei dizer" vale. Isso contraria o
`design.md` §Components, que lista "causa obrigatória no treino" dentro do **passo 1** de
`registrarTentativa`, e enfraquece o Success Criteria nº4.
*Nota:* a separação tem razão técnica legítima — o módulo não conhece o gabarito (invariante nº4) e por
isso não sabe se o aluno errou. O defeito não é a separação; é **não haver nada que force o par**.
*Onde resolver:* SPEC 13, tornando `validarResposta` obrigatória no caminho da tela, ou fazendo
`registrarTentativa` receber `acertou` quando o chamador o tiver. Registrar como dívida no `STATE.md`.

### `Minor`

**G2 — INFRA-04 AC3 não tem prova de efeito.** Existe prova do agendamento
(`tentativas-particao-endurecida.test.ts:194`), não da criação. Nenhum teste chama
`partman.run_maintenance_proc()` e confere que uma partição nasceu protegida. Mitigado por `premake = 3`.

**G3 — ALUNO-01 AC5 ("recalculável do zero") sem asserção.** É propriedade da SPEC 06; a `spec.md` da 05
não a colocou em `Out of Scope`, então ficou parecendo coberta. O `design.md` §Traceability afirma
cobertura com argumento, não com teste.

**G4 — o dedup não é testado sob concorrência.** `registrar-tentativa.test.ts:149` faz dois cliques
**sequenciais**. O design afirma que "dois cliques simultâneos disputam a mesma linha e o Postgres
serializa a disputa" (`20260817125000_registrar_tentativa.sql:43`). A afirmação é correta em teoria
(`UPDATE ... where respondido_em is null` bloqueia a linha), mas não há teste com duas conexões
concorrentes. A mutação **f** morreu, então o `where` está protegido — o que falta é a prova da
propriedade sob paralelismo real.

**G5 — uma asserção de TRUNCATE não discrimina.** Em `tentativas-trava.test.ts:76–83`, o laço de
`anon`/`authenticated` afirma `/permission denied/`. Sob a mutação **h** (privilégio reconcedido) o teste
continuou verde, porque o `cascade` exige TRUNCATE também na tabela referenciante. O teste não é falso —
só não prova o que o nome sugere para esses dois papéis. A camada 3 é provada de verdade no caso
`service_role` (`:85–93`).

**G6 — o caminho de saída para o item marcado sem tentativa correspondente pode estourar.** Se
`sessao_itens.respondido_em` estiver preenchido mas não existir tentativa para
`(sessao_id, questao_id)` — estado que a função atômica não produz, mas que um INSERT direto da SPEC 13
produziria — `registrar_tentativa` devolve zero linhas
(`20260817125000_registrar_tentativa.sql:69–76`) e `registrar.ts:58–70` faz acesso a propriedade de
`undefined`, gerando `TypeError` em vez de recusa nomeada. Não testado.

**G7 — a suíte valida o banco aplicado, não os arquivos de migração.** Todo teste `db` fala com o
projeto de dev. Uma divergência entre o `.sql` versionado e o estado real do banco passaria despercebida.
Foi justamente isso que permitiu este sensor de mutação funcionar. Não é defeito desta spec — é
característica do AD-083 que vale registrar antes de a SPEC 07 subir para produção.

**G8 — asserção auxiliar tautológica.** `tentativas-particao.test.ts:135`
(`expect(plano).not.toMatch(/Seq Scan/)`) roda com `enable_seqscan = off` ligado três linhas acima. Não
prejudica o teste, que se sustenta na contagem de partições citadas, mas não acrescenta informação.

### Nada classificado como `Critical`

Não encontrei violação de invariante do projeto, caminho de escrita fora da trava, vazamento de dado
entre alunos, dependência para frente, chave órfã nem nome de modelo em código.

---

## 6. O que eu **não** consegui verificar, e por quê

1. **Mutação na configuração de retenção do pg_partman** (`update partman.part_config set retention = ...`)
   — planejada para testar se `tests/db/tentativas-particao.test.ts:139` realmente pega o AD-067. **Não
   aplicada**: bloqueada pelo controle de permissão do ambiente. O teste lê as três colunas diretamente
   de `part_config` (`retention`, `retention_keep_table`, `inherit_privileges`), então a asserção é
   estrutural e provavelmente sensível — mas isso é leitura de código, não medição, e por
   evidência-ou-zero não conta como provado.
2. **Mutação abrindo a policy de SELECT da RLS** (`alter policy ... using (true)`) — planejada para
   testar `tentativas-trava.test.ts:250`. **Não aplicada**: bloqueada pelo mesmo controle. Pela leitura,
   o teste insere linha de um vizinho e afirma `toEqual([eu])`, o que mataria a mutação; de novo, não é
   medição.
3. **INFRA-04 AC3 no efeito** — não é possível provar dentro da suíte atual: `create_parent` e
   `run_maintenance_proc` não rodam em transação revertida, e chamá-los deixaria estado permanente no
   banco compartilhado. Verificado só o agendamento.
4. **A janela do AD-091** (partição criada fora do job fica sem RLS e sem gatilho até a próxima
   manutenção) — é trade-off declarado, não defeito. Não tentei medir quanto tempo a janela dura em
   produção porque não há produção.
5. **Comportamento sob concorrência real** (G4) — a infra de teste é de conexão única com transação
   revertida; um teste de duas conexões concorrentes exigiria sair desse molde e deixaria linha
   permanente em `tentativas`, que recusa DELETE.
6. **Região do projeto, backup e qualquer coisa de produção** — fora do escopo desta spec.

---

## 7. Estado deixado

- Árvore de trabalho limpa a não ser por este `validation.md`. Nada foi commitado, nada foi consertado.
- Banco de dev restaurado: as 3 funções mutadas foram recriadas com o corpo dos arquivos de migração, a
  constraint `causa_obrigatoria_no_treino` foi recriada com a definição original, os privilégios de
  `anon`/`authenticated` voltaram a `INSERT, REFERENCES, SELECT, TRIGGER`, as 8 partições continuam com
  2 gatilhos cada, e `endurecer_particoes_de_tentativas()` foi executada uma última vez (devolveu 8).
- `npx vitest run` após a restauração: **333 PASS / 0 FAIL**. `npm run lint`: sem apontamento.
