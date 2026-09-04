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
     * o script abaixo escreve `sc-armado` no `<html>` por script inline,
     * durante o parse, para armar o esconde-esconde do motor antes da primeira
     * pintura. O servidor não emitiu essa classe, então o React acusa
     * divergência de atributo no `<html>` — barulho no console por um atributo
     * que É para divergir. A supressão vale só neste elemento e não desce para
     * os filhos.
     */
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable}`}>
        {/*
         * Arma o esconde-esconde do motor da landing. `scrollcraft.css` zera a
         * opacidade de todo `[data-sc-in]` e só o motor devolve; sem esta
         * classe, `landing.css` mantém o texto visível, então JS ausente ou
         * quebrado nunca apaga conteúdo. Inline e não `<Script>`: precisa rodar
         * durante o parse, antes da primeira pintura — um script assíncrono
         * chegaria depois do primeiro quadro e o texto piscaria.
         *
         * Mora no layout raiz e não no layout da landing porque o raiz é o
         * único que o React nunca recria no cliente. Renderizado lá embaixo,
         * ele deixava de existir em navegação client-side (React só executa
         * script que veio no HTML do servidor) e o console acusava em dev.
         *
         * Estar em toda rota não vaza nada: as regras que leem `sc-armado`
         * exigem `.lp` no seletor, e `.lp` só existe dentro do grupo
         * `(landing)`.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("sc-armado")`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
