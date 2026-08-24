import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDeServico } from "@/lib/db/servidor";
import {
  alternativasSchema,
  fonteCitacaoSchema,
  imagensSchema,
  type Alternativa,
  type FonteCitacao,
  type Imagem,
  type OrigemQuestao,
  type TipoQuestao,
} from "@/modules/acervo";
import { getParam, getParams } from "@/modules/config";

import type { Contexto } from "./tentativas";

const QUESTAO_PUBLICA_SELECT =
  "id, questao_versao, origem, topico_id, tipo_questao, enunciado, alternativas, imagens, fonte_citacao";
const QUESTAO_RESPOSTA_SELECT =
  `${QUESTAO_PUBLICA_SELECT}, resposta_correta, gabarito_versao`;
const DURACAO_URL_IMAGEM_SEGUNDOS = 60 * 60;

export const TIPOS_DE_BLOCO = ["revisar", "avancar", "treinar", "simulado"] as const;
export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export type LinhaDeQuestao = {
  id: string;
  questao_versao: number;
  origem: OrigemQuestao;
  topico_id: string | null;
  tipo_questao: TipoQuestao;
  enunciado: string;
  alternativas: unknown;
  imagens: unknown;
  fonte_citacao: unknown;
  status?: string;
  vigente?: boolean;
  anulada?: boolean;
  resposta_correta?: string | null;
  gabarito_versao?: string | null;
};

export type ImagemDaSessao = {
  posicao: Imagem["posicao"];
  altText: string;
  url: string;
};

export type QuestaoDaSessao = {
  id: string;
  questaoVersao: number;
  origem: OrigemQuestao;
  topicoId: string | null;
  tipoQuestao: TipoQuestao;
  enunciado: string;
  alternativas: readonly Alternativa[] | null;
  fonteCitacao: FonteCitacao | null;
  imagens: readonly ImagemDaSessao[];
};

export type QuestaoParaResposta = QuestaoDaSessao & {
  respostaCorreta: string;
  gabaritoVersao: string;
};

export type ItemDaSessao = {
  id: string;
  questaoId: string;
  questaoVersao: number;
  ordem: number;
  respondidoEm: string | null;
  questao: QuestaoDaSessao;
};

export type SessaoDaTela = {
  id: string;
  blocoId: string | null;
  contexto: Contexto;
  encerradaEm: string | null;
  /** Só itens ainda pendentes chegam à tela; respostas já gravadas ficam no log. */
  itens: readonly ItemDaSessao[];
};

export type ItemParaResposta = {
  sessao: {
    id: string;
    contexto: Contexto;
    encerradaEm: string | null;
  };
  item: {
    id: string;
    questaoId: string;
    questaoVersao: number;
    ordem: number;
    respondidoEm: string | null;
  };
  questao: QuestaoParaResposta;
};

export type ResultadoDaSelecao = {
  id: string;
  questao_versao: number;
  origem: OrigemQuestao;
  topico_id: string | null;
  tipo_questao: TipoQuestao;
  enunciado: string;
  alternativas: unknown;
  imagens: unknown;
  fonte_citacao: unknown;
  status?: string;
  vigente?: boolean;
  anulada?: boolean;
  resposta_correta?: string | null;
  gabarito_versao?: string | null;
};

export class SessaoRecusada extends Error {
  readonly motivo:
    | "usuario_ausente"
    | "bloco_inexistente"
    | "acervo_vazio"
    | "sessao_inexistente"
    | "sessao_encerrada"
    | "item_inexistente"
    | "gabarito_ausente"
    | "acervo_inconsistente"
    | "falha_imagem";

  constructor(motivo: SessaoRecusada["motivo"], mensagem: string) {
    super(mensagem);
    this.name = "SessaoRecusada";
    this.motivo = motivo;
  }
}

type ErroPostgrest = { message: string; code?: string } | null;

type BlocoDaConsulta = {
  id: string;
  plano_dia_id: string;
  tipo: TipoDeBloco;
  topico_id: string | null;
  n_questoes?: number | null;
};

