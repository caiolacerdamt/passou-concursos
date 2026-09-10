import { describe, expect, it, vi } from "vitest";

const cookieGravado = vi.hoisted(() => ({
  chamadas: [] as Array<{ nome: string; valor: string; opcoes: Record<string, unknown> }>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (nome: string, valor: string, opcoes: Record<string, unknown>) => {
      cookieGravado.chamadas.push({ nome, valor, opcoes });
    },
  }),
}));

const revalidado = vi.hoisted(() => ({ chamadas: [] as Array<[string, string]> }));
vi.mock("next/cache", () => ({
  revalidatePath: (caminho: string, tipo: string) => {
    revalidado.chamadas.push([caminho, tipo]);
  },
}));

const banco = vi.hoisted(() => ({
  usuario: "aluno-1" as string | null,
  erro: null as string | null,
  gravado: [] as Array<{ tema: string; userId: string }>,
}));

vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: banco.usuario ? { id: banco.usuario } : null },
      }),
    },
    from: () => ({
      update: (valores: { tema: string }) => ({
        eq: async (_coluna: string, userId: string) => {
          if (banco.erro) return { error: { message: banco.erro } };
          banco.gravado.push({ tema: valores.tema, userId });
          return { error: null };
        },
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

const { alternarTema } = await import("./acoes-do-tema");

function limpar() {
  cookieGravado.chamadas = [];
  revalidado.chamadas = [];
  banco.gravado = [];
  banco.usuario = "aluno-1";
  banco.erro = null;
}

describe("alternarTema", () => {
  it("grava o banco e o cookie na mesma ação", () => {
    limpar();
    return alternarTema("escuro").then(() => {
      // Banco é a verdade (acompanha o aluno entre aparelhos); cookie é o
      // espelho que o shell lê para pintar sem consultar Postgres.
      expect(banco.gravado).toEqual([{ tema: "escuro", userId: "aluno-1" }]);

      const cookie = cookieGravado.chamadas[0];
      expect(cookie.nome).toBe("tema-do-app");
      expect(cookie.valor).toBe("escuro");
      expect(cookie.opcoes.path).toBe("/");
      expect(cookie.opcoes.sameSite).toBe("lax");
      expect(cookie.opcoes.maxAge).toBe(60 * 60 * 24 * 365);
    });
  });

  it("revalida o layout, que é quem monta o shell", async () => {
    limpar();
    await alternarTema("claro");

    // Sem isto o `data-tema` do HTML continuaria com o valor antigo até a
    // próxima navegação cheia.
    expect(revalidado.chamadas).toEqual([["/app", "layout"]]);
  });

  it("recusa valor desconhecido antes de encostar em cookie ou banco", async () => {
    limpar();
    const antes = reportado.vezes;

    // Argumento de Server Action é dado de fora. `data-tema="dark"` não casa com
    // nenhuma regra do `globals.css` e a tela sairia meio pintada.
    await alternarTema("dark" as never);

    expect(cookieGravado.chamadas).toEqual([]);
    expect(banco.gravado).toEqual([]);
    expect(revalidado.chamadas).toEqual([]);
    expect(reportado.vezes).toBe(antes + 1);
  });

  it("sem sessão o cookie ainda responde por este aparelho", async () => {
    limpar();
    banco.usuario = null;

    await alternarTema("escuro");

    expect(cookieGravado.chamadas[0].valor).toBe("escuro");
    expect(banco.gravado).toEqual([]);
  });

  it("falha de gravação não quebra a tela — reporta e segue", async () => {
    limpar();
    banco.erro = "coluna `tema` não existe";
    const antes = reportado.vezes;

    await alternarTema("escuro");

    // O que se perde é a persistência entre aparelhos, não a troca de tema.
    expect(cookieGravado.chamadas[0].valor).toBe("escuro");
    expect(reportado.vezes).toBe(antes + 1);
    expect(revalidado.chamadas).toEqual([["/app", "layout"]]);
  });

  it("não dispara o recálculo do plano", async () => {
    limpar();
    await alternarTema("escuro");

    // A ação é separada de `salvarPreferencias` justamente para isso: lá a
    // gravação chama `gera_plano_do_dia`, que é correto para minutos e dias de
    // estudo e absurdo para cor. Aqui não há como disparar — não há `rpc` no
    // cliente falso, e um `rpc` novo faria este teste explodir.
    expect(banco.gravado).toHaveLength(1);
  });
});
