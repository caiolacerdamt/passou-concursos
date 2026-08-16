import type { Client } from "pg";
import { expect, it } from "vitest";

import { comBanco } from "./conexao";
import { descreveComBanco } from "./setup";

descreveComBanco("conexao com o banco de desenvolvimento", () => {
  it("abre a conexao, consulta, e fecha ao terminar", async () => {
    let clienteUsado: Client | undefined;

    const banco = await comBanco(async (cliente) => {
      clienteUsado = cliente;
      const { rows } = await cliente.query<{ banco: string }>(
        "select current_database() as banco",
      );
      return rows[0].banco;
    });

    // Abriu: a consulta rodou de verdade no Postgres do projeto.
    expect(banco).toBe("postgres");

    // Fechou: consultar o mesmo cliente depois nao funciona mais.
    await expect(clienteUsado!.query("select 1")).rejects.toThrow();
  });
});
