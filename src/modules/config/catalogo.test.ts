import { describe, expect, it } from "vitest";

import {
  CATALOGO,
  CHAVES,
  type Chave,
  type ChaveFlag,
  type ChaveParam,
  MODULOS,
  PADRAO_DA_CHAVE,
  chavesOrfas,
} from "./catalogo";

describe("catalogo de chaves", () => {
  it("todo default valida contra o tipo declarado da propria chave", () => {
    // O tipo do TypeScript garante o formato; o que ele nao alcanca — .int(),
    // .positive(), faixa 0..1 — so aparece aqui.
    const reprovados = CHAVES.filter(
      (chave) => !CATALOGO[chave].tipo.safeParse(CATALOGO[chave].padrao).success,
    );
    expect(reprovados).toEqual([]);
  });

  it("declara as 10 chaves do M4 com dono, descricao e o mesmo padrao de chave do banco", () => {
    expect(CHAVES).toHaveLength(10);
    expect(CHAVES.filter((c) => CATALOGO[c].moduloDono === "m4")).toHaveLength(10);

    for (const chave of CHAVES) {
      // Mesmo padrao do CHECK chave_com_prefixo_valido da migracao: chave que
      // passa aqui e recusada pelo banco seria descoberta so em producao.
      expect(chave).toMatch(PADRAO_DA_CHAVE);
      expect(MODULOS).toContain(CATALOGO[chave].moduloDono);
      expect(CATALOGO[chave].descricao.length).toBeGreaterThan(20);
    }

    // Flag e parametro se distinguem pelo prefixo, sem uma segunda tabela.
    const flags: ChaveFlag[] = [
      "flag.m4.diagnostico_adaptativo",
      "flag.m4.simulado_semanal",
      "flag.m4.caderno_erros",
    ];
    const parametros: ChaveParam[] = [
      "param.m4.algoritmo_revisao",
      "param.m4.fsrs_faixas_nota",
      "param.m4.minutos_por_questao",
      "param.m4.diagnostico_n_questoes",
      "param.m4.dias_sem_repetir_questao",
      "param.m4.peso_devendo_revisao",
      "param.m4.fsrs_limiar_otimizacao",
    ];
    expect([...flags, ...parametros].sort()).toEqual([...CHAVES].sort());

    // Ler chave fora do catalogo e erro de compilacao. Se um dia deixar de ser,
    // o proprio @ts-expect-error passa a falhar e quebra o build.
    // @ts-expect-error chave inexistente
    const inexistente: Chave = "flag.m4.nao_existe";
    expect(typeof inexistente).toBe("string");
  });

  it("toda flag e booleana e global, sem rollout percentual nem segmentacao (AC4)", () => {
    const flags = CHAVES.filter((chave) => chave.startsWith("flag."));
    expect(flags.length).toBeGreaterThan(0);

    for (const flag of flags) {
      const { tipo, padrao } = CATALOGO[flag];

      // Booleana: nada de porcentagem, lista de aluno ou variante de teste A/B.
      expect(tipo.safeParse(true).success).toBe(true);
      expect(tipo.safeParse(false).success).toBe(true);
      expect(tipo.safeParse(50).success).toBe(false);
      expect(tipo.safeParse("on").success).toBe(false);
      expect(tipo.safeParse({ percentual: 10 }).success).toBe(false);
      expect(typeof padrao).toBe("boolean");
    }
  });

  it("chavesOrfas aponta a chave que o banco tem e o catalogo nao", () => {
    expect(chavesOrfas(CHAVES)).toEqual([]);
    expect(chavesOrfas([])).toEqual([]);
    expect(
      chavesOrfas(["flag.m4.caderno_erros", "param.m4.orfa_de_verdade"]),
    ).toEqual(["param.m4.orfa_de_verdade"]);
    // Chave herdada de Object.prototype nao conta como existente.
    expect(chavesOrfas(["constructor", "toString"])).toEqual([
      "constructor",
      "toString",
    ]);
  });
});
