import { expect, it } from "vitest";

import { sufixo } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

descreveComBanco("registrar_topico_candidato (BANCO-05 P3 AC1)", () => {
  it("a segunda sugestao do mesmo nome soma ocorrencias em vez de duplicar", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const nome = `Politica Monetaria ${sufixo()}`;

      const { rows: primeira } = await cliente.query(
        "select public.registrar_topico_candidato($1) as id",
        [nome],
      );
      const { rows: segunda } = await cliente.query(
        // Caixa e espaco diferentes: e o mesmo topico, e a fila de curadoria
        // nao pode virar uma lista de sinonimos.
        "select public.registrar_topico_candidato($1) as id",
        [`  ${nome.toUpperCase()}  `],
      );

      expect(segunda[0].id).toBe(primeira[0].id);

      const { rows } = await cliente.query(
        "select ocorrencias, status from public.topico_candidato where id = $1",
        [primeira[0].id],
      );
      expect(rows[0].ocorrencias).toBe(2);
      expect(rows[0].status).toBe("pendente");
    });
  });

  it("nao cria topico canonico: a taxonomia nao muda de tamanho", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: antes } = await cliente.query(
        "select count(*)::int as total from public.topicos",
      );

      await cliente.query("select public.registrar_topico_candidato($1)", [
        `Assunto Novo ${sufixo()}`,
      ]);

      const { rows: depois } = await cliente.query(
        "select count(*)::int as total from public.topicos",
      );
      expect(depois[0].total).toBe(antes[0].total);
    });
  });

  it("o mesmo nome em materias diferentes sao candidatos diferentes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const nome = `Juros ${sufixo()}`;
      const { rows: materias } = await cliente.query(
        `insert into public.materias (nome) values ($1), ($2) returning id`,
        [`Materia A ${sufixo()}`, `Materia B ${sufixo()}`],
      );

      const { rows: a } = await cliente.query(
        "select public.registrar_topico_candidato($1, $2) as id",
        [nome, materias[0].id],
      );
      const { rows: b } = await cliente.query(
        "select public.registrar_topico_candidato($1, $2) as id",
        [nome, materias[1].id],
      );

      expect(a[0].id).not.toBe(b[0].id);
    });
  });

  it("o mesmo nome volta a ser candidato depois de rejeitado", async () => {
    // A unicidade e so entre os pendentes de proposito: uma sugestao que o
    // operador ja rejeitou e que reaparece e informacao, nao ruido.
    await comTransacaoRevertida(async (cliente) => {
      const nome = `Assunto ${sufixo()}`;
      const { rows: primeira } = await cliente.query(
        "select public.registrar_topico_candidato($1) as id",
        [nome],
      );
      await cliente.query(
        `update public.topico_candidato
            set status = 'rejeitado', decidido_em = now(), decidido_por = null,
                motivo_decisao = 'rejeicao de teste'
          where id = $1`,
        [primeira[0].id],
      );

      const { rows: segunda } = await cliente.query(
        "select public.registrar_topico_candidato($1) as id",
        [nome],
      );
      expect(segunda[0].id).not.toBe(primeira[0].id);
    });
  });

  it("recusa candidato sem nome", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        cliente.query("select public.registrar_topico_candidato($1)", ["   "]),
      ).rejects.toThrow(/precisa de nome/);
    });
  });

  it("nao esta concedida a anon nem a authenticated", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query(
        `select count(*)::int as concessoes
           from information_schema.routine_privileges
          where routine_schema = 'public'
            and routine_name = 'registrar_topico_candidato'
            and grantee in ('anon', 'authenticated')`,
      );
      expect(rows[0].concessoes).toBe(0);
    });
  });
});
