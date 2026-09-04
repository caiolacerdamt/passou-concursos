import { describe, expect, it } from "vitest";

import { dominioDoEmail, ehDominioBloqueado } from "./dominio-de-email";

describe("ehDominioBloqueado", () => {
  const lista = ["mailinator.com", "Yopmail.com", "@10minutemail.net"];

  it("recusa o domínio da lista, sem se importar com maiúsculas nem com o @", () => {
    expect(ehDominioBloqueado("teste@mailinator.com", lista)).toBe(true);
    expect(ehDominioBloqueado("TESTE@YOPMAIL.COM", lista)).toBe(true);
    expect(ehDominioBloqueado("teste@10minutemail.net", lista)).toBe(true);
  });

  /**
   * Bloquear `mailinator.com` sem alcançar `x.mailinator.com` bloqueia só quem
   * não estava tentando: o serviço distribui subdomínio à vontade.
   */
  it("alcança o subdomínio", () => {
    expect(ehDominioBloqueado("teste@qualquer.mailinator.com", lista)).toBe(true);
  });

  it("não recusa domínio que apenas termina parecido", () => {
    expect(ehDominioBloqueado("aluno@naomailinator.com", lista)).toBe(false);
    expect(ehDominioBloqueado("aluno@gmail.com", lista)).toBe(false);
  });

  /**
   * Lista vazia é o default (AD-133). Lista de exclusão vazia não pode fechar
   * nada por engano — seria o produto inteiro fechado por uma configuração
   * ausente.
   */
  it("lista vazia não bloqueia ninguém", () => {
    expect(ehDominioBloqueado("aluno@mailinator.com", [])).toBe(false);
    expect(ehDominioBloqueado("aluno@mailinator.com", ["", "   "])).toBe(false);
  });

  it("e-mail sem domínio não estoura", () => {
    expect(ehDominioBloqueado("sem-arroba", lista)).toBe(false);
    expect(ehDominioBloqueado("termina-com@", lista)).toBe(false);
  });
});

describe("dominioDoEmail", () => {
  it("usa o último @, que é o que o provedor usa", () => {
    expect(dominioDoEmail("a@b@exemplo.com")).toBe("exemplo.com");
  });

  it("devolve null quando não há domínio", () => {
    expect(dominioDoEmail("sem-arroba")).toBeNull();
    expect(dominioDoEmail("vazio@  ")).toBeNull();
  });
});
