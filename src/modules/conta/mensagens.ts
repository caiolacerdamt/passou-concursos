/**
 * Mensagens fixas da conta.
 *
 * Moram fora de `acoes.ts` por uma regra do Next: arquivo `"use server"` so
 * pode exportar funcao assincrona. Exportar uma constante de la faz o modulo
 * inteiro nao exportar nada, e o erro aparece longe da causa.
 */

/**
 * Nao distingue "e-mail nao existe" de "senha errada" **de proposito**: a
 * distincao entrega quem tem conta aqui para quem so tem uma lista de e-mails.
 */
export const CREDENCIAL_INVALIDA = "E-mail ou senha não conferem.";
