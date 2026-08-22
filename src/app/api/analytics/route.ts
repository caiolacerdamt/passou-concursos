import { NextResponse } from "next/server";

import { normalizarEventoDoFunil } from "@/modules/analytics/funil";
import { publicarEventoDoFunil } from "@/modules/analytics/posthog";
import { reportarErro } from "@/modules/observabilidade/reporte";

const TAMANHO_MAXIMO_DO_CORPO = 16_384;

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const tipo = request.headers.get("content-type") ?? "";
  if (!tipo.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false }, { status: 415 });
  }

  const corpo = await request.text();
  if (corpo.length > TAMANHO_MAXIMO_DO_CORPO) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let entrada: unknown;
  try {
    entrada = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const normalizado = normalizarEventoDoFunil(entrada);
  if (!normalizado.aceito) {
    reportarErro(new Error("evento de funil rejeitado"), {
      modulo: "analytics",
      motivo: normalizado.motivo,
      quantidadeDescartada: normalizado.quantidadeDescartada,
    });
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const resultado = await publicarEventoDoFunil(normalizado);
    if (!resultado.enviado && resultado.motivo === "indisponivel") {
      reportarErro(new Error("posthog indisponivel"), {
        modulo: "analytics",
        evento: normalizado.evento,
      });
    }
  } catch (erro) {
    // Analytics é observabilidade de produto, não dependência da compra.
    reportarErro(erro, {
      modulo: "analytics",
      evento: normalizado.evento,
    });
  }

  return NextResponse.json({ ok: true });
}
