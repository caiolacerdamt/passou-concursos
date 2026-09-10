import "server-only";

import { cookies } from "next/headers";

import { clienteDaSessao } from "@/lib/db/sessao";
import { reportarErro } from "@/modules/observabilidade/reporte";

import { COOKIE_DO_TEMA, TEMA_PADRAO, type Tema, temaValido } from "./tema";

/**
 * Resolve o tema da superfície logada **no servidor**, para o HTML já sair
 * pintado (AD-149).
 *
 * A ordem não é preferência de estilo, é o que evita duas coisas diferentes:
 *
 * 1. **cookie** — o caminho normal. O shell é moldura e não faz query
 *    (`app-shell.tsx`); uma consulta a banco por cor seria uma ida ao Postgres
 *    em toda navegação do aluno para decidir um valor que não muda.
 * 2. **`perfil_estudo.tema`** — o aparelho novo, onde o cookie ainda não
 *    existe. O banco é a verdade; o cookie é espelho.
 * 3. **`sistema`** — sem cookie e sem perfil. É o comportamento de hoje.
 *
 * O cookie **não é regravado aqui**: escrever cookie durante o render é
 * proibido no Next. Ele nasce na Server Action do botão, e até lá o passo 2
 * responde certo — mais devagar, e só uma vez por aparelho.
 *
 * Falha de leitura não pode derrubar a tela do aluno por causa de uma cor: cai
 * no padrão e reporta.
 */
export async function temaDoAluno(): Promise<Tema> {
  const armazem = await cookies();
  const doCookie = temaValido(armazem.get(COOKIE_DO_TEMA)?.value);
  if (doCookie) return doCookie;

  try {
    const supabase = await clienteDaSessao();
    const consulta = await supabase.from("perfil_estudo").select("tema").maybeSingle();

    if (consulta.error) throw new Error(consulta.error.message);

    return temaValido(consulta.data?.tema) ?? TEMA_PADRAO;
  } catch (erro) {
    reportarErro(erro, { modulo: "ui", operacao: "resolver_tema" });
    return TEMA_PADRAO;
  }
}
