import type { SupabaseClient } from "@supabase/supabase-js";

import { fonteCitacaoDaExplicacaoSchema } from "@/modules/ia";
import { reportarErro } from "@/modules/observabilidade/reporte";

export type FonteDaExplicacao = {
  docId: string;
  trecho: string;
};

export type ExplicacaoPublica = {
  texto: string;
  alternativaCorreta: string;
  fontesCitadas: readonly FonteDaExplicacao[];
};

export async function lerExplicacaoPublica(
  supabase: SupabaseClient,
  questaoId: string,
  questaoVersao: number,
  respostaCorreta: string,
): Promise<ExplicacaoPublica | null> {
  const { data, error } = await supabase.rpc("ler_explicacao_publica", {
    p_questao_id: questaoId,
    p_questao_versao: questaoVersao,
  });

  if (error) {
    reportarErro(error, { modulo: "aluno", operacao: "ler_explicacao_publica" });
    return null;
  }

  const linha = Array.isArray(data) ? data[0] : data;
  if (linha === undefined || linha === null) return null;

  const fontes = fonteCitacaoDaExplicacaoSchema.array().safeParse(linha.fontes_citadas);
  if (
    typeof linha.texto !== "string" ||
    typeof linha.alternativa_correta !== "string" ||
    linha.alternativa_correta !== respostaCorreta ||
    !fontes.success ||
    fontes.data.length === 0
  ) {
    reportarErro(new Error("RPC de explicação devolveu formato inválido"), {
      modulo: "aluno",
      operacao: "validar_explicacao_publica",
    });
    return null;
  }

  return {
    texto: linha.texto,
    alternativaCorreta: linha.alternativa_correta,
    fontesCitadas: fontes.data.map((fonte) => ({
      docId: fonte.doc_id,
      trecho: fonte.trecho,
    })),
  };
}
