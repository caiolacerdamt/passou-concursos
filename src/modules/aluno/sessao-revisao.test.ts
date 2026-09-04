import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  getParams: vi.fn(),
  getParam: vi.fn(),
  servico: vi.fn(),
}));

vi.mock("@/modules/config", () => ({
  getParams: dependencias.getParams,
  getParam: dependencias.getParam,
}));
vi.mock("@/lib/db/servidor", () => ({
  clienteDeServico: dependencias.servico,
}));

import { prepararSessaoDeRevisao } from "./sessao";

const TOPICO = "11111111-1111-4111-8111-111111111111";
const HOJE = "2026-08-31";

function questao(sobrescreve: Record<string, unknown> = {}) {
  return {
    id: "questao-1",
    questao_versao: 1,
    origem: "real" as const,
    topico_id: TOPICO,
    tipo_questao: "multipla_escolha" as const,
    enunciado: "Qual alternativa está correta?",
    alternativas: [
      { letra: "A", texto: "Primeira" },
      { letra: "B", texto: "Segunda" },
    ],
    imagens: [],
    fonte_citacao: null,
    status: "publicada",
    vigente: true,
    anulada: false,
    ...sobrescreve,
  };
}

function construtor(resposta: { data: unknown; error: null | { message: string; code?: string } }) {
  const builder: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "is", "order", "limit", "not", "lte", "in"]) {
    builder[metodo] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => resposta);
  builder.single = vi.fn(async () => resposta);
  builder.then = (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
    Promise.resolve(resposta).then(resolve, reject);
  return builder;
}

function clienteParaRevisao({
  agenda = { topico_id: TOPICO },
  aberta = null,
  itensDaAberta = [],
  questoes = [questao()],
  inserir = { data: { id: "sessao-revisao" }, error: null },
}: {
  agenda?: Record<string, unknown> | null;
  aberta?: Record<string, unknown> | null;
  itensDaAberta?: unknown[];
  questoes?: unknown[];
  inserir?: { data: unknown; error: null | { message: string; code?: string } };
} = {}) {
  const insercoes: Array<{ tabela: string; valores: unknown }> = [];
  // A sessão recém-criada é lida uma vez por `garantirItensDaRefacao`; a
  // primeira leitura de `sessao_itens` é a da sessão aberta anterior.
  const leiturasDeItens: unknown[][] = [itensDaAberta, []];

  const cliente = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "aluno-1" } }, error: null }),
    },
    // Sem teto: o aluno destes testes tem matricula paga (AD-133).
    rpc: vi.fn(async (): Promise<{ data: number | null; error: null }> => ({ data: null, error: null })),
    from: vi.fn((tabela: string) => {
      const resposta =
        tabela === "revisao_agenda"
          ? { data: agenda, error: null }
          : tabela === "sessoes"
            ? { data: aberta, error: null }
            : tabela === "sessao_itens"
              ? { data: leiturasDeItens.shift() ?? [], error: null }
              : tabela === "questoes"
                ? { data: questoes, error: null }
                : { data: null, error: null };

      const builder = construtor(resposta);
      builder.insert = vi.fn((valores: unknown) => {
        insercoes.push({ tabela, valores });
        return construtor(tabela === "sessoes" ? inserir : { data: null, error: null });
      });
      return builder;
    }),
  };

  return { cliente, insercoes };
}

beforeEach(() => {
  vi.clearAllMocks();
  dependencias.getParams.mockResolvedValue([10]);
});

