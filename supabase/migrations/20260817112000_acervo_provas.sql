-- BANCO-02 · BANCO-12 (o estado `precisa_ocr` da prova) · AD-009 · AD-041
--
-- O catalogo-alvo: quais provas o projeto quer ingerir, e em que ponto da
-- ingestao cada uma esta. A linha nasce **antes** do PDF existir na mao — e
-- exatamente por isso que o estado inicial e `catalogada` e nao `extraindo`.
--
-- O AD-076 tirou do caminho critico de lancamento a meta de "~10 anos x 3
-- bancas" do AD-009 (o acervo de lancamento sao as ultimas 3-4 provas do BB), mas
-- **o registro continua**: a meta virou continua, e ingerir com o produto
-- vendendo exige saber o que falta.

create table public.provas (
  id     uuid     primary key default gen_random_uuid(),

  -- `banca` e text, nao enum, de proposito. O AD-039 fixou enum para o que M4/M2
  -- leem no snapshot; banca nao esta la. O produto e multi-concurso (SPEC 26), e
  -- enum obrigaria migracao para catalogar a proxima banca — o oposto do que um
  -- catalogo-alvo serve.
  banca  text     not null,
  ano    smallint not null check (ano between 1990 and 2100),
  orgao  text     not null,
  cargo  text     not null,
  -- "Tipo 1", "Manha", "Prova A": a mesma prova sai em mais de um caderno, com
  -- as questoes na mesma ordem ou embaralhadas. Sem esta coluna, o alvo unico
  -- abaixo recusaria o segundo caderno como se fosse duplicata.
  caderno text,

  status status_prova not null default 'catalogada',
  -- Preenchido pela SPEC 08, quando o PDF chega ao Supabase Storage.
  pdf_storage_path text,
  observacao       text,

  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

comment on table public.provas is
  'Catalogo-alvo de provas oficiais (BANCO-02, AD-009) e estado da ingestao. Fonte legal e o PDF da banca (AD-003); raspar concorrente e proibido. Quem move o status e a SPEC 08/09.';

-- "Submeter a mesma prova duas vezes nao duplica" (edge case do M1) passa a ser
-- verdade no banco, e nao no script.
--
-- O `coalesce(caderno, '')` nao e enfeite: em indice unico, NULL nao colide com
-- NULL. Sem ele, duas linhas identicas sem caderno passariam as duas.
create unique index provas_alvo_unico
  on public.provas (banca, ano, orgao, cargo, coalesce(caderno, ''));

-- A fila de trabalho da fabrica: o que ainda nao terminou, mais antigo primeiro.
create index provas_pendentes_idx
  on public.provas (status, ano desc)
  where status not in ('concluida', 'falhou');

revoke insert, update, delete, truncate on public.provas from anon, authenticated;
alter table public.provas enable row level security;
