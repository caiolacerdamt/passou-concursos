import { expect, it } from "vitest";

import {
  CONSULTA_DA_BASE_CONFERIDA,
  gravarExplicacaoAprovada,
} from "@/modules/acervo";
import { criarTopico, inserirQuestao } from "./acervo";
import { criarUsuario } from "./conta";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

async function inserirExplicacaoAprovada(
  cliente: Parameters<typeof inserirQuestao>[0],
  questao: { id: string; questao_versao: number },
  alternativa = "C",
): Promise<void> {
  await cliente.query(
    `insert into public.explicacoes
       (questao_id, questao_versao, status, texto, alternativa_correta,
        fontes_citadas, chave_dedup)
     values ($1, $2, 'aprovada', 'explicacao fixture', $3,
             '[{"doc_id":"teste","trecho":"fixture"}]'::jsonb, $4)`,
    [
      questao.id,
      questao.questao_versao,
      alternativa,
      `teste:explicacao:${questao.id}:${questao.questao_versao}`,
    ],
  );
}

async function aprovarRevisao(
  cliente: Parameters<typeof inserirQuestao>[0],
  questao: { id: string; questao_versao: number },
  motivo = "teste",
): Promise<void> {
  const operador = await criarUsuario(cliente);
  const { rows } = await cliente.query<{ id: string }>(
    `select public.enfileirar_questao_revisao(
       $1::uuid, $2::integer, $3::text, 1::smallint, null::text
     ) as id`,
    [questao.id, questao.questao_versao, motivo],
  );
  await cliente.query(
    `select public.registrar_decisao_questao_revisao($1, 'aprovada', $2, 'teste')`,
    [rows[0].id, operador],
  );
}

async function configurarQa(
  cliente: Parameters<typeof inserirQuestao>[0],
  piso: number,
  amostra: number,
): Promise<void> {
  const autor = await criarUsuario(cliente);
  for (const [chave, valor] of [
    ["param.m1.piso_confianca_ia", piso],
    ["param.m1.amostra_qa_real", amostra],
  ] as const) {
    await cliente.query(
      `insert into public.configuracoes
         (chave, valor, modulo_dono, alterado_por, motivo)
       values ($1, to_jsonb($2::numeric), 'm1', $3, 'teste da porta de publicacao')`,
      [chave, valor, autor],
    );
  }
}

