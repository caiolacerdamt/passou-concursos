import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CHAVES_SENSIVEIS,
  PROFUNDIDADE_MAXIMA,
  chaveEhSensivel,
  normalizarChave,
  sanearEventoSentry,
  sanitizar,
  sanitizarTexto,
} from "./saneamento.mjs";

describe("saneamento de dado pessoal", () => {
  it("apaga o valor de chave sensivel em objeto raso, aninhado e dentro de array", () => {
    const saneado = sanitizar({
      email: "aluno@exemplo.com",
      aluno: { cpf: "529.982.247-25", nome: "Fulano de Tal" },
      tentativas: [{ senha: "123456" }, { authorization: "Bearer abc" }],
    }) as Record<string, unknown>;

    expect(saneado.email).toBe("[removido]");
    expect((saneado.aluno as Record<string, unknown>).cpf).toBe("[removido]");
    expect((saneado.aluno as Record<string, unknown>).nome).toBe("[removido]");
    expect((saneado.tentativas as Record<string, unknown>[])[0].senha).toBe(
      "[removido]",
    );
    expect(
      (saneado.tentativas as Record<string, unknown>[])[1].authorization,
    ).toBe("[removido]");
  });

  it("reconhece a chave sensivel escrita de qualquer jeito", () => {
    for (const chave of ["e-mail", "E_MAIL", "userEmail", "SUPABASE_SECRET_KEY", "api-key"]) {
      expect(chaveEhSensivel(chave)).toBe(true);
    }
    expect(normalizarChave("E-Mail")).toBe("email");
  });

  it("preserva 'chave' e 'chaves', que aqui sao chave de configuracao e nao credencial", () => {
    // O reporte de falha da SPEC 02 manda `{ chaves, motivo }`. Apagar isso
    // tornaria o alerta inutil: ninguem saberia qual configuracao caiu.
    expect(chaveEhSensivel("chave")).toBe(false);
    expect(chaveEhSensivel("chaves")).toBe(false);

    const saneado = sanitizar({
      chaves: ["flag.m4.caderno_erros"],
      motivo: "falha ao ler a configuracao",
    }) as Record<string, unknown>;
    expect(saneado.chaves).toEqual(["flag.m4.caderno_erros"]);
    expect(saneado.motivo).toBe("falha ao ler a configuracao");
  });

  it("troca e-mail e CPF soltos no meio de um texto", () => {
    expect(sanitizarTexto("falha ao gravar para joao.silva+bb@gmail.com hoje")).toBe(
      "falha ao gravar para [email] hoje",
    );
    expect(sanitizarTexto("duplicate key (cpf)=(529.982.247-25)")).toBe(
      "duplicate key (cpf)=([cpf])",
    );
    expect(sanitizarTexto("cpf 52998224725 invalido")).toBe("cpf [cpf] invalido");
    expect(sanitizarTexto("nada a esconder aqui")).toBe("nada a esconder aqui");
  });

  it("saneia texto solto tambem quando ele esta dentro de um objeto", () => {
    const saneado = sanitizar({
      motivo: "conta de aluno@exemplo.com recusada",
    }) as Record<string, unknown>;
    expect(saneado.motivo).toBe("conta de [email] recusada");
  });

  it("nao entra em laco com referencia circular", () => {
    const raiz: Record<string, unknown> = { motivo: "ciclo" };
    raiz.eu = raiz;

    const saneado = sanitizar(raiz) as Record<string, unknown>;
    expect(saneado.motivo).toBe("ciclo");
    expect(saneado.eu).toBe("[circular]");
  });

  it("trata o mesmo objeto repetido lado a lado como reuso, nao como ciclo", () => {
    const compartilhado = { motivo: "mesmo objeto" };
    const saneado = sanitizar({ a: compartilhado, b: compartilhado }) as Record<
      string,
      unknown
    >;
    expect(saneado.a).toEqual({ motivo: "mesmo objeto" });
    expect(saneado.b).toEqual({ motivo: "mesmo objeto" });
  });

  it("corta no teto de profundidade em vez de descer para sempre", () => {
    let fundo: Record<string, unknown> = { fim: "chegou" };
    for (let i = 0; i < PROFUNDIDADE_MAXIMA + 3; i += 1) {
      fundo = { dentro: fundo };
    }

    let atual: unknown = sanitizar(fundo);
    for (let i = 0; i < PROFUNDIDADE_MAXIMA; i += 1) {
      atual = (atual as Record<string, unknown>).dentro;
    }
    expect(atual).toBe("[profundo]");
  });

  it("deixa passar o que nao e objeto nem texto", () => {
    expect(sanitizar(42)).toBe(42);
    expect(sanitizar(true)).toBe(true);
    expect(sanitizar(null)).toBe(null);
    expect(sanitizar(undefined)).toBe(undefined);
  });

  it("sanearEventoSentry apaga user.email e user.ip_address e saneia o resto", () => {
    const evento = {
      message: "erro com aluno@exemplo.com",
      user: { id: "abc-123", email: "aluno@exemplo.com", ip_address: "200.1.2.3" },
      extra: { senha: "123456", chave: "flag.m9.rota_de_erro_proposital" },
    };

    const saneado = sanearEventoSentry(evento);

    expect(saneado.message).toBe("erro com [email]");
    expect("email" in saneado.user).toBe(false);
    expect("ip_address" in saneado.user).toBe(false);
    expect(saneado.user.id).toBe("abc-123");
    expect(saneado.extra.senha).toBe("[removido]");
    expect(saneado.extra.chave).toBe("flag.m9.rota_de_erro_proposital");
  });

  it("sanearEventoSentry preserva a pilha de chamada, que fica fundo no evento", () => {
    // exception → values → [0] → stacktrace → frames → [0] → chaves do quadro.
    // Um teto de profundidade apertado apagaria a pilha inteira para proteger
    // dado pessoal que nem esta la.
    const evento = {
      exception: {
        values: [
          {
            type: "Error",
            value: "falha de aluno@exemplo.com",
            stacktrace: {
              frames: [{ filename: "src/app/page.tsx", function: "Pagina", lineno: 7 }],
            },
          },
        ],
      },
    };

    const saneado = sanearEventoSentry(evento);
    const quadro = saneado.exception.values[0].stacktrace.frames[0];

    expect(saneado.exception.values[0].value).toBe("falha de [email]");
    expect(quadro.filename).toBe("src/app/page.tsx");
    expect(quadro.function).toBe("Pagina");
    expect(quadro.lineno).toBe(7);
  });

  it("sanearEventoSentry devolve o que nao e evento sem quebrar", () => {
    expect(sanearEventoSentry(null)).toBe(null);
    expect(sanearEventoSentry(undefined)).toBe(undefined);
  });

  it("o modulo nao importa o Sentry — o SDK entra so no ponto de entrada", () => {
    const pasta = path.dirname(fileURLToPath(import.meta.url));
    const fontes = readdirSync(pasta).filter(
      (arquivo) => !arquivo.endsWith(".test.ts"),
    );

    expect(fontes.length).toBeGreaterThan(0);
    for (const arquivo of fontes) {
      const conteudo = readFileSync(path.join(pasta, arquivo), "utf8");
      expect(conteudo.includes('from "@sentry/')).toBe(false);
      expect(conteudo.includes("require(\"@sentry/")).toBe(false);
    }
  });

  it("a lista de chaves sensiveis cobre o que a LGPD chama de dado pessoal", () => {
    for (const esperada of ["email", "cpf", "senha", "token", "nome", "telefone"]) {
      expect(CHAVES_SENSIVEIS).toContain(esperada);
    }
  });
});
