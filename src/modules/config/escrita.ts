import { revalidateTag } from "next/cache";

import { clienteDeServico } from "@/lib/db/servidor";

import { CATALOGO, type Chave, type TipoDe, existeNoCatalogo } from "./catalogo";
import { TAG_DE_CACHE, reportarFalhaDeConfig } from "./leitura";

/** Recusa antes de encostar no banco. Nada disto vira linha na tabela. */
export class ConfiguracaoRecusada extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ConfiguracaoRecusada";
  }
}

export type LinhaDeConfig = {
  chave: string;
  valor: unknown;
  moduloDono: string;
  autorId: string;
  motivo?: string;
};

export type GravadorDeConfig = (linha: LinhaDeConfig) => Promise<void>;

/** Gravador real. **INSERT**, nunca UPDATE: a tabela e append-only (AD-081). */
export const gravadorDoBanco: GravadorDeConfig = async (linha) => {
  const { error } = await clienteDeServico()
    .from("configuracoes")
    .insert({
      chave: linha.chave,
      valor: linha.valor,
      modulo_dono: linha.moduloDono,
      alterado_por: linha.autorId,
      motivo: linha.motivo ?? null,
    });

  if (error) {
    throw new Error(`falha ao gravar configuracao: ${error.message}`);
  }
};

let gravadorAtual: GravadorDeConfig = gravadorDoBanco;

/** Seam de teste. Producao nunca chama isto. */
export function definirGravadorDeConfig(novo: GravadorDeConfig): void {
  gravadorAtual = novo;
}

export function restaurarGravadorPadrao(): void {
  gravadorAtual = gravadorDoBanco;
}

const INVALIDACAO_PADRAO = (): void => {
  try {
    // O Next 16 exige o perfil como segundo argumento; a forma de um argumento
    // so foi depreciada. "max" e o recomendado: serve o valor velho enquanto
    // busca o novo por tras. Uma leitura velha logo depois da troca cabe no
    // contrato — o AC5 ja aceita ate 30s de atraso.
    revalidateTag(TAG_DE_CACHE, "max");
  } catch (erro) {
    // `revalidateTag` so vale dentro de requisicao. Chamado de um job ou de um
    // script, o cache expira sozinho na janela de 30s — e uma degradacao, nao
    // uma falha, entao reporta e segue.
    reportarFalhaDeConfig(erro, {
      motivo: "nao deu para invalidar o cache; ele expira na janela de 30s",
    });
  }
};

let invalidarCache: () => void = INVALIDACAO_PADRAO;

export function definirInvalidacaoDeCache(nova: () => void): void {
  invalidarCache = nova;
}

export function restaurarInvalidacaoPadrao(): void {
  invalidarCache = INVALIDACAO_PADRAO;
}

/**
 * Registra uma mudanca de configuracao (INFRA-11 AC7, AD-081).
 *
 * Sempre INSERT. O valor anterior nao e sobrescrito: ele continua sendo a
 * penultima linha da chave, e e dali que sai "quem mudou, quando, de que valor
 * para qual" — sem tabela de historico paralela que possa divergir do fato.
 *
 * `autorId` e obrigatorio: **nao existe alteracao anonima**. Config nao aparece
 * no diff do git, entao o autor no registro e a unica forma de saber quem
 * mexeu no preco.
 */
export async function setConfig<K extends Chave>(
  chave: K,
  valor: TipoDe<K>,
  opcoes: { autorId: string; motivo?: string },
): Promise<void> {
  // 1. Chave. O tipo ja barra chave literal inexistente em tempo de compilacao;
  //    esta checagem pega a chave que chega por variavel, vinda de uma tela.
  if (!existeNoCatalogo(chave)) {
    throw new ConfiguracaoRecusada(
      `chave "${chave}" nao existe no catalogo. Chave nova se declara em catalogo.ts, nao no banco.`,
    );
  }

  // 2. Autor.
  const autorId = opcoes?.autorId;
  if (typeof autorId !== "string" || autorId.trim() === "") {
    throw new ConfiguracaoRecusada(
      `alteracao de "${chave}" sem autor. Toda mudanca de configuracao tem dono (AC7).`,
    );
  }

  // 3. Valor, contra o tipo declarado da propria chave — antes do INSERT, para
  //    que valor invalido nao chegue a existir como linha.
  const definicao = CATALOGO[chave];
  const validado = definicao.tipo.safeParse(valor);
  if (!validado.success) {
    throw new ConfiguracaoRecusada(
      `valor invalido para "${chave}": ${validado.error.message}`,
    );
  }

  await gravadorAtual({
    chave,
    valor: validado.data,
    moduloDono: definicao.moduloDono,
    autorId: autorId.trim(),
    motivo: opcoes.motivo,
  });

  invalidarCache();
}
