import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  executar: vi.fn(),
  reportar: vi.fn(),
  servico: vi.fn(),
  precos: vi.fn(),
  repositorio: vi.fn(),
  gateway: vi.fn(),
  reembolso: vi.fn(),
  conferir: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: dependencias.redirect }));
/*
 * A guarda continua mockada de propósito, mesmo depois de `acoes.ts` deixar de
 * importá-la: assim ela é um **sensor**. O mock manda para `/assinar`, então o
 * dia em que alguém reintroduzir `exigirMatriculaAtiva()` no esquecimento, o
 * teste "não exige matrícula" fica vermelho em vez de passar em silêncio.
 */
vi.mock("@/modules/conta/matricula", () => ({ exigirMatriculaAtiva: dependencias.matricula }));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/lib/db/servidor", () => ({ clienteDeServico: dependencias.servico }));
vi.mock("@/modules/lgpd/esquecimento", () => ({ executarEsquecimento: dependencias.executar }));
vi.mock("@/modules/conta/troca-de-senha", async () => {
  const real = await vi.importActual<typeof import("@/modules/conta/troca-de-senha")>(
    "@/modules/conta/troca-de-senha",
  );
  // `provedoresDoUsuario` e `temSenhaPropria` continuam REAIS: e a regra do
  // Google, e mocka-la aqui apagaria justamente o caso que o teste cobre. So a
  // conferencia da senha atual e dublada, porque ela fala com o provedor.
  return { ...real, conferirSenhaAtual: dependencias.conferir };
});
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("@/modules/pagamentos/preco", () => ({ obterPrecosPublicos: dependencias.precos }));
vi.mock("@/modules/pagamentos/asaas", () => ({
  gatewayAsaasDoAmbiente: dependencias.gateway,
}));
vi.mock("@/modules/pagamentos/garantia", () => ({
  solicitarReembolso: dependencias.reembolso,
}));
vi.mock("@/modules/pagamentos/repositorio", () => ({
  criarRepositorioDePagamentos: dependencias.repositorio,
}));

const { pedirReembolso, solicitarEsquecimento, trocarSenha } = await import("./acoes");

function formulario(confirmacao = "APAGAR", userId = "tentativa-do-form") {
  const form = new FormData();
  form.set("confirmacao", confirmacao);
  form.set("user_id", userId);
  return form;
}

function clienteComUsuario(user: { id: string; email?: string } | null) {
  const cliente = { auth: { getUser: vi.fn(async () => ({ data: { user } })) } };
  dependencias.cliente.mockResolvedValue(cliente);
  return cliente;
}

describe("action de esquecimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockImplementation((): never => {
      throw new Error("NEXT_REDIRECT:/assinar");
    });
    dependencias.executar.mockResolvedValue({ estado: "concluido" });
  });

  /*
   * O direito ao esquecimento (LGPD art. 18) não vence com a matrícula, e quem
   * mais o exerce é justamente quem já saiu. Com a guarda no caminho, esse aluno
   * era mandado para `/assinar`: precisava comprar de novo para apagar os
   * próprios dados. A autorização continua sendo uma só — a sessão.
   */
  it("não exige matrícula ativa: quem já saiu ainda apaga os próprios dados", async () => {
    clienteComUsuario({ id: "aluno-vencido", email: "vencido@exemplo.com" });

    await expect(solicitarEsquecimento(formulario())).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?resultado=esquecimento",
    );
    expect(dependencias.matricula).not.toHaveBeenCalled();
    expect(dependencias.executar).toHaveBeenCalledWith({
      id: "aluno-vencido",
      email: "vencido@exemplo.com",
    });
  });

  it("exige a confirmação textual antes de abrir a sessão", async () => {
    await expect(solicitarEsquecimento(formulario("apagar minha conta"))).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=privacidade&resultado=confirmacao",
    );
    expect(dependencias.cliente).not.toHaveBeenCalled();
  });

  it("deriva id e e-mail da sessão e ignora user_id do formulário", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });

    await expect(solicitarEsquecimento(formulario())).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?resultado=esquecimento",
    );
    expect(dependencias.executar).toHaveBeenCalledWith({
      id: "aluno-real",
      email: "real@exemplo.com",
    });
    expect(dependencias.executar).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "tentativa-do-form" }),
    );
  });

  it("manda para login quando a sessão não existe", async () => {
    clienteComUsuario(null);

    await expect(solicitarEsquecimento(formulario())).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?proximo=%2Fapp%2Fconta",
    );
    expect(dependencias.executar).not.toHaveBeenCalled();
  });

  it("não confirma sucesso técnico quando a orquestração falha", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });
    const erro = new Error("detalhe interno");
    dependencias.executar.mockRejectedValue(erro);

    await expect(solicitarEsquecimento(formulario())).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=privacidade&resultado=erro",
    );
    expect(dependencias.reportar).toHaveBeenCalledWith(
      erro,
      expect.objectContaining({ operacao: "solicitar_esquecimento" }),
    );
  });
});

