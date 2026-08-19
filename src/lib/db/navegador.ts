import { createBrowserClient } from "@supabase/ssr";

import { chavesPublicas } from "./chaves";

/**
 * Cliente Supabase do **navegador**. So a chave publicavel chega aqui — e o
 * motivo de `servidor.ts` trazer o aviso de nunca ser importado de codigo de
 * cliente.
 */
export function clienteDoNavegador() {
  const { url, chave } = chavesPublicas();
  return createBrowserClient(url, chave);
}
