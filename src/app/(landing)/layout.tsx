import { Geist, Geist_Mono } from "next/font/google";

/*
 * A folha do motor entra ANTES da nossa: as duas declaram tokens no `:root`, e
 * com a mesma especificidade quem vem depois vence. É assim que o remap de
 * marca (`--sc-canvas` e companhia) sobrescreve o padrão escuro do motor.
 *
 * `scrollcraft.css` é cópia literal da skill e não é editada — nem aqui, nem
 * em `landing.css`, que não reestiliza um seletor `[data-sc-*]` sequer.
 */
import "@/modules/ui/landing/scrollcraft.css";
import "@/modules/ui/landing/landing.css";

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
