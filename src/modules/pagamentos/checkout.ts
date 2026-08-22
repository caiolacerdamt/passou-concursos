import {
  type CheckoutValidado,
  type MeioDePagamento,
  VERSAO_ATUAL_DOS_TERMOS,
  validarEntradaCheckout,
} from "./contratos";
import type {
  ClienteAsaas,
  CobrancaAsaas,
  CriarClienteAsaas,
  CriarCobrancaAsaas,
} from "./asaas";
import type { PrecosPublicos } from "./preco";
import type {
  PagamentoCheckout,
  ResultadoGatewayPersistido,
} from "./repositorio";

export type GatewayDoCheckout = {
  criarCliente(input: CriarClienteAsaas): Promise<ClienteAsaas>;
  criarCobranca(input: CriarCobrancaAsaas): Promise<CobrancaAsaas>;
};

export type RepositorioDoCheckout = {
  existeMatriculaAtivaPorEmail(email: string): Promise<boolean>;
  criarPagamentoPendente(input: {
    email: string;
    valorCentavos: number;
    meio: MeioDePagamento;
    parcelas: number;
    referenciaInterna: string;
    maiorDeIdade: boolean;
    termosVersao: string;
    aceitoEm: string;
  }): Promise<PagamentoCheckout>;
  salvarResultadoGateway(
    pagamentoId: string,
    resultado: ResultadoGatewayPersistido,
  ): Promise<void>;
  criarTokenResultado(pagamentoId: string): Promise<string>;
};

export type ResultadoDoCheckout =
  | { tipo: "criado"; resultadoToken: string; referencia: string }
  | { tipo: "matricula_ativa"; email: string };

export async function executarCheckout(
  entrada: unknown,
  dependencias: {
    precos: PrecosPublicos;
    repositorio: RepositorioDoCheckout;
    gateway: GatewayDoCheckout;
    agora?: Date;
    gerarReferencia?: () => string;
  },
): Promise<ResultadoDoCheckout> {
  const validado = validarEntradaCheckout(entrada, dependencias.agora ?? new Date());

  if (await dependencias.repositorio.existeMatriculaAtivaPorEmail(validado.email)) {
    return { tipo: "matricula_ativa", email: validado.email };
  }

  const valor = valorDaCompra(dependencias.precos, validado.meio);
  const referencia =
    dependencias.gerarReferencia?.() ?? `checkout-${crypto.randomUUID()}`;
  const pagamento = await dependencias.repositorio.criarPagamentoPendente({
    email: validado.email,
    valorCentavos: valor.valorCentavos,
    meio: validado.meio,
    parcelas: valor.parcelas,
    referenciaInterna: referencia,
    maiorDeIdade: validado.maiorDeIdade,
    termosVersao: VERSAO_ATUAL_DOS_TERMOS,
    aceitoEm: validado.aceiteEm,
  });

  const cliente = await dependencias.gateway.criarCliente({
    nomeCompleto: validado.nomeCompleto,
    email: validado.email,
    cpfCnpj: validado.cpfCnpj,
  });
  const cobranca = await dependencias.gateway.criarCobranca({
    clienteId: cliente.id,
    meio: validado.meio,
    valorCentavos: valor.valorCentavos,
    referenciaExterna: referencia,
    vencimento: dataDeVencimento(dependencias.agora ?? new Date()),
    descricao: "Passou Concursos — plano anual",
  });

  await dependencias.repositorio.salvarResultadoGateway(pagamento.id, {
    clienteId: cliente.id,
    cobrancaId: cobranca.id,
    status: cobranca.status,
    invoiceUrl: cobranca.invoiceUrl,
    bankSlipUrl: cobranca.bankSlipUrl,
    pixQrCode: cobranca.pixQrCode,
    pixCopiaECola: cobranca.pixCopiaECola,
  });
  const resultadoToken = await dependencias.repositorio.criarTokenResultado(pagamento.id);

  return {
    tipo: "criado",
    resultadoToken,
    referencia,
  };
}

function valorDaCompra(
  precos: PrecosPublicos,
  meio: MeioDePagamento,
): { valorCentavos: number; parcelas: number } {
  if (meio === "CREDIT_CARD") {
    return {
      valorCentavos: precos.parcelado.totalCentavos,
      parcelas: precos.parcelado.parcelas,
    };
  }

  return { valorCentavos: precos.aVista.totalCentavos, parcelas: 1 };
}

function dataDeVencimento(agora: Date): string {
  const vencimento = new Date(agora.getTime());
  vencimento.setUTCDate(vencimento.getUTCDate() + 1);
  return vencimento.toISOString().slice(0, 10);
}

export function dadosDoFormularioCheckout(
  formulario: FormData,
): Record<string, unknown> {
  return {
    email: String(formulario.get("email") ?? ""),
    nomeCompleto: String(formulario.get("nomeCompleto") ?? ""),
    cpfCnpj: String(formulario.get("cpfCnpj") ?? ""),
    meio: String(formulario.get("meio") ?? ""),
    maiorDeIdade: formulario.get("maiorDeIdade") === "on",
    aceitouTermos: formulario.get("aceitouTermos") === "on",
    termosVersao: VERSAO_ATUAL_DOS_TERMOS,
  };
}

export function validarEntradaDoFormulario(
  formulario: FormData,
): CheckoutValidado {
  return validarEntradaCheckout(dadosDoFormularioCheckout(formulario));
}
