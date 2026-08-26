"use server";

import { z } from "zod";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { reportarErro } from "@/modules/observabilidade/reporte";

export type ResultadoDaMarcaDoRecurso =
  | { ok: true }
  | { ok: false; mensagem: string };

const recursoIdSchema = z.string().uuid();

export async function marcarRecursoComoVisto(
  recursoId: string,
): Promise<ResultadoDaMarcaDoRecurso> {
  return alterarMarca(recursoId, true);
}

export async function desmarcarRecursoComoVisto(
  recursoId: string,
): Promise<ResultadoDaMarcaDoRecurso> {
  return alterarMarca(recursoId, false);
}

/**
 * A action recebe somente o recurso. O titular vem da sessão autenticada, e a
 * RLS ainda repete essa fronteira no INSERT/DELETE do banco.
 */
async function alterarMarca(
  recursoId: string,
  visto: boolean,
): Promise<ResultadoDaMarcaDoRecurso> {
  const validacao = recursoIdSchema.safeParse(recursoId);
  if (!validacao.success) {
    return { ok: false, mensagem: "Este recurso não está disponível." };
  }

  await exigirMatriculaAtiva();
  const supabase = await clienteDaSessao();
  const {
    data: { user },
    error: erroDeAutenticacao,
  } = await supabase.auth.getUser();

  if (erroDeAutenticacao || user === null) {
    return { ok: false, mensagem: "Sua sessão expirou. Entre novamente para continuar." };
  }

  const resultado = visto
    ? await supabase.from("recurso_visto").insert({
        user_id: user.id,
        recurso_id: validacao.data,
      })
    : await supabase
        .from("recurso_visto")
        .delete()
        .eq("user_id", user.id)
        .eq("recurso_id", validacao.data);

  // Marcar duas vezes é idempotente: a PK já registra a mesma marca.
  if (resultado.error && !(visto && resultado.error.code === "23505")) {
    reportarErro(resultado.error, {
      modulo: "aluno",
      operacao: visto ? "marcar_recurso_visto" : "desmarcar_recurso_visto",
    });
    return { ok: false, mensagem: "Não conseguimos salvar esta marca. Tente novamente." };
  }

  return { ok: true };
}
