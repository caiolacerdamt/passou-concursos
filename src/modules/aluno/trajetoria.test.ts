import { describe, expect, it, vi } from "vitest";

import { consultarTrajetoria } from "./trajetoria";

type Resposta = { data: unknown; error: { message: string } | null };

function clienteCom(respostas: Record<string, Resposta>) {
  const from = vi.fn((tabela: string) => {
    const resposta = respostas[tabela] ?? { data: [], error: null };
    const consulta = {
      eq: vi.fn(() => consulta),
      gte: vi.fn(() => consulta),
      in: vi.fn(() => consulta),
      order: vi.fn(() => consulta),
      maybeSingle: vi.fn(async () => resposta),
      then: (
        resolve: (valor: Resposta) => unknown,
        reject: (erro: unknown) => unknown,
      ) => Promise.resolve(resposta).then(resolve, reject),
    };
    return { select: vi.fn(() => consulta) };
  });

  return { from } as never;
}

const AGORA = new Date("2026-09-01T15:00:00.000Z");
const PROVA = "2026-12-01";

function topico(id: string, materiaId: string, nome: string, ordem: number) {
  return { id, materia_id: materiaId, materias: { nome, ordem, ativa: true } };
}

/** Uma tentativa por dia, para dar span de história ao cálculo do ritmo. */
function tentativa(topicoId: string, dia: string) {
  return { topico_id: topicoId, respondida_em: `${dia}T12:00:00.000Z` };
}

