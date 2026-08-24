import Link from "next/link";
import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import {
  prepararSessao,
  prepararSessaoDeRefacao,
  SessaoRecusada,
} from "@/modules/aluno/sessao";
import type { CausaDoCaderno } from "@/modules/aluno/progresso";
import { Estado } from "@/modules/ui/estado";

/** Entrada curta que transforma o bloco do plano em uma sessão retomável. */
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
        causa: causaDaRefacao as CausaDoCaderno,
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

  if (blocoId === undefined || blocoId === "") {
    return (
      <div className="mx-auto max-w-2xl">
        <Estado
          tipo="vazio"
          titulo="Escolha um bloco do seu plano para começar"
          acao={<Link href="/app" className="text-marca underline">Voltar ao plano de hoje</Link>}
        />
      </div>
    );
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

  if (motivo === "refacao_indisponivel") {
    return (
      <Estado
        tipo="vazio"
        titulo="Esta refação não está disponível"
        acao={<Link href="/app/progresso" className="font-semibold text-marca underline">Voltar ao progresso</Link>}
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
