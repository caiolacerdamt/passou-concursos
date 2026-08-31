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

import { dataHojeDoProduto } from "./plano";
import {
  CAUSAS_DO_CADERNO,
  type CausaDoCaderno,
} from "./progresso";
import type { Contexto } from "./tentativas";

const QUESTAO_PUBLICA_SELECT =
  "id, questao_versao, origem, topico_id, tipo_questao, enunciado, alternativas, imagens, fonte_citacao, status, vigente, anulada";
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

type ItemDaSessaoBase = {
  id: string;
  questaoId: string;
  questaoVersao: number;
  ordem: number;
};

export type ItemDaSessao =
  | (ItemDaSessaoBase & {
      somenteLeitura: false;
      respondidoEm: null;
      questao: QuestaoDaSessao;
    })
  | (ItemDaSessaoBase & {
      somenteLeitura: true;
      respondidoEm: string;
      respostaDada: string;
      correta: boolean;
      questao: QuestaoDaSessao & { respostaCorreta: string };
    });

export type SessaoDaTela = {
  id: string;
  blocoId: string | null;
  contexto: Contexto;
  encerradaEm: string | null;
  /** Todos os itens chegam ordenados; os já respondidos são somente leitura. */
  totalItens: number;
  itensRespondidos: number;
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

export type OpcoesDaRefacao = {
  topicoId: string;
  causa: CausaDoCaderno;
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
    | "refacao_indisponivel"
    | "revisao_indisponivel"
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
  refacao_chave?: string | null;
};

type ItemDaConsulta = {
  id: string;
  sessao_id: string;
  questao_id: string;
  questao_versao: number;
  ordem: number;
  respondido_em: string | null;
};

type TentativaDaConsulta = {
  questao_id: string;
  questao_versao: number;
  ordem_na_sessao: number;
  resposta_dada: string;
  correta: boolean;
};

type AssinadorDeImagem = (storagePath: string) => Promise<string>;

type TentativaErradaDaRefacao = {
  id: string;
  questao_id: string;
  questao_versao: number;
  topico_id: string;
  causa_erro: string | null;
  respondida_em: string;
};

type CausaSimuladoDaRefacao = {
  tentativa_id: string;
  causa_erro: string;
};

type ItemEsperadoDaRefacao = {
  sessao_id: string;
  questao_id: string;
  questao_versao: number;
  ordem: number;
};

type ItemDaRefacaoBanco = Omit<ItemEsperadoDaRefacao, "sessao_id"> & {
  id: string;
  sessao_id: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * O sufixo que separa a revisão avulsa da refação dentro de `refacao_chave`
 * (AD-115). Não pertence a `CAUSAS_DO_CADERNO`, então as duas famílias de chave
 * nunca colidem, e `tópico|qualificador` continua sendo o formato único —
 * quem lê a chave segue tirando o tópico do primeiro campo.
 */
const QUALIFICADOR_DA_REVISAO = "revisao_avulsa";

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
      .select("id, plano_bloco_id, contexto, encerrada_em, refacao_chave")
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

/**
 * Monta uma sessão exclusivamente com erros do próprio aluno.
 *
 * O tópico e a causa são filtros de navegação, não autoridade: a lista de
 * questões nasce de `tentativas` sob RLS, e cada versão é conferida novamente
 * no acervo antes de entrar na sessão. A chave parcial da migration torna o
 * duplo clique idempotente mesmo quando as duas requisições passam no SELECT.
 */
export async function prepararSessaoDeRefacao(
  cliente: SupabaseClient,
  opcoes: OpcoesDaRefacao,
): Promise<{ id: string; retomada: boolean }> {
  if (
    !UUID.test(opcoes.topicoId) ||
    !(CAUSAS_DO_CADERNO as readonly string[]).includes(opcoes.causa)
  ) {
    throw new SessaoRecusada(
      "refacao_indisponivel",
      "Não foi possível identificar este caderno de erros.",
    );
  }

  const usuario = await usuarioDaSessao(cliente);
  const refacaoChave = `${opcoes.topicoId}|${opcoes.causa}`;
  const aberta = await lerUma<SessaoDaConsulta>(
    cliente
      .from("sessoes")
      .select("id, plano_bloco_id, contexto, encerrada_em, refacao_chave")
      .eq("user_id", usuario.id)
      .eq("refacao_chave", refacaoChave)
      .is("encerrada_em", null)
      .order("iniciada_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "refação aberta",
  );
  if (aberta !== null) {
    const itensExistentes = await lerItensDaRefacao(cliente, aberta.id);
    if (itensExistentes.length > 0) return { id: aberta.id, retomada: true };
  }

  const tentativas = await lerLista<TentativaErradaDaRefacao>(
    cliente
      .from("tentativas")
      .select("id, questao_id, questao_versao, topico_id, causa_erro, respondida_em")
      .eq("user_id", usuario.id)
      .eq("topico_id", opcoes.topicoId)
      .eq("correta", false)
      .order("respondida_em", { ascending: false }),
    "erros do caderno",
  );

  const idsDasTentativas = tentativas.map((tentativa) => tentativa.id);
  const causasSimulado =
    idsDasTentativas.length === 0
      ? []
      : await lerLista<CausaSimuladoDaRefacao>(
          cliente
            .from("tentativa_causa_simulado")
            .select("tentativa_id, causa_erro")
            .eq("user_id", usuario.id)
            .in("tentativa_id", idsDasTentativas),
          "causas dos erros",
        );
  const causaPorTentativa = new Map(
    causasSimulado.map((linha) => [linha.tentativa_id, linha.causa_erro]),
  );
  const candidatos = tentativas.filter((tentativa) => {
    const causa = tentativa.causa_erro ?? causaPorTentativa.get(tentativa.id) ?? null;
    return causa === opcoes.causa;
  });

  if (candidatos.length === 0) {
    throw new SessaoRecusada(
      "acervo_vazio",
      "Não há questões disponíveis para refazer neste erro.",
    );
  }

  const [questoesPorRefacao] = await getParams("param.m4.questoes_por_bloco");
  const candidatosLimitados: TentativaErradaDaRefacao[] = [];
  const versoesDosCandidatos = new Set<string>();
  for (const candidato of candidatos) {
    const versao = Number(candidato.questao_versao);
    if (!Number.isInteger(versao) || versao < 1) continue;
    const chave = `${candidato.questao_id}:${versao}`;
    if (versoesDosCandidatos.has(chave)) continue;
    versoesDosCandidatos.add(chave);
    candidatosLimitados.push({ ...candidato, questao_versao: versao });
    if (candidatosLimitados.length >= questoesPorRefacao) break;
  }
  if (candidatosLimitados.length === 0) {
    throw new SessaoRecusada(
      "acervo_vazio",
      "Não há questões disponíveis para refazer neste erro.",
    );
  }

  const ids = [...new Set(candidatosLimitados.map((tentativa) => tentativa.questao_id))];
  const linhas = await lerLista<LinhaDeQuestao>(
    cliente
      .from("questoes")
      .select(QUESTAO_PUBLICA_SELECT)
      .in("id", ids)
      .eq("status", "publicada")
      .eq("vigente", true)
      .eq("anulada", false),
    "questões do caderno",
  );
  const porVersao = new Map(
    linhas.map((linha) => [`${linha.id}:${linha.questao_versao}`, linha]),
  );
  const selecionadas: LinhaDeQuestao[] = [];
  for (const candidato of candidatosLimitados) {
    const chave = `${candidato.questao_id}:${candidato.questao_versao}`;
    const linha = porVersao.get(chave);
    if (linha === undefined) continue;
    selecionadas.push(linha);
  }

  const disponiveis = selecionarQuestoesDisponiveis(selecionadas, {
    tipo: "treinar",
    // O tópico do filtro é o snapshot da tentativa. Uma reclassificação
    // posterior do acervo não pode deslocar o erro histórico para outro grupo.
    topicoId: null,
    quantidade: questoesPorRefacao,
  });
  if (disponiveis.length === 0) {
    throw new SessaoRecusada(
      "acervo_vazio",
      "As questões deste erro foram retiradas do acervo.",
    );
  }

  const criada = await inserirSessaoRefacao(cliente, {
    userId: usuario.id,
    refacaoChave,
  });

  const itens: ItemEsperadoDaRefacao[] = disponiveis.map((questao, indice) => ({
    sessao_id: criada.id,
    questao_id: questao.id,
    questao_versao: questao.questao_versao,
    ordem: indice + 1,
  }));
  // A sessão e seus itens são duas chamadas PostgREST. Tanto a vencedora
  // quanto a perdedora do índice parcial passam por esta reconciliação; se a
  // inserção concorrente ganhar, a leitura seguinte confirma o mesmo conjunto
  // sem apagar a sessão que a outra requisição acabou de preencher.
  await garantirItensDaRefacao(cliente, criada.id, itens);

  return criada;
}

/**
 * Monta uma revisão avulsa de um tópico que já venceu na agenda — AD-115.
 *
 * É a ação da tela de prática para a revisão que venceu e **não** entrou no
 * plano de hoje. Sem ela aquela lista seria leitura sem saída, que é o defeito
 * que o redesenho existe para remover.
 *
 * A agenda é o porteiro, não o parâmetro: o tópico só abre sessão se
 * `revisao_agenda` disser que ele venceu. Isso mantém a regra do produto — a
 * revisão acontece na data certa — mesmo com a URL editada à mão.
 *
 * A chave reusa `refacao_chave` na forma `tópico|qualificador`: é o mesmo
 * problema (sessão sem bloco precisa de chave própria contra o duplo clique) e
 * o mesmo índice parcial resolve. `revisao_avulsa` não pertence a
 * `CAUSAS_DO_CADERNO`, então nunca colide com uma chave de refação.
 */
export async function prepararSessaoDeRevisao(
  cliente: SupabaseClient,
  opcoes: { topicoId: string; hoje?: string },
): Promise<{ id: string; retomada: boolean }> {
  if (!UUID.test(opcoes.topicoId)) {
    throw new SessaoRecusada(
      "revisao_indisponivel",
      "Não foi possível identificar este tópico de revisão.",
    );
  }

  const usuario = await usuarioDaSessao(cliente);
  const hoje = opcoes.hoje ?? dataHojeDoProduto();

  const devida = await lerUma<{ topico_id: string }>(
    cliente
      .from("revisao_agenda")
      .select("topico_id")
      .eq("topico_id", opcoes.topicoId)
      .lte("due", hoje)
      .limit(1)
      .maybeSingle(),
    "agenda da revisão",
  );
  if (devida === null) {
    throw new SessaoRecusada(
      "revisao_indisponivel",
      "Este tópico não tem revisão vencida na sua agenda.",
    );
  }

  const revisaoChave = `${opcoes.topicoId}|${QUALIFICADOR_DA_REVISAO}`;
  const aberta = await lerUma<SessaoDaConsulta>(
    cliente
      .from("sessoes")
      .select("id, plano_bloco_id, contexto, encerrada_em, refacao_chave")
      .eq("user_id", usuario.id)
      .eq("refacao_chave", revisaoChave)
      .is("encerrada_em", null)
      .order("iniciada_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "revisão aberta",
  );
  if (aberta !== null) {
    const itensExistentes = await lerItensDaRefacao(cliente, aberta.id);
    if (itensExistentes.length > 0) return { id: aberta.id, retomada: true };
  }

  const [questoesPorBloco] = await getParams("param.m4.questoes_por_bloco");
  const linhas = await lerLista<LinhaDeQuestao>(
    cliente
      .from("questoes")
      .select(QUESTAO_PUBLICA_SELECT)
      .eq("topico_id", opcoes.topicoId)
      .eq("status", "publicada")
      .eq("vigente", true)
      .eq("anulada", false)
      .order("id", { ascending: true })
      .limit(questoesPorBloco),
    "questões da revisão",
  );

  const selecionadas = selecionarQuestoesDisponiveis(linhas, {
    tipo: "revisar",
    topicoId: opcoes.topicoId,
    quantidade: questoesPorBloco,
  });
  if (selecionadas.length === 0) {
    throw new SessaoRecusada(
      "acervo_vazio",
      "Não há questões publicadas disponíveis para esta revisão.",
    );
  }

  const criada = await inserirSessaoRefacao(cliente, {
    userId: usuario.id,
    refacaoChave: revisaoChave,
    contexto: "revisao",
  });

  await garantirItensDaRefacao(
    cliente,
    criada.id,
    selecionadas.map((questao, indice) => ({
      sessao_id: criada.id,
      questao_id: questao.id,
      questao_versao: questao.questao_versao,
      ordem: indice + 1,
    })),
  );

  return criada;
}

/** Lê a sessão completa; itens respondidos chegam à tela somente para leitura. */
export async function consultarSessao(
  cliente: SupabaseClient,
  sessaoId: string,
): Promise<SessaoDaTela | null> {
  const sessao = await lerUma<SessaoDaConsulta>(
    cliente
      .from("sessoes")
      .select("id, plano_bloco_id, contexto, encerrada_em, refacao_chave")
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
      .order("ordem", { ascending: true }),
    "itens da sessão",
  );

  const itensRespondidos = itens.filter((item) => item.respondido_em !== null);
  const idsPendentes = [
    ...new Set(
      itens
        .filter((item) => item.respondido_em === null)
        .map((item) => item.questao_id),
    ),
  ];
  const idsRespondidos = [...new Set(itensRespondidos.map((item) => item.questao_id))];

  const tentativas =
    idsRespondidos.length === 0
      ? []
      : await lerLista<TentativaDaConsulta>(
          cliente
            .from("tentativas")
            .select("questao_id, questao_versao, ordem_na_sessao, resposta_dada, correta")
            .eq("sessao_id", sessaoId)
            .order("respondida_em", { ascending: false }),
          "respostas da sessão",
        );

  const tentativasPorQuestao = new Map<string, TentativaDaConsulta>();
  for (const tentativa of tentativas) {
    const chave = `${tentativa.questao_id}:${tentativa.questao_versao}`;
    // A RPC de resposta garante uma tentativa por item. Se um dado legado
    // aparecer duplicado, a ordenação mantém a resposta mais recente visível.
    if (!tentativasPorQuestao.has(chave)) tentativasPorQuestao.set(chave, tentativa);
  }

  // O gabarito só atravessa a fronteira para itens que já têm resposta gravada.
  // Itens pendentes usam o select público, que não contém `resposta_correta`;
  // não há caminho aqui em que uma questão pendente receba o gabarito.
  const consultarQuestoes = async (
    ids: readonly string[],
    select: string,
    nome: string,
  ): Promise<LinhaDeQuestao[]> => {
    if (ids.length === 0) return [];
    let consulta = cliente.from("questoes").select(select).in("id", ids);
    if (sessao.refacao_chave) {
      consulta = consulta
        .eq("status", "publicada")
        .eq("vigente", true)
        .eq("anulada", false);
    }
    return lerLista<LinhaDeQuestao>(
      consulta as unknown as PromiseLike<{
        data: LinhaDeQuestao[] | null;
        error: ErroPostgrest;
      }>,
      nome,
    );
  };

  const [linhasPendentes, linhasRespondidas] = await Promise.all([
    consultarQuestoes(idsPendentes, QUESTAO_PUBLICA_SELECT, "questões pendentes da sessão"),
    consultarQuestoes(idsRespondidos, QUESTAO_RESPOSTA_SELECT, "questões respondidas da sessão"),
  ]);
  const linhas = [...linhasPendentes, ...linhasRespondidas];
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

      const itemBase = {
        id: item.id,
        questaoId: item.questao_id,
        questaoVersao: item.questao_versao,
        ordem: item.ordem,
      };
      const questao = await mapearQuestaoParaTela(linha, assinar);
      if (item.respondido_em === null) {
        return {
          ...itemBase,
          somenteLeitura: false as const,
          respondidoEm: null,
          questao,
        };
      }

      const tentativa = tentativasPorQuestao.get(`${item.questao_id}:${item.questao_versao}`);
      if (
        tentativa === undefined ||
        typeof tentativa.resposta_dada !== "string" ||
        typeof tentativa.correta !== "boolean" ||
        typeof linha.resposta_correta !== "string"
      ) {
        throw new SessaoRecusada(
          "acervo_inconsistente",
          "A resposta gravada da sessão não está disponível para revisão.",
        );
      }

      return {
        ...itemBase,
        somenteLeitura: true as const,
        respondidoEm: item.respondido_em,
        respostaDada: tentativa.resposta_dada,
        correta: tentativa.correta,
        questao: { ...questao, respostaCorreta: linha.resposta_correta },
      };
    }),
  );

  return {
    id: sessao.id,
    blocoId: sessao.plano_bloco_id,
    contexto: sessao.contexto,
    encerradaEm: sessao.encerrada_em,
    totalItens: itens.length,
    itensRespondidos: itensRespondidos.length,
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
      .select("id, plano_bloco_id, contexto, encerrada_em, refacao_chave")
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
    (() => {
      let consulta = cliente
      .from("questoes")
      .select(QUESTAO_RESPOSTA_SELECT)
      .eq("id", item.questao_id)
      .eq("questao_versao", item.questao_versao);
      if (sessao.refacao_chave) {
        consulta = consulta
          .eq("status", "publicada")
          .eq("vigente", true)
          .eq("anulada", false);
      }
      return consulta.maybeSingle();
    })(),
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
        .select("id, plano_bloco_id, contexto, encerrada_em, refacao_chave")
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

async function inserirSessaoRefacao(
  cliente: SupabaseClient,
  entrada: { userId: string; refacaoChave: string; contexto?: Contexto },
): Promise<{ id: string; retomada: boolean }> {
  const { data, error } = await cliente
    .from("sessoes")
    .insert({
      user_id: entrada.userId,
      // A refação do caderno é treino; a revisão avulsa é revisão de verdade e
      // precisa do contexto certo para a agenda do FSRS reagir a ela.
      contexto: entrada.contexto ?? "treino",
      refacao_chave: entrada.refacaoChave,
    })
    .select("id")
    .single();

  if (!error && data !== null) return { id: data.id, retomada: false };

  if (error?.code === "23505") {
    const aberta = await lerUma<SessaoDaConsulta>(
      cliente
        .from("sessoes")
        .select("id, plano_bloco_id, contexto, encerrada_em, refacao_chave")
        .eq("user_id", entrada.userId)
        .eq("refacao_chave", entrada.refacaoChave)
        .is("encerrada_em", null)
        .order("iniciada_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "refação concorrente",
    );
    if (aberta !== null) return { id: aberta.id, retomada: true };
  }

  throw new SessaoRecusada(
    "acervo_inconsistente",
    `Não foi possível abrir a refação: ${error?.message ?? "resposta vazia"}`,
  );
}

async function lerItensDaRefacao(
  cliente: SupabaseClient,
  sessaoId: string,
): Promise<ItemDaRefacaoBanco[]> {
  return lerLista<ItemDaRefacaoBanco>(
    cliente
      .from("sessao_itens")
      .select("id, sessao_id, questao_id, questao_versao, ordem")
      .eq("sessao_id", sessaoId)
      .order("ordem", { ascending: true }),
    "itens da refação",
  );
}

/**
 * Confirma que os itens existentes são exatamente os selecionados no servidor
 * e insere somente o que falta. A constraint de ordem/questão resolve a
 * corrida entre duas inserções; a releitura após 23505 transforma a colisão
 * em sucesso idempotente ou em falha segura, nunca em DELETE da sessão.
 */
async function garantirItensDaRefacao(
  cliente: SupabaseClient,
  sessaoId: string,
  esperados: readonly ItemEsperadoDaRefacao[],
): Promise<void> {
  const confirmar = (atuais: readonly ItemDaRefacaoBanco[]): ItemEsperadoDaRefacao[] => {
    const porOrdem = new Map(esperados.map((item) => [item.ordem, item]));
    const vistos = new Set<number>();
    for (const atual of atuais) {
      const esperado = porOrdem.get(atual.ordem);
      if (
        esperado === undefined ||
        vistos.has(atual.ordem) ||
        atual.sessao_id !== sessaoId ||
        atual.questao_id !== esperado.questao_id ||
        Number(atual.questao_versao) !== esperado.questao_versao
      ) {
        throw new SessaoRecusada(
          "acervo_inconsistente",
          "A sessão de refação contém itens diferentes do caderno.",
        );
      }
      vistos.add(atual.ordem);
    }
    return esperados.filter((item) => !vistos.has(item.ordem));
  };

  const atuais = await lerItensDaRefacao(cliente, sessaoId);
  const faltantes = confirmar(atuais);
  if (faltantes.length === 0) return;

  const insercao = await cliente.from("sessao_itens").insert(faltantes);
  if (!insercao.error) return;

  // Uma requisição concorrente pode ter preenchido os mesmos itens depois da
  // primeira leitura. Releia sob RLS: só sucesso completo encerra a corrida.
  const depois = await lerItensDaRefacao(cliente, sessaoId);
  if (confirmar(depois).length === 0) return;

  throw new SessaoRecusada(
    "acervo_inconsistente",
    `Não foi possível montar a refação: ${insercao.error.message}`,
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
