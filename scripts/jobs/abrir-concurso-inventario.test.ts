import { describe, expect, it } from "vitest";

import type { ClienteSql } from "@/modules/ia";

import {
  type ProvaDoInventario,
  acaoInventarioLegado,
  faltaParaMedir,
  formatarInventarioLegado,
  lerArgumentos,
  somenteLeitura,
} from "./abrir-concurso.mts";

/**
 * AD-146 T5 — o inventario do acervo legado.
 *
 * Ele existe para ser rodado contra o banco de producao **antes** de qualquer
 * decisao, e por isso o teste central aqui nao e de formatacao: e o cliente que
 * explode ao receber escrita. "Somente leitura" que depende de alguem se lembrar
 * nao e somente leitura.
 */

const CONCURSO = "b3f003a7-7b51-4528-83ac-3f856c9abdc5";

const CABECA = {
  concurso_id: CONCURSO,
  orgao: "Banco do Brasil — Escriturário, Agente Comercial",
  cargo: "indefinido",
  visibilidade: "oculto",
  perfil_id: "4b7eff55-0046-4b35-a4d8-32e5c9600d5e",
  perfil_orgao: "Banco do Brasil — Escriturário, Agente Comercial",
  banca: "Fundação Cesgranrio",
  ativo: true,
  assuntos: 85,
};

function linhaDeProva(dados: Record<string, unknown>) {
  return {
    prova_id: "0f77b220-3274-45dd-93b4-9c2eca060e2e",
    banca: "Fundação Cesgranrio",
    ano: 2023,
    orgao: "Banco do Brasil",
    cargo: "Escriturário - Agente Comercial",
    caderno: "Prova A - Gabarito 1",
    status: "gabarito_cruzado",
    grade_status: "ausente",
    itens_declarados: null,
    caderno_irmao_de: null,
    conferencia_motivo: null,
    url_origem: null,
    blocos: 0,
    vigentes: 70,
    publicadas: 69,
    etiquetas: 0,
    medidos: 69,
    cobertura: null,
    vinculada: false,
    ...dados,
  };
}

/** Banco falso; `provas` sao as linhas cruas como o SQL as devolve. */
function banco(provas: Record<string, unknown>[], cabeca = CABECA) {
  const consultas: string[] = [];
  const cliente = {
    async query(texto: string) {
      consultas.push(texto);
      if (texto.includes("from public.concursos c")) return { rows: [cabeca] };
      if (texto.includes("from public.provas p")) return { rows: provas };
      if (texto.includes("configuracoes")) {
        return { rows: [{ chave: "param.m1.cobertura_minima", valor: 0.9 }] };
      }
      return { rows: [] };
    },
  };
  return { cliente: cliente as unknown as ClienteSql, consultas };
}

const SEM_CONFIG = { pasta: "pasta-de-teste", listarPasta: () => [] as string[] };

describe("somenteLeitura", () => {
  const alvo = { async query() { return { rows: [] }; } } as unknown as ClienteSql;

  it("deixa passar select e with", async () => {
    await expect(somenteLeitura(alvo).query("select 1")).resolves.toBeDefined();
    await expect(
      somenteLeitura(alvo).query("  with x as (select 1) select * from x"),
    ).resolves.toBeDefined();
  });

  it("recusa insert, update, delete e chamada de funcao que escreve", async () => {
    const cliente = somenteLeitura(alvo);
    for (const sql of [
      "insert into public.concurso_provas values (1)",
      "update public.provas set orgao = 'x'",
      "delete from public.questoes",
      "truncate public.etiquetas_de_item",
      "select public.vincular_prova_ao_concurso($1,$2,$3,$4); insert into x values (1)",
    ]) {
      if (sql.startsWith("select")) continue;
      await expect(cliente.query(sql)).rejects.toThrow(/somente leitura/);
    }
  });
});

