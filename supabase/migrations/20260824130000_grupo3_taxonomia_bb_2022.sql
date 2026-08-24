-- GRUPO 3 · taxonomia fechada do edital BB Seleção Externa 2022/001
--
-- As matérias já existem no acervo. Esta migration falha se alguma das oito
-- matérias do edital não estiver presente, em vez de criar uma duplicata ou
-- mascarar um banco fora do estado esperado.

do $$
declare
  faltantes text[];
begin
  select array_agg(nome order by nome)
    into faltantes
    from (
      values
        ('Língua Portuguesa'),
        ('Língua Inglesa'),
        ('Matemática'),
        ('Atualidades do Mercado Financeiro'),
        ('Matemática Financeira'),
        ('Conhecimentos Bancários'),
        ('Conhecimentos de Informática'),
        ('Vendas e Negociação')
    ) as esperadas(nome)
   where not exists (
     select 1 from public.materias m where m.nome = esperadas.nome
   );

  if faltantes is not null then
    raise exception 'GRUPO 3: matérias ausentes no banco: %', faltantes;
  end if;
end;
$$;

with edital(materia, topico, ordem) as (
  values
    ('Língua Portuguesa', 'Interpretação', 1),
    ('Língua Portuguesa', 'Ortografia', 2),
    ('Língua Portuguesa', 'Classes de palavras', 3),
    ('Língua Portuguesa', 'Crase', 4),
    ('Língua Portuguesa', 'Sintaxe', 5),
    ('Língua Portuguesa', 'Pontuação', 6),
    ('Língua Portuguesa', 'Concordância', 7),
    ('Língua Portuguesa', 'Regência', 8),
    ('Língua Portuguesa', 'Colocação pronominal', 9),
    ('Língua Portuguesa', 'Geral', 10),

    ('Língua Inglesa', 'Compreensão de texto', 1),
    ('Língua Inglesa', 'Vocabulário', 2),
    ('Língua Inglesa', 'Gramática básica', 3),
    ('Língua Inglesa', 'Geral', 4),

    ('Matemática', 'Números', 1),
    ('Matemática', 'Medidas', 2),
    ('Matemática', 'Proporções, regra de três e porcentagem', 3),
    ('Matemática', 'Lógica proposicional', 4),
    ('Matemática', 'Conjuntos, relações e funções', 5),
    ('Matemática', 'Matrizes e sistemas', 6),
    ('Matemática', 'Sequências', 7),
    ('Matemática', 'PA e PG', 8),
    ('Matemática', 'Probabilidade e estatística', 9),
    ('Matemática', 'Geral', 10),

    ('Atualidades do Mercado Financeiro', 'Bancos digitais', 1),
    ('Atualidades do Mercado Financeiro', 'Internet e mobile banking', 2),
    ('Atualidades do Mercado Financeiro', 'Open banking', 3),
    ('Atualidades do Mercado Financeiro', 'Fintechs, startups e big techs', 4),
    ('Atualidades do Mercado Financeiro', 'Shadow banking', 5),
    ('Atualidades do Mercado Financeiro', 'Moedas e blockchain', 6),
    ('Atualidades do Mercado Financeiro', 'Criptoativos', 7),
    ('Atualidades do Mercado Financeiro', 'Marketplace', 8),
    ('Atualidades do Mercado Financeiro', 'Correspondentes bancários', 9),
    ('Atualidades do Mercado Financeiro', 'Arranjos de pagamento', 10),
    ('Atualidades do Mercado Financeiro', 'PIX', 11),
    ('Atualidades do Mercado Financeiro', 'Transformação digital', 12),
    ('Atualidades do Mercado Financeiro', 'Geral', 13),

    ('Matemática Financeira', 'Valor do dinheiro', 1),
    ('Matemática Financeira', 'Fluxos de caixa', 2),
    ('Matemática Financeira', 'Capital, juros e taxas', 3),
    ('Matemática Financeira', 'Juros simples', 4),
    ('Matemática Financeira', 'Juros compostos', 5),
    ('Matemática Financeira', 'Equivalência de capitais', 6),
    ('Matemática Financeira', 'Price e SAC', 7),
    ('Matemática Financeira', 'Geral', 8),

    ('Conhecimentos Bancários', 'SFN e mercados', 1),
    ('Conhecimentos Bancários', 'Política monetária', 2),
    ('Conhecimentos Bancários', 'Orçamento e dívida pública', 3),
    ('Conhecimentos Bancários', 'Produtos e serviços', 4),
    ('Conhecimentos Bancários', 'Mercado de capitais', 5),
    ('Conhecimentos Bancários', 'Câmbio', 6),
    ('Conhecimentos Bancários', 'Garantias', 7),
    ('Conhecimentos Bancários', 'PLD/FT', 8),
    ('Conhecimentos Bancários', 'Autorregulação', 9),
    ('Conhecimentos Bancários', 'Sigilo bancário', 10),
    ('Conhecimentos Bancários', 'LGPD', 11),
    ('Conhecimentos Bancários', 'Anticorrupção', 12),
    ('Conhecimentos Bancários', 'Cibersegurança', 13),
    ('Conhecimentos Bancários', 'Ética', 14),
    ('Conhecimentos Bancários', 'Responsabilidade socioambiental e ASG', 15),
    ('Conhecimentos Bancários', 'Geral', 16),

    ('Conhecimentos de Informática', 'Windows e Linux', 1),
    ('Conhecimentos de Informática', 'Microsoft 365', 2),
    ('Conhecimentos de Informática', 'Segurança', 3),
    ('Conhecimentos de Informática', 'Arquivos', 4),
    ('Conhecimentos de Informática', 'Redes', 5),
    ('Conhecimentos de Informática', 'Navegadores', 6),
    ('Conhecimentos de Informática', 'E-mail e colaboração', 7),
    ('Conhecimentos de Informática', 'Redes sociais', 8),
    ('Conhecimentos de Informática', 'BI e analytics', 9),
    ('Conhecimentos de Informática', 'EAD', 10),
    ('Conhecimentos de Informática', 'Multimídia', 11),
    ('Conhecimentos de Informática', 'Ferramentas de trabalho remoto', 12),
    ('Conhecimentos de Informática', 'Geral', 13),

    ('Vendas e Negociação', 'Estratégia', 1),
    ('Vendas e Negociação', 'Segmentação', 2),
    ('Vendas e Negociação', 'Valor e experiência do cliente', 3),
    ('Vendas e Negociação', 'Relacionamento', 4),
    ('Vendas e Negociação', 'Marketing de serviços', 5),
    ('Vendas e Negociação', 'Marketing digital', 6),
    ('Vendas e Negociação', 'Vendas', 7),
    ('Vendas e Negociação', 'Ética em vendas', 8),
    ('Vendas e Negociação', 'Canais remotos', 9),
    ('Vendas e Negociação', 'Comportamento do consumidor', 10),
    ('Vendas e Negociação', 'Res. CMN 4.949/2021', 11),
    ('Vendas e Negociação', 'Ouvidoria', 12),
    ('Vendas e Negociação', 'Acessibilidade', 13),
    ('Vendas e Negociação', 'CDC', 14),
    ('Vendas e Negociação', 'Geral', 15)
)
insert into public.topicos (materia_id, nome, ordem, ativo)
select m.id, e.topico, e.ordem, true
  from edital e
  join public.materias m on m.nome = e.materia
on conflict (materia_id, nome) do update
  set ordem = excluded.ordem,
      ativo = true;
