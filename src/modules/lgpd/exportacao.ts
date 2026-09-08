import { clienteDeServico } from "@/lib/db/servidor";
import { reportarErro } from "@/modules/observabilidade/reporte";

import { TABELAS_GRUPO_1, TABELAS_GRUPO_1_INDIRETAS } from "./grupo-1";

/**
 * O acesso aos próprios dados, em JSON (LGPD art. 18, II).
 *
 * **O coração do arquivo é que ele não enumera tabela nenhuma.** Ele itera
 * `TABELAS_GRUPO_1`, que é o inventário que o teste de banco em
 * `tests/db/grupo-1.test.ts` obriga a manter completo: aquele teste pergunta ao
 * Postgres se existe tabela com `user_id` fora da lista e **falha** quando
 * alguém cria uma e esquece de registrá-la. Amarrada à lista, a exportação
 * ganha a tabela nova no mesmo dia — de graça. Um `select` por tabela escrito à
 * mão perderia essa carona e envelheceria em silêncio, que é o modo de falha
 * que importa aqui: ninguém percebe que o JSON parou de trazer uma parte.
 *
 * **Por que o cliente de serviço, e não a RLS.** Parte das tabelas tem
 * `revoke all ... from authenticated` — `solicitacoes_esquecimento` é uma
 * delas. Uma exportação por RLS devolveria essas tabelas **vazias**, sem erro
 * nenhum: o titular receberia um JSON que parece completo e não é. Em troca, o
 * filtro por dono passa a ser responsabilidade deste arquivo, e ele só aceita
 * o `user_id` que a rota tirou do **cookie de sessão** — nunca de formulário,
 * nunca de query string.
 */

/**
 * Teto de linhas por tabela. `tentativas` é particionada e é a maior de todas;
 * sem teto, um aluno antigo derrubaria a resposta.
 *
 * Estourar o teto **não** é silencioso: a tabela sai marcada como truncada e
 * diz quantas linhas ficaram de fora. Um JSON incompleto sem aviso seria pior
 * que um erro, porque o titular arquivaria o arquivo achando que tem tudo.
 */
export const TETO_DE_LINHAS_POR_TABELA = 2_000;

/**
 * Prefixos de coluna que nunca saem no JSON.
 *
 * São artefato de gateway — identificador do Asaas, URL de cobrança, QR de Pix,
 * payload de webhook. Não são dado do titular sobre ele mesmo, e alguns ainda
 * valem como capability: uma URL de cobrança num arquivo que o aluno guarda no
 * e-mail é superfície de graça para quem não deveria ter.
 *
 * Por prefixo, e não por lista fechada de colunas, de propósito: a coluna de
 * gateway que a próxima migration criar já nasce fora do JSON.
 */
const PREFIXOS_DE_COLUNA_OCULTA = ["asaas_", "resultado_"];

/**
 * Registro financeiro que **entra** na exportação. É dado do titular: o que ele
 * comprou, quando e por quanto.
 *
 * `pagamentos` tem `user_id` próprio, então cabe na mesma varredura das outras.
 */
export const TABELAS_FINANCEIRAS_EXPORTADAS = ["pagamentos"] as const;

/**
 * O que fica **fora**, com o motivo escrito ao lado.
 *
 * Todas estas se alcançam por `pagamento_id`, não por `user_id` — e a rota do
 * `pagamento_id` não está declarada em inventário nenhum. Escrevê-la aqui seria
 * exatamente o `select` à mão que este arquivo existe para evitar, e sem o
 * teste de banco por trás para avisar quando envelhecesse.
 *
 * O conteúdo delas também não é o que o titular procura: evento de webhook,
 * transição de estado e fila de pendência são plumbing operacional. A nota
 * fiscal, que **seria** procurada, já está fora por decisão do plano — ela vem
 * junto do comprovante na conta, em outra rodada.
 */
