import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CREDENCIAL_INVALIDA } from "./mensagens";

/**
 * A mensagem de credencial invalida (PAG-07, gap G5 do Verificador).
 *
 * O que se prova aqui nao e o texto — e a **ausencia de ramo**: nao existe
 * versao "esse e-mail nao existe" e versao "senha errada". Enquanto houver uma
 * so constante e a tela ler dela, o formulario nao serve para descobrir quem
 * tem conta no produto.
 */
describe("CREDENCIAL_INVALIDA", () => {
  it("nao distingue e-mail inexistente de senha errada", () => {
    const texto = CREDENCIAL_INVALIDA.toLowerCase();

    expect(texto).toContain("e-mail");
    expect(texto).toContain("senha");
    // "nao cadastrado", "nao existe", "conta nao encontrada" — qualquer um
    // desses entregaria a lista de clientes.
    expect(texto).not.toMatch(/n[aã]o (existe|cadastrad|encontrad)/);
  });

  it("a tela de entrar le desta constante, e nao de um texto proprio", () => {
    const pagina = readFileSync(
      path.resolve(import.meta.dirname, "../../app/entrar/page.tsx"),
      "utf8",
    );

    expect(pagina).toContain("CREDENCIAL_INVALIDA");
    // Texto literal na pagina seria a segunda copia — e a que ninguem lembra
    // de manter alinhada.
    expect(pagina).not.toContain(CREDENCIAL_INVALIDA);
  });

  it("nao existe uma segunda mensagem de credencial no codigo da conta", () => {
    const acoes = readFileSync(
      path.resolve(import.meta.dirname, "../../app/entrar/acoes.ts"),
      "utf8",
    );

    // A acao redireciona com um codigo (`erro=credencial`); quem escolhe a
    // frase e a tela. Se a acao passar a montar frase propria, ha dois donos.
    expect(acoes).not.toMatch(/senha (errada|incorreta|invalida)/i);
    expect(acoes).toContain("erro=credencial");
  });
});
