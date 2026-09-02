import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CarregandoEstudo from "@/app/app/estudo/loading";
import CarregandoHoje from "@/app/app/loading";
import CarregandoPlano from "@/app/app/plano/loading";
import CarregandoProgresso from "@/app/app/progresso/loading";
import CarregandoRaioX from "@/app/app/raio-x/loading";
import CarregandoPratica from "@/app/app/sessao/loading";
import CarregandoSessao from "@/app/app/sessao/[id]/loading";
import CarregandoResumo from "@/app/app/sessao/[id]/resumo/loading";

import { Bloco, CabecalhoEsqueleto, CartaoEsqueleto, Carregando } from "./esqueleto";

const ESQUELETOS = [
  ["Hoje", CarregandoHoje],
  ["Plano", CarregandoPlano],
  ["Progresso", CarregandoProgresso],
  ["Raio-X", CarregandoRaioX],
  ["Questões e revisões", CarregandoPratica],
  ["Estudo do bloco", CarregandoEstudo],
  ["Sessão", CarregandoSessao],
  ["Resumo da sessão", CarregandoResumo],
] as const;

describe("primitivas do esqueleto", () => {
  it("o bloco é decorativo: sem texto e escondido do leitor de tela", () => {
    const html = renderToStaticMarkup(<Bloco className="h-4 w-10" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("bg-linha/60");
  });

  it("respeita quem pediu menos movimento", () => {
    expect(renderToStaticMarkup(<Bloco />)).toContain("motion-safe:animate-pulse");
  });

  it("o cartão desenha o número de linhas pedido", () => {
    const tres = renderToStaticMarkup(<CartaoEsqueleto linhas={3} />);
    const seis = renderToStaticMarkup(<CartaoEsqueleto linhas={6} />);

    expect(seis.split("animate-pulse").length).toBeGreaterThan(
      tres.split("animate-pulse").length,
    );
  });

  it("o anúncio é um só, com o nome da tela em vez de 'carregando'", () => {
    const html = renderToStaticMarkup(
      <Carregando rotulo="Carregando o plano de hoje">
        <CabecalhoEsqueleto />
      </Carregando>,
    );

    expect(html.split('role="status"')).toHaveLength(2);
    expect(html).toContain("Carregando o plano de hoje");
    expect(html).toContain('aria-busy="true"');
  });
});

describe("esqueletos de rota", () => {
  it.each(ESQUELETOS)("%s anuncia a espera uma vez só", (_nome, Esqueleto) => {
    const html = renderToStaticMarkup(<Esqueleto />);

    // Um `role="status"` por tela: se cada retângulo tivesse o seu, o leitor de
    // tela repetiria "carregando" uma vez por bloco.
    expect(html.split('role="status"')).toHaveLength(2);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("sr-only");
  });
});
