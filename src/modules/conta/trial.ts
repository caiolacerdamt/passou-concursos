import type { SupabaseClient } from "@supabase/supabase-js";

import { reportarErro } from "@/modules/observabilidade/reporte";

/**
 * A conta gratuita, do lado da aplicação (AD-133).
 *
 * A concessão em si é `public.conceder_trial()`, no banco. Ela lê `auth.uid()`
 * por dentro, confere a flag, exige e-mail confirmado e garante um trial por
 * conta na vida. **Este arquivo não repete nenhuma dessas regras** — repetir
 * criaria uma segunda fonte de verdade que diverge no primeiro ajuste.
 *
 * O que mora aqui é a tradução do erro do Postgres para algo que a tela possa
 * dizer, e a decisão de não derrubar o cadastro quando a concessão falha: a
 * conta já existe, o aluno já está autenticado, e o que ele perde é o acesso —
 * que o `/assinar` explica. Estourar aqui deixaria uma conta órfã e uma tela
 * de erro genérico.
 */

export type ResultadoDoTrial =
  | { estado: "concedido"; matriculaId: string }
  /** Já tinha acesso (pago ou trial vigente). Não é erro. */
  | { estado: "ja_tem_acesso" }
  | { estado: "recusado"; motivo: MotivoDaRecusaDoTrial };

export type MotivoDaRecusaDoTrial =
  | "trial_desligado"
  | "trial_ja_usado"
  | "email_nao_confirmado"
  | "sem_sessao"
  | "produto_trial_indisponivel"
  | "falha";

const MOTIVOS: readonly MotivoDaRecusaDoTrial[] = [
  "trial_desligado",
  "trial_ja_usado",
  "email_nao_confirmado",
  "sem_sessao",
  "produto_trial_indisponivel",
];

export async function concederTrial(
  cliente: SupabaseClient,
): Promise<ResultadoDoTrial> {
  const { data, error } = await cliente.rpc("conceder_trial");

  if (error) {
    const motivo = MOTIVOS.find((nome) => error.message.includes(nome)) ?? "falha";
    if (motivo === "falha") {
      reportarErro(error, { modulo: "conta", operacao: "conceder_trial" });
    }
    return { estado: "recusado", motivo };
  }

  if (typeof data !== "string") return { estado: "ja_tem_acesso" };
  return { estado: "concedido", matriculaId: data };
}

/**
 * A mensagem que a tela mostra. `trial_ja_usado` e `trial_desligado` são as
 * duas que o aluno pode ver de verdade; as outras são defeito nosso e viram a
 * mesma frase, porque nada nelas é acionável por ele.
 */
export function mensagemDaRecusaDoTrial(
  motivo: MotivoDaRecusaDoTrial,
): string {
  if (motivo === "trial_desligado") {
    return "O teste grátis não está disponível no momento. A matrícula continua aberta.";
  }
  if (motivo === "trial_ja_usado") {
    return "Esta conta já usou o teste grátis. Para continuar, faça a matrícula.";
  }
  if (motivo === "email_nao_confirmado") {
    return "Confirme seu e-mail pelo link que enviamos para começar o teste.";
  }
  return "Não foi possível liberar o teste grátis agora.";
}
