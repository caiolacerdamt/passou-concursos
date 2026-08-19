import { expect, it } from "vitest";

import { inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * Privilegios e RLS das cinco tabelas do acervo.
 *
 * A postura e a mesma da SPEC 02: **RLS ligada, nenhuma policy**. Nao existe
 * `matricula` (SPEC 17) nem tela (SPEC 22) para escrever uma policy honesta hoje,
 * e o acervo e o fosso do produto — `enunciado` mais `resposta_correta` de tudo.
 * A policy de leitura entra junto de quem precisa dela.
 */

const TABELAS = [
  "materias",
  "topicos",
  "topico_candidato",
  "provas",
  "questoes",
] as const;

descreveComBanco("privilegios do acervo", () => {
  it("as cinco tabelas tem RLS ligada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tabela: string; rls: boolean }>(
        `select c.relname as tabela, c.relrowsecurity as rls
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = any($1)`,
        [TABELAS],
      );

      expect(rows).toHaveLength(TABELAS.length);
      expect(rows.filter((l) => !l.rls)).toEqual([]);
    });
  });

  it("a unica policy do acervo e a da matricula (SPEC 07 · PAG-01)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        tablename: string;
        cmd: string;
        roles: string;
        qual: string | null;
      }>(
        `select tablename, cmd, roles::text as roles, qual
           from pg_policies
          where schemaname = 'public' and tablename = any($1)
          order by tablename`,
        [TABELAS],
      );

      // Ate a SPEC 07 este teste exigia ZERO policy — nao havia matricula nem
      // tela para escrever uma policy honesta. Agora ha exatamente uma por
      // tabela de conteudo, e ela e a mesma pergunta: `tem_matricula_ativa()`.
      // `topico_candidato` continua sem nenhuma: e fila de curadoria, nao
      // conteudo do aluno.
      expect(rows.map((l) => l.tablename)).toEqual([
        "materias",
        "provas",
        "questoes",
        "topicos",
      ]);

      for (const linha of rows) {
        // RLS ligada com policy permissiva seria pior que RLS desligada:
        // pareceria fechada no inventario e estaria aberta. A trava e o `qual`.
        expect({ tabela: linha.tablename, cmd: linha.cmd, roles: linha.roles }).toEqual({
          tabela: linha.tablename,
          cmd: "SELECT",
          roles: "{authenticated}",
        });
        expect(linha.qual).toContain("tem_matricula_ativa");
      }
    });
  });

  it("anon e authenticated nao tem privilegio de escrita nem TRUNCATE", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const papel of ["anon", "authenticated"]) {
        for (const tabela of TABELAS) {
          const { rows } = await cliente.query<{
            insere: boolean;
            atualiza: boolean;
            apaga: boolean;
            trunca: boolean;
          }>(
            `select has_table_privilege($1, $2, 'INSERT')   as insere,
                    has_table_privilege($1, $2, 'UPDATE')   as atualiza,
                    has_table_privilege($1, $2, 'DELETE')   as apaga,
                    has_table_privilege($1, $2, 'TRUNCATE') as trunca`,
            [papel, `public.${tabela}`],
          );

          expect({ papel, tabela, ...rows[0] }).toEqual({
            papel,
            tabela,
            insere: false,
            atualiza: false,
            apaga: false,
            trunca: false,
          });
        }
      }
    });
  });

  it("por tentativa real: o navegador nao le uma questao que existe", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, {
        status: "publicada",
        resposta_correta: "C",
      });

      // Controle: a linha existe. Sem ele, "ninguem ve" passaria numa tabela
      // vazia. Conferir por tentativa e mais forte que conferir o `grant`.
      const comoServidor = await cliente.query(
        "select 1 from public.questoes where id = $1",
        [id],
      );
      expect(comoServidor.rowCount).toBe(1);

      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint navegador");
        await cliente.query(`set local role ${papel}`);

        const leitura = await cliente.query(
          "select 1 from public.questoes where id = $1",
          [id],
        );
        expect(leitura.rowCount).toBe(0);

        await cliente.query("rollback to savepoint navegador");
      }
    });
  });

  it("nenhuma tabela do acervo tem coluna user_id: nao e grupo 1", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tabela: string; coluna: string }>(
        `select c.relname as tabela, a.attname as coluna
           from pg_attribute a
           join pg_class c on c.oid = a.attrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = any($1)
            and a.attname = 'user_id' and a.attnum > 0`,
        [TABELAS],
      );

      // Regra 3 do ROADMAP: tabela com `user_id` e grupo 1 e entra na rotina de
      // esquecimento da SPEC 32. Nenhuma daqui e — `decidido_por` aponta para o
      // operador, nao para o aluno. Se uma spec futura acrescentar `user_id`
      // aqui, este teste vira vermelho e obriga a decisao consciente.
      expect(rows).toEqual([]);
    });
  });

  it("as funcoes de gatilho do acervo tem search_path fixo (AD-084)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ funcao: string; config: string[] | null }>(
        `select p.proname as funcao, p.proconfig as config
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname like 'questoes_%'`,
      );

      // O Postgres guarda o valor literal `search_path=""` em `proconfig`.
      expect(rows.length).toBeGreaterThanOrEqual(3);
      for (const linha of rows) {
        expect(linha.config).toContain('search_path=""');
      }
    });
  });
});
