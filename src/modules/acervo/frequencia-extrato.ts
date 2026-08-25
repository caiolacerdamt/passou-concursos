/**
 * Extrato congelado da frequência real, tirado do acervo em **2026-08-25**.
 *
 * Não é a fonte: a fonte é o banco, lida por `consultarFrequenciaReal`. Este
 * arquivo é a **queda** — se a consulta falhar, a landing mostra estes números
 * em vez de mostrar gráfico vazio ou número inventado.
 *
 * Foi gerado a partir do protótipo (`scrollcraft/builds/passou-lp/raiox.js`),
 * que por sua vez saiu da consulta documentada em `frequencia.ts`: `questoes`
 * vigentes, `origem='real'`, matéria de fixture `TESTE-%` fora.
 * 28 provas oficiais · 2010–2025 · 1.395 questões · 86 tópicos.
 *
 * Nenhum valor aqui foi digitado à mão. Quando o acervo crescer, regere.
 */
import type { TopicoFrequente } from "./frequencia";

/** Provas oficiais lidas até a data do extrato. */
export const PROVAS_DO_EXTRATO = 28;

/** Anos das provas do extrato: o menor e o maior. */
export const ANOS_DO_EXTRATO = { primeiro: 2010, ultimo: 2025 } as const;

export const TOPICOS_DO_EXTRATO: readonly TopicoFrequente[] = [
  { topico: "Interpretação", materia: "Língua Portuguesa", questoes: 93 },
  { topico: "Produtos e serviços", materia: "Conhecimentos Bancários", questoes: 89 },
  { topico: "Probabilidade e estatística", materia: "Matemática", questoes: 77 },
  { topico: "SFN e mercados", materia: "Conhecimentos Bancários", questoes: 47 },
  { topico: "Câmbio", materia: "Conhecimentos Bancários", questoes: 41 },
  { topico: "Sintaxe", materia: "Língua Portuguesa", questoes: 34 },
  { topico: "Mercado de capitais", materia: "Conhecimentos Bancários", questoes: 33 },
  { topico: "Marketing de serviços", materia: "Vendas e Negociação", questoes: 33 },
  { topico: "Proporções, regra de três e porcentagem", materia: "Matemática", questoes: 31 },
  { topico: "Segurança", materia: "Conhecimentos de Informática", questoes: 30 },
  { topico: "Classes de palavras", materia: "Língua Portuguesa", questoes: 30 },
  { topico: "Juros compostos", materia: "Matemática Financeira", questoes: 29 },
  { topico: "Valor e experiência do cliente", materia: "Vendas e Negociação", questoes: 29 },
  { topico: "Relacionamento", materia: "Vendas e Negociação", questoes: 27 },
  { topico: "Garantias", materia: "Conhecimentos Bancários", questoes: 24 },
  { topico: "Ética", materia: "Conhecimentos Bancários", questoes: 24 },
  { topico: "Microsoft 365", materia: "Conhecimentos de Informática", questoes: 23 },
  { topico: "Navegadores", materia: "Conhecimentos de Informática", questoes: 22 },
  { topico: "Concordância", materia: "Língua Portuguesa", questoes: 22 },
  { topico: "Price e SAC", materia: "Matemática Financeira", questoes: 21 },
  { topico: "Capital, juros e taxas", materia: "Matemática Financeira", questoes: 21 },
  { topico: "Conjuntos, relações e funções", materia: "Matemática", questoes: 21 },
  { topico: "Compreensão de texto", materia: "Língua Inglesa", questoes: 21 },
  { topico: "Política monetária", materia: "Conhecimentos Bancários", questoes: 21 },
  { topico: "CDC", materia: "Vendas e Negociação", questoes: 20 },
  { topico: "Pontuação", materia: "Língua Portuguesa", questoes: 18 },
  { topico: "Vendas", materia: "Vendas e Negociação", questoes: 17 },
  { topico: "Lógica proposicional", materia: "Matemática", questoes: 16 },
  { topico: "Windows e Linux", materia: "Conhecimentos de Informática", questoes: 16 },
  { topico: "Juros simples", materia: "Matemática Financeira", questoes: 15 },
  { topico: "PLD/FT", materia: "Conhecimentos Bancários", questoes: 15 },
  { topico: "Acessibilidade", materia: "Vendas e Negociação", questoes: 15 },
  { topico: "Estratégia", materia: "Vendas e Negociação", questoes: 15 },
  { topico: "E-mail e colaboração", materia: "Conhecimentos de Informática", questoes: 15 },
  { topico: "BI e analytics", materia: "Conhecimentos de Informática", questoes: 15 },
  { topico: "Moedas e blockchain", materia: "Atualidades do Mercado Financeiro", questoes: 14 },
  { topico: "Orçamento e dívida pública", materia: "Conhecimentos Bancários", questoes: 14 },
  { topico: "Crase", materia: "Língua Portuguesa", questoes: 14 },
  { topico: "Vocabulário", materia: "Língua Inglesa", questoes: 14 },
  { topico: "Marketing digital", materia: "Vendas e Negociação", questoes: 13 },
  { topico: "Fintechs, startups e big techs", materia: "Atualidades do Mercado Financeiro", questoes: 12 },
  { topico: "Geral", materia: "Conhecimentos Bancários", questoes: 12 },
  { topico: "Redes", materia: "Conhecimentos de Informática", questoes: 12 },
  { topico: "Responsabilidade socioambiental e ASG", materia: "Conhecimentos Bancários", questoes: 12 },
  { topico: "Canais remotos", materia: "Vendas e Negociação", questoes: 12 },
  { topico: "LGPD", materia: "Conhecimentos Bancários", questoes: 11 },
  { topico: "Segmentação", materia: "Vendas e Negociação", questoes: 11 },
  { topico: "Colocação pronominal", materia: "Língua Portuguesa", questoes: 11 },
  { topico: "Gramática básica", materia: "Língua Inglesa", questoes: 10 },
  { topico: "Comportamento do consumidor", materia: "Vendas e Negociação", questoes: 10 },
  { topico: "Matrizes e sistemas", materia: "Matemática", questoes: 10 },
  { topico: "Arquivos", materia: "Conhecimentos de Informática", questoes: 10 },
  { topico: "Transformação digital", materia: "Atualidades do Mercado Financeiro", questoes: 10 },
  { topico: "Números", materia: "Matemática", questoes: 9 },
  { topico: "PA e PG", materia: "Matemática", questoes: 9 },
  { topico: "Open banking", materia: "Atualidades do Mercado Financeiro", questoes: 8 },
  { topico: "Anticorrupção", materia: "Conhecimentos Bancários", questoes: 8 },
  { topico: "PIX", materia: "Atualidades do Mercado Financeiro", questoes: 8 },
  { topico: "Ferramentas de trabalho remoto", materia: "Conhecimentos de Informática", questoes: 7 },
  { topico: "Equivalência de capitais", materia: "Matemática Financeira", questoes: 7 },
  { topico: "Ouvidoria", materia: "Vendas e Negociação", questoes: 6 },
  { topico: "Multimídia", materia: "Conhecimentos de Informática", questoes: 6 },
  { topico: "Arranjos de pagamento", materia: "Atualidades do Mercado Financeiro", questoes: 6 },
  { topico: "Redes sociais", materia: "Conhecimentos de Informática", questoes: 6 },
  { topico: "Geral", materia: "Atualidades do Mercado Financeiro", questoes: 6 },
  { topico: "Regência", materia: "Língua Portuguesa", questoes: 6 },
  { topico: "Ética em vendas", materia: "Vendas e Negociação", questoes: 6 },
  { topico: "Res. CMN 4.949/2021", materia: "Vendas e Negociação", questoes: 5 },
  { topico: "Geral", materia: "Língua Portuguesa", questoes: 5 },
  { topico: "Medidas", materia: "Matemática", questoes: 5 },
  { topico: "Geral", materia: "Conhecimentos de Informática", questoes: 5 },
  { topico: "Shadow banking", materia: "Atualidades do Mercado Financeiro", questoes: 5 },
  { topico: "Sequências", materia: "Matemática", questoes: 4 },
  { topico: "Ortografia", materia: "Língua Portuguesa", questoes: 4 },
  { topico: "Internet e mobile banking", materia: "Atualidades do Mercado Financeiro", questoes: 4 },
  { topico: "Criptoativos", materia: "Atualidades do Mercado Financeiro", questoes: 4 },
  { topico: "Sigilo bancário", materia: "Conhecimentos Bancários", questoes: 4 },
  { topico: "EAD", materia: "Conhecimentos de Informática", questoes: 4 },
  { topico: "Geral", materia: "Vendas e Negociação", questoes: 3 },
  { topico: "Fluxos de caixa", materia: "Matemática Financeira", questoes: 3 },
  { topico: "Correspondentes bancários", materia: "Atualidades do Mercado Financeiro", questoes: 2 },
  { topico: "Geral", materia: "Matemática", questoes: 2 },
  { topico: "Valor do dinheiro", materia: "Matemática Financeira", questoes: 2 },
  { topico: "Autorregulação", materia: "Conhecimentos Bancários", questoes: 2 },
  { topico: "Cibersegurança", materia: "Conhecimentos Bancários", questoes: 1 },
  { topico: "Bancos digitais", materia: "Atualidades do Mercado Financeiro", questoes: 1 },
];
