-- AD-115 · a revisão avulsa da tela de prática
--
-- `/app/sessao` deixou de listar bloco do plano e passou a oferecer a revisão
-- que **venceu e não entrou no plano de hoje**. Essa sessão não pertence a um
-- bloco, então cai no mesmo problema que a refação já resolvia: duas
-- requisições simultâneas do mesmo aluno criariam duas sessões abertas.
--
-- A solução reusa a chave e o índice que já existem. Só o **domínio** da coluna
-- cresce: além de `tópico|causa`, ela passa a aceitar `tópico|revisao_avulsa`.
-- O qualificador não pertence a `causa_erro`, então as duas famílias nunca
-- colidem, e o formato continua único — quem lê a chave segue tirando o tópico
-- do primeiro campo.
--
-- Nenhuma estrutura muda: `sessoes_uma_refacao_aberta` já cobre qualquer valor
-- não nulo. O que esta migration corrige é o **comentário**, que descrevia um
-- domínio que deixou de ser o real. Comentário errado no schema é o tipo de
-- coisa que ninguém percebe até alguém decidir com base nele.

comment on column public.sessoes.refacao_chave is
  'Chave determinística de sessão sem bloco, na forma `tópico|qualificador`: `tópico|causa` para a refação do caderno (AD-101) e `tópico|revisao_avulsa` para a revisão puxada da tela de prática (AD-115). Nula em sessões do plano; uma sessão aberta por aluno e chave.';

comment on index public.sessoes_uma_refacao_aberta is
  'Duplo clique na mesma linha do caderno — ou na mesma revisão vencida — retoma a sessão vencedora; sessão encerrada pode ser refeita depois.';
