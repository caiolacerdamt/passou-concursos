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

  it("declara as chaves de cada modulo com dono, descricao e o mesmo padrao de chave do banco", () => {
    // Sem contagem fixa de proposito: toda spec nova declara chaves, e um
    // numero cravado aqui so obrigaria a edita-lo — provando nada. O que
    // importa e que nao ha chave repetida e que cada uma esta bem formada.
    expect(new Set(CHAVES).size).toBe(CHAVES.length);
    expect(CHAVES.length).toBeGreaterThan(0);

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
      "flag.m5.raiox",
      "flag.m9.rota_de_erro_proposital",
      "flag.m9.analytics_logado",
    ];
    const parametros: ChaveParam[] = [
      "param.m1.teto_tokens_por_pedido",
      "param.m1.margem_do_teto",
      "param.m1.chars_por_token",
      "param.m1.paginas_por_bloco",
      "param.m1.bucket_de_imagens",
      "param.m1.piso_confianca_ia",
      "param.m1.amostra_qa_real",
      "param.m4.algoritmo_revisao",
      "param.m4.fsrs_faixas_nota",
      "param.m4.minutos_por_questao",
      "param.m4.diagnostico_n_questoes",
      "param.m4.dias_sem_repetir_questao",
      "param.m4.peso_devendo_revisao",
      "param.m4.fsrs_limiar_otimizacao",
      "param.m4.fsrs_passos_curtos",
      "param.m4.regua_fixa_dias",
      "param.m4.questoes_por_bloco",
      "param.m4.fraqueza_por_nivel",
      "param.m4.retencao_historico_cron_dias",
      "param.m5.bancas",
      "param.m5.meia_vida_decaimento_anos",
      "param.m5.amortecimento_k",
      "param.m5.piso_amostra_baixa",
      "param.m5.periodo_tendencia_recente_anos",
      "param.m5.periodo_tendencia_anterior_anos",
      "param.m2.matriz_de_modelos",
      "param.m2.precos_por_modelo",
      "param.m2.teto_gasto_mensal_usd",
      "param.m8.preco_anual_centavos",
      "param.m8.desconto_a_vista_percentual",
      "param.m8.garantia_dias",
      "param.m8.pagamento_pendente_expira_horas",
    ];
    expect([...flags, ...parametros].sort()).toEqual([...CHAVES].sort());

    // Ler chave fora do catalogo e erro de compilacao. Se um dia deixar de ser,
    // o proprio @ts-expect-error passa a falhar e quebra o build.
    // @ts-expect-error chave inexistente
    const inexistente: Chave = "flag.m4.nao_existe";
    expect(typeof inexistente).toBe("string");
  });

  it("mantem piso e amostra dentro de 0..1", () => {
    const piso = CATALOGO["param.m1.piso_confianca_ia"];
    const amostra = CATALOGO["param.m1.amostra_qa_real"];

    expect(piso.padrao).toBe(0.95);
    expect(amostra.padrao).toBe(0.1);
    for (const tipo of [piso.tipo, amostra.tipo]) {
      expect(tipo.safeParse(-0.01).success).toBe(false);
      expect(tipo.safeParse(1.01).success).toBe(false);
      expect(tipo.safeParse(0.5).success).toBe(true);
    }
  });

  it("declara os defaults de calibracao do Raio-X e deixa a tela desligada", () => {
    expect(CATALOGO["flag.m5.raiox"].padrao).toBe(false);
    expect(CATALOGO["param.m5.bancas"].padrao).toEqual([
      "Cesgranrio",
      "FGV",
      "Cebraspe",
    ]);
    expect(CATALOGO["param.m5.meia_vida_decaimento_anos"].padrao).toBe(5);
    expect(CATALOGO["param.m5.amortecimento_k"].padrao).toBe(10);
    expect(CATALOGO["param.m5.piso_amostra_baixa"].padrao).toBe(10);
    expect(CATALOGO["param.m5.periodo_tendencia_recente_anos"].padrao).toBe(3);
    expect(CATALOGO["param.m5.periodo_tendencia_anterior_anos"].padrao).toBe(3);
  });

  it("declara os valores comerciais do funil e a flag logada desligada", () => {
    expect(CATALOGO["param.m8.preco_anual_centavos"].padrao).toBe(19_700);
    expect(CATALOGO["param.m8.desconto_a_vista_percentual"].padrao).toBe(0.1);
    expect(CATALOGO["param.m8.garantia_dias"].padrao).toBe(7);
    expect(CATALOGO["param.m8.pagamento_pendente_expira_horas"].padrao).toBe(48);
    expect(CATALOGO["flag.m9.analytics_logado"].padrao).toBe(false);

    expect(
      CATALOGO["param.m8.desconto_a_vista_percentual"].tipo.safeParse(1.01)
        .success,
    ).toBe(false);
    expect(CATALOGO["param.m8.garantia_dias"].tipo.safeParse(7.5).success).toBe(
      false,
    );
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
