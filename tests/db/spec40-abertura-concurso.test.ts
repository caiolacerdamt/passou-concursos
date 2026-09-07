import type { Client } from "pg";
import { expect, it } from "vitest";

import {
  acaoDecidirAssuntos,
  acaoDecidirDocumentos,
  acaoPrograma,
  acaoProporAssuntos,
  acaoRegistrarAchados,
  garantirProva,
} from "../../scripts/jobs/abrir-concurso.mts";

import { criarProva, sufixo } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * SPEC 40 — a abertura de concurso, contra o banco.
 *
 * A conversa conduz; o banco e quem **prova**. O eixo daqui e o que a sessao do
 * agente nao consegue garantir sozinha:
 *
 *   ordem       nao se baixa antes de aprovar, nao se aplica edital antes de
 *               aprovar, e nao se pula degrau de estado;
 *   escopo      ID de outra abertura nao decide nada nesta;
 *   autoria     decisao exige operador ativo e cai em `operador_acoes`;
 *   retomada    rodar de novo nao duplica abertura, documento nem assunto.
 */

const MOTIVO = "abertura conduzida na sessao, conferida pelo operador";

/**
 * Roda algo que **precisa** falhar e devolve a transacao ao ponto anterior.
 *
 * Sem o savepoint, o primeiro `raise exception` aborta a transacao inteira e
 * todo `select` seguinte morre com "current transaction is aborted" — o que
 * esconderia justamente a assercao que importa: que o banco nao escreveu nada.
 */
async function recusa(
  cliente: Client,
  sql: string,
  parametros: unknown[],
  padrao: RegExp,
): Promise<void> {
  await cliente.query("savepoint recusa");
  await expect(cliente.query(sql, parametros)).rejects.toThrow(padrao);
  await cliente.query("rollback to savepoint recusa");
}

async function criarOperador(cliente: Client): Promise<string> {
  const operador = await criarUsuario(cliente);
  await cliente.query("insert into public.operadores (operador_id) values ($1)", [operador]);
  return operador;
}

async function criarMateriaComTopicos(
  cliente: Client,
  quantos: number,
): Promise<{ materiaId: string; topicos: string[] }> {
  const { rows: materia } = await cliente.query<{ id: string }>(
    "insert into public.materias (nome) values ($1) returning id",
    [`Materia ${sufixo()}`],
  );
  const topicos: string[] = [];
  for (let i = 0; i < quantos; i += 1) {
    const { rows } = await cliente.query<{ id: string }>(
      "insert into public.topicos (materia_id, nome) values ($1, $2) returning id",
      [materia[0].id, `Topico ${sufixo()}`],
    );
    topicos.push(rows[0].id);
  }
  return { materiaId: materia[0].id, topicos };
}

async function criarConcurso(cliente: Client): Promise<string> {
  const { rows: perfil } = await cliente.query<{ id: string }>(
    `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
     values ($1, 'indefinida', '[]'::jsonb, false) returning id`,
    [`Orgao ${sufixo()}`],
  );
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.concursos (orgao, cargo, perfil_concurso_id)
     values ($1, $2, $3) returning id`,
    [`Orgao ${sufixo()}`, `Cargo ${sufixo()}`, perfil[0].id],
  );
  return rows[0].id;
}

function documento(tipo: "edital" | "prova", sufixoUrl: string) {
  return {
    tipo,
    url: `https://cesgranrio.org.br/${sufixoUrl}.pdf`,
    titulo: `Documento ${sufixoUrl}`,
    metadados: { banca: "Cesgranrio", ano: 2021 },
  };
}

async function registrarAchados(
  cliente: Client,
  abertura: string,
  operador: string,
  documentos: unknown[],
  descartados = 0,
  faltantes: unknown[] = [],
): Promise<number> {
  const { rows } = await cliente.query<{ n: number }>(
    `select public.registrar_documentos_encontrados($1, $2, $3::jsonb, $4, $5::jsonb) as n`,
    [abertura, operador, JSON.stringify(documentos), descartados, JSON.stringify(faltantes)],
  );
  return Number(rows[0].n);
}

async function idsDosDocumentos(cliente: Client, abertura: string): Promise<string[]> {
  const { rows } = await cliente.query<{ id: string }>(
    "select id from public.concurso_documentos where abertura_id = $1 order by registrado_em, url",
    [abertura],
  );
  return rows.map((linha) => linha.id);
}