describe("consultarTrajetoria", () => {
  it("conta só tópico ativo, de matéria ativa e com questão publicada", async () => {
    const publico = clienteCom({
      questoes: {
        data: [{ topico_id: "t1" }, { topico_id: "t2" }, { topico_id: "t1" }],
        error: null,
      },
      topicos: {
        data: [
          topico("t1", "m1", "Matemática Financeira", 1),
          topico("t2", "m1", "Estatística", 1),
          // Sem questão publicada: não é edital coberto nem descoberto.
          topico("t3", "m1", "Matemática Financeira", 1),
          // Matéria desativada.
          { id: "t4", materia_id: "m2", materias: { nome: "Extinta", ordem: 9, ativa: false } },
        ],
        error: null,
      },
      perfil_concurso: { data: null, error: null },
    });

    const trajetoria = await consultarTrajetoria(clienteCom({}), {
      agora: AGORA,
      clientePublico: publico,
    });

    expect(trajetoria.total.nTopicos).toBe(2);
    expect(trajetoria.porMateria).toHaveLength(1);
    expect(trajetoria.porMateria[0].materiaId).toBe("m1");
  });

  it("separa tocado de dominado: uma resposta não é domínio", async () => {
    const publico = clienteCom({
      questoes: { data: [{ topico_id: "t1" }, { topico_id: "t2" }, { topico_id: "t3" }], error: null },
      topicos: {
        data: [
          topico("t1", "m1", "Matemática", 1),
          topico("t2", "m1", "Matemática", 1),
          topico("t3", "m1", "Matemática", 1),
        ],
        error: null,
      },
      perfil_concurso: { data: null, error: null },
    });
    const sessao = clienteCom({
      dominio_topico: {
        data: [
          { topico_id: "t1", n_respostas: 1, score: 0.2 },
          { topico_id: "t2", n_respostas: 30, score: 0.95 },
          { topico_id: "t3", n_respostas: 0, score: 0 },
        ],
        error: null,
      },
    });

    const trajetoria = await consultarTrajetoria(sessao, {
      agora: AGORA,
      clientePublico: publico,
    });

    expect(trajetoria.total).toMatchObject({ nTopicos: 3, nTocados: 2, nDominados: 1 });
  });

  it("a cobertura ponderada difere da simples quando os pesos diferem", async () => {
    const publico = clienteCom({
      questoes: { data: [{ topico_id: "t1" }, { topico_id: "t2" }], error: null },
      topicos: {
        data: [topico("t1", "m1", "Matemática", 1), topico("t2", "m1", "Matemática", 1)],
        error: null,
      },
      perfil_concurso: { data: { id: "perfil-1" }, error: null },
      raiox_projecoes: {
        // O tocado é o que mais cai: metade dos tópicos, quase todo o peso.
        data: [
          { topico_id: "t1", peso: 0.9 },
          { topico_id: "t2", peso: 0.1 },
        ],
        error: null,
      },
      raiox_projecoes_materia: { data: [{ materia_id: "m1", peso: 1 }], error: null },
    });
    const sessao = clienteCom({
      dominio_topico: { data: [{ topico_id: "t1", n_respostas: 4, score: 0.5 }], error: null },
    });

    const trajetoria = await consultarTrajetoria(sessao, {
      agora: AGORA,
      clientePublico: publico,
    });

    expect(trajetoria.total.nTocados / trajetoria.total.nTopicos).toBe(0.5);
    expect(trajetoria.total.coberturaPonderada).toBeCloseTo(0.9, 6);
    expect(trajetoria.porMateria[0].pesoRaioX).toBe(1);
  });

  it("sem projeção do Raio-X a ponderada cai na fração simples, não em zero", async () => {
    const publico = clienteCom({
      questoes: { data: [{ topico_id: "t1" }, { topico_id: "t2" }], error: null },
      topicos: {
        data: [topico("t1", "m1", "Matemática", 1), topico("t2", "m1", "Matemática", 1)],
        error: null,
      },
      perfil_concurso: { data: null, error: null },
    });
    const sessao = clienteCom({
      dominio_topico: { data: [{ topico_id: "t1", n_respostas: 4, score: 0.5 }], error: null },
    });

    const trajetoria = await consultarTrajetoria(sessao, {
      agora: AGORA,
      clientePublico: publico,
    });

    expect(trajetoria.total.coberturaPonderada).toBe(0.5);
  });

  it("histórico curto não vira data: previsão sai nula e não confiável", async () => {
    const publico = clienteCom({
      questoes: { data: [{ topico_id: "t1" }, { topico_id: "t2" }], error: null },
      topicos: {
        data: [topico("t1", "m1", "Matemática", 1), topico("t2", "m1", "Matemática", 1)],
        error: null,
      },
      perfil_concurso: { data: null, error: null },
    });
    const sessao = clienteCom({
      dominio_topico: { data: [{ topico_id: "t1", n_respostas: 3, score: 0.5 }], error: null },
      // Três dias de história: menos que as duas semanas mínimas.
      tentativas: {
        data: [
          tentativa("t1", "2026-08-30"),
          tentativa("t1", "2026-08-31"),
          tentativa("t1", "2026-09-01"),
        ],
        error: null,
      },
    });

    const trajetoria = await consultarTrajetoria(sessao, {
      agora: AGORA,
      dataProva: PROVA,
      clientePublico: publico,
    });

    expect(trajetoria.previsao).toEqual({
      dataEstimada: null,
      diasAntesDaProva: null,
      confiavel: false,
    });
    expect(trajetoria.contagem.estado).toBe("futura");
  });

  it("ritmo zero não divide por zero", async () => {
    const publico = clienteCom({
      questoes: { data: [{ topico_id: "t1" }, { topico_id: "t2" }], error: null },
      topicos: {
        data: [topico("t1", "m1", "Matemática", 1), topico("t2", "m1", "Matemática", 1)],
        error: null,
      },
      perfil_concurso: { data: null, error: null },
    });

    const trajetoria = await consultarTrajetoria(clienteCom({}), {
      agora: AGORA,
      clientePublico: publico,
    });

    expect(trajetoria.ritmo).toEqual({ topicosNovosPorSemana: 0, semanasObservadas: 0 });
    expect(trajetoria.previsao.dataEstimada).toBeNull();
    expect(trajetoria.previsao.confiavel).toBe(false);
  });

  it("tópico revisitado não conta como novo — senão a projeção mente", async () => {
    const publico = clienteCom({
      questoes: {
        data: [{ topico_id: "t1" }, { topico_id: "t2" }, { topico_id: "t3" }, { topico_id: "t4" }],
        error: null,
      },
      topicos: {
        data: [
          topico("t1", "m1", "Matemática", 1),
          topico("t2", "m1", "Matemática", 1),
          topico("t3", "m1", "Matemática", 1),
          topico("t4", "m1", "Matemática", 1),
        ],
        error: null,
      },
      perfil_concurso: { data: null, error: null },
    });
    const sessao = clienteCom({
      dominio_topico: {
        data: [
          // Só respondeu dentro da janela: novo.
          { topico_id: "t1", n_respostas: 2, score: 0.5 },
          // Acumulado maior que a contagem na janela: já vinha de antes.
          { topico_id: "t2", n_respostas: 40, score: 0.5 },
        ],
        error: null,
      },
      tentativas: {
        data: [
          tentativa("t1", "2026-08-18"),
          tentativa("t1", "2026-08-25"),
          tentativa("t2", "2026-08-19"),
          tentativa("t2", "2026-08-26"),
        ],
        error: null,
      },
    });

    const trajetoria = await consultarTrajetoria(sessao, {
      agora: AGORA,
      dataProva: PROVA,
      clientePublico: publico,
    });

    // 15 dias de janela → 3 semanas observadas; 1 tópico novo nelas.
    expect(trajetoria.ritmo.semanasObservadas).toBe(3);
    expect(trajetoria.ritmo.topicosNovosPorSemana).toBeCloseTo(1 / 3, 6);
    // 2 tópicos restantes a 1/3 por semana = 6 semanas = 42 dias.
    expect(trajetoria.previsao).toEqual({
      dataEstimada: "2026-10-13",
      diasAntesDaProva: 91 - 42,
      confiavel: true,
    });
  });

  it("sem data de prova mostra a cobertura e não promete folga", async () => {
    const publico = clienteCom({
      questoes: { data: [{ topico_id: "t1" }], error: null },
      topicos: { data: [topico("t1", "m1", "Matemática", 1)], error: null },
      perfil_concurso: { data: null, error: null },
    });
    const sessao = clienteCom({
      dominio_topico: { data: [{ topico_id: "t1", n_respostas: 5, score: 0.6 }], error: null },
      tentativas: {
        data: [tentativa("t1", "2026-08-18"), tentativa("t1", "2026-09-01")],
        error: null,
      },
    });

    const trajetoria = await consultarTrajetoria(sessao, {
      agora: AGORA,
      clientePublico: publico,
    });

    expect(trajetoria.contagem).toEqual({ dataProva: null, dias: null, estado: "indefinida" });
    // Edital inteiro tocado: a data é hoje, mas a folga continua desconhecida.
    expect(trajetoria.previsao).toEqual({
      dataEstimada: "2026-09-01",
      diasAntesDaProva: null,
      confiavel: true,
    });
  });

  it("nomeia a fonte quando a leitura do acervo falha", async () => {
    const publico = clienteCom({
      questoes: { data: null, error: { message: "indisponível" } },
    });

    await expect(
      consultarTrajetoria(clienteCom({}), { agora: AGORA, clientePublico: publico }),
    ).rejects.toThrow("falha ao ler questões publicadas: indisponível");
  });
});
