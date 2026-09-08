import { NextResponse } from "next/server";

import { clienteDaSessao } from "@/lib/db/sessao";
import {
  exportarDadosDoTitular,
  nomeDoArquivo,
  registrarPedidoDeExportacao,
  totalDeLinhas,
} from "@/modules/lgpd/exportacao";
import { reportarErro } from "@/modules/observabilidade/reporte";

/**
 * O download da exportação (LGPD art. 18, II).
 *
 * **POST, e não GET.** O pedido grava um registro de auditoria, e um GET que
 * escreve é um GET que um `<img src>` de terceiro dispara sozinho na sessão do
 * aluno. Como formulário POST, o cookie `SameSite` do Supabase já barra o
 * pedido vindo de fora.
 *
 * **Não exige matrícula ativa**, pelo mesmo motivo do esquecimento em
 * `acoes.ts`: o direito de acesso não vence com o plano, e quem saiu é quem
 * mais o exerce. A autorização é uma só e é a **sessão** — o `user_id` sai do
 * cookie, e a rota não lê identificador de corpo, de query nem de cabeçalho.
 * Não existe caminho para pedir os dados de outra pessoa porque não existe
 * lugar onde dizer de quem são.
 */

export const dynamic = "force-dynamic";

const DE_VOLTA_AO_LOGIN = "/entrar?proximo=%2Fapp%2Fconta";
const DEU_ERRADO = "/app/conta?aba=privacidade&resultado=exportacao_falhou";

export async function POST(request: Request): Promise<Response> {
  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(new URL(DE_VOLTA_AO_LOGIN, request.url), 303);
  }

  let exportacao;
  try {
    exportacao = await exportarDadosDoTitular({ id: user.id, email: user.email });
  } catch (erro) {
    /*
     * Falha total da montagem: nada é entregue. Um arquivo parcial entregue
     * como se fosse o export completo é pior que nenhum — o aluno arquiva e
     * confia. As falhas *por tabela* não caem aqui: elas saem marcadas dentro
     * do próprio JSON, que é o jeito honesto de entregar o que deu para ler.
     */
    reportarErro(erro, { modulo: "lgpd", operacao: "exportar_dados" });
    return NextResponse.redirect(new URL(DEU_ERRADO, request.url), 303);
  }

  await registrarPedidoDeExportacao(user.id, {
    linhas_exportadas: totalDeLinhas(exportacao),
    truncada: !exportacao.completa,
  });

  return new NextResponse(JSON.stringify(exportacao, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${nomeDoArquivo(exportacao.gerado_em)}"`,
      // O arquivo tem dado pessoal do titular: nenhum intermediário guarda cópia.
      "cache-control": "no-store, private",
    },
  });
}
