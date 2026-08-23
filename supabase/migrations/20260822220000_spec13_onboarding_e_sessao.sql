-- SPEC 13 · PAG-14 · ALUNO-05 · ALUNO-01 · IA-04 · IA-09
--
-- A superficie do aluno precisa de tres contratos que as specs anteriores
-- deixaram preparados, mas nao podiam fechar antes da primeira tela:
-- declaracao completa do perfil, retomada do bloco e leitura segura da
-- explicacao aprovada.

-- ── Onboarding ─────────────────────────────────────────────────────────────

alter table public.perfil_estudo
  add column if not exists concurso_alvo text,
  add column if not exists dias_estudo smallint[],
  add column if not exists horario_estudo time,
  add column if not exists onboarding_concluido boolean not null default false;

alter table public.perfil_estudo
  add constraint perfil_concurso_alvo_valido check (
    concurso_alvo is null
    or length(btrim(concurso_alvo)) between 2 and 160
  );

alter table public.perfil_estudo
  add constraint perfil_dias_estudo_validos check (
    dias_estudo is null
    or (
      cardinality(dias_estudo) between 1 and 7
      and dias_estudo <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  );

comment on column public.perfil_estudo.concurso_alvo is
  'Declaracao do aluno sobre o concurso que quer preparar (SPEC 13).';

comment on column public.perfil_estudo.dias_estudo is
  'Dias da semana declarados pelo aluno, 0 = domingo ate 6 = sabado.';

comment on column public.perfil_estudo.horario_estudo is
  'Horario local habitual declarado pelo aluno. Notificacoes entram em spec posterior.';

comment on column public.perfil_estudo.onboarding_concluido is
  'Marca que o aluno concluiu a declaracao minima; existencia de perfil continua bastando para o motor legado.';

-- ── Retomada da sessao ─────────────────────────────────────────────────────

alter table public.sessoes
  add column if not exists plano_bloco_id uuid
    references public.plano_bloco(id) on delete set null;

comment on column public.sessoes.plano_bloco_id is
  'Bloco do plano que originou a sessao; permite retomar itens sem resposta.';

create index if not exists sessoes_bloco_aberta_idx
  on public.sessoes (user_id, plano_bloco_id, iniciada_em desc)
  where encerrada_em is null and plano_bloco_id is not null;

-- ── Explicacao para aluno matriculado ─────────────────────────────────────
--
-- `explicacoes` continua sem SELECT direto para o navegador. A RPC e a unica
-- janela: usa auth.uid() por dentro da matricula, aceita somente a versao
-- exata e nunca devolve rascunho, invalidada ou explicacao velha.

create or replace function public.ler_explicacao_publica(
  p_questao_id uuid,
  p_questao_versao integer
)
returns table (
  texto               text,
  alternativa_correta text,
  fontes_citadas      jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.texto, e.alternativa_correta, e.fontes_citadas
    from public.explicacoes e
   where e.questao_id = p_questao_id
     and e.questao_versao = p_questao_versao
     and e.vigente
     and e.status = 'aprovada'
     and public.tem_matricula_ativa()
   limit 1;
$$;

comment on function public.ler_explicacao_publica(uuid, integer) is
  'Leitura paga e versionada da explicacao. Devolve apenas explicacao aprovada e vigente para auth.uid().';

revoke all on function public.ler_explicacao_publica(uuid, integer) from public, anon, authenticated;
grant execute on function public.ler_explicacao_publica(uuid, integer) to authenticated;
