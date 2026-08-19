/**
 * De onde sai a URL absoluta que o Supabase Auth usa para voltar (`redirectTo`).
 *
 * Tres fontes, nesta ordem, e a ordem e o ponto:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` — o dominio proprio, quando declarado. E o unico
 *      valor confiavel, porque nao vem do pedido.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — a Vercel injeta sozinha, e cobre o
 *      deploy antes de o dominio existir.
 *   3. o cabecalho `host` do pedido — ultimo recurso, para desenvolvimento.
 *
 * O cabecalho fica por ultimo porque ele **e escrito por quem chama**. Um
 * atacante que mande `Host: site.invalido` num pedido de recuperacao de senha
 * faria o link do e-mail apontar para o site dele, com o token dentro. Por isso
 * a variavel de ambiente vence, e por isso ela e obrigatoria em producao.
 */
export function origemDoSite(cabecalhos: {
  get(nome: string): string | null;
}): string {
  const declarada = process.env.NEXT_PUBLIC_SITE_URL;
  if (declarada) return semBarraFinal(declarada);

  const daVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (daVercel) return `https://${semBarraFinal(daVercel)}`;

  const host = cabecalhos.get("host") ?? "localhost:3000";
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  return `${protocolo}://${host}`;
}

function semBarraFinal(valor: string): string {
  return valor.replace(/\/+$/, "");
}
