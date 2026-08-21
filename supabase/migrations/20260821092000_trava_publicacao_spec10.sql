-- BANCO-01 · BANCO-07 · IA-01
--
-- A publicacao e uma decisao do banco. O trigger existe para que uma chave de
-- servico, um script novo e uma futura rota de operador encontrem a mesma
-- porta, sem depender de lembrar a validacao no chamador.

alter table public.questoes
  drop constraint if exists gerada_ia_passa_por_revisao;

create or replace function public.questoes_trava_publicacao_spec10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_piso numeric;
  v_amostra numeric;
  v_hash numeric;
  v_exige_revisao boolean := false;
begin
  if new.status <> 'publicada' then
    return new;
  end if;

  -- Repetimos as mensagens das constraints anteriores para que a trava nova
  -- nao esconda a causa mais basica de um INSERT invalido.
  if new.origem = 'real' and new.fonte_citacao is null then
    raise exception 'real_tem_proveniencia';
  end if;
  if new.resposta_correta is null then
    raise exception 'publicada_tem_gabarito';
  end if;

  -- Default conservador de fail-closed. Quando existe override, a tabela de
  -- configuracao vence; valor quebrado interrompe a publicacao em vez de abrir.
  select (valor #>> '{}')::numeric
    into v_piso
    from public.configuracoes_vigentes
   where chave = 'param.m1.piso_confianca_ia';
  v_piso := coalesce(v_piso, 0.95);

  select (valor #>> '{}')::numeric
    into v_amostra
    from public.configuracoes_vigentes
   where chave = 'param.m1.amostra_qa_real';
  v_amostra := coalesce(v_amostra, 0.1);
  if v_amostra < 0 or v_amostra > 1 then
    v_amostra := 1;
  end if;

  if new.origem = 'gerada_ia'
     or coalesce(new.confianca_ia, 0) < v_piso then
    v_exige_revisao := true;
  elsif new.origem = 'real' then
    v_hash := mod((hashtextextended(new.id::text, 0) % 10000 + 10000), 10000);
    v_exige_revisao := v_hash < round(v_amostra * 10000);
  end if;

  if v_exige_revisao and not exists (
    select 1
      from public.questao_revisoes as r
     where r.questao_id = new.id
       and r.questao_versao = new.questao_versao
       and r.status = 'aprovada'
  ) then
    if new.origem = 'gerada_ia' then
      raise exception 'gerada_ia_passa_por_revisao';
    end if;
    raise exception 'questao_exige_revisao_humana';
  end if;

  if not exists (
    select 1
      from public.explicacoes as e
     where e.questao_id = new.id
       and e.questao_versao = new.questao_versao
       and e.vigente
       and e.status = 'aprovada'
  ) then
    raise exception 'explicacao_nao_aprovada';
  end if;

  return new;
end;
$$;

comment on function public.questoes_trava_publicacao_spec10() is
  'Porta de publicacao: proveniencia, gabarito, explicacao e revisao exigida pela QA (BANCO-01/BANCO-07/IA-01).';

create trigger questoes_trava_publicacao_spec10
  before insert or update on public.questoes
  for each row execute function public.questoes_trava_publicacao_spec10();

create or replace function public.publicar_questao(
  p_questao_id uuid,
  p_questao_versao integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.questoes
     set status = 'publicada'
   where id = p_questao_id
     and questao_versao = p_questao_versao
     and vigente;

  if not found then
    raise exception 'questao_vigente_nao_encontrada';
  end if;

  return true;
end;
$$;

comment on function public.publicar_questao(uuid, integer) is
  'Publica a versao vigente depois de passar pela trava do banco (SPEC 10).';

revoke all on function public.publicar_questao(uuid, integer) from public, anon, authenticated;
grant execute on function public.publicar_questao(uuid, integer) to service_role;

