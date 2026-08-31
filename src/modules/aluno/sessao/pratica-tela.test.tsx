import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/app/sessao/acoes", () => ({ descartarSessao: vi.fn() }));

import { PraticaTela, atrasoEmDias, idadeDaSessao, textoDoAtraso } from "./pratica-tela";
import type { DadosDaPratica } from "./pratica";
import type { RotuloDoTopico } from "../rotulo-do-topico";

const HOJE = "2026-08-31";

/** Relativo ao relógio: fixture com carimbo fixo envelhece sozinha e troca de rótulo. */
const HA_DUAS_HORAS = new Date(Date.now() - 2 * 3_600_000).toISOString();

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
        iniciadaEm: HA_DUAS_HORAS,
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
        iniciadaEm: HA_DUAS_HORAS,
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

describe("idade da sessão aberta", () => {
  const inicio = "2026-08-31T12:00:00Z";

  it("conta em minutos, horas e dias", () => {
    expect(idadeDaSessao(inicio, new Date("2026-08-31T12:20:00Z"))).toBe("aberta há 20 min");
    expect(idadeDaSessao(inicio, new Date("2026-08-31T15:00:00Z"))).toBe("aberta há 3 h");
    expect(idadeDaSessao(inicio, new Date("2026-09-05T12:00:00Z"))).toBe("aberta há 5 dias");
    expect(idadeDaSessao(inicio, new Date("2026-09-01T12:00:00Z"))).toBe("aberta há 1 dia");
  });

  it("não inventa idade para um carimbo ilegível", () => {
    expect(idadeDaSessao("nao-e-data")).toBe("aberta há algum tempo");
  });
});

describe("PraticaTela — a sessão velha não se passa por recente", () => {
  function sessaoIniciadaEm(iniciadaEm: string) {
    return {
      sessaoAberta: {
        id: "sessao-1",
        contexto: "revisao" as const,
        topicoId: "topico-sfn",
        iniciadaEm,
        nItens: 10,
        nRespondidas: 4,
        resultados: [
          "acerto", "erro", "acerto", "erro",
          "pendente", "pendente", "pendente", "pendente", "pendente", "pendente",
        ] as const,
      },
    };
  }

  it("oferece descartar só na sessão velha, e diz que nada se perde", () => {
    const antiga = render(sessaoIniciadaEm(new Date(Date.now() - 5 * 86_400_000).toISOString()));
    const recente = render(sessaoIniciadaEm(new Date(Date.now() - 2 * 3_600_000).toISOString()));

    expect(antiga).toContain("Descartar");
    expect(antiga).toContain('name="sessaoId"');
    expect(antiga).toContain("4 respostas que você já deu continuam");
    // Na sessão de hoje seria oferecer desistência a quem saiu para o café.
    expect(recente).not.toContain("Descartar");
  });

  it("troca o rótulo e o destaque quando a sessão passou de 24 h", () => {
    const antiga = render(sessaoIniciadaEm(new Date(Date.now() - 5 * 86_400_000).toISOString()));

    expect(antiga).toContain("Ficou aberta");
    expect(antiga).toContain("Uma sessão de outro dia ficou pela metade");
    expect(antiga).toContain("aberta há 5 dias");
    // Sessão de outro dia não usa o anel de foco: ela não é o que está
    // acontecendo agora, e o destaque diria que é.
    expect(antiga).not.toContain("ring-marca/20");
  });

  it("mantém o destaque na sessão de hoje", () => {
    const recente = render(sessaoIniciadaEm(new Date(Date.now() - 2 * 3_600_000).toISOString()));

    expect(recente).toContain("Em andamento");
    expect(recente).toContain("Você parou no meio de uma sessão");
    expect(recente).toContain("aberta há 2 h");
    expect(recente).toContain("ring-marca/20");
  });
});
