-- SPEC 13 · ALUNO-01 · retomada sem duplicidade
--
-- A tela consulta antes de inserir, mas duas requisições simultâneas ainda
-- podem passar pelo mesmo SELECT. O índice é a última linha de defesa: por
-- aluno e bloco só pode existir uma sessão aberta. Sessão encerrada continua
-- no histórico e pode nascer outra depois.

create unique index if not exists sessoes_uma_aberta_por_bloco
  on public.sessoes (user_id, plano_bloco_id)
  where encerrada_em is null and plano_bloco_id is not null;

comment on index public.sessoes_uma_aberta_por_bloco is
  'Uma sessão aberta por aluno e bloco do plano. A concorrência que perder o índice retoma a sessão vencedora.';
