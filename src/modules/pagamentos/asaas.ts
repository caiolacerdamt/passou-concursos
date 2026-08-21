import {
  MEIOS_DE_PAGAMENTO,
  type MeioDePagamento,
} from "./contratos";
import { PARCELAS_DO_CARTAO } from "./preco";

const HOSTS_OFICIAIS_ASAAS = new Set([
  "api.asaas.com",
  "api-sandbox.asaas.com",
]);

const CAMINHO_PAGAMENTOS = "/v3/payments";
const CAMINHO_FATURAS = "/v3/invoices";

type MetodoHTTP = "GET" | "POST";

export type FetchDoGateway = typeof fetch;

export type ConfiguracaoAsaas = {
  apiKey: string;
  apiUrl: string;
  fetchImpl?: FetchDoGateway;
  timeoutMs?: number;
};

export type CriarCobrancaAsaas = {
  clienteId: string;
  meio: MeioDePagamento;
  valorCentavos: number;
  referenciaExterna: string;
  vencimento: string;
  descricao: string;
};

export type CobrancaAsaas = {
  id: string;
  status: string;
  billingType: string | null;
  externalReference: string | null;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
};

export type ListagemDeCobrancasAsaas = {
  id: string;
  status: string;
  billingType: string | null;
  externalReference: string | null;
};

export type AgendarNotaFiscalAsaas = {
  pagamentoId: string;
  referenciaExterna: string;
  descricaoServico: string;
  observacoes: string;
  valorCentavos: number;
  dataEfetiva: string;
  nomeServicoMunicipal: string;
  idServicoMunicipal?: string;
  codigoServicoMunicipal?: string;
  impostos: Record<string, unknown>;
};

export type NotaFiscalAsaas = {
  id: string;
  status: string | null;
  externalReference: string | null;
};

export type EstornoAsaas = {
  id: string | null;
  status: string | null;
  requestUrl: string | null;
};

export class ErroAsaas extends Error {
  readonly codigo: "entrada_invalida" | "gateway_indisponivel" | "gateway_recusou";
  readonly statusHttp: number | null;

  constructor(
    codigo: ErroAsaas["codigo"],
    statusHttp: number | null = null,
  ) {
    super(mensagemTecnicaSegura(codigo));
    this.name = "ErroAsaas";
    this.codigo = codigo;
    this.statusHttp = statusHttp;
  }
}

export class AsaasGateway {
  private readonly apiKey: string;
  private readonly baseUrl: URL;
  private readonly fetchImpl: FetchDoGateway;
  private readonly timeoutMs: number;

  constructor(configuracao: ConfiguracaoAsaas) {
    if (!configuracao.apiKey.trim()) {
      throw new ErroAsaas("entrada_invalida");
    }

    this.baseUrl = validarUrlAsaas(configuracao.apiUrl);
    this.apiKey = configuracao.apiKey;
    this.fetchImpl = configuracao.fetchImpl ?? fetch;
    this.timeoutMs = configuracao.timeoutMs ?? 8_000;
  }

  async criarCobranca(input: CriarCobrancaAsaas): Promise<CobrancaAsaas> {
    validarCriacaoDeCobranca(input);

    const base = {
      customer: input.clienteId,
      billingType: input.meio,
      externalReference: input.referenciaExterna,
      dueDate: input.vencimento,
      description: input.descricao,
    };

    const corpo =
      input.meio === "CREDIT_CARD"
        ? {
            ...base,
            installmentCount: PARCELAS_DO_CARTAO,
            totalValue: input.valorCentavos / 100,
          }
        : { ...base, value: input.valorCentavos / 100 };

    const resposta = await this.request<RespostaCobranca>(
      "POST",
      CAMINHO_PAGAMENTOS,
      corpo,
    );
    return normalizarCobranca(resposta);
  }

  async consultarCobranca(id: string): Promise<CobrancaAsaas> {
    const identificador = validarIdentificador(id);
    const resposta = await this.request<RespostaCobranca>(
      "GET",
      `${CAMINHO_PAGAMENTOS}/${encodeURIComponent(identificador)}`,
    );
    return normalizarCobranca(resposta);
  }