descreveComBanco("SPEC 40 — a abertura guarda o estado e trava a ordem", () => {
  it("iniciar duas vezes devolve a MESMA abertura: retry nao duplica execucao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);

      const primeira = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      const segunda = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );

      expect(segunda.rows[0].id).toBe(primeira.rows[0].id);

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.aberturas_concurso where concurso_id = $1",
        [concurso],
      );
      expect(Number(rows[0].n)).toBe(1);
    });
  });

  it("quem nao e operador ativo nao inicia, nao registra e nao decide", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const concurso = await criarConcurso(cliente);
      const intruso = await criarUsuario(cliente);

      await recusa(
        cliente,
        "select public.iniciar_abertura($1, $2)",
        [concurso, intruso],
        /operador_nao_autorizado/,
      );

      // Operador revogado tambem para: a allowlist e revogavel (SPEC 15).
      const operador = await criarOperador(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      await cliente.query("update public.operadores set ativo = false where operador_id = $1", [
        operador,
      ]);
      await expect(
        registrarAchados(cliente, rows[0].id, operador, [documento("edital", sufixo())]),
      ).rejects.toThrow(/operador_nao_autorizado/);
    });
  });

  it("registrar a mesma lista duas vezes nao cria documento repetido", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      const abertura = rows[0].id;

      const achados = [documento("edital", "edital-1"), documento("prova", "prova-1")];
      expect(await registrarAchados(cliente, abertura, operador, achados, 7, ["prova 2019"])).toBe(2);
      await registrarAchados(cliente, abertura, operador, achados, 7, ["prova 2019"]);

      expect(await idsDosDocumentos(cliente, abertura)).toHaveLength(2);

      // O descarte e reportado como numero, e nenhuma URL recusada foi gravada.
      const { rows: estado } = await cliente.query<{ descartados: number; faltantes: string[] }>(
        "select descartados, faltantes from public.aberturas_concurso where id = $1",
        [abertura],
      );
      expect(estado[0].descartados).toBe(7);
      expect(estado[0].faltantes).toEqual(["prova 2019"]);
    });
  });

  it("nao se baixa antes de aprovar, e o ID de outra abertura nao decide nesta", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const [conc1, conc2] = [await criarConcurso(cliente), await criarConcurso(cliente)];

      const { rows: a1 } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [conc1, operador],
      );
      const { rows: a2 } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [conc2, operador],
      );

      await registrarAchados(cliente, a1[0].id, operador, [documento("prova", "prova-a")]);
      await registrarAchados(cliente, a2[0].id, operador, [documento("prova", "prova-b")]);

      const [docDaUm] = await idsDosDocumentos(cliente, a1[0].id);
      const [docDaDois] = await idsDosDocumentos(cliente, a2[0].id);

      // Baixar antes da primeira confirmacao: recusado.
      await recusa(
        cliente,
        "select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)",
        [a1[0].id, operador, docDaUm, 1024, "a".repeat(64), null],
        /documento_nao_aprovado/,
      );

      // Decidir com o ID da OUTRA abertura: recusado, e nada e escrito.
      await recusa(
        cliente,
        "select public.decidir_documentos($1, $2, $3::jsonb, $4)",
        [a1[0].id, operador, JSON.stringify([{ id: docDaDois, decisao: "aprovado" }]), MOTIVO],
        /decisao_fora_da_abertura_ou_repetida/,
      );

      const { rows: intacto } = await cliente.query<{ decisao: string }>(
        "select decisao from public.concurso_documentos where id = $1",
        [docDaDois],
      );
      expect(intacto[0].decisao).toBe("pendente");
    });
  });

  it("documento pendente segura a confirmacao: ninguem decide por omissao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      const abertura = rows[0].id;
      await registrarAchados(cliente, abertura, operador, [
        documento("edital", "edital-x"),
        documento("prova", "prova-x"),
      ]);
      const [edital] = await idsDosDocumentos(cliente, abertura);

      await expect(
        cliente.query("select public.decidir_documentos($1, $2, $3::jsonb, $4)", [
          abertura,
          operador,
          JSON.stringify([{ id: edital, decisao: "aprovado" }]),
          MOTIVO,
        ]),
      ).rejects.toThrow(/documentos_pendentes_restantes/);
    });
  });

  it("a prova baixada guarda a URL oficial de origem, e a decisao fica em operador_acoes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      const abertura = rows[0].id;

      await registrarAchados(cliente, abertura, operador, [
        documento("prova", "caderno-1"),
        documento("prova", "de-agregador-nao-chega-aqui"),
      ]);
      const [aprovar, rejeitar] = await idsDosDocumentos(cliente, abertura);

      const { rows: decididos } = await cliente.query<{ n: number }>(
        "select public.decidir_documentos($1, $2, $3::jsonb, $4) as n",
        [
          abertura,
          operador,
          JSON.stringify([
            { id: aprovar, decisao: "aprovado" },
            { id: rejeitar, decisao: "rejeitado" },
          ]),
          MOTIVO,
        ],
      );
      expect(Number(decididos[0].n)).toBe(1);

      const prova = await criarProva(cliente);
      await cliente.query("select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)", [
        abertura,
        operador,
        aprovar,
        2048,
        "b".repeat(64),
        prova,
      ]);
      // Retry do download nao duplica prova nem troca a origem.
      await cliente.query("select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)", [
        abertura,
        operador,
        aprovar,
        2048,
        "b".repeat(64),
        prova,
      ]);

      const { rows: origem } = await cliente.query<{ url_origem: string }>(
        "select url_origem from public.provas where id = $1",
        [prova],
      );
      expect(origem[0].url_origem).toBe("https://cesgranrio.org.br/caderno-1.pdf");

      const { rows: trilha } = await cliente.query<{ tipo: string; motivo: string }>(
        `select tipo, motivo from public.operador_acoes
          where entidade = 'aberturas_concurso' and entidade_id = $1
          order by id`,
        [abertura],
      );
      expect(trilha.map((linha) => linha.tipo)).toEqual([
        "abertura_iniciada",
        "abertura_documentos_decididos",
      ]);
      expect(trilha[1].motivo).toBe(MOTIVO);
    });
  });

  it("o estado so anda um degrau por vez, e nunca para tras", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      const abertura = rows[0].id;

      // Pular de `pesquisa_pendente` direto para o fim.
      await recusa(
        cliente,
        "select public.avancar_abertura($1, $2, 'concluida')",
        [abertura, operador],
        /abertura_fora_de_ordem/,
      );

      // Propor assunto sem ter passado pelos documentos.
      await recusa(
        cliente,
        "select public.registrar_assuntos_propostos($1, $2, $3::jsonb)",
        [
          abertura,
          operador,
          JSON.stringify([{ materia_edital: "Portugues", nome_proposto: "Crase" }]),
        ],
        /abertura_fora_de_ordem/,
      );

      // Repetir o estado atual e retomada, nao erro.
      const { rows: mesmo } = await cliente.query<{ estado: string }>(
        "select public.avancar_abertura($1, $2, 'pesquisa_pendente') as estado",
        [abertura, operador],
      );
      expect(mesmo[0].estado).toBe("pesquisa_pendente");
    });
  });
});

