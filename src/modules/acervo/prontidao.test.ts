import { describe, expect, it } from "vitest";

import { consultarProntidaoConteudo, pendenciasDoEdital } from "./prontidao";

const bruta = {
  materia_id: "materia-1",
  materia: "Ética e Compliance",
  topico_id: "topico-1",
  topico: "Geral",
  no_edital: true,
  publicadas: "10",
  aptas_sessao: "10",
  recursos_ativos: "2",
  minimo_aptas: "5",
  pronto: true,
};

describe("prontidão de conteúdo", () => {
  it("mapeia contagens e piso vindos do banco sem recalcular", async () => {
    const cliente = { query: async () => ({ rows: [bruta] }) };

    await expect(consultarProntidaoConteudo(cliente)).resolves.toEqual([
      {
        materiaId: "materia-1",
        materia: "Ética e Compliance",
        topicoId: "topico-1",
        topico: "Geral",
        noEdital: true,
        publicadas: 10,
        aptasSessao: 10,
        recursosAtivos: 2,
        minimoAptas: 5,
        pronto: true,
      },
    ]);
  });

  it("aponta como pendência só o tópico do edital que não está pronto", async () => {
    const cliente = {
      query: async () => ({
        rows: [
          bruta,
          { ...bruta, topico_id: "topico-2", topico: "Sem recurso", recursos_ativos: "0", pronto: false },
          { ...bruta, topico_id: "topico-3", no_edital: false, aptas_sessao: "0", pronto: false },
        ],
      }),
    };

    const linhas = await consultarProntidaoConteudo(cliente);

    expect(pendenciasDoEdital(linhas).map((linha) => linha.topicoId)).toEqual(["topico-2"]);
  });
});