type SessaoDaConsulta = {
  id: string;
  plano_bloco_id: string | null;
  contexto: Contexto;
  encerrada_em: string | null;
};

type ItemDaConsulta = {
  id: string;
  sessao_id: string;
  questao_id: string;
  questao_versao: number;
  ordem: number;
  respondido_em: string | null;
};

type AssinadorDeImagem = (storagePath: string) => Promise<string>;

/**
 * Filtra novamente no domínio o contrato que o banco já filtra na consulta.
 * Isso mantém a regra testável e protege a tela se uma fonte ou mock devolver
 * uma questão anulada, antiga ou fora do tópico por engano.
 */
export function selecionarQuestoesDisponiveis(
  linhas: readonly LinhaDeQuestao[],
  opcoes: {
    tipo: TipoDeBloco;
    topicoId: string | null;
    quantidade: number;
    idsRecentes?: readonly string[];
  },
): LinhaDeQuestao[] {
  const recentes = new Set(opcoes.idsRecentes ?? []);

  return linhas
    .filter((linha) => linha.status === undefined || linha.status === "publicada")
    .filter((linha) => linha.vigente === undefined || linha.vigente)
    .filter((linha) => linha.anulada === undefined || !linha.anulada)
    .filter((linha) => opcoes.topicoId === null || linha.topico_id === opcoes.topicoId)
    .filter((linha) => opcoes.tipo !== "treinar" || !recentes.has(linha.id))
    .slice(0, opcoes.quantidade);
}

/** Retomada visual: item respondido não volta para a fila de questões. */
export function itensPendentes(
  itens: readonly Pick<ItemDaConsulta, "respondido_em">[],
): number[] {
  return itens
    .map((item, indice) => (item.respondido_em === null ? indice : -1))
    .filter((indice) => indice >= 0);
}

/** Converte um bloco do plano no contexto que será derivado no servidor. */
export function contextoDoBloco(tipo: TipoDeBloco): Contexto {
  if (tipo === "revisar") return "revisao";
  if (tipo === "treinar") return "treino";
  if (tipo === "simulado") return "simulado";
  return "plano";
}

/**
 * Mapeia a linha do acervo para o contrato público. O gabarito não participa
 * deste tipo e, portanto, não pode ser enviado à tela por acidente.
 */
export async function mapearQuestaoParaTela(
  linha: LinhaDeQuestao,
  assinarImagem: AssinadorDeImagem,
): Promise<QuestaoDaSessao> {
  const alternativas =
    linha.tipo_questao === "certo_errado"
      ? null
      : validarJson(
          alternativasSchema.safeParse(linha.alternativas),
          "alternativas",
        );

  const fonteCitacao =
    linha.fonte_citacao === null || linha.fonte_citacao === undefined
      ? null
      : validarJson(fonteCitacaoSchema.safeParse(linha.fonte_citacao), "proveniência");

  const imagens = validarJson(
    imagensSchema.safeParse(linha.imagens ?? []),
    "imagens",
  );

  return {
    id: linha.id,
    questaoVersao: Number(linha.questao_versao),
    origem: linha.origem,
    topicoId: linha.topico_id,
    tipoQuestao: linha.tipo_questao,
    enunciado: linha.enunciado,
    alternativas,
    fonteCitacao,
    imagens: await Promise.all(
      imagens.map(async (imagem) => ({
        posicao: imagem.posicao,
        altText: imagem.alt_text,
        url: await assinarImagem(imagem.storage_path),
      })),
    ),
  };
}

