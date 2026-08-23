import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  consultar: vi.fn(),
  salvar: vi.fn(),
}));

vi.mock("@/modules/operador", () => ({
  consultarConfiguracoes: dependencias.consultar,
}));
vi.mock("./acoes", () => ({
  salvarConfiguracao: dependencias.salvar,
}));

const { default: Configuracao } = await import("./page");

const configuracoes = [
  {
    chave: "flag.m5.raiox" as const,
    tipo: "flag" as const,
    moduloDono: "m5" as const,
    descricao: "Tela do Raio-X.",
    padrao: false,
    vigente: {
      valor: true,
      autorId: "operador-2",
      motivo: "liberação do piloto",
      alteradoEm: "2026-08-23T10:00:00.000Z",
    },
    historico: [
      {
        id: 12,
        chave: "flag.m5.raiox" as const,
        valor: true,
        moduloDono: "m5" as const,
        autorId: "operador-2",
        motivo: "liberação do piloto",
        alteradoEm: "2026-08-23T10:00:00.000Z",
      },
    ],
  },
  {
    chave: "param.m4.minutos_por_questao" as const,
    tipo: "param" as const,
    moduloDono: "m4" as const,
    descricao: "Tempo estimado.",
    padrao: 2,
    vigente: {
      valor: 3,
      autorId: "operador-3",
      motivo: "calibração",
      alteradoEm: "2026-08-23T11:00:00.000Z",
    },
    historico: [
      {
        id: 13,
        chave: "param.m4.minutos_por_questao" as const,
        valor: 3,
        moduloDono: "m4" as const,
        autorId: "operador-3",
        motivo: "calibração",
        alteradoEm: "2026-08-23T11:00:00.000Z",
      },
    ],
  },
];

describe("/operador/configuracao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.consultar.mockResolvedValue(configuracoes);
  });

  it("mostra flag booleana, JSON e histórico antes/depois com autoria", async () => {
    const html = renderToStaticMarkup(
      await Configuracao({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("Configuração sem deploy");
    expect(html).toContain("flag.m5.raiox");
    expect(html).toContain("Ligada");
    expect(html).toContain("param.m4.minutos_por_questao");
    expect(html).toContain('name="valor"');
    expect(html).toContain("Antes");
    expect(html).toContain("Depois");
    expect(html).toContain("operador-2");
    expect(html).toContain("liberação do piloto");
  });

  it("mostra estado salvo sem expor dados externos", async () => {
    dependencias.consultar.mockResolvedValue([]);
    const html = renderToStaticMarkup(
      await Configuracao({ searchParams: Promise.resolve({ estado: "salvo" }) }),
    );

    expect(html).toContain("Configuração salva");
    expect(html).not.toContain("stack");
  });
});
