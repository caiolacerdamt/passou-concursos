import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PraticaTela, atrasoEmDias, textoDoAtraso } from "./pratica-tela";
import type { DadosDaPratica } from "./pratica";
import type { RotuloDoTopico } from "../rotulo-do-topico";

const HOJE = "2026-08-31";

const rotulos = new Map<string, RotuloDoTopico>([
  ["topico-sfn", { materia: "Conhecimentos Bancários", topico: "SFN e mercados" }],
  ["topico-pld", { materia: "Conhecimentos Bancários", topico: "Prevenção à lavagem de dinheiro" }],
  ["topico-price", { materia: "Matemática Financeira", topico: "Sistemas Price e SAC" }],
]);

const VAZIO: DadosDaPratica = {
  sessaoAberta: null,
  revisoesForaDoPlano: [],
  caderno: [],
  historico: [],
};

function render(dados: Partial<DadosDaPratica>): string {
  return renderToStaticMarkup(
    <PraticaTela dados={{ ...VAZIO, ...dados }} rotulosDosTopicos={rotulos} hoje={HOJE} />,
  );
}

describe("PraticaTela — fronteira com o plano", () => {
  it("não desenha nenhuma lista de bloco do plano", () => {
    const html = render({
      sessaoAberta: {
        id: "sessao-1",
        contexto: "plano",
        topicoId: "topico-sfn",
        iniciadaEm: "2026-08-31T12:00:00Z",
        nItens: 3,
        nRespondidas: 2,
        resultados: ["acerto", "erro", "pendente"],
      },
    });

    // O vocabulário do plano (piso, meta cheia, próximo bloco, começar agora)
    // é de /app e /app/plano. Vazar para cá é a duplicação que a AD-115 remove.
    expect(html).not.toMatch(/Mínimo de hoje|Meta cheia|Próximo bloco|Começar agora/);
    expect(html).toContain("Plano de hoje");
  });
});

describe("PraticaTela — sessão em andamento", () => {
  it("aponta para a sessão aberta e mostra o quanto falta", () => {
    const html = render({
      sessaoAberta: {
        id: "sessao-1",
        contexto: "plano",
        topicoId: "topico-sfn",
        iniciadaEm: "2026-08-31T12:00:00Z",
        nItens: 3,
        nRespondidas: 2,
        resultados: ["acerto", "erro", "pendente"],
      },
    });

    expect(html).toContain("/app/sessao/sessao-1");
    expect(html).toContain("Retomar");
    expect(html).toContain("2 de 3 respondidas");
    expect(html).toContain("1 pendente");
    expect(html).toContain("Conhecimentos Bancários · SFN e mercados");
  });

  it("some inteira quando não há sessão aberta", () => {
    const html = render({
      caderno: [
        { topicoId: "topico-price", causa: "errei_a_conta", nErros: 4, ultimoErroEm: "2026-08-30" },
      ],
    });

    expect(html).not.toContain("Em andamento");
    expect(html).not.toContain("Retomar");
  });
});

describe("PraticaTela — revisões e caderno", () => {
  it("liga cada revisão vencida à própria ação", () => {
    const html = render({
      revisoesForaDoPlano: [
        { topicoId: "topico-pld", due: "2026-08-26" },
        { topicoId: "topico-price", due: "2026-08-31" },
      ],
    });

    expect(html).toContain("/app/sessao?revisao=topico-pld");
    expect(html).toContain("Venceu há 5 dias");
    expect(html).toContain("Venceu hoje");
  });

  it("pinta de erro só o atraso longo — um dia atrasado não é alarme", () => {
    const longo = render({ revisoesForaDoPlano: [{ topicoId: "topico-pld", due: "2026-08-26" }] });
    const curto = render({ revisoesForaDoPlano: [{ topicoId: "topico-pld", due: "2026-08-30" }] });

    expect(longo).toContain("text-erro");
    expect(curto).not.toContain("text-erro");
  });

  it("monta a refação com tópico e causa na URL", () => {
    const html = render({
      caderno: [
        { topicoId: "topico-price", causa: "errei_a_conta", nErros: 4, ultimoErroEm: "2026-08-30" },
      ],
    });

    expect(html).toContain("/app/sessao?refacao=1&amp;topico=topico-price&amp;causa=errei_a_conta");
    expect(html).toContain("Errei a conta · 4 erros");
  });
});

describe("PraticaTela — histórico", () => {
  it("agrupa por dia e leva ao resumo de cada sessão", () => {
    const html = render({
      historico: [
        {
          id: "sessao-de-hoje",
          contexto: "plano",
          topicoId: "topico-sfn",
          encerradaEm: "2026-08-31T15:00:00Z",
          nQuestoes: 12,
          nAcertos: 10,
        },
        {
          id: "sessao-de-ontem",
          contexto: "revisao",
          topicoId: "topico-price",
          encerradaEm: "2026-08-30T15:00:00Z",
          nQuestoes: 16,
          nAcertos: 9,
        },
      ],
    });

    expect(html).toContain("Hoje");
    expect(html).toContain("Ontem");
    expect(html).toContain("/app/sessao/sessao-de-hoje/resumo");
    expect(html).toContain("12 questões · 10 acertos");
  });
});

describe("PraticaTela — estados sem pendência", () => {
  it("celebra estar em dia quando só resta histórico", () => {
    const html = render({
      historico: [
        {
          id: "sessao-de-hoje",
          contexto: "plano",
          topicoId: "topico-sfn",
          encerradaEm: "2026-08-31T15:00:00Z",
          nQuestoes: 12,
          nAcertos: 10,
        },
      ],
    });

    expect(html).toContain("Nada pendente");
    expect(html).toContain("Suas sessões");
  });

  it("no primeiro dia manda para o plano em vez de mostrar seções vazias", () => {
    const html = render({});

    expect(html).toContain('data-estado="vazio"');
    expect(html).toContain("Esta tela enche sozinha conforme você estuda");
    expect(html).not.toContain("Suas sessões");
    expect(html).not.toContain("Nada pendente");
  });
});

describe("atraso da revisão", () => {
  it("conta dias inteiros no calendário do produto", () => {
    expect(atrasoEmDias("2026-08-26", HOJE)).toBe(5);
    expect(atrasoEmDias("2026-08-31", HOJE)).toBe(0);
  });

  it("nunca anuncia atraso negativo para uma revisão adiantada", () => {
    expect(textoDoAtraso("2026-09-02", HOJE)).toBe("Venceu hoje");
  });
});
