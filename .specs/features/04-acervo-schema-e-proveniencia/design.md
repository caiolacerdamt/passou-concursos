# SPEC 04 — Acervo: schema, taxonomia e proveniência · Design

> **Requisitos**: BANCO-01, BANCO-02, BANCO-05 (parte: taxonomia), BANCO-09 (parte: schema e
> índices), BANCO-13. Texto dos AC em `.specs/modulos/m1-banco-questoes/spec.md`.
> **ADs que mandam aqui**: AD-039 (identidade e versionamento de `questoes`, enums fixos),
> AD-040 (formato dos dados: `alternativas`, `imagens`, `fonte_citacao`, `dificuldade`, embedding+fts),
> AD-041 (escopo MVP: imagem sim, escaneada em `precisa_ocr`, inédita P2), AD-042 (o que o log da
> SPEC 05 vai ler daqui), AD-005 (Cohere embed-v4 + HNSW), AD-009 (catálogo-alvo), AD-076 (Raio-X
> conta desde o dia 1), AD-083 (Vitest `unit` + `db`, sem Docker), AD-084 (receita de trava),
> AD-086 (ordem das specs).
>
> **Nada de IA nesta spec.** Nenhuma chamada de modelo, nenhum nome de modelo, nenhuma dependência
> do gateway (SPEC 07).

---

## Architecture Overview

Esta spec não tem tela, não tem rota e não tem job. Ela entrega **estrutura**: seis tabelas, seis
enums, uma trava de publicação, um mecanismo de versionamento e as colunas/índices de busca vazios.
Todo o resto do M1 (SPEC 08→11) escreve dentro disso.

```mermaid
graph TD
  M["materias"] --> T["topicos"]
  C["topico_candidato<br/>(sugestão da IA, fora do canônico)"] -.->|operador aprova<br/>SPEC 18| T
  P["provas<br/>banca/ano/órgão/cargo + estado"] --> Q
  T --> Q["questoes<br/>(id, questao_versao)"]
  Q --> E["embedding vector(1536) + HNSW<br/>fts tsvector PT + GIN<br/>← preenchidos pela SPEC 11"]
  Q -.->|FK (questao_id, questao_versao)| L["tentativas<br/>SPEC 05"]
  Q -.->|(questao_id, questao_versao)| X["explicacoes<br/>SPEC 13"]
```

Três decisões de forma organizam tudo:

1. **Versão é linha, não coluna editada.** A chave primária de `questoes` é `(id, questao_versao)`.
   Criar versão nova é um `INSERT` com o mesmo `id`; um gatilho calcula o número da versão e apaga o
   selo de vigente da anterior. A versão que deixou de ser vigente fica **congelada por gatilho** —
   qualquer `UPDATE` nela é recusado pelo banco. É isso que faz o AD-039 ser garantia e não promessa.
2. **A trava de proveniência é `CHECK`, não código de job.** `status='publicada'` com
   `origem='real'` e `fonte_citacao` nula é linha que o Postgres recusa. Job errado, script errado ou
   operador com a chave de serviço na mão: os três batem na mesma parede.
3. **Candidato a tópico não mora na taxonomia.** `topico_candidato` é tabela separada de `topicos`.
   Enquanto a IA não tem como escrever em `topicos`, "a IA criou tópico sozinha" deixa de ser um bug
   possível — é uma tabela que ela não alcança.

### O que esta spec deliberadamente NÃO faz

| Não faz | Por quê / onde entra |
| --- | --- |
| Preencher `embedding` e `fts` com valor real | SPEC 11. Aqui a coluna e o índice nascem; `fts` é coluna gerada, então enche sozinha — `embedding` fica nulo |
| Transição de estado da prova e da questão operada | SPEC 08/09/10. Aqui existem os estados e as travas estruturais |
| Policy de RLS de leitura para o aluno | SPEC 17 traz `matricula`, SPEC 22 traz a tela. Até lá RLS ligada **sem policy** — o acervo é invisível para `anon`/`authenticated` |
| Chave nova no catálogo de configuração | Nenhum código desta spec **lê** configuração. A regra do ROADMAP é "a chave entra na task que a usa"; chave sem leitor é órfã de fato, mesmo passando no teste |

---

## Verificação de biblioteca (Context7, 2026-08-17)

