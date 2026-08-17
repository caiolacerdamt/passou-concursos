-- BANCO-09 AC1/AC3 (parte: schema e indice) · AD-005 · AD-040
--
-- As colunas e os indices da busca hibrida. **Preencher o embedding e a SPEC 11**;
-- aqui ele nasce nulo, e e isso que a spec 04 promete.
--
-- Por que a estrutura entra antes do conteudo: quem le esta coluna e a SPEC 11
-- (busca e dedup), a SPEC 13 (grounding) e a SPEC 26 (Raio-X). Mudar tipo de
-- coluna depois que existem 3 mil questoes e reescrita de tabela; agora e uma
-- linha.
--
-- ── A dimensao, verificada em fonte primaria (Context7, 2026-08-17) ──────────
--
-- Cohere `embed-v4`: `output_dimension` aceita 256, 512, 1024 ou **1536**, e o
-- default e 1536 (OpenAPI oficial da Cohere, POST /v2/embed).
-- pgvector: HNSW suporta `vector` ate **2.000** dimensoes (halfvec ate 4.000).
-- 1536 cabe com folga, entao nao ha necessidade de halfvec nem de quantizacao.
--
-- Fica em 1536, o default do fornecedor. As dimensoes menores existem
-- (Matryoshka) e economizariam espaco, mas escolher 512 sem medir a perda de
-- qualidade de busca e trocar precisao por bytes num acervo que ainda nao tem uma
-- questao dentro.
--
-- **Trocar a dimensao depois** = `alter table` + re-embeddar o acervo em lote. O
-- edge case do M1 ja preve essa operacao como barata ("trocar o provedor de
-- embedding SHALL permitir re-embeddar em lote sem tocar no fato da questao"), e
-- o numero **nao** vai para a tabela de configuracao: e tipo de coluna, mudar
-- exige migracao de qualquer forma, e guardar em config so criaria duas fontes
-- que podem divergir. O espelho em codigo esta em `src/modules/acervo/contrato.ts`,
-- com teste comparando os dois lados.

create extension if not exists vector;

alter table public.questoes
  add column embedding vector(1536);

comment on column public.questoes.embedding is
  'Cohere embed-v4, 1536 dimensoes (AD-005/AD-040). Nulo aqui: QUEM PREENCHE E A SPEC 11. Trocar a dimensao exige alter table + re-embeddar em lote.';

-- `fts` e coluna **gerada**: enche sozinha no INSERT e no UPDATE, sem gatilho e
-- sem script. Uma questao nunca fica com o texto e sem o indice dele.
--
-- Indexa so o `enunciado`, e isso e escolha registrada, nao esquecimento: coluna
-- gerada exige expressao IMMUTABLE, e puxar texto de dentro do `alternativas`
-- jsonb dentro da expressao gerada e risco a troco de pouco. A SPEC 11 e dona da
-- busca e pode estender com o numero de acerto na mao.
alter table public.questoes
  add column fts tsvector generated always as (
    to_tsvector('portuguese', coalesce(enunciado, ''))
  ) stored;

comment on column public.questoes.fts is
  'tsvector PT do enunciado (BANCO-09 AC1). Coluna gerada: enche sozinha. So o enunciado — alternativas ficam para a SPEC 11.';

-- ── Indices ─────────────────────────────────────────────────────────────────

-- Busca por similaridade (SPEC 11, dedup por embedding). Cosseno porque e a
-- metrica que o Cohere recomenda para os embeddings dele e a que o threshold de
-- duplicata do M1 pressupoe.
create index questoes_embedding_hnsw_idx
  on public.questoes using hnsw (embedding vector_cosine_ops);

create index questoes_fts_idx
  on public.questoes using gin (fts);

-- Success Criteria nº4 da spec: busca por topico + status usa indice. Tambem
-- cobre a FK `questoes_topico_id_fkey`, que o advisor do Supabase apontava como
-- sem indice.
create index questoes_topico_status_idx
  on public.questoes (topico_id, status) where vigente;

-- Contrato do Raio-X (SPEC 26): a taxa de frequencia conta `origem = 'real'` e
-- `status = 'publicada'`. Inedita nunca entra na conta — invariante nº3.
create index questoes_origem_status_idx
  on public.questoes (origem, status) where vigente;
