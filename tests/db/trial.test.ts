import type { Client } from "pg";
import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { comoAluno, criarMatricula, criarUsuario, idDoProduto } from "./conta";
import { descreveComBanco } from "./setup";

/** Carimba o e-mail como confirmado: pre-requisito de `conceder_trial()`. */
async function confirmarEmail(cliente: Client, userId: string): Promise<void> {
  await cliente.query(
    "update auth.users set email_confirmed_at = now() where id = $1",
    [userId],
  );
}

/**
 * Grava um override de configuracao dentro da transacao do teste. Some no
 * rollback, como todo o resto — `configuracoes` e append-only (AD-081).
 */
async function definirConfig(
  cliente: Client,
  chave: string,
  valor: unknown,
  moduloDono: string,
): Promise<void> {
  const autor = await criarUsuario(cliente);
  await cliente.query(
    `insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
     values ($1, $2::jsonb, $3, $4, 'teste do trial')`,
    [chave, JSON.stringify(valor), moduloDono, autor],
  );
}

/** Aluno pronto para receber o trial: existe, com e-mail confirmado. */
async function alunoConfirmado(cliente: Client): Promise<string> {
  const aluno = await criarUsuario(cliente);
  await confirmarEmail(cliente, aluno);
  return aluno;
}

/**
 * O trial **e uma matricula** (AD-133).
 *
 * O que este arquivo prova, e o que ele deliberadamente **nao** prova: nada
 * aqui toca `tem_matricula_ativa()`. A liberacao continua sendo uma pergunta so.
 * O que nasce e uma segunda pergunta, de **escopo**: paga ou trial?
 */
descreveComBanco("trial · produto com prazo em dias e matricula com tipo", () => {
  it("matricula de trial sai com 7 dias e tipo='trial'", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno, {
        produto: "trial-7d",
        inicio_em: "2026-03-01T12:00:00Z",
      });

      expect(matricula.tipo).toBe("trial");
      expect(matricula.fim_em.toISOString()).toBe("2026-03-08T12:00:00.000Z");
    });
  });

  it("a matricula paga continua com 12 meses e tipo='pago'", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno, {
        inicio_em: "2026-03-01T12:00:00Z",
      });

      expect(matricula.tipo).toBe("pago");
      expect(matricula.fim_em.toISOString()).toBe("2027-03-01T12:00:00.000Z");
    });
  });

  it("o tipo vem do produto, nao do que o chamador mandou", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const { rows } = await cliente.query<{ tipo: string }>(
        `insert into public.matriculas (user_id, produto_id, tipo)
         values ($1, $2, 'pago')
         returning tipo::text`,
        [aluno, await idDoProduto(cliente, "trial-7d")],
      );

      expect(rows[0].tipo).toBe("trial");
    });
  });

  it("trocar o tipo de uma matricula existente e recusado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno, { produto: "trial-7d" });

      await expect(
        cliente.query("update public.matriculas set tipo = 'pago' where id = $1", [
          matricula.id,
        ]),
      ).rejects.toThrow(/tipo_de_matricula_e_imutavel/);
    });
  });

  it("produto com os dois prazos, ou com nenhum, e recusado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await cliente.query("savepoint dois_prazos");
      await expect(
        cliente.query(
          `insert into public.produtos (codigo, nome, tipo, meses_de_acesso, dias_de_acesso)
           values ('teste-dois-prazos', 'x', 'pago', 12, 7)`,
        ),
      ).rejects.toThrow(/produtos_prazo_exclusivo/);
      await cliente.query("rollback to savepoint dois_prazos");

      await expect(
        cliente.query(
          `insert into public.produtos (codigo, nome, tipo, meses_de_acesso, dias_de_acesso)
           values ('teste-sem-prazo', 'x', 'pago', null, null)`,
        ),
      ).rejects.toThrow(/produtos_prazo_exclusivo/);
    });
  });

  it("as matriculas que ja existiam ficaram todas com tipo='pago'", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ n: string }>(
        `select count(*)::text as n
           from public.matriculas m
           join public.produtos p on p.id = m.produto_id
          where p.codigo = 'anual-unico' and m.tipo <> 'pago'`,
      );
      expect(rows[0].n).toBe("0");
    });
  });
});

