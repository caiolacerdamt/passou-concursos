/**
 * As duas chaves publicas do Supabase, num arquivo que **nao importa
 * `next/headers`**.
 *
 * Parece detalhe e nao e: `sessao.ts` importa `next/headers`, que so existe no
 * servidor. Se o cliente do navegador lesse as chaves de la, arrastaria esse
 * import para o pacote do navegador junto. Por isso a leitura mora sozinha aqui.
 *
 * Nenhuma das duas e segredo — a publicavel vai para o navegador de proposito,
 * e quem protege o dado e a RLS, nao o sigilo da chave.
 */
export function chavesPublicas(): { url: string; chave: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !chave) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sao obrigatorias. Ver .env.example.",
    );
  }

  return { url, chave };
}