describe("action de troca de senha", () => {
  function sessaoComSenha(user: {
    id: string;
    email: string;
    identities?: { provider: string }[];
  }) {
    const updateUser = vi.fn(async () => ({ error: null }));
    dependencias.cliente.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { identities: [{ provider: "email" }], ...user } },
        })),
        updateUser,
      },
    });
    return updateUser;
  }

  function formularioDeSenha(atual = "senhaatual", nova = "senhanovalonga") {
    const form = new FormData();
    form.set("senha_atual", atual);
    form.set("senha", nova);
    return form;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.conferir.mockResolvedValue(true);
  });

  it("troca a senha e volta com a confirmação", async () => {
    const updateUser = sessaoComSenha({ id: "aluno-a", email: "a@x.com" });

    await expect(trocarSenha(formularioDeSenha())).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=privacidade&resultado=senha_trocada",
    );
    expect(updateUser).toHaveBeenCalledWith({ password: "senhanovalonga" });
  });

  /*
   * A regra é a de `senha.ts`, única do produto. Uma segunda regra aqui seria o
   * começo da divergência — e vale sempre a mais frouxa.
   */
  it("recusa senha curta antes de ir ao provedor", async () => {
    const updateUser = sessaoComSenha({ id: "aluno-a", email: "a@x.com" });

    await expect(trocarSenha(formularioDeSenha("senhaatual", "curta"))).rejects.toThrow(
      "resultado=senha_curta",
    );
    expect(dependencias.conferir).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  /*
   * `updateUser` não pede a senha antiga. Sem a conferência, uma sessão
   * esquecida aberta troca a senha e tranca o dono fora da própria conta.
   */
  it("exige a senha atual, que updateUser não pede", async () => {
    const updateUser = sessaoComSenha({ id: "aluno-a", email: "a@x.com" });
    dependencias.conferir.mockResolvedValue(false);

    await expect(trocarSenha(formularioDeSenha())).rejects.toThrow(
      "resultado=senha_recusada",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  /*
   * Conta só-Google não tem senha. A tela nem mostra o formulário; chegar aqui é
   * pedido forjado, e ele não pode criar senha para uma conta que entra por
   * outro caminho.
   */
  it("conta só-Google não ganha senha por pedido forjado", async () => {
    const updateUser = sessaoComSenha({
      id: "aluno-g",
      email: "g@x.com",
      identities: [{ provider: "google" }],
    });

    await expect(trocarSenha(formularioDeSenha())).rejects.toThrow(
      "resultado=senha_sem_formulario",
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("sem sessão vai para o login sem conferir nada", async () => {
    dependencias.cliente.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    });

    await expect(trocarSenha(formularioDeSenha())).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?proximo=%2Fapp%2Fconta",
    );
    expect(dependencias.conferir).not.toHaveBeenCalled();
  });

  it("falha do provedor não confirma troca que não aconteceu", async () => {
    dependencias.cliente.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: { id: "aluno-a", email: "a@x.com", identities: [{ provider: "email" }] },
          },
        })),
        updateUser: vi.fn(async () => ({ error: new Error("auth fora do ar") })),
      },
    });

    await expect(trocarSenha(formularioDeSenha())).rejects.toThrow(
      "resultado=senha_recusada",
    );
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operacao: "trocar_senha" }),
    );
  });

  /*
   * A conferência da senha atual roda num cliente descartável: no cliente da
   * sessão, `signInWithPassword` rotacionaria o cookie do próprio aluno no meio
   * da operação.
   */
  it("confere a senha atual com o e-mail da sessão", async () => {
    sessaoComSenha({ id: "aluno-a", email: "a@x.com" });

    await expect(trocarSenha(formularioDeSenha("atualdela"))).rejects.toThrow(
      "resultado=senha_trocada",
    );
    expect(dependencias.conferir).toHaveBeenCalledWith("a@x.com", "atualdela");
  });
});

describe("action de reembolso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.precos.mockResolvedValue({ garantiaDias: 7 });
    dependencias.servico.mockReturnValue({});
    dependencias.repositorio.mockReturnValue({
      buscarUltimoPagamentoDoUsuario: vi.fn(),
      registrarPedidoDeReembolso: vi.fn(),
      confirmarReembolsoLocal: vi.fn(),
      buscarFatura: vi.fn(),
      registrarResultadoCancelamentoFatura: vi.fn(),
      abrirPendencia: vi.fn(),
    });
    dependencias.gateway.mockReturnValue({
      estornarCobranca: vi.fn(),
      cancelarNotaFiscal: vi.fn(),
    });
  });

  it("exige sessão antes de tocar em preço, repositório ou gateway", async () => {
    clienteComUsuario(null);

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?proximo=%2Fapp%2Fconta",
    );
    expect(dependencias.precos).not.toHaveBeenCalled();
    expect(dependencias.gateway).not.toHaveBeenCalled();
    expect(dependencias.reembolso).not.toHaveBeenCalled();
  });

  it("usa o id da sessão para buscar o pagamento, e volta para a aba da assinatura", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });
    dependencias.reembolso.mockResolvedValue({ estado: "solicitado" });

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=assinatura&resultado=solicitado",
    );
    expect(dependencias.reembolso).toHaveBeenCalledWith(
      "aluno-real",
      7,
      expect.any(Date),
      expect.anything(),
    );
  });

  it("não emite estorno nem promete análise quando o gateway não está configurado", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });
    const erro = new Error("sem chave do Asaas");
    dependencias.gateway.mockImplementation(() => {
      throw erro;
    });

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=assinatura&resultado=indisponivel",
    );
    expect(dependencias.reembolso).not.toHaveBeenCalled();
    expect(dependencias.reportar).toHaveBeenCalledWith(
      erro,
      expect.objectContaining({ operacao: "pedir_reembolso" }),
    );
  });

  it("devolve o pedido recusado sem prometer estorno", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });
    dependencias.reembolso.mockResolvedValue({ estado: "recusado" });

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=assinatura&resultado=recusado",
    );
  });
});
