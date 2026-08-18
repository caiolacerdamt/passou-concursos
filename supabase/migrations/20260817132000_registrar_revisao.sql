-- ALUNO-09 AC1/AC2/AC3/AC4 · AD-072 · AD-092
--
-- A conta de quando revisar mora em TypeScript (`src/modules/aluno/revisao`),
-- porque o FSRS e biblioteca TypeScript e nao existe em plpgsql. O que mora aqui
-- e a **gravacao**, e ela e uma funcao SQL pelo mesmo motivo de
-- `registrar_tentativa` na SPEC 05: sao duas escritas que nao podem divergir.
--
--   `revisao_agenda`  -> o estado atual (upsert: uma linha por aluno e topico)
--   `revisao_evento`  -> o fato (insert: append-only, nunca reescrito)
--
-- Se fossem duas idas ao banco, uma falha entre elas deixaria a agenda com um
-- `due` novo e o historico sem o evento que o produziu — e a reconstrucao do
-- ALUNO-02 AC1 passaria a mentir.
--
-- Repare no que a funcao NAO recebe: nenhuma pista de qual algoritmo pensou o
-- que. Ela recebe `p_due` pronto. E o ALUNO-09 AC3 na forma da assinatura —
-- trocar FSRS por regua fixa nao muda uma linha desta funcao.

create or replace function public.registrar_revisao(
  p_user_id     uuid,
  p_topico_id   uuid,
  p_algoritmo   text,
  p_due         date,
  p_nota        smallint,
  p_percentual  numeric,
  p_fsrs_card   jsonb    default null,
  p_regua_passo smallint default 0
)
returns table (due date, algoritmo text, regua_passo smallint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_algoritmo not in ('fsrs', 'regua_fixa') then
    raise exception 'algoritmo_desconhecido: %', p_algoritmo using errcode = 'check_violation';
  end if;

  insert into public.revisao_evento
    (user_id, topico_id, algoritmo, nota, percentual)
  values
    (p_user_id, p_topico_id, p_algoritmo, p_nota, p_percentual);

  return query
    insert into public.revisao_agenda as a
      (user_id, topico_id, algoritmo, fsrs_card, regua_passo, due, ultima_nota, atualizado_em)
    values
      (p_user_id, p_topico_id, p_algoritmo, p_fsrs_card, p_regua_passo, p_due, p_nota, now())
    on conflict (user_id, topico_id) do update
      set algoritmo     = excluded.algoritmo,
          -- O `Card` do FSRS e preservado quando quem escreveu foi a regua
          -- fixa: se o aluno voltar para o FSRS depois, a memoria acumulada
          -- ainda esta la e o intervalo nao recomeca do zero.
          fsrs_card     = coalesce(excluded.fsrs_card, a.fsrs_card),
          regua_passo   = excluded.regua_passo,
          due           = excluded.due,
          ultima_nota   = excluded.ultima_nota,
          atualizado_em = now()
    returning a.due, a.algoritmo, a.regua_passo;
end;
$$;

comment on function public.registrar_revisao is
  'Grava o resultado de um bloco Revisar (ALUNO-09). Upsert na agenda e insert no evento numa transacao so. Recebe `due` ja calculado: nao sabe qual algoritmo o produziu, que e o contrato do AC3. `security definer` porque as projecoes nao tem policy de escrita.';

revoke all on function public.registrar_revisao from public, anon;
grant execute on function public.registrar_revisao to authenticated, service_role;
