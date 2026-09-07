-- SPEC 39 · RAIOX-16 · RAIOX-18 · AD-138 · AD-142
--
-- **"Sem dado" nao e "peso zero".**
--
-- Medido em 2026-09-06 contra o banco de desenvolvimento, que e o mesmo de
-- producao enquanto a SPEC 25 nao separar ambientes: as 28 provas catalogadas
-- estao todas em `grade_status='ausente'` e nao ha uma unica etiqueta de item.
-- Com a formula do AD-138 isso e honesto e correto na projecao — as 85 linhas
-- saem em **degrau 4**, sem peso, porque nao existe documento medido que
-- sustente peso nenhum.
--
-- O que NAO pode acontecer e essa verdade atravessar a fronteira do M4: com
-- `peso = 0` em todas as linhas, `raiox_peso_topico` devolvia **zero topico** e
-- o plano do dia ficava sem nada para ordenar. O aluno perderia o produto por
-- causa de um acervo que ainda nao foi medido.
--
-- A saida ja existia no projeto e so precisava de mais um caso. A view sempre
-- teve um fallback para "sem perfil ativo" — "a configuracao do edital nunca
-- desliga o plano por acidente". Aqui ele ganha o irmao: **perfil ativo, mas
-- projecao sem nenhum lastro** cai para peso uniforme 1.0 sobre os topicos do
-- programa. O porteiro do edital continua intacto (so topico do programa passa)
-- e a projecao continua dizendo a verdade — o que muda e que o motor do plano
-- passa a tratar o edital como plano, em vez de nao ter plano.
--
-- O fallback e automatico nos dois sentidos: na primeira prova medida com
-- cobertura acima do piso, alguma linha ganha peso > 0 e a view volta sozinha a
-- entregar a projecao real. Nao ha flag, nao ha estado a limpar.

create or replace view public.raiox_peso_topico
  with (security_invoker = true) as
  -- (1) Sem perfil ativo: o fallback historico da SPEC 06.
  select t.id as topico_id, 1.0::numeric as peso
    from public.topicos t
   where t.ativo
     and not exists (select 1 from public.perfil_concurso p where p.ativo)
  union all
  -- (2) Com perfil ativo e projecao com lastro: a projecao e a unica fonte.
  select r.topico_id, r.peso
    from public.raiox_projecoes r
    join public.perfil_concurso p
      on p.id = r.perfil_concurso_id and p.ativo
    join public.topicos t
      on t.id = r.topico_id and t.ativo
   where r.peso > 0
     and exists (
       select 1
         from jsonb_array_elements_text(p.programa_edital) edital(topico_id)
        where edital.topico_id = r.topico_id::text
     )
  union all
  -- (3) Com perfil ativo e NENHUMA linha com peso: o edital inteiro, uniforme.
  select t.id, 1.0::numeric
    from public.perfil_concurso p
    cross join lateral jsonb_array_elements_text(p.programa_edital) as edital(topico_id)
    join public.topicos t
      on t.id = edital.topico_id::uuid and t.ativo
   where p.ativo
     and edital.topico_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     and not exists (
       select 1 from public.raiox_projecoes r
        where r.perfil_concurso_id = p.id and r.peso > 0
     );

comment on view public.raiox_peso_topico is
  'FRONTEIRA M4 <-> M5 (AD-056/AD-057/AD-142). Tres casos, mesma assinatura (topico_id, peso): sem perfil ativo, fallback 1.0; com projecao com lastro, a projecao manda; com perfil ativo e projecao inteira em degrau 4 (nenhuma prova medida ainda), o programa do edital entra uniforme para o plano do dia nao ficar sem topico. Sem dado nao e peso zero.';

-- Mesma regra, por aluno (AD-139). A unica diferenca continua sendo de onde vem
-- o perfil: do concurso do aluno, nao de uma flag global.
create or replace function public.raiox_peso_do_aluno(p_user_id uuid)
returns table (topico_id uuid, peso numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with perfil as (
    select public.perfil_concurso_do_aluno(p_user_id) as id
  )
  select t.id, 1.0::numeric
    from public.topicos t
   where t.ativo
     and (select id from perfil) is null
  union all
  select r.topico_id, r.peso
    from public.raiox_projecoes r
    join public.perfil_concurso p
      on p.id = r.perfil_concurso_id and p.id = (select id from perfil)
    join public.topicos t
      on t.id = r.topico_id and t.ativo
   where r.peso > 0
     and exists (
       select 1
         from jsonb_array_elements_text(p.programa_edital) edital(topico_id)
        where edital.topico_id = r.topico_id::text
     )
  union all
  select t.id, 1.0::numeric
    from public.perfil_concurso p
    cross join lateral jsonb_array_elements_text(p.programa_edital) as edital(topico_id)
    join public.topicos t
      on t.id = edital.topico_id::uuid and t.ativo
   where p.id = (select id from perfil)
     and edital.topico_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     and not exists (
       select 1 from public.raiox_projecoes r
        where r.perfil_concurso_id = p.id and r.peso > 0
     );
$$;

comment on function public.raiox_peso_do_aluno(uuid) is
  'FRONTEIRA M4 <-> M5 por aluno (AD-139/AD-142). Mesma regra da view raiox_peso_topico, inclusive o terceiro caso: concurso sem nenhuma prova medida entrega o edital uniforme em vez de nenhum topico.';

revoke all on function public.raiox_peso_do_aluno(uuid) from anon, authenticated;
