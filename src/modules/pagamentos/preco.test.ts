import { afterEach, describe, expect, it } from "vitest";

import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";

import {
  PARCELAS_DO_CARTAO,
  calcularPrecosPublicos,
  obterPrecosPublicos,
} from "./preco";

afterEach(() => {
  restaurarLeitorPadrao();
});

describe("precos publicos do funil", () => {
  it("calcula o total a vista e preserva as parcelas do cartao", () => {
    const precos = calcularPrecosPublicos({
      precoAnualCentavos: 19_700,
      descontoAVistaPercentual: 0.1,
      garantiaDias: 7,
    });

    expect(precos.parcelado.totalCentavos).toBe(19_700);
    expect(precos.parcelado.parcelas).toBe(PARCELAS_DO_CARTAO);
    expect(precos.parcelado.parcelaCentavos).toBe(1_642);
    expect(precos.aVista.totalCentavos).toBe(17_730);
    expect(precos.garantiaDias).toBe(7);
    expect(precos.parcelado.totalFormatado).toContain("197,00");
    expect(precos.aVista.totalFormatado).toContain("177,30");
  });

  it("le configuracao e entrega um DTO sem as chaves internas", async () => {
    const leitor: LeitorDeConfig = async () => ({
      "param.m8.preco_anual_centavos": 20_000,
      "param.m8.desconto_a_vista_percentual": 0.2,
      "param.m8.garantia_dias": 5,
    });
    definirLeitorDeConfig(leitor);

    const precos = await obterPrecosPublicos();

    expect(precos.aVista.totalCentavos).toBe(16_000);
    expect(precos.garantiaDias).toBe(5);
    expect(precos).not.toHaveProperty("param.m8.preco_anual_centavos");
    expect(precos).not.toHaveProperty("descontoAVistaPercentual");
  });
});