Duas afirmações desta spec dependiam de documentação de fornecedor, e as duas foram conferidas
antes de fixar o schema:

| O que precisava confirmar | Resposta da fonte | Consequência no schema |
| --- | --- | --- |
| Dimensão do embedding do Cohere `embed-v4` (Assumption aberta da spec) | `output_dimension` aceita **256, 512, 1024 ou 1536**, e o **default é 1536** (OpenAPI oficial da Cohere, `POST /v2/embed`) | `embedding vector(1536)` |
| O `vector` do pgvector aguenta 1536 em índice HNSW? | HNSW suporta `vector` até **2.000** dimensões (`halfvec` até 4.000). 1536 cabe com folga | `using hnsw (embedding vector_cosine_ops)` — sem `halfvec`, sem quantização |

**Decisão registrada:** fica em **1536**, o default do fornecedor. As dimensões menores existem
(Matryoshka) e economizariam espaço, mas escolher 512 sem medir a perda de qualidade de busca é
trocar precisão por bytes num acervo que ainda não tem uma questão dentro. Trocar depois é
`alter table` + re-embeddar em lote, que o edge case do M1 já prevê como operação barata.

**A dimensão NÃO vai para a tabela de configuração.** É tipo de coluna: mudar exige migração de
qualquer forma, então guardar o número em config só criaria duas fontes que podem divergir. Fica em
código, no contrato TS, com o teste conferindo que os dois lados dizem 1536.

`vector` versão 0.8.2 está disponível no projeto e **não está instalada** — esta spec instala
(`create extension vector`).

---

## Data Models

### Enums (AD-039 é literal aqui — os valores não são escolha desta rodada)

| Tipo | Valores | Fonte |
| --- | --- | --- |
| `tipo_questao` | `multipla_escolha`, `certo_errado` | AD-039 |
| `origem_questao` | `real`, `gerada_ia` | AD-039 |
| `status_questao` | `rascunho`, `em_revisao`, `publicada`, `rejeitada`, `precisa_ocr` | AD-039 |
| `tipo_mudanca` | `cosmetica`, `substantiva` | BANCO-13 / AD-052 (IA-09 AC4 lê isto) |
| `status_prova` | `catalogada`, `extraindo`, `extraida`, `gabarito_cruzado`, `concluida`, `precisa_ocr`, `falhou` | novo aqui — ver justificativa |
| `status_candidato` | `pendente`, `aprovado`, `rejeitado` | novo aqui (BANCO-05/P3 AC1) |

Os nomes de tipo `origem_questao` e `status_questao` levam o sufixo porque `origem` e `status` são
palavras que vão reaparecer em `provas`, em `perfil_concurso` (SPEC 26) e em `explicacoes`
(SPEC 13). Tipo com nome genérico é colisão marcada.

**`status_prova` é o único enum inventado nesta rodada**, e cada valor responde a uma frase que já
está escrita em outra spec: `catalogada` (AD-009 — o alvo existe antes do PDF), `extraindo`/`extraida`
(BANCO-03, retomada por dedup depois de falha no meio do lote), `gabarito_cruzado` (BANCO-04, o
cruzamento é etapa separada da extração), `concluida`, `precisa_ocr` (BANCO-12/AD-041, obrigatório) e
`falhou`. Quem move a prova entre esses estados é a SPEC 08/09 — aqui só existe o vocabulário.

### `materias` e `topicos` — a taxonomia canônica

```sql
create table public.materias (
  id        uuid primary key default gen_random_uuid(),
  nome      text     not null,
  ordem     smallint not null default 0,   -- ordem de exibição do edital verticalizado
  ativa     boolean  not null default true,
  criada_em timestamptz not null default now(),
  constraint materias_nome_unico unique (nome)
);

create table public.topicos (
  id         uuid primary key default gen_random_uuid(),
  materia_id uuid not null references public.materias(id),
  nome       text not null,
  ordem      smallint not null default 0,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  constraint topicos_nome_unico_na_materia unique (materia_id, nome)
);
```

**Por que `ativa`/`ativo` em vez de deletar:** tópico que sai do edital novo continua sendo o rótulo
de tentativas antigas. Apagar a linha arrebentaria a FK do histórico; desligar o `ativo` tira o
tópico da classificação futura sem tocar em nada do passado. É a forma de a taxonomia ser editável
sem contradizer o invariante do snapshot congelado.