export const FORA_DA_EXPORTACAO: { tabela: string; motivo: string }[] = [
  {
    tabela: "pagamento_aceites",
    motivo:
      "Alcancada por pagamento_id, sem rota declarada em inventario; o aceite sai junto do comprovante, em outra rodada.",
  },
  {
    tabela: "pagamento_eventos",
    motivo:
      "Payload de webhook do gateway: plumbing operacional, nao e o dado que o titular procura sobre si.",
  },
  {
    tabela: "pagamento_transicoes",
    motivo:
      "Log interno de mudanca de estado da cobranca, alcancado por pagamento_id e sem valor para o titular.",
  },
  {
    tabela: "faturas",
    motivo:
      "Nota fiscal ficou fora por decisao do plano: sai junto do comprovante na conta, em outra rodada.",
  },
  {
    tabela: "pagamento_pendencias",
    motivo:
      "Fila operacional de retry e auditoria interna, alcancada por pagamento_id; nao descreve o titular.",
  },
];

export type Titular = { id: string; email: string };

export type TabelaExportada = {
  linhas: Record<string, unknown>[];
  /** `true` quando o teto cortou linhas. */
  truncada: boolean;
  /** Quantas linhas ficaram de fora, ou `null` se nem o total foi legível. */
  linhas_omitidas: number | null;
  /** Preenchido quando a leitura falhou. A tabela some do JSON, o aviso não. */
  erro?: string;
};

export type Exportacao = {
  gerado_em: string;
  titular: Titular;
  /**
   * `false` quando alguma tabela falhou ou foi truncada. É a leitura de uma
   * linha só para quem abrir o arquivo e quiser saber se pode confiar nele.
   */
  completa: boolean;
  tabelas: Record<string, TabelaExportada>;
};

type Filtro = {
  eq: (coluna: string, valor: string) => Filtro;
  in: (coluna: string, valores: readonly string[]) => Filtro;
  limit: (n: number) => PromiseLike<{
    data: Record<string, unknown>[] | null;
    error: unknown;
    count?: number | null;
  }>;
};

type Leitor = {
  from: (tabela: string) => {
    select: (colunas: string, opcoes?: { count: "exact" }) => Filtro;
  };
};

/** Tira do registro as colunas de gateway, sem tocar no resto. */
function semColunasDeGateway(linha: Record<string, unknown>): Record<string, unknown> {
  const limpa: Record<string, unknown> = {};
  for (const [coluna, valor] of Object.entries(linha)) {
    if (PREFIXOS_DE_COLUNA_OCULTA.some((prefixo) => coluna.startsWith(prefixo))) continue;
    limpa[coluna] = valor;
  }
  return limpa;
}

function tabelaComErro(erro: unknown, tabela: string): TabelaExportada {
  reportarErro(erro, { modulo: "lgpd", operacao: "exportar_dados", tabela });
  return {
    linhas: [],
    truncada: false,
    linhas_omitidas: null,
    // A mensagem é fixa: detalhe de banco num arquivo que o aluno guarda e
    // encaminha é vazamento de estrutura interna sem ganho nenhum para ele.
    erro: "não foi possível ler esta tabela",
  };
}

async function lerTabela(
  cliente: Leitor,
  tabela: string,
  filtrar: (consulta: Filtro) => Filtro,
): Promise<TabelaExportada> {
  try {
    const { data, error, count } = await filtrar(
      cliente.from(tabela).select("*", { count: "exact" }),
    ).limit(TETO_DE_LINHAS_POR_TABELA);

    if (error) throw error;

    const linhas = (data ?? []).map(semColunasDeGateway);
    const total = typeof count === "number" ? count : null;
    const omitidas = total === null ? null : Math.max(0, total - linhas.length);

    return {
      linhas,
      // Sem `count` legível, o único sinal honesto de corte é ter batido no
      // teto exatamente. Preferir "truncada" a "completa" no empate: dizer
      // completa e estar errado é o erro que ninguém detecta depois.
      truncada: omitidas === null ? linhas.length >= TETO_DE_LINHAS_POR_TABELA : omitidas > 0,
      linhas_omitidas: omitidas,
    };
  } catch (erro) {
    return tabelaComErro(erro, tabela);
  }
}

/**
 * Monta o JSON do titular.
 *
 * `titular.id` **tem** que vir do cookie de sessão. Este módulo não sabe de
 * onde ele veio e não tem como saber — é a rota que garante isso, e é por isso
 * que ela não aceita id de lugar nenhum além da sessão.
 */
