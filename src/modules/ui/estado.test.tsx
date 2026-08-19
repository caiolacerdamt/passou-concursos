import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Estado } from "./estado";

/**
 * Teste dos quatro estados por HTML gerado (UI-02).
 *
 * `renderToStaticMarkup` em vez de jsdom + Testing Library de proposito: os AC
 * do UI-02 falam sobre **o que esta escrito na tela** — texto de acao no vazio,
 * nome do que caiu no degradado, ausencia de mensagem tecnica no erro. Isso a
 * string do HTML responde inteiro, sem duas dependencias novas so para montar
 * um DOM falso.
 */

const html = (elemento: React.ReactElement) => renderToStaticMarkup(elemento);

describe("Estado", () => {
  it("carga anuncia a espera para leitor de tela (UI-02 AC1)", () => {
    const saida = html(<Estado tipo="carga" />);

    expect(saida).toContain('role="status"');
    expect(saida).toContain('aria-busy="true"');
    expect(saida).toContain("Carregando");
  });

  it("vazio mostra o que fazer para sair dele (UI-02 AC2)", () => {
    const saida = html(
      <Estado
        tipo="vazio"
        titulo="Nenhuma questão respondida ainda"
        acao="Comece pelo bloco Revisar do plano de hoje."
      />,
    );

    expect(saida).toContain("Nenhuma questão respondida ainda");
    expect(saida).toContain("Comece pelo bloco Revisar do plano de hoje.");
    expect(saida).toContain('data-acao=""');
  });

  it("degradado nomeia o que caiu e afirma que o resto anda (UI-02 AC3)", () => {
    const saida = html(<Estado tipo="degradado" oQueCaiu="A explicação por IA" />);

    expect(saida).toContain("A explicação por IA");
    expect(saida).toContain("O restante da página continua funcionando");
  });

  /**
   * O AC4 e o unico que se prova por **ausencia**, e a ausencia aqui e
   * estrutural: `EstadoProps` do tipo `erro` nao tem campo nenhum alem de
   * `tipo`. Se alguem acrescentar um `mensagem`, a assercao de igualdade
   * abaixo quebra — nao ha como o texto do erro deixar de ser fixo em silencio.
   */
  it("erro nao tem por onde receber mensagem tecnica (UI-02 AC4)", () => {
    const primeira = html(<Estado tipo="erro" />);
    const segunda = html(<Estado tipo="erro" />);

    expect(primeira).toBe(segunda);
    expect(primeira).toContain("Algo deu errado");
    expect(primeira).toContain("Já fomos avisados");
    expect(primeira).toContain('role="alert"');
  });

  it("os quatro estados saem do mesmo componente (UI-02 AC1)", () => {
    const marcados = [
      html(<Estado tipo="carga" />),
      html(<Estado tipo="erro" />),
      html(<Estado tipo="vazio" titulo="t" acao="a" />),
      html(<Estado tipo="degradado" oQueCaiu="x" />),
    ].map((saida) => /data-estado="([a-z]+)"/.exec(saida)?.[1]);

    expect(marcados).toEqual(["carga", "erro", "vazio", "degradado"]);
  });
});