descreveComBanco("SPEC 40 — a segunda confirmacao aplica o edital inteiro ou nada", () => {
  async function ateAssuntosPendentes(
    cliente: Client,
  ): Promise<{ operador: string; concurso: string; abertura: string }> {
    const operador = await criarOperador(cliente);
    const concurso = await criarConcurso(cliente);
    const { rows } = await cliente.query<{ id: string }>(
      "select public.iniciar_abertura($1, $2) as id",
      [concurso, operador],
    );
    const abertura = rows[0].id;

    await registrarAchados(cliente, abertura, operador, [documento("edital", `edital-${sufixo()}`)]);
    const [edital] = await idsDosDocumentos(cliente, abertura);
    await cliente.query("select public.decidir_documentos($1, $2, $3::jsonb, $4)", [
      abertura,
      operador,
      JSON.stringify([{ id: edital, decisao: "aprovado" }]),
      MOTIVO,
    ]);
    await cliente.query("select public.avancar_abertura($1, $2, 'processamento_em_andamento')", [
      abertura,
      operador,
    ]);
    return { operador, concurso, abertura };
  }

  it("mapear, criar, fundir e rejeitar montam o edital numa transacao so", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { operador, concurso, abertura } = await ateAssuntosPendentes(cliente);
      const { materiaId, topicos } = await criarMateriaComTopicos(cliente, 3);
      const [existente, destino, origem] = topicos;

      const propostos = [
        { materia_edital: "Lingua Portuguesa", nome_proposto: "Crase", ordem: 1, topico_id: existente },
        { materia_edital: "Lingua Portuguesa", nome_proposto: "Regencia Nominal", ordem: 2 },
        { materia_edital: "Conhecimentos Bancarios", nome_proposto: "Produtos", ordem: 1 },
        { materia_edital: "Conhecimentos Bancarios", nome_proposto: "Fora do edital", ordem: 2 },
      ];
      const { rows: gravados } = await cliente.query<{ n: number }>(
        "select public.registrar_assuntos_propostos($1, $2, $3::jsonb) as n",
        [abertura, operador, JSON.stringify(propostos)],
      );
      expect(Number(gravados[0].n)).toBe(4);

      // Proposta nao muda edital nenhum enquanto nao ha confirmacao.
      const { rows: antes } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.concurso_materias where concurso_id = $1",
        [concurso],
      );
      expect(Number(antes[0].n)).toBe(0);

      const { rows: linhas } = await cliente.query<{ id: string; nome_proposto: string }>(
        "select id, nome_proposto from public.abertura_assuntos where abertura_id = $1 order by materia_edital, ordem",
        [abertura],
      );
      const porNome = new Map(linhas.map((l) => [l.nome_proposto, l.id]));

      const { rows: aplicados } = await cliente.query<{ n: number }>(
        "select public.decidir_assuntos($1, $2, $3::jsonb, $4::jsonb, $5) as n",
        [
          abertura,
          operador,
          JSON.stringify([
            { id: porNome.get("Crase"), decisao: "mapear", topico_id: existente },
            { id: porNome.get("Regencia Nominal"), decisao: "criar", materia_id: materiaId },
            { id: porNome.get("Produtos"), decisao: "fundir", topico_id: destino, origem_id: origem },
            { id: porNome.get("Fora do edital"), decisao: "rejeitar" },
          ]),
          JSON.stringify([{ materia_id: materiaId, peso_declarado: 20, base: "itens" }]),
          MOTIVO,
        ],
      );
      expect(Number(aplicados[0].n)).toBe(4);

      // Duas materias do edital, tres assuntos mapeados (o rejeitado nao entra).
      const { rows: mapa } = await cliente.query<{ materia: string; topico_id: string }>(
        `select cm.nome as materia, a.topico_id
           from public.concurso_materia_assuntos a
           join public.concurso_materias cm on cm.id = a.concurso_materia_id
          where a.concurso_id = $1`,
        [concurso],
      );
      expect(mapa).toHaveLength(3);
      expect(new Set(mapa.map((l) => l.materia))).toEqual(
        new Set(["Lingua Portuguesa", "Conhecimentos Bancarios"]),
      );
      expect(mapa.map((l) => l.topico_id)).toContain(destino);

      // A fusao usou a funcao da SPEC 37: a origem ficou marcada como fundida.
      const { rows: fundido } = await cliente.query<{ fundido_em_topico_id: string | null }>(
        "select fundido_em_topico_id from public.topicos where id = $1",
        [origem],
      );
      expect(fundido[0].fundido_em_topico_id).toBe(destino);

      // O peso do edital entrou na mesma transacao.
      const { rows: peso } = await cliente.query<{ peso_declarado: string; base: string }>(
        "select peso_declarado, base from public.concurso_peso_materia where concurso_id = $1",
        [concurso],
      );
      expect(peso).toHaveLength(1);
      expect(peso[0].base).toBe("itens");

      const { rows: estado } = await cliente.query<{ estado: string }>(
        "select estado from public.aberturas_concurso where id = $1",
        [abertura],
      );
      expect(estado[0].estado).toBe("pronto_para_recalculo");
    });
  });

  it("uma linha invalida derruba o quadro inteiro: nada do edital fica aplicado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { operador, concurso, abertura } = await ateAssuntosPendentes(cliente);
      const { topicos } = await criarMateriaComTopicos(cliente, 1);

      await cliente.query("select public.registrar_assuntos_propostos($1, $2, $3::jsonb)", [
        abertura,
        operador,
        JSON.stringify([
          { materia_edital: "Matematica", nome_proposto: "Juros", ordem: 1, topico_id: topicos[0] },
          { materia_edital: "Matematica", nome_proposto: "Porcentagem", ordem: 2 },
        ]),
      ]);
      const { rows: linhas } = await cliente.query<{ id: string; nome_proposto: string }>(
        "select id, nome_proposto from public.abertura_assuntos where abertura_id = $1 order by ordem",
        [abertura],
      );

      // A primeira linha e valida; a segunda pede `criar` sem materia canonica.
      await recusa(
        cliente,
        "select public.decidir_assuntos($1, $2, $3::jsonb, $4::jsonb, $5)",
        [
          abertura,
          operador,
          JSON.stringify([
            { id: linhas[0].id, decisao: "mapear", topico_id: topicos[0] },
            { id: linhas[1].id, decisao: "criar" },
          ]),
          JSON.stringify([]),
          MOTIVO,
        ],
        /materia_obrigatoria_para_criar/,
      );

      const { rows: mapa } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.concurso_materia_assuntos where concurso_id = $1",
        [concurso],
      );
      expect(Number(mapa[0].n)).toBe(0);

      const { rows: estado } = await cliente.query<{ estado: string }>(
        "select estado from public.aberturas_concurso where id = $1",
        [abertura],
      );
      expect(estado[0].estado).toBe("assuntos_pendentes");
    });
  });

  it("concluir a abertura nao publica nada: publicar continua exigindo elegibilidade", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { operador, concurso, abertura } = await ateAssuntosPendentes(cliente);
      const { topicos } = await criarMateriaComTopicos(cliente, 1);

      await cliente.query("select public.registrar_assuntos_propostos($1, $2, $3::jsonb)", [
        abertura,
        operador,
        JSON.stringify([
          { materia_edital: "Matematica", nome_proposto: "Juros", ordem: 1, topico_id: topicos[0] },
        ]),
      ]);
      const { rows: linhas } = await cliente.query<{ id: string }>(
        "select id from public.abertura_assuntos where abertura_id = $1",
        [abertura],
      );
      await cliente.query("select public.decidir_assuntos($1, $2, $3::jsonb, $4::jsonb, $5)", [
        abertura,
        operador,
        JSON.stringify([{ id: linhas[0].id, decisao: "mapear", topico_id: topicos[0] }]),
        JSON.stringify([]),
        MOTIVO,
      ]);

      const { rows: fechada } = await cliente.query<{ concurso_id: string }>(
        "select public.concluir_abertura($1, $2, $3) as concurso_id",
        [abertura, operador, MOTIVO],
      );
      expect(fechada[0].concurso_id).toBe(concurso);

      const { rows: visibilidade } = await cliente.query<{ visibilidade: string }>(
        "select visibilidade from public.concursos where id = $1",
        [concurso],
      );
      expect(visibilidade[0].visibilidade).toBe("oculto");

      await recusa(
        cliente,
        "select public.publicar_concurso($1, $2, $3)",
        [concurso, operador, MOTIVO],
        /concurso_nao_elegivel/,
      );

      // Com a execucao fechada, o concurso aceita uma abertura nova.
      const { rows: nova } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      expect(nova[0].id).not.toBe(abertura);
    });
  });
});

