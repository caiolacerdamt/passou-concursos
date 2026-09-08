-- AD-146 · BANCO-02 · SPEC 40 T3
--
-- A abertura ja sabia tudo o que o vinculo precisa — `abertura_id`,
-- `concurso_id`, `prova_id` e o operador — e mesmo assim nao gravava vinculo
-- nenhum. Aprovar a prova **dentro** da abertura ja e a decisao humana de que
-- ela pertence ao concurso; pedir a mesma decisao de novo em outra tela seria
-- perguntar duas vezes a mesma coisa.
--
-- Por isso nao ha pergunta nova aqui, nem acao nova no comando: o vinculo nasce
-- dentro da transacao do download. Se ele falhar, o download inteiro volta atras
-- — meio registro (arquivo medido, prova sem lastro) e pior que nenhum, porque
-- o relatorio diria que a prova esta pronta.

create or replace function public.registrar_documento_baixado(
  p_abertura  uuid,
  p_operador  uuid,
  p_documento uuid,
  p_bytes     integer,
  p_sha256    text,
  p_prova     uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento public.concurso_documentos%rowtype;
  v_concurso  uuid;
begin
  perform public.exigir_operador_ativo(p_operador);

  select d.* into v_documento
    from public.concurso_documentos d
   where d.id = p_documento and d.abertura_id = p_abertura
   for update;

  if v_documento.id is null then
    raise exception 'documento_fora_da_abertura';
  end if;
  if v_documento.decisao <> 'aprovado' then
    raise exception 'documento_nao_aprovado';
  end if;
  if p_bytes is null or p_bytes <= 0 or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'arquivo_invalido';
  end if;
  if v_documento.tipo = 'prova' and p_prova is null then
    raise exception 'prova_obrigatoria';
  end if;
  if v_documento.tipo = 'edital' and p_prova is not null then
    raise exception 'edital_nao_tem_prova';
  end if;

  update public.concurso_documentos
     set baixado_em = coalesce(baixado_em, now()),
         bytes      = p_bytes,
         sha256     = p_sha256,
         prova_id   = p_prova
   where id = p_documento;

  if p_prova is not null then
    update public.provas set url_origem = v_documento.url, atualizada_em = now()
     where id = p_prova;
    if not found then
      raise exception 'prova_inexistente';
    end if;

    -- O vinculo, na mesma transacao (AD-146). `vincular_prova_ao_concurso` e
    -- idempotente, entao o retry de um download interrompido reencontra o mesmo
    -- vinculo em vez de assinar duas vezes o mesmo fato.
    select a.concurso_id into v_concurso
      from public.aberturas_concurso a where a.id = p_abertura;

    perform public.vincular_prova_ao_concurso(
      v_concurso, p_prova, p_operador,
      -- Motivo sem uma linha do documento: o titulo e material da conversa, e a
      -- trilha guarda a decisao, nunca o conteudo da prova (AD-140).
      'prova aprovada e baixada na abertura do concurso',
      p_abertura
    );
  end if;
end;
$$;

comment on function public.registrar_documento_baixado(uuid, uuid, uuid, integer, text, uuid) is
  'Registra o download de um documento aprovado e, quando ele e prova, grava a proveniencia (url_origem) E o vinculo concurso-prova na MESMA transacao (AD-146). Falha do vinculo desfaz o registro do download inteiro.';
