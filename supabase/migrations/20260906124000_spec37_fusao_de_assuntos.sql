-- SPEC 37 · AD-139 (trade-off) · contrato para a SPEC 40
--
-- Medir e treinar passam ambos pelo assunto canonico, entao a lista de assuntos
-- incha: cada concurso novo propoe assuntos e aparece quase-duplicata. Fundir
-- tem de ser operacao suportada — e e **segura** porque o historico esta
-- congelado por snapshot (AD-042): `tentativas` carrega o rotulo do momento da
-- resposta, entao reclassificar nao desloca o passado.
--
-- Aqui entra so a operacao. A tela de fusao e da SPEC 40.

alter table public.topicos
  add column if not exists fundido_em          timestamptz,
  add column if not exists fundido_em_topico_id uuid references public.topicos(id);

comment on column public.topicos.fundido_em_topico_id is
  'Para onde este assunto foi fundido. O topico nunca e apagado: apagar arrebentaria a FK do historico (mesma razao do `ativo`).';

alter table public.topicos
  add constraint topicos_fusao_coerente check (
    (fundido_em is null) = (fundido_em_topico_id is null)
  );

alter table public.topicos
  add constraint topicos_fusao_nao_circular check (fundido_em_topico_id <> id);

create or replace function public.fundir_assuntos_canonicos(
  p_origem      uuid,
  p_destino     uuid,
  p_operador_id uuid,
  p_motivo      text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_questoes integer := 0;
begin
  if p_origem = p_destino then
    raise exception 'fusao_no_mesmo_assunto';
  end if;

  -- `operadores` guarda `operador_id`, nao `user_id`: no inventario LGPD do
  -- projeto `user_id` e vocabulario do titular. `operador_ativo` ja e a
  -- pergunta pronta desde a SPEC 15.
  if not public.operador_ativo(p_operador_id) then
    raise exception 'operador_invalido';
  end if;

  if p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'motivo_obrigatorio';
  end if;

  if not exists (select 1 from public.topicos t where t.id = p_origem)
     or not exists (select 1 from public.topicos t where t.id = p_destino) then
    raise exception 'assunto_inexistente';
  end if;

  -- Fundir num assunto ja fundido criaria cadeia; o operador funde no vigente.
  if exists (select 1 from public.topicos t
              where t.id = p_destino and t.fundido_em_topico_id is not null) then
    raise exception 'destino_ja_fundido';
  end if;

  -- ── O que se move: acervo e catalogo ─────────────────────────────────────
  --
  -- So a versao vigente. A versao antiga esta congelada e o gatilho
  -- `questoes_protege_versao` recusa UPDATE nela (AD-039) — e recusa com razao:
  -- ela e o texto que uma tentativa antiga respondeu.
  update public.questoes set topico_id = p_destino
   where topico_id = p_origem and vigente;
  get diagnostics v_questoes = row_count;

  update public.recursos_estudo  set topico_id = p_destino where topico_id = p_origem;
  update public.base_referencia  set topico_id = p_destino where topico_id = p_origem;
  update public.topico_candidato set topico_id = p_destino where topico_id = p_origem;

  -- O mapa dos concursos: move quando o concurso ainda nao tem o destino,
  -- descarta quando ja tem (o unique (concurso_id, topico_id) e o que garante
  -- que o assunto tem um pai so dentro de um concurso).
  delete from public.concurso_materia_assuntos a
   where a.topico_id = p_origem
     and exists (select 1 from public.concurso_materia_assuntos d
                  where d.concurso_id = a.concurso_id and d.topico_id = p_destino);
  update public.concurso_materia_assuntos set topico_id = p_destino
   where topico_id = p_origem;

  -- ── O que se move: projecoes do aluno ────────────────────────────────────
  --
  -- Move a linha quando o aluno nao tem linha no destino; descarta a do origem
  -- quando tem — o destino ja e a verdade viva daquele aluno, e somar duas
  -- notas de dominio inventaria numero. `dominio_topico` e `caderno_erros` sao
  -- recalculaveis a partir de `tentativas`; a agenda de revisao nao e, e por
  -- isso ela e movida em vez de descartada.
  delete from public.dominio_topico o where o.topico_id = p_origem
     and exists (select 1 from public.dominio_topico d
                  where d.user_id = o.user_id and d.topico_id = p_destino);
  update public.dominio_topico set topico_id = p_destino where topico_id = p_origem;

  delete from public.revisao_agenda o where o.topico_id = p_origem
     and exists (select 1 from public.revisao_agenda d
                  where d.user_id = o.user_id and d.topico_id = p_destino);
  update public.revisao_agenda set topico_id = p_destino where topico_id = p_origem;

  update public.revisao_evento set topico_id = p_destino where topico_id = p_origem;

  -- A chave do caderno e (user_id, topico_id, causa_erro): o choque so existe
  -- quando o aluno errou pela **mesma causa** nos dois assuntos.
  delete from public.caderno_erros o where o.topico_id = p_origem
     and exists (select 1 from public.caderno_erros d
                  where d.user_id = o.user_id and d.topico_id = p_destino
                    and d.causa_erro = o.causa_erro);
  update public.caderno_erros set topico_id = p_destino where topico_id = p_origem;

  -- A projecao do Raio-X e recalculavel e idempotente (RAIOX-14): a linha do
  -- origem some no proximo recalculo, nao ha o que somar aqui.
  delete from public.raiox_projecoes where topico_id = p_origem;

  -- ── O que NAO se move ────────────────────────────────────────────────────
  --
  -- `tentativas`. E o invariante 2 do projeto: cada tentativa carrega a
  -- etiqueta do assunto no momento da resposta, e reclassificar nao desloca
  -- historico. E exatamente isso que torna a fusao segura (AD-042).

  update public.topicos
     set ativo = false,
         fundido_em = now(),
         fundido_em_topico_id = p_destino
   where id = p_origem;

  insert into public.operador_acoes
    (operador_id, tipo, entidade, entidade_id, motivo, dados)
  values (
    p_operador_id, 'fundir', 'topicos', p_origem::text, p_motivo,
    jsonb_build_object('destino', p_destino, 'questoes_movidas', v_questoes)
  );

  return v_questoes;
end;
$$;

comment on function public.fundir_assuntos_canonicos(uuid, uuid, uuid, text) is
  'Funde dois assuntos canonicos. Move acervo, catalogo, mapa dos concursos e projecoes do aluno; NAO toca em `tentativas` (snapshot congelado, AD-042). A tela e da SPEC 40.';

revoke all on function public.fundir_assuntos_canonicos(uuid, uuid, uuid, text)
  from anon, authenticated;