descreveComBanco("SPEC 40 — as tabelas da abertura nao sao do navegador", () => {
  it("anon e authenticated nao leem nem escrevem em nenhuma das tres tabelas", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tabela: string; papel: string; privilegio: string }>(
        `select table_name as tabela, grantee as papel, privilege_type as privilegio
           from information_schema.role_table_grants
          where table_schema = 'public'
            and table_name in ('aberturas_concurso', 'concurso_documentos', 'abertura_assuntos')
            and grantee in ('anon', 'authenticated')`,
      );
      expect(rows).toEqual([]);

      const { rows: rls } = await cliente.query<{ relname: string; relrowsecurity: boolean }>(
        `select relname, relrowsecurity from pg_class
          where relname in ('aberturas_concurso', 'concurso_documentos', 'abertura_assuntos')`,
      );
      expect(rls).toHaveLength(3);
      expect(rls.every((linha) => linha.relrowsecurity)).toBe(true);
    });
  });

  it("URL sem HTTPS nao entra na tabela nem por INSERT direto", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );

      await expect(
        cliente.query(
          `insert into public.concurso_documentos (abertura_id, tipo, url, titulo)
           values ($1, 'prova', 'http://cesgranrio.org.br/p.pdf', 'sem tls')`,
          [rows[0].id],
        ),
      ).rejects.toThrow(/concurso_documentos_url_check/);
    });
  });
});

