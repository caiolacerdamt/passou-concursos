import { expect, it } from "vitest";

import { criarTopico, inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

async function prontidao(
  cliente: Parameters<Parameters<typeof comTransacaoRevertida>[0]>[0],
  topico: string,
) {
  const { rows } = await cliente.query<{
    no_edital: boolean;
    publicadas: number;
    aptas_sessao: number;
    recursos_ativos: number;
    minimo_aptas: number;
    pronto: boolean;
  }>(
    `select no_edital, publicadas, aptas_sessao, recursos_ativos, minimo_aptas, pronto
       from public.prontidao_conteudo where topico_id = $1`,
    [topico],
  );
  return rows[0];
}

async function recurso(
  cliente: Parameters<Parameters<typeof comTransacaoRevertida>[0]>[0],
  topico: string,
  ativo: boolean,
): Promise<void> {
  await cliente.query(
    `insert into public.recursos_estudo
       (topico_id, titulo, url, tipo, duracao_minutos, ordem, ativo)
     values ($1, 'Aula', 'https://conteudo.test/aula', 'video', 20, 1, $2)`,
    [topico, ativo],
  );
}

descreveComBanco("prontidão de conteúdo", () => {
  it("só fica pronto com o piso de questões aptas e um recurso ativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      for (let indice = 0; indice < 5; indice += 1) {
        await inserirQuestao(cliente, { topico_id: topico, status: "publicada" });
      }

      expect(await prontidao(cliente, topico)).toMatchObject({
        aptas_sessao: 5,
        recursos_ativos: 0,
        pronto: false,
      });

      await recurso(cliente, topico, true);

      expect(await prontidao(cliente, topico)).toMatchObject({
        aptas_sessao: 5,
        recursos_ativos: 1,
        minimo_aptas: 5,
        pronto: true,
      });
    });
  });

  it("recurso inativo e questão abaixo do piso não contam como prontidão", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      await inserirQuestao(cliente, { topico_id: topico, status: "publicada" });
      await recurso(cliente, topico, false);

      expect(await prontidao(cliente, topico)).toMatchObject({
        publicadas: 1,
        aptas_sessao: 1,
        recursos_ativos: 0,
        pronto: false,
      });
    });
  });

  it("marca no_edital conforme o programa do perfil ativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      await inserirQuestao(cliente, { topico_id: topico, status: "publicada" });

      expect((await prontidao(cliente, topico)).no_edital).toBe(false);

      await cliente.query(
        `update public.perfil_concurso
            set programa_edital = programa_edital || to_jsonb($1::text)
          where ativo`,
        [topico],
      );

      expect((await prontidao(cliente, topico)).no_edital).toBe(true);
    });
  });

  it("não expõe a prontidão ao navegador", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const papel of ["anon", "authenticated"]) {
        const { rows } = await cliente.query<{ le: boolean }>(
          "select has_table_privilege($1, 'public.prontidao_conteudo', 'SELECT') as le",
          [papel],
        );
        expect(rows[0].le).toBe(false);
      }
    });
  });
});
