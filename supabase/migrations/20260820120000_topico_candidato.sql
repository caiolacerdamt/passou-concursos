-- BANCO-05 (P3 AC1)
--
-- "A IA sugere um topico que nao existe -> candidato, nunca canonico." A SPEC 04
-- criou a tabela separada, que ja impede a IA de escrever em `topicos`. O que
-- falta e a **contagem**: a tela de curadoria (SPEC 15) ordena por
-- `ocorrencias`, e topico sugerido 40 vezes so e candidato mais forte se as 40
-- sugestoes cairem na mesma linha em vez de virarem 40 linhas iguais.
--
-- A unicidade e **por nome normalizado e so entre os pendentes**. As duas metades
-- importam: sem normalizar, "Juros Compostos" e "juros compostos" seriam dois
-- candidatos; e limitar aos pendentes deixa o mesmo nome ser sugerido de novo
-- depois de ter sido rejeitado uma vez — o que e informacao, nao ruido.

create unique index topico_candidato_pendente_unico
  on public.topico_candidato (
    lower(btrim(nome_sugerido)),
    coalesce(materia_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'pendente';

/*
 * Registra uma sugestao de topico novo, somando quando ela ja existe.
 *
 * `security invoker`: quem chama e o job da fabrica, com a chave de servico.
 * Nao e concedida a `authenticated` — nao ha aluno nenhum sugerindo topico, e
 * funcao concedida sem necessidade e superficie aberta de graca (licao 11 do
 * STATE.md).
 */
create or replace function public.registrar_topico_candidato(
  p_nome    text,
  p_materia uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'candidato a topico precisa de nome';
  end if;

  -- O `on conflict` repete a expressao **e** o predicado do indice parcial:
  -- Postgres so casa o conflito com o indice quando as duas batem.
  insert into public.topico_candidato (nome_sugerido, materia_id)
  values (btrim(p_nome), p_materia)
  on conflict (
    lower(btrim(nome_sugerido)),
    coalesce(materia_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) where status = 'pendente'
  do update set ocorrencias = public.topico_candidato.ocorrencias + 1
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.registrar_topico_candidato(text, uuid) is
  'BANCO-05 P3 AC1. Sugestao de topico que nao existe na taxonomia. A IA chega ate aqui e nao alcanca `topicos`: quem cria o canonico e o operador, na tela de curadoria.';

revoke all on function public.registrar_topico_candidato(text, uuid) from anon, authenticated;
