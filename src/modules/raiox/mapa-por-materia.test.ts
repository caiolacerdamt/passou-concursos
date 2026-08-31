import { describe, expect, it } from "vitest";

import { agruparMapaPorMateria } from "./mapa-por-materia";

import type {
  DadosMapaPrioridade,
  DadosRaioX,
  LinhaMapaPrioridade,
} from "./index";

function topicoDoMapa(
  parcial: Partial<LinhaMapaPrioridade> & { topicoId: string; topico: string },
): LinhaMapaPrioridade {
  return {
    peso: 0.1,
    score: null,
    nRespostas: 0,
    dominio: "nao_iniciado",
    cobertura: "nao_iniciado",
    revisao: "sem_agenda",
    due: null,
    prioridade: null,
    nivel: "rotacao",
    motivo: "",
    ordem: 1,
    ...parcial,
  };
}

const dados: DadosRaioX = {
  perfil: {
    orgao: "Banco do Brasil",
    banca: "indefinida",
    dataProva: null,
    formato: "multipla_escolha",
    programaEdital: [],
  },
  linhas: [],
  materias: [
    {
      materiaId: "materia-1",
      materia: "Conhecimentos Bancários",
      peso: 0.4,
      fatia: 0.8,
      nQuestoes: 297,
      nTopicos: 4,
      tendencia: "subindo",
      amostraBaixa: false,
      topicos: [
        {
          topicoId: "t1",
          topico: "SFN e mercados",
          peso: 0.3,
          nQuestoes: 72,
          tendencia: "subindo",
          amostraBaixa: false,
          fatia: 0.6,
        },
        {
          topicoId: "t2",
          topico: "Garantias",
          peso: 0.1,
          nQuestoes: 18,
          tendencia: "estavel",
          amostraBaixa: false,
          fatia: 0.2,
        },
      ],
    },
    {
      materiaId: "materia-2",
      materia: "Língua Inglesa",
      peso: 0.1,
      fatia: 0.2,
      nQuestoes: 44,
      nTopicos: 2,
      tendencia: "estavel",
      amostraBaixa: false,
      topicos: [
        {
          topicoId: "t3",
          topico: "Compreensão de texto",
          peso: 0.1,
          nQuestoes: 44,
          tendencia: "estavel",
          amostraBaixa: false,
          fatia: 0.2,
        },
      ],
    },
  ],
};

describe("agruparMapaPorMateria", () => {
  it("pondera o domínio pelo peso do tópico, não por média simples", () => {
    const mapa: DadosMapaPrioridade = {
      dataReferencia: "2026-08-30",
      linhas: [
        topicoDoMapa({
          topicoId: "t1",
          topico: "SFN e mercados",
          peso: 0.3,
          score: 0.2,
          nRespostas: 20,
          dominio: "fraco",
          cobertura: "coberto",
          ordem: 1,
        }),
        topicoDoMapa({
          topicoId: "t2",
          topico: "Garantias",
          peso: 0.1,
          score: 1,
          nRespostas: 2,
          dominio: "dominado",
          cobertura: "coberto",
          ordem: 2,
        }),
      ],
    };

    const [linha] = agruparMapaPorMateria(dados, mapa).linhas;

    // Média simples daria 0,6 e diria "em desenvolvimento". Ponderada pelo
    // peso: (0,3×0,2 + 0,1×1) / 0,4 = 0,4 — o tópico que carrega a matéria é
    // quem manda, e a faixa continua sendo "fraco".
    expect(linha.materiaId).toBe("materia-1");
    expect(linha.score).toBeCloseTo(0.4, 10);
    expect(linha.dominio).toBe("fraco");
  });

  it("conta cobertura e revisões devidas em vez de repetir o estado do tópico", () => {
    const mapa: DadosMapaPrioridade = {
      dataReferencia: "2026-08-30",
      linhas: [
        topicoDoMapa({
          topicoId: "t1",
          topico: "SFN e mercados",
          score: 0.5,
          nRespostas: 20,
          dominio: "fraco",
          cobertura: "coberto",
          revisao: "devida",
          due: "2026-08-20",
          ordem: 1,
        }),
        topicoDoMapa({ topicoId: "t2", topico: "Garantias", ordem: 2 }),
      ],
    };

    const [linha] = agruparMapaPorMateria(dados, mapa).linhas;

    expect(linha.nTopicosCobertos).toBe(1);
    // O denominador é o edital (4 tópicos), não os 2 que têm questão publicada.
    expect(linha.nTopicos).toBe(4);
    expect(linha.nRevisoesDevidas).toBe(1);
    expect(linha.revisao).toBe("devida");
    expect(linha.nivel).toBe("maior_atencao");
    expect(linha.motivo).toContain("Uma revisão");
  });

  it("matéria sem nenhuma resposta é não iniciada, e não 'dominada por omissão'", () => {
    const mapa: DadosMapaPrioridade = {
      dataReferencia: "2026-08-30",
      linhas: [topicoDoMapa({ topicoId: "t3", topico: "Compreensão de texto", ordem: 1 })],
    };

    const inglesa = agruparMapaPorMateria(dados, mapa).linhas.find(
      (linha) => linha.materiaId === "materia-2",
    )!;

    expect(inglesa.score).toBeNull();
    expect(inglesa.dominio).toBe("nao_iniciado");
    expect(inglesa.cobertura).toBe("nao_iniciado");
    expect(inglesa.nivel).toBe("maior_atencao");
  });

  it("ordena por peso × fraqueza e numera a leitura", () => {
    const mapa: DadosMapaPrioridade = {
      dataReferencia: "2026-08-30",
      linhas: [
        // Matéria pesada, mas praticamente dominada: prioridade 0,8 × 0,05.
        topicoDoMapa({
          topicoId: "t1",
          topico: "SFN e mercados",
          peso: 0.3,
          score: 0.95,
          nRespostas: 40,
          dominio: "dominado",
          cobertura: "coberto",
          revisao: "em_dia",
          due: "2026-09-30",
          ordem: 1,
        }),
        topicoDoMapa({
          topicoId: "t2",
          topico: "Garantias",
          peso: 0.1,
          score: 0.95,
          nRespostas: 10,
          dominio: "dominado",
          cobertura: "coberto",
          revisao: "em_dia",
          due: "2026-09-30",
          ordem: 2,
        }),
        // Matéria leve e intocada: prioridade 0,2 × 0,9 — passa na frente.
        topicoDoMapa({ topicoId: "t3", topico: "Compreensão de texto", ordem: 3 }),
      ],
    };

    const { linhas } = agruparMapaPorMateria(dados, mapa);

    expect(linhas.map((linha) => linha.materiaId)).toEqual(["materia-2", "materia-1"]);
    expect(linhas.map((linha) => linha.ordem)).toEqual([1, 2]);
    expect(linhas[1].nivel).toBe("rotacao");
  });

  it("preserva a data de referência do mapa por tópico", () => {
    const resultado = agruparMapaPorMateria(dados, {
      dataReferencia: "2026-08-30",
      linhas: [],
    });

    expect(resultado.dataReferencia).toBe("2026-08-30");
    expect(resultado.linhas).toHaveLength(2);
  });
});
