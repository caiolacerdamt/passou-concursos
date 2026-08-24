import { salvarOnboarding } from "../acoes";
import { renderizarPainelDoPlano } from "@/modules/aluno/plano-pagina";

/** Visualização completa do ciclo, compartilhando a leitura e as regras de Hoje. */
export default async function Plano({ searchParams }: PageProps<"/app/plano">) {
  return renderizarPainelDoPlano({
    searchParams,
    superficie: "plano",
    acaoDeOnboarding: salvarOnboarding,
  });
}
