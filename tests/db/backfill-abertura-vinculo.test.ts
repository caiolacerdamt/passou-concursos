import type { Client } from "pg";
import { expect, it } from "vitest";

import { sufixo } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * AD-146 T3 — a abertura grava o vinculo concurso-prova sozinha.
 *
 * A pergunta "esta prova pertence a este concurso?" ja foi respondida quando o
 * operador **aprovou** aquele documento dentro daquela abertura. O que se
 * verifica aqui e que a resposta vira linha em `concurso_provas` na mesma
 * transacao do download, sem nenhuma confirmacao nova — e que falhar no vinculo
 * desfaz o download inteiro, em vez de deixar arquivo medido e prova sem lastro.
 */

const SHA = "a".repeat(64);

async function criarOperador(cliente: Client): Promise<string> {
  const operador = await criarUsuario(cliente);
  await cliente.query("insert into public.operadores (operador_id) values ($1)", [operador]);
  return operador;
}

async function criarConcurso(cliente: Client): Promise<string> {
  const { rows: perfil } = await cliente.query<{ id: string }>(
    `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
     values ($1, 'indefinida', '[]'::jsonb, false) returning id`,
    [`Orgao ${sufixo()}`],
  );
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.concursos (orgao, cargo, perfil_concurso_id)
     values ($1, $2, $3) returning id`,
    [`Orgao ${sufixo()}`, `Cargo ${sufixo()}`, perfil[0].id],
  );
  return rows[0].id;
}

async function criarProva(cliente: Client): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.provas (banca, ano, orgao, cargo)
     values ('Fundacao Cesgranrio', 2023, $1, 'Escriturario') returning id`,
    [`Banco do Brasil ${sufixo()}`],
  );
  return rows[0].id;
}

/**
 * Uma abertura com um edital e uma prova, ja aprovados: o estado exato em que o
 * download comeca.
 */
async function aberturaComAprovados(
  cliente: Client,
  operador: string,
  concurso: string,
): Promise<{ abertura: string; edital: string; prova: string }> {
  const { rows: inicio } = await cliente.query<{ id: string }>(
    "select public.iniciar_abertura($1, $2) as id",
    [concurso, operador],
  );
  const abertura = inicio[0].id;
  const marca = sufixo();

  await cliente.query(
    "select public.registrar_documentos_encontrados($1, $2, $3::jsonb, 0, '[]'::jsonb)",
    [
      abertura,
      operador,
      JSON.stringify([
        {
          tipo: "edital",
          url: `https://cesgranrio.org.br/edital-${marca}.pdf`,
          titulo: "Edital",
          metadados: {},
        },
        {
          tipo: "prova",
          url: `https://cesgranrio.org.br/prova-${marca}.pdf`,
          titulo: "Prova",
          metadados: {},
        },
      ]),
    ],
  );

  const { rows: docs } = await cliente.query<{ id: string; tipo: string }>(
    "select id, tipo::text from public.concurso_documentos where abertura_id = $1",
    [abertura],
  );
  await cliente.query("select public.decidir_documentos($1, $2, $3::jsonb, $4)", [
    abertura,
    operador,
    JSON.stringify(docs.map((d) => ({ id: d.id, decisao: "aprovado" }))),
    "documentos conferidos pelo operador",
  ]);

  return {
    abertura,
    edital: docs.find((d) => d.tipo === "edital")!.id,
    prova: docs.find((d) => d.tipo === "prova")!.id,
  };
}

async function vinculos(cliente: Client, concurso: string) {
  const { rows } = await cliente.query<{
    prova_id: string;
    vinculada_por: string;
    motivo: string;
    abertura_id: string | null;
  }>(
    `select prova_id, vinculada_por, motivo, abertura_id
       from public.concurso_provas where concurso_id = $1 order by prova_id`,
    [concurso],
  );
  return rows;
}

