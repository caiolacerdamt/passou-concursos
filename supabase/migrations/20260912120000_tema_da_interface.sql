-- Tema da interface do aluno (UI-01/UI-03 · AD-149).
--
-- O tema escuro do `/app/*` e preferencia do aluno, nao corte de produto: por
-- isso mora no perfil e nao em `configuracao`, e nao entra atras de flag. O
-- valor acompanha a pessoa entre aparelhos — o cookie `tema-do-app` que o shell
-- le no servidor e espelho desta coluna, nunca a verdade.
--
-- `sistema` e o default e e o comportamento de hoje: quem nunca tocar o botao
-- delega ao `prefers-color-scheme` do aparelho, e quem esta no claro nao ve
-- diferenca nenhuma.
--
-- LGPD: `perfil_estudo` ja e grupo 1 (`src/modules/lgpd/grupo-1.ts`). O
-- esquecimento apaga a linha inteira (`delete from public.perfil_estudo where
-- user_id = ...`) e a exportacao varre a tabela inteira por `user_id` — coluna
-- nova entra coberta sem alterar nenhuma das duas rotinas. Conferido nesta
-- rodada em `20260911120000_exportacao_do_titular.sql`, nao presumido.

alter table public.perfil_estudo
  add column tema text not null default 'sistema',
  add constraint perfil_tema_conhecido check (tema in ('claro', 'escuro', 'sistema'));

comment on column public.perfil_estudo.tema is
  'Tema da superficie logada: claro, escuro ou sistema. `sistema` delega ao '
  '`prefers-color-scheme` do aparelho e e o default. Fonte da verdade; o cookie '
  '`tema-do-app` e espelho para o shell pintar sem piscar.';
