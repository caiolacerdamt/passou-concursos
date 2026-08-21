import type { ClienteSql } from "@/modules/ia";

import type { Alternativa, FonteCitacao } from "./contrato";

export type QuestaoParaReferencia = {
  id: string;
  questaoVersao: number;
  topicoId: string | null;
  provaId: string | null;
  numero: number | null;
  enunciado: string;
  alternativas: readonly Alternativa[] | null;
  respostaCorreta: string | null;
  gabaritoVersao: string | null;
  fonteCitacao: FonteCitacao | null;
};

export type DocumentoDeReferencia = {
  id: string;
  topicoId: string;
  titulo: string;
  conteudo: string;
  origem: "oficial" | "resumo_nosso";
};

export type ReferenciaEntregue = {
  id: string;
  titulo: string;
  conteudo: string;
  origem: DocumentoDeReferencia["origem"] | "minima";
  baseReferenciaId: string | null;
  topicoId: string | null;
};

export const CONSULTA_DA_BASE_CONFERIDA = `
  select id, topico_id, titulo, conteudo, origem::text as origem
    from public.base_referencia
   where topico_id = $1 and status = 'conferido'
   order by (origem = 'oficial') desc, atualizada_em desc, id
   limit 1
`;

export class FonteMinimaSemGabarito extends Error {
  constructor() {
    super(
      "a fonte minima da explicacao exige resposta_correta e gabarito_versao oficiais",
    );
    this.name = "FonteMinimaSemGabarito";
  }
}

function textoDasAlternativas(alternativas: readonly Alternativa[] | null): string {
  if (alternativas === null) return "Formato: certo ou errado";
  return alternativas.map((alternativa) => `${alternativa.letra}) ${alternativa.texto}`).join("\n");
}

function textoDaFonte(fonte: FonteCitacao | null): string {
  if (fonte === null) return "sem proveniencia cadastrada";
  return Object.entries(fonte)
    .map(([chave, valor]) => `${chave}: ${String(valor)}`)
    .join("; ");
}

/**
 * Fonte mínima permitida quando ainda não existe documento por tópico.
 *
 * O texto é montado com os fatos oficiais que já estão no banco. Ele não abre
 * espaço para a IA completar norma, prazo ou percentual por memória.
 */
export function montarFonteMinima(questao: QuestaoParaReferencia): ReferenciaEntregue {
  if (questao.respostaCorreta === null || questao.gabaritoVersao === null) {
    throw new FonteMinimaSemGabarito();
  }

  const id = `minima:${questao.provaId ?? "sem-prova"}:${questao.id}:v${questao.questaoVersao}`;
  const conteudo = [
    "Documento oficial mínimo da questão.",
    `Proveniência: ${textoDaFonte(questao.fonteCitacao)}`,
    `Enunciado: ${questao.enunciado}`,
    `Alternativas:\n${textoDasAlternativas(questao.alternativas)}`,
    `Gabarito oficial (${questao.gabaritoVersao}): ${questao.respostaCorreta}`,
  ].join("\n\n");

  return {
    id,
    titulo: "Prova oficial e gabarito oficial",
    conteudo,
    origem: "minima",
    baseReferenciaId: null,
    topicoId: questao.topicoId,
  };
}

function documentoDaLinha(linha: Record<string, unknown>): DocumentoDeReferencia {
  return {
    id: String(linha.id),
    topicoId: String(linha.topico_id),
    titulo: String(linha.titulo),
    conteudo: String(linha.conteudo),
    origem: String(linha.origem) as DocumentoDeReferencia["origem"],
  };
}

/** Seleciona a base oficial/resumo conferida ou cai para a fonte mínima. */
export async function selecionarReferencia(
  cliente: ClienteSql,
  questao: QuestaoParaReferencia,
): Promise<ReferenciaEntregue> {
  if (questao.topicoId !== null) {
    const { rows } = await cliente.query(CONSULTA_DA_BASE_CONFERIDA, [questao.topicoId]);
    const linha = rows[0];
    if (linha !== undefined) {
      const documento = documentoDaLinha(linha);
      return {
        id: `base:${documento.id}`,
        titulo: documento.titulo,
        conteudo: documento.conteudo,
        origem: documento.origem,
        baseReferenciaId: documento.id,
        topicoId: documento.topicoId,
      };
    }
  }

  const minima = montarFonteMinima(questao);
  await cliente.query(
    `select public.enfileirar_questao_revisao(
       $1::uuid, $2::integer, 'base_referencia_pendente'::text, 0::smallint, $3::text
     ) as id`,
    [questao.id, questao.questaoVersao, questao.topicoId ?? "topico ainda nao canonico"],
  );
  return minima;
}

