import Link from "next/link";
import type { ReactNode } from "react";

import { clienteDaSessao } from "@/lib/db/sessao";
import { consultarEstudoGuiado, EstudoGuiadoRecusado } from "@/modules/aluno/estudo-guiado/consulta";
import { EstudoGuiadoTela } from "@/modules/aluno/estudo-guiado/tela";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { Estado } from "@/modules/ui/estado";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Estudo({ searchParams }: Props) {
  await exigirMatriculaAtiva();
  const parametros = await searchParams;
  const blocoId = comoTexto(parametros.bloco);

  if (!blocoId || !ehUuid(blocoId)) {
    return (
      <TelaBase>
        <Estado
          tipo="vazio"
          titulo="Escolha um bloco válido do seu plano"
          acao={<VoltarAoPlano />}
        />
      </TelaBase>
    );
  }

  const supabase = await clienteDaSessao();
  let estudo: Awaited<ReturnType<typeof consultarEstudoGuiado>>;
  try {
    estudo = await consultarEstudoGuiado(supabase, blocoId);
  } catch (erro) {
    if (!(erro instanceof EstudoGuiadoRecusado)) throw erro;
    if (erro.motivo === "falha_leitura") {
      reportarErro(erro, {
        modulo: "aluno",
        operacao: "consultar_estudo_guiado",
      });
    }
    return (
      <TelaBase>
        <EstadoDaFalha motivo={erro.motivo} />
      </TelaBase>
    );
  }

  return <EstudoGuiadoTela estudo={estudo} />;
}

function EstadoDaFalha({ motivo }: { motivo: EstudoGuiadoRecusado["motivo"] }) {
  if (motivo === "bloco_concluido") {
    return (
      <Estado
        tipo="vazio"
        titulo="Este bloco já foi concluído"
        acao={
          <>
            O estudo guiado fica disponível para blocos pendentes. <VoltarAoPlano />
          </>
        }
      />
    );
  }

  if (motivo === "bloco_inexistente") {
    return (
      <Estado
        tipo="vazio"
        titulo="Este bloco não está disponível"
        acao={
          <>
            Ele pode ter sido concluído, removido ou não pertencer ao seu plano. <VoltarAoPlano />
          </>
        }
      />
    );
  }

  return (
    <div>
      <Estado tipo="erro" />
      <p className="mt-4 text-center text-sm">
        <VoltarAoPlano />
      </p>
    </div>
  );
}

function TelaBase({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-4xl">{children}</div>;
}

function VoltarAoPlano() {
  return (
    <Link href="/app" className="font-semibold text-marca underline underline-offset-4">
      Voltar ao plano de hoje
    </Link>
  );
}

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

function ehUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}