/** Preparação idempotente: uma chamada aberta por aluno e bloco. */
export async function prepararSessao(
  cliente: SupabaseClient,
  blocoId: string,
): Promise<{ id: string; retomada: boolean }> {
  const usuario = await usuarioDaSessao(cliente);
  const aberta = await lerUma<SessaoDaConsulta>(
    cliente
      .from("sessoes")
      .select("id, plano_bloco_id, contexto, encerrada_em")
      .eq("user_id", usuario.id)
      .eq("plano_bloco_id", blocoId)
      .is("encerrada_em", null)
      .order("iniciada_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "sessão aberta",
  );

  if (aberta !== null) return { id: aberta.id, retomada: true };

  const bloco = await lerUma<BlocoDaConsulta>(
    cliente
      .from("plano_bloco")
      .select("id, plano_dia_id, tipo, topico_id, n_questoes")
      .eq("id", blocoId)
      .maybeSingle(),
    "bloco do plano",
  );

  if (bloco === null) {
    throw new SessaoRecusada(
      "bloco_inexistente",
      "O bloco não existe ou não pertence ao aluno.",
    );
  }

  const [questoesPadrao, diasSemRepetir] = await getParams(
    "param.m4.questoes_por_bloco",
    "param.m4.dias_sem_repetir_questao",
  );
  // A quantidade pertence ao snapshot do bloco. O fallback mantém a leitura
  // operável para planos legados que ainda não tinham a coluna nova.
  const questoesPorBloco =
    typeof bloco.n_questoes === "number" &&
    Number.isInteger(bloco.n_questoes) &&
    bloco.n_questoes > 0
      ? bloco.n_questoes
      : questoesPadrao;
  const contexto = contextoDoBloco(bloco.tipo);
  const idsRecentes =
    contexto === "treino"
      ? await idsDeQuestoesRecentes(cliente, usuario.id, diasSemRepetir)
      : [];

  let consulta = cliente
    .from("questoes")
    .select(QUESTAO_PUBLICA_SELECT)
    .eq("status", "publicada")
    .eq("vigente", true)
    .eq("anulada", false)
    .order("id", { ascending: true })
    .limit(questoesPorBloco);

  if (bloco.topico_id !== null) {
    consulta = consulta.eq("topico_id", bloco.topico_id);
  }
  if (idsRecentes.length > 0) {
    consulta = consulta.not("id", "in", `(${idsRecentes.join(",")})`);
  }

  const linhas = await lerLista<LinhaDeQuestao>(consulta, "questões do bloco");
  const selecionadas = selecionarQuestoesDisponiveis(linhas, {
    tipo: bloco.tipo,
    topicoId: bloco.topico_id,
    quantidade: questoesPorBloco,
    idsRecentes,
  });

  if (selecionadas.length === 0) {
    throw new SessaoRecusada(
      "acervo_vazio",
      "Não há questões publicadas disponíveis para este bloco.",
    );
  }

  const criada = await inserirSessao(cliente, {
    userId: usuario.id,
    bloco,
    contexto,
  });

  const itens = selecionadas.map((questao, indice) => ({
    sessao_id: criada.id,
    questao_id: questao.id,
    questao_versao: questao.questao_versao,
    ordem: indice + 1,
  }));

  const { error } = await cliente.from("sessao_itens").insert(itens);
  if (error) {
    // Não deixe uma sessão órfã aberta: a próxima entrada precisa poder tentar
    // montar o mesmo bloco de novo depois de uma falha transitória.
    await cliente.from("sessoes").delete().eq("id", criada.id);
    throw new SessaoRecusada(
      "acervo_inconsistente",
      `Não foi possível montar a sessão: ${error.message}`,
    );
  }

  return criada;
}

/** Lê apenas os itens ainda pendentes e assina imagens no servidor. */
export async function consultarSessao(
  cliente: SupabaseClient,
  sessaoId: string,
): Promise<SessaoDaTela | null> {
  const sessao = await lerUma<SessaoDaConsulta>(
    cliente
      .from("sessoes")
      .select("id, plano_bloco_id, contexto, encerrada_em")
      .eq("id", sessaoId)
      .maybeSingle(),
    "sessão",
  );

  if (sessao === null) return null;

  const itens = await lerLista<ItemDaConsulta>(
    cliente
      .from("sessao_itens")
      .select("id, sessao_id, questao_id, questao_versao, ordem, respondido_em")
      .eq("sessao_id", sessaoId)
      .is("respondido_em", null)
      .order("ordem", { ascending: true }),
    "itens pendentes",
  );

  if (itens.length === 0) {
    return {
      id: sessao.id,
      blocoId: sessao.plano_bloco_id,
      contexto: sessao.contexto,
      encerradaEm: sessao.encerrada_em,
      itens: [],
    };
  }

  const ids = [...new Set(itens.map((item) => item.questao_id))];
  const linhas = await lerLista<LinhaDeQuestao>(
    cliente.from("questoes").select(QUESTAO_PUBLICA_SELECT).in("id", ids),
    "questões da sessão",
  );
  const porVersao = new Map(
    linhas.map((linha) => [`${linha.id}:${linha.questao_versao}`, linha]),
  );
  const precisaAssinatura = linhas.some((linha) => {
    const imagens = imagensSchema.safeParse(linha.imagens ?? []);
    return imagens.success && imagens.data.length > 0;
  });
  const assinar = precisaAssinatura
    ? await assinadorDoStorage()
    : async () => "";

  const itensDaTela = await Promise.all(
    itens.map(async (item) => {
      const linha = porVersao.get(`${item.questao_id}:${item.questao_versao}`);
      if (linha === undefined) {
        throw new SessaoRecusada(
          "acervo_inconsistente",
          "A versão da questão da sessão não está disponível.",
        );
      }

      return {
        id: item.id,
        questaoId: item.questao_id,
        questaoVersao: item.questao_versao,
        ordem: item.ordem,
        respondidoEm: item.respondido_em,
        questao: await mapearQuestaoParaTela(linha, assinar),
      };
    }),
  );

  return {
    id: sessao.id,
    blocoId: sessao.plano_bloco_id,
    contexto: sessao.contexto,
    encerradaEm: sessao.encerrada_em,
    itens: itensDaTela,
  };
}

/** Lê o snapshot privado necessário para registrar uma resposta. */
export async function obterItemParaResposta(
  cliente: SupabaseClient,
  sessaoId: string,
  itemId: string,
): Promise<ItemParaResposta> {
  const sessao = await lerUma<SessaoDaConsulta>(
    cliente
      .from("sessoes")
      .select("id, plano_bloco_id, contexto, encerrada_em")
      .eq("id", sessaoId)
      .maybeSingle(),
    "sessão para resposta",
  );
  if (sessao === null) {
    throw new SessaoRecusada("sessao_inexistente", "Sessão não encontrada.");
  }

  const item = await lerUma<ItemDaConsulta>(
    cliente
      .from("sessao_itens")
      .select("id, sessao_id, questao_id, questao_versao, ordem, respondido_em")
      .eq("id", itemId)
      .eq("sessao_id", sessaoId)
      .maybeSingle(),
    "item para resposta",
  );
  if (item === null) {
    throw new SessaoRecusada("item_inexistente", "Item não encontrado na sessão.");
  }
  if (sessao.encerrada_em !== null && item.respondido_em === null) {
    throw new SessaoRecusada("sessao_encerrada", "Esta sessão já foi encerrada.");
  }

  const linha = await lerUma<LinhaDeQuestao>(
    cliente
      .from("questoes")
      .select(QUESTAO_RESPOSTA_SELECT)
      .eq("id", item.questao_id)
      .eq("questao_versao", item.questao_versao)
      .maybeSingle(),
    "questão para resposta",
  );
  if (linha === null) {
    throw new SessaoRecusada(
      "acervo_inconsistente",
      "A versão da questão não está disponível.",
    );
  }
  if (typeof linha.resposta_correta !== "string" || typeof linha.gabarito_versao !== "string") {
    throw new SessaoRecusada(
      "gabarito_ausente",
      "A questão ainda não tem gabarito definitivo.",
    );
  }

  return {
    sessao: {
      id: sessao.id,
      contexto: sessao.contexto,
      encerradaEm: sessao.encerrada_em,
    },
    item: {
      id: item.id,
      questaoId: item.questao_id,
      questaoVersao: item.questao_versao,
      ordem: item.ordem,
      respondidoEm: item.respondido_em,
    },
    questao: {
      ...(await mapearQuestaoParaTela(linha, async () => "")),
      respostaCorreta: linha.resposta_correta,
      gabaritoVersao: linha.gabarito_versao,
    },
  };
}

async function usuarioDaSessao(cliente: SupabaseClient): Promise<{ id: string }> {
  const { data, error } = await cliente.auth.getUser();
  if (error) {
    throw new SessaoRecusada("usuario_ausente", "Não foi possível validar a sessão.");
  }
  if (data.user === null) {
    throw new SessaoRecusada("usuario_ausente", "É preciso estar autenticado.");
  }
  return { id: data.user.id };
}

async function idsDeQuestoesRecentes(
  cliente: SupabaseClient,
  userId: string,
  dias: number,
): Promise<string[]> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const linhas = await lerLista<{ questao_id: string }>(
    cliente
      .from("tentativas")
      .select("questao_id")
      .eq("user_id", userId)
      .eq("contexto", "treino")
      .gte("respondida_em", desde),
    "histórico recente",
  );
  return [...new Set(linhas.map((linha) => linha.questao_id))];
}

