import { describe, expect, it, vi } from "vitest";

import {
  lerArgumentos,
  sincronizarProgramaEdital,
} from "./sincronizar-programa-edital.mts";

function cliente(
  perfis: Record<string, unknown>[],
  elegiveis: { topico_id: string; materia: string }[],
) {
  const executadas: { sql: string; parametros?: unknown[] }[] = [];
  return {
    executadas,
    cliente: {
      query: vi.fn(async (sql: string, parametros?: unknown[]) => {
        executadas.push({ sql, parametros });
        if (sql.includes("from public.perfil_concurso where ativo")) return { rows: perfis };
        if (sql.includes("from public.topicos t")) return { rows: elegiveis };
        if (sql.includes("recalcula_raiox")) return { rows: [{ linhas: 11 }] };
        return { rows: [] };
      }),
    },
  };
}

describe("sincronização do programa do edital", () => {
  const perfil = [
    {
      id: "perfil-1",
      programa_edital: ["topico-demo", "topico-portugues"],
    },
  ];
  const elegiveis = [
    { topico_id: "topico-etica", materia: "Ética e Compliance" },
    { topico_id: "topico-portugues", materia: "Língua Portuguesa" },
  ];

  it("recusa argumento desconhecido", () => {
    expect(lerArgumentos(["--dry-run"])).toEqual({ dryRun: true });
    expect(() => lerArgumentos(["--tudo"])).toThrow(/uso:/);
  });

  it("troca o programa pelos tópicos publicados e recalcula o Raio-X", async () => {
    const { cliente: falso, executadas } = cliente(perfil, elegiveis);

    const relatorio = await sincronizarProgramaEdital(falso, { transacao: false });

    expect(relatorio).toEqual({
      topicosNoEdital: 2,
      materias: ["Ética e Compliance", "Língua Portuguesa"],
      removidos: ["topico-demo"],
      linhasDoRaiox: 11,
    });
    const escrita = executadas.find((linha) => linha.sql.includes("update public.perfil_concurso"));
    expect(escrita?.parametros?.[1]).toBe(JSON.stringify(["topico-etica", "topico-portugues"]));
    expect(executadas.some((linha) => linha.sql.includes("recalcula_raiox"))).toBe(true);
  });

  it("no dry-run não escreve nem recalcula", async () => {
    const { cliente: falso, executadas } = cliente(perfil, elegiveis);

    const relatorio = await sincronizarProgramaEdital(falso, {
      transacao: false,
      dryRun: true,
    });

    expect(relatorio.topicosNoEdital).toBe(2);
    expect(relatorio.linhasDoRaiox).toBe(0);
    expect(executadas.some((linha) => linha.sql.includes("update"))).toBe(false);
    expect(executadas.some((linha) => linha.sql.includes("recalcula_raiox"))).toBe(false);
  });

  it("para quando não há perfil ativo", async () => {
    const { cliente: falso } = cliente([], elegiveis);
    await expect(sincronizarProgramaEdital(falso, { transacao: false })).rejects.toThrow(
      /nenhum perfil de concurso ativo/,
    );
  });
});
