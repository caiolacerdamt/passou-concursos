import Link from "next/link";
import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { consultarPlanoDoDia, dataHojeDoProduto } from "@/modules/aluno/plano";
import {
  consultarRotulosDosTopicosPorIds,
  type RotuloDoTopico,
} from "@/modules/aluno/plano-rotulos";
import { consultarPratica } from "@/modules/aluno/sessao/pratica";
import { PraticaTela } from "@/modules/aluno/sessao/pratica-tela";
import { reportarErro } from "@/modules/observabilidade/reporte";
import {
  prepararSessao,
  prepararSessaoDeRefacao,
  type EscolhaDaRefacao,
  prepararSessaoDeRevisao,
  SessaoRecusada,
} from "@/modules/aluno/sessao";
import { Estado } from "@/modules/ui/estado";

/**
 * A entrada da prática — AD-115.
 *
 * Sem parâmetro ela é a **tela de prática**: sessão aberta, revisão vencida
 * fora do plano, caderno de erros e histórico. Com parâmetro ela é o despacho
 * curto que abre a sessão e redireciona; nenhum dos três caminhos desenha
 * lista de bloco, que é assunto de `/app` e `/app/plano`.
 */
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AbrirSessao({ searchParams }: Props) {
  await exigirMatriculaAtiva();
  const parametros = await searchParams;
  const blocoId = comoTexto(parametros.bloco);
  const modoRefacao = comoTexto(parametros.refacao) ?? comoTexto(parametros.refazer);
  const topicoDaRefacao = comoTexto(parametros.topico);
  const causaDaRefacao = comoTexto(parametros.causa);
  const topicoDaRevisao = comoTexto(parametros.revisao);

  if (modoRefacao !== undefined && modoRefacao !== "") {
    if (topicoDaRefacao === undefined || causaDaRefacao === undefined) {
      return (
        <div className="mx-auto max-w-2xl">
          <EstadoDaFalha motivo="refacao_indisponivel" refacao />
        </div>
      );
    }

    const supabase = await clienteDaSessao();
    let sessao: { id: string };
    try {
      sessao = await prepararSessaoDeRefacao(supabase, {
        topicoId: topicoDaRefacao,
        causa: causaDaRefacao as EscolhaDaRefacao,
      });
    } catch (erro) {
      if (!(erro instanceof SessaoRecusada)) throw erro;
      return (
        <div className="mx-auto max-w-2xl">
          <EstadoDaFalha motivo={erro.motivo} refacao />
        </div>
      );
    }

    redirect(`/app/sessao/${sessao.id}`);
  }

  if (topicoDaRevisao !== undefined && topicoDaRevisao !== "") {
    const supabase = await clienteDaSessao();
    let sessao: { id: string };
    try {
      sessao = await prepararSessaoDeRevisao(supabase, { topicoId: topicoDaRevisao });
    } catch (erro) {
      if (!(erro instanceof SessaoRecusada)) throw erro;
      return (
        <div className="mx-auto max-w-2xl">
          <EstadoDaFalha motivo={erro.motivo} />
        </div>
      );
    }

    redirect(`/app/sessao/${sessao.id}`);
  }

  if (blocoId === undefined || blocoId === "") {
    return telaDaPratica();
  }

  const supabase = await clienteDaSessao();
  let sessao: { id: string };
  try {
    sessao = await prepararSessao(supabase, blocoId);
  } catch (erro) {
    if (!(erro instanceof SessaoRecusada)) throw erro;
    return (
      <div className="mx-auto max-w-2xl">
        <EstadoDaFalha motivo={erro.motivo} />
      </div>
    );
  }

  redirect(`/app/sessao/${sessao.id}`);
}

