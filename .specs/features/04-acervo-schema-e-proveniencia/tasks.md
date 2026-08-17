# SPEC 04 — Acervo: schema, taxonomia e proveniência · Tasks

> **8 tasks, T33–T40**, em 3 fases. A estimativa do ROADMAP era 10; o Design consolidou taxonomia e
> candidato numa fase e não precisou de task de código de aplicação além do contrato TS.
> Numeração continua de onde a SPEC 03 parou (T32). T10–T22 são da rodada 1 do M4 e não se reusam
> (T10 morreu — virou esta spec inteira).
>
> **Base**: 143 testes passando na `main` (`5630e06`). Toda contagem abaixo é delta sobre isso.
> **Gate de toda task**: `npm run lint`, `npm test` (unit + db) e `npm run build` quando houver TS novo.
> **Um commit atômico por task.** Nenhuma task é commitada com teste vermelho.

## Fases

| Fase | Tasks | Entrega |
| --- | --- | --- |
| **1 — Taxonomia e catálogo** | T33, T34, T35 | matéria/tópico editáveis, candidato separado do canônico, `provas` com alvo e estado |
| **2 — A questão** | T36, T37, T38 | `questoes` com o contrato do AD-039/AD-040, versionamento garantido, trava de proveniência e privilégios |
| **3 — Busca e contrato** | T39, T40 | colunas e índices de busca vazios porém prontos; espelho TS do formato jsonb |

---

## Fase 1 — Taxonomia e catálogo

### T33: Enums do acervo, `materias` e `topicos`

**What**: criar os seis enums do domínio do acervo e as duas tabelas da taxonomia canônica.
**Where**: `supabase/migrations/<ts>_acervo_taxonomia.sql`, `tests/db/acervo-taxonomia.test.ts`
**Depends on**: — (só a SPEC 02/03 já mergeadas)
**Reuses**: valores dos enums vêm **literalmente** do AD-039; molde de comentário e de `revoke` das
migrações da SPEC 02/03
**Requirement**: BANCO-05 (parte) · BANCO-09 AC3 (enums) · AD-039

**Tools**: MCP `supabase-passou` (`apply_migration`, `list_tables`)

**Done when**:

- [ ] Os 6 enums existem com **exatamente** os valores do Design: `tipo_questao`, `origem_questao`,
      `status_questao`, `tipo_mudanca`, `status_prova`, `status_candidato`
- [ ] `materias` e `topicos` existem com `ativa`/`ativo`, `ordem` e as unicidades do Design
- [ ] RLS ligada nas duas, **sem policy**; `revoke insert, update, delete, truncate` de
      `anon`/`authenticated`
- [ ] Teste prova: enum recusa valor fora da lista; `materias.nome` duplicado é recusado;
      `topicos (materia_id, nome)` duplicado é recusado; o mesmo nome de tópico em duas matérias é
      aceito
- [ ] Teste prova que **renomear/mover tópico é permitido** (a taxonomia é editável)
- [ ] Contagem: **+8** testes (total ≥ 151)

**Tests**: integration (banco) · **Gate**: full
**Commit**: `feat(m1): cria enums do acervo e a taxonomia materia-topico`

---

### T34: `topico_candidato` — a IA sugere, não cria

**What**: tabela separada para tópico sugerido que não existe na taxonomia, com as restrições que
impedem candidato aprovado sem tópico e decisão sem autor.
**Where**: `supabase/migrations/<ts>_acervo_topico_candidato.sql`, estende
`tests/db/acervo-taxonomia.test.ts`
**Depends on**: T33
**Requirement**: BANCO-05 (P3 AC1)

**Tools**: MCP `supabase-passou` (`apply_migration`)

**Done when**:

- [ ] Tabela existe com `status_candidato`, `ocorrencias`, `topico_id` nulo e `decidido_por`
- [ ] `CHECK candidato_aprovado_aponta_topico` recusa `aprovado` com `topico_id` nulo **e**
      `pendente`/`rejeitado` com `topico_id` preenchido
