/**
 * O vocabulário do tema da interface (AD-149).
 *
 * Mora fora do componente porque quatro lugares leem a mesma lista — o shell
 * que pinta, o layout que resolve, o botão que alterna e a Server Action que
 * grava. Um valor que existisse só em três deles seria um estado alcançável
 * pelo clique e recusado pelo banco.
 */

export type Tema = "claro" | "escuro" | "sistema";

/**
 * A ordem do ciclo do botão, e ela é deliberada: quem clica uma vez sai de
 * "segue o sistema" para escuro, que é o que a pessoa estava procurando. Claro
 * fica em terceiro porque é o estado de quem já está no claro e não precisou
 * clicar.
 */
export const CICLO_DO_TEMA: readonly Tema[] = ["sistema", "escuro", "claro"];

/** Espelho do `perfil_estudo.tema`, para o shell pintar sem consultar banco. */
export const COOKIE_DO_TEMA = "tema-do-app";

/** Um ano: a preferência é do aluno, não da sessão do navegador. */
export const VIDA_DO_COOKIE_DO_TEMA = 60 * 60 * 24 * 365;

export const TEMA_PADRAO: Tema = "sistema";

/**
 * Cookie adulterado, coluna de um deploy futuro, `undefined` — tudo cai no
 * padrão. Um valor desconhecido nunca pode virar atributo: `data-tema="dark"`
 * não casa com nenhuma regra e a tela sairia meio pintada.
 */
export function temaValido(valor: unknown): Tema | null {
  return CICLO_DO_TEMA.includes(valor as Tema) ? (valor as Tema) : null;
}

export function proximoTema(atual: Tema): Tema {
  const i = CICLO_DO_TEMA.indexOf(atual);
  return CICLO_DO_TEMA[(i + 1) % CICLO_DO_TEMA.length];
}

/** O que o aluno lê no botão. Ícone sozinho não diz em qual dos três está. */
export const ROTULO_DO_TEMA: Record<Tema, string> = {
  sistema: "Auto",
  escuro: "Escuro",
  claro: "Claro",
};

/**
 * O `aria-label` diz o estado atual **e** o destino do clique. Um botão que só
 * anunciasse "Tema" deixaria quem usa leitor de tela sem saber o que mudou, e
 * um ciclo de três estados é justamente onde isso importa.
 */
export function rotuloAcessivelDoTema(atual: Tema): string {
  const destino = ROTULO_DO_TEMA[proximoTema(atual)].toLowerCase();
  const agora =
    atual === "sistema" ? "seguindo o aparelho" : `${ROTULO_DO_TEMA[atual].toLowerCase()}`;
  return `Tema: ${agora}. Trocar para ${destino}.`;
}
