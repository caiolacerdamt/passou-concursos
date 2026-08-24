import Link from "next/link";

import { clienteDaSessao } from "@/lib/db/sessao";
import { consultarResumoDaSessao } from "@/modules/aluno/resumo-sessao";
import { ResumoTela } from "@/modules/aluno/resumo-tela";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { Estado } from "@/modules/ui/estado";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function Resumo({ params }: Props) {
  await exigirMatriculaAtiva();
  const { id } = await params;
  const supabase = await clienteDaSessao();

  let resumo;
  try {
    resumo = await consultarResumoDaSessao(supabase, id);
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_resumo_sessao" });
    return <TelaBase><Estado tipo="erro" /></TelaBase>;
  }

  if (resumo === null) {
    return (
      <TelaBase>
        <Estado
          tipo="vazio"
          titulo="Resumo indisponível"
          acao={<Link href="/app" className="font-semibold text-marca underline">Voltar ao plano de hoje</Link>}
        />
      </TelaBase>
    );
  }

  return <TelaBase><ResumoTela resumo={resumo} /></TelaBase>;
}

function TelaBase({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl">{children}</div>;
}
