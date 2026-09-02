import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  flag: vi.fn(),
  trajetoria: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/modules/config", () => ({ isFlagOn: dependencias.flag }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("./trajetoria", () => ({ consultarTrajetoria: dependencias.trajetoria }));

const { consultarTrajetoriaOpcional } = await import("./trajetoria-opcional");

const cliente = {} as never;

describe("consultarTrajetoriaOpcional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("com a flag desligada nem consulta", async () => {
    dependencias.flag.mockResolvedValue(false);

    await expect(consultarTrajetoriaOpcional(cliente)).resolves.toBeNull();
    expect(dependencias.trajetoria).not.toHaveBeenCalled();
  });

  it("com a flag ligada devolve a leitura e repassa a data da prova", async () => {
    dependencias.flag.mockResolvedValue(true);
    dependencias.trajetoria.mockResolvedValue({ total: { nTopicos: 3 } });

    await expect(
      consultarTrajetoriaOpcional(cliente, { dataProva: "2027-01-27" }),
    ).resolves.toEqual({ total: { nTopicos: 3 } });
    expect(dependencias.trajetoria).toHaveBeenCalledWith(
      cliente,
      expect.objectContaining({ dataProva: "2027-01-27" }),
    );
  });

  it("falha de leitura vira ausência silenciosa com erro reportado", async () => {
    dependencias.flag.mockResolvedValue(true);
    dependencias.trajetoria.mockRejectedValue(new Error("indisponível"));

    // Trajetória indisponível não pode derrubar o Progresso: ela é
    // enquadramento, não a informação que o aluno veio buscar.
    await expect(consultarTrajetoriaOpcional(cliente)).resolves.toBeNull();
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operacao: "consultar_trajetoria" }),
    );
  });
});
