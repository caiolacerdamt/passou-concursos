/**
 * A regra de senha, num lugar so (PAG-07).
 *
 * Um lugar so importa porque a senha e escrita em dois momentos distantes: o
 * "defina sua senha" que a SPEC 12 dispara depois do pagamento e a recuperacao
 * desta spec. Duas copias divergem, e a que for mais frouxa e a que vale.
 *
 * O minimo e **8**, e nao os 6 que o Supabase aceita por padrao. Nao ha regra
 * de simbolo obrigatorio de proposito: exigir mistura de caracteres empurra o
 * aluno para senha curta e anotada, e o ganho e menor que o do comprimento.
 */
export const MINIMO_DE_CARACTERES = 8;

/** Devolve a mensagem do problema, ou `null` quando a senha serve. */
export function problemaDaSenha(senha: string): string | null {
  if (senha.length < MINIMO_DE_CARACTERES) {
    return `A senha precisa ter ao menos ${MINIMO_DE_CARACTERES} caracteres.`;
  }
  return null;
}

/**
 * Resposta do pedido de recuperacao. E **sempre a mesma**, exista ou nao a
 * conta: dizer "esse e-mail nao esta cadastrado" transforma o formulario num
 * verificador de quem e cliente do produto.
 */
export const RECUPERACAO_ENVIADA =
  "Se existir uma conta com esse e-mail, enviamos um link para definir a senha. Confira também o spam.";
