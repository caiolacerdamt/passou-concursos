import type { Client } from "pg";
import { afterEach, expect, it } from "vitest";

import {
  type LinhaDeConfigBruta,
  definirLeitorAdministrativoDeConfig,
  lerConfiguracoesAdministrativas,
  restaurarLeitorAdministrativoPadrao,
} from "@/modules/config/escrita";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

afterEach(() => {
  restaurarLeitorAdministrativoPadrao();
});

function ligarLeitorNaTransacao(cliente: Client): void {
  definirLeitorAdministrativoDeConfig(async (): Promise<readonly LinhaDeConfigBruta[]> => {
    const { rows } = await cliente.query<LinhaDeConfigBruta>(
      `select id, chave, valor, modulo_dono, alterado_por, motivo, alterado_em
         from public.configuracoes
        order by id asc`,
    );
    return rows;
  });
}

descreveComBanco("leitura administrativa da configuracao", () => {
  it("preserva catalogo, valor vigente, historico e autoria", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: usuarios } = await cliente.query<{ id: string }>(
        `insert into auth.users (id)
         values (gen_random_uuid()), (gen_random_uuid())
         returning id`,
      );
      const [primeiroAutor, segundoAutor] = usuarios.map((usuario) => usuario.id);

      await cliente.query(
        `insert into public.configuracoes
          (chave, valor, modulo_dono, alterado_por, motivo)
         values
          ('param.m4.minutos_por_questao', '2'::jsonb, 'm4', $1, 'valor inicial'),
          ('param.m4.minutos_por_questao', '3'::jsonb, 'm4', $2, 'ritmo do piloto')`,
        [primeiroAutor, segundoAutor],
      );
      ligarLeitorNaTransacao(cliente);

      const configuracoes = await lerConfiguracoesAdministrativas();
      const minutos = configuracoes.find(
        (configuracao) => configuracao.chave === "param.m4.minutos_por_questao",
      );

      expect(minutos).toMatchObject({
        chave: "param.m4.minutos_por_questao",
        moduloDono: "m4",
        padrao: 2,
        vigente: {
          valor: 3,
          autorId: segundoAutor,
          motivo: "ritmo do piloto",
        },
      });
      expect(minutos?.descricao).toContain("tempo");
      expect(minutos?.historico).toHaveLength(2);
      expect(minutos?.historico.map((linha) => [
        linha.valor,
        linha.autorId,
        linha.motivo,
        linha.alteradoEm,
      ])).toEqual([
        [2, primeiroAutor, "valor inicial", expect.any(String)],
        [3, segundoAutor, "ritmo do piloto", expect.any(String)],
      ]);
    });
  });
});
