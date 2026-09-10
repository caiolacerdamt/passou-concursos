"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { clienteDaSessao } from "@/lib/db/sessao";
import { reportarErro } from "@/modules/observabilidade/reporte";
import {
  COOKIE_DO_TEMA,
  VIDA_DO_COOKIE_DO_TEMA,
  type Tema,
  temaValido,
} from "@/modules/ui/tema";

/**
 * Grava o tema da interface (AD-149).
 *
 * **Ação separada de `salvarPreferencias` de propósito, e isso resolve um
 * problema em vez de adiar.** `salvarPreferencias` dispara `gera_plano_do_dia`
 * ao gravar — correto para minutos e dias de estudo, absurdo para cor. Com ação
 * própria não é preciso "lembrar de pular o recálculo": não há como disparar.
 * Ela também não chama `validarOnboarding` e não redireciona.
 *
 * O cookie é escrito na mesma ação que grava o banco, porque é ele que o shell
 * lê para pintar sem consultar Postgres. Banco é a verdade, cookie é espelho —
 * e é por isso que o cookie é escrito mesmo quando o `update` não encontra
 * linha: um aluno que ainda está no onboarding não tem `perfil_estudo`, e negar
 * a troca de tema até ele terminar seria pior do que a preferência valer só
 * neste aparelho até o perfil existir.
 */
export async function alternarTema(proposto: Tema): Promise<void> {
  const tema = temaValido(proposto);

  // Argumento de Server Action é dado de fora como qualquer outro. Valor
  // desconhecido não vira cookie nem atributo: `data-tema="dark"` não casa com
  // regra nenhuma e a tela sairia meio pintada.
  if (!tema) {
    reportarErro(new Error(`tema desconhecido: ${String(proposto)}`), {
      modulo: "ui",
      operacao: "alternar_tema",
    });
    return;
  }

  const armazem = await cookies();
  armazem.set(COOKIE_DO_TEMA, tema, {
    path: "/",
    maxAge: VIDA_DO_COOKIE_DO_TEMA,
    sameSite: "lax",
  });

  try {
    const supabase = await clienteDaSessao();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Sem sessão não há o que gravar, e não há para onde redirecionar: quem
    // chegou aqui já está dentro do shell. O cookie acima já respondeu.
    if (user) {
      // `update` e não `upsert`: `perfil_estudo.minutos_por_dia` é `not null`
      // sem default, então um upsert para quem ainda não tem perfil falharia no
      // banco por causa de uma cor.
      const gravacao = await supabase
        .from("perfil_estudo")
        .update({ tema })
        .eq("user_id", user.id);

      if (gravacao.error) throw new Error(gravacao.error.message);
    }
  } catch (erro) {
    // A troca de tema não pode quebrar a tela do aluno. O cookie já valeu; o
    // que se perde é a persistência entre aparelhos, e isso vira reporte.
    reportarErro(erro, { modulo: "ui", operacao: "gravar_tema" });
  }

  // O shell é montado pelo layout, e é ele que emite `data-tema`.
  revalidatePath("/app", "layout");
}
