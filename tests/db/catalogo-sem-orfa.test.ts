import { expect, it } from "vitest";

import { CHAVES, chavesOrfas } from "@/modules/config/catalogo";

import { comBanco, comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

const CHAVES_DO_BANCO = "select distinct chave from public.configuracoes";

descreveComBanco("catalogo x banco", () => {
  it("nao existe chave orfa em configuracoes (AC8)", async () => {
    // Parte 1: o estado real do banco nao tem chave que o codigo nao saiba ler.
    const noBanco = await comBanco(async (cliente) => {
      const { rows } = await cliente.query<{ chave: string }>(CHAVES_DO_BANCO);
      return rows.map((l) => l.chave);
    });
    expect(chavesOrfas(noBanco)).toEqual([]);

    // Parte 2: e o detector realmente detecta. Sem isto, a parte 1 passaria
    // igual com a tabela vazia e nao provaria nada.
    await comTransacaoRevertida(async (cliente) => {
      const { rows: usuario } = await cliente.query<{ id: string }>(
        "insert into auth.users (id) values (gen_random_uuid()) returning id",
      );
      const orfa = "param.m4.chave_que_ninguem_declarou";
      await cliente.query(
        `insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
         values ($1, '1'::jsonb, 'm4', $2, 'teste de orfa')`,
        [orfa, usuario[0].id],
      );

      const { rows } = await cliente.query<{ chave: string }>(CHAVES_DO_BANCO);
      const chaves = rows.map((l) => l.chave);

      expect(chaves).toContain(orfa);
      expect(chavesOrfas(chaves)).toEqual([orfa]);
      // Chave declarada no catalogo nunca e apontada como orfa.
      expect(chavesOrfas(CHAVES)).toEqual([]);
    });
  });
});