descreveComBanco("AD-146 — a abertura grava o vinculo", () => {
  it("prova aprovada e baixada nasce vinculada; edital nao vincula nada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { abertura, edital, prova: documentoDaProva } = await aberturaComAprovados(
        cliente,
        operador,
        concurso,
      );
      const prova = await criarProva(cliente);

      await cliente.query("select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)", [
        abertura,
        operador,
        edital,
        2048,
        SHA,
        null,
      ]);
      expect(await vinculos(cliente, concurso)).toEqual([]);

      await cliente.query("select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)", [
        abertura,
        operador,
        documentoDaProva,
        4096,
        SHA,
        prova,
      ]);

      expect(await vinculos(cliente, concurso)).toEqual([
        {
          prova_id: prova,
          vinculada_por: operador,
          motivo: "prova aprovada e baixada na abertura do concurso",
          abertura_id: abertura,
        },
      ]);

      // A trilha guarda quem, o que e por que — e nenhuma linha do documento.
      const { rows: acoes } = await cliente.query<{
        operador_id: string;
        motivo: string;
        dados: { prova_id: string; abertura_id: string };
      }>(
        `select operador_id, motivo, dados from public.operador_acoes
          where tipo = 'vincular_prova_ao_concurso' and entidade_id = $1`,
        [concurso],
      );
      expect(acoes).toHaveLength(1);
      expect(acoes[0].operador_id).toBe(operador);
      expect(acoes[0].dados).toEqual({ prova_id: prova, abertura_id: abertura });
    });
  });

  it("baixar de novo devolve o mesmo vinculo, sem segunda linha nem segunda acao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { abertura, prova: documentoDaProva } = await aberturaComAprovados(
        cliente,
        operador,
        concurso,
      );
      const prova = await criarProva(cliente);

      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        await cliente.query("select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)", [
          abertura,
          operador,
          documentoDaProva,
          4096,
          SHA,
          prova,
        ]);
      }

      expect(await vinculos(cliente, concurso)).toHaveLength(1);
      const { rows } = await cliente.query<{ n: string }>(
        `select count(*) as n from public.operador_acoes
          where tipo = 'vincular_prova_ao_concurso' and entidade_id = $1`,
        [concurso],
      );
      expect(Number(rows[0].n)).toBe(1);
    });
  });

  it("falha no meio desfaz o download inteiro: nem vinculo, nem bytes, nem sha", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { abertura, prova: documentoDaProva } = await aberturaComAprovados(
        cliente,
        operador,
        concurso,
      );

      await cliente.query("savepoint tentativa");
      await expect(
        cliente.query("select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)", [
          abertura,
          operador,
          documentoDaProva,
          4096,
          SHA,
          crypto.randomUUID(),
        ]),
      ).rejects.toThrow(/prova_inexistente/);
      await cliente.query("rollback to savepoint tentativa");

      expect(await vinculos(cliente, concurso)).toEqual([]);
      const { rows } = await cliente.query<{
        baixado_em: Date | null;
        bytes: number | null;
        sha256: string | null;
        prova_id: string | null;
      }>(
        "select baixado_em, bytes, sha256, prova_id from public.concurso_documentos where id = $1",
        [documentoDaProva],
      );
      expect(rows[0]).toEqual({
        baixado_em: null,
        bytes: null,
        sha256: null,
        prova_id: null,
      });
    });
  });

  it("documento de outra abertura nao baixa nem vincula", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const umConcurso = await criarConcurso(cliente);
      const outroConcurso = await criarConcurso(cliente);
      const uma = await aberturaComAprovados(cliente, operador, umConcurso);
      const outra = await aberturaComAprovados(cliente, operador, outroConcurso);
      const prova = await criarProva(cliente);

      await cliente.query("savepoint cruzado");
      await expect(
        cliente.query("select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)", [
          uma.abertura,
          operador,
          outra.prova,
          4096,
          SHA,
          prova,
        ]),
      ).rejects.toThrow(/documento_fora_da_abertura/);
      await cliente.query("rollback to savepoint cruzado");

      expect(await vinculos(cliente, umConcurso)).toEqual([]);
      expect(await vinculos(cliente, outroConcurso)).toEqual([]);
    });
  });
});
