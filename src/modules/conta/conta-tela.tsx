import Link from "next/link";

import { Estado } from "@/modules/ui/estado";
import type { DadosDaTelaDaGarantia } from "@/modules/pagamentos/garantia-tela";
import { fraseDaGarantia } from "@/modules/pagamentos/garantia-tela";

/**
 * A tela de conta do aluno — identidade, assinatura, garantia e apagamento.
 *
 * A garantia mora aqui desde que `/app/reembolso` deixou de existir como rota:
 * era uma tela inteira para um parágrafo e um botão, e o aluno que quer
 * cancelar procura "conta", não "reembolso".
 *
 * As duas abas são LINK, não estado de cliente: a página continua sendo
 * servidor puro, o back do navegador funciona, e dinheiro não divide rolagem
 * com o botão vermelho de apagar — que é uma decisão de humor oposto.
 */

export const ABAS_DA_CONTA = ["assinatura", "privacidade"] as const;
export type AbaDaConta = (typeof ABAS_DA_CONTA)[number];

/** Um `?aba=` de fora nunca vira aba: fora do catálogo, cai na primeira. */
export function abaValida(valor: string | undefined): AbaDaConta {
  return (ABAS_DA_CONTA as readonly string[]).includes(valor ?? "")
    ? (valor as AbaDaConta)
    : "assinatura";
}

export type AssinaturaDaConta = {
  valorFormatado: string;
  meio: string;
  parcelas: number;
  confirmadoEm: string | null;
  estado: string;
  /** Fração de 0 a 1 do período contratado já corrido, ou `null` sem base. */
  progresso: number | null;
};

export type DadosDaConta = {
  email: string;
  /** Fim da matrícula ativa, em ISO. */
  fimDoAcesso: string;
  assinatura: AssinaturaDaConta | null;
  garantia: { tela: DadosDaTelaDaGarantia; dias: number } | null;
};

type AcaoSemEntrada = () => Promise<void>;
type AcaoDeFormulario = (formulario: FormData) => Promise<void>;

const MESES_DA_TRILHA = 12;

const MEIO_EM_TEXTO: Record<string, string> = {
  CREDIT_CARD: "Cartão",
  PIX: "Pix",
  BOLETO: "Boleto",
};

function meioEmTexto(meio: string): string {
  return MEIO_EM_TEXTO[meio] ?? "Pagamento";
}

