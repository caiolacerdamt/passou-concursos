import type { Client } from "pg";
import { expect, it } from "vitest";

import { comBanco, comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

descreveComBanco("conexao com o banco de desenvolvimento", () => {
  it("reutiliza a conexao fisica e libera o cliente ao terminar", async () => {
    let clienteUsado: Client | undefined;

    const primeiroUso = await comBanco(async (cliente) => {
      clienteUsado = cliente;
      const { rows } = await cliente.query<{ banco: string; pid: number }>(
        "select current_database() as banco, pg_backend_pid() as pid",
      );
      return rows[0];
    });

    // Liberou: o teste nao pode continuar usando o cliente fora do callback.
    await expect(clienteUsado!.query("select 1")).rejects.toThrow();

    let segundoCliente: Client | undefined;
    const segundoPid = await comBanco(async (cliente) => {
      segundoCliente = cliente;
      const { rows } = await cliente.query<{ pid: number }>(
        "select pg_backend_pid() as pid",
      );
      return rows[0].pid;
    });

    expect(primeiroUso.banco).toBe("postgres");
    expect(segundoCliente).toBe(clienteUsado);
    expect(segundoPid).toBe(primeiroUso.pid);
  });

  it("reverte a transacao mesmo quando o teste falha", async () => {
    const nome = `rollback ${crypto.randomUUID()}`;

    await expect(
      comTransacaoRevertida(async (cliente) => {
        await cliente.query("insert into public.materias (nome) values ($1)", [nome]);
        throw new Error("falha proposital depois do insert");
      }),
    ).rejects.toThrow("falha proposital depois do insert");

    const quantidade = await comBanco(async (cliente) => {
      const { rows } = await cliente.query<{ n: string }>(
        "select count(*)::text as n from public.materias where nome = $1",
        [nome],
      );
      return Number(rows[0].n);
    });

    expect(quantidade).toBe(0);
  });
});
