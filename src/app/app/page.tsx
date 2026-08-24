import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { renderizarPainelDoPlano } from "@/modules/aluno/plano-pagina";

import { salvarOnboarding } from "./acoes";

/** A primeira tela logada do aluno, orientada ao próximo bloco do dia. */
export default async function App({ searchParams }: PageProps<"/app">) {
  await exigirMatriculaAtiva();
  return renderizarPainelDoPlano({
    searchParams,
    superficie: "hoje",
    acaoDeOnboarding: salvarOnboarding,
  });
}