descreveComBanco("SPEC 40 — o CLI da primeira confirmacao, contra o banco", () => {
  const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(32, 0x20)]);

  function respostaPdf(): Response {
    return new Response(new Uint8Array(PDF), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    });
  }

  const DOMINIOS = ["cesgranrio.org.br", "gov.br"];

  const MANIFESTO = {
    candidatos: [
      {
        tipo: "edital" as const,
        url: "https://gov.br/edital.pdf",
        titulo: "Edital de abertura",
        metadados: {},
      },
      {
        tipo: "prova" as const,
        url: "https://cesgranrio.org.br/caderno.pdf",
        titulo: "Caderno 1",
        metadados: {
          banca: "Cesgranrio",
          ano: 2021,
          orgao: `CAIXA ${sufixo()}`,
          cargo: "Tecnico Bancario",
        },
      },
      // Agregador: nao pode chegar a lista de aprovacao.
      {
        tipo: "prova" as const,
        url: "https://agregador-de-questoes.com/caderno.pdf",
        titulo: "mesma prova, fonte ilegal",
        metadados: {
          banca: "Cesgranrio",
          ano: 2021,
          orgao: "CAIXA",
          cargo: "Tecnico Bancario",
        },
      },
    ],
    faltantes: ["prova 2019 do mesmo cargo"],
  };

  it("registra achados, recusa decisao prematura e baixa somente o aprovado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      const abertura = rows[0].id;

      const achados = await acaoRegistrarAchados(
        cliente,
        abertura,
        operador,
        MANIFESTO,
        DOMINIOS,
      );

      // O agregador virou numero; a lista de aprovacao tem dois.
      expect(achados.aceitos).toBe(2);
      expect(achados.descartados).toBe(1);
      expect(achados.documentos).toHaveLength(2);
      expect(JSON.stringify(achados)).not.toContain("agregador-de-questoes");

      // Retomada: rodar de novo devolve o MESMO relatorio, sem duplicar linha.
      const denovo = await acaoRegistrarAchados(
        cliente,
        abertura,
        operador,
        MANIFESTO,
        DOMINIOS,
      );
      expect(denovo.documentos.map((d: { id: string }) => d.id).sort()).toEqual(
        achados.documentos.map((d: { id: string }) => d.id).sort(),
      );

      const edital = achados.documentos.find((d: { tipo: string }) => d.tipo === "edital")!;
      const prova = achados.documentos.find((d: { tipo: string }) => d.tipo === "prova")!;

      // Aprovar so um dos dois nao passa: nada e decidido por omissao.
      await recusa(
        cliente,
        "select public.decidir_documentos($1, $2, $3::jsonb, $4)",
        [abertura, operador, JSON.stringify([{ id: edital.id, decisao: "aprovado" }]), MOTIVO],
        /documentos_pendentes_restantes/,
      );

      const escritos: string[] = [];
      const resumo = await acaoDecidirDocumentos(
        cliente,
        abertura,
        operador,
        [
          { id: edital.id, decisao: "aprovado" },
          { id: prova.id, decisao: "rejeitado" },
        ],
        MOTIVO,
        DOMINIOS,
        {
          destino: "provas",
          escrever: (caminho: string) => escritos.push(caminho),
          buscar: async () => respostaPdf(),
          tetoMib: 25,
        },
      );

      // Um aprovado, um baixado; o rejeitado nao foi buscado.
      expect(resumo.aprovados).toBe(1);
      expect(resumo.baixados).toHaveLength(1);
      expect(resumo.baixados[0].id).toBe(edital.id);
      expect(resumo.baixados[0].prova).toBeNull();
      expect(escritos).toHaveLength(1);
      expect(escritos[0]).toContain(edital.id);

      const { rows: gravado } = await cliente.query<{
        bytes: number;
        sha256: string;
        baixado_em: Date | null;
      }>(
        "select bytes, sha256, baixado_em from public.concurso_documentos where id = $1",
        [edital.id],
      );
      expect(gravado[0].bytes).toBe(PDF.length);
      expect(gravado[0].sha256).toMatch(/^[0-9a-f]{64}$/);

      const { rows: recusado } = await cliente.query<{ baixado_em: Date | null }>(
        "select baixado_em from public.concurso_documentos where id = $1",
        [prova.id],
      );
      expect(recusado[0].baixado_em).toBeNull();
    });
  });

  it("prova aprovada vira linha do catalogo-alvo com a URL de origem, sem duplicar", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );
      const abertura = rows[0].id;

      const orgao = `CAIXA ${sufixo()}`;
      const achados = await acaoRegistrarAchados(
        cliente,
        abertura,
        operador,
        {
          candidatos: [
            {
              tipo: "prova",
              url: "https://cesgranrio.org.br/caderno.pdf",
              titulo: "Caderno 1",
              metadados: { banca: "Cesgranrio", ano: 2021, orgao, cargo: "Tecnico" },
            },
          ],
          faltantes: [],
        },
        DOMINIOS,
      );

      const resumo = await acaoDecidirDocumentos(
        cliente,
        abertura,
        operador,
        [{ id: achados.documentos[0].id, decisao: "aprovado" }],
        MOTIVO,
        DOMINIOS,
        { destino: "provas", escrever: () => {}, buscar: async () => respostaPdf(), tetoMib: 25 },
      );

      expect(resumo.baixados[0].prova).not.toBeNull();

      const { rows: prova } = await cliente.query<{ url_origem: string; ano: number }>(
        "select url_origem, ano from public.provas where id = $1",
        [resumo.baixados[0].prova],
      );
      expect(prova[0].url_origem).toBe("https://cesgranrio.org.br/caderno.pdf");
      expect(prova[0].ano).toBe(2021);

      // A mesma prova numa segunda abertura encontra a linha que ja existe.
      const segunda = await garantirProva(cliente, {
        banca: "Cesgranrio",
        ano: 2021,
        orgao,
        cargo: "Tecnico",
      });
      expect(segunda).toBe(resumo.baixados[0].prova);
    });
  });
});

