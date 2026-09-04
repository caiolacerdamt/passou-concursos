import { redirect } from "next/navigation";

import { exigirMatriculaAtiva } from "@/modules/conta/matricula";

export const dynamic = "force-dynamic";

/**
 * A rota ficou como desvio, não como tela.
 *
 * A garantia virou um bloco de `/app/conta` — mas o endereço antigo já saiu
 * daqui em e-mail de checkout, em link salvo e no histórico do navegador do
 * aluno. Devolver 404 para quem seguiu uma instrução nossa seria trocar uma
 * tela feia por um beco sem saída.
 *
 * O desvio é temporário de propósito: um 308 fica no cache do navegador do
 * aluno para sempre, e essa é uma decisão difícil de desfazer.
 *
 * A guarda continua aqui mesmo sem nada para renderizar: a varredura do PAG-01
 * não abre exceção para "página que só redireciona", e abrir uma seria dar a
 * quem vier depois um jeito de copiar uma tela sem guarda.
 */
export default async function Reembolso(): Promise<never> {
  await exigirMatriculaAtiva();
  redirect("/app/conta?aba=assinatura");
}
