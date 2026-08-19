import { describe, expect, it, vi } from "vitest";

/**
 * O ramo que redireciona (PAG-01, gap G3 do Verificador).
 *
 * Fica em arquivo separado de `matricula.test.ts` porque precisa **trocar** dois
 * modulos do Next antes do import: `redirect` e o cliente de sessao. Misturar
 * `vi.mock` com o teste puro de `matriculaAtiva` faria os dois dependerem do
 * mesmo mock e um esconderia o outro.
 *
 * `redirect()` do Next funciona lancando — e por isso que
 * `exigirMatriculaAtiva` nao precisa de `return` depois dele. O mock repete esse
 * comportamento: se ele apenas devolvesse, o teste passaria com um codigo que na
 * producao continuaria renderizando a tela paga.
 */

const desvio = vi.hoisted(() => ({
  destino: null as string | null,
  user: { id: "aluno-a" } as { id: string } | null,
  linha: null as { id: string; estado: string; fim_em: string } | null,
}));

vi.mock("next/navigation", () => ({
  redirect: (para: string) => {
    desvio.destino = para;
    throw new Error(`NEXT_REDIRECT:${para}`);
  },
}));

vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: async () => ({
    auth: { getUser: async () => ({ data: { user: desvio.user } }) },
    from: () => {
      const construtor = {
        select: () => construtor,
        eq: () => construtor,
        gt: () => construtor,
        maybeSingle: async () => ({ data: desvio.linha }),
      };
      return construtor;
    },
  }),
}));

const { exigirMatriculaAtiva } = await import("./matricula");

describe("exigirMatriculaAtiva", () => {
  it("sem matricula desvia para /assinar e NAO devolve", async () => {
    desvio.destino = null;
    desvio.user = { id: "aluno-a" };
    desvio.linha = null;

    await expect(exigirMatriculaAtiva()).rejects.toThrow("NEXT_REDIRECT:/assinar");
    expect(desvio.destino).toBe("/assinar");
  });

  it("sem sessao tambem desvia: nao renderiza tela paga vazia", async () => {
    desvio.destino = null;
    desvio.user = null;
    desvio.linha = null;

    await expect(exigirMatriculaAtiva()).rejects.toThrow("NEXT_REDIRECT:/assinar");
  });

  it("com matricula ativa devolve a matricula e nao desvia", async () => {
    desvio.destino = null;
    desvio.user = { id: "aluno-a" };
    desvio.linha = { id: "m1", estado: "ativa", fim_em: "2027-01-01T00:00:00Z" };

    await expect(exigirMatriculaAtiva()).resolves.toEqual(desvio.linha);
    expect(desvio.destino).toBeNull();
  });
});
