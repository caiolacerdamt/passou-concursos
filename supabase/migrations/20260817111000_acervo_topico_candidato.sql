-- BANCO-05 (P3 AC1)
--
-- Quando a IA classifica uma questao e sugere um topico que nao existe na
-- taxonomia, o sistema SHALL marca-lo como candidato e SHALL NOT criar topico
-- canonico sozinho.
--
-- A forma escolhida para cumprir isso e uma **tabela separada**, e nao uma
-- coluna `aprovado` dentro de `topicos`. Com tabela separada, "a IA criou topico
-- sozinha" deixa de ser um bug possivel: o script de classificacao escreve aqui
-- e nao tem para onde escrever em `topicos`. Com coluna, bastaria um INSERT com
-- o default errado.
--
-- Quem aprova e o operador, na tela de curadoria da taxonomia (BANCO-10,
-- SPEC 18). Aprovar cria a linha em `topicos` e amarra as duas por `topico_id`.

create table public.topico_candidato (
  id            uuid             primary key default gen_random_uuid(),
  nome_sugerido text             not null,
  -- Pode vir sem palpite de materia: a IA as vezes sabe o topico e nao sabe
  -- onde ele mora.
  materia_id    uuid             references public.materias(id),
  status        status_candidato not null default 'pendente',
  -- Para a tela da SPEC 18 ordenar por volume: topico sugerido 40 vezes e
  -- candidato mais forte do que um sugerido uma vez.
  ocorrencias   integer          not null default 1 check (ocorrencias > 0),
  -- Preenchido no momento da aprovacao, apontando para o topico que nasceu.
  topico_id     uuid             references public.topicos(id),
  sugerido_em   timestamptz      not null default now(),
  decidido_em   timestamptz,
  decidido_por  uuid             references auth.users(id),

  -- Aprovado sem topico e candidato aprovado que nao virou nada; pendente com
  -- topico e topico criado sem decisao. As duas metades da mesma regra.
  constraint candidato_aprovado_aponta_topico
    check ((status = 'aprovado') = (topico_id is not null)),

  -- Decisao sem autor nem data e decisao que ninguem assinou. `decidido_por`
  -- aponta para o **operador**, nao para o aluno: esta tabela nao e grupo 1
  -- (AD-027) e nao entra na rotina de esquecimento da SPEC 32.
  constraint candidato_decidido_tem_autor
    check ((status = 'pendente') = (decidido_em is null and decidido_por is null))
);

comment on table public.topico_candidato is
  'Topico sugerido pela IA que nao existe na taxonomia (BANCO-05 P3 AC1). Tabela separada de `topicos` de proposito: a IA escreve aqui e nao alcanca o canonico. Quem aprova e o operador na tela da SPEC 18.';

-- A fila de curadoria e "o que esta pendente, mais frequente primeiro".
create index topico_candidato_pendentes_idx
  on public.topico_candidato (ocorrencias desc, sugerido_em)
  where status = 'pendente';

revoke insert, update, delete, truncate on public.topico_candidato from anon, authenticated;
alter table public.topico_candidato enable row level security;