descreveComBanco("trial · conceder_trial e tipo_da_matricula_ativa", () => {
  it("concede uma vez, e a partir dai o aluno tem matricula ativa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await alunoConfirmado(cliente);
      await definirConfig(cliente, "flag.m8.trial_gratuito", true, "m8");

      await comoAluno(cliente, aluno, async () => {
        // Duas consultas, e nao uma: `tem_matricula_ativa()` e `stable`, e no
        // mesmo comando ela nao enxergaria a linha que acabou de nascer.
        const concessao = await cliente.query<{ id: string | null }>(
          "select public.conceder_trial() as id",
        );
        expect(concessao.rows[0].id).not.toBeNull();

        const { rows } = await cliente.query<{ tem: boolean; tipo: string | null }>(
          `select public.tem_matricula_ativa() as tem,
                  public.tipo_da_matricula_ativa()::text as tipo`,
        );
        expect(rows[0].tem).toBe(true);
        expect(rows[0].tipo).toBe("trial");
      });
    });
  });

  it("a segunda chamada recusa: um trial por conta, na vida", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await alunoConfirmado(cliente);
      await definirConfig(cliente, "flag.m8.trial_gratuito", true, "m8");

      await comoAluno(cliente, aluno, async () => {
        await cliente.query("select public.conceder_trial()");
        // O trial ainda esta ativo: `tem_matricula_ativa()` responde antes,
        // e a funcao e idempotente em vez de estourar.
        const { rows } = await cliente.query<{ id: string | null }>(
          "select public.conceder_trial() as id",
        );
        expect(rows[0].id).toBeNull();
      });
    });
  });

  it("trial vencido nao renova: `trial_ja_usado`", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await alunoConfirmado(cliente);
      await definirConfig(cliente, "flag.m8.trial_gratuito", true, "m8");
      await criarMatricula(cliente, aluno, {
        produto: "trial-7d",
        estado: "vencida",
        inicio_em: "2025-01-01T00:00:00Z",
        fim_em: "2025-01-08T00:00:00Z",
      });

      await comoAluno(cliente, aluno, async () => {
        await cliente.query("savepoint ja_usado");
        await expect(
          cliente.query("select public.conceder_trial()"),
        ).rejects.toThrow(/trial_ja_usado/);
        await cliente.query("rollback to savepoint ja_usado");
      });
    });
  });

  /**
   * Defesa em profundidade: se a funcao tiver um bug, o indice recusa mesmo
   * assim. E o que faz a regra durar depois desta sessao.
   */
  it("o banco recusa a segunda matricula de trial mesmo por INSERT direto", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno, {
        produto: "trial-7d",
        estado: "encerrada",
        inicio_em: "2025-01-01T00:00:00Z",
        fim_em: "2025-01-08T00:00:00Z",
      });

      await expect(
        criarMatricula(cliente, aluno, { produto: "trial-7d" }),
      ).rejects.toThrow(/matriculas_um_trial_por_aluno/);
    });
  });

  it("e-mail sem confirmar recusa, e nenhuma linha nasce", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await definirConfig(cliente, "flag.m8.trial_gratuito", true, "m8");

      await comoAluno(cliente, aluno, async () => {
        await cliente.query("savepoint sem_confirmar");
        await expect(
          cliente.query("select public.conceder_trial()"),
        ).rejects.toThrow(/email_nao_confirmado/);
        await cliente.query("rollback to savepoint sem_confirmar");
      });

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*)::text as n from public.matriculas where user_id = $1",
        [aluno],
      );
      expect(rows[0].n).toBe("0");
    });
  });

  /**
   * ⚠️ O valor e escrito **explicitamente** nesta transacao, em vez de contar
   * com a ausencia de linha.
   *
   * Ate 2026-09-03 a chave nao existia no banco de desenvolvimento, e o teste
   * provava as duas coisas de uma vez: que a flag desligada recusa, e que
   * "sem linha" **e** desligada. O AD-134 ligou a flag em producao — e producao
   * e o mesmo banco que os testes usam. Contar com a ausencia parou de ser
   * possivel, e o teste virou vermelho sem nada ter mudado no codigo.
   *
   * O que se perde: o caminho "sem linha nenhuma" nao e mais alcancavel daqui,
   * porque `configuracoes` e append-only e o DELETE e bloqueado por gatilho
   * (AD-081). Quem segura essa metade agora e o `coalesce(..., 'false')` dentro
   * de `conceder_trial()` mais o default declarado no catalogo, coberto por
   * `src/modules/config/catalogo.test.ts`. Registrado, e nao escondido.
   */
  it("flag explicitamente desligada recusa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await alunoConfirmado(cliente);
      await definirConfig(cliente, "flag.m8.trial_gratuito", false, "m8");

      await comoAluno(cliente, aluno, async () => {
        await cliente.query("savepoint desligado");
        await expect(
          cliente.query("select public.conceder_trial()"),
        ).rejects.toThrow(/trial_desligado/);
        await cliente.query("rollback to savepoint desligado");
      });
    });
  });

  it("aluno com matricula paga ativa nao recebe trial e nada e criado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await alunoConfirmado(cliente);
      await definirConfig(cliente, "flag.m8.trial_gratuito", true, "m8");
      await criarMatricula(cliente, aluno);

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ id: string | null; tipo: string }>(
          `select public.conceder_trial() as id,
                  public.tipo_da_matricula_ativa()::text as tipo`,
        );
        expect(rows[0].id).toBeNull();
        expect(rows[0].tipo).toBe("pago");
      });

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*)::text as n from public.matriculas where user_id = $1",
        [aluno],
      );
      expect(rows[0].n).toBe("1");
    });
  });

  /**
   * O contrato nº 11 de novo: nenhuma das duas funcoes ao alcance do aluno
   * aceita o titular de fora. Sobrecarga com argumento faz este teste cair.
   */
  it("conceder_trial e tipo_da_matricula_ativa nao aceitam titular de fora", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ nome: string; args: string }>(
        `select p.proname as nome, pg_get_function_identity_arguments(p.oid) as args
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('conceder_trial', 'tipo_da_matricula_ativa')`,
      );

      expect(rows).toHaveLength(2);
      expect(rows.every((l) => l.args === "")).toBe(true);
    });
  });

  /**
   * Dois valores diferentes, e nao "default vs override": um `10` escrito a mao
   * dentro da funcao passaria num teste que so confere o default. Trocar duas
   * vezes prova que a funcao **le a configuracao**, que e a promessa do AD-078
   * ("troca sem deploy").
   */
  it("o teto diario sai da configuracao, e muda sem deploy", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await definirConfig(cliente, "param.m8.trial_questoes_por_dia", 3, "m8");
      const baixo = await cliente.query<{ n: number }>(
        "select public.trial_questoes_por_dia() as n",
      );
      expect(baixo.rows[0].n).toBe(3);

      await definirConfig(cliente, "param.m8.trial_questoes_por_dia", 42, "m8");
      const alto = await cliente.query<{ n: number }>(
        "select public.trial_questoes_por_dia() as n",
      );
      expect(alto.rows[0].n).toBe(42);
    });
  });
});
