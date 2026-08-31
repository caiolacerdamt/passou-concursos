import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  preparar: vi.fn(),
  prepararRefacao: vi.fn(),
  consultar: vi.fn(),
  plano: vi.fn(),
  rotulos: vi.fn(),
  pratica: vi.fn(),
  prepararRevisao: vi.fn(),
  sair: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.matricula,
}));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/aluno/sessao", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/modules/aluno/sessao")>();
  return {
    ...atual,
    prepararSessao: dependencias.preparar,
    prepararSessaoDeRefacao: dependencias.prepararRefacao,
    prepararSessaoDeRevisao: dependencias.prepararRevisao,
    consultarSessao: dependencias.consultar,
  };
});
vi.mock("@/modules/aluno/plano", () => ({
  consultarPlanoDoDia: dependencias.plano,
  dataHojeDoProduto: () => "2026-08-22",
}));
vi.mock("@/modules/aluno/plano-rotulos", () => ({
  consultarRotulosDosTopicosPorIds: dependencias.rotulos,
}));
vi.mock("@/modules/aluno/sessao/pratica", () => ({
  consultarPratica: dependencias.pratica,
}));
vi.mock("../../../entrar/acoes", () => ({ sair: dependencias.sair }));
vi.mock("@/modules/aluno/sessao/tela", () => ({
  SessaoTela: ({ sessao }: { sessao: { id: string } }) => (
    <div data-testid="sessao-tela">Sessão renderizada: {sessao.id}</div>
  ),
}));
vi.mock("next/navigation", () => ({ redirect: dependencias.redirect }));

import { SessaoRecusada } from "@/modules/aluno/sessao";

const { default: Sessao } = await import("./page");
const { default: AbrirSessao } = await import("../page");

const sessao = {
  id: "sessao-1",
  blocoId: "bloco-1",
  contexto: "treino" as const,
  encerradaEm: null,
  totalItens: 1,
  itensRespondidos: 0,
  itens: [
    {
      id: "item-1",
      questaoId: "questao-1",
      questaoVersao: 1,
      ordem: 1,
      somenteLeitura: false,
      respondidoEm: null,
      questao: {} as never,
    },
  ],
};

