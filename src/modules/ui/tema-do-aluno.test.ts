import { describe, expect, it, vi } from "vitest";

import { CICLO_DO_TEMA, proximoTema, rotuloAcessivelDoTema, temaValido } from "./tema";

const cookieDoTema = vi.hoisted(() => ({ valor: undefined as string | undefined }));
const perfil = vi.hoisted(() => ({
  tema: undefined as string | undefined,
  erro: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      nome === "tema-do-app" && cookieDoTema.valor !== undefined
        ? { name: nome, value: cookieDoTema.valor }
        : undefined,
  }),
}));

vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: async () => ({
    from: () => ({
      select: () => ({
        maybeSingle: async () =>
          perfil.erro
            ? { data: null, error: { message: perfil.erro } }
            : { data: perfil.tema === undefined ? null : { tema: perfil.tema }, error: null },
      }),
    }),
  }),
}));

const reportado = vi.hoisted(() => ({ vezes: 0 }));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: () => {
    reportado.vezes += 1;
  },
}));

const { temaDoAluno } = await import("./tema-do-aluno");

describe("vocabulário do tema", () => {
  it("cicla sistema → escuro → claro → sistema", () => {
    // O primeiro clique tem de levar a escuro: é o que a pessoa estava
    // procurando quando apertou o botão.
    expect(proximoTema("sistema")).toBe("escuro");
    expect(proximoTema("escuro")).toBe("claro");
    expect(proximoTema("claro")).toBe("sistema");
    expect(CICLO_DO_TEMA).toHaveLength(3);
  });

  it("recusa valor desconhecido em vez de repassá-lo", () => {
    // Cookie é dado de fora. `data-tema="dark"` não casa com nenhuma regra do
    // `globals.css` e a tela sairia meio pintada, sem erro nenhum no caminho.
    expect(temaValido("escuro")).toBe("escuro");
    expect(temaValido("dark")).toBeNull();
    expect(temaValido(undefined)).toBeNull();
    expect(temaValido("")).toBeNull();
  });

  it("o rótulo acessível diz o estado atual e o destino do clique", () => {
    // Ícone sozinho não diz em qual dos três estados o aluno está, e num ciclo
    // de três esse é justamente o que não se adivinha.
    expect(rotuloAcessivelDoTema("sistema")).toBe(
      "Tema: seguindo o aparelho. Trocar para escuro.",
    );
    expect(rotuloAcessivelDoTema("escuro")).toBe("Tema: escuro. Trocar para claro.");
    expect(rotuloAcessivelDoTema("claro")).toBe("Tema: claro. Trocar para auto.");
  });
});

describe("temaDoAluno", () => {
  it("o cookie responde sem consultar banco", async () => {
    cookieDoTema.valor = "escuro";
    perfil.tema = "claro";
    perfil.erro = null;

    // Se a ordem invertesse, cada navegação do aluno custaria uma ida ao
    // Postgres para decidir uma cor que não muda.
    expect(await temaDoAluno()).toBe("escuro");
  });

  it("sem cookie, o perfil é a verdade — é o caso do aparelho novo", async () => {
    cookieDoTema.valor = undefined;
    perfil.tema = "escuro";
    perfil.erro = null;

    expect(await temaDoAluno()).toBe("escuro");
  });

  it("sem cookie e sem perfil, `sistema`", async () => {
    cookieDoTema.valor = undefined;
    perfil.tema = undefined;
    perfil.erro = null;

    expect(await temaDoAluno()).toBe("sistema");
  });

  it("cookie adulterado cai no padrão em vez de virar atributo", async () => {
    cookieDoTema.valor = "dark";
    perfil.tema = undefined;
    perfil.erro = null;

    expect(await temaDoAluno()).toBe("sistema");
  });

  it("falha de leitura não derruba a tela por causa de uma cor", async () => {
    cookieDoTema.valor = undefined;
    perfil.tema = undefined;
    perfil.erro = "coluna `tema` não existe";
    const antes = reportado.vezes;

    expect(await temaDoAluno()).toBe("sistema");
    // Cai no padrão **e** reporta: silêncio aqui esconderia uma migração que
    // não subiu.
    expect(reportado.vezes).toBe(antes + 1);
  });
});
