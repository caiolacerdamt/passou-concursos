-- BANCO-07
--
-- A questao entra na fila quando nasce (ou quando sua confianca muda), antes
-- de qualquer tentativa de publicacao. A porta de publicacao continua sendo
-- uma segunda defesa: ela so consulta a decisao humana ja registrada.

create or replace function public.motivo_revisao_spec10(
  p_questao_id uuid,
  p_origem public.origem_questao,
  p_confianca numeric
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_piso numeric;
  v_amostra numeric;
  v_hash numeric;
begin
  if p_origem = 'gerada_ia' then
    return 'gerada_ia';
  end if;

  select (valor #>> '{}')::numeric
    into v_piso
    from public.configuracoes_vigentes
   where chave = 'param.m1.piso_confianca_ia';
  v_piso := coalesce(v_piso, 0.95);

  if coalesce(p_confianca, 0) < v_piso then
    return 'baixa_confianca';
  end if;

  select (valor #>> '{}')::numeric
    into v_amostra
    from public.configuracoes_vigentes
   where chave = 'param.m1.amostra_qa_real';
  v_amostra := coalesce(v_amostra, 0.1);
  if v_amostra < 0 or v_amostra > 1 then
    v_amostra := 1;
  end if;

  v_hash := mod((hashtextextended(p_questao_id::text, 0) % 10000 + 10000), 10000);
  if v_hash < round(v_amostra * 10000) then
    return 'amostra_qa_real';
  end if;

  return null;
end;
$$;

comment on function public.motivo_revisao_spec10(uuid, public.origem_questao, numeric) is
  'Calcula o motivo unico de QA que deve abrir a fila antes da publicacao (BANCO-07).';

create or replace function public.rotear_questao_revisao_spec10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_prioridade smallint;
begin
  if new.status in ('publicada', 'rejeitada', 'precisa_ocr') then
    return new;
  end if;

  v_motivo := public.motivo_revisao_spec10(
    new.id,
    new.origem,
    new.confianca_ia
  );

  if v_motivo is null then
    return new;
  end if;

  v_prioridade := case v_motivo
    when 'gerada_ia' then 100
    when 'baixa_confianca' then 100
    else 10
  end;

  perform public.enfileirar_questao_revisao(
    new.id,
    new.questao_versao,
    v_motivo,
    v_prioridade,
    'roteamento automatico da QA da SPEC 10'
  );

  return new;
end;
$$;

comment on function public.rotear_questao_revisao_spec10() is
  'Abre a pendencia da fila unica quando a origem, a confianca ou a amostra exige QA humana.';

drop trigger if exists questoes_roteamento_revisao_spec10 on public.questoes;

create trigger questoes_roteamento_revisao_spec10
  after insert or update of origem, confianca_ia on public.questoes
  for each row execute function public.rotear_questao_revisao_spec10();

create or replace function public.questoes_trava_publicacao_spec10()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
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

  v_motivo := public.motivo_revisao_spec10(
    new.id,
    new.origem,
    new.confianca_ia
  );

  if v_motivo is not null and not exists (
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