**Reclassificar é `UPDATE` normal aqui, e é seguro por desenho.** Mover um tópico de matéria, ou
renomear o tópico, é permitido — a proteção do histórico não está nesta tabela, está no fato de
`tentativas` (SPEC 05) copiar **id e rótulo** no momento da resposta (AD-042). Esta spec entrega a
metade dela que dá para provar hoje: reclassificar o tópico de uma questão muda a questão e não muda
mais nada.

### `topico_candidato` — o que a IA sugere, e não cria

```sql
create table public.topico_candidato (
  id             uuid primary key default gen_random_uuid(),
  nome_sugerido  text not null,
  materia_id     uuid references public.materias(id),   -- pode vir sem palpite de matéria
  status         status_candidato not null default 'pendente',
  ocorrencias    integer not null default 1 check (ocorrencias > 0),
  topico_id      uuid references public.topicos(id),    -- preenchido só quando aprovado
  sugerido_em    timestamptz not null default now(),
  decidido_em    timestamptz,
  decidido_por   uuid references auth.users(id),

  constraint candidato_aprovado_aponta_topico
    check ((status = 'aprovado') = (topico_id is not null)),
  constraint candidato_decidido_tem_autor
    check ((status = 'pendente') = (decidido_em is null and decidido_por is null))
);
```

`ocorrencias` existe para a tela da SPEC 18 ordenar por volume: um tópico sugerido 40 vezes é
candidato mais forte que um sugerido uma vez. O `unique (coalesce(materia_id, ...), nome_sugerido)`
fica **fora** desta rodada de propósito — a mesma string sugerida em matérias diferentes é informação,
não duplicata, e quem decide a fusão é o operador.

### `provas` — o catálogo-alvo (BANCO-02, AD-009)

```sql
create table public.provas (
  id               uuid primary key default gen_random_uuid(),
  banca            text     not null,
  ano              smallint not null check (ano between 1990 and 2100),
  orgao            text     not null,
  cargo            text     not null,
  caderno          text,                 -- "Tipo 1", "Manhã": a mesma prova sai em mais de um caderno
  status           status_prova not null default 'catalogada',
  pdf_storage_path text,                 -- SPEC 08 preenche
  observacao       text,
  criada_em        timestamptz not null default now(),
  atualizada_em    timestamptz not null default now()
);

create unique index provas_alvo_unico
  on public.provas (banca, ano, orgao, cargo, coalesce(caderno, ''));
```

O índice único é o que faz "submeter a mesma prova duas vezes não duplica" (edge case do M1) ser
verdade no banco e não no script. `coalesce(caderno, '')` porque `null` não colide com `null` em
índice único — sem isso, duas provas sem caderno passariam.

`banca` é `text`, não enum. O AD-039 fixou enum para o que M4/M2 leem no snapshot; banca não está lá,
e o produto é multi-concurso (AD-076/SPEC 26). Enum de banca obrigaria migração para catalogar a
próxima banca, o que é o oposto de "catálogo-alvo".

### `questoes` — o contrato central

```sql
create table public.questoes (
  id              uuid    not null default gen_random_uuid(),
  questao_versao  integer not null default 1 check (questao_versao >= 1),
  vigente         boolean not null default true,

  -- de onde vem
  prova_id        uuid references public.provas(id),
  numero          integer,                   -- número oficial da banca, nunca a ordem de leitura
  origem          origem_questao not null default 'real',
  fonte_citacao   jsonb,                     -- banca/ano/orgao/cargo/numero (AD-040)

  -- o que é
  topico_id       uuid references public.topicos(id),   -- nulo até a SPEC 09 classificar
  tipo_questao    tipo_questao not null,
  enunciado       text not null,
  alternativas    jsonb,                     -- array p/ múltipla, NULL p/ certo-errado (AD-040)
  imagens         jsonb not null default '[]'::jsonb,
  resposta_correta text,                     -- A–E ou C/E; nulo até o gabarito cruzar
  gabarito_versao text,
  anulada         boolean not null default false,

  -- estado e sinais
  status          status_questao not null default 'rascunho',
  dificuldade     smallint check (dificuldade between 1 and 5),
  confianca_ia    numeric(4,3) check (confianca_ia >= 0 and confianca_ia <= 1),

  -- versionamento (BANCO-13)
  mudanca_tipo    tipo_mudanca,
  mudanca_motivo  text,

  -- busca (SPEC 11 preenche o embedding)
  embedding       vector(1536),
  fts             tsvector generated always as (
                    to_tsvector('portuguese', coalesce(enunciado, ''))
                  ) stored,

  criada_em       timestamptz not null default now(),
  atualizada_em   timestamptz not null default now(),

  primary key (id, questao_versao)
);
```

