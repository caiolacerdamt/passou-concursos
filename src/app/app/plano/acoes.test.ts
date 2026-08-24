import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  reordenar: vi.fn(),
  adiar: vi.fn(),
  curta: vi.fn(),
  reportar: vi.fn(),
  revalidar: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: dependencias.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: dependencias.revalidar }));
vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.matricula,
}));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));
vi.mock("@/modules/aluno/plano", () => ({
  PlanoRecusado: class PlanoRecusado extends Error {},
  reordenarBlocosPendentes: dependencias.reordenar,
  adiarBloco: dependencias.adiar,
  escolherVersaoCurta: dependencias.curta,
}));

const {
  adiarBloco,
  escolherVersaoCurta,
  reordenarBlocosPendentes,
} = await import("./acoes");

function formulario(pares: Record<string, string | string[]>): FormData {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries(pares)) {
    if (Array.isArray(valor)) {
      for (const item of valor) dados.append(campo, item);
    } else {
      dados.set(campo, valor);
    }
  }
  return dados;
}

describe("ações do plano", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.cliente.mockResolvedValue({ id: "cliente-sessao" });
    dependencias.reordenar.mockResolvedValue(undefined);
    dependencias.adiar.mockResolvedValue("2026-08-29");
    dependencias.curta.mockResolvedValue({ nQuestoes: 3, minutosEstimados: 6 });
  });

  it("reordena no nível declarado e revalida Hoje e Plano", async () => {
    const dados = formulario({
      planoId: "plano-1",
      nivel: "meta_cheia",
      origem: "plano",
      blocoIds: ["bloco-2", "bloco-1"],
    });

    await expect(reordenarBlocosPendentes(dados)).rejects.toThrow(
      "NEXT_REDIRECT:/app/plano?resultado=reordenado",
    );
    expect(dependencias.reordenar).toHaveBeenCalledWith(
      { id: "cliente-sessao" },
      { planoId: "plano-1", nivel: "meta_cheia", blocoIds: ["bloco-2", "bloco-1"] },
    );
    expect(dependencias.revalidar).toHaveBeenNthCalledWith(1, "/app");
    expect(dependencias.revalidar).toHaveBeenNthCalledWith(2, "/app/plano");
  });

  it("usa o cliente autenticado para adiar e escolher a versão curta", async () => {
    await expect(
      adiarBloco(formulario({ blocoId: "bloco-1", origem: "hoje" })),
    ).rejects.toThrow("NEXT_REDIRECT:/app?resultado=adiado");
    await expect(
      escolherVersaoCurta(formulario({ blocoId: "bloco-1", origem: "hoje" })),
    ).rejects.toThrow("NEXT_REDIRECT:/app?resultado=curta");

    expect(dependencias.adiar).toHaveBeenCalledWith({ id: "cliente-sessao" }, "bloco-1");
    expect(dependencias.curta).toHaveBeenCalledWith({ id: "cliente-sessao" }, "bloco-1");
    expect(dependencias.revalidar).toHaveBeenCalledTimes(4);
  });

  it("não expõe erro técnico nem toca o domínio com payload incompleto", async () => {
    await expect(
      reordenarBlocosPendentes(formulario({ planoId: "", nivel: "meta_cheia", blocoIds: [] })),
    ).rejects.toThrow("NEXT_REDIRECT:/app?resultado=erro");

    expect(dependencias.reordenar).not.toHaveBeenCalled();
    expect(dependencias.reportar).not.toHaveBeenCalled();
  });
});