describe("rotas da sessão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.cliente.mockResolvedValue({});
    dependencias.consultar.mockResolvedValue(sessao);
    dependencias.preparar.mockResolvedValue({ id: "sessao-1", retomada: false });
    dependencias.prepararRefacao.mockResolvedValue({ id: "sessao-refacao", retomada: false });
    dependencias.prepararRevisao.mockResolvedValue({ id: "sessao-revisao", retomada: false });
    dependencias.plano.mockResolvedValue(null);
    dependencias.rotulos.mockResolvedValue(new Map());
    dependencias.pratica.mockResolvedValue({
      sessaoAberta: null,
      revisoesForaDoPlano: [],
      caderno: [],
      historico: [],
    });
  });

  it("redireciona a entrada do bloco para uma sessão persistida", async () => {
    await expect(
      AbrirSessao({ searchParams: Promise.resolve({ bloco: "bloco-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/app/sessao/sessao-1");
    expect(dependencias.preparar).toHaveBeenCalledWith({}, "bloco-1");
  });

  it("não recebendo bloco, monta a prática — e nenhum bloco do plano vaza para ela", async () => {
    dependencias.plano.mockResolvedValue({
      id: "plano-1",
      data: "2026-08-22",
      frase: null,
      piso: [
        {
          id: "bloco-revisao",
          tipo: "revisar",
          nivel: "piso",
          ordem: 1,
          topicoId: "topico-1",
          nQuestoes: 5,
          nQuestoesCheias: 5,
          minutosEstimados: 20,
          minutosEstimadosCheios: 20,
          motivo: "A revisão venceu.",
          ajusteUsuario: false,
          adiadoDe: null,
          conclusao: null,
        },
      ],
      metaCheia: [],
    });
    dependencias.pratica.mockResolvedValue({
      sessaoAberta: null,
      revisoesForaDoPlano: [{ topicoId: "topico-2", due: "2026-08-17" }],
      caderno: [],
      historico: [],
    });
    dependencias.rotulos.mockResolvedValue(
      new Map([["topico-2", { materia: "Conhecimentos Bancários", topico: "Garantias" }]]),
    );

    const html = renderToStaticMarkup(
      await AbrirSessao({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("Venceram e ficaram de fora");
    expect(html).toContain("Conhecimentos Bancários · Garantias");
    // A rota deixou de listar bloco do plano (AD-115): esse é o assunto de
    // /app e /app/plano, e a terceira cópia era a duplicação removida.
    expect(html).not.toContain("bloco-revisao");
    expect(html).not.toContain("/app/sessao?bloco=");
  });

  it("passa ao motor da prática só os tópicos pendentes do plano de hoje", async () => {
    dependencias.plano.mockResolvedValue({
      id: "plano-1",
      data: "2026-08-22",
      frase: null,
      piso: [
        {
          id: "bloco-pendente",
          tipo: "revisar",
          nivel: "piso",
          ordem: 1,
          topicoId: "topico-pendente",
          nQuestoes: 5,
          nQuestoesCheias: 5,
          minutosEstimados: 20,
          minutosEstimadosCheios: 20,
          motivo: null,
          ajusteUsuario: false,
          adiadoDe: null,
          conclusao: null,
        },
        {
          id: "bloco-concluido",
          tipo: "avancar",
          nivel: "meta_cheia",
          ordem: 2,
          topicoId: "topico-concluido",
          nQuestoes: 5,
          nQuestoesCheias: 5,
          minutosEstimados: 20,
          minutosEstimadosCheios: 20,
          motivo: null,
          ajusteUsuario: false,
          adiadoDe: null,
          conclusao: {
            sessaoId: "sessao-encerrada",
            nQuestoes: 5,
            nAcertos: 4,
            encerradaEm: "2026-08-22T21:00:00Z",
          },
        },
      ],
      metaCheia: [],
    });

    renderToStaticMarkup(await AbrirSessao({ searchParams: Promise.resolve({}) }));

    // Um bloco já concluído não protege mais o tópico: a revisão dele pode
    // voltar hoje, e escondê-la seria perder a única tela que a mostra.
    expect(dependencias.pratica).toHaveBeenCalledWith(
      {},
      { topicosNoPlanoDeHoje: ["topico-pendente"], hoje: "2026-08-22" },
    );
  });

  it("sem sessão, revisão, erro nem histórico, oferece a saída para o plano", async () => {
    const html = renderToStaticMarkup(
      await AbrirSessao({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("Esta tela enche sozinha conforme você estuda");
    expect(html).toContain("/app");
  });

  it("segue mostrando a prática quando a leitura do plano de hoje cai", async () => {
    dependencias.plano.mockRejectedValue(new Error("plano indisponível"));
    dependencias.pratica.mockResolvedValue({
      sessaoAberta: null,
      revisoesForaDoPlano: [],
      caderno: [
        { topicoId: "topico-2", causa: "errei_a_conta", nErros: 3, ultimoErroEm: "2026-08-21" },
      ],
      historico: [],
    });

    const html = renderToStaticMarkup(
      await AbrirSessao({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("Erros que merecem outra chance");
    expect(dependencias.pratica).toHaveBeenCalledWith(
      {},
      { topicosNoPlanoDeHoje: [], hoje: "2026-08-22" },
    );
  });

  it("redireciona a revisão avulsa pelo tópico, sem aceitar outro parâmetro", async () => {
    await expect(
      AbrirSessao({
        searchParams: Promise.resolve({
          revisao: "11111111-1111-4111-8111-111111111111",
          user_id: "aluno-alheio",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/app/sessao/sessao-revisao");
    expect(dependencias.prepararRevisao).toHaveBeenCalledWith({}, {
      topicoId: "11111111-1111-4111-8111-111111111111",
    });
    expect(dependencias.prepararRevisao.mock.calls[0][1]).not.toHaveProperty("user_id");
  });

  it("recusa a revisão que não está vencida sem derrubar a rota", async () => {
    dependencias.prepararRevisao.mockRejectedValue(
      new SessaoRecusada("revisao_indisponivel", "não venceu"),
    );

    const html = renderToStaticMarkup(
      await AbrirSessao({
        searchParams: Promise.resolve({ revisao: "11111111-1111-4111-8111-111111111111" }),
      }),
    );

    expect(html).toContain("Esta revisão não está vencida na sua agenda");
  });

  it("redireciona a refação usando somente o filtro autenticado do caderno", async () => {
    await expect(
      AbrirSessao({
        searchParams: Promise.resolve({
          refacao: "1",
          topico: "11111111-1111-4111-8111-111111111111",
          causa: "errei_a_conta",
          user_id: "aluno-alheio",
          questoes: "questao-alheia",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/app/sessao/sessao-refacao");
    expect(dependencias.prepararRefacao).toHaveBeenCalledWith({}, {
      topicoId: "11111111-1111-4111-8111-111111111111",
      causa: "errei_a_conta",
    });
    expect(dependencias.prepararRefacao.mock.calls[0][1]).not.toHaveProperty("user_id");
    expect(dependencias.prepararRefacao.mock.calls[0][1]).not.toHaveProperty("questoes");
  });

  it("renderiza a questão pendente através do componente da sessão", async () => {
    const html = renderToStaticMarkup(
      await Sessao({ params: Promise.resolve({ id: "sessao-1" }) }),
    );

    expect(html).toContain("Sessão renderizada: sessao-1");
    expect(dependencias.consultar).toHaveBeenCalledWith({}, "sessao-1");
  });

  it("mostra conclusão sem criar conteúdo quando não há itens pendentes", async () => {
    dependencias.consultar.mockResolvedValue({ ...sessao, encerradaEm: "2026-08-22T22:00:00Z", itens: [] });

    const html = renderToStaticMarkup(
      await Sessao({ params: Promise.resolve({ id: "sessao-1" }) }),
    );

    expect(html).toContain("Bloco concluído");
    expect(html).not.toContain("sessao-tela");
  });

  it("trata acervo vazio com estado seguro e mantém a volta ao plano", async () => {
    dependencias.preparar.mockRejectedValue(
      new SessaoRecusada("acervo_vazio", "sem questões"),
    );

    const html = renderToStaticMarkup(
      await AbrirSessao({ searchParams: Promise.resolve({ bloco: "bloco-1" }) }),
    );

    expect(html).toContain("Este bloco ainda não tem questões disponíveis");
    expect(html).toContain("/app");
  });
});
