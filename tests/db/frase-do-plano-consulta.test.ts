import { expect, it } from "vitest";

import {
  CONSULTA_DOS_BLOCOS,
  CONSULTA_DOS_PLANOS,
} from "../../scripts/jobs/frase-do-plano.mts";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * A consulta do job da frase contra o banco de verdade (gap G1 da verificação
 * independente da SPEC 08).
 *
 * **Por que este arquivo existe.** O teste unitário do job usa um banco de
 * mentira que devolve as linhas que recebeu, qualquer que seja a consulta —
 * então ele continuaria verde se `pd.frase is null` fosse apagado do SQL. O que
 * restava como prova era uma asserção de substring no texto da consulta, que
 * trava o texto mas não executa a cláusula. É o mesmo padrão dos gaps G2/G8 da
 * SPEC 05: teste que passa sem provar nada.
 *
 * Aqui a cláusula é **executada**. Se ela sair do SQL, este teste fica vermelho,
 * e é ele que segura as duas metades do Success Criterion 4 — não regerar frase
 * já escrita é o mesmo que não pagar por ela de novo, porque plano que não
 * aparece na consulta não vira chamada de IA.
 */
descreveComBanco("consulta do job da frase (SPEC 08, SC4)", () => {
  /**
   * ⚠️ As duas asserções abaixo olham **só as linhas que este teste criou**, e
   * não a contagem total da consulta.
   *
   * `CONSULTA_DOS_PLANOS` é global por natureza — ela varre `plano_dia` inteiro,
   * que é o que o job faz. Contar o resultado inteiro só funcionava enquanto o
   * banco de desenvolvimento não tinha aluno nenhum com plano de hoje. Em
   * 2026-09-04 passou a ter: a conta de trial do AD-134 gerou um plano real, e
   * os dois testes viraram vermelho sem nada ter mudado no código do job.
   *
   * É a mesma armadilha que `comTransacaoSemPerfilConcurso` documenta em
   * `conexao.ts`. Filtrar pelos próprios ids não enfraquece a prova: se
   * `pd.frase is null` ou `pd.data = current_date` saírem do SQL, a linha que
   * não devia aparecer aparece, e o teste cai igual.
   */
  it("ignora o plano de hoje que **já tem** frase", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: criados } = await cliente.query<{ id: string }>(
        `insert into public.plano_dia (user_id, data, frase)
         values (gen_random_uuid(), current_date, 'frase de ontem, ja escrita'),
                (gen_random_uuid(), current_date, null)
         returning id, frase`,
      );
      expect(criados).toHaveLength(2);

      const { rows } = await cliente.query<{ id: string }>(CONSULTA_DOS_PLANOS);
      const encontrados = new Set(rows.map((l) => l.id));

      // O plano com frase existe, é de hoje, e mesmo assim não pode aparecer.
      expect(encontrados.has(criados[0].id)).toBe(false);
      // O sem frase, do mesmo dia, precisa aparecer.
      expect(encontrados.has(criados[1].id)).toBe(true);
    });
  });

  it("ignora o plano sem frase que **não é de hoje**", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: criados } = await cliente.query<{ id: string }>(
        `insert into public.plano_dia (user_id, data, frase)
         values (gen_random_uuid(), current_date - 1, null),
                (gen_random_uuid(), current_date + 1, null)
         returning id`,
      );

      const { rows } = await cliente.query<{ id: string }>(CONSULTA_DOS_PLANOS);
      const encontrados = new Set(rows.map((l) => l.id));

      // Ontem e amanhã, os dois sem frase: nenhum dos dois é do dia do job.
      expect(encontrados.has(criados[0].id)).toBe(false);
      expect(encontrados.has(criados[1].id)).toBe(false);
    });
  });

  it("traz o tempo declarado quando há perfil, e nulo quando não há", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: comPerfil } = await cliente.query<{ id: string }>(
        `with aluno as (
           insert into public.perfil_estudo (user_id, minutos_por_dia)
           values (gen_random_uuid(), 45) returning user_id
         )
         insert into public.plano_dia (user_id, data, frase)
         select user_id, current_date, null from aluno
         returning id`,
      );
      await cliente.query(
        `insert into public.plano_dia (user_id, data, frase)
         values (gen_random_uuid(), current_date, null)`,
      );

      const { rows } = await cliente.query<{
        id: string;
        minutos_por_dia: number | null;
      }>(CONSULTA_DOS_PLANOS);

      const doAluno = rows.find((l) => l.id === comPerfil[0].id);
      const semPerfil = rows.find((l) => l.id !== comPerfil[0].id);

      expect(doAluno?.minutos_por_dia).toBe(45);
      // Aluno sem perfil ainda entra: o `left join` é o que impede o plano de
      // sumir por causa de um cadastro incompleto.
      expect(semPerfil).toBeDefined();
      expect(semPerfil?.minutos_por_dia).toBeNull();
    });
  });

  it("a consulta dos blocos traz só a meta cheia, na ordem", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: plano } = await cliente.query<{ id: string }>(
        `insert into public.plano_dia (user_id, data, frase)
         values (gen_random_uuid(), current_date, null) returning id`,
      );
      const planoId = plano[0].id;

      await cliente.query(
        `insert into public.plano_bloco
           (plano_dia_id, tipo, nivel, ordem, minutos_estimados, motivo)
         values ($1, 'treinar', 'meta_cheia', 2, 20, null),
                ($1, 'revisar', 'meta_cheia', 1, 20, 'revisao vencida'),
                ($1, 'revisar', 'piso',       1, 20, 'so o piso')`,
        [planoId],
      );

      const { rows } = await cliente.query<{ tipo: string; motivo: string | null }>(
        CONSULTA_DOS_BLOCOS,
        [[planoId]],
      );

      // O `piso` fica de fora: a frase descreve o dia cheio, não o mínimo.
      expect(rows.map((l) => l.tipo)).toEqual(["revisar", "treinar"]);
      expect(rows[0].motivo).toBe("revisao vencida");
    });
  });
});
