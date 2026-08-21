import type { ClienteSql } from "@/modules/ia";

import { type TopicoCanonico, classificar } from "./classificacao";
import { type FonteCitacao, type Imagem } from "./contrato";
import type { QuestaoExtraida } from "./extracao";
import type { BlocoDaProva } from "./fatiamento";
import type { ImagemDoPdf } from "./pdf";
import type { StatusProva } from "./contrato";

/**
 * A persistencia da ingestao (BANCO-03 AC6, BANCO-11 AC4, BANCO-01).
 *
 * Tres invariantes moram aqui, e nenhum deles e opcional:
 *
 * 1. **A questao nasce `rascunho` ou `em_revisao`, nunca `publicada`.** Publicar
 *    e da SPEC 10, e nada neste arquivo escreve esse valor.
 * 2. **Questao real carrega proveniencia.** Ela sai da linha da prova, que um
 *    humano catalogou — nunca do que o modelo achou que a prova era.
 * 3. **Colher duas vezes nao insere duas vezes.** O `on conflict` casa com o
 *    indice unico `(prova_id, numero) where vigente`, que a SPEC 04 criou
 *    justamente para o edge case "mesma prova submetida duas vezes".
 */

/** A prova como o catalogo a registrou. E a fonte da proveniencia. */
export type ProvaCatalogada = {
  id: string;
  banca: string;
  ano: number;
  orgao: string;
  cargo: string;
  status: StatusProva;
};

export const CONSULTA_DA_PROVA = `
  select id, banca, ano, orgao, cargo, status
    from public.provas where id = $1
`;

export class ProvaNaoCatalogada extends Error {
  constructor(provaId: string) {
    super(
      `a prova ${provaId} nao existe no catalogo. A linha em \`provas\` e ` +
        "catalogada por um humano antes do PDF (BANCO-02): e dela que sai a proveniencia.",
    );
    this.name = "ProvaNaoCatalogada";
  }
}

export async function lerProva(
  cliente: ClienteSql,
  provaId: string,
): Promise<ProvaCatalogada> {
  const { rows } = await cliente.query(CONSULTA_DA_PROVA, [provaId]);
  const linha = rows[0];
  if (linha === undefined) throw new ProvaNaoCatalogada(provaId);

  return {
    id: String(linha.id),
    banca: String(linha.banca),
    ano: Number(linha.ano),
    orgao: String(linha.orgao),
    cargo: String(linha.cargo),
    status: String(linha.status) as StatusProva,
  };
}

/**
 * A proveniencia da questao (BANCO-01 AC1 / AD-040).
 *
 * As cinco chaves vao juntas — o `CHECK fonte_citacao_completa` do banco cobra
 * exatamente isso. `numero` e o da **questao**, nao o da prova: e o que permite
 * ao aluno conferir a questao no PDF oficial.
 */
export function fonteCitacaoDe(
  prova: ProvaCatalogada,
  numero: number,
): FonteCitacao {
  return {
    banca: prova.banca,
    ano: prova.ano,
    orgao: prova.orgao,
    cargo: prova.cargo,
    numero,
  };
}

export async function marcarProva(
  cliente: ClienteSql,
  provaId: string,
  status: StatusProva,
  observacao?: string,
): Promise<void> {
  await cliente.query(
    `update public.provas
        set status = $2::status_prova,
            observacao = coalesce($3, observacao)
      where id = $1`,
    [provaId, status, observacao ?? null],
  );
}

// ── Blocos ──────────────────────────────────────────────────────────────────

/**
 * Registra os blocos que ainda nao existem, e devolve os que precisam ser
 * enviados.
 *
 * O `on conflict do nothing` e a retomada: reenviar a mesma prova nao remonta
 * bloco que ja tem linha, e por isso nao paga de novo por ele (AD-036).
 */
export async function registrarBlocos(
  cliente: ClienteSql,
  provaId: string,
  blocos: readonly BlocoDaProva[],
  chaveDe: (bloco: number) => string,
): Promise<number[]> {
  const novos: number[] = [];

  for (const bloco of blocos) {
    const { rows } = await cliente.query(
      `insert into public.prova_lote
         (prova_id, bloco, chave_dedup, primeira_pagina, ultima_pagina, tokens_estimados)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (prova_id, bloco) do nothing
       returning bloco`,
      [
        provaId,
        bloco.indice,
        chaveDe(bloco.indice),
        bloco.primeiraPagina,
        bloco.ultimaPagina,
        bloco.tokensEstimados,
      ],
    );
    if (rows.length > 0) novos.push(bloco.indice);
  }

  return novos;
}

// ── Questoes ────────────────────────────────────────────────────────────────

/** Sobe um arquivo ao Supabase Storage. Injetavel: o job tem a chave, o teste nao. */
export type SubidorDeImagem = (
  caminho: string,
  jpeg: Buffer,
) => Promise<void>;

export type ResumoDaGravacao = {
  inseridas: number;
  jaExistiam: number;
  emRevisao: number;
  candidatosDeTopico: number;
  imagensSubidas: number;
  imagensQueFalharam: number;
};

