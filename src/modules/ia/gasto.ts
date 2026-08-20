import { type TipoDe, getParam } from "@/modules/config";
import { reportarErro } from "@/modules/observabilidade";

/**
 * Acompanhamento de gasto de IA (IA-12).
 *
 * **Alerta, e so alerta.** Nada aqui desliga tarefa, corta tutor ou recusa
 * chamada — foi decisao explicita de 2026-07-23, e e por isso que este arquivo
 * nao tem nenhuma funcao que devolva "pode chamar?". Um teto que desliga sozinho
 * derruba o produto na hora errada; um teto que avisa acorda uma pessoa, que
 * decide.
 */

type Precos = TipoDe<"param.m2.precos_por_modelo">;

export type TokensDaChamada = {
  tokensEntrada: number | null;
  tokensCacheados: number | null;
  tokensSaida: number | null;
};

/** O mes em UTC, no formato que a PK de `ia_alerta_de_gasto` aceita. */
export function periodoDe(momento: Date): string {
  const mes = String(momento.getUTCMonth() + 1).padStart(2, "0");
  return `${momento.getUTCFullYear()}-${mes}`;
}

/**
 * Custo em USD de uma chamada.
 *
 * `null` quando nao da para saber — preco ausente na configuracao ou o provedor
 * nao informou tokens. **Nunca zero nesses casos**: zero mentiria dizendo que a
 * chamada foi de graca, e a soma do mes ficaria menor do que a fatura.
 *
 * `tokensCacheados` e **subconjunto** de `tokensEntrada` (e assim que a
 * Responses API reporta), entao a parte cacheada e descontada da cheia antes de
 * ser cobrada ao preco reduzido. Somar os dois inteiros cobraria a entrada duas
 * vezes.
 */
export function calcularCusto(
  precos: Precos,
  modelo: string,
  tokens: TokensDaChamada,
): number | null {
  const preco = precos[modelo];
  if (preco === undefined) return null;
  if (tokens.tokensEntrada === null || tokens.tokensSaida === null) return null;

  const cacheados = Math.min(
    tokens.tokensCacheados ?? 0,
    tokens.tokensEntrada,
  );
  const cheios = tokens.tokensEntrada - cacheados;
  const precoCacheado = preco.entrada_cacheada ?? preco.entrada;

  const porMilhao =
    cheios * preco.entrada +
    cacheados * precoCacheado +
    tokens.tokensSaida * preco.saida;

  return porMilhao / 1_000_000;
}

/** O que o gasto precisa do banco. Parte do `RepositorioDeIa`. */
export type ContadorDeGasto = {
  /** Soma dos custos conhecidos do periodo, em USD. */
  gastoDoPeriodo(periodo: string): Promise<number>;
  /**
   * Registra o alerta do periodo. **`false` = ja havia um** — e a unicidade da
   * PK que garante "uma vez por periodo", nao um `if` daqui.
   */
  registrarAlerta(
    periodo: string,
    gasto: number,
    teto: number,
  ): Promise<boolean>;
}

/**
 * Confere o gasto do mes e alerta **uma vez** quando passa do teto.
 *
 * Nunca derruba quem chamou: a geracao ja aconteceu e ja foi paga, e falhar a
 * chamada por causa da contabilidade dela seria perder o que se pagou.
 */
export async function conferirGasto(
  contador: ContadorDeGasto,
  momento: Date = new Date(),
): Promise<void> {
  try {
    const [teto, periodo] = [
      await getParam("param.m2.teto_gasto_mensal_usd"),
      periodoDe(momento),
    ];

    const gasto = await contador.gastoDoPeriodo(periodo);
    if (gasto <= teto) return;

    const primeiroDoPeriodo = await contador.registrarAlerta(periodo, gasto, teto);
    if (!primeiroDoPeriodo) return;

    reportarErro(
      new Error(
        `o gasto de IA de ${periodo} passou do teto: US$ ${gasto.toFixed(2)} contra US$ ${teto.toFixed(2)}`,
      ),
      {
        modulo: "ia",
        periodo,
        motivo:
          "teto de gasto ultrapassado; nada foi desligado (IA-12) — a decisao e humana",
      },
    );
  } catch (erro) {
    reportarErro(erro, {
      modulo: "ia",
      motivo: "nao deu para conferir o gasto do mes; a geracao em si nao foi afetada",
    });
  }
}

/** Os precos vigentes. Ausencia e caso normal: custa `null` e segue. */
export async function precosVigentes(): Promise<Precos> {
  return getParam("param.m2.precos_por_modelo");
}
