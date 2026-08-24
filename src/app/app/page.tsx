import { renderizarPainelDoPlano } from "@/modules/aluno/plano-pagina";

import { salvarOnboarding } from "./acoes";

/** A primeira tela logada do aluno, orientada ao próximo bloco do dia. */
export default async function App({ searchParams }: PageProps<"/app">) {
  return renderizarPainelDoPlano({
    searchParams,
    superficie: "hoje",
    acaoDeOnboarding: salvarOnboarding,
  });
}