  async listarCobrancasPagas(
    offset = 0,
    limite = 100,
  ): Promise<ListagemDeCobrancasAsaas[]> {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new ErroAsaas("entrada_invalida");
    }

    const resposta = await this.request<RespostaListaDeCobrancas>(
      "GET",
      `${CAMINHO_PAGAMENTOS}?status=RECEIVED&offset=${offset}&limit=${limite}`,
    );
    return (Array.isArray(resposta.data) ? resposta.data : []).map(
      normalizarCobrancaListada,
    );
  }

  async estornarCobranca(
    id: string,
    meio: MeioDePagamento,
    descricao?: string,
  ): Promise<EstornoAsaas> {
    const identificador = validarIdentificador(id);
    if (!MEIOS_DE_PAGAMENTO.includes(meio)) {
      throw new ErroAsaas("entrada_invalida");
    }

    const caminho =
      meio === "BOLETO"
        ? `${CAMINHO_PAGAMENTOS}/${encodeURIComponent(identificador)}/bankSlip/refund`
        : `${CAMINHO_PAGAMENTOS}/${encodeURIComponent(identificador)}/refund`;
    const corpo = meio === "BOLETO" || !descricao ? undefined : { description: descricao };
    const resposta = await this.request<RespostaEstorno>("POST", caminho, corpo);

    return {
      id: typeof resposta.id === "string" ? resposta.id : null,
      status: typeof resposta.status === "string" ? resposta.status : null,
      requestUrl:
        typeof resposta.requestUrl === "string" ? resposta.requestUrl : null,
    };
  }

  async agendarNotaFiscal(
    input: AgendarNotaFiscalAsaas,
  ): Promise<NotaFiscalAsaas> {
    validarAgendamentoDeNota(input);

    const resposta = await this.request<RespostaNotaFiscal>(
      "POST",
      CAMINHO_FATURAS,
      {
        payment: input.pagamentoId,
        externalReference: input.referenciaExterna,
        serviceDescription: input.descricaoServico,
        observations: input.observacoes,
        value: input.valorCentavos / 100,
        deductions: 0,
        effectiveDate: input.dataEfetiva,
        municipalServiceId: input.idServicoMunicipal,
        municipalServiceCode: input.codigoServicoMunicipal,
        municipalServiceName: input.nomeServicoMunicipal,
        updatePayment: false,
        taxes: input.impostos,
      },
    );

    return {
      id: typeof resposta.id === "string" ? resposta.id : "",
      status: typeof resposta.status === "string" ? resposta.status : null,
      externalReference:
        typeof resposta.externalReference === "string"
          ? resposta.externalReference
          : null,
    };
  }

  private async request<T>(
    metodo: MetodoHTTP,
    caminho: string,
    corpo?: Record<string, unknown>,
  ): Promise<T> {
    const destino = new URL(caminho, this.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resposta = await this.fetchImpl(destino, {
        method: metodo,
        headers: {
          accept: "application/json",
          ...(corpo ? { "content-type": "application/json" } : {}),
          access_token: this.apiKey,
        },
        ...(corpo ? { body: JSON.stringify(corpo) } : {}),
        signal: controller.signal,
      });

      if (!resposta.ok) {
        throw new ErroAsaas(
          resposta.status >= 500 ? "gateway_indisponivel" : "gateway_recusou",
          resposta.status,
        );
      }

      const tipo = resposta.headers.get("content-type") ?? "";
      if (!tipo.toLowerCase().includes("application/json")) {
        throw new ErroAsaas("gateway_indisponivel", resposta.status);
      }

      try {
        return (await resposta.json()) as T;
      } catch {
        throw new ErroAsaas("gateway_indisponivel", resposta.status);
      }
    } catch (erro) {
      if (erro instanceof ErroAsaas) throw erro;
      throw new ErroAsaas("gateway_indisponivel");
    } finally {
      clearTimeout(timer);
    }
  }
}

export function gatewayAsaasDoAmbiente(
  ambiente: NodeJS.ProcessEnv = process.env,
): AsaasGateway {
  const apiKey = ambiente.ASAAS_API_KEY?.trim();
  const apiUrl = ambiente.ASAAS_API_URL?.trim();
  if (!apiKey || !apiUrl) {
    throw new ErroAsaas("entrada_invalida");
  }

  return new AsaasGateway({ apiKey, apiUrl });
}

