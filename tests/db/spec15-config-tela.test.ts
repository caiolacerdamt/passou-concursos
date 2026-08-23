import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

descreveComBanco("contrato de dados da tela de configuração", () => {
  it("expõe o último valor para uso e conserva antes/depois na tabela append-only", async () => {
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
          ('flag.m5.raiox', 'false'::jsonb, 'm5', $1, 'valor inicial'),
          ('flag.m5.raiox', 'true'::jsonb, 'm5', $2, 'liberação revisada')`,
        [primeiroAutor, segundoAutor],
      );

      const { rows: vigente } = await cliente.query<{ valor: boolean }>(
        `select valor::boolean as valor
           from public.configuracoes_vigentes
          where chave = 'flag.m5.raiox'`,
      );
      const { rows: historico } = await cliente.query<{ valor: boolean; alterado_por: string; motivo: string }>(
        `select valor::boolean as valor, alterado_por, motivo
           from public.configuracoes
          where chave = 'flag.m5.raiox'
            and alterado_por = any($1::uuid[])
          order by id asc`,
        [[primeiroAutor, segundoAutor]],
      );

      expect(vigente[0]?.valor).toBe(true);
      expect(historico).toEqual([
        { valor: false, alterado_por: primeiroAutor, motivo: "valor inicial" },
        { valor: true, alterado_por: segundoAutor, motivo: "liberação revisada" },
      ]);
    });
  });
});
