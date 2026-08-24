-- Onda 6 (W6-A) · prontidão de conteúdo para o go-live.
--
-- `inventario_acervo` conta o acervo; esta view responde a pergunta seguinte,
-- que é a que trava o lançamento: um tópico do edital ativo tem questão apta E
-- recurso de estudo ativo para o aluno abrir hoje? Nenhum número aqui vem de
-- memória — tudo é contagem do banco.

create or replace view public.prontidao_conteudo
with (security_invoker = true)
as
  with piso as (
    select coalesce((
      select (valor #>> '{}')::integer
        from public.configuracoes_vigentes
       where chave = 'param.m1.minimo_aptas_por_topico'
         and jsonb_typeof(valor) = 'number'
         and (valor #>> '{}') ~ '^[1-9][0-9]*$'
    ), 5) as minimo_aptas
  ),
  edital as (
    select edital.topico_id::uuid as topico_id
      from public.perfil_concurso p
      cross join lateral jsonb_array_elements_text(p.programa_edital) edital(topico_id)
     where p.ativo
  ),
  recursos as (
    select topico_id, count(*) filter (where ativo)::integer as ativos
      from public.recursos_estudo
     group by topico_id
  )
  select
    i.materia_id,
    i.materia,
    i.topico_id,
    i.topico,
    exists (select 1 from edital e where e.topico_id = i.topico_id) as no_edital,
    i.publicadas,
    i.aptas_sessao,
    coalesce(r.ativos, 0) as recursos_ativos,
    piso.minimo_aptas,
    (
      i.aptas_sessao >= piso.minimo_aptas
      and coalesce(r.ativos, 0) >= 1
    ) as pronto
  from public.inventario_acervo i
  cross join piso
  left join recursos r on r.topico_id = i.topico_id;

comment on view public.prontidao_conteudo is
  'Prontidão do go-live por tópico: se está no edital ativo, quantas questões aptas tem, quantos recursos ativos tem e se atinge o piso configurável param.m1.minimo_aptas_por_topico (default 5).';

revoke all on public.prontidao_conteudo from anon, authenticated;
grant select on public.prontidao_conteudo to service_role;
