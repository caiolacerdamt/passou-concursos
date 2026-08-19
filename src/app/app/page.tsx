import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { Estado } from "@/modules/ui/estado";
import { Shell } from "@/modules/ui/shell";

import { sair } from "../entrar/acoes";

/**
 * A primeira tela logada. O plano do dia de verdade e da SPEC 13 — aqui existe
 * o esqueleto que prova a corrente inteira: sessao → matricula → conteudo.
 */
export default async function App() {
  const matricula = await exigirMatriculaAtiva();

  return (
    <Shell
      acoes={
        <form action={sair}>
          <button type="submit" className="text-marca underline">
            Sair
          </button>
        </form>
      }
    >
      <h1 className="text-2xl font-semibold">Seu estudo</h1>
      <p className="mt-2 text-suave">
        Matrícula ativa até{" "}
        {new Date(matricula.fim_em).toLocaleDateString("pt-BR")}.
      </p>

      <div className="mt-6">
        <Estado
          tipo="vazio"
          titulo="Seu plano do dia ainda não está aqui"
          acao="O plano diário entra na próxima etapa do produto. Enquanto isso, sua conta já está ativa."
        />
      </div>
    </Shell>
  );
}
