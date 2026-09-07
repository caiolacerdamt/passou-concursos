import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { USO } from "./jobs/abrir-concurso.mts";

/**
 * O contrato entre as duas skills de abertura e o comando (SPEC 40 · AD-145).
 *
 * O Success Criterion diz "o mesmo roteiro executa em Codex e Claude Code, sem
 * nenhuma regra de escrita que só exista no prompt". Isso só é verdade se:
 *
 *   1. existir UMA fonte canônica, e o adaptador do Claude apenas apontar
 *      para ela — nunca repetir o roteiro, porque duas cópias divergem;
 *   2. o roteiro citar as ações que o CLI realmente tem, e nenhuma que ele
 *      não tenha;
 *   3. as três confirmações estarem lá, na ordem;
 *   4. não haver nenhuma menção a API, provedor de busca ou chave.
 *
 * Sem estes testes, "o mesmo roteiro nos dois agentes" seria promessa de
 * documento. Com eles, é sensor: renomear uma ação do CLI e esquecer a skill
 * deixa o teste vermelho.
 */

const CANONICA = ".agents/skills/abrir-concurso/SKILL.md";
const ADAPTADOR = ".claude/skills/abrir-concurso/SKILL.md";

/**
 * Le a skill com o fim de linha **normalizado**.
 *
 * O git materializa estes arquivos em CRLF no Windows e em LF no runner da CI.
 * Sem esta linha, todo padrao que atravessa uma quebra de linha se comporta
 * diferente nos dois lugares — verde na CI, vermelho na maquina de quem
 * desenvolve, ou o contrario. Normalizar aqui conserta a classe inteira do
 * problema, em vez de remendar regex por regex.
 */
function ler(caminho: string): string {
  return readFileSync(path.join(process.cwd(), caminho), "utf8").replace(/\r\n/g, "\n");
}

/** As ações que o comando aceita, lidas do próprio `USO` — nunca digitadas aqui. */
function acoesDoComando(): string[] {
  return [...USO.matchAll(/^ {2}([a-z-]+) /gm)].map((achado) => achado[1]);
}

describe("as duas skills apontam para a mesma fonte", () => {
  it("as duas estão versionadas — skill que não entra no git não existe para o outro", () => {
    // `.claude/skills/` é ignorado por padrão; a exceção do `.gitignore` é o
    // que faz o adaptador chegar a quem clona. Sem isto, o Claude Code de
    // outra máquina não teria a skill, e este arquivo passaria mentindo.
    const versionados = execFileSync("git", ["ls-files", CANONICA, ADAPTADOR], {
      encoding: "utf8",
    })
      .split("\n")
      .filter((linha) => linha.trim() !== "");

    expect(versionados.sort()).toEqual([CANONICA, ADAPTADOR].sort());
  });

  it("o adaptador do Claude manda ler a canônica, e não repete o roteiro", () => {
    const adaptador = ler(ADAPTADOR);

    expect(adaptador).toContain(CANONICA);
    // Curto de propósito: roteiro duplicado é roteiro que diverge.
    expect(adaptador.split("\n").length).toBeLessThan(30);
    // E ele diz quem ganha quando os dois discordarem.
    expect(adaptador).toMatch(/fonte canônica vence/i);
  });

  it("as duas descrevem o mesmo gatilho, para os dois agentes acionarem no mesmo pedido", () => {
    const descricao = (texto: string) =>
      /^description:\s*(.+)$/m.exec(texto)?.[1]?.trim() ?? "";

    expect(descricao(ler(CANONICA))).not.toBe("");
    expect(descricao(ler(ADAPTADOR))).toBe(descricao(ler(CANONICA)));
  });
});

describe("o roteiro canônico casa com o comando que existe", () => {
  it("cita todas as ações do CLI, e nenhuma que ele não tenha", () => {
    const roteiro = ler(CANONICA);
    const acoes = acoesDoComando();

    // O sensor precisa enxergar alguma coisa: `USO` vazio passaria sempre.
    expect(acoes.length).toBeGreaterThan(5);

    for (const acao of acoes) {
      expect(roteiro, `a skill não cita a ação ${acao}`).toContain(`--acao ${acao}`);
    }

    const citadas = [...roteiro.matchAll(/--acao ([a-z-]+)/g)].map((a) => a[1]);
    for (const citada of new Set(citadas)) {
      expect(acoes, `a skill cita ${citada}, que o CLI não tem`).toContain(citada);
    }
  });

  it("as três confirmações estão lá, e nessa ordem", () => {
    const roteiro = ler(CANONICA);
    const documentos = roteiro.indexOf("--acao decidir-documentos");
    const assuntos = roteiro.indexOf("--acao decidir-assuntos");
    const publicar = roteiro.indexOf("--acao publicar");

    expect(documentos).toBeGreaterThan(-1);
    expect(assuntos).toBeGreaterThan(documentos);
    expect(publicar).toBeGreaterThan(assuntos);
  });

  it("manda pesquisar na própria sessão, e parar quando não puder", () => {
    const roteiro = ler(CANONICA);

    expect(roteiro).toMatch(/na \*\*sua sessão\*\*|sua própria sessão/i);
    // O caminho de escape honesto: sem busca, pede as URLs ao operador.
    //
    // `\s+`, e nao `\s`: o markdown quebra linha no meio da frase, e no
    // Windows essa quebra e **dois** caracteres (`\r\n`). Com `\s` simples
    // este teste passava no working tree em LF e falhava no checkout em CRLF
    // — verde na CI Linux, vermelho na maquina de quem desenvolve. Foi
    // exatamente o que aconteceu no merge da SPEC 40.
    expect(roteiro).toMatch(/pare\s+e\s+peça\s+as\s+URLs\s+oficiais\s+ao\s+operador/i);
    expect(roteiro).toMatch(/nunca troque silenciosamente para uma API paga/i);
  });

  it("proíbe decidir no lugar do humano e vazar prova para a conversa", () => {
    const roteiro = ler(CANONICA);

    expect(roteiro).toMatch(/Fusão nunca é automática/i);
    expect(roteiro).toMatch(/nem quando a resposta parecer óbvia/i);
    expect(roteiro).toMatch(/nunca[\s\S]{0,40}PDF de uma prova na conversa/i);
    expect(roteiro).toMatch(/agregador/i);
  });
});

describe("nenhuma das skills promete uma busca que o produto não tem (AD-145)", () => {
  it("não cita provedor de busca, endpoint nem chave", () => {
    // Mesmas famílias do sensor de código, agora sobre o texto que o agente
    // lê: uma skill que sugerisse `tavily` levaria a sessão a tentar.
    const proibidos = [
      /\btavily/i,
      /\bserp[-_]?api\b/i,
      /\bfirecrawl/i,
      /\bbing[-_.]?(search|api)\b/i,
      /\bweb_search(_preview)?\b/i,
      /API[_ ]?KEY/i,
      /\bapi de busca\b/i,
    ];

    for (const caminho of [CANONICA, ADAPTADOR]) {
      const texto = ler(caminho);
      for (const padrao of proibidos) {
        expect(padrao.test(texto), `${caminho} casa com ${padrao}`).toBe(false);
      }
    }
  });

  it("o sensor enxerga: um texto com provedor casaria", () => {
    expect(/\btavily/i.test("use a busca do Tavily")).toBe(true);
    expect(/API[_ ]?KEY/i.test("defina a API key")).toBe(true);
  });
});