**Por que a PK é `(id, questao_versao)`:** é exatamente o par que `tentativas` (AD-042) e
`explicacoes` (AD-052) referenciam. Com essa PK, a FK dessas duas tabelas aponta para a versão
respondida/explicada e o banco impede que ela desapareça.

**Por que `vigente` é coluna e não `max(questao_versao)`:** toda leitura de produto quer "a questão
de hoje". `select ... where vigente` com índice parcial é uma linha; `max()` por `id` é subconsulta
em toda tela. O índice único `(id) where vigente` garante que existe **exatamente uma** vigente por
questão — se o gatilho falhar, o banco recusa, não fica silenciosamente com duas.

**`fts` indexa só o `enunciado`.** Foi a escolha conservadora: coluna gerada exige expressão
`IMMUTABLE`, e puxar texto de dentro do `alternativas` jsonb dentro da expressão gerada é risco a
troco de pouco. A SPEC 11 é dona da busca e pode estender (índice de expressão ou coluna extra) com o
número de acerto na mão. Registrado como limite conhecido, não esquecimento.

#### As restrições — cada uma responde a uma frase de spec

| `CHECK` | O que recusa | Requisito |
| --- | --- | --- |
| `real_tem_proveniencia` | `status='publicada'` + `origem='real'` + `fonte_citacao` nula | **BANCO-01 AC1** |
| `fonte_citacao_completa` | `fonte_citacao` sem uma das 5 chaves (`banca`, `ano`, `orgao`, `cargo`, `numero`) | BANCO-01 (proveniência é o conjunto, não o campo) |
| `publicada_tem_gabarito` | `status='publicada'` sem `resposta_correta` | BANCO-04 / invariante nº4 |
| `real_veio_de_prova` | `origem='real'` sem `prova_id` ou sem `numero` | BANCO-02 |
| `alternativas_conforme_tipo` | array em `certo_errado`, ou `null`/array vazio em `multipla_escolha` | **AD-040** |
| `resposta_conforme_tipo` | letra fora de A–E em múltipla, fora de C/E em certo-errado | **AD-040** |
| `imagens_e_array` | `imagens` que não seja array jsonb | AD-040 |
| `mudanca_declarada_a_partir_da_v2` | versão 1 **com** `mudanca_tipo`, ou versão ≥2 **sem** | **BANCO-13** |
| `gerada_ia_nunca_nasce_publicada` | `origem='gerada_ia'` + `status='publicada'` sem revisão registrada → nesta spec: bloqueia o caminho direto do INSERT | BANCO-07 AC2 (a fila humana é da SPEC 10) |

Nota sobre a última: a SPEC 10 é dona da revisão humana. O que cabe aqui é a metade estrutural —
inédita não chega a `publicada` por INSERT direto. A porta operada, com `questao_revisoes`, é da 10,
e quando ela existir esta trava passa a consultá-la.

#### Índices

| Índice | Para quê |
| --- | --- |
| `unique (id) where vigente` | uma versão vigente por questão, garantida pelo banco |
| `unique (prova_id, numero) where vigente and prova_id is not null` | a mesma questão da mesma prova não entra duas vezes (edge case) |
| `(topico_id, status) where vigente` | o Success Criteria nº4 da spec: busca por tópico + status usa índice |
| `(origem, status) where vigente` | a contagem do Raio-X (SPEC 26) é `origem='real' and status='publicada'` |
| `using hnsw (embedding vector_cosine_ops)` | busca por similaridade (SPEC 11, dedup) |
| `using gin (fts)` | busca textual PT (SPEC 11) |

### Trava de mutação de `questoes` (AD-084 adaptado)

`questoes` **não** é append-only — a SPEC 09 preenche gabarito, a 10 muda status, a 11 preenche
embedding. O que precisa ser imutável é mais estreito, e são três regras num gatilho:

