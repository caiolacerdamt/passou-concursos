import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { definirLeitorDeConfig, restaurarLeitorPadrao } from "@/modules/config";
import { definirDestinoDeErro, restaurarDestinoPadrao } from "@/modules/observabilidade";

import {
  ConfiguracaoDaBuscaIlegivel,
  DownloadRecusado,
  ManifestoInvalido,
  avaliarUrl,
  baixarAprovados,
  baixarDocumentoOficial,
  hostPermitido,
  lerDominiosOficiais,
  lerManifesto,
  nomeInternoDoDocumento,
  normalizarDominios,
  triarCandidatos,
} from "./documentos-oficiais";

const DOMINIOS = ["cesgranrio.org.br", "gov.br", "fgv.br"];

/** Prova exige a chave natural do catalogo-alvo; edital nao tem uma. */
function candidato(url: string, tipo: "edital" | "prova" = "prova") {
  return {
    tipo,
    url,
    titulo: "Caderno",
    metadados:
      tipo === "prova"
        ? { banca: "Cesgranrio", ano: 2021, orgao: "CAIXA", cargo: "Tecnico" }
        : {},
  };
}

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarDestinoPadrao();
  vi.restoreAllMocks();
});

describe("o manifesto que a sessao entrega e entrada nao confiavel", () => {
  it("aceita o formato combinado e preenche `faltantes` vazio", () => {
    const lido = lerManifesto({
      candidatos: [
        {
          tipo: "prova",
          url: "https://cesgranrio.org.br/p.pdf",
          titulo: "CAIXA 2021",
          metadados: { banca: "Cesgranrio", ano: 2021, orgao: "CAIXA", cargo: "Tecnico" },
        },
      ],
    });
    expect(lido.candidatos).toHaveLength(1);
    expect(lido.faltantes).toEqual([]);
  });

  it("recusa campo que o schema nao conhece, em vez de ignorar", () => {
    expect(() =>
      lerManifesto({
        candidatos: [{ ...candidato("https://cesgranrio.org.br/p.pdf"), executar: "rm -rf" }],
      }),
    ).toThrow(ManifestoInvalido);

    expect(() =>
      lerManifesto({ candidatos: [], faltantes: [], observacao: "extra" }),
    ).toThrow(ManifestoInvalido);
  });

  it("recusa tipo fora dos dois conhecidos e manifesto sem a chave", () => {
    expect(() => lerManifesto({ candidatos: [candidato("https://gov.br/x.pdf", "livro" as never)] }))
      .toThrow(ManifestoInvalido);
    expect(() => lerManifesto({})).toThrow(ManifestoInvalido);
    expect(() => lerManifesto("candidatos")).toThrow(ManifestoInvalido);
  });

  it("prova sem a chave natural do catalogo-alvo e recusada de saida", () => {
    // `(banca, ano, orgao, cargo)` e a chave de `provas` (BANCO-02). Sem ela a
    // prova nao tem como virar linha, e descobrir isso depois do download seria
    // descobrir tarde.
    expect(() =>
      lerManifesto({
        candidatos: [
          {
            tipo: "prova",
            url: "https://cesgranrio.org.br/p.pdf",
            titulo: "Caderno",
            metadados: { banca: "Cesgranrio", ano: 2021 },
          },
        ],
      }),
    ).toThrow(ManifestoInvalido);

    // Edital nao e prova e nao precisa de nenhum desses campos.
    expect(
      lerManifesto({
        candidatos: [
          { tipo: "edital", url: "https://gov.br/e.pdf", titulo: "Edital", metadados: {} },
        ],
      }).candidatos,
    ).toHaveLength(1);
  });
});

