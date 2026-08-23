-- SPEC 14 · GAM-02 · correção de continuidade
--
-- A sequência anterior é a da última data observada, não o maior valor de
-- qualquer data. Usar max(sequencia) ressuscita uma sequência antiga depois de
-- um dia agendado perdido.

create or replace function public.consultar_sequencia_do_dia()
returns table (
  data            date,
  sequencia       integer,
  estado          text,
  piso_entregue   boolean,
  piso_cumprido   boolean,
  tem_historico   boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id          uuid := auth.uid();
  v_hoje             date := (now() at time zone 'America/Sao_Paulo')::date;
  v_dias_estudo      smallint[];
  v_agendado         boolean;
  v_folga            boolean;
  v_plano_id         uuid;
  v_piso_entregue    boolean := false;
  v_piso_cumprido    boolean := false;
  v_estado           text;
  v_anterior         integer := 0;
  v_tem_historico    boolean := false;
begin
  if v_user_id is null then
    return;
  end if;

  select p.dias_estudo
    into v_dias_estudo
    from public.perfil_estudo p
   where p.user_id = v_user_id;

  if not found then
    return;
  end if;

  select coalesce(s.sequencia, 0)
    into v_anterior
    from public.sequencia_dia s
   where s.user_id = v_user_id
     and s.data < v_hoje
   order by s.data desc
   limit 1;

  select exists (
    select 1 from public.tentativas t where t.user_id = v_user_id
  ) into v_tem_historico;

  v_agendado := extract(dow from v_hoje)::smallint = any(
    coalesce(v_dias_estudo, array[0, 1, 2, 3, 4, 5, 6]::smallint[])
  );

  select exists (
    select 1
      from public.folgas_programadas f
     where f.user_id = v_user_id
       and f.data = v_hoje
  ) into v_folga;

  select p.id
    into v_plano_id
    from public.plano_dia p
   where p.user_id = v_user_id
     and p.data = v_hoje;

  if v_plano_id is not null then
    select exists (
      select 1
        from public.plano_bloco b
       where b.plano_dia_id = v_plano_id
         and b.nivel = 'piso'
    ) into v_piso_entregue;

    if not v_piso_entregue then
      v_piso_cumprido := true;
    else
      select not exists (
        select 1
          from public.plano_bloco b
         where b.plano_dia_id = v_plano_id
           and b.nivel = 'piso'
           and not exists (
             select 1
               from public.sessoes s
              where s.plano_bloco_id = b.id
                and s.encerrada_em is not null
           )
      ) into v_piso_cumprido;
    end if;
  end if;

  if not v_agendado then
    v_estado := 'fora_agenda';
    v_piso_cumprido := true;
  elsif v_folga then
    v_estado := 'folga';
    v_piso_cumprido := true;
  elsif v_plano_id is null then
    v_estado := 'plano_indisponivel';
  elsif v_piso_cumprido then
    v_estado := 'cumprido';
  else
    v_estado := 'piso_pendente';
  end if;

  return query
  select v_hoje,
         case when v_estado = 'cumprido' then v_anterior + 1 else v_anterior end,
         v_estado,
         v_piso_entregue,
         v_piso_cumprido,
         v_tem_historico;
end;
$$;

comment on function public.consultar_sequencia_do_dia() is
  'Calcula o anel de hoje a partir da última data histórica, sem ressuscitar sequência antiga, sem user_id recebido do cliente e sem gravar estado (GAM-02/AD-071).';

revoke all on function public.consultar_sequencia_do_dia()
  from public, anon;
grant execute on function public.consultar_sequencia_do_dia() to authenticated;
