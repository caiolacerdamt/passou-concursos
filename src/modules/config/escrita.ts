import { revalidateTag } from "next/cache";

import { clienteDeServico } from "@/lib/db/servidor";

import {
  CATALOGO,
  CHAVES,
  type Chave,
  type ModuloDono,
  type TipoDe,
  existeNoCatalogo,
} from "./catalogo";
import { TAG_DE_CACHE, reportarFalhaDeConfig } from "./leitura";

/** Recusa antes de encostar no banco. Nada disto vira linha na tabela. */
export class ConfiguracaoRecusada extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ConfiguracaoRecusada";
  }
}

export type LinhaDeConfig = {
  chave: Chave;
  valor: unknown;
  moduloDono: ModuloDono;
  autorId: string;
  motivo: string;
};

export type GravadorDeConfig = (linha: LinhaDeConfig) => Promise<void>;

/** Forma que a tabela entrega ao leitor administrativo server-side. */
export type LinhaDeConfigBruta = {
  id: number;
  chave: string;
  valor: unknown;
  modulo_dono: string;
  alterado_por: string;
  motivo: string | null;
  alterado_em: string | Date;
};

export type LeitorAdministrativoDeConfig = () => Promise<
  readonly LinhaDeConfigBruta[]
>;

export type LinhaHistoricoDeConfig<K extends Chave = Chave> = {
  id: number;
  chave: K;
  valor: TipoDe<K>;
  moduloDono: ModuloDono;
  autorId: string;
  motivo: string | null;
  alteradoEm: string;
};

export type EstadoVigenteDeConfig<K extends Chave = Chave> = {
  valor: TipoDe<K>;
  autorId: string | null;
  motivo: string | null;
  alteradoEm: string | null;
};

export type ConfiguracaoAdministrativa<K extends Chave = Chave> = {
  chave: K;
  tipo: "flag" | "param";
  moduloDono: ModuloDono;
  descricao: string;
  padrao: TipoDe<K>;
  vigente: EstadoVigenteDeConfig<K>;
  /** Linhas em ordem de insercao, da mais antiga para a mais nova. */
  historico: readonly LinhaHistoricoDeConfig<K>[];
};

/** Gravador real. **INSERT**, nunca UPDATE: a tabela e append-only (AD-081). */
export const gravadorDoBanco: GravadorDeConfig = async (linha) => {
  const { error } = await clienteDeServico()
    .from("configuracoes")
    .insert({
      chave: linha.chave,
      valor: linha.valor,
      modulo_dono: linha.moduloDono,
      alterado_por: linha.autorId,
      motivo: linha.motivo,
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

/** Leitor real do historico. A tabela e fechada para o navegador. */
export const leitorAdministrativoDoBanco: LeitorAdministrativoDeConfig = async () => {
  const { data, error } = await clienteDeServico()
    .from("configuracoes")
    .select("id, chave, valor, modulo_dono, alterado_por, motivo, alterado_em")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`falha ao ler historico de configuracao: ${error.message}`);
  }

  return (data ?? []) as LinhaDeConfigBruta[];
};

let leitorAdministrativoAtual: LeitorAdministrativoDeConfig =
  leitorAdministrativoDoBanco;

/** Seam de teste. A tela sempre usa o leitor real no servidor. */
export function definirLeitorAdministrativoDeConfig(
  novo: LeitorAdministrativoDeConfig,
): void {
  leitorAdministrativoAtual = novo;
}

export function restaurarLeitorAdministrativoPadrao(): void {
  leitorAdministrativoAtual = leitorAdministrativoDoBanco;
}

function validarLinhaAdministrativa(
  linha: LinhaDeConfigBruta,
): LinhaHistoricoDeConfig {
  if (!existeNoCatalogo(linha.chave)) {
    throw new ConfiguracaoRecusada(
      `chave "${linha.chave}" nao existe no catalogo.`,
    );
  }

  const definicao = CATALOGO[linha.chave];
  if (linha.modulo_dono !== definicao.moduloDono) {
    throw new ConfiguracaoRecusada(
      `modulo dono invalido para "${linha.chave}".`,
    );
  }

  const validado = definicao.tipo.safeParse(linha.valor);
  if (!validado.success) {
    throw new ConfiguracaoRecusada(
      `valor invalido para "${linha.chave}" no historico.`,
    );
  }

  const autorId = linha.alterado_por.trim();
  if (autorId === "") {
    throw new ConfiguracaoRecusada(
      `autoria ausente para "${linha.chave}" no historico.`,
    );
  }

  const alteradoEm =
    linha.alterado_em instanceof Date
      ? linha.alterado_em.toISOString()
      : linha.alterado_em;

  return {
    id: Number(linha.id),
    chave: linha.chave,
    valor: validado.data as TipoDe<Chave>,
    moduloDono: definicao.moduloDono,
    autorId,
    motivo: linha.motivo,
    alteradoEm,
  };
}

/**
 * Combina o catalogo com o override vigente e o historico append-only.
 * Chave sem linha continua visivel com o default, mas sem autoria ficticia.
 */
export async function lerConfiguracoesAdministrativas(): Promise<
  readonly ConfiguracaoAdministrativa[]
> {
  const linhasPorChave = new Map<Chave, LinhaHistoricoDeConfig[]>();

  for (const linha of await leitorAdministrativoAtual()) {
    const validada = validarLinhaAdministrativa(linha);
    const historico = linhasPorChave.get(validada.chave) ?? [];
    historico.push(validada);
    linhasPorChave.set(validada.chave, historico);
  }

  return CHAVES.map((chave) => {
    const definicao = CATALOGO[chave];
    const historico = linhasPorChave.get(chave) ?? [];
    const ultima = historico.at(-1);

    return {
      chave,
      tipo: chave.startsWith("flag.") ? "flag" : "param",
      moduloDono: definicao.moduloDono,
      descricao: definicao.descricao,
      padrao: definicao.padrao,
      vigente: {
        valor: ultima?.valor ?? definicao.padrao,
        autorId: ultima?.autorId ?? null,
        motivo: ultima?.motivo ?? null,
        alteradoEm: ultima?.alteradoEm ?? null,
      },
      historico,
    };
  });
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
  opcoes: { autorId: string; motivo: string },
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

  const motivo = opcoes?.motivo;
  if (typeof motivo !== "string" || motivo.trim() === "") {
    throw new ConfiguracaoRecusada(
      `alteracao de "${chave}" sem motivo. Toda mudanca de configuracao precisa explicar por que aconteceu.`,
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
    motivo: motivo.trim(),
  });

  invalidarCache();
}
