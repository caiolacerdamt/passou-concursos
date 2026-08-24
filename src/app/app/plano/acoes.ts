"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import {
  PlanoRecusado,
  adiarBloco as adiarBlocoNoDominio,
  escolherVersaoCurta as escolherVersaoCurtaNoDominio,
  reordenarBlocosPendentes as reordenarNoDominio,
  type NivelDoPlano,
} from "@/modules/aluno/plano";
import { reportarErro } from "@/modules/observabilidade/reporte";

type SuperficieDoPlano = "hoje" | "plano";

const DESTINOS = {
  hoje: "/app",
  plano: "/app/plano",
} as const satisfies Record<SuperficieDoPlano, string>;

/** Reordena uma permutação completa de pendências de um nível do plano. */
export async function reordenarBlocosPendentes(formulario: FormData): Promise<never> {
  const destino = await prepararOperacao(formulario);
  const planoId = texto(formulario, "planoId");
  const nivel = nivelDoFormulario(formulario);
  const blocoIds = formulario
    .getAll("blocoIds")
    .filter((valor): valor is string => typeof valor === "string" && valor.trim() !== "")
    .map((valor) => valor.trim());

  if (planoId === "" || nivel === null || blocoIds.length === 0) {
    return falha(destino);
  }

  try {
    const cliente = await clienteDaSessao();
    await reordenarNoDominio(cliente, { planoId, nivel, blocoIds });
    concluir(destino, "reordenado");
  } catch (erro) {
    tratarFalha(erro, destino, "reordenar_blocos");
  }
}

/** Move uma pendência para o próximo dia declarado com capacidade. */
export async function adiarBloco(formulario: FormData): Promise<never> {
  const destino = await prepararOperacao(formulario);
  const blocoId = texto(formulario, "blocoId");
  if (blocoId === "") return falha(destino);

  try {
    const cliente = await clienteDaSessao();
    await adiarBlocoNoDominio(cliente, blocoId);
    concluir(destino, "adiado");
  } catch (erro) {
    tratarFalha(erro, destino, "adiar_bloco");
  }
}

/** Seleciona a versão curta de uma pendência ainda não concluída. */
export async function escolherVersaoCurta(formulario: FormData): Promise<never> {
  const destino = await prepararOperacao(formulario);
  const blocoId = texto(formulario, "blocoId");
  if (blocoId === "") return falha(destino);

  try {
    const cliente = await clienteDaSessao();
    await escolherVersaoCurtaNoDominio(cliente, blocoId);
    concluir(destino, "curta");
  } catch (erro) {
    tratarFalha(erro, destino, "escolher_versao_curta");
  }
}

async function prepararOperacao(formulario: FormData): Promise<string> {
  await exigirMatriculaAtiva();
  return destinoDoFormulario(formulario);
}

function destinoDoFormulario(formulario: FormData): string {
  const origem = texto(formulario, "origem");
  return origem === "plano" ? DESTINOS.plano : DESTINOS.hoje;
}

function nivelDoFormulario(formulario: FormData): NivelDoPlano | null {
  const nivel = texto(formulario, "nivel");
  return nivel === "piso" || nivel === "meta_cheia" ? nivel : null;
}

function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function concluir(destino: string, resultado: "reordenado" | "adiado" | "curta"): never {
  revalidarPlano();
  redirect(`${destino}?resultado=${resultado}`);
}

function falha(destino: string): never {
  redirect(`${destino}?resultado=erro`);
}

function tratarFalha(erro: unknown, destino: string, operacao: string): never {
  if (ehRedirecionamentoDoNext(erro)) throw erro;

  if (!(erro instanceof PlanoRecusado)) {
    reportarErro(erro, { modulo: "aluno", operacao });
  }
  redirect(`${destino}?resultado=erro`);
}

function revalidarPlano(): void {
  revalidatePath(DESTINOS.hoje);
  revalidatePath(DESTINOS.plano);
}

function ehRedirecionamentoDoNext(erro: unknown): boolean {
  if (!(erro instanceof Error)) return false;
  if (erro.message.startsWith("NEXT_REDIRECT:")) return true;
  const digest = (erro as Error & { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
