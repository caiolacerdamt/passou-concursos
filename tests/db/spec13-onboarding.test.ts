import { expect, it } from "vitest";

import { inserirQuestao } from "./acervo";
import { comoAluno, criarMatricula, criarUsuario } from "./conta";
import { comTransacaoRevertida } from "./conexao";
import { novoAluno, recusa } from "./aluno";
import { descreveComBanco } from "./setup";

descreveComBanco("SPEC 13 — onboarding, retomada e explicacao publica", () => {
  it("fecha o contrato novo do perfil e da retomada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const colunas = await cliente.query<{
        table_name: string;
        column_name: string;
      }>(
        `select table_name, column_name
           from information_schema.columns
          where table_schema = 'public'
            and ((table_name = 'perfil_estudo' and column_name in
              ('concurso_alvo', 'dias_estudo', 'horario_estudo', 'onboarding_concluido'))
              or (table_name = 'sessoes' and column_name = 'plano_bloco_id'))
          order by table_name, column_name`,
      );

      expect(colunas.rows).toEqual([
        { table_name: "perfil_estudo", column_name: "concurso_alvo" },
        { table_name: "perfil_estudo", column_name: "dias_estudo" },
        { table_name: "perfil_estudo", column_name: "horario_estudo" },
        { table_name: "perfil_estudo", column_name: "onboarding_concluido" },
        { table_name: "sessoes", column_name: "plano_bloco_id" },
      ]);

      const aluno = novoAluno();
      await cliente.query(
        `insert into public.perfil_estudo
           (user_id, nivel_declarado, minutos_por_dia, concurso_alvo,
            dias_estudo, horario_estudo, onboarding_concluido)
         values ($1, 'iniciante', 45, 'Banco do Brasil', $2, '20:00', true)`,
        [aluno, [1, 2, 3, 4, 5]],
      );

      await recusa(
        cliente,
        () =>
          cliente.query(
            `insert into public.perfil_estudo
               (user_id, nivel_declarado, minutos_por_dia, dias_estudo)
             values ($1, 'iniciante', 45, $2)`,
            [crypto.randomUUID(), [7]],
          ),
        /perfil_dias_estudo_validos/,
      );

      const { rows: plano } = await cliente.query<{ id: string }>(
        "insert into public.plano_dia (user_id, data) values ($1, current_date) returning id",
        [aluno],
      );
      const { rows: bloco } = await cliente.query<{ id: string }>(
        `insert into public.plano_bloco
           (plano_dia_id, tipo, nivel, ordem, minutos_estimados)
         values ($1, 'treinar', 'meta_cheia', 1, 20) returning id`,
        [plano[0].id],
      );
      const { rows: sessao } = await cliente.query<{ id: string }>(
        `insert into public.sessoes (user_id, contexto, plano_dia_id, plano_bloco_id)
         values ($1, 'plano', $2, $3) returning id`,
        [aluno, plano[0].id, bloco[0].id],
      );

      await recusa(
        cliente,
        () =>
          cliente.query(
            `insert into public.sessoes (user_id, contexto, plano_dia_id, plano_bloco_id)
             values ($1, 'plano', $2, $3)`,
            [aluno, plano[0].id, bloco[0].id],
          ),
        /sessoes_uma_aberta_por_bloco/,
      );

      await cliente.query("delete from public.plano_bloco where id = $1", [bloco[0].id]);
      const viva = await cliente.query<{ plano_bloco_id: string | null }>(
        "select plano_bloco_id from public.sessoes where id = $1",
        [sessao[0].id],
      );
      expect(viva.rows[0].plano_bloco_id).toBeNull();
    });
  });

  it("RPC entrega somente explicacao aprovada e vigente ao aluno matriculado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno);

      await cliente.query(
        `insert into public.explicacoes
           (questao_id, questao_versao, status, texto, alternativa_correta,
            fontes_citadas, chave_dedup)
         values ($1, $2, 'aprovada', 'Explicacao conferida', 'C',
                 '[{"doc_id":"prova","trecho":"trecho oficial"}]',
                 'spec13:explicacao:aprovada')`,
        [questao.id, questao.questao_versao],
      );

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{
          texto: string;
          alternativa_correta: string;
          fontes_citadas: unknown;
        }>(
          "select * from public.ler_explicacao_publica($1, $2)",
          [questao.id, questao.questao_versao],
        );

        expect(rows).toEqual([
          {
            texto: "Explicacao conferida",
            alternativa_correta: "C",
            fontes_citadas: [{ doc_id: "prova", trecho: "trecho oficial" }],
          },
        ]);
      });

      await cliente.query(
        "update public.explicacoes set vigente = false, status = 'invalidada' where questao_id = $1",
        [questao.id],
      );

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query(
          "select * from public.ler_explicacao_publica($1, $2)",
          [questao.id, questao.questao_versao],
        );
        expect(rows).toEqual([]);
      });
    });
  });

  it("RPC nao entrega explicacao a aluno sem matricula", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      await cliente.query(
        `insert into public.explicacoes
           (questao_id, questao_versao, status, texto, alternativa_correta,
            fontes_citadas, chave_dedup)
         values ($1, $2, 'aprovada', 'Explicacao', 'C',
                 '[{"doc_id":"prova","trecho":"trecho"}]',
                 'spec13:explicacao:sem-matricula')`,
        [questao.id, questao.questao_versao],
      );
      const aluno = await criarUsuario(cliente);

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query(
          "select * from public.ler_explicacao_publica($1, $2)",
          [questao.id, questao.questao_versao],
        );
        expect(rows).toEqual([]);
      });
    });
  });
});
