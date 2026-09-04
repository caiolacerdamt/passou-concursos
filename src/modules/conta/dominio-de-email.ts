/**
 * O único anti-abuso que este plano acrescenta ao cadastro (AD-133, item 8).
 *
 * O trial sem cartão tem um buraco conhecido e insolúvel: **e-mail novo =
 * trial novo**. Não se fecha, só se encarece. O que limita o dano de verdade é
 * o teto diário; esta lista tira do caminho o abuso mais preguiçoso, que é o
 * endereço descartável de dez minutos.
 *
 * Deliberadamente **fora**: captcha, Turnstile, fingerprint de dispositivo e
 * bloqueio por IP próprio. Nenhum se justifica antes de existir abuso medido, e
 * todos custam conversão.
 *
 * A comparação inclui os subdomínios: bloquear `mailinator.com` sem alcançar
 * `x.mailinator.com` bloqueia só quem não estava tentando.
 */
export function ehDominioBloqueado(
  email: string,
  bloqueados: readonly string[],
): boolean {
  const dominio = dominioDoEmail(email);
  if (dominio === null) return false;

  return bloqueados.some((bruto) => {
    const alvo = bruto.trim().toLowerCase().replace(/^@/, "");
    if (alvo.length === 0) return false;
    return dominio === alvo || dominio.endsWith(`.${alvo}`);
  });
}

/** A parte depois do último `@`, em minúsculas. `null` quando não há uma. */
export function dominioDoEmail(email: string): string | null {
  const posicao = email.lastIndexOf("@");
  if (posicao < 0) return null;

  const dominio = email.slice(posicao + 1).trim().toLowerCase();
  return dominio.length === 0 ? null : dominio;
}
