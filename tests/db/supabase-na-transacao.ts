import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "pg";

/**
 * Um `SupabaseClient` de mentira que fala com o **mesmo** `pg` da transacao
 * revertida do teste.
 *
 * Existe por um motivo so: `agendarRevisao` e uma funcao de aplicacao, e testar
 * so a funcao SQL por baixo dela deixaria de fora justamente o que a SPEC 06
 * precisa provar — que o FSRS calcula, que a regua fixa e o plano B e que o
 * agendamento sobrevive a troca. O cliente real do Supabase abriria **outra**
 * conexao, escreveria de verdade no banco de desenvolvimento e nao veria nada do
 * que o teste semeou dentro da transacao.
 *
 * E deliberadamente estreito: implementa exatamente os dois caminhos que
 * `agendarRevisao` usa (`rpc` e um `select` encadeado), e nada mais. Se o modulo
 * passar a usar outro metodo, isto quebra com `is not a function` — que e o
 * aviso certo de que o adaptador ficou para tras.
 */
export function supabaseNaTransacao(cliente: Client): SupabaseClient {
  const falso = {
    async rpc(nome: string, args: Record<string, unknown>) {
      const chaves = Object.keys(args);
      const lista = chaves.map((c, i) => `${c} => $${i + 1}`).join(", ");
      try {
        const { rows } = await cliente.query(
          `select * from public.${nome}(${lista})`,
          chaves.map((c) => normalizar(args[c])),
        );
        // Funcao que devolve escalar chega no `supabase-js` como o valor, nao
        // como lista de uma linha de uma coluna. O `pg` nao distingue os dois
        // casos sozinho; a coluna com o nome da funcao e o que os separa.
        const unica = rows.length === 1 ? (rows[0] as Record<string, unknown>) : null;
        if (unica && Object.keys(unica).length === 1 && nome in unica) {
          return { data: unica[nome], error: null };
        }
        return { data: rows, error: null };
      } catch (erro) {
        return { data: null, error: erro as { message: string } };
      }
    },

    from(tabela: string) {
      const filtros: Array<[string, string, unknown]> = [];
      let colunas = "*";

      const construtor = {
        select(lista: string) {
          colunas = lista;
          return construtor;
        },
        eq(coluna: string, valor: unknown) {
          filtros.push([coluna, "=", valor]);
          return construtor;
        },
        gt(coluna: string, valor: unknown) {
          filtros.push([coluna, ">", valor]);
          return construtor;
        },
        async maybeSingle() {
          const onde = filtros
            .map(([coluna, operador], i) => `${coluna} ${operador} $${i + 1}`)
            .join(" and ");
          try {
            const { rows } = await cliente.query(
              `select ${colunas} from public.${tabela}${onde ? ` where ${onde}` : ""} limit 1`,
              filtros.map(([, , valor]) => valor),
            );
            return { data: rows[0] ?? null, error: null };
          } catch (erro) {
            return { data: null, error: erro as { message: string } };
          }
        },
      };

      return construtor;
    },
  };

  return falso as unknown as SupabaseClient;
}

/** `jsonb` precisa chegar como texto; o driver `pg` nao serializa objeto sozinho. */
function normalizar(valor: unknown): unknown {
  if (valor !== null && typeof valor === "object") return JSON.stringify(valor);
  return valor;
}
