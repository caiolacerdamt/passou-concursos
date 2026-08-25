"use server";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import {
  SessaoRecusada,
  obterItemParaResposta,
} from "@/modules/aluno/sessao";
import {
  TentativaRecusada,
  registrarTentativa,
  validarResposta,
  type CausaDoTreino,
} from "@/modules/aluno/tentativas";
import { agendarRevisao } from "@/modules/aluno/revisao";
import { finalizarBloco } from "@/modules/aluno/progresso";
import { reportarErro } from "@/modules/observabilidade/reporte";

export type EstadoDaResposta =
  | { status: "inicial" }
  | {
      status: "causa_necessaria";
      sessaoId: string;
      itemId: string;
      respostaDada: string;
      tempoMs: number | null;
      marcouChute: boolean;
      mensagem: string;
    }
  | {
      status: "respondida";
      sessaoId: string;
      itemId: string;
      correta: boolean;
      duplicada: boolean;
      respostaCorreta: string;
      sessaoConcluida: boolean;
    }
  | {
      status: "erro";
      sessaoId: string;
      itemId: string;
      mensagem: string;
    };

/**
 * Responde uma questão sem aceitar autoridade do formulário.
 *
 * `sessaoId` e `itemId` identificam a operação; o dono, o contexto, a versão e
 * o gabarito são lidos novamente no servidor. A única escrita passa por
 * `registrarTentativa` com o cliente da sessão, preservando RLS e o dedup SQL.
 */
export async function responderQuestao(
  _estadoAnterior: EstadoDaResposta,
  formulario: FormData,
): Promise<EstadoDaResposta> {
  const sessaoId = texto(formulario, "sessaoId");
  const itemId = texto(formulario, "itemId");
  const respostaDada = texto(formulario, "respostaDada");

  if (sessaoId === "" || itemId === "" || respostaDada === "") {
    return {
      status: "erro",
      sessaoId,
      itemId,
      mensagem: "Não conseguimos identificar esta questão. Recarregue a sessão.",
    };
  }

  const tempoMs = tempoDoFormulario(formulario.get("tempoMs"));
  if (tempoMs === "invalido") {
    return {
      status: "erro",
      sessaoId,
      itemId,
      mensagem: "O tempo desta resposta não pôde ser registrado. Tente novamente.",
    };
  }
  const marcouChute = formulario.get("marcouChute") === "true" || formulario.get("marcouChute") === "on";
  const causaErro = (texto(formulario, "causaErro") || null) as CausaDoTreino | null;

  try {
    await exigirMatriculaAtiva();
    const supabase = await clienteDaSessao();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user === null) {
      return {
        status: "erro",
        sessaoId,
        itemId,
        mensagem: "Sua sessão expirou. Entre novamente para continuar.",
      };
    }

    const alvo = await obterItemParaResposta(supabase, sessaoId, itemId);
    const primeiraResposta = alvo.item.respondidoEm === null;

    // No duplo-clique o SQL devolve o resultado já gravado. Não revalide a
    // nova carga contra o gabarito, porque a primeira carga é a autoridade.
    if (primeiraResposta) {
      validarResposta(
        {
          userId: user.id,
          sessaoItemId: alvo.item.id,
          contexto: alvo.sessao.contexto,
          respostaDada,
          tempoMs,
          marcouChute,
          causaErro,
        },
        {
          tipoQuestao: alvo.questao.tipoQuestao,
          acertou: respostaDada === alvo.questao.respostaCorreta,
        },
      );
    }

    const resultado = await registrarTentativa(
      {
        userId: user.id,
        sessaoItemId: alvo.item.id,
        contexto: alvo.sessao.contexto,
        respostaDada,
        tempoMs,
        marcouChute,
        causaErro,
      },
      supabase,
    );

    const sessaoConcluida = await encerrarSeNaoHouverPendencias(supabase, sessaoId);
    if (sessaoConcluida) {
      // A tentativa já está confirmada no log. A sincronização é uma segunda
      // transação deliberada: se ela falhar, o fato append-only continua salvo
      // e a action devolve erro visível para uma nova tentativa.
      await sincronizarDepoisDoFechamento(supabase, sessaoId);
    }

    return {
      status: "respondida",
      sessaoId,
      itemId,
      correta: resultado.correta,
      duplicada: resultado.duplicada,
      respostaCorreta: alvo.questao.respostaCorreta,
      sessaoConcluida,
    };
  } catch (erro) {
    // `redirect()` do Next lança uma exceção de controle. Ela não é erro de
    // domínio e precisa atravessar a action para levar o aluno ao paywall.
    if (ehRedirecionamentoDoNext(erro)) throw erro;

    if (erro instanceof TentativaRecusada) {
      if (erro.motivo === "causa_obrigatoria") {
        return {
          status: "causa_necessaria",
          sessaoId,
          itemId,
          respostaDada,
          tempoMs,
          marcouChute,
          mensagem: erro.message,
        };
      }
      return {
        status: "erro",
        sessaoId,
        itemId,
        mensagem: mensagemDaRecusa(erro.motivo),
      };
    }

    if (erro instanceof SessaoRecusada) {
      return {
        status: "erro",
        sessaoId,
        itemId,
        mensagem: mensagemDaSessao(erro.motivo),
      };
    }

    reportarErro(erro, { modulo: "aluno", operacao: "responder_questao" });
    return {
      status: "erro",
      sessaoId,
      itemId,
      mensagem: "Não conseguimos registrar esta resposta. Tente novamente.",
    };
  }
}

