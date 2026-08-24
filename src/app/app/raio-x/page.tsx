import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { isFlagOn } from "@/modules/config";
import { consultarRaioX } from "@/modules/raiox";
import { RaioXTela } from "@/modules/raiox/tela";
import { Estado } from "@/modules/ui/estado";

/**
 * A superfície do Raio-X nasce atrás da flag global. A guarda vem antes dela e
 * antes da leitura do acervo: quem não tem matrícula não descobre nem o estado
 * interno dessa tela.
 */
export default async function RaioX() {
  await exigirMatriculaAtiva();

  const ligado = await isFlagOn("flag.m5.raiox");
  const dados = ligado ? await consultarRaioX() : null;

  return (
    <div className="mx-auto max-w-3xl">
      {dados ? (
        <RaioXTela dados={dados} />
      ) : (
        <Estado
          tipo="vazio"
          titulo="O Raio-X está em preparação"
          acao="A leitura da frequência real ficará disponível quando esta superfície for ligada."
        />
      )}
    </div>
  );
}
