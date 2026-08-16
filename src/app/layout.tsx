import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Passou Concursos",
  description: "Preparação para concursos da carreira bancária.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