export async function exportarDadosDoTitular(
  titular: Titular,
  cliente: Leitor = clienteDeServico() as unknown as Leitor,
): Promise<Exportacao> {
  const tabelas: Record<string, TabelaExportada> = {};

  /*
   * A lista, e não uma enumeração à mão. Trocar este `for` por `select`s
   * literais é o único jeito de a exportação envelhecer sem ninguém notar — e o
   * teste "percorre TABELAS_GRUPO_1" existe para deixar isso vermelho.
   */
  const diretas = [...TABELAS_GRUPO_1, ...TABELAS_FINANCEIRAS_EXPORTADAS];
  for (const tabela of diretas) {
    tabelas[tabela] = await lerTabela(cliente, tabela, (consulta) =>
      consulta.eq("user_id", titular.id),
    );
  }

  /*
   * As indiretas não têm `user_id` e a varredura por dono não as encontra. Cada
   * uma declara por onde é alcançada, e o pai já foi lido acima — então o filho
   * sai dos ids que sobraram lá, sem uma segunda consulta ao pai.
   */
  for (const indireta of TABELAS_GRUPO_1_INDIRETAS) {
    const [tabelaPai] = indireta.alcancada_por.split(".");
    const paiExportado = tabelas[tabelaPai];

    if (!paiExportado || paiExportado.erro) {
      tabelas[indireta.tabela] = tabelaComErro(
        new Error(`pai ${tabelaPai} indisponível`),
        indireta.tabela,
      );
      continue;
    }

    const ids = paiExportado.linhas
      .map((linha) => linha.id)
      .filter((id): id is string => typeof id === "string");

    if (ids.length === 0) {
      tabelas[indireta.tabela] = { linhas: [], truncada: false, linhas_omitidas: 0 };
      continue;
    }

    const filha = await lerTabela(cliente, indireta.tabela, (consulta) =>
      consulta.in(indireta.coluna_local, ids),
    );

    /*
     * Pai truncado é filho incompleto, mesmo que o filho caiba inteiro no teto:
     * os blocos dos dias que não vieram nunca chegaram a ser pedidos. Sem esta
     * linha, `plano_bloco` sairia marcado como completo e não estaria.
     */
    tabelas[indireta.tabela] = paiExportado.truncada
      ? { ...filha, truncada: true }
      : filha;
  }

  const completa = Object.values(tabelas).every(
    (tabela) => !tabela.erro && !tabela.truncada,
  );

  return {
    gerado_em: new Date().toISOString(),
    titular,
    completa,
    tabelas,
  };
}

/** Quantas linhas o arquivo levou, somando todas as tabelas. */
export function totalDeLinhas(exportacao: Exportacao): number {
  return Object.values(exportacao.tabelas).reduce(
    (soma, tabela) => soma + tabela.linhas.length,
    0,
  );
}

/** `passou-concursos-dados-2026-09-08.json` */
export function nomeDoArquivo(gerado_em: string): string {
  const dia = gerado_em.slice(0, 10);
  return `passou-concursos-dados-${/^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : "export"}.json`;
}

type Escritor = {
  from: (tabela: string) => {
    insert: (linha: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  };
};

/**
 * Registra que o pedido existiu (DADOS-05: o exercício do direito é auditável).
 *
 * **Não** reusa `solicitacoes_esquecimento`: lá o `user_id` é *primary key* e o
 * estado passa por um `check` fechado do apagamento. Enfiar exportação naquela
 * tabela travaria a fila do esquecimento no segundo pedido do mesmo aluno.
 *
 * Falhar aqui **não** derruba a exportação. O direito do titular é receber o
 * arquivo; o registro é nosso controle interno, e negar o arquivo porque o
 * nosso controle caiu seria punir o aluno por um problema que é nosso.
 */
export async function registrarPedidoDeExportacao(
  userId: string,
  resumo: { linhas_exportadas: number; truncada: boolean },
  cliente: Escritor = clienteDeServico() as unknown as Escritor,
): Promise<void> {
  try {
    const { error } = await cliente.from("solicitacoes_exportacao").insert({
      user_id: userId,
      linhas_exportadas: resumo.linhas_exportadas,
      truncada: resumo.truncada,
    });
    if (error) throw error;
  } catch (erro) {
    reportarErro(erro, { modulo: "lgpd", operacao: "registrar_pedido_de_exportacao" });
  }
}
