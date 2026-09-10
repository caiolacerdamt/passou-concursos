import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/app/acoes-do-tema", () => ({ alternarTema: vi.fn() }));

const { BotaoDeTema } = await import("./botao-de-tema");
const { ROTULO_DO_TEMA, proximoTema } = await import("./tema");

type Variante = Parameters<typeof BotaoDeTema>[0]["variante"];

function renderizar(tema: "claro" | "escuro" | "sistema", variante: Variante): string {
  return renderToStaticMarkup(<BotaoDeTema temaInicial={tema} variante={variante} />);
}

describe("BotaoDeTema", () => {
  it("diz em qual dos três estados está, sem exigir clique", () => {
    // Com três estados o ícone sozinho obriga o aluno a clicar para descobrir
    // onde está. O rótulo é o que torna o estado legível.
    for (const tema of ["claro", "escuro", "sistema"] as const) {
      expect(renderizar(tema, "barra")).toContain(ROTULO_DO_TEMA[tema]);
    }
  });

  it("o `aria-label` diz o estado e o destino em todas as variantes", () => {
    // No rail fechado o botão é só ícone: sem `aria-label` completo, quem usa
    // leitor de tela não sabe nem onde está nem para onde vai.
    for (const variante of ["barra", "rail", "folha"] as const) {
      const html = renderizar("sistema", variante);
      expect(html).toContain("aria-label=");
      expect(html).toContain("seguindo o aparelho");
      expect(html).toContain(`Trocar para ${ROTULO_DO_TEMA[proximoTema("sistema")].toLowerCase()}`);
    }
  });

  it("no rail fechado o nome vive na peça irmã, não dentro da pílula", () => {
    // Largura animada dentro da pílula faria o rail inteiro mudar de tamanho a
    // cada passada de mouse — é o padrão que os outros botões do rail já usam.
    const html = renderizar("escuro", "rail");

    expect(html).toContain("left-full");
    expect(html).toContain("size-11");
  });

  it("é `<button>` e não link — ele não navega", () => {
    // Um link que não navega mentiria para o teclado e para o leitor de tela.
    for (const variante of ["barra", "rail", "folha"] as const) {
      const html = renderizar("claro", variante);
      expect(html).toContain("<button");
      expect(html).not.toContain("<a ");
    }
  });

  it("nenhuma variante escreve cor própria — só token", () => {
    // A regra do `DESIGN.md` é o que tornou o tema escuro barato: um hex solto
    // num `.tsx` é regressão, não atalho.
    for (const variante of ["barra", "rail", "folha"] as const) {
      expect(renderizar("escuro", variante)).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });
});