descreveComBanco("SPEC 10 — schema da fila, base e explicacoes", () => {
  it("cria as tres tabelas com RLS e sem privilegio do navegador", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: grants } = await cliente.query<{ table_name: string }>(
        `select table_name
           from information_schema.role_table_grants
          where table_schema = 'public'
            and table_name in ('questao_revisoes', 'base_referencia', 'explicacoes')
            and grantee in ('anon', 'authenticated')`,
      );
      expect(grants).toEqual([]);

      const { rows: rls } = await cliente.query<{
        relname: string;
        relrowsecurity: boolean;
      }>(
        `select c.relname, c.relrowsecurity
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname in ('questao_revisoes', 'base_referencia', 'explicacoes')
          order by c.relname`,
      );
      expect(rls).toEqual([
        { relname: "base_referencia", relrowsecurity: true },
        { relname: "explicacoes", relrowsecurity: true },
        { relname: "questao_revisoes", relrowsecurity: true },
      ]);
    });
  });

  it("explicacao e revisao referenciam questao e versao, sem user_id", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        table_name: string;
        column_name: string;
      }>(
        `select table_name, column_name
           from information_schema.columns
          where table_schema = 'public'
            and table_name in ('questao_revisoes', 'base_referencia', 'explicacoes')
            and column_name in ('questao_id', 'questao_versao', 'user_id')
          order by table_name, column_name`,
      );
      expect(rows).toEqual([
        { table_name: "explicacoes", column_name: "questao_id" },
        { table_name: "explicacoes", column_name: "questao_versao" },
        { table_name: "questao_revisoes", column_name: "questao_id" },
        { table_name: "questao_revisoes", column_name: "questao_versao" },
      ]);
    });
  });

  it("recusa explicacao para par de questao-versao inexistente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        cliente.query(
          `insert into public.explicacoes
             (questao_id, questao_versao, texto, alternativa_correta, chave_dedup)
           values (gen_random_uuid(), 1, 'texto', 'A', 'explicacao:inexistente')`,
        ),
      ).rejects.toThrow(/explicacoes_questao_fk|foreign key/i);
    });
  });

  it("exige fonte quando explicacao fica aprovada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      await expect(
        cliente.query(
          `insert into public.explicacoes
             (questao_id, questao_versao, status, texto, alternativa_correta, chave_dedup)
           values ($1, $2, 'aprovada', 'texto', 'A', 'explicacao:sem-fonte')`,
          [questao.id, questao.questao_versao],
        ),
      ).rejects.toThrow(/explicacoes_aprovada_tem_fonte/);
    });
  });

  it("seleciona documento conferido oficial antes de resumo e ignora rascunho", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      const operador = await criarUsuario(cliente);

      await cliente.query(
        `insert into public.base_referencia
           (topico_id, titulo, conteudo, origem, status, conferido_por, conferido_em)
         values ($1, 'Resumo conferido', 'resumo', 'resumo_nosso', 'conferido', $2, now())`,
        [topico, operador],
      );
      await cliente.query(
        `insert into public.base_referencia
           (topico_id, titulo, conteudo, origem, status, conferido_por, conferido_em)
         values ($1, 'Documento oficial', 'oficial', 'oficial', 'conferido', $2, now())`,
        [topico, operador],
      );
      await cliente.query(
        `insert into public.base_referencia (topico_id, titulo, conteudo, origem)
         values ($1, 'Rascunho oficial', 'rascunho', 'oficial')`,
        [topico],
      );

      const { rows } = await cliente.query(CONSULTA_DA_BASE_CONFERIDA, [topico]);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        titulo: "Documento oficial",
        conteudo: "oficial",
        origem: "oficial",
      });
    });
  });

  it("grava explicacao aprovada uma vez pela chave de dedup", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      const entrada = {
        questaoId: questao.id,
        questaoVersao: questao.questao_versao,
        chaveDedup: `explicacao:1:${questao.id}:${questao.questao_versao}`,
        baseReferenciaId: null,
        resultado: {
          texto: "A alternativa C é a correta.",
          alternativa_correta: "C",
          fontes_citadas: [{ doc_id: "minima", trecho: "gabarito oficial" }],
          afirmacoes_externas: [],
        },
      };

      const primeira = await gravarExplicacaoAprovada(cliente, entrada);
      const segunda = await gravarExplicacaoAprovada(cliente, entrada);
      const { rows } = await cliente.query(
        `select count(*)::int as total, max(status::text) as status
           from public.explicacoes where chave_dedup = $1`,
        [entrada.chaveDedup],
      );

      expect(primeira.inserida).toBe(true);
      expect(segunda).toEqual({ inserida: false, id: null });
      expect(rows[0]).toEqual({ total: 1, status: "aprovada" });
    });
  });

  it("enfileira uma pendencia por motivo e eleva a prioridade sem duplicar", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      const primeira = await cliente.query<{ id: string }>(
        `select public.enfileirar_questao_revisao($1, $2, $3, $4, $5) as id`,
        [questao.id, questao.questao_versao, "baixa_confianca", 2, "primeira"],
      );
      const segunda = await cliente.query<{ id: string }>(
        `select public.enfileirar_questao_revisao($1, $2, $3, $4, $5) as id`,
        [questao.id, questao.questao_versao, "baixa_confianca", 8, null],
      );

      expect(segunda.rows[0].id).toBe(primeira.rows[0].id);
      const { rows } = await cliente.query(
        `select status::text, prioridade, observacao, decidido_por, decidida_em
           from public.questao_revisoes where id = $1`,
        [primeira.rows[0].id],
      );
      expect(rows[0]).toMatchObject({
        status: "pendente",
        prioridade: 8,
        observacao: "primeira",
        decidido_por: null,
        decidida_em: null,
      });
    });
  });

  it("registra aprovacao e rejeicao com operador e data, e fecha a pendencia", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      const operador = await criarUsuario(cliente);
      const { rows: criada } = await cliente.query<{ id: string }>(
        `select public.enfileirar_questao_revisao(
           $1::uuid, $2::integer, 'amostra_qa_real'::text, 1::smallint, null::text
         ) as id`,
        [questao.id, questao.questao_versao],
      );

      await cliente.query(
        `select public.registrar_decisao_questao_revisao($1, 'aprovada', $2, 'conferida')`,
        [criada[0].id, operador],
      );
      const { rows: aprovada } = await cliente.query(
        `select status::text, decidido_por, decidida_em, observacao
           from public.questao_revisoes where id = $1`,
        [criada[0].id],
      );
      expect(aprovada[0].status).toBe("aprovada");
      expect(aprovada[0].decidido_por).toBe(operador);
      expect(aprovada[0].decidida_em).not.toBeNull();
      expect(aprovada[0].observacao).toBe("conferida");

      await expect(
        cliente.query(
          `select public.registrar_decisao_questao_revisao($1, 'rejeitada', $2)`,
          [criada[0].id, operador],
        ),
      ).rejects.toThrow(/revisao_nao_esta_pendente/);
    });
  });

  it("bloqueia real de baixa confianca mesmo com explicacao aprovada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await configurarQa(cliente, 0.95, 0);
      const questao = await inserirQuestao(cliente, { confianca_ia: 0.5 });
      await inserirExplicacaoAprovada(cliente, questao);

      await expect(
        cliente.query(
          "update public.questoes set status = 'publicada' where id = $1 and questao_versao = $2",
          [questao.id, questao.questao_versao],
        ),
      ).rejects.toThrow(/questao_exige_revisao_humana/);
    });
  });

  it("bloqueia real de alta confianca quando cai na amostra", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await configurarQa(cliente, 0, 1);
      const questao = await inserirQuestao(cliente, { confianca_ia: 0.99 });
      await inserirExplicacaoAprovada(cliente, questao);

      await expect(
        cliente.query(
          "update public.questoes set status = 'publicada' where id = $1 and questao_versao = $2",
          [questao.id, questao.questao_versao],
        ),
      ).rejects.toThrow(/questao_exige_revisao_humana/);
    });
  });

  it("exige explicacao aprovada antes de publicar real fora da fila", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await configurarQa(cliente, 0, 0);
      const questao = await inserirQuestao(cliente, { confianca_ia: 0.99 });

      await expect(
        cliente.query(
          "select public.publicar_questao($1, $2)",
          [questao.id, questao.questao_versao],
        ),
      ).rejects.toThrow(/explicacao_nao_aprovada/);
    });
  });

  it("publica real depois que explicacao e as exigencias de QA passam", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await configurarQa(cliente, 0, 0);
      const questao = await inserirQuestao(cliente, { confianca_ia: 0.99 });
      await inserirExplicacaoAprovada(cliente, questao);

      const { rows } = await cliente.query<{ publicar_questao: boolean }>(
        "select public.publicar_questao($1, $2)",
        [questao.id, questao.questao_versao],
      );
      expect(rows[0].publicar_questao).toBe(true);

      const { rows: atualizada } = await cliente.query<{ status: string }>(
        "select status::text from public.questoes where id = $1 and questao_versao = $2",
        [questao.id, questao.questao_versao],
      );
      expect(atualizada[0].status).toBe("publicada");
    });
  });

  it("exige revisao para inedita e publica depois da aprovacao humana", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await configurarQa(cliente, 0, 0);
      const questao = await inserirQuestao(cliente, {
        origem: "gerada_ia",
        prova_id: null,
        numero: null,
        fonte_citacao: null,
      });
      await inserirExplicacaoAprovada(cliente, questao);

      await cliente.query("savepoint tentativa_sem_revisao");
      await expect(
        cliente.query("select public.publicar_questao($1, $2)", [questao.id, questao.questao_versao]),
      ).rejects.toThrow(/gerada_ia_passa_por_revisao/);
      await cliente.query("rollback to savepoint tentativa_sem_revisao");

      await aprovarRevisao(cliente, questao, "gerada_ia");
      await cliente.query("select public.publicar_questao($1, $2)", [questao.id, questao.questao_versao]);

      const { rows } = await cliente.query<{ status: string }>(
        "select status::text from public.questoes where id = $1 and questao_versao = $2",
        [questao.id, questao.questao_versao],
      );
      expect(rows[0].status).toBe("publicada");
    });
  });
});
