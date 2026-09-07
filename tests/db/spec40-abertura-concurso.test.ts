import type { Client } from "pg";
import { expect, it } from "vitest";

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
