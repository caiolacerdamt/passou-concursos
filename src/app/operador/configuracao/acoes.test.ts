import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  salvar: vi.fn(),
  revalidar: vi.fn(),
  redirecionar: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  reportar: vi.fn(),
}));

vi.mock("@/modules/operador", () => ({
  alterarConfiguracao: dependencias.salvar,
  EntradaDoOperadorInvalida: class EntradaDoOperadorInvalida extends Error {},
}));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));
vi.mock("next/cache", () => ({
  revalidatePath: dependencias.revalidar,
}));
vi.mock("next/navigation", () => ({
  redirect: dependencias.redirecionar,
}));

const { salvarConfiguracao } = await import("./acoes");

describe("ação de configuração do operador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.salvar.mockResolvedValue(undefined);
  });

  it("converte uma flag para booleano e envia motivo", async () => {
    const formulario = new FormData();
    formulario.set("chave", "flag.m5.raiox");
    formulario.set("valor", "true");
    formulario.set("motivo", "homologação da tela do Raio-X");

    await expect(salvarConfiguracao(formulario)).rejects.toThrow("REDIRECT:/operador/configuracao?estado=salvo");
    expect(dependencias.salvar).toHaveBeenCalledWith({
      chave: "flag.m5.raiox",
      valor: true,
      motivo: "homologação da tela do Raio-X",
    });
    expect(dependencias.revalidar).toHaveBeenCalledWith("/operador/configuracao");
  });

  it("converte parâmetro JSON sem aceitar texto fora do parser", async () => {
    const formulario = new FormData();
    formulario.set("chave", "param.m4.fsrs_faixas_nota");
    formulario.set("valor", '{"errei":0.4,"dificil":0.65,"bom":0.9}');
    formulario.set("motivo", "calibração do piloto");

    await expect(salvarConfiguracao(formulario)).rejects.toThrow("REDIRECT:/operador/configuracao?estado=salvo");
    expect(dependencias.salvar).toHaveBeenCalledWith({
      chave: "param.m4.fsrs_faixas_nota",
      valor: { errei: 0.4, dificil: 0.65, bom: 0.9 },
      motivo: "calibração do piloto",
    });
  });

  it("orienta JSON inválido sem chamar a mutação nem vazar detalhe", async () => {
    const formulario = new FormData();
    formulario.set("chave", "param.m4.fsrs_faixas_nota");
    formulario.set("valor", "{quebrado");
    formulario.set("motivo", "teste");

    await expect(salvarConfiguracao(formulario)).rejects.toThrow("REDIRECT:/operador/configuracao?estado=entrada");
    expect(dependencias.salvar).not.toHaveBeenCalled();
    expect(dependencias.reportar).not.toHaveBeenCalled();
  });
});
