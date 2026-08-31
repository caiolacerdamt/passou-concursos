import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PreferenciasTela } from "./preferencias-tela";

const perfil = {
  concursoAlvo: "Banco do Brasil",
  minutosPorDia: 45,
  diasEstudo: [1, 3, 6],
  horarioEstudo: "19:30:00",
  nivelDeclarado: "intermediario" as const,
  onboardingConcluido: true,
  dataProva: "2026-10-18",
};

describe("PreferenciasTela", () => {
  it("preenche os valores salvos e explica o efeito da mudança", () => {
    const html = renderToStaticMarkup(
      <PreferenciasTela acao={vi.fn()} perfil={perfil} />,
    );

    expect(html).toContain('name="concursoAlvo"');
    expect(html).toContain('value="Banco do Brasil"');
    expect(html).toContain('name="minutosPorDia"');
    expect(html).toContain('value="45"');
    expect(html).toContain('name="horarioEstudo"');
    expect(html).toContain('value="19:30"');
    expect(html).toContain('name="nivelDeclarado"');
    expect(html).toContain('value="intermediario"');
    expect(html).toContain('name="diasEstudo" checked="" value="1"');
    expect(html).toContain('name="diasEstudo" checked="" value="3"');
    expect(html).toContain('name="diasEstudo" checked="" value="6"');
    expect(html).not.toContain('name="diasEstudo" checked="" value="0"');
    expect(html).toContain("próximo dia");
    expect(html).toContain("plano de hoje será recalculado agora");
    expect(html).toContain("nenhum plano será gerado para hoje");
  });

  it("mostra o resultado salvo sem transformar a tela em uma tela de boas-vindas", () => {
    const html = renderToStaticMarkup(
      <PreferenciasTela acao={vi.fn()} perfil={perfil} resultado="salvo" />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Preferências salvas");
    expect(html).toContain("Salvar preferências");
    expect(html).not.toContain("Montar meu plano de hoje");
  });
});
