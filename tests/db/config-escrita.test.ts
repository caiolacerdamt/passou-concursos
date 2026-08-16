import type { Client } from "pg";
import { afterEach, expect, it } from "vitest";

import {
  definirGravadorDeConfig,
  definirInvalidacaoDeCache,
  restaurarGravadorPadrao,
  restaurarInvalidacaoPadrao,
  setConfig,
} from "@/modules/config/escrita";
import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  getParam,
  restaurarLeitorPadrao,
} from "@/modules/config/leitura";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

afterEach(() => {
  restaurarGravadorPadrao();
  restaurarInvalidacaoPadrao();
  restaurarLeitorPadrao();
});

/** Grava e le pela mesma transacao, para o rollback dar conta da limpeza. */
function ligarNaTransacao(cliente: Client): { invalidacoes: () => number } {
  let contador = 0;

  definirGravadorDeConfig(async (linha) => {
    await cliente.query(
      `insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
       values ($1, $2::jsonb, $3, $4, $5)`,
      [
        linha.chave,
        JSON.stringify(linha.valor),
        linha.moduloDono,
        linha.autorId,
        linha.motivo ?? null,
      ],
    );
  });

  definirInvalidacaoDeCache(() => {
    contador += 1;
  });

  const leitor: LeitorDeConfig = async (chaves) => {
    const { rows } = await cliente.query<{ chave: string; valor: unknown }>(
      "select chave, valor from public.configuracoes_vigentes where chave = any($1)",
      [chaves as string[]],
    );
    return Object.fromEntries(rows.map((l) => [l.chave, l.valor]));
  };
  definirLeitorDeConfig(leitor);

  return { invalidacoes: () => contador };
}

descreveComBanco("escrita de configuracao contra o banco", () => {
  it("dois setConfig na mesma chave deixam duas linhas, e o historico conta a troca (AC7)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: usuario } = await cliente.query<{ id: string }>(
        "insert into auth.users (id) values (gen_random_uuid()) returning id",
      );
      const autor = usuario[0].id;
      ligarNaTransacao(cliente);

      const chave = "param.m4.minutos_por_questao";
      await setConfig(chave, 2, { autorId: autor, motivo: "valor de partida" });
      await setConfig(chave, 3, { autorId: autor, motivo: "aluno reclamou do ritmo" });

      const { rows } = await cliente.query<{
        valor: number;
        motivo: string;
        alterado_por: string;
        alterado_em: Date;
      }>(
        `select valor, motivo, alterado_por, alterado_em from public.configuracoes
         where chave = $1 order by id asc`,
        [chave],
      );

      // Duas linhas: a primeira nao foi sobrescrita.
      expect(rows).toHaveLength(2);
      // Quem, quando, valor anterior e valor novo — tudo da propria tabela.
      expect(rows.map((l) => l.valor)).toEqual([2, 3]);
      expect(rows.map((l) => l.motivo)).toEqual([
        "valor de partida",
        "aluno reclamou do ritmo",
      ]);
      expect(rows.every((l) => l.alterado_por === autor)).toBe(true);
      expect(rows.every((l) => l.alterado_em instanceof Date)).toBe(true);
    });
  });

  it("depois de gravar, a leitura devolve o valor novo e o cache foi invalidado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: usuario } = await cliente.query<{ id: string }>(
        "insert into auth.users (id) values (gen_random_uuid()) returning id",
      );
      const autor = usuario[0].id;
      const { invalidacoes } = ligarNaTransacao(cliente);

      const chave = "param.m4.dias_sem_repetir_questao";
      expect(await getParam(chave)).toBe(30); // default do catalogo

      await setConfig(chave, 45, { autorId: autor, motivo: "acervo ainda pequeno" });

      expect(await getParam(chave)).toBe(45);
      expect(invalidacoes()).toBe(1);
    });
  });

  it("o banco recusa autor que nao existe em auth.users", async () => {
    await comTransacaoRevertida(async (cliente) => {
      ligarNaTransacao(cliente);

      // Passa na validacao do codigo (e uuid, nao e vazio) e morre na chave
      // estrangeira: alterado_por precisa ser gente de verdade.
      await expect(
        setConfig("flag.m4.simulado_semanal", true, {
          autorId: "00000000-0000-4000-8000-000000000000",
          motivo: "autor inexistente",
        }),
      ).rejects.toThrow(/alterado_por_fkey|foreign key/i);
    });
  });
});
