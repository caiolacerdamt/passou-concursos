-- BANCO-09 AC3 · BANCO-13 (colunas de versao) · AD-039 · AD-040
--
-- A tabela central do produto. O acervo e o fosso (AGENTS.md), e este e o
-- formato dele.
--
-- Duas decisoes de forma explicam o resto:
--
-- (1) **A chave primaria e `(id, questao_versao)`**, e nao `id`. E exatamente o
--     par que `tentativas` (AD-042) e `explicacoes` (AD-052) referenciam. Com
--     essa PK, a FK dessas duas tabelas aponta para a versao que o aluno
--     respondeu / que a fabrica explicou, e o banco impede que ela desapareca.
--     Versao nova e **linha nova**, nunca UPDATE na anterior (AD-039).
--
-- (2) **`vigente` e coluna, e nao `max(questao_versao)` calculado.** Toda leitura
--     de produto quer "a questao de hoje": com a coluna e um indice parcial isso
--     e uma linha; com `max()` por `id` seria subconsulta em toda tela. O indice
--     unico `(id) where vigente` garante **exatamente uma** vigente por questao —
--     se o gatilho da proxima migracao falhar, o banco recusa em vez de deixar
--     duas.
--
-- Os gatilhos que fazem o versionamento acontecer e a trava de publicacao sem
-- proveniencia entram nas migracoes seguintes desta mesma spec.

create table public.questoes (
  id             uuid    not null default gen_random_uuid(),
  questao_versao integer not null default 1 check (questao_versao >= 1),
  vigente        boolean not null default true,

  -- ── de onde vem ───────────────────────────────────────────────────────────
  prova_id      uuid references public.provas(id),
  -- Numero **oficial** da banca, nunca a ordem de leitura do PDF: o edge case do
  -- M1 preve prova com numeracao fora de ordem e questao em duas colunas.
  numero        integer check (numero > 0),
  origem        origem_questao not null default 'real',
  -- Proveniencia (AD-040): banca/ano/orgao/cargo/numero. Copiada para dentro da
  -- questao de proposito, e nao lida da `provas` por join — e o que o aluno ve na
  -- tela (BANCO-01 AC2) e o que sobrevive a qualquer reorganizacao do catalogo.
  fonte_citacao jsonb,

  -- ── o que e ───────────────────────────────────────────────────────────────
  -- Nulo ate a SPEC 09 classificar. Materia sai daqui por join: guardar
  -- `materia_id` tambem criaria duas fontes que podem divergir.
  topico_id        uuid references public.topicos(id),
  tipo_questao     tipo_questao not null,
  enunciado        text not null check (length(btrim(enunciado)) > 0),
  -- AD-040: array [{letra, texto}] para multipla, NULL para certo-errado.
  alternativas     jsonb,
  -- AD-040/AD-041: array [{storage_path, posicao, alt_text}] no Supabase Storage.
  imagens          jsonb not null default '[]'::jsonb,
  -- Nulo ate o gabarito definitivo cruzar (SPEC 09).
  resposta_correta text,
  gabarito_versao  text,
  -- Anulada e mantida (historico) e nao vira treino — quem filtra e o M4.
  anulada          boolean not null default false,

  -- ── estado e sinais ───────────────────────────────────────────────────────
  status       status_questao not null default 'rascunho',
  -- Escala 1-5 estimada pela IA no MVP, calibra pelo uso (AD-040).
  dificuldade  smallint check (dificuldade between 1 and 5),
  -- 0 a 1. O piso que roteia para revisao humana vive em configuracao e e da
  -- SPEC 10 — aqui existe so o lugar do numero.
  confianca_ia numeric(4,3) check (confianca_ia >= 0 and confianca_ia <= 1),

  -- ── versionamento (BANCO-13) ──────────────────────────────────────────────
  -- Cosmetica x substantiva no momento em que a versao nasce. O IA-09 AC4
  -- (SPEC 14) le isto para decidir se regera a explicacao.
  mudanca_tipo   tipo_mudanca,
  mudanca_motivo text,

  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),

  primary key (id, questao_versao),

  -- AD-040, primeira metade: multipla escolha tem alternativas de verdade;
  -- certo-errado nao tem nenhuma. Array vazio em multipla e questao sem opcao.
  --
  -- O `alternativas is not null` na frente **nao e redundante**. `CHECK` que
  -- avalia para NULL passa em Postgres, e `jsonb_typeof(NULL)` e NULL: sem esta
  -- clausula, multipla escolha sem alternativa nenhuma entrava.
  constraint alternativas_conforme_tipo check (
    case tipo_questao
      when 'multipla_escolha' then
        alternativas is not null
        and jsonb_typeof(alternativas) = 'array'
        and jsonb_array_length(alternativas) > 0
      when 'certo_errado' then
        alternativas is null
    end
  ),

  -- AD-040, segunda metade: a letra do gabarito tem de existir no tipo. Nulo
  -- passa porque a questao vive um tempo sem gabarito, entre a extracao
  -- (SPEC 08) e o cruzamento (SPEC 09).
  constraint resposta_conforme_tipo check (
    resposta_correta is null
    or case tipo_questao
         when 'multipla_escolha' then resposta_correta in ('A', 'B', 'C', 'D', 'E')
         when 'certo_errado'     then resposta_correta in ('C', 'E')
       end
  ),

  constraint imagens_e_array check (jsonb_typeof(imagens) = 'array'),

  -- BANCO-02: questao real veio de uma prova, e com o numero oficial dela.
  -- Inedita (`gerada_ia`) nao tem nem uma nem outro, e por isso a regra e por
  -- origem e nao `not null` na coluna.
  constraint real_veio_de_prova check (
    origem <> 'real' or (prova_id is not null and numero is not null)
  ),

  -- BANCO-13: a versao 1 e o original e nao mudou nada; da 2 em diante alguem
  -- mudou algo e tem de dizer se foi cosmetico ou substantivo. As duas metades
  -- na mesma linha para nao existir versao nova sem classificacao.
  constraint mudanca_declarada_a_partir_da_v2 check (
    (questao_versao = 1) = (mudanca_tipo is null)
  )
);

comment on table public.questoes is
  'Acervo de questoes (BANCO-09/AD-039/AD-040). PK (id, questao_versao): versao nova e linha nova, nunca UPDATE na anterior. `tentativas` e `explicacoes` referenciam este par.';

comment on column public.questoes.vigente is
  'A versao que o produto serve hoje. Exatamente uma por `id`, garantida por indice unico.';

comment on column public.questoes.numero is
  'Numero oficial da banca, nunca a ordem de leitura do PDF.';

-- Uma versao vigente por questao. Se o gatilho de versionamento falhar, o banco
-- recusa em vez de deixar duas linhas se dizendo a atual.
create unique index questoes_uma_vigente_por_id
  on public.questoes (id) where vigente;

-- A mesma questao da mesma prova nao entra duas vezes (edge case do M1:
-- "mesma prova submetida duas vezes"). Parcial em `vigente` porque as versoes
-- antigas da mesma questao compartilham prova e numero de proposito.
create unique index questoes_numero_unico_na_prova
  on public.questoes (prova_id, numero)
  where vigente and prova_id is not null;

revoke insert, update, delete, truncate on public.questoes from anon, authenticated;
alter table public.questoes enable row level security;