describe("a allowlist casa por rotulo, nunca por sufixo de texto", () => {
  it("aceita o host exato e o subdominio dele", () => {
    expect(hostPermitido("cesgranrio.org.br", DOMINIOS)).toBe(true);
    expect(hostPermitido("provas.cesgranrio.org.br", DOMINIOS)).toBe(true);
    expect(hostPermitido("CAIXA.GOV.BR", DOMINIOS)).toBe(true);
    // Ponto final de FQDN e o mesmo host.
    expect(hostPermitido("fgv.br.", DOMINIOS)).toBe(true);
  });

  it("recusa o host que apenas TERMINA parecido — o furo classico do endsWith", () => {
    expect(hostPermitido("falsocesgranrio.org.br", DOMINIOS)).toBe(false);
    expect(hostPermitido("cesgranrio.org.br.agregador.com", DOMINIOS)).toBe(false);
    expect(hostPermitido("naogov.br", DOMINIOS)).toBe(false);
  });

  it("recusa IP literal, host local e rotulo mal formado", () => {
    for (const host of ["127.0.0.1", "10.0.0.5", "localhost", "-gov.br", "gov..br", ""]) {
      expect(hostPermitido(host, DOMINIOS)).toBe(false);
    }
  });
});

describe("avaliarUrl e o unico juiz de URL do fluxo", () => {
  it("aceita HTTPS em dominio oficial e devolve a URL normalizada", () => {
    const veredito = avaliarUrl("  https://CESGRANRIO.org.br/provas/p.pdf ", DOMINIOS);
    expect(veredito).toEqual({
      ok: true,
      url: "https://cesgranrio.org.br/provas/p.pdf",
      host: "cesgranrio.org.br",
    });
  });

  it("recusa cada forma de escapar da allowlist, com o motivo certo", () => {
    const casos: [string, string][] = [
      ["http://cesgranrio.org.br/p.pdf", "esquema_nao_https"],
      ["ftp://cesgranrio.org.br/p.pdf", "esquema_nao_https"],
      ["file:///etc/passwd", "esquema_nao_https"],
      // O host verdadeiro aqui e o agregador; o "cesgranrio" e so usuario.
      ["https://cesgranrio.org.br@agregador.com/p.pdf", "credencial_na_url"],
      ["https://usuario:senha@cesgranrio.org.br/p.pdf", "credencial_na_url"],
      ["https://cesgranrio.org.br:8443/p.pdf", "porta_explicita"],
      ["https://127.0.0.1/p.pdf", "host_mal_formado"],
      ["https://localhost/p.pdf", "host_mal_formado"],
      ["https://[::1]/p.pdf", "host_mal_formado"],
      ["https://qconcursos.com/p.pdf", "fora_da_allowlist"],
      ["https://falsocesgranrio.org.br/p.pdf", "fora_da_allowlist"],
      ["nao e uma url", "url_ilegivel"],
    ];

    for (const [url, motivo] of casos) {
      expect({ url, ...avaliarUrl(url, DOMINIOS) }).toEqual({ url, ok: false, motivo });
    }
  });
});

describe("a triagem descarta sem exibir", () => {
  it("separa aceitos de descartados e nunca devolve a URL recusada", () => {
    const triagem = triarCandidatos(
      {
        candidatos: [
          candidato("https://cesgranrio.org.br/a.pdf"),
          candidato("https://qconcursos.com/a.pdf"),
          candidato("http://gov.br/b.pdf"),
          candidato("https://gov.br/b.pdf", "edital"),
        ],
        faltantes: ["prova 2018"],
      },
      DOMINIOS,
    );

    expect(triagem.aceitos.map((a) => a.url)).toEqual([
      "https://cesgranrio.org.br/a.pdf",
      "https://gov.br/b.pdf",
    ]);
    expect(triagem.descartados).toBe(2);
    expect(triagem.faltantes).toEqual(["prova 2018"]);

    // O que foi descartado nao aparece em lugar nenhum do resultado.
    expect(JSON.stringify(triagem)).not.toContain("qconcursos");
  });

  it("a mesma URL duas vezes e um documento so, e nao conta como descarte", () => {
    const triagem = triarCandidatos(
      {
        candidatos: [
          candidato("https://cesgranrio.org.br/a.pdf"),
          candidato("https://cesgranrio.org.br/a.pdf"),
        ],
        faltantes: [],
      },
      DOMINIOS,
    );
    expect(triagem.aceitos).toHaveLength(1);
    expect(triagem.descartados).toBe(0);
  });
});

