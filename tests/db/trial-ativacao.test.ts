import type { Client } from "pg";
import { expect, it, vi } from "vitest";

import { ativarPagamentoConfirmado } from "@/modules/pagamentos/ativacao";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";

import { comTransacaoRevertida } from "./conexao";
import { criarMatricula, criarUsuario, idDoProduto } from "./conta";
import { descreveComBanco } from "./setup";
import { supabaseNaTransacao } from "./supabase-na-transacao";

/**
 * O defeito mais caro do AD-133, montado inteiro contra o banco: aluno com
 * trial ativo paga e precisa sair com **12 meses**, nao com os 7 dias que ja
 * tinha.
 *
 * Duas das dependencias sao as **de verdade** — `buscarMatriculaAtiva` e
 * `criarMatricula`, ligadas na mesma transacao do teste. E o que da ao teste um
 * sensor: tirar o `.eq("tipo", "pago")` do repositorio faz a busca achar o
 * trial, o `??` curto-circuitar e a matricula final continuar de 7 dias.
 */

type Estado = { matriculaVinculada: string | null };

async function pagamentoDeTeste(
  cliente: Client,
  email: string,
): Promise<{ id: string; produtoId: string }> {
  const produtoId = await idDoProduto(cliente, "anual-unico");
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.pagamentos
       (produto_id, email, valor_centavos, meio, parcelas, referencia_interna,
        estado, confirmado_em)
     values ($1, $2, 19700, 'PIX', 1, $3, 'confirmada', now())
     returning id`,
    [produtoId, email, `trial-${crypto.randomUUID()}`],
  );
  return { id: rows[0].id, produtoId };
}

function dependenciasReais(
  cliente: Client,
  pagamento: {
    id: string;
    produtoId: string;
    email: string;
    userId: string;
  },
  estado: Estado,
) {
  const repositorio = criarRepositorioDePagamentos(supabaseNaTransacao(cliente));

  return {
    buscarPagamento: vi.fn(async () => ({
      id: pagamento.id,
      produto_id: pagamento.produtoId,
      email: pagamento.email,
      valor_centavos: 19_700,
      meio: "PIX" as const,
      parcelas: 1,
      referencia_interna: "trial-teste",
      estado: "confirmada",
      asaas_cliente_id: null,
      asaas_cobranca_id: null,
      asaas_parcelamento_id: null,
      asaas_status: null,
      resultado_url: null,
      resultado_boleto_url: null,
      resultado_pix_qr_code: null,
      resultado_pix_copia_e_cola: null,
      user_id: null,
      matricula_id: null,
      confirmado_em: new Date().toISOString(),
      ativado_em: null,
      criado_em: new Date().toISOString(),
    })),
    reservarAtivacao: vi.fn(async () => true),
    buscarUsuario: vi.fn(async () => ({ id: pagamento.userId })),
    criarUsuario: vi.fn(async () => ({ id: pagamento.userId })),
    enviarDefinicaoDeSenha: vi.fn(async () => undefined),
    buscarProduto: vi.fn(async () => ({
      id: pagamento.produtoId,
      codigo: "anual-unico",
      meses_de_acesso: 12,
    })),
    // As duas de verdade.
    buscarMatriculaAtiva: repositorio.buscarMatriculaAtiva,
    criarMatricula: repositorio.criarMatricula,
    vincularPagamento: vi.fn(async (_p: string, _u: string, matriculaId: string) => {
      estado.matriculaVinculada = matriculaId;
    }),
    mudarEstadoAtivado: vi.fn(async () => undefined),
    garantirFatura: vi.fn(async () => undefined),
    marcarFaturaEmitida: vi.fn(async () => undefined),
    marcarFaturaFalha: vi.fn(async () => undefined),
    abrirPendencia: vi.fn(async () => undefined),
    agendarNotaFiscal: vi.fn(async () => ({
      id: "nf_1",
      status: "SCHEDULED",
      externalReference: "trial-teste",
    })),
    donoDoClaim: "teste-trial",
  };
}

type LinhaDeMatricula = {
  id: string;
  tipo: string;
  estado: string;
  meses: number;
};

async function matriculasDoAluno(
  cliente: Client,
  userId: string,
): Promise<LinhaDeMatricula[]> {
  const { rows } = await cliente.query<LinhaDeMatricula>(
    `select id, tipo::text as tipo, estado::text as estado,
            round(extract(epoch from (fim_em - inicio_em)) / 86400)::int as meses
       from public.matriculas
      where user_id = $1
      order by criada_em`,
    [userId],
  );
  return rows;
}

descreveComBanco("trial · a ativacao de quem veio do trial", () => {
  it("trial ativo + pagamento confirmado = matricula paga de 12 meses, trial encerrado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const email = `trial-${crypto.randomUUID()}@exemplo.test`;
      const aluno = await criarUsuario(cliente, email);
      await criarMatricula(cliente, aluno, { produto: "trial-7d" });

      const pagamento = await pagamentoDeTeste(cliente, email);
      const estado: Estado = { matriculaVinculada: null };

      const resultado = await ativarPagamentoConfirmado(
        pagamento.id,
        dependenciasReais(
          cliente,
          { ...pagamento, produtoId: pagamento.produtoId, email, userId: aluno },
          estado,
        ),
      );

      expect(resultado.estado).toBe("ativada");

      const linhas = await matriculasDoAluno(cliente, aluno);
      expect(linhas).toHaveLength(2);

      const trial = linhas.find((l) => l.tipo === "trial");
      const paga = linhas.find((l) => l.tipo === "pago");

      expect(trial?.estado).toBe("encerrada");
      expect(paga?.estado).toBe("ativa");
      // 12 meses em dias: entre 365 e 366, conforme o ano.
      expect(paga?.meses).toBeGreaterThanOrEqual(365);
      // E o pagamento aponta para a **paga**, nao para o trial.
      expect(estado.matriculaVinculada).toBe(paga?.id);
    });
  });

  it("aluno sem trial nenhum segue o caminho de hoje, identico", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const email = `direto-${crypto.randomUUID()}@exemplo.test`;
      const aluno = await criarUsuario(cliente, email);

      const pagamento = await pagamentoDeTeste(cliente, email);
      const estado: Estado = { matriculaVinculada: null };

      await ativarPagamentoConfirmado(
        pagamento.id,
        dependenciasReais(cliente, { ...pagamento, email, userId: aluno }, estado),
      );

      const linhas = await matriculasDoAluno(cliente, aluno);
      expect(linhas).toHaveLength(1);
      expect(linhas[0].tipo).toBe("pago");
      expect(linhas[0].estado).toBe("ativa");
      expect(estado.matriculaVinculada).toBe(linhas[0].id);
    });
  });

  it("segunda passada nao cria matricula nova: a paga ativa e reaproveitada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const email = `repete-${crypto.randomUUID()}@exemplo.test`;
      const aluno = await criarUsuario(cliente, email);
      const paga = await criarMatricula(cliente, aluno);

      const pagamento = await pagamentoDeTeste(cliente, email);
      const estado: Estado = { matriculaVinculada: null };

      await ativarPagamentoConfirmado(
        pagamento.id,
        dependenciasReais(cliente, { ...pagamento, email, userId: aluno }, estado),
      );

      const linhas = await matriculasDoAluno(cliente, aluno);
      expect(linhas).toHaveLength(1);
      expect(estado.matriculaVinculada).toBe(paga.id);
    });
  });

  /**
   * `encerrar_trial_e_matricular` aceita `user_id` por parametro — e por isso
   * ela nunca pode estar ao alcance do aluno. E a excecao que confirma a regra
   * do contrato nº 11.
   */
  it("encerrar_trial_e_matricular so e executavel por service_role", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ papel: string; pode: boolean }>(
        `select papel,
                has_function_privilege(
                  papel,
                  'public.encerrar_trial_e_matricular(uuid, uuid)',
                  'execute') as pode
           from unnest(array['anon', 'authenticated', 'service_role']) as papel`,
      );

      const mapa = Object.fromEntries(rows.map((l) => [l.papel, l.pode]));
      expect(mapa).toEqual({
        anon: false,
        authenticated: false,
        service_role: true,
      });
    });
  });
});
