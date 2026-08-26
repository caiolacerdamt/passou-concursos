import { describe, expect, it, vi } from "vitest";

import {
  consultarRecursosDoTopico,
  consultarRecursosVistos,
  lerRecursosCsv,
  lerRecursosEstudo,
  lerRecursosJson,
} from "./recursos";

const JSON_VALIDO = JSON.stringify({
  recursos: [
    {
      materia: "Matemática Financeira",
      topico: "Juros",
      titulo: "Aula de juros",
      url: "https://conteudo.test/juros",
      tipo: "video",
      duracao_minutos: 35,
      ordem: 1,
      ativo: true,
    },
  ],
});

describe("recursos de estudo curados", () => {
  it("aceita JSON e normaliza o contrato em português", () => {
    expect(lerRecursosJson(JSON_VALIDO)).toEqual([
      {
        materia: "Matemática Financeira",
        topico: "Juros",
        titulo: "Aula de juros",
        url: "https://conteudo.test/juros",
        tipo: "video",
        duracaoMinutos: 35,
        ordem: 1,
        ativo: true,
      },
    ]);
  });

  it("aceita CSV com título entre aspas e é retomável por URL", () => {
    const csv = [
      "materia,topico,titulo,url,tipo,duracao_minutos,ordem,ativo",
      'Matemática,Juros,"Aula, parte 1",https://conteudo.test/a,video,30,1,sim',
    ].join("\n");
    expect(lerRecursosCsv(csv)[0]).toMatchObject({
      titulo: "Aula, parte 1",
      duracaoMinutos: 30,
      ativo: true,
    });
    expect(() => lerRecursosEstudo(`${csv}\n${csv.split("\n")[1]}`, "csv")).toThrow(
      /duplicado/,
    );
  });

  it("recusa cabeçalho ou linha ambígua e aceita JSON com BOM", () => {
    expect(() =>
      lerRecursosCsv(
        [
          "materia,topico,titulo,url,tipo,duracao_minutos,ordem,ativo,ativo",
          "Matemática,Juros,Aula,https://conteudo.test/a,video,30,1,sim,sim",
        ].join("\n"),
      ),
    ).toThrow(/coluna duplicada/);
    expect(() =>
      lerRecursosCsv(
        [
          "materia,topico,titulo,url,tipo,duracao_minutos,ordem,ativo",
          "Matemática,Juros,Aula,https://conteudo.test/a,video,30,1",
        ].join("\n"),
      ),
    ).toThrow(/numero de colunas/);
    expect(lerRecursosEstudo(`\uFEFF${JSON_VALIDO}`)[0]?.url).toBe(
      "https://conteudo.test/juros",
    );
    expect(() =>
      lerRecursosCsv("materia,topico,titulo,url,tipo,duracao_minutos,ordem,ativo"),
    ).toThrow(/sem recursos/);
  });

  it("recusa URL que não é https e tipo fora da lista", () => {
    expect(() => lerRecursosJson(JSON_VALIDO.replace("https://", "http://"))).toThrow(
      /url_do_recurso_invalida/,
    );
    expect(() => lerRecursosJson(JSON_VALIDO.replace('"video"', '"curso"'))).toThrow(
      /tipo invalido/,
    );
  });

  it("lê somente a curadoria ativa do tópico, sem resolver o link", async () => {
    const cadeia = {
      select: vi.fn(() => cadeia),
      eq: vi.fn(() => cadeia),
      in: vi.fn(() => cadeia),
      order: vi.fn(() => cadeia),
      then: (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
        Promise.resolve({
          data: [
            {
              id: "recurso-1",
              topico_id: "topico-1",
              titulo: "Aula",
              url: "https://conteudo.test/aula",
              tipo: "video",
              duracao_minutos: 20,
              ordem: 1,
              ativo: true,
            },
          ],
          error: null,
        }).then(resolve, reject),
    };
    const cliente = { from: vi.fn(() => cadeia) } as never;

    await expect(consultarRecursosDoTopico(cliente, "topico-1")).resolves.toEqual([
      {
        id: "recurso-1",
        topicoId: "topico-1",
        titulo: "Aula",
        url: "https://conteudo.test/aula",
        tipo: "video",
        duracaoMinutos: 20,
        ordem: 1,
        ativo: true,
      },
    ]);
    expect(cadeia.eq).toHaveBeenNthCalledWith(1, "topico_id", "topico-1");
    expect(cadeia.eq).toHaveBeenNthCalledWith(2, "ativo", true);
  });

  it("lê somente as marcas dos recursos pedidos", async () => {
    const cadeia = {
      select: vi.fn(() => cadeia),
      in: vi.fn(() => cadeia),
      then: (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
        Promise.resolve({ data: [{ recurso_id: "recurso-1" }], error: null }).then(resolve, reject),
    };
    const cliente = { from: vi.fn(() => cadeia) } as never;

    await expect(consultarRecursosVistos(cliente, ["recurso-1", "recurso-2"])).resolves.toEqual(
      new Set(["recurso-1"]),
    );
    expect(cliente.from).toHaveBeenCalledWith("recurso_visto");
    expect(cadeia.in).toHaveBeenCalledWith("recurso_id", ["recurso-1", "recurso-2"]);
  });
});
