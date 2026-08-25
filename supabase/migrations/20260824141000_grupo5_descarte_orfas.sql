-- Grupo 5 · Fase 2 — descarte das 205 questoes orfas.
--
-- Sao questoes vigentes sem topico nenhum, de um lote de teste anterior. Estado
-- conferido antes do descarte: 0 tentativas, 0 sessao_itens, 0 explicacoes
-- apontando para elas. Decisao do dono do produto.
--
-- `public.questoes` recusa DELETE por trigger, e isso protege a chave
-- estrangeira de `tentativas`. O mecanismo de descarte previsto pelo schema e
-- `status = 'rejeitada'` + `vigente = false`: some do acervo, do Raio-X, do
-- plano e de qualquer sessao. O trigger nao e desativado.

update public.questoes
   set status = 'rejeitada', vigente = false
 where vigente and topico_id is null;
