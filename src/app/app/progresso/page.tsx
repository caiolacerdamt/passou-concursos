import { clienteDaSessao } from "@/lib/db/sessao";
import { isFlagOn } from "@/modules/config";
import { consultarProgresso } from "@/modules/aluno/progresso";
import { consultarGamificacaoOpcional } from "@/modules/aluno/painel-do-dia";
import { consultarPerfilEstudo } from "@/modules/aluno/onboarding";
import { consultarTrajetoriaOpcional } from "@/modules/aluno/trajetoria-opcional";
import { TrajetoriaTela } from "@/modules/aluno/trajetoria-tela";
import { ASSUNTOS_POR_PAGINA, ProgressoTela } from "@/modules/aluno/progresso-tela";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { Estado } from "@/modules/ui/estado";
import type { DadosProgresso } from "@/modules/aluno/progresso";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function lerProgressoComFalha(
  cliente: Awaited<ReturnType<typeof clienteDaSessao>>,
  parametros: Record<string, string | string[] | undefined>,
): Promise<{ dados: DadosProgresso } | { erro: unknown }> {
  try {
    return { dados: await consultarProgresso(cliente, parametros) };
  } catch (erro) {
    return { erro };
  }
}

export default async function Progresso({ searchParams }: Props) {
  await exigirMatriculaAtiva();

  const ligado = await isFlagOn("flag.m4.caderno_erros");
  if (!ligado) {
    return (
      <Estado
        tipo="vazio"
        titulo="Seu progresso está em preparação"
        acao="Esta superfície será ligada assim que a configuração do produto estiver pronta."
      />
    );
  }

  const parametros = await searchParams;
  const supabase = await clienteDaSessao();

  const resultado = await lerProgressoComFalha(supabase, parametros);
  if ("erro" in resultado) {
    reportarErro(resultado.erro, { modulo: "aluno", operacao: "consultar_progresso" });
    return <Estado tipo="erro" />;
  }

  // Gamificação e trajetória são opcionais: flag desligada ou leitura falha não
  // impedem o aluno de ver o próprio progresso.
  // A data da prova mora no perfil de estudo; a trajetória não a inventa.
  const perfil = await consultarPerfilEstudo(supabase).catch(() => null);
  const [gamificacao, trajetoria] = await Promise.all([
    consultarGamificacaoOpcional(supabase),
    consultarTrajetoriaOpcional(supabase, { dataProva: perfil?.dataProva ?? null }),
  ]);

  return (
    <ProgressoTela
      dados={resultado.dados}
      gamificacao={gamificacao}
      /*
        A trajetória entra **entre** a leitura da semana e os pontos: a semana
        responde "como eu fui", ela responde "quanto falta", e o histórico é o
        detalhe dentro desse enquadramento. Vem montada daqui porque a rota é
        quem sabe se a flag está ligada.
      */
      trajetoria={trajetoria ? <TrajetoriaTela trajetoria={trajetoria} /> : null}
      mostrar={quantosAssuntosMostrar(parametros.mostrar)}
    />
  );
}

/**
 * Quantos assuntos do caderno a tela abre.
 *
 * Query string é entrada não confiável e aqui ela vira altura de lista: um
 * `mostrar=999999` renderizaria a lista inteira, que é justamente o rolo que
 * a paginação evita. Valor ilegível volta ao primeiro lote.
 */
function quantosAssuntosMostrar(valor: string | string[] | undefined): number {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  const numero = Number(bruto);
  if (!Number.isInteger(numero) || numero < ASSUNTOS_POR_PAGINA) {
    return ASSUNTOS_POR_PAGINA;
  }
  return Math.min(numero, TETO_DE_ASSUNTOS_NA_TELA);
}

/** Teto duro da lista: acima disso a tela vira rolo, com ou sem pedido. */
const TETO_DE_ASSUNTOS_NA_TELA = 60;
