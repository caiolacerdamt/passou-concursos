import { describe, expect, it, vi } from "vitest";

import { PROJETO_REF } from "./alvo-do-banco.mjs";
import {
  TIPOS,
  classificar,
  executar,
  reprova,
  resumir,
  urlDoAdvisor,
} from "./advisors.mjs";

/** Resposta com um achado de cada nivel. */
const RESPOSTA = {
  lints: [
    { name: "policy_exists_rls_disabled", title: "RLS Disabled", level: "ERROR", detail: "Table `x` sem RLS" },
    { name: "function_search_path_mutable", title: "Search Path", level: "WARN", detail: "funcao f" },
    { name: "rls_enabled_no_policy", title: "RLS Enabled No Policy", level: "INFO", detail: "Table `configuracoes`" },
  ],
};

function respostaFalsa(corpo: unknown, ok = true, status = 200) {
  return async () =>
    ({ ok, status, json: async () => corpo }) as unknown as Response;
}

describe("urlDoAdvisor", () => {
  it("aponta para o projeto declarado, nos dois tipos", () => {
    expect(TIPOS).toEqual(["security", "performance"]);
    expect(urlDoAdvisor("security")).toBe(
      `https://api.supabase.com/v1/projects/${PROJETO_REF}/advisors/security`,
    );
    expect(urlDoAdvisor("performance")).toBe(
      `https://api.supabase.com/v1/projects/${PROJETO_REF}/advisors/performance`,
    );
  });
});

describe("classificar", () => {
  it("separa ERROR, WARN e INFO", () => {
    const grupos = classificar(RESPOSTA);
    expect(grupos.ERROR.map((l) => l.name)).toEqual(["policy_exists_rls_disabled"]);
    expect(grupos.WARN.map((l) => l.name)).toEqual(["function_search_path_mutable"]);
    expect(grupos.INFO.map((l) => l.name)).toEqual(["rls_enabled_no_policy"]);
    expect(grupos.DESCONHECIDO).toEqual([]);
  });

  it("nivel que nao reconhece vai para DESCONHECIDO, nao e engolido", () => {
    const grupos = classificar({ lints: [{ name: "novo", level: "CRITICAL" }, { name: "sem" }] });
    expect(grupos.DESCONHECIDO.map((l) => l.name)).toEqual(["novo", "sem"]);
  });

  it("resposta em formato inesperado vira erro, nunca 'nenhum achado'", () => {
    // O endpoint e experimental. Emudecer em silencio e o pior desfecho possivel.
    const mensagem = /resposta inesperada da API de advisors/;
    expect(() => classificar({})).toThrow(mensagem);
    expect(() => classificar({ lints: "nao e lista" })).toThrow(mensagem);
    expect(() => classificar(null)).toThrow(mensagem);
  });
});

describe("reprova", () => {
  it("ERROR e nivel desconhecido reprovam; WARN e INFO nao", () => {
    expect(reprova(classificar(RESPOSTA))).toBe(true);
    expect(reprova(classificar({ lints: [{ level: "WARN" }, { level: "INFO" }] }))).toBe(
      false,
    );
    expect(reprova(classificar({ lints: [{ level: "CRITICAL" }] }))).toBe(true);
    expect(reprova(classificar({ lints: [] }))).toBe(false);
  });
});

describe("resumir", () => {
  it("imprime o mais grave primeiro, com tipo, nivel, titulo e detalhe", () => {
    expect(resumir("security", classificar(RESPOSTA))).toEqual([
      "[security] ERROR: RLS Disabled — Table `x` sem RLS",
      "[security] WARN: Search Path — funcao f",
      "[security] INFO: RLS Enabled No Policy — Table `configuracoes`",
    ]);
  });
});

describe("executar", () => {
  it("sem token, sai vermelho e diz onde arrumar", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await executar({ token: "", buscar: respostaFalsa(RESPOSTA) })).toBe(1);
    expect(espiao.mock.calls[0][0]).toContain("SUPABASE_ACCESS_TOKEN nao esta definido");
    espiao.mockRestore();
  });

  it("so WARN e INFO passa verde, com os achados impressos", async () => {
    const espiao = vi.spyOn(console, "log").mockImplementation(() => {});
    const codigo = await executar({
      token: "sbp_falso",
      buscar: respostaFalsa({ lints: [{ level: "INFO", title: "so um aviso" }] }),
    });

    expect(codigo).toBe(0);
    expect(espiao.mock.calls.flat()).toContain("[security] INFO: so um aviso");
    espiao.mockRestore();
  });

  it("um ERROR reprova a execucao", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await executar({ token: "sbp_falso", buscar: respostaFalsa(RESPOSTA) })).toBe(1);
    vi.restoreAllMocks();
  });

  it("HTTP fora do 2xx reprova em vez de fingir que nao ha achado", async () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const codigo = await executar({
      token: "sbp_falso",
      buscar: respostaFalsa(null, false, 401),
    });

    expect(codigo).toBe(1);
    expect(espiao.mock.calls[0][0]).toContain("a API respondeu 401");
    vi.restoreAllMocks();
  });

  it("manda o token no cabecalho Authorization", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const chamadas: Array<{ url: string; cabecalho: unknown }> = [];
    const buscar = (async (url: string, opcoes: RequestInit) => {
      chamadas.push({ url, cabecalho: (opcoes.headers as Record<string, string>).Authorization });
      return { ok: true, status: 200, json: async () => ({ lints: [] }) } as unknown as Response;
    }) as unknown as typeof fetch;

    await executar({ token: "sbp_falso", buscar });

    expect(chamadas).toHaveLength(2);
    expect(chamadas[0].cabecalho).toBe("Bearer sbp_falso");
    vi.restoreAllMocks();
  });
});
