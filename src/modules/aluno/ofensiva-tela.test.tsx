import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SequenciaVigente } from "./gamificacao";
import { Ofensiva } from "./ofensiva-tela";

const sequenciaBase: SequenciaVigente = {
  data: "2026-08-25",
  sequencia: 3,
  estado: "cumprido",
  pisoEntregue: true,
  pisoCumprido: true,
  temHistorico: true,
};

function renderOfensiva(overrides: Partial<SequenciaVigente> = {}) {
  return renderToStaticMarkup(<Ofensiva sequencia={{ ...sequenciaBase, ...overrides }} />);
}

describe("Ofensiva", () => {
  it("mostra a sequência cumprida em segmentos e anima o mais novo", () => {
    const html = renderOfensiva({ sequencia: 3, estado: "cumprido" });

    expect(html).toContain("3 dias seguidos");
    expect(html).toContain('data-segmentos-preenchidos="3"');
    expect(html).toContain("ofensiva-preenchimento");
    expect(html).toContain('aria-hidden="true"');
  });

  it("usa a leitura singular para um dia cumprido", () => {
    const html = renderOfensiva({ sequencia: 1, estado: "cumprido" });

    expect(html).toContain("1 dia");
    expect(html).not.toContain("1 dias");
  });

  it("deixa o segmento de hoje aberto e pulsando em âmbar", () => {
    const html = renderOfensiva({ sequencia: 4, estado: "piso_pendente", pisoCumprido: false });

    expect(html).toContain("Seu mínimo de hoje ainda está aberto");
    expect(html).toContain("text-aviso");
    expect(html).toContain('data-segmento-pulsando="4"');
    expect(html).toContain('data-pulso="true"');
  });

  it("trata a folga como anel cinza tracejado", () => {
    const html = renderOfensiva({ sequencia: 6, estado: "folga" });

    expect(html).toContain("Folga declarada. Hoje não conta contra você");
    expect(html).toContain('data-traco="tracejado"');
    expect(html).toContain("text-linha");
    expect(html).not.toContain('data-pulso="true"');
  });

  it("guarda a sequência quando o dia está fora da agenda", () => {
    const html = renderOfensiva({ sequencia: 10, estado: "fora_agenda" });

    expect(html).toContain("Hoje está fora da sua agenda. Sua sequência está guardada");
    expect(html).toContain('data-traco="tracejado"');
    expect(html).toContain('data-voltas-completas="1"');
  });

  it("mantém o anel neutro enquanto o plano está em preparação", () => {
    const html = renderOfensiva({ sequencia: 2, estado: "plano_indisponivel" });

    expect(html).toContain("Plano em preparação");
    expect(html).toContain('data-pulso="false"');
    expect(html).toContain("text-suave");
  });

  it("explica que uma sequência perdida recomeça hoje", () => {
    const html = renderOfensiva({ sequencia: 0, estado: "cumprido", temHistorico: true });

    expect(html).toContain("Sua sequência recomeça hoje");
    expect(html).toContain('data-segmentos-preenchidos="0"');
  });

  it("explica como a primeira sequência começa", () => {
    const html = renderOfensiva({ sequencia: 0, estado: "cumprido", temHistorico: false });

    expect(html).toContain("Sua sequência começa no primeiro dia cumprido");
    expect(html).toContain('data-segmentos-preenchidos="0"');
  });

  it("não renderiza nada quando a gamificação não fornece sequência", () => {
    const html = renderToStaticMarkup(<Ofensiva sequencia={null} />);

    expect(html).toBe("");
  });
});