describe("prepararSessaoDeRevisao — o porteiro é a agenda", () => {
  it("recusa um tópico que não tem revisão vencida, mesmo com a URL editada", async () => {
    const { cliente, insercoes } = clienteParaRevisao({ agenda: null });

    await expect(
      prepararSessaoDeRevisao(cliente as never, { topicoId: TOPICO, hoje: HOJE }),
    ).rejects.toMatchObject({ motivo: "revisao_indisponivel" });
    expect(insercoes).toEqual([]);
  });

  it("recusa um tópico que não é UUID antes de tocar no banco", async () => {
    const { cliente } = clienteParaRevisao();

    await expect(
      prepararSessaoDeRevisao(cliente as never, { topicoId: "nao-e-uuid", hoje: HOJE }),
    ).rejects.toMatchObject({ motivo: "revisao_indisponivel" });
    expect(cliente.auth.getUser).not.toHaveBeenCalled();
  });

  it("filtra a agenda pelo dia do produto, não por uma data futura qualquer", async () => {
    const { cliente } = clienteParaRevisao();

    await prepararSessaoDeRevisao(cliente as never, { topicoId: TOPICO, hoje: HOJE });

    const agenda = cliente.from.mock.results.find(
      (_resultado, indice) => cliente.from.mock.calls[indice]?.[0] === "revisao_agenda",
    )?.value as Record<string, ReturnType<typeof vi.fn>>;
    expect(agenda.lte).toHaveBeenCalledWith("due", HOJE);
  });
});

describe("prepararSessaoDeRevisao — a sessão criada", () => {
  it("nasce como revisão e com chave que não colide com a refação", async () => {
    const { cliente, insercoes } = clienteParaRevisao();

    await expect(
      prepararSessaoDeRevisao(cliente as never, { topicoId: TOPICO, hoje: HOJE }),
    ).resolves.toEqual({ id: "sessao-revisao", retomada: false });

    const sessao = insercoes.find((insercao) => insercao.tabela === "sessoes");
    expect(sessao?.valores).toMatchObject({
      user_id: "aluno-1",
      contexto: "revisao",
      refacao_chave: `${TOPICO}|revisao_avulsa`,
    });
  });

  it("retoma a revisão já aberta em vez de abrir uma segunda", async () => {
    const { cliente, insercoes } = clienteParaRevisao({
      aberta: {
        id: "sessao-ja-aberta",
        plano_bloco_id: null,
        contexto: "revisao",
        encerrada_em: null,
        refacao_chave: `${TOPICO}|revisao_avulsa`,
      },
      itensDaAberta: [
        { id: "item-1", sessao_id: "sessao-ja-aberta", questao_id: "questao-1", questao_versao: 1, ordem: 1 },
      ],
    });

    await expect(
      prepararSessaoDeRevisao(cliente as never, { topicoId: TOPICO, hoje: HOJE }),
    ).resolves.toEqual({ id: "sessao-ja-aberta", retomada: true });
    expect(insercoes).toEqual([]);
  });

  it("recusa quando o tópico não tem questão publicada em vez de abrir sessão vazia", async () => {
    const { cliente, insercoes } = clienteParaRevisao({ questoes: [] });

    await expect(
      prepararSessaoDeRevisao(cliente as never, { topicoId: TOPICO, hoje: HOJE }),
    ).rejects.toMatchObject({ motivo: "acervo_vazio" });
    expect(insercoes).toEqual([]);
  });

  it("descarta no domínio a questão anulada que a consulta deixou passar", async () => {
    const { cliente, insercoes } = clienteParaRevisao({
      questoes: [questao({ anulada: true })],
    });

    await expect(
      prepararSessaoDeRevisao(cliente as never, { topicoId: TOPICO, hoje: HOJE }),
    ).rejects.toMatchObject({ motivo: "acervo_vazio" });
    expect(insercoes).toEqual([]);
  });

  it("descarta a questão de outro tópico que a consulta deixou passar", async () => {
    const { cliente } = clienteParaRevisao({
      questoes: [questao({ topico_id: "22222222-2222-4222-8222-222222222222" })],
    });

    await expect(
      prepararSessaoDeRevisao(cliente as never, { topicoId: TOPICO, hoje: HOJE }),
    ).rejects.toMatchObject({ motivo: "acervo_vazio" });
  });
});