export type ContextoDaGravacao = {
  prova: ProvaCatalogada;
  catalogo: readonly TopicoCanonico[];
  /** As imagens que o PDF entregou, por numero de pagina. */
  imagensPorPagina: ReadonlyMap<number, ImagemDoPdf[]>;
  subirImagem: SubidorDeImagem;
  bucket: string;
};

/**
 * O caminho da imagem no Storage.
 *
 * Determinístico de proposito: colher o mesmo bloco duas vezes sobrescreve o
 * mesmo arquivo em vez de criar um segundo com outro nome.
 */
export function caminhoDaImagem(
  provaId: string,
  numero: number,
  indice: number,
): string {
  return `${provaId}/q${numero}-${indice}.jpg`;
}

/**
 * Grava as questoes de um bloco colhido.
 *
 * **Uma questao que falha nao derruba as irmas**, pela mesma razao do
 * `validarBloco`: o bloco ja foi pago.
 */
export async function gravarQuestoes(
  cliente: ClienteSql,
  questoes: readonly QuestaoExtraida[],
  contexto: ContextoDaGravacao,
): Promise<ResumoDaGravacao> {
  const resumo: ResumoDaGravacao = {
    inseridas: 0,
    jaExistiam: 0,
    emRevisao: 0,
    candidatosDeTopico: 0,
    imagensSubidas: 0,
    imagensQueFalharam: 0,
  };

  for (const questao of questoes) {
    const classificacao = await classificar(
      cliente,
      {
        topicoSugerido: questao.topico_sugerido,
        materiaSugerida: questao.materia_sugerida,
      },
      contexto.catalogo,
    );
    if (classificacao.candidatoId !== null) resumo.candidatosDeTopico += 1;

    const { imagens, falhou } = await subirImagensDaQuestao(questao, contexto);
    if (falhou) resumo.imagensQueFalharam += 1;
    resumo.imagensSubidas += imagens.length;

    // BANCO-03 AC6 + BANCO-11 AC4. Questao com imagem vai para revisao humana
    // sempre — nao so quando a imagem falha: a descricao acessivel que o
    // `alt_text` exige nao existe ate alguem olhar a figura, e o modelo leu o
    // texto da prova, nunca a imagem.
    const status = questao.tem_imagem ? "em_revisao" : "rascunho";
    if (status === "em_revisao") resumo.emRevisao += 1;

    const { rows } = await cliente.query(
      `insert into public.questoes
         (prova_id, numero, origem, fonte_citacao, topico_id, tipo_questao,
          enunciado, alternativas, imagens, dificuldade, confianca_ia, status)
       values ($1, $2, 'real', $3::jsonb, $4, $5::tipo_questao,
               $6, $7::jsonb, $8::jsonb, $9, $10, $11::status_questao)
       on conflict (prova_id, numero) where vigente and prova_id is not null
       do nothing
       returning id`,
      [
        contexto.prova.id,
        questao.numero,
        JSON.stringify(fonteCitacaoDe(contexto.prova, questao.numero)),
        classificacao.topicoId,
        questao.tipo_questao,
        questao.enunciado,
        questao.alternativas === null ? null : JSON.stringify(questao.alternativas),
        JSON.stringify(imagens),
        questao.dificuldade,
        questao.confianca_ia,
        status,
      ],
    );

    if (rows.length > 0) resumo.inseridas += 1;
    else resumo.jaExistiam += 1;
  }

  return resumo;
}

/**
 * Sobe as imagens da pagina da questao.
 *
 * `falhou = true` cobre os dois casos que o M1 trata igual: a pagina disse ter
 * figura e o PDF nao entregou nenhuma (bitmap que nao e JPEG), e a subida ao
 * Storage deu erro. Nos dois, a questao segue para revisao com `imagens` vazio
 * — meia imagem no acervo e pior do que nenhuma.
 */
async function subirImagensDaQuestao(
  questao: QuestaoExtraida,
  contexto: ContextoDaGravacao,
): Promise<{ imagens: Imagem[]; falhou: boolean }> {
  if (!questao.tem_imagem) return { imagens: [], falhou: false };

  const daPagina = contexto.imagensPorPagina.get(questao.pagina) ?? [];
  if (daPagina.length === 0) return { imagens: [], falhou: true };

  const imagens: Imagem[] = [];
  try {
    for (const [indice, imagem] of daPagina.entries()) {
      const caminho = caminhoDaImagem(contexto.prova.id, questao.numero, indice);
      await contexto.subirImagem(caminho, imagem.jpeg);
      imagens.push({
        storage_path: `${contexto.bucket}/${caminho}`,
        posicao: "enunciado",
        // Descricao provisoria: quem escreve a de verdade e o revisor, que e
        // por isso que a questao com imagem nasce `em_revisao`.
        alt_text: `Figura da questao ${questao.numero} — descricao pendente de revisao`,
      });
    }
  } catch {
    return { imagens: [], falhou: true };
  }

  return { imagens, falhou: false };
}
