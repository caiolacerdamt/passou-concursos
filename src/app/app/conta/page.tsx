import Link from "next/link";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { Estado } from "@/modules/ui/estado";
import { Shell } from "@/modules/ui/shell";

import { sair } from "../../entrar/acoes";
import { solicitarEsquecimento } from "./acoes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Conta({
  searchParams,
}: {
  searchParams: Promise<{ resultado?: string }>;
}) {
  await exigirMatriculaAtiva();
  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();

  if (!user) {
    redirect("/entrar?proximo=%2Fapp%2Fconta");
  }

  const parametros = await searchParams;

  return (
    <Shell
      acoes={
        <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <Link href="/app" className="text-marca underline">Plano</Link>
          <Link href="/app/progresso" className="text-marca underline">Progresso</Link>
          <form action={sair}>
            <button type="submit" className="text-marca underline">Sair</button>
          </form>
        </div>
      }
      largura="leitura"
    >
      <div className="space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Conta e privacidade</p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            Você decide o que fica.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-suave">
            O pedido abaixo apaga seus dados de estudo e invalida sua conta. É uma ação definitiva.
          </p>
        </header>

        {parametros.resultado === "confirmacao" ? (
          <Estado
            tipo="degradado"
            oQueCaiu="A confirmação não foi reconhecida"
          />
        ) : null}
        {parametros.resultado === "erro" ? <Estado tipo="erro" /> : null}

        <section className="grid gap-4 sm:grid-cols-2" aria-label="Efeito do apagamento">
          <div className="rounded-card border border-linha bg-painel p-5 shadow-card">
            <h2 className="text-xl font-semibold">Será apagado</h2>
            <p className="mt-2 text-sm leading-6 text-suave">
              Respostas, sessões, plano, progresso, caderno de erros, sequência, folgas, matrícula e dados operacionais ligados à sua conta.
            </p>
          </div>
          <div className="rounded-card border border-linha bg-painel p-5 shadow-card">
            <h2 className="text-xl font-semibold">Pode permanecer</h2>
            <p className="mt-2 text-sm leading-6 text-suave">
              Faturas, aceite e o mínimo de registros financeiros necessários para cumprir obrigações fiscais e atender a reconciliação.
            </p>
          </div>
        </section>

        <section className="rounded-card border border-erro/40 bg-painel p-5 shadow-card sm:p-6" aria-labelledby="titulo-apagamento">
          <h2 id="titulo-apagamento" className="text-2xl font-semibold">Apagar minha conta</h2>
          <p className="mt-2 text-sm leading-6 text-suave">
            O fluxo primeiro apaga os dados operacionais, depois tenta enviar uma confirmação para o seu e-mail e só então invalida o acesso. Se o envio falhar, a conta não é invalidada e o pedido pode ser retomado.
          </p>
          <form action={solicitarEsquecimento} className="mt-6 space-y-4">
            <label className="grid gap-2 text-sm font-semibold" htmlFor="confirmacao">
              Para confirmar, digite <span className="font-utilitaria text-erro">APAGAR</span>
              <input
                id="confirmacao"
                name="confirmacao"
                required
                autoComplete="off"
                className="min-h-11 rounded-lg border border-linha bg-fundo px-3 font-normal text-texto"
              />
            </label>
            <input type="hidden" name="user_id" value="não usado" />
            <button type="submit" className="rounded-lg bg-erro px-5 py-3 font-semibold text-white hover:brightness-95">
              Apagar dados e conta
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-suave">
            Precisa exercer outro direito, como acesso ou correção? No lançamento, esse atendimento é feito manualmente pelo canal de privacidade informado na política.
          </p>
        </section>
      </div>
    </Shell>
  );
}
