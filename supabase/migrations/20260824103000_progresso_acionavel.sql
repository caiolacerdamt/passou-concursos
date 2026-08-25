-- W4-A · ALUNO-02/ALUNO-10 · refação acionável do caderno
--
-- Sessões vindas do plano são deduplicadas por `plano_bloco_id`. A refação
-- não pertence a um bloco, então precisa de uma chave própria para que duas
-- requisições simultâneas do mesmo aluno/filtro não criem duas sessões abertas.

alter table public.sessoes
  add column if not exists refacao_chave text;

comment on column public.sessoes.refacao_chave is
  'Chave determinística do filtro de refação do caderno (tópico|causa). Nula em sessões do plano; uma sessão aberta por aluno e filtro.';

create unique index if not exists sessoes_uma_refacao_aberta
  on public.sessoes (user_id, refacao_chave)
  where encerrada_em is null and refacao_chave is not null;

comment on index public.sessoes_uma_refacao_aberta is
  'Duplo clique na mesma linha do caderno retoma a sessão de refação vencedora; sessão encerrada pode ser refeita depois.';
