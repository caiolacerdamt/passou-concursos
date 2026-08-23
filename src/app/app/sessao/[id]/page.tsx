import Link from "next/link";
import type { ReactNode } from "react";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { consultarSessao, SessaoRecusada } from "@/modules/aluno/sessao";
import { Estado } from "@/modules/ui/estado";
import { Shell } from "@/modules/ui/shell";

import { sair } from "../../../entrar/acoes";
import { SessaoTela } from "@/modules/aluno/sessao/tela";

type Props = { params: Promise<{ id: string }> };

export default async function Sessao({ params }: Props) {
  await exigirMatriculaAtiva();
  const { id } = await params;
  const supabase = await clienteDaSessao();

  let sessao;
  try {
    sessao = await consultarSessao(supabase, id);
  } catch (erro) {
    if (!(erro instanceof SessaoRecusada)) throw erro;
    return <TelaBase><Estado tipo="erro" /></TelaBase>;
  }

  if (sessao === null) {
    return (
      <TelaBase>
        <Estado
          tipo="vazio"
          titulo="Sessão não encontrada"
          acao={<Link href="/app" className="text-marca underline">Voltar ao plano de hoje</Link>}
        />
      </TelaBase>
    );
  }

  if (sessao.itens.length === 0) {
    return (
      <TelaBase>
        <Estado
          tipo="vazio"
          titulo={sessao.encerradaEm ? "Bloco concluído" : "Não há questões pendentes neste bloco"}
          acao={<Link href="/app" className="text-marca underline">Voltar ao plano de hoje</Link>}
        />
      </TelaBase>
    );
  }

  return (
    <TelaBase>
      <SessaoTela sessao={sessao} />
    </TelaBase>
  );
}

function TelaBase({ children }: { children: ReactNode }) {
  return (
    <Shell
      largura="leitura"
      acoes={
        <div className="flex items-center gap-4 text-sm">
          <Link href="/app" className="text-marca underline">Plano</Link>
          <form action={sair}>
            <button type="submit" className="text-marca underline">Sair</button>
          </form>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