1. `UPDATE` em linha com `vigente = false` → **recusado**. Versão histórica é congelada.
2. `UPDATE` que muda `id` ou `questao_versao` → **recusado**. Identidade não se edita.
3. `DELETE` em `questoes` → **recusado**. Descartar questão é `status='rejeitada'`; DELETE
   arrebentaria a FK de `tentativas` e apagaria o fato que um aluno respondeu.

E um gatilho `BEFORE INSERT` faz o versionamento acontecer:

```
questao_versao := coalesce(max(questao_versao) da mesma id, 0) + 1
update questoes set vigente = false where id = new.id and vigente   -- antes de inserir
```

**A ordem importa e é o detalhe que dá errado se for feito no lugar óbvio.** O apagar-o-selo tem de
acontecer no `BEFORE INSERT`, não no `AFTER`: o índice único `(id) where vigente` é verificado na
hora do INSERT, então se a versão anterior ainda estiver vigente quando a nova entra, o INSERT
falha. Fazendo antes, a nova linha entra num terreno onde nenhuma outra é vigente.

O `update ... set vigente = false` atinge linha com `vigente = true`, então a regra 1 (que só olha
`old.vigente = false`) não o bloqueia. As duas regras convivem sem exceção nomeada.

Toda função de gatilho leva `set search_path = ''` (mesmo motivo do AD-084 / linter do Supabase).

### Privilégios e RLS

Mesma postura da SPEC 02, pelo mesmo motivo: **RLS ligada, nenhuma policy**. As cinco tabelas ficam
invisíveis para `anon` e `authenticated`; o servidor lê com a chave de serviço e entrega para a tela
só o que a tela precisa. Não é excesso de zelo — o acervo é o fosso do produto (`enunciado` +
`resposta_correta` de tudo), e não existe superfície logada nem `matricula` (SPEC 17) para escrever
uma policy honesta hoje. Policy de leitura entra na SPEC 22, junto da tela que precisa dela.

Além da RLS, `revoke insert, update, delete, truncate ... from anon, authenticated` em todas: o
acervo é escrito por script de fábrica e por operador, nunca pelo navegador.

**Nenhuma destas tabelas é grupo 1** (regra 3 do ROADMAP): não há `user_id` em nenhuma.
`topico_candidato.decidido_por` e o futuro `questao_revisoes` apontam para o **operador**, não para o
aluno — mesma situação de `configuracoes.alterado_por`, que a SPEC 02 já registrou como fora dos
grupos de dado pessoal do aluno. Portanto **nada aqui entra na rotina de esquecimento da SPEC 32**.

---

## Components

### `src/modules/acervo/contrato.ts` (novo)

Espelho em TypeScript do que o banco aceita. Existe por dois motivos concretos:

1. **Quem escreve precisa validar antes de bater no banco.** A SPEC 08 vai receber JSON de um modelo
   e inserir. Descobrir o formato errado por `CHECK` violado no meio de um lote de 120 questões é
   caro; validar antes é o padrão que o projeto já usa (`catalogo.ts` valida o jsonb da config).
2. **`CHECK` de jsonb não alcança tudo.** O banco consegue exigir "é array" e "tem estas chaves";
   exigir "cada item tem `letra` em A–E e `texto` não vazio" em SQL fica ilegível. Zod faz isso em
   quatro linhas. É a mesma repartição de trabalho do `PADRAO_DA_CHAVE`: as duas pontas seguram e um
   teste confere que continuam dizendo a mesma coisa.

Exporta: `TIPO_QUESTAO`, `ORIGEM_QUESTAO`, `STATUS_QUESTAO`, `TIPO_MUDANCA`, `STATUS_PROVA`,
`STATUS_CANDIDATO` (listas literais), `Alternativa`/`alternativasSchema`, `Imagem`/`imagensSchema`,
`FonteCitacao`/`fonteCitacaoSchema`, `DIMENSAO_EMBEDDING = 1536`, e
`respostaValidaParaTipo(tipo, resposta)`.

Sem cliente de banco, sem `import` de `pg`, sem rede: é o projeto `unit` do Vitest.

### Migrações (`supabase/migrations/`)

Uma por task, na ordem de dependência. Aplicadas por `apply_migration` do MCP durante o
desenvolvimento e por `migracao.yml` no merge da `main` (AD-088).

