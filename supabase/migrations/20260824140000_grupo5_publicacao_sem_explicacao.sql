-- Grupo 5 · Fase 1 — a feature de explicacao sai do produto.
--
-- A porta de publicacao continua exigindo proveniencia, gabarito e a revisao
-- humana sorteada pela QA. O quarto requisito — explicacao aprovada e vigente —
-- deixa de existir: sem a feature na tela, ele so travava acervo bom.
-- Decisao do dono do produto. O restante da funcao fica identico, e o trigger
-- nao e recriado.

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

  return new;
end;
$$;

comment on function public.questoes_trava_publicacao_spec10() is
  'Porta de publicacao: proveniencia, gabarito e revisao exigida pela QA (BANCO-01/BANCO-07). A exigencia de explicacao saiu no Grupo 5.';

-- A feature sai da tela; o historico fica. `vigente = false` basta para tirar
-- toda explicacao do produto sem apagar linha nenhuma.
update public.explicacoes set vigente = false where vigente;