- [ ] `CHECK candidato_decidido_tem_autor` recusa decisão sem `decidido_em`/`decidido_por`
- [ ] `ocorrencias <= 0` recusado
- [ ] RLS + `revoke` no mesmo padrão
- [ ] Um comentário em SQL diz que **quem aprova é a tela da SPEC 18** e que a IA nunca escreve em
      `topicos`
- [ ] Contagem: **+5** testes (total ≥ 156)

**Tests**: integration (banco) · **Gate**: full
**Commit**: `feat(m1): separa candidato a topico do topico canonico`

---

### T35: `provas` — catálogo-alvo e estado da ingestão

**What**: a tabela do BANCO-02 com banca/ano/órgão/cargo/caderno, estado da ingestão e o índice
único que impede a mesma prova entrar duas vezes.
**Where**: `supabase/migrations/<ts>_acervo_provas.sql`, `tests/db/acervo-provas.test.ts`
**Depends on**: T33 (usa `status_prova`)
**Requirement**: BANCO-02 · BANCO-12 (o `precisa_ocr` da prova existe) · AD-009 · AD-041

**Tools**: MCP `supabase-passou` (`apply_migration`)

**Done when**:

- [ ] Tabela existe com as colunas do Design; `status` default `catalogada`
- [ ] `provas_alvo_unico` recusa o mesmo (banca, ano, órgão, cargo, caderno) **e** recusa também
      quando `caderno` é nulo nas duas linhas
- [ ] Dois cadernos diferentes da mesma prova são aceitos
- [ ] `ano` fora de 1990–2100 recusado
- [ ] `status = 'precisa_ocr'` aceito (AD-041 exige o estado)
- [ ] RLS + `revoke` no mesmo padrão
- [ ] Contagem: **+6** testes (total ≥ 162)

**Tests**: integration (banco) · **Gate**: full
**Commit**: `feat(m1): registra o catalogo-alvo de provas com estado de ingestao`

---

## Fase 2 — A questão

### T36: `questoes` — colunas e formato do AD-039/AD-040

**What**: a tabela central, com PK `(id, questao_versao)`, todas as colunas do contrato e os `CHECK`
de formato. **Sem** a trava de proveniência (T38) e **sem** as colunas de busca (T39).
**Where**: `supabase/migrations/<ts>_acervo_questoes.sql`, `tests/db/acervo-questoes.test.ts`
**Depends on**: T33, T35
**Reuses**: contrato do AD-039/AD-040 — copiar, não reinterpretar
**Requirement**: BANCO-09 AC3 · BANCO-13 (colunas de versão) · AD-039 · AD-040

**Tools**: MCP `supabase-passou` (`apply_migration`, `execute_sql`)

**Done when**:

- [ ] PK é `(id, questao_versao)`; `vigente` existe com índice único `(id) where vigente`
- [ ] `CHECK alternativas_conforme_tipo`: array em `certo_errado` recusado; `null` ou array vazio em
      `multipla_escolha` recusado
- [ ] `CHECK resposta_conforme_tipo`: `F` em múltipla recusado; `A` em certo-errado recusado;
      `C` e `E` aceitos em certo-errado
- [ ] `CHECK imagens_e_array` recusa objeto jsonb em `imagens`; default é `[]`
- [ ] `CHECK dificuldade between 1 and 5` e `confianca_ia` entre 0 e 1
- [ ] `CHECK real_veio_de_prova` recusa `origem='real'` sem `prova_id` ou sem `numero`
- [ ] `CHECK mudanca_declarada_a_partir_da_v2` recusa v1 com `mudanca_tipo` (a v≥2 sem, T37 prova)
- [ ] `unique (prova_id, numero) where vigente` recusa a mesma questão da mesma prova duas vezes
- [ ] Contagem: **+12** testes (total ≥ 174)

**Tests**: integration (banco) · **Gate**: full
**Commit**: `feat(m1): cria questoes com o contrato de identidade e formato`

---

### T37: Versionamento — versão nova por INSERT, anterior congelada