async function inserirSessao(
  cliente: SupabaseClient,
  entrada: {
    userId: string;
    bloco: BlocoDaConsulta;
    contexto: Contexto;
  },
): Promise<{ id: string; retomada: boolean }> {
  const { data, error } = await cliente
    .from("sessoes")
    .insert({
      user_id: entrada.userId,
      contexto: entrada.contexto,
      plano_dia_id: entrada.bloco.plano_dia_id,
      plano_bloco_id: entrada.bloco.id,
    })
    .select("id")
    .single();

  if (!error && data !== null) return { id: data.id, retomada: false };

  // A segunda requisição concorrente perde o índice parcial e apenas retoma a
  // sessão criada pela primeira. O caminho comum não depende de exceção.
  if (error?.code === "23505") {
    const aberta = await lerUma<SessaoDaConsulta>(
      cliente
        .from("sessoes")
        .select("id, plano_bloco_id, contexto, encerrada_em")
        .eq("user_id", entrada.userId)
        .eq("plano_bloco_id", entrada.bloco.id)
        .is("encerrada_em", null)
        .order("iniciada_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "sessão concorrente",
    );
    if (aberta !== null) return { id: aberta.id, retomada: true };
  }

  throw new SessaoRecusada(
    "acervo_inconsistente",
    `Não foi possível abrir a sessão: ${error?.message ?? "resposta vazia"}`,
  );
}

async function assinadorDoStorage(): Promise<AssinadorDeImagem> {
  const bucketPadrao = await getParam("param.m1.bucket_de_imagens");
  const servico = clienteDeServico();

  return async (storagePath) => {
    const separador = storagePath.indexOf("/");
    const bucket = separador > 0 ? storagePath.slice(0, separador) : bucketPadrao;
    const caminho = separador > 0 ? storagePath.slice(separador + 1) : storagePath;
    const { data, error } = await servico.storage
      .from(bucket)
      .createSignedUrl(caminho, DURACAO_URL_IMAGEM_SEGUNDOS);

    if (error || data?.signedUrl === undefined) {
      throw new SessaoRecusada(
        "falha_imagem",
        "Não foi possível preparar uma imagem da questão.",
      );
    }
    return data.signedUrl;
  };
}

function validarJson<T>(resultado: { success: true; data: T } | { success: false }, nome: string): T {
  if (!resultado.success) {
    throw new SessaoRecusada(
      "acervo_inconsistente",
      `O formato de ${nome} da questão não é confiável.`,
    );
  }
  return resultado.data;
}

async function lerUma<T>(
  consulta: PromiseLike<{ data: T | null; error: ErroPostgrest }>,
  nome: string,
): Promise<T | null> {
  const { data, error } = await consulta;
  if (error) {
    throw new SessaoRecusada(
      "acervo_inconsistente",
      `Falha ao ler ${nome}: ${error.message}`,
    );
  }
  return data;
}

async function lerLista<T>(
  consulta: PromiseLike<{ data: T[] | null; error: ErroPostgrest }>,
  nome: string,
): Promise<T[]> {
  const { data, error } = await consulta;
  if (error) {
    throw new SessaoRecusada(
      "acervo_inconsistente",
      `Falha ao ler ${nome}: ${error.message}`,
    );
  }
  return data ?? [];
}
