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
    <html lang="pt-BR">
      <body className={`${geist.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