describe("a allowlist vem da configuracao e nunca fica permissiva", () => {
  it("le a lista da configuracao quando ela e valida", async () => {
    definirLeitorDeConfig(async () => ({
      "param.m1.dominios_oficiais": ["cesgranrio.org.br", "exemplo-de-banca.org.br"],
    }));
    expect(await lerDominiosOficiais()).toEqual([
      "cesgranrio.org.br",
      "exemplo-de-banca.org.br",
    ]);
  });

  it("config ilegivel cai no default SEMEADO, que e restritivo — nunca em 'aceite tudo'", async () => {
    // Valor hostil no banco: lista vazia, host com curinga e coisa que nem e
    // lista. Em nenhum dos tres o agregador passa a ser fonte legal.
    for (const hostil of [[], ["*"], "todos", { permitir: "*" }, null]) {
      definirLeitorDeConfig(async () => ({ "param.m1.dominios_oficiais": hostil }));
      const dominios = await lerDominiosOficiais();
      expect(dominios.length).toBeGreaterThan(0);
      expect(hostPermitido("qconcursos.com", dominios)).toBe(false);
      expect(hostPermitido("cesgranrio.org.br", dominios)).toBe(true);
    }
  });

  it("lista efetivamente vazia FECHA o fluxo, em vez de virar sem restricao", () => {
    expect(() => normalizarDominios([])).toThrow(ConfiguracaoDaBuscaIlegivel);
    expect(() => normalizarDominios(["  ", ""])).toThrow(ConfiguracaoDaBuscaIlegivel);
    expect(normalizarDominios([" CESGRANRIO.ORG.BR "])).toEqual(["cesgranrio.org.br"]);
  });
});

// ── Download ────────────────────────────────────────────────────────────────

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 0x20)]);

function resposta(
  corpo: Buffer,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(new Uint8Array(corpo), {
    status: init.status ?? 200,
    headers: { "content-type": "application/pdf", ...init.headers },
  });
}

function redirect(destino: string): Response {
  // `Response.redirect` recusa destino que nao seja URL absoluta valida; o
  // construtor cru deixa testar o `location` relativo tambem.
  return new Response(null, { status: 302, headers: { location: destino } });
}

