import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  cliente: vi.fn(),
  exportar: vi.fn(),
  registrar: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("@/modules/lgpd/exportacao", async () => {
  const real = await vi.importActual<typeof import("@/modules/lgpd/exportacao")>(
    "@/modules/lgpd/exportacao",
  );
  return {
    ...real,
    exportarDadosDoTitular: dependencias.exportar,
    registrarPedidoDeExportacao: dependencias.registrar,
  };
});

const { POST } = await import("./route");

const EXPORTACAO = {
  gerado_em: "2026-09-08T12:00:00.000Z",
  titular: { id: "aluno-a", email: "a@exemplo.com" },
  completa: true,
  tabelas: {
    tentativas: { linhas: [{ id: "t1" }, { id: "t2" }], truncada: false, linhas_omitidas: 0 },
  },
};

function pedido() {
  return new Request("https://passou.test/app/conta/exportar", { method: "POST" });
}

function comSessao(user: { id: string; email?: string } | null) {
  dependencias.cliente.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
  });
}

describe("POST /app/conta/exportar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comSessao({ id: "aluno-a", email: "a@exemplo.com" });
    dependencias.exportar.mockResolvedValue(EXPORTACAO);
    dependencias.registrar.mockResolvedValue(undefined);
  });

  it("entrega o JSON como anexo, com a data no nome do arquivo", async () => {
    const resposta = await POST(pedido());

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toContain("application/json");
    expect(resposta.headers.get("content-disposition")).toBe(
      'attachment; filename="passou-concursos-dados-2026-09-08.json"',
    );
    expect(JSON.parse(await resposta.text())).toEqual(EXPORTACAO);
  });

  /*
   * O arquivo carrega dado pessoal do titular. Nenhum intermediário guarda cópia.
   */
  it("não deixa o arquivo ser cacheado no caminho", async () => {
    const resposta = await POST(pedido());

    expect(resposta.headers.get("cache-control")).toContain("no-store");
  });

  /**
   * A autorização é uma só e é a **sessão**. O titular sai do cookie, e não há
   * onde dizer de quem são os dados — por isso não existe caminho para pedir os
   * de outra pessoa.
   */
  it("o titular vem do cookie, nunca do pedido", async () => {
    comSessao({ id: "aluno-real", email: "real@exemplo.com" });

    await POST(
      new Request("https://passou.test/app/conta/exportar?user_id=vitima", {
        method: "POST",
        body: "user_id=vitima",
      }),
    );

    expect(dependencias.exportar).toHaveBeenCalledWith({
      id: "aluno-real",
      email: "real@exemplo.com",
    });
  });

  it("sem sessão manda para o login e não monta arquivo nenhum", async () => {
    comSessao(null);

    const resposta = await POST(pedido());

    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toContain("/entrar");
    expect(dependencias.exportar).not.toHaveBeenCalled();
  });

  it("registra o pedido com o total de linhas entregues", async () => {
    await POST(pedido());

    expect(dependencias.registrar).toHaveBeenCalledWith("aluno-a", {
      linhas_exportadas: 2,
      truncada: false,
    });
  });

  it("arquivo cortado fica registrado como truncado", async () => {
    dependencias.exportar.mockResolvedValue({ ...EXPORTACAO, completa: false });

    await POST(pedido());

    expect(dependencias.registrar).toHaveBeenCalledWith(
      "aluno-a",
      expect.objectContaining({ truncada: true }),
    );
  });

  /*
   * Falha total da montagem não vira arquivo pela metade: o aluno arquivaria e
   * confiaria. Falha *por tabela* é outra coisa — sai marcada dentro do JSON.
   */
  it("falha na montagem não entrega meio arquivo", async () => {
    const erro = new Error("banco fora do ar");
    dependencias.exportar.mockRejectedValue(erro);

    const resposta = await POST(pedido());

    expect(resposta.status).toBe(303);
    expect(resposta.headers.get("location")).toContain("resultado=exportacao_falhou");
    expect(dependencias.reportar).toHaveBeenCalledWith(
      erro,
      expect.objectContaining({ operacao: "exportar_dados" }),
    );
    expect(dependencias.registrar).not.toHaveBeenCalled();
  });
});
