import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * O sensor do Success Criterion "nenhuma linha do pipeline roda em funcao da
 * Vercel" (BANCO-03 AC5 / AD-036).
 *
 * A proibicao nao e estilistica. O lote da Batch API tem janela de **24 horas** e
 * a extracao de uma prova varre dezenas de paginas; nenhum timeout de funcao
 * serverless alcanca isso. Uma rota que importasse o pipeline "so para testar"
 * passaria no `next build` e morreria em producao no meio de uma prova, deixando
 * blocos pagos e nao colhidos.
 *
 * O que este teste mede e uma **ausencia**, e por isso ele varre a arvore em vez
 * de asseverar sobre um arquivo: o jeito de a regra ser quebrada e alguem
 * escrever um import novo, num arquivo que ainda nao existe.
 */

/** O que so pode ser importado de job. */
const PECAS_DO_PIPELINE = [
  "modules/acervo/pdf",
  "modules/acervo/fatiamento",
  "modules/acervo/ingestao",
  "modules/acervo/gabarito",
  "modules/ia/lote",
];

/**
 * Os nomes que a interface publica do modulo expoe e que **so** o pipeline usa.
 *
 * Varrer so o caminho de arquivo nao basta: `@/modules/acervo` e `@/modules/ia`
 * reexportam tudo, e uma rota poderia importar `lerPdf` pelo indice do modulo
 * sem citar `acervo/pdf` em lugar nenhum.
 */
const SIMBOLOS_DO_PIPELINE = [
  "lerPdf",
  "fatiarEmBlocos",
  "gravarQuestoes",
  "registrarBlocos",
  "cruzarGabarito",
  "montarLote",
  "enviarLote",
  "colherLote",
];

/** Tudo que a Vercel executa: as telas, as rotas e o proxy de sessao. */
const PASTAS_DA_VERCEL = ["src/app/", "src/proxy.ts", "src/lib/"];

function arquivosDaVercel(): string[] {
  return execFileSync("git", ["ls-files", "-z", ...PASTAS_DA_VERCEL], {
    encoding: "utf8",
  })
    .split("\0")
    .filter((caminho) => /\.(ts|tsx)$/.test(caminho) && !caminho.endsWith(".test.ts"));
}

describe("o pipeline de ingestao nao roda na Vercel (BANCO-03 AC5)", () => {
  const arquivos = arquivosDaVercel();

  it("a varredura enxerga a superficie que a Vercel executa", () => {
    // Sensor cego passa sempre. Se o `src/app/` sumir ou o `git ls-files` parar
    // de achar arquivo, este teste falha antes de dar um PASS que nao vale nada.
    expect(arquivos.length).toBeGreaterThan(5);
    expect(arquivos.some((caminho) => caminho.startsWith("src/app/"))).toBe(true);
  });

  it("nenhum arquivo da Vercel importa uma peca do pipeline", () => {
    const infratores: string[] = [];

    for (const caminho of arquivos) {
      const conteudo = readFileSync(caminho, "utf8");
      for (const peca of PECAS_DO_PIPELINE) {
        if (conteudo.includes(peca)) infratores.push(`${caminho} -> ${peca}`);
      }
      for (const simbolo of SIMBOLOS_DO_PIPELINE) {
        if (new RegExp(`\\b${simbolo}\\b`).test(conteudo)) {
          infratores.push(`${caminho} -> ${simbolo}`);
        }
      }
    }

    expect(infratores).toEqual([]);
  });

  it("os jobs da fabrica sao `.mts` rodados por tsx, fora do build do Next", () => {
    // O outro lado da mesma regra: o pipeline **existe**, e existe num lugar que
    // a Vercel nao executa. Sem esta assercao, apagar os jobs deixaria o teste
    // acima verde por vacuidade.
    const jobs = execFileSync("git", ["ls-files", "-z", "scripts/jobs/"], {
      encoding: "utf8",
    })
      .split("\0")
      .filter((caminho) => caminho.endsWith(".mts"));

    expect(jobs).toContain("scripts/jobs/ingestao-de-prova.mts");
    expect(jobs).toContain("scripts/jobs/cruzar-gabarito.mts");
  });

  it("o workflow da ingestao roda no GitHub Actions", () => {
    const workflow = readFileSync(".github/workflows/ingestao.yml", "utf8");
    expect(workflow).toContain("runs-on: ubuntu-latest");
    // Disparo manual: ingerir prova e ato deliberado do operador, com o PDF
    // oficial na mao. Agendamento aqui so poderia adivinhar.
    expect(workflow).toContain("workflow_dispatch");
  });
});