descreveComBanco("SPEC 40 — o CLI da segunda confirmacao, contra o banco", () => {
  /**
   * Um edital de teste, montado byte a byte.
   *
   * Nao ha PDF de edital real no repositorio, e nem poderia haver: binario de
   * documento oficial nao entra no git. O que precisa ser exercitado aqui e o
   * caminho `disco -> lerPdf -> corte do programa`, e para isso o arquivo
   * precisa ser um PDF de verdade — nao um Buffer qualquer.
   */
  function editalDeTeste(paginas: string[][]): Buffer {
    const pedacos: Buffer[] = [Buffer.from("%PDF-1.7\n", "latin1")];
    const ids = paginas.map((_, i) => 3 + i * 2);

    const objeto = (numero: number, corpo: string, stream?: Buffer) => {
      pedacos.push(Buffer.from(`${numero} 0 obj\n${corpo}\n`, "latin1"));
      if (stream !== undefined) {
        pedacos.push(Buffer.from("stream\n", "latin1"), stream, Buffer.from("\nendstream\n", "latin1"));
      }
      pedacos.push(Buffer.from("endobj\n", "latin1"));
    };

    objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
    objeto(
      2,
      `<< /Type /Pages /Count ${paginas.length} /Kids [${ids.map((id) => `${id} 0 R`).join(" ")}] >>`,
    );
    paginas.forEach((linhas, i) => {
      const stream = Buffer.from(
        linhas
          .map((linha) => `BT /F1 12 Tf (${linha.replace(/([()\\])/g, "\\$1")}) Tj ET`)
          .join("\n"),
        "latin1",
      );
      objeto(ids[i], `<< /Type /Page /Parent 2 0 R /Contents ${ids[i] + 1} 0 R >>`);
      objeto(ids[i] + 1, `<< /Length ${stream.length} >>`, stream);
    });

    pedacos.push(Buffer.from("trailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"));
    return Buffer.concat(pedacos);
  }

  const EDITAL = editalDeTeste([
    ["EDITAL No 1 - ABERTURA", "DAS VAGAS: 100 vagas para o cargo."],
    ["ANEXO I - CONTEUDO PROGRAMATICO", "LINGUA PORTUGUESA: 1 Crase. 2 Regencia verbal e nominal."],
    ["CRONOGRAMA PREVISTO", "Inscricoes de 10/01 a 30/01."],
  ]);

  const PDF_BAIXADO = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(32, 0x20)]);

  /** Leva a abertura ate ter um edital aprovado e baixado. */
  async function ateEditalBaixado(cliente: Client) {
    const operador = await criarOperador(cliente);
    const concurso = await criarConcurso(cliente);
    const { rows } = await cliente.query<{ id: string }>(
      "select public.iniciar_abertura($1, $2) as id",
      [concurso, operador],
    );
    const abertura = rows[0].id;

    const achados = await acaoRegistrarAchados(
      cliente,
      abertura,
      operador,
      {
        candidatos: [
          {
            tipo: "edital",
            url: "https://gov.br/edital.pdf",
            titulo: "Edital de abertura",
            metadados: {},
          },
        ],
        faltantes: [],
      },
      ["gov.br"],
    );

    await acaoDecidirDocumentos(
      cliente,
      abertura,
      operador,
      [{ id: achados.documentos[0].id, decisao: "aprovado" }],
      MOTIVO,
      ["gov.br"],
      {
        destino: "provas",
        escrever: () => {},
        buscar: async () =>
          new Response(new Uint8Array(PDF_BAIXADO), {
            status: 200,
            headers: { "content-type": "application/pdf" },
          }),
        tetoMib: 25,
      },
    );

    return { operador, concurso, abertura, documento: achados.documentos[0].id };
  }

  it("`programa` entrega SO o trecho do programa, lido do disco", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { operador, abertura, documento } = await ateEditalBaixado(cliente);

      const lidos: string[] = [];
      const resultado = await acaoPrograma(cliente, abertura, operador, {
        destino: "provas",
        lerArquivo: (caminho: string) => {
          lidos.push(caminho);
          return EDITAL;
        },
      });

      // O arquivo aberto e o do ID do documento — nunca um nome vindo de fora.
      expect(lidos).toHaveLength(1);
      expect(lidos[0]).toContain(documento);

      expect(resultado.confiavel).toBe(true);
      if (!resultado.confiavel) return;
      expect(resultado.trecho).toContain("Crase");
      expect(resultado.trecho).not.toContain("DAS VAGAS");
      expect(resultado.trecho).not.toContain("CRONOGRAMA");
    });
  });

  it("sem edital aprovado, `programa` recusa em vez de procurar arquivo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarOperador(cliente);
      const concurso = await criarConcurso(cliente);
      const { rows } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [concurso, operador],
      );

      await expect(
        acaoPrograma(cliente, rows[0].id, operador, {
          lerArquivo: () => {
            throw new Error("nao deveria ter tentado ler nada");
          },
        }),
      ).rejects.toThrow(/nenhum edital aprovado/);
    });
  });

  it("a proposta casa o exato, calcula o parecido e NAO muda o edital", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { operador, concurso, abertura } = await ateEditalBaixado(cliente);

      // Uma materia canonica com dois assuntos de nome conhecido.
      const { rows: materia } = await cliente.query<{ id: string; nome: string }>(
        "insert into public.materias (nome) values ($1) returning id, nome",
        [`Portugues ${sufixo()}`],
      );
      const nomeExato = `Crase ${sufixo()}`;
      const { rows: topico } = await cliente.query<{ id: string }>(
        "insert into public.topicos (materia_id, nome) values ($1, $2) returning id",
        [materia[0].id, nomeExato],
      );
      const { rows: parecido } = await cliente.query<{ id: string }>(
        "insert into public.topicos (materia_id, nome) values ($1, $2) returning id",
        [materia[0].id, "Politica Monetaria"],
      );

      await cliente.query("select public.avancar_abertura($1, $2, 'processamento_em_andamento')", [
        abertura,
        operador,
      ]);

      const proposta = await acaoProporAssuntos(cliente, abertura, operador, {
        materias: [
          {
            nome: materia[0].nome,
            ordem: 1,
            peso: { valor: 20, base: "itens" },
            assuntos: [nomeExato, "Politicas Monetarias"],
          },
        ],
      });

      const exato = proposta.linhas.find((l) => l.nomeProposto === nomeExato)!;
      const novo = proposta.linhas.find((l) => l.nomeProposto === "Politicas Monetarias")!;

      // O nome exato casou; ele nao vira pergunta de fusao.
      expect(exato.topicoId).toBe(topico[0].id);
      expect(exato.candidatos).toEqual([]);

      // O quase-duplicado nao casou, e o codigo achou o parecido.
      expect(novo.topicoId).toBeNull();
      expect(novo.candidatos.map((c) => c.topicoId)).toContain(parecido[0].id);

      // O peso foi resolvido para a materia CANONICA de mesmo nome.
      expect(proposta.pesos).toEqual([
        {
          materia_id: materia[0].id,
          materia_nome: materia[0].nome,
          peso_declarado: 20,
          base: "itens",
        },
      ]);
      expect(proposta.pesosSemMateria).toEqual([]);

      // Proposta nao e decisao: o edital do concurso continua vazio.
      const { rows: edital } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.concurso_materia_assuntos where concurso_id = $1",
        [concurso],
      );
      expect(Number(edital[0].n)).toBe(0);

      // ── e agora a segunda confirmacao ───────────────────────────────────
      const resumo = await acaoDecidirAssuntos(
        cliente,
        abertura,
        operador,
        {
          decisoes: [
            { id: exato.id, decisao: "mapear", topico_id: topico[0].id },
            { id: novo.id, decisao: "fundir", topico_id: parecido[0].id, origem_id: topico[0].id },
          ],
          pesos: proposta.pesos,
        },
        MOTIVO,
      );

      expect(resumo.aplicados).toBe(2);
      expect(resumo.pesos).toBe(1);

      const { rows: aplicado } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.concurso_materia_assuntos where concurso_id = $1",
        [concurso],
      );
      expect(Number(aplicado[0].n)).toBeGreaterThan(0);

      const { rows: peso } = await cliente.query<{ base: string }>(
        "select base from public.concurso_peso_materia where concurso_id = $1",
        [concurso],
      );
      expect(peso[0].base).toBe("itens");
    });
  });

  it("peso de materia sem canonica de mesmo nome vira AVISO, e nao estimativa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { operador, abertura } = await ateEditalBaixado(cliente);
      await cliente.query("select public.avancar_abertura($1, $2, 'processamento_em_andamento')", [
        abertura,
        operador,
      ]);

      const proposta = await acaoProporAssuntos(cliente, abertura, operador, {
        materias: [
          {
            nome: `Materia que nao existe ${sufixo()}`,
            ordem: 1,
            peso: { valor: 15, base: "pontos" },
            assuntos: ["Assunto qualquer"],
          },
        ],
      });

      expect(proposta.pesos).toEqual([]);
      expect(proposta.pesosSemMateria).toHaveLength(1);
    });
  });

  it("a segunda confirmacao inteira nao gera UMA chamada de modelo (AD-145)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { operador, abertura } = await ateEditalBaixado(cliente);

      const antes = await cliente.query<{ n: string }>(
        "select count(*) as n from public.ia_geracoes",
      );

      await acaoPrograma(cliente, abertura, operador, {
        destino: "provas",
        lerArquivo: () => EDITAL,
      });
      await cliente.query("select public.avancar_abertura($1, $2, 'processamento_em_andamento')", [
        abertura,
        operador,
      ]);

      const { rows: materia } = await cliente.query<{ id: string; nome: string }>(
        "insert into public.materias (nome) values ($1) returning id, nome",
        [`Materia ${sufixo()}`],
      );
      const proposta = await acaoProporAssuntos(cliente, abertura, operador, {
        materias: [{ nome: materia[0].nome, ordem: 1, assuntos: [`Assunto ${sufixo()}`] }],
      });
      await acaoDecidirAssuntos(
        cliente,
        abertura,
        operador,
        {
          decisoes: [
            { id: proposta.linhas[0].id, decisao: "criar", materia_id: materia[0].id },
          ],
          pesos: [],
        },
        MOTIVO,
      );

      const depois = await cliente.query<{ n: string }>(
        "select count(*) as n from public.ia_geracoes",
      );
      expect(Number(depois.rows[0].n)).toBe(Number(antes.rows[0].n));
    });
  });
});