export function validarUrlAsaas(valor: string): URL {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new ErroAsaas("entrada_invalida");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !HOSTS_OFICIAIS_ASAAS.has(url.hostname.toLowerCase())
  ) {
    throw new ErroAsaas("entrada_invalida");
  }

  return new URL(`${url.origin}${url.pathname.replace(/\/+$/, "") || "/"}`);
}

type RespostaCobranca = Partial<{
  id: unknown;
  status: unknown;
  billingType: unknown;
  externalReference: unknown;
  invoiceUrl: unknown;
  bankSlipUrl: unknown;
  pixQrCode: unknown;
  pixCopiaECola: unknown;
}>;

type RespostaListaDeCobrancas = { data?: unknown };

type RespostaEstorno = Partial<{
  id: unknown;
  status: unknown;
  requestUrl: unknown;
}>;

type RespostaNotaFiscal = Partial<{
  id: unknown;
  status: unknown;
  externalReference: unknown;
}>;

function normalizarCobranca(resposta: RespostaCobranca): CobrancaAsaas {
  if (typeof resposta.id !== "string" || !resposta.id) {
    throw new ErroAsaas("gateway_indisponivel");
  }

  return {
    id: resposta.id,
    status: typeof resposta.status === "string" ? resposta.status : "UNKNOWN",
    billingType:
      typeof resposta.billingType === "string" ? resposta.billingType : null,
    externalReference:
      typeof resposta.externalReference === "string"
        ? resposta.externalReference
        : null,
    invoiceUrl: urlOuNulo(resposta.invoiceUrl),
    bankSlipUrl: urlOuNulo(resposta.bankSlipUrl),
    pixQrCode: textoOuNulo(resposta.pixQrCode),
    pixCopiaECola: textoOuNulo(resposta.pixCopiaECola),
  };
}

function normalizarCobrancaListada(
  resposta: unknown,
): ListagemDeCobrancasAsaas {
  if (!resposta || typeof resposta !== "object") {
    throw new ErroAsaas("gateway_indisponivel");
  }
  const valor = resposta as Record<string, unknown>;
  if (typeof valor.id !== "string" || typeof valor.status !== "string") {
    throw new ErroAsaas("gateway_indisponivel");
  }
  return {
    id: valor.id,
    status: valor.status,
    billingType: textoOuNulo(valor.billingType),
    externalReference: textoOuNulo(valor.externalReference),
  };
}

function validarCriacaoDeCobranca(input: CriarCobrancaAsaas): void {
  if (
    !input.clienteId.trim() ||
    !input.referenciaExterna.trim() ||
    !input.descricao.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.vencimento) ||
    !Number.isInteger(input.valorCentavos) ||
    input.valorCentavos <= 0 ||
    !MEIOS_DE_PAGAMENTO.includes(input.meio)
  ) {
    throw new ErroAsaas("entrada_invalida");
  }
}

function validarAgendamentoDeNota(input: AgendarNotaFiscalAsaas): void {
  if (
    !input.pagamentoId.trim() ||
    !input.referenciaExterna.trim() ||
    !input.descricaoServico.trim() ||
    !input.observacoes.trim() ||
    !input.nomeServicoMunicipal.trim() ||
    (!input.idServicoMunicipal && !input.codigoServicoMunicipal) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dataEfetiva) ||
    !Number.isInteger(input.valorCentavos) ||
    input.valorCentavos <= 0 ||
    !input.impostos ||
    typeof input.impostos !== "object"
  ) {
    throw new ErroAsaas("entrada_invalida");
  }
}

function validarIdentificador(valor: string): string {
  if (!valor.trim() || valor.length > 160) {
    throw new ErroAsaas("entrada_invalida");
  }
  return valor;
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === "string" ? valor : null;
}

function urlOuNulo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function mensagemTecnicaSegura(codigo: ErroAsaas["codigo"]): string {
  switch (codigo) {
    case "entrada_invalida":
      return "configuracao ou entrada do gateway invalida";
    case "gateway_recusou":
      return "gateway recusou a operacao";
    default:
      return "gateway indisponivel";
  }
}
