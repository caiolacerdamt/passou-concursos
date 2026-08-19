/**
 * Quem passa sem sessao e quem nao passa (PAG-01, PAG-07).
 *
 * Isto e uma funcao pura, e nao um `if` dentro do `proxy.ts`, por um motivo
 * pratico: a decisao de "esta rota e publica?" e a superficie onde um descuido
 * abre o produto inteiro, e testar o `proxy.ts` exigiria subir o Next. Aqui o
 * teste roda em milissegundos e cobre o caso que importa — rota nova nasce
 * **privada** por default.
 */

/**
 * Prefixos publicos. Lista de permissao, nunca lista de bloqueio: o que nao
 * estiver aqui exige sessao, inclusive a rota que alguem criar amanha sem ler
 * este arquivo.
 */
export const ROTAS_PUBLICAS = [
  "/", // marco publico; a pagina de vendas de verdade e da SPEC 12
  "/entrar",
  "/recuperar-senha",
  "/assinar", // o aviso do paywall precisa ser visivel para quem nao pagou
  "/auth", // callback do OAuth e troca de codigo por sessao
] as const;

export function ehRotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some(
    (rota) => caminho === rota || (rota !== "/" && caminho.startsWith(`${rota}/`)),
  );
}

/**
 * Para onde mandar quem chegou sem sessao. `?proximo=` preserva o destino para
 * o login devolver o aluno ao lugar de onde ele veio.
 *
 * So aceita caminho **relativo**: um `proximo` absoluto viraria redirecionamento
 * aberto — o site levaria o aluno recem-autenticado para fora, com aparencia de
 * ter sido o proprio produto que o mandou.
 */
export function destinoSemSessao(caminho: string, busca = ""): string {
  const proximo = caminhoInternoOuRaiz(`${caminho}${busca}`);
  return `/entrar?proximo=${encodeURIComponent(proximo)}`;
}

export function caminhoInternoOuRaiz(destino: string | null | undefined): string {
  if (typeof destino !== "string") return "/";
  // `//host` e `/\host` sao caminhos que o navegador trata como absolutos.
  if (!destino.startsWith("/")) return "/";
  if (destino.startsWith("//") || destino.startsWith("/\\")) return "/";
  return destino;
}