describe("o download so acontece em fonte oficial, e revalida cada salto", () => {
  it("baixa, mede e devolve a assinatura do arquivo", async () => {
    const baixado = await baixarDocumentoOficial(
      "https://cesgranrio.org.br/p.pdf",
      DOMINIOS,
      { buscar: async () => resposta(PDF), tetoMib: 25 },
    );
    expect(baixado.bytes).toBe(PDF.length);
    expect(baixado.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(baixado.urlFinal).toBe("https://cesgranrio.org.br/p.pdf");
  });

  it("segue redirect DENTRO da allowlist e recusa o que sai dela", async () => {
    const dentro = await baixarDocumentoOficial(
      "https://cesgranrio.org.br/p.pdf",
      DOMINIOS,
      {
        buscar: async (url) =>
          url.endsWith("/p.pdf") ? redirect("/arquivos/final.pdf") : resposta(PDF),
        tetoMib: 25,
      },
    );
    expect(dentro.urlFinal).toBe("https://cesgranrio.org.br/arquivos/final.pdf");

    // O primeiro salto era legal; o segundo aponta para agregador. Recusado.
    await expect(
      baixarDocumentoOficial("https://cesgranrio.org.br/p.pdf", DOMINIOS, {
        buscar: async () => redirect("https://qconcursos.com/p.pdf"),
        tetoMib: 25,
      }),
    ).rejects.toThrow(/redirecionamento fora_da_allowlist/);
  });

  it("para no laco de redirect e na resposta sem destino", async () => {
    await expect(
      baixarDocumentoOficial("https://gov.br/p.pdf", DOMINIOS, {
        buscar: async () => redirect("https://gov.br/p.pdf"),
        tetoMib: 25,
      }),
    ).rejects.toThrow(/redirecionamentos demais/);

    await expect(
      baixarDocumentoOficial("https://gov.br/p.pdf", DOMINIOS, {
        buscar: async () => new Response(null, { status: 302 }),
        tetoMib: 25,
      }),
    ).rejects.toThrow(/sem destino/);
  });

  it("recusa o corpo que passa do teto, mesmo com Content-Length mentindo", async () => {
    const grande = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(3 * 1024 * 1024, 0x20)]);
    await expect(
      baixarDocumentoOficial("https://gov.br/p.pdf", DOMINIOS, {
        // O servidor declara 10 bytes e manda 3 MiB: quem segura e a contagem
        // do que chega, nao o cabecalho.
        buscar: async () => resposta(grande, { headers: { "content-length": "10" } }),
        tetoMib: 1,
      }),
    ).rejects.toThrow(/maior que o teto/);
  });

  it("recusa tipo errado, falso PDF e resposta de erro", async () => {
    await expect(
      baixarDocumentoOficial("https://gov.br/p.pdf", DOMINIOS, {
        buscar: async () => resposta(PDF, { headers: { "content-type": "text/html" } }),
        tetoMib: 25,
      }),
    ).rejects.toThrow(/content-type nao e PDF/);

    await expect(
      baixarDocumentoOficial("https://gov.br/p.pdf", DOMINIOS, {
        buscar: async () => resposta(Buffer.from("<html>nao sou um pdf</html>")),
        tetoMib: 25,
      }),
    ).rejects.toThrow(/nao comeca com %PDF-/);

    await expect(
      baixarDocumentoOficial("https://gov.br/p.pdf", DOMINIOS, {
        buscar: async () => resposta(PDF, { status: 404 }),
        tetoMib: 25,
      }),
    ).rejects.toThrow(/resposta 404/);
  });

  it("o nome interno vem do ID, nunca do servidor", () => {
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(nomeInternoDoDocumento(id, "prova")).toBe(`prova-${id}.pdf`);
    expect(() => nomeInternoDoDocumento("../../etc/passwd", "prova")).toThrow(DownloadRecusado);
  });
});

describe("baixar a lista aprovada nao para na primeira falha", () => {
  it("segue em frente e devolve a falha por documento, sem vazar a URL no log", async () => {
    const registrados: Record<string, unknown>[] = [];
    definirDestinoDeErro((_erro, contexto) => registrados.push(contexto));

    const resultado = await baixarAprovados(
      [
        { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", url: "https://gov.br/ok.pdf", tipo: "prova" },
        { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", url: "https://gov.br/ruim.pdf", tipo: "prova" },
      ],
      DOMINIOS,
      {
        buscar: async (url) =>
          url.includes("ruim") ? resposta(PDF, { status: 500 }) : resposta(PDF),
        tetoMib: 25,
      },
    );

    expect(resultado.baixados.map((b) => b.id)).toEqual([
      "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    ]);
    expect(resultado.falhas).toEqual([
      { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", motivo: "resposta 500" },
    ]);

    // O contexto do erro leva o ID; a URL e o corpo ficam de fora (SEC-05).
    expect(registrados).toHaveLength(1);
    expect(JSON.stringify(registrados[0])).not.toContain("gov.br");
  });
});

describe("este modulo nao pesquisa a web (AD-145)", () => {
  it("nao ha funcao de busca nem chamada a provedor no arquivo", () => {
    const fonte = readFileSync(
      new URL("./documentos-oficiais.ts", import.meta.url),
      "utf8",
    );
    // A unica ida a rede e o download de uma URL **ja aprovada**; nao existe
    // aqui nenhuma consulta que devolva uma lista de URLs.
    expect(fonte).not.toMatch(/\b(pesquisar|buscarNaWeb|search\()/);
    expect((fonte.match(/\bfetch\(/g) ?? []).length).toBe(1);
  });
});