async function sincronizarDepoisDoFechamento(
  supabase: Awaited<ReturnType<typeof clienteDaSessao>>,
  sessaoId: string,
): Promise<void> {
  const fechamento = await finalizarBloco(supabase, sessaoId);
  const eConteudo = fechamento.contexto === "plano" || fechamento.contexto === "treino";
  if (fechamento.contexto !== "revisao" && !eConteudo) return;
  if (fechamento.topicoId === null) {
    if (fechamento.contexto === "revisao") {
      throw new Error("bloco de revisão concluído sem tópico");
    }
    return;
  }

  await agendarRevisao(
    {
      userId: fechamento.userId,
      topicoId: fechamento.topicoId,
      percentualAcerto: fechamento.nAcertos / fechamento.nRespostas,
      sessaoId,
      primeiraRevisao: eConteudo,
    },
    supabase,
  );
}

function texto(formulario: FormData, campo: string): string {
  const valor = formulario.get(campo);
  return typeof valor === "string" ? valor.trim() : "";
}

function tempoDoFormulario(valor: FormDataEntryValue | null): number | null | "invalido" {
  if (valor === null || typeof valor !== "string" || valor.trim() === "") return null;
  if (!/^\d+$/.test(valor.trim())) return "invalido";
  const tempo = Number(valor);
  return Number.isSafeInteger(tempo) && tempo >= 0 && tempo <= 2_147_483_647
    ? tempo
    : "invalido";
}

function ehRedirecionamentoDoNext(erro: unknown): boolean {
  if (!(erro instanceof Error)) return false;
  if (erro.message.startsWith("NEXT_REDIRECT:")) return true;
  const digest = (erro as Error & { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

async function encerrarSeNaoHouverPendencias(
  supabase: Awaited<ReturnType<typeof clienteDaSessao>>,
  sessaoId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sessao_itens")
    .select("id")
    .eq("sessao_id", sessaoId)
    .is("respondido_em", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    reportarErro(error, { modulo: "aluno", operacao: "verificar_fim_da_sessao" });
    return false;
  }
  if (data !== null) return false;

  const fechamento = await supabase
    .from("sessoes")
    .update({ encerrada_em: new Date().toISOString() })
    .eq("id", sessaoId)
    .is("encerrada_em", null);

  if (fechamento.error) {
    reportarErro(fechamento.error, { modulo: "aluno", operacao: "encerrar_sessao" });
    return false;
  }
  return true;
}

function mensagemDaRecusa(motivo: TentativaRecusada["motivo"]): string {
  if (motivo === "resposta_invalida") return "Essa alternativa não pertence a esta questão.";
  if (motivo === "causa_so_com_erro") return "A causa só é necessária quando a resposta está errada.";
  if (motivo === "causa_invalida") return "Escolha uma causa disponível para continuar.";
  if (motivo === "item_inexistente") return "Essa questão não está mais disponível nesta sessão.";
  return "Não conseguimos validar esta resposta. Recarregue a questão.";
}

function mensagemDaSessao(motivo: SessaoRecusada["motivo"]): string {
  if (motivo === "sessao_encerrada") return "Esta sessão já foi concluída.";
  if (motivo === "gabarito_ausente") return "Esta questão está em revisão e não pode receber resposta agora.";
  if (motivo === "item_inexistente" || motivo === "sessao_inexistente") {
    return "Essa questão não está mais disponível nesta sessão.";
  }
  return "Não conseguimos carregar esta questão. Tente novamente.";
}
