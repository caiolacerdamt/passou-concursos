import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--fonte-geist", display: "swap" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--fonte-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Passou Concursos",
  description: "Preparação para concursos da carreira bancária.",
};

/**
 * `width=device-width` e o que faz o telefone parar de fingir que tem 980px de
 * largura. Sem isto, o layout mobile-first do UI-01 nao chega a ser exercitado:
 * o navegador renderiza a versao de desktop encolhida.
 *
 * `maximumScale` fica de fora **de proposito** — travar o zoom quebra UI-03.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
     * `suppressHydrationWarning` cobre UM caso e é o idiomático para ele: o
     * layout da landing escreve `sc-armado` no `<html>` por script inline,
     * durante o parse, para armar o esconde-esconde do motor antes da primeira
     * pintura. O servidor não emitiu essa classe, então o React acusa
     * divergência de atributo no `<html>` — barulho no console por um atributo
     * que É para divergir. A supressão vale só neste elemento e não desce para
     * os filhos.
     */
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
