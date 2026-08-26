import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EstudoGuiadoTela } from "./tela";
import type { DadosDoEstudoGuiado } from "./consulta";

const estudo: DadosDoEstudoGuiado = {
  bloco: {
    id: "4c2d8f62-bf58-4db2-8f55-8ef7a9799b1f",
    tipo: "avancar",
    nivel: "meta_cheia",
    ordem: 2,
    topicoId: "d7c96f70-6c28-47da-8ce5-04ed06f3e7bc",
    nQuestoes: 8,
    nQuestoesCheias: 12,
    minutosEstimados: 35,
    minutosEstimadosCheios: 50,
    motivo: "Este tema fecha uma lacuna importante do ciclo.",
    ajusteUsuario: false,
    adiadoDe: null,
  },
  materia: "Conhecimentos Bancários",
  topico: "Mercado de crédito",
  recursos: [
    {
      id: "7d86194a-f1cf-4e65-bc2e-69d67766366a",
      topicoId: "d7c96f70-6c28-47da-8ce5-04ed06f3e7bc",
      titulo: "Aula sobre crédito",
      url: "https://conteudo.test/credito",
      tipo: "video",
      duracaoMinutos: 20,
      ordem: 1,
      ativo: true,
    },
    {
      id: "5a81dd4a-7153-4a8c-905c-43f416b00bc8",
      topicoId: "d7c96f70-6c28-47da-8ce5-04ed06f3e7bc",
      titulo: "Resumo em PDF",
      url: "https://conteudo.test/credito.pdf",
      tipo: "pdf",
      duracaoMinutos: 12,
      ordem: 2,
      ativo: true,
    },
    {
      id: "falso-recurso",
      topicoId: "d7c96f70-6c28-47da-8ce5-04ed06f3e7bc",
      titulo: "Link inseguro",
      url: "http://nao-seguro.test",
      tipo: "artigo",
      duracaoMinutos: 5,
      ordem: 3,
      ativo: true,
    },
  ],
  proximaRevisao: "2026-08-30",
};

describe("mesa de estudo guiado", () => {
  it("mostra assunto real, snapshot, curadoria ordenada e próxima revisão", () => {
    const html = renderToStaticMarkup(<EstudoGuiadoTela estudo={estudo} />);

    expect(html).toContain("Conhecimentos Bancários · Mercado de crédito");
    expect(html).toContain("35 minutos");
    expect(html).toContain("Este tema fecha uma lacuna importante do ciclo.");
    expect(html).toContain("Recurso principal");
    expect(html).toContain("Aula sobre crédito");
    expect(html).toContain("Outras fontes curadas");
    expect(html).toContain("Resumo em PDF");
    expect(html).not.toContain("Link inseguro");
    expect(html).toContain("Resumo");
    expect(html).toContain('aria-labelledby="titulo-estudo-guiado"');
    expect(html).toContain('aria-labelledby="titulo-resumo"');
    expect(html).toContain("lg:items-stretch");
    expect(html).toContain("Foco contínuo");
    expect(html).toContain("25 minutos de foco");
    expect(html).toContain("/app/sessao?bloco=4c2d8f62-bf58-4db2-8f55-8ef7a9799b1f");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("orienta quando não há tópico ou recurso sem bloquear as questões", () => {
    const html = renderToStaticMarkup(
      <EstudoGuiadoTela
        estudo={{
          ...estudo,
          bloco: { ...estudo.bloco, topicoId: null },
          materia: null,
          topico: null,
          recursos: [],
          proximaRevisao: null,
        }}
      />,
    );

    expect(html).toContain("não tem um tópico único associado");
    expect(html).toContain("Ainda não há recurso curado para este assunto");
    expect(html).toContain("Ir para as questões");
  });

  it("usa somente a matéria quando o tópico é Geral", () => {
    const html = renderToStaticMarkup(
      <EstudoGuiadoTela
        estudo={{ ...estudo, materia: "Língua Portuguesa", topico: "Geral" }}
      />,
    );

    expect(html).toContain("Língua Portuguesa");
    expect(html).not.toContain("Língua Portuguesa · Geral");
  });
});
