import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { isFlagOn } from "@/modules/config";
import { consultarMapaPrioridade, consultarRaioX } from "@/modules/raiox";
import { agruparMapaPorMateria } from "@/modules/raiox/mapa-por-materia";
import { RaioXTela } from "@/modules/raiox/tela";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { Estado } from "@/modules/ui/estado";

import type { DadosRaioX } from "@/modules/raiox";
import type { DadosMapaPorMateria } from "@/modules/raiox/mapa-por-materia";

/**
 * A superfície do Raio-X nasce atrás da flag global. A guarda vem antes dela e
 * antes da leitura do acervo: quem não tem matrícula não descobre nem o estado
 * interno dessa tela.
 */
export default async function RaioX() {
  await exigirMatriculaAtiva();

  const ligado = await isFlagOn("flag.m5.raiox");
  if (!ligado) {
    return (
      <div className="mx-auto max-w-3xl">
        <Estado
          tipo="vazio"
          titulo="O Raio-X está em preparação"
          acao="A leitura da frequência real ficará disponível quando esta superfície for ligada."
        />
      </div>
    );
  }

  const dados = await consultarRaioX();
  const mapa = dados.perfil
    ? await lerMapaComFalha(dados)
    : { dados: null as DadosMapaPorMateria | null };

  return <RaioXTela dados={dados} mapa={dados.perfil ? mapa.dados : undefined} />;
}

async function lerMapaComFalha(
  dados: DadosRaioX,
): Promise<{ dados: DadosMapaPorMateria | null }> {
  try {
    const cliente = await clienteDaSessao();
    const porTopico = await consultarMapaPrioridade(cliente, dados);
    return { dados: agruparMapaPorMateria(dados, porTopico) };
  } catch (erro) {
    reportarErro(erro, { modulo: "raiox", operacao: "consultar_mapa_prioridade" });
    return { dados: null };
  }
}