describe("acaoInventarioLegado", () => {
  it("nao emite uma unica consulta de escrita", async () => {
    const { cliente, consultas } = banco([linhaDeProva({})]);

    await acaoInventarioLegado(cliente, CONCURSO, SEM_CONFIG);

    expect(consultas.length).toBeGreaterThan(0);
    for (const sql of consultas) {
      expect(sql.trimStart().slice(0, 6).toLowerCase()).toMatch(/^(select|with)/);
    }
  });

  it("marca orgao parecido como sugestao e nao decide por cargo", async () => {
    const { cliente } = banco([
      linhaDeProva({}),
      linhaDeProva({
        prova_id: "03eef111-9c8c-478b-9522-317db20e929a",
        orgao: "CAIXA",
        cargo: "Escriturário - Agente Comercial",
      }),
    ]);

    const inventario = await acaoInventarioLegado(cliente, CONCURSO, SEM_CONFIG);

    // "Banco do Brasil" e prefixo de "Banco do Brasil — Escriturário, ...":
    // sugestao. "CAIXA" nao e, mesmo com o cargo identico.
    expect(inventario.provas[0].orgaoParecido).toBe(true);
    expect(inventario.provas[1].orgaoParecido).toBe(false);
  });

  it("aponta duplicidade de chave sem fundir nada", async () => {
    const { cliente } = banco([
      linhaDeProva({ prova_id: "com-questoes", ano: 2021, banca: "Fundação Cesgranrio", vigentes: 70 }),
      linhaDeProva({ prova_id: "sem-questoes", ano: 2021, banca: "Cesgranrio", vigentes: 0, publicadas: 0, medidos: 0 }),
      linhaDeProva({ prova_id: "sozinha", ano: 2018, caderno: "Gabarito 1" }),
    ]);

    const inventario = await acaoInventarioLegado(cliente, CONCURSO, SEM_CONFIG);

    expect(inventario.duplicidades).toEqual([
      {
        chave: "2021 · Banco do Brasil · Prova A - Gabarito 1",
        provas: ["com-questoes", "sem-questoes"],
      },
    ]);
    expect(formatarInventarioLegado(inventario)).toContain("NADA foi fundido");
  });

  it("lista arquivo local como candidato pelo nome, e nunca como procedencia", async () => {
    const { cliente } = banco([linhaDeProva({})]);

    const inventario = await acaoInventarioLegado(cliente, CONCURSO, {
      pasta: "fontes/entrada",
      listarPasta: () => ["bb-2023-prova-a.pdf", "leia-me.txt"],
    });

    expect(inventario.arquivosLocais.arquivos).toEqual([
      "bb-2023-prova-a.pdf",
      "leia-me.txt",
    ]);
    expect(formatarInventarioLegado(inventario)).toContain("NAO CONFIRMADOS");
  });
});

describe("faltaParaMedir", () => {
  const base: ProvaDoInventario = {
    provaId: "p1",
    banca: "Fundação Cesgranrio",
    ano: 2023,
    orgao: "Banco do Brasil",
    cargo: "Escriturário - Agente Comercial",
    caderno: null,
    status: "gabarito_cruzado",
    gradeStatus: "ausente",
    blocos: 0,
    itensDeclarados: null,
    questoesVigentes: 70,
    questoesPublicadas: 70,
    etiquetas: 0,
    itensMedidos: 70,
    cobertura: null,
    cadernoIrmaoDe: null,
    conferenciaMotivo: null,
    urlOrigem: null,
    vinculada: false,
    orgaoParecido: true,
  };

  it("o retrato do BB hoje: falta vinculo e falta grade", () => {
    expect(faltaParaMedir(base, 0.9)).toEqual([
      "vincular ao concurso (lastro proprio)",
      "grade ausente: rodar `medir-prova --acao grade` com o PDF oficial",
    ]);
  });

  it("com grade lida e cobertura cheia, nao falta nada", () => {
    expect(
      faltaParaMedir(
        { ...base, vinculada: true, gradeStatus: "lida", itensDeclarados: 70, cobertura: 1 },
        0.9,
      ),
    ).toEqual(["nada: esta prova ja pode entrar no Raio-X"]);
  });

  it("conta os itens que faltam e compara com o piso", () => {
    const falta = faltaParaMedir(
      {
        ...base,
        vinculada: true,
        gradeStatus: "lida",
        itensDeclarados: 70,
        itensMedidos: 40,
        cobertura: 0.5714,
      },
      0.9,
    );

    expect(falta).toContain("30 item(ns) sem medicao efetiva");
    expect(falta.some((f) => f.includes("abaixo do piso de 90%"))).toBe(true);
  });
});

describe("lerArgumentos com inventario-legado", () => {
  it("exige o concurso e dispensa operador e abertura", () => {
    const argumentos = lerArgumentos(["--acao", "inventario-legado", "--concurso", CONCURSO]);

    expect(argumentos.acao).toBe("inventario-legado");
    expect(argumentos.concurso).toBe(CONCURSO);
    expect(argumentos.operador).toBe("");
  });

  it("recusa sem concurso: inventario de coisa nenhuma nao existe", () => {
    expect(() => lerArgumentos(["--acao", "inventario-legado"])).toThrow(/--concurso/);
  });
});
