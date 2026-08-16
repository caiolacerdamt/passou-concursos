import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CATALOGO } from "@/modules/config/catalogo";
import {
  definirLeitorDeConfig,
  definirReporteDeErro,
  getParam,
  isFlagOn,
  leitorDoBanco,
  restaurarLeitorPadrao,
  restaurarReportePadrao,
} from "@/modules/config/leitura";

import { descreveComSupabase } from "./setup";

let reportes: { erro: unknown; contexto: Record<string, unknown> }[];

beforeEach(() => {
  reportes = [];
  definirReporteDeErro((erro, contexto) => reportes.push({ erro, contexto }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  restaurarLeitorPadrao();
  restaurarReportePadrao();
});

/**
 * Derruba a leitura de verdade, pelo caminho real: o cliente Supabase continua
 * apontando para o projeto certo, mas com credencial invalida. O PostgREST
 * responde 401 na hora, `leitorDoBanco` transforma isso em excecao, e a queda
 * acontece exatamente como aconteceria em produca com a chave rotacionada.
 *
 * Host morto tambem derrubaria, mas o cliente leva mais de 5s para desistir —
 * teste lento e teste que ninguem roda.
 */
function derrubarALeitura(): void {
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_credencial_invalida");
  definirLeitorDeConfig(leitorDoBanco);
}

descreveComSupabase("queda da leitura de configuracao (Independent Test do INFRA-11)", () => {
  it("flag cujo default e true fica DESLIGADA quando a leitura falha (AC6)", async () => {
    // O catalogo diz que esta nasce ligada. E o que torna o teste util: se a
    // queda caisse no default declarado, ela ligaria uma superficie sozinha.
    expect(CATALOGO["flag.m4.caderno_erros"].padrao).toBe(true);

    derrubarALeitura();

    expect(await isFlagOn("flag.m4.caderno_erros")).toBe(false);
    expect(await isFlagOn("flag.m4.simulado_semanal")).toBe(false);
    expect(await isFlagOn("flag.m4.diagnostico_adaptativo")).toBe(false);
  });

  it("getParam devolve o default do catalogo quando a leitura falha (AC6)", async () => {
    derrubarALeitura();

    // Parametro e o caso oposto ao da flag: cair no default declarado e
    // exatamente o certo, porque o produto continua funcionando com ele.
    expect(await getParam("param.m4.diagnostico_n_questoes")).toBe(20);
    expect(await getParam("param.m4.minutos_por_questao")).toBe(2);
    expect(await getParam("param.m4.algoritmo_revisao")).toBe("fsrs");
    expect(await getParam("param.m4.fsrs_faixas_nota")).toEqual({
      errei: 0.5,
      dificil: 0.7,
      bom: 0.9,
    });
  });

  it("a falha sai por um ponto unico de reporte, que o Sentry assina no INFRA-09", async () => {
    derrubarALeitura();

    await getParam("param.m4.diagnostico_n_questoes");
    await isFlagOn("flag.m4.caderno_erros");

    // Cair calado seria pior que cair: a superficie some e ninguem fica sabendo.
    expect(reportes).toHaveLength(2);
    for (const reporte of reportes) {
      expect(reporte.erro).toBeInstanceOf(Error);
      expect(reporte.contexto.motivo).toBe("falha ao ler a configuracao");
      expect(reporte.contexto.chaves).toBeDefined();
    }
  });
});

descreveComSupabase("leitor padrao fora de uma requisicao do Next", () => {
  it("le direto do banco em vez de cair no default em silencio", async () => {
    // O `unstable_cache` so vale dentro de uma requisicao. Um teste, um job do
    // GitHub Actions e um script de linha de comando (AD-035/036) rodam fora
    // dela — e e exatamente onde um default engolido em silencio faria o job
    // trabalhar com configuracao errada sem ninguem perceber.
    restaurarLeitorPadrao();

    expect(await getParam("param.m4.diagnostico_n_questoes")).toBe(20);
    expect(await isFlagOn("flag.m4.caderno_erros")).toBe(true);

    // Nao houve falha de leitura: a queda do cache nao e falha de leitura.
    expect(reportes).toEqual([]);
  });
});
