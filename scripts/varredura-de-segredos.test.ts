import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PADROES,
  arquivosVersionados,
  deveVarrer,
  encontrarSegredos,
  envEstaVersionado,
} from "./varredura-de-segredos.mjs";

/**
 * Um caso positivo por padrao.
 *
 * **Todos sao montados por concatenacao, e isso nao e estilo.** A varredura de
 * verdade roda em cima de todo arquivo versionado, inclusive deste. Escrito
 * inteiro, cada exemplo faria o repositorio reprovar a si mesmo — e a saida
 * facil seria abrir uma excecao no scanner, que e exatamente o buraco por onde
 * um segredo de verdade passaria depois.
 */
const EXEMPLOS: Array<[string, string]> = [
  ["token de acesso do Supabase", "sbp_" + "a".repeat(40)],
  ["chave secreta do Supabase", "sb_secret_" + "b".repeat(30)],
  ["token de autenticacao do Sentry", "sntrys_" + "c".repeat(30)],
  ["chave da OpenAI", "sk" + "-" + "d".repeat(40)],
  ["chave de producao de gateway", "sk_live_" + "e".repeat(30)],
  ["token do Slack", "xoxb-" + "1".repeat(20)],
  ["chave de acesso da AWS", "AKIA" + "ABCDEFGHIJKLMNOP"],
  ["token do GitHub", "ghp_" + "f".repeat(36)],
  ["chave da Google", "AIza" + "g".repeat(35)],
  ["chave privada", "-----BEGIN RSA " + "PRIVATE KEY-----"],
  [
    "senha dentro de string de conexao do Postgres",
    "postgres://postgres.abc:" + "umaSenhaLonga" + "@pooler.supabase.com:5432/postgres",
  ],
];

describe("encontrarSegredos", () => {
  it.each(EXEMPLOS)("acha %s", (nome, exemplo) => {
    const achados = encontrarSegredos(`const x = "${exemplo}";`);
    expect(achados.map((a) => a.nome)).toContain(nome);
  });

  it("cobre todos os padroes declarados — nenhum fica sem caso de teste", () => {
    expect(EXEMPLOS.map(([nome]) => nome).sort()).toEqual(
      PADROES.map((p) => p.nome).sort(),
    );
  });

  it("aponta a linha e nao imprime o valor inteiro", () => {
    const achados = encontrarSegredos(`linha um\nlinha dois\nsbp_${"z".repeat(40)}`);

    expect(achados).toHaveLength(1);
    expect(achados[0].linha).toBe(3);
    expect(achados[0].trecho).toBe("sbp_zzzz…");
    expect(achados[0].trecho).not.toContain("z".repeat(40));
  });

  it("o DSN publico do Sentry NAO e segredo — ele vai para o navegador de proposito", () => {
    // Formato real, valores trocados: nem o DSN do projeto precisa entrar aqui.
    const dsn = `https://${"0".repeat(32)}@o1234567890.ingest.us.sentry.io/9876543210`;
    expect(encontrarSegredos(`NEXT_PUBLIC_SENTRY_DSN=${dsn}`)).toEqual([]);
  });

  it("string de conexao de exemplo, sem senha de verdade, nao dispara", () => {
    expect(encontrarSegredos("postgres://exemplo")).toEqual([]);
    expect(encontrarSegredos("DATABASE_URL=")).toEqual([]);
    // Senha curta de documentacao.
    expect(encontrarSegredos("postgresql://u:s@host:5432/postgres")).toEqual([]);
  });

  it("string de conexao montada em codigo nao e credencial — o valor nao esta ali", () => {
    // Caso real: scripts/alvo-do-banco.test.ts monta as duas formas de conexao
    // com uma senha de mentira numa variavel. Tratar isso como vazamento seria
    // alarme falso, e alarme falso e o que treina o time a ignorar o alarme.
    expect(
      encontrarSegredos(
        "const direta = `postgresql://postgres:${SENHA}@db.abc.supabase.co:5432/postgres`;",
      ),
    ).toEqual([]);
    expect(
      encontrarSegredos(
        'const url = "postgresql://postgres:" + SENHA + "@host:5432/postgres";',
      ),
    ).toEqual([]);
  });

  it("texto comum nao dispara", () => {
    expect(encontrarSegredos("o aluno respondeu a questao e acertou")).toEqual([]);
  });
});

describe("deveVarrer", () => {
  it("pula binario e varre texto", () => {
    expect(deveVarrer("docs/foto.png")).toBe(false);
    expect(deveVarrer("experimentos/voz.mp3")).toBe(false);
    expect(deveVarrer("src/modules/config/leitura.ts")).toBe(true);
    expect(deveVarrer("Makefile")).toBe(true);
  });
});

describe("o proprio repositorio passa na varredura", () => {
  it(".env.example documenta sem valor e nao dispara nada (INFRA-10)", () => {
    expect(encontrarSegredos(readFileSync(".env.example", "utf8"))).toEqual([]);
  });

  it(".env nao esta versionado", () => {
    expect(envEstaVersionado()).toBe(false);
  });

  it("nenhum arquivo versionado carrega credencial — sem nenhuma excecao", () => {
    // Nem este arquivo e isento: por isso os exemplos sao concatenados.
    const comSegredo = arquivosVersionados()
      .filter(deveVarrer)
      .flatMap((caminho) => {
        let texto: string;
        try {
          texto = readFileSync(caminho, "utf8");
        } catch {
          return [];
        }
        return encontrarSegredos(texto).map((a) => `${caminho}:${a.linha} ${a.nome}`);
      });

    expect(comSegredo).toEqual([]);
  });
});