**What**: os dois gatilhos que fazem o AD-039 ser garantia do banco: o `BEFORE INSERT` que numera a
versão e apaga o selo de vigente da anterior, e o que recusa mutação de versão histórica, mudança de
identidade e DELETE.
**Where**: `supabase/migrations/<ts>_acervo_questoes_versionamento.sql`,
`tests/db/acervo-versionamento.test.ts`
**Depends on**: T36
**Reuses**: molde de gatilho + `set search_path = ''` de `20260816212947_configuracoes.sql` (AD-084)
**Requirement**: BANCO-13 · AD-039 · AD-042 (a versão respondida não pode mudar sob os pés)

**Tools**: MCP `supabase-passou` (`apply_migration`, `execute_sql`)

**Done when**:

- [ ] INSERT com `id` já existente cria `questao_versao = anterior + 1`, **ignorando** o valor que o
      chamador passou
- [ ] Depois do INSERT existe **exatamente uma** linha `vigente` para aquele `id`
- [ ] Três versões seguidas funcionam (prova que o flip acontece antes do INSERT e o índice único não
      é violado)
- [ ] `UPDATE` em versão não-vigente é **recusado** com mensagem que cita a AD
- [ ] `UPDATE` que muda `id` ou `questao_versao` é **recusado**
- [ ] `UPDATE` legítimo em versão vigente (preencher `resposta_correta`, mudar `status`) **passa** —
      a tabela não é append-only
- [ ] `DELETE` em `questoes` é **recusado**; `TRUNCATE` também (AD-084: RLS não governa TRUNCATE)
- [ ] O mesmo gatilho carimba `atualizada_em = now()` por cima do que o chamador mandou — coluna que
      ninguém atualiza é coluna que mente
- [ ] Teste do Success Criteria nº2 da spec: criar versão nova e ler a anterior **intacta** campo por
      campo (enunciado, resposta, status)
- [ ] Contagem: **+9** testes (total ≥ 183)

**Tests**: integration (banco) · **Gate**: full
**Commit**: `feat(m1): versiona questao por insert e congela a versao anterior`

---

### T38: Trava de publicação sem proveniência + privilégios do acervo

**What**: os `CHECK` que impedem publicar sem proveniência, sem gabarito e inédita direto; e a RLS +
`revoke` de `questoes`.
**Where**: `supabase/migrations/<ts>_acervo_trava_de_publicacao.sql`,
`tests/db/acervo-proveniencia.test.ts`, `tests/db/acervo-privilegios.test.ts`
**Depends on**: T36
**Requirement**: **BANCO-01 AC1/AC2** · BANCO-07 AC2 (metade estrutural) · invariante nº4 e nº15 do
`AGENTS.md`

**Tools**: MCP `supabase-passou` (`apply_migration`, `execute_sql`, `get_advisors`)

**Done when**:

- [ ] `CHECK real_tem_proveniencia`: questão `real` **não** vai a `publicada` sem `fonte_citacao`
      (Success Criteria nº1 da spec), e vai quando tem
- [ ] `CHECK fonte_citacao_completa` recusa `fonte_citacao` faltando qualquer das 5 chaves
- [ ] `CHECK publicada_tem_gabarito` recusa `publicada` sem `resposta_correta`
- [ ] `CHECK gerada_ia_nunca_nasce_publicada` recusa `gerada_ia` + `publicada`; um comentário em SQL
      diz que a porta operada com `questao_revisoes` é da SPEC 10
- [ ] Rascunho **sem** proveniência continua sendo aceito (a trava é de publicação, não de ingestão)
- [ ] RLS ligada em todas as 5 tabelas do acervo, `pg_policies` vazio para elas
- [ ] `anon` e `authenticated` sem `insert/update/delete/truncate` — provado por
      `has_table_privilege`, e a leitura provada por **tentativa real** com papel trocado
      (padrão de `configuracoes.test.ts`, mais forte que só o `grant`)
- [ ] `get_advisors` do Supabase sem aviso novo de segurança
- [ ] Contagem: **+11** testes (total ≥ 194)

**Tests**: integration (banco) · **Gate**: full
**Commit**: `feat(m1): trava publicacao sem proveniencia e fecha o acervo`

---

## Fase 3 — Busca e contrato

### T39: Colunas e índices de busca (embedding HNSW + fts PT)

