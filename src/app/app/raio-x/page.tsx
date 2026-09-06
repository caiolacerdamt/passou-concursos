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
  /*
   * A guarda continua sendo a mesma e continua sendo a unica. O tipo devolvido
   * decide so o **escopo** da tela — previa ou completa (AD-133 · item 4).
   */
  const matricula = await exigirMatriculaAtiva();
  const trial = matricula.tipo === "trial";

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

  const sessao = await clienteDaSessao();

  // O `userId` só atravessa com a flag do multi-concurso ligada. É o que
  // sustenta o AC: desligada, esta tela faz a mesma leitura de sempre (AD-139).
  const dados = await consultarRaioX(undefined, await alunoDoMultiConcurso(sessao));
  const mapa = dados.perfil
    ? await lerMapaComFalha(sessao, dados)
    : { dados: null as DadosMapaPorMateria | null };

  return (
    <RaioXTela
      dados={dados}
      mapa={dados.perfil ? mapa.dados : undefined}
      trial={trial}
    />
  );
}

/**
 * O aluno da sessão, **só** quando o multi-concurso está ligado.
 *
 * Com a flag desligada o Raio-X não pergunta quem está lendo: a projeção é a do
 * concurso ativo, para todo mundo, exatamente como antes desta spec.
 */
async function alunoDoMultiConcurso(
  sessao: Awaited<ReturnType<typeof clienteDaSessao>>,
): Promise<string | undefined> {
  if (!(await isFlagOn("flag.m5.multi_concurso"))) return undefined;
  const { data } = await sessao.auth.getUser();
  return data.user?.id ?? undefined;
}

async function lerMapaComFalha(
  cliente: Awaited<ReturnType<typeof clienteDaSessao>>,
  dados: DadosRaioX,
): Promise<{ dados: DadosMapaPorMateria | null }> {
  try {
    const porTopico = await consultarMapaPrioridade(cliente, dados);
    return { dados: agruparMapaPorMateria(dados, porTopico) };
  } catch (erro) {
    reportarErro(erro, { modulo: "raiox", operacao: "consultar_mapa_prioridade" });
    return { dados: null };
  }
}
