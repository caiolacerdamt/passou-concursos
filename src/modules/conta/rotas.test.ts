import { describe, expect, it } from "vitest";

import {
  ROTAS_PUBLICAS,
  caminhoInternoOuRaiz,
  destinoSemSessao,
  ehRotaPublica,
} from "./rotas";

describe("ehRotaPublica", () => {
  it("deixa passar as rotas declaradas publicas", () => {
    for (const rota of ROTAS_PUBLICAS) {
      expect({ rota, publica: ehRotaPublica(rota) }).toEqual({ rota, publica: true });
    }
  });

  it("deixa passar o que esta abaixo de um prefixo publico", () => {
    expect(ehRotaPublica("/auth/callback")).toBe(true);
    expect(ehRotaPublica("/entrar/erro")).toBe(true);
  });

  /**
   * O caso que importa: rota que **ninguem** declarou. Este teste e a rede que
   * pega a tela nova de 2027 criada por quem nunca leu `rotas.ts` — se o default
   * fosse "publico", ela nasceria aberta e nada quebraria.
   */
  it("rota nao declarada exige sessao", () => {
    for (const caminho of [
      "/app",
      "/app/plano",
      "/progresso",
      "/tela-que-ainda-nao-existe",
      "/entrarcom-nome-parecido",
    ]) {
      expect({ caminho, publica: ehRotaPublica(caminho) }).toEqual({
        caminho,
        publica: false,
      });
    }
  });

  it("a raiz e publica sem tornar publico tudo que vem depois dela", () => {
    expect(ehRotaPublica("/")).toBe(true);
    expect(ehRotaPublica("/app")).toBe(false);
  });
});

describe("destinoSemSessao", () => {
  it("preserva o destino para devolver o aluno depois do login", () => {
    expect(destinoSemSessao("/app/plano", "?dia=hoje")).toBe(
      "/entrar?proximo=%2Fapp%2Fplano%3Fdia%3Dhoje",
    );
  });
});

describe("caminhoInternoOuRaiz", () => {
  it("aceita caminho interno", () => {
    expect(caminhoInternoOuRaiz("/app/plano")).toBe("/app/plano");
  });

  /**
   * Redirecionamento aberto: o aluno recem-autenticado sairia do produto com
   * aparencia de ter sido o proprio produto que o mandou. As tres formas abaixo
   * o navegador trata como endereco absoluto, mesmo comecando com barra.
   */
  it("recusa destino que sai do site", () => {
    for (const hostil of [
      "https://exemplo.invalido/roubo",
      "//exemplo.invalido/roubo",
      "/\\exemplo.invalido",
      "javascript:alert(1)",
      null,
      undefined,
    ]) {
      expect({ hostil, destino: caminhoInternoOuRaiz(hostil) }).toEqual({
        hostil,
        destino: "/",
      });
    }
  });
});