function dataPorExtenso(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function diasAte(iso: string, agora: Date): number | null {
  const fim = new Date(iso);
  if (Number.isNaN(fim.getTime())) return null;
  const dias = Math.ceil((fim.getTime() - agora.getTime()) / 86_400_000);
  return dias > 0 ? dias : null;
}

/* ═══════════════════════════════════════════════════════ cabeçalho e abas ══ */

function Identidade({ email }: { email: string }) {
  return (
    <div className="mt-7 flex items-center gap-3.5 border-b border-linha pb-5">
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-[0.875rem] bg-marca-suave text-[1.0625rem] font-semibold text-marca"
      >
        {email.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[0.9375rem] font-medium">{email}</p>
        <p className="mt-0.5 text-[0.8125rem] text-suave">
          É para este e-mail que vão os avisos da sua conta.
        </p>
      </div>
      <span className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-pill bg-marca-suave px-3 py-1.5 text-xs font-medium text-marca">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
        Matrícula ativa
      </span>
    </div>
  );
}

function Abas({ atual }: { atual: AbaDaConta }) {
  const abas: { id: AbaDaConta; nome: string }[] = [
    { id: "assinatura", nome: "Assinatura e garantia" },
    { id: "privacidade", nome: "Privacidade e dados" },
  ];

  return (
    <nav aria-label="Seções da conta" className="-mb-px mt-6 flex gap-7 border-b border-linha">
      {abas.map((aba) => (
        <Link
          key={aba.id}
          href={`/app/conta?aba=${aba.id}`}
          aria-current={aba.id === atual ? "page" : undefined}
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            aba.id === atual
              ? "border-marca text-texto"
              : "border-transparent text-suave hover:text-texto"
          }`}
        >
          {aba.nome}
        </Link>
      ))}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════ assinatura (o breu) ══ */

/**
 * O único cartão breu da tela — a cota que o AD-111 raciona.
 *
 * Ele responde "até quando eu tenho acesso e o que eu paguei", que é a
 * primeira pergunta de quem abre a conta.
 */
function Assinatura({
  dados,
  agora,
}: {
  dados: DadosDaConta;
  agora: Date;
}) {
  const fim = dataPorExtenso(dados.fimDoAcesso);
  const restam = diasAte(dados.fimDoAcesso, agora);
  const assinatura = dados.assinatura;
  const preenchidos =
    assinatura?.progresso === null || assinatura?.progresso === undefined
      ? 0
      : Math.min(
          MESES_DA_TRILHA,
          Math.max(1, Math.ceil(assinatura.progresso * MESES_DA_TRILHA)),
        );

  return (
    <section
      aria-labelledby="titulo-assinatura"
      className="mt-8 rounded-2xl bg-breu px-7 pb-6 pt-6 text-breu-tinta sm:px-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-breu-verde">
            Seu plano
          </p>
          <h2
            id="titulo-assinatura"
            className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-[-0.022em] sm:text-[1.75rem]"
          >
            {fim ? `Seu acesso vai até ${fim}` : "Seu acesso está ativo"}
          </h2>
          <p className="mt-2 text-sm text-breu-suave">
            {restam === null
              ? "Nada é cobrado de novo sem você pedir."
              : `${restam === 1 ? "Falta 1 dia" : `Faltam ${restam} dias`}. Nada é cobrado de novo sem você pedir.`}
          </p>
        </div>

        {assinatura ? (
          <div className="shrink-0 text-right">
            <p className="font-utilitaria text-[1.375rem] font-medium">
              {assinatura.valorFormatado}
            </p>
            <p className="mt-1 text-[0.78125rem] text-breu-suave">
              {meioEmTexto(assinatura.meio)}
              {assinatura.parcelas > 1 ? ` · ${assinatura.parcelas}×` : ""}
            </p>
          </div>
        ) : null}
      </div>

      {assinatura?.progresso !== null && assinatura?.progresso !== undefined ? (
        <div
          className="mt-6"
          role="img"
          aria-label={`Período contratado: ${preenchidos} de ${MESES_DA_TRILHA} meses corridos`}
        >
          <div className="flex gap-1">
            {Array.from({ length: MESES_DA_TRILHA }, (_, indice) => (
              <span
                key={indice}
                className={`h-1.5 flex-1 rounded-[3px] ${
                  indice < preenchidos ? "bg-breu-verde" : "bg-breu-linha"
                }`}
              />
            ))}
          </div>
          <p className="mt-2.5 text-right font-utilitaria text-[0.6875rem] text-breu-suave">
            mês {preenchidos} de {MESES_DA_TRILHA}
          </p>
        </div>
      ) : null}

      {assinatura ? (
        <dl className="mt-5 flex flex-wrap gap-x-9 gap-y-4 border-t border-breu-linha pt-5">
          <div>
            <dt className="font-utilitaria text-[0.65625rem] uppercase tracking-[0.14em] text-breu-suave">
              Pagamento confirmado
            </dt>
            <dd className="mt-1.5 text-sm">
              {dataPorExtenso(assinatura.confirmadoEm) ?? "Ainda não confirmado"}
            </dd>
          </div>
          <div>
            <dt className="font-utilitaria text-[0.65625rem] uppercase tracking-[0.14em] text-breu-suave">
              Situação
            </dt>
            <dd className="mt-1.5 text-sm capitalize">{assinatura.estado}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════ garantia ══ */

function Regua({ diaAtual, dias }: { diaAtual: number; dias: number }) {
  return (
    <ol
      className="flex gap-1.5"
      aria-label={`Garantia: dia ${diaAtual} de ${dias}`}
    >
      {Array.from({ length: dias }, (_, indice) => {
        const numero = indice + 1;
        const hoje = numero === diaAtual;
        const passado = numero < diaAtual;
        return (
          <li
            key={numero}
            aria-hidden="true"
            className={`flex h-9 flex-1 items-end justify-center rounded-lg border pb-1.5 font-utilitaria text-[0.6875rem] ${
              hoje
                ? "border-marca bg-marca font-medium text-painel"
                : passado
                  ? "border-marca/30 bg-marca-suave text-marca"
                  : "border-linha bg-fundo-suave text-suave"
            }`}
          >
            {numero}
          </li>
        );
      })}
    </ol>
  );
}

function Garantia({
  garantia,
  pedirReembolso,
}: {
  garantia: { tela: DadosDaTelaDaGarantia; dias: number };
  pedirReembolso: AcaoSemEntrada;
}) {
  const frase = fraseDaGarantia(garantia.tela, garantia.dias);
  const disponivel = garantia.tela.resultado.disponivel;

  return (
    <section aria-labelledby="titulo-garantia" className="mt-11">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-linha pb-3.5">
        <h2 id="titulo-garantia" className="text-[1.3125rem] font-semibold tracking-[-0.015em]">
          Garantia de {garantia.dias} dias
        </h2>
        <p className="text-[0.8125rem] text-suave">
          Dias corridos desde a confirmação do pagamento
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          {frase.diaAtual === null ? (
            <p className="flex h-9 items-center justify-center rounded-lg border border-dashed border-linha bg-fundo-suave px-4 text-[0.78125rem] text-suave">
              a contagem começa na confirmação do pagamento
            </p>
          ) : (
            <Regua diaAtual={frase.diaAtual} dias={garantia.dias} />
          )}
          <p className="mt-4 text-[0.9375rem] leading-6">{frase.titulo}</p>
          <p className="mt-2 max-w-[46ch] text-[0.84375rem] leading-6 text-suave">
            {frase.nota}
          </p>
        </div>

        <div className="sm:w-[14.5rem] sm:shrink-0">
          {disponivel ? (
            <form action={pedirReembolso}>
              <button
                type="submit"
                className="flex min-h-11 w-full items-center justify-center rounded-pill border border-linha bg-painel px-4 text-[0.90625rem] font-medium text-texto transition-colors hover:border-erro hover:text-erro"
              >
                Quero meu dinheiro de volta
              </button>
              <p className="mt-2.5 text-xs leading-5 text-suave">
                Pedimos o estorno ao banco na hora. O acesso é encerrado assim que o
                estorno for confirmado.
              </p>
            </form>
          ) : (
            <p
              role="status"
              className="rounded-card bg-fundo-suave px-4 py-3.5 text-[0.84375rem] leading-6 text-suave"
            >
              {garantia.tela.recusa ??
                "O pedido não está disponível para este pagamento."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════ privacidade e LGPD ══ */

const SAI = [
  "Suas respostas e sessões de estudo",
  "Seu plano e seu progresso",
  "Seu caderno de erros",
  "Sequência e folgas",
  "Matrícula e dados operacionais da conta",
];

const FICA = [
  "Faturas e o aceite dos termos",
  "O mínimo de registro financeiro exigido pelo fisco",
  "O que a reconciliação contábil precisa conferir",
];

const PASSOS = [
  {
    numero: "01",
    titulo: "Apagamos os dados",
    texto: "Tudo o que está na coluna da esquerda sai primeiro.",
  },
  {
    numero: "02",
    titulo: "Enviamos a confirmação",
    texto: "Um e-mail para você, comprovando o que foi apagado.",
  },
  {
    numero: "03",
    titulo: "Encerramos o acesso",
    texto: "Se o e-mail falhar, o acesso continua e o pedido pode ser retomado.",
  },
];

function Destinos() {
  return (
    <div className="mt-6 grid gap-8 sm:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] sm:gap-0">
      <div className="sm:pr-8">
        <h3 className="text-[0.9375rem] font-semibold">Some para sempre</h3>
        <ul className="mt-4 grid gap-2.5">
          {SAI.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-6 text-suave">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-erro" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-6 text-suave">
          Inclusive nos backups. Não há como recuperar depois.
        </p>
      </div>

      <div aria-hidden="true" className="hidden bg-linha sm:block" />

      <div className="sm:pl-8">
        <h3 className="text-[0.9375rem] font-semibold">Continua guardado</h3>
        <ul className="mt-4 grid gap-2.5">
          {FICA.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-6 text-suave">
              <span
                aria-hidden="true"
                className="mt-2.5 size-1.5 shrink-0 rounded-full bg-marca-viva"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-6 text-suave">
          Obrigação legal — e esses dados não voltam a alimentar o produto.
        </p>
      </div>
    </div>
  );
}

function Privacidade({
  solicitarEsquecimento,
}: {
  solicitarEsquecimento: AcaoDeFormulario;
}) {
  return (
    <>
      <section aria-labelledby="titulo-destinos" className="mt-9">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-linha pb-3.5">
          <h2 id="titulo-destinos" className="text-[1.3125rem] font-semibold tracking-[-0.015em]">
            Se você apagar a conta
          </h2>
          <p className="text-[0.8125rem] text-suave">
            O que sai e o que a lei obriga a guardar
          </p>
        </div>

        <Destinos />

        <ol className="mt-7 grid gap-px overflow-hidden rounded-card border border-linha bg-linha sm:grid-cols-3">
          {PASSOS.map((passo) => (
            <li key={passo.numero} className="bg-painel px-5 py-4">
              <p className="font-utilitaria text-[0.6875rem] tracking-[0.12em] text-suave">
                {passo.numero}
              </p>
              <h3 className="mt-2 text-[0.90625rem] font-semibold">{passo.titulo}</h3>
              <p className="mt-1.5 text-[0.8125rem] leading-6 text-suave">{passo.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="titulo-apagamento"
        className="mt-6 rounded-card border border-erro/40 bg-erro-fundo px-6 py-6 sm:px-7"
      >
        <h2 id="titulo-apagamento" className="text-[1.1875rem] font-semibold tracking-[-0.012em]">
          Apagar minha conta
        </h2>
        <p className="mt-2.5 max-w-[56ch] text-sm leading-6">
          Isto não tem volta e não é o mesmo que pedir reembolso. Se você quer o
          dinheiro de volta dentro do prazo da garantia, o pedido fica na aba{" "}
          <Link href="/app/conta?aba=assinatura" className="font-semibold underline">
            Assinatura e garantia
          </Link>
          .
        </p>

        <form action={solicitarEsquecimento} className="mt-5 max-w-[21rem]">
          <label className="block text-[0.84375rem] font-medium" htmlFor="confirmacao">
            Para confirmar, digite{" "}
            <span className="font-utilitaria tracking-[0.06em] text-erro">APAGAR</span>
          </label>
          <input
            id="confirmacao"
            name="confirmacao"
            required
            autoComplete="off"
            className="mt-2 min-h-11 w-full rounded-[0.625rem] border border-erro/35 bg-painel px-3.5 font-utilitaria text-[0.9375rem] text-texto"
          />
          <button
            type="submit"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-pill bg-erro px-6 font-semibold text-white transition hover:brightness-95"
          >
            Apagar dados e conta
          </button>
        </form>
      </section>

      <section aria-labelledby="titulo-direitos" className="mt-11">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-linha pb-3.5">
          <h2 id="titulo-direitos" className="text-[1.3125rem] font-semibold tracking-[-0.015em]">
            Seus dados
          </h2>
          <p className="text-[0.8125rem] text-suave">Outros direitos previstos na LGPD</p>
        </div>
        <p className="mt-5 max-w-[58ch] text-sm leading-6 text-suave">
          Precisa exercer outro direito, como acesso ou correção? No lançamento,
          esse atendimento é feito manualmente pelo canal de privacidade informado
          na{" "}
          <Link href="/privacidade" className="font-medium underline">
            política de privacidade
          </Link>
          .
        </p>
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ tela ══ */

export function ContaTela({
  aba,
  dados,
  resultado,
  agora,
  solicitarEsquecimento,
  pedirReembolso,
}: {
  aba: AbaDaConta;
  dados: DadosDaConta;
  resultado?: string;
  agora: Date;
  solicitarEsquecimento: AcaoDeFormulario;
  pedirReembolso: AcaoSemEntrada;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Conta
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-[-0.028em]">
          Sua conta
        </h1>
        <p className="mt-3.5 max-w-[52ch] text-corpo text-suave">
          Seu acesso, sua garantia e seus dados — tudo o que é seu, num lugar só.
        </p>
      </header>

      <Identidade email={dados.email} />
      <Abas atual={aba} />

      <Avisos resultado={resultado} />

      {aba === "assinatura" ? (
        <>
          <Assinatura dados={dados} agora={agora} />
          {dados.garantia ? (
            <Garantia garantia={dados.garantia} pedirReembolso={pedirReembolso} />
          ) : (
            <section aria-labelledby="titulo-sem-garantia" className="mt-11">
              <div className="border-b border-linha pb-3.5">
                <h2
                  id="titulo-sem-garantia"
                  className="text-[1.3125rem] font-semibold tracking-[-0.015em]"
                >
                  Garantia
                </h2>
              </div>
              <p className="mt-5 text-sm leading-6 text-suave">
                Não há um pagamento confirmado para consultar.
              </p>
            </section>
          )}
        </>
      ) : (
        <Privacidade solicitarEsquecimento={solicitarEsquecimento} />
      )}
    </div>
  );
}

/**
 * Os avisos que voltam por `?resultado=`.
 *
 * Nenhum deles imprime texto vindo de fora: o parâmetro só ESCOLHE qual frase
 * fixa aparece. É o que impede um link de terceiro de escrever na tela do
 * aluno — e o motivo de não existir um `default` que ecoe o valor recebido.
 */
function Avisos({ resultado }: { resultado?: string }) {
  if (!resultado) return null;

  if (resultado === "confirmacao") {
    return (
      <div className="mt-6">
        <Estado tipo="degradado" oQueCaiu="A confirmação não foi reconhecida" />
      </div>
    );
  }

  if (resultado === "erro") {
    return (
      <div className="mt-6">
        <Estado tipo="erro" />
      </div>
    );
  }

  if (resultado === "solicitado") {
    return (
      <p
        role="status"
        className="mt-6 rounded-card border border-marca/30 bg-marca-suave px-4 py-3 text-sm leading-6 text-marca"
      >
        Reembolso confirmado. O acesso foi encerrado.
      </p>
    );
  }

  if (resultado === "pendente") {
    return (
      <p
        role="status"
        className="mt-6 rounded-card border border-aviso/40 bg-conquista-fundo px-4 py-3 text-sm leading-6 text-conquista"
      >
        Seu pedido ficou em análise. O acesso continua até a confirmação do estorno,
        e não é preciso pedir de novo.
      </p>
    );
  }

  if (resultado === "recusado") {
    return (
      <p
        role="status"
        className="mt-6 rounded-card border border-linha bg-painel px-4 py-3 text-sm leading-6 text-suave"
      >
        Não há um pagamento disponível para reembolso nesta conta.
      </p>
    );
  }

  return null;
}