**What**: instalar `vector`, adicionar `embedding vector(1536)` e `fts` gerada, criar os quatro
índices de leitura e busca. **Preencher embedding é a SPEC 11** — aqui a coluna nasce nula.
**Where**: `supabase/migrations/<ts>_acervo_busca.sql`, `tests/db/acervo-busca.test.ts`
**Depends on**: T36
**Reuses**: dimensão 1536 confirmada no Context7 (§Verificação de biblioteca do `design.md`)
**Requirement**: BANCO-09 AC1/AC3 (parte: schema e índice) · AD-005 · AD-040

**Tools**: MCP `supabase-passou` (`apply_migration`, `execute_sql`, `list_extensions`)

**Done when**:

- [ ] `create extension vector` aplicado; `embedding` é `vector(1536)` — teste lê a dimensão de
      `pg_attribute`/`format_type`, não do texto da migração
- [ ] Vetor de dimensão errada é **recusado** pelo banco
- [ ] `fts` é coluna gerada e **enche sozinha** no INSERT; `to_tsvector('portuguese', ...)` reconhece
      radical em português (teste com palavra flexionada)
- [ ] Índice HNSW existe com `vector_cosine_ops`; índice GIN existe em `fts`
- [ ] `EXPLAIN` de `where topico_id = ... and status = ... and vigente` usa índice, não Seq Scan
      (Success Criteria nº4 da spec)
- [ ] Índice `(origem, status) where vigente` existe (contrato do Raio-X, SPEC 26)
- [ ] Um comentário em SQL diz que **quem preenche `embedding` é a SPEC 11** e que trocar a dimensão
      exige `alter table` + re-embeddar
- [ ] Contagem: **+9** testes (total ≥ 203)

**Tests**: integration (banco) · **Gate**: full
**Commit**: `feat(m1): abre as colunas e indices de busca hibrida do acervo`

---

### T40: Contrato TS do acervo — espelho do formato jsonb

**What**: `src/modules/acervo/contrato.ts` com os enums como listas literais e os schemas Zod de
`alternativas`, `imagens` e `fonte_citacao`, mais `DIMENSAO_EMBEDDING`.
**Where**: `src/modules/acervo/contrato.ts`, `src/modules/acervo/index.ts`,
`src/modules/acervo/contrato.test.ts`, e um teste de banco que confere que as duas pontas concordam
**Depends on**: T36, T39
**Reuses**: padrão de `src/modules/config/catalogo.ts` (Zod + tipos derivados + teste que compara com
o banco, como `catalogo-sem-orfa.test.ts` faz)
**Requirement**: AD-040 · BANCO-09 AC3

**Tools**: Skill NONE

**Done when**:

- [ ] Listas literais dos 6 enums exportadas, e um teste de **banco** confere que cada lista é igual
      ao `pg_enum` correspondente (as duas pontas não podem divergir em silêncio)
- [ ] `alternativasSchema` aceita o array do AD-040 e recusa: letra fora de A–E, letra repetida,
      texto vazio, array vazio
- [ ] `imagensSchema` aceita `[{storage_path, posicao, alt_text}]` e recusa `posicao` fora de
      `enunciado`/`alternativa_X`
- [ ] `fonteCitacaoSchema` exige as 5 chaves do AD-040
- [ ] `respostaValidaParaTipo` cobre os 4 casos (múltipla válida/inválida, C-E válida/inválida)
- [ ] `DIMENSAO_EMBEDDING === 1536` e um teste de banco confere contra `format_type` da coluna
- [ ] Contagem: **+14** testes (total ≥ 217)

**Tests**: unit + integration (banco) · **Gate**: full (`npm run build` incluído — é TS novo)
**Commit**: `feat(m1): publica o contrato ts do formato de dados da questao`

---

## Depois da última task (automático, não opcional)

1. **Verifier independente** (autor ≠ verificador): checagem por AC com evidência `file:line`, sensor
   de discriminação por mutação, `validation.md` escrito.
2. Atualizar a linha da SPEC 04 no `.specs/ROADMAP.md` (status + nº real de tasks: **8**, não 10).
3. Substituir a seção `## Handoff` do `.specs/STATE.md`.
4. Abrir o PR. **Não mergear sem o sócio mandar.**
