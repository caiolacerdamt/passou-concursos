import { Geist, Geist_Mono } from "next/font/google";

/**
 * Camada visual da landing (modo Persuade, `DESIGN.md`).
 *
 * O grupo `(landing)` nao aparece na URL: a rota continua sendo `/`. Ele existe
 * para que a Geist e o papel quente vistam **so** a superficie de venda — o app
 * logado segue na pilha de fonte do sistema e nos tokens frios da SPEC 07, e
 * nao herda nada daqui.
 *
 * A fonte fica no layout e nao na pagina por um motivo mecanico: `next/font`
 * depende do transform do SWC, que o Vitest nao roda. Com a chamada aqui, a
 * pagina continua renderizavel em teste unitario — e `page.test.tsx` e quem
 * guarda o AC de PAG-08.
 *
 * O `next/font` baixa e hospeda a fonte no build: nenhuma requisicao ao Google
 * em execucao, e nenhum salto de layout quando ela chega.
 */
const geist = Geist({ subsets: ["latin"], variable: "--fonte-geist", display: "swap" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--fonte-geist-mono",
  display: "swap",
});

export default function LayoutDaLanding({ children }: LayoutProps<"/">) {
  return (
    <div
      className={`lp ${geist.variable} ${geistMono.variable} min-h-dvh bg-papel font-lp text-tinta`}
    >
      {children}
    </div>
  );
}
