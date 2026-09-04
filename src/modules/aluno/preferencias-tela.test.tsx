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

/** Quinta-feira: fora da agenda [1, 3, 6] do perfil acima. */
const QUINTA = 4;
/** Quarta-feira: dentro da agenda. */
const QUARTA = 3;

function render(extra: Partial<Parameters<typeof PreferenciasTela>[0]> = {}) {
  return renderToStaticMarkup(
    <PreferenciasTela acao={vi.fn()} perfil={perfil} diaDeHoje={QUINTA} {...extra} />,
  );
}

describe("PreferenciasTela", () => {
  it("mantém os nomes de campo que a action já lia", () => {
    const html = render();

    expect(html).toContain('name="concursoAlvo"');
    expect(html).toContain('value="Banco do Brasil"');
    expect(html).toContain('name="minutosPorDia"');
    expect(html).toContain('value="45"');
    expect(html).toContain('name="horarioEstudo"');
    expect(html).toContain('value="19:30"');
    expect(html).toContain('name="nivelDeclarado"');
    expect(html).toContain('value="intermediario"');
  });

  it("marca exatamente os dias salvos", () => {
    const html = render();

    expect(html).toContain('name="diasEstudo" checked="" value="1"');
    expect(html).toContain('name="diasEstudo" checked="" value="3"');
    expect(html).toContain('name="diasEstudo" checked="" value="6"');
    expect(html).not.toContain('name="diasEstudo" checked="" value="0"');
  });

  it("mostra a carga da semana como conta, e não como estimativa", () => {
    const html = render();

    // 45 min × 3 dias = 135 min.
    expect(html).toContain("2 h 15");
    expect(html).toContain("nos 3 dias marcados");
  });

  it("diz que hoje está fora da agenda quando está", () => {
    const html = render();

    expect(html).toContain("Fora da sua agenda");
    expect(html).toContain("nenhum plano será gerado para hoje");
  });

  it("diz que o plano de hoje é recalculado quando hoje está na agenda", () => {
    const html = render({ diaDeHoje: QUARTA });

    expect(html).toContain("o plano de hoje é recalculado agora");
    expect(html).toContain("Hoje, 19:30");
  });

  it("mantém o aviso da regra do motor, e não só o número", () => {
    const html = render();

    expect(html).toContain("a partir do próximo dia");
    expect(html).toContain("está em preparação");
  });

  it("abre sem mudança pendente", () => {
    expect(render()).toContain("Tudo salvo");
  });

  it("mostra o resultado salvo sem virar tela de boas-vindas", () => {
    const html = render({ resultado: "salvo" });

    expect(html).toContain('role="status"');
    expect(html).toContain("Preferências salvas");
    expect(html).toContain("Salvar preferências");
    expect(html).not.toContain("Montar meu plano de hoje");
  });

  it("traduz o motivo recusado sem imprimir o código do erro", () => {
    const html = render({ erro: "onboarding", motivo: "agenda_obrigatoria" });

    expect(html).toContain("Escolha pelo menos um dia para estudar");
    expect(html).not.toContain("agenda_obrigatoria");
  });
});
