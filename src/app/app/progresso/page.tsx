import Link from "next/link";

import { clienteDaSessao } from "@/lib/db/sessao";
import { isFlagOn } from "@/modules/config";
import { consultarProgresso } from "@/modules/aluno/progresso";
import { ProgressoTela } from "@/modules/aluno/progresso-tela";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { Estado } from "@/modules/ui/estado";
import { Shell } from "@/modules/ui/shell";

import { sair } from "../../entrar/acoes";
import type { DadosProgresso } from "@/modules/aluno/progresso";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function AcoesDaTela() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
      <Link href="/app" className="text-marca underline">Voltar ao plano</Link>
      <Link href="/app/conta" className="text-marca underline">Conta</Link>
      <form action={sair}>
        <button type="submit" className="text-marca underline">Sair</button>
      </form>
    </div>
  );
}

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
      <Shell acoes={<AcoesDaTela />} largura="painel">
        <Estado
          tipo="vazio"
          titulo="Seu progresso está em preparação"
          acao="Esta superfície será ligada assim que a configuração do produto estiver pronta."
        />
      </Shell>
    );
  }

  const parametros = await searchParams;
  const supabase = await clienteDaSessao();

  const resultado = await lerProgressoComFalha(supabase, parametros);
  if ("erro" in resultado) {
    reportarErro(resultado.erro, { modulo: "aluno", operacao: "consultar_progresso" });
    return (
      <Shell acoes={<AcoesDaTela />} largura="painel">
        <Estado tipo="erro" />
      </Shell>
    );
  }

  return (
    <Shell acoes={<AcoesDaTela />} largura="painel">
      <ProgressoTela dados={resultado.dados} />
    </Shell>
  );
}
