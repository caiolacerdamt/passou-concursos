-- IA-02 AC4 · BANCO-03
--
-- Com que modelo cada bloco foi extraido.
--
-- O envio e a colheita sao **execucoes diferentes**, separadas por ate 24 horas.
-- Na colheita a matriz de configuracao ja pode ter mudado — e a troca de modelo
-- sem deploy e justamente o ponto dela (AD-078). Ler a matriz na colheita e
-- registrar aquele modelo seria auditoria mentirosa: diria que o bloco nasceu
-- de um modelo que nao o produziu.
--
-- Guardar o destino no envio e o que faz `ia_geracoes` registrar a verdade. O
-- banco nao conhece modelo nenhum: e jsonb opaco, do mesmo jeito que
-- `configuracoes` guarda a matriz.
alter table public.prova_lote add column destino jsonb;

comment on column public.prova_lote.destino is
  'O destino (modelo, versao, esforco) que a matriz resolveu no momento do ENVIO. A colheita le daqui, e nao da matriz de hoje: entre as duas execucoes passam ate 24 horas e a matriz pode ter mudado (IA-02 AC4).';
