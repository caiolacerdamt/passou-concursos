-- RAIOX-03 · RAIOX-14 · AD-056/AD-057
--
-- A view é a fronteira entre M5 e o motor do M4. A assinatura continua
-- `(topico_id, peso)`; só o corpo muda.

create or replace view public.raiox_peso_topico
  with (security_invoker = true) as
  -- Sem perfil ativo, mantém-se o comportamento transitório da SPEC 06 para
  -- que a configuração do edital nunca desligue o plano por acidente.
  select t.id as topico_id, 1.0::numeric as peso
    from public.topicos t
   where t.ativo
     and not exists (
       select 1
         from public.perfil_concurso p
        where p.ativo
     )
  union all
  -- Com perfil ativo, o programa é o porteiro. Projeções ausentes ou com peso
  -- zero não atravessam a view e, portanto, não entram no plano do dia.
  select r.topico_id, r.peso
    from public.raiox_projecoes r
    join public.perfil_concurso p
      on p.id = r.perfil_concurso_id and p.ativo
    join public.topicos t
      on t.id = r.topico_id and t.ativo
   where r.peso > 0;

comment on view public.raiox_peso_topico is
  'FRONTEIRA M4 <-> M5 (AD-056/AD-057). Sem perfil ativo, fallback 1.0. Com perfil ativo, entrega somente tópicos do edital com peso real positivo e mantém a assinatura (topico_id, peso); o motor do plano não muda.';

-- 05:30 UTC = 02:30 BRT: a projeção precisa estar pronta antes do recálculo de
-- domínio e do plano do M4. A trava interna da função impede sobreposição.
select cron.schedule(
  'm5-recalcula-raiox',
  '30 5 * * *',
  $raiox$ select public.recalcula_raiox(); $raiox$
);
