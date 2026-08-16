import type { Client } from "pg";
import { afterEach, expect, it } from "vitest";

import { CHAVES } from "@/modules/config/catalogo";
import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  getParam,
  isFlagOn,
  leitorDoBanco,
  restaurarLeitorPadrao,
} from "@/modules/config/leitura";

import { comBanco, comTransacaoRevertida } from "./conexao";
import { descreveComBanco, descreveComSupabase } from "./setup";

afterEach(() => {
  restaurarLeitorPadrao();
});

/** Le pela mesma transacao do teste, para o INSERT nao precisar ser commitado. */
function leitorNaTransacao(cliente: Client): LeitorDeConfig {
  return async (chaves) => {
    const { rows } = await cliente.query<{ chave: string; valor: unknown }>(
      "select chave, valor from public.configuracoes_vigentes where chave = any($1)",
      [chaves as string[]],
    );
    return Object.fromEntries(rows.map((linha) => [linha.chave, linha.valor]));
  };
}

descreveComBanco("leitura da configuracao contra o banco", () => {
  it("o valor muda por INSERT e a leitura enxerga, sem novo build (AC3)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: usuario } = await cliente.query<{ id: string }>(
        "insert into auth.users (id) values (gen_random_uuid()) returning id",
      );
      const autor = usuario[0].id;
      definirLeitorDeConfig(leitorNaTransacao(cliente));

      const inserir = (chave: string, valor: string, motivo: string) =>
        cliente.query(
          `insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
           values ($1, $2::jsonb, 'm4', $3, $4)`,
          [chave, valor, autor, motivo],
        );

      const chave = "param.m4.diagnostico_n_questoes";

      // Sem linha: vale o default declarado no catalogo.
      expect(await getParam(chave)).toBe(20);

      await inserir(chave, "25", "calibracao");
      expect(await getParam(chave)).toBe(25);

      // Segunda troca: o valor vigente e a ultima linha, nao a primeira.
      await inserir(chave, "35", "calibracao de novo");
      expect(await getParam(chave)).toBe(35);

      // O mesmo caminho liga uma flag que nasce desligada. Nenhum deploy no meio:
      // e isto que faz "deploy != release" ser verdade (AC3).
      expect(await isFlagOn("flag.m4.simulado_semanal")).toBe(false);
      await inserir("flag.m4.simulado_semanal", "true", "ligando o simulado");
      expect(await isFlagOn("flag.m4.simulado_semanal")).toBe(true);
    });
  });

});

descreveComSupabase("cliente Supabase de servidor", () => {
  it("alcanca a view de configuracao com a chave secreta", async () => {
    // Credencial errada ou RLS barrando devolvem *erro* do PostgREST, e o leitor
    // transforma erro em excecao — entao chegar aqui sem lancar ja prova acesso.
    const viaSupabase = await leitorDoBanco(CHAVES);

    const viaPostgres = await comBanco(async (cliente) => {
      const { rows } = await cliente.query<{ chave: string }>(
        "select chave from public.configuracoes_vigentes where chave = any($1)",
        [CHAVES as unknown as string[]],
      );
      return rows.map((linha) => linha.chave);
    });

    // O servidor enxerga exatamente o que o Postgres enxerga.
    expect(Object.keys(viaSupabase).sort()).toEqual([...viaPostgres].sort());
  });
});
