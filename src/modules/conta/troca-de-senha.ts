import { createClient } from "@supabase/supabase-js";

import { chavesPublicas } from "@/lib/db/chaves";
import { reportarErro } from "@/modules/observabilidade/reporte";

/**
 * Trocar a senha sem sair da conta (PAG-07).
 *
 * A regra da senha **não** mora aqui: ela é uma só, em `senha.ts`. Uma segunda
 * regra num arquivo novo é o começo da divergência que aquele arquivo existe
 * para impedir — e, quando duas regras discordam, quem vale é a mais frouxa.
 */

type Identidade = { provider?: string | null };
type UsuarioComProvedores = {
  identities?: Identidade[] | null;
  app_metadata?: { providers?: string[] | null; provider?: string | null } | null;
};

/**
 * Por onde esta conta entra.
 *
 * Duas fontes porque as duas existem no mesmo objeto e nem sempre as duas vêm
 * preenchidas: `identities` é a lista real de vínculos, `app_metadata` é o
 * resumo que o token carrega. Ler só uma faria a resposta depender de qual
 * caminho encheu o objeto.
 */
export function provedoresDoUsuario(user: UsuarioComProvedores | null): string[] {
  const daLista = (user?.identities ?? [])
    .map((identidade) => identidade?.provider)
    .filter((provedor): provedor is string => typeof provedor === "string");

  const doResumo = [
    ...(user?.app_metadata?.providers ?? []),
    ...(user?.app_metadata?.provider ? [user.app_metadata.provider] : []),
  ].filter((provedor): provedor is string => typeof provedor === "string");

  return [...new Set([...daLista, ...doResumo])];
}

/**
 * Só quem tem o provedor `email` tem senha.
 *
 * Quem entrou pelo Google **não tem senha nenhuma** para trocar. Sem esta
 * pergunta, o formulário apareceria para ele, a conferência da senha atual
 * falharia sempre, e a tela diria "senha atual incorreta" sobre uma senha que
 * nunca existiu — erro que o aluno não tem como resolver sozinho.
 *
 * Na dúvida (lista vazia, objeto que não veio) a resposta é **não**: mostrar o
 * formulário que não funciona é pior que mostrar o texto explicando o acesso.
 */
export function temSenhaPropria(provedores: string[]): boolean {
  return provedores.includes("email");
}

type ClienteDeConferencia = {
  auth: {
    signInWithPassword: (credenciais: {
      email: string;
      password: string;
    }) => Promise<{ error: unknown }>;
  };
};

/**
 * Um cliente **descartável**, sem persistência de sessão.
 *
 * O motivo é a parte que não pode ser esquecida: `signInWithPassword` no
 * cliente da sessão **rotaciona o cookie do próprio aluno** no meio da
 * operação. A conferência da senha atual passaria a ter efeito colateral de
 * login, e um erro entre a conferência e a troca deixaria o aluno num estado
 * que ninguém desenhou. Aqui a conferência é uma pergunta, e só.
 */
function clienteDescartavel(): ClienteDeConferencia {
  const { url, chave } = chavesPublicas();
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) as unknown as ClienteDeConferencia;
}

/**
 * A senha atual confere?
 *
 * `updateUser` **não** pede a senha antiga. Sem esta conferência, uma sessão
 * esquecida aberta num computador emprestado troca a senha e tranca o dono
 * para fora da própria conta.
 *
 * Falha de rede devolve `false`: recusar a troca quando não deu para conferir é
 * o lado seguro do erro.
 */
export async function conferirSenhaAtual(
  email: string,
  senhaAtual: string,
  cliente: ClienteDeConferencia = clienteDescartavel(),
): Promise<boolean> {
  if (senhaAtual.length === 0) return false;

  try {
    const { error } = await cliente.auth.signInWithPassword({
      email,
      password: senhaAtual,
    });
    return !error;
  } catch (erro) {
    reportarErro(erro, { modulo: "conta", operacao: "conferir_senha_atual" });
    return false;
  }
}
