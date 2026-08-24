import { describe, expect, it, vi } from "vitest";

import { consultarRevisoesDevidas } from "./revisoes-devidas";

describe("consultarRevisoesDevidas", () => {
  it("filtra no banco pelo dia do produto e ordena as linhas devidas", async () => {
    const cadeia = {
      lte: vi.fn(() => cadeia),
      order: vi.fn(() => cadeia),
      then: (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
        Promise.resolve({
          data: [
            { topico_id: "topico-2", due: "2026-08-21" },
            { topico_id: "topico-1", due: "2026-08-22" },
            { topico_id: null, due: "2026-08-20" },
          ],
          error: null,
        }).then(resolve, reject),
    };
    const cliente = {
      from: vi.fn(() => ({
        select: vi.fn(() => cadeia),
      })),
    };

    await expect(consultarRevisoesDevidas(cliente as never, "2026-08-22")).resolves.toEqual([
      { topicoId: "topico-2", due: "2026-08-21" },
      { topicoId: "topico-1", due: "2026-08-22" },
    ]);
    expect(cliente.from).toHaveBeenCalledWith("revisao_agenda");
    expect(cadeia.lte).toHaveBeenCalledWith("due", "2026-08-22");
    expect(cadeia.order).toHaveBeenNthCalledWith(1, "due", { ascending: true });
    expect(cadeia.order).toHaveBeenNthCalledWith(2, "topico_id", { ascending: true });
  });

  it("nomeia a falha sem expor o detalhe ao componente de tela", async () => {
    const cadeia = {
      lte: vi.fn(() => cadeia),
      order: vi.fn(() => cadeia),
      then: (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
        Promise.resolve({ data: null, error: { message: "indisponível" } }).then(resolve, reject),
    };
    const cliente = { from: vi.fn(() => ({ select: vi.fn(() => cadeia) })) };

    await expect(consultarRevisoesDevidas(cliente as never, "2026-08-22")).rejects.toThrow(
      "falha ao ler revisões devidas: indisponível",
    );
  });
});
