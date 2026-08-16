import { type SupabaseClient, createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase de **servidor**, com a chave secreta.
 *
 * Passa por cima da RLS de proposito: `configuracoes` e fechada para `anon` e
 * `authenticated`, e quem le e o servidor, que decide o que expor. Nunca importe
 * este arquivo de codigo que roda no navegador — a chave secreta vazaria junto.
 */
export function clienteDeServico(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveSecreta = process.env.SUPABASE_SECRET_KEY;

  if (!url || !chaveSecreta) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY sao obrigatorias no servidor. Ver .env.example.",
    );
  }

  return createClient(url, chaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
