import { exigirMatriculaAtiva } from "@/modules/conta/matricula";

import App from "../page";

/** Atalho explícito para o plano, preservando Hoje como a entrada do painel. */
export default async function Plano({ searchParams }: PageProps<"/app/plano">) {
  await exigirMatriculaAtiva();
  return App({
    params: Promise.resolve({}),
    searchParams,
  } as PageProps<"/app">);
}