---

## Testes

| Onde | Projeto Vitest | O que prova |
| --- | --- | --- |
| `tests/db/acervo-taxonomia.test.ts` | `db` | matéria/tópico existem, unicidade, candidato não é canônico, aprovar candidato exige tópico |
| `tests/db/acervo-provas.test.ts` | `db` | catálogo-alvo, estado, alvo duplicado recusado (inclusive sem caderno) |
| `tests/db/acervo-questoes.test.ts` | `db` | enums, `CHECK` de formato do AD-040, um por restrição |
| `tests/db/acervo-versionamento.test.ts` | `db` | versão nova por INSERT, anterior intacta e congelada, DELETE recusado, uma vigente só |
| `tests/db/acervo-proveniencia.test.ts` | `db` | os 3 Success Criteria de trava: publicar real sem `fonte_citacao`, sem gabarito, inédita direto |
| `tests/db/acervo-busca.test.ts` | `db` | coluna e índice de embedding/fts existem, `fts` enche sozinha, `EXPLAIN` de tópico+status usa índice |
| `tests/db/acervo-privilegios.test.ts` | `db` | RLS ligada sem policy, `anon`/`authenticated` sem escrita nem TRUNCATE |
| `src/modules/acervo/contrato.test.ts` | `unit` | schemas aceitam o formato do AD-040 e recusam o resto; dimensão = 1536 |

Todo teste de banco roda dentro de `comTransacaoRevertida` (helper da SPEC 02): a transação volta
atrás no fim, então nada sobra no banco de desenvolvimento e o DELETE que os gatilhos recusam nunca
precisa acontecer.

---

## Requirement Traceability

| Requisito | Onde é atendido | Prova |
| --- | --- | --- |
| BANCO-01 AC1 | `CHECK real_tem_proveniencia` + `fonte_citacao_completa` | `acervo-proveniencia.test.ts` |
| BANCO-01 AC2 | `fonte_citacao` persistida e legível na própria linha da questão | `acervo-questoes.test.ts` |
| BANCO-02 | tabela `provas` + `provas_alvo_unico` | `acervo-provas.test.ts` |
| BANCO-05 (taxonomia) | `materias`, `topicos`, `topico_candidato` | `acervo-taxonomia.test.ts` |
| BANCO-09 AC3 | enums + colunas do AD-039/AD-040 | `acervo-questoes.test.ts` |
| BANCO-09 (índices) | `vector(1536)` + HNSW, `fts` + GIN | `acervo-busca.test.ts` |
| BANCO-13 | PK `(id, questao_versao)`, gatilho de versão, `mudanca_tipo` | `acervo-versionamento.test.ts` |

## Contratos que esta spec publica (e que as próximas não podem contrariar)

1. `tentativas` (SPEC 05) referencia `questoes (id, questao_versao)`; matéria e rótulo do snapshot
   saem de `topicos` → `materias` por join no momento do INSERT.
2. `explicacoes` (SPEC 13) referencia o mesmo par e lê `mudanca_tipo` para decidir invalidação
   (IA-09 AC4 / AD-052): `cosmetica` não regera, `substantiva` regera.
3. Raio-X (SPEC 26) conta `origem = 'real' and status = 'publicada' and not anulada`, com `vigente`.
4. Dimensão do embedding = **1536**, `vector_cosine_ops`. Mudar exige `alter table` + re-embeddar.
5. Estado da prova é `status_prova`; quem transiciona é a SPEC 08/09.

## Riscos

| Risco | Mitigação |
| --- | --- |
| `to_tsvector('portuguese', ...)` em coluna gerada ser recusado por imutabilidade | Verificado contra o banco real na task; se falhar, cai para índice de expressão e o fato fica registrado |
| Gatilho de versão brigar com o índice único `(id) where vigente` | Resolvido por desenho (flip no `BEFORE INSERT`); tem teste que cria 3 versões seguidas |
| `numero` único por prova impedir prova com questões repetidas de propósito | Índice é parcial em `vigente`; e se aparecer prova assim, é dado real que vira AD, não improviso |
| Enum `status_prova` errar o vocabulário que a SPEC 08 vai querer | Adicionar valor a enum no Postgres é `alter type ... add value`, sem reescrever tabela — barato |
