"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  decidirTopicoCandidato,
  editarTaxonomia as editarTaxonomiaDoPainel,
  EntradaDoOperadorInvalida,
} from "@/modules/operador";
import { reportarErro } from "@/modules/observabilidade/reporte";

function texto(formulario: FormData, campo: string): string {
  return String(formulario.get(campo) ?? "");
}

function voltar(estado: "decidido" | "editado" | "entrada" | "erro"): never {
  redirect(`/operador/taxonomia?estado=${estado}`);
}

export async function decidirCandidato(formulario: FormData): Promise<never> {
  const materiaId = texto(formulario, "materiaId").trim();
  const nome = texto(formulario, "nome").trim();

  try {
    await decidirTopicoCandidato({
      candidatoId: texto(formulario, "candidatoId"),
      decisao: texto(formulario, "decisao"),
      materiaId: materiaId || null,
      nome: nome || null,
      motivo: texto(formulario, "motivo"),
    });
  } catch (erro) {
    if (erro instanceof EntradaDoOperadorInvalida) return voltar("entrada");
    reportarErro(erro, { modulo: "operador", operacao: "decidir_candidato" });
    return voltar("erro");
  }

  revalidatePath("/operador/taxonomia");
  return voltar("decidido");
}

export async function editarTaxonomia(formulario: FormData): Promise<never> {
  const tipo = texto(formulario, "tipo");
  const campos: Record<string, unknown> = {};
  const nome = texto(formulario, "nome").trim();
  const ordem = texto(formulario, "ordem");
  const ativa = texto(formulario, "ativa");
  const materiaId = texto(formulario, "materiaId").trim();

  if (nome) campos.nome = nome;
  if (ordem) campos.ordem = Number(ordem);
  if (tipo === "materia" && (ativa === "true" || ativa === "false")) campos.ativa = ativa === "true";
  if (tipo === "topico" && (ativa === "true" || ativa === "false")) campos.ativo = ativa === "true";
  if (tipo === "topico" && materiaId) campos.materiaId = materiaId;

  try {
    await editarTaxonomiaDoPainel({
      tipo,
      id: texto(formulario, "id"),
      motivo: texto(formulario, "motivo"),
      campos,
    });
  } catch (erro) {
    if (erro instanceof EntradaDoOperadorInvalida) return voltar("entrada");
    reportarErro(erro, { modulo: "operador", operacao: "editar_taxonomia" });
    return voltar("erro");
  }

  revalidatePath("/operador/taxonomia");
  return voltar("editado");
}
