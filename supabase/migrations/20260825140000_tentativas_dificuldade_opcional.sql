-- ALUNO · desbloqueia o registro de respostas para o acervo publicado.
-- A medição do banco de desenvolvimento encontrou 1.275 questões sem
-- dificuldade em 1.375 publicadas. O snapshot deve preservar o desconhecido
-- como NULL, não inventar 3: nenhum consumidor lê esta coluna hoje e um valor
-- inventado envenenaria o Raio-X e futuras calibrações.
alter table public.tentativas
  alter column dificuldade drop not null;
