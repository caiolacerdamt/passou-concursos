import { TestRunner } from "vitest";

import { formatarResumoDasConexoes, resumoDasConexoes } from "./conexao";

/** Publica o acumulado por arquivo; a ultima linha e o total do worker unico. */
export default class RunnerDoBanco extends TestRunner {
  override onAfterRunFiles(): void {
    super.onAfterRunFiles();
    const { usos, conexoes } = resumoDasConexoes();
    if (usos > 0) {
      console.info(formatarResumoDasConexoes({ usos, conexoes }));
    }
  }
}