/**
 * O plano de hoje é lido só para **excluir** dele as revisões: uma revisão que
 * já virou bloco vive em `/app`, e repeti-la aqui era a duplicação que o
 * AD-115 remove. Se essa leitura cair, a tela continua — o custo é uma revisão
 * aparecer nos dois lugares, não a página quebrar.
 *
 * É função que devolve elemento pronto, e **não** um componente `async`
 * aninhado: a página é o único ponto que espera. Um segundo componente
 * assíncrono aqui dentro suspende no `renderToStaticMarkup` e derruba a rota
 * inteira no teste — foi assim que este arquivo quebrou uma vez.
 */
async function telaDaPratica() {
  const supabase = await clienteDaSessao();
  const hoje = dataHojeDoProduto();

  let topicosNoPlanoDeHoje: string[] = [];
  try {
    const plano = await consultarPlanoDoDia(supabase);
    topicosNoPlanoDeHoje =
      plano === null
        ? []
        : [...plano.piso, ...plano.metaCheia].flatMap((bloco) =>
            bloco.conclusao === null && bloco.topicoId !== null ? [bloco.topicoId] : [],
          );
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_plano_da_pratica" });
  }

  let dados;
  try {
    dados = await consultarPratica(supabase, { topicosNoPlanoDeHoje, hoje });
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_pratica" });
    return <div className="mx-auto max-w-2xl"><Estado tipo="erro" /></div>;
  }

  const idsDosTopicos = [
    ...(dados.sessaoAberta?.topicoId ? [dados.sessaoAberta.topicoId] : []),
    ...dados.revisoesForaDoPlano.map((revisao) => revisao.topicoId),
    ...dados.caderno.map((erro) => erro.topicoId),
    ...dados.historico.flatMap((sessao) => (sessao.topicoId ? [sessao.topicoId] : [])),
  ];

  let rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico> = new Map();
  try {
    rotulosDosTopicos = await consultarRotulosDosTopicosPorIds(supabase, idsDosTopicos);
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_rotulos_pratica" });
  }

  return <PraticaTela dados={dados} rotulosDosTopicos={rotulosDosTopicos} hoje={hoje} />;
}

function EstadoDaFalha({ motivo, refacao = false }: { motivo: SessaoRecusada["motivo"]; refacao?: boolean }) {
  if (motivo === "acervo_vazio") {
    return (
      <Estado
        tipo="vazio"
        titulo={refacao ? "Não há questões disponíveis para esta refação" : "Este bloco ainda não tem questões disponíveis"}
        acao={
          <>
            {refacao
              ? "As questões podem ter sido retiradas ou ainda não há erro disponível para esse filtro. "
              : "O acervo precisa de uma questão publicada para começar. Seu plano continua salvo. "}
            <Link href={refacao ? "/app/progresso" : "/app"} className="font-semibold text-marca underline">
              {refacao ? "Voltar ao progresso" : "Voltar ao plano"}
            </Link>
          </>
        }
      />
    );
  }

  if (motivo === "trial_teto_diario") {
    return (
      <Estado
        tipo="vazio"
        titulo="Você já fez as questões de hoje no teste grátis"
        acao={
          <>
            {"O plano de amanhã já está montado, e a revisão espaçada não perdeu a conta dos seus dias. "}
            <Link href="/app" className="font-semibold text-marca underline">
              Voltar ao plano
            </Link>
          </>
        }
      />
    );
  }

  if (motivo === "refacao_indisponivel") {
    return (
      <Estado
        tipo="vazio"
        titulo="Esta refação não está disponível"
        acao={<Link href="/app/progresso" className="font-semibold text-marca underline">Voltar ao progresso</Link>}
      />
    );
  }

  if (motivo === "revisao_indisponivel") {
    return (
      <Estado
        tipo="vazio"
        titulo="Esta revisão não está vencida na sua agenda"
        acao={
          <>
            {"A revisão volta sozinha na data certa. "}
            <Link href="/app/sessao" className="font-semibold text-marca underline">
              Voltar à prática
            </Link>
          </>
        }
      />
    );
  }

  return (
    <Estado
      tipo="erro"
      /* O componente fixa a mensagem segura; o motivo técnico não vai para a tela. */
    />
  );
}

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
