import type { SupabaseClient } from "@supabase/supabase-js";

import { dataHojeDoProduto } from "../plano";
import { CAUSAS_DO_CADERNO, type CausaDoCaderno } from "../progresso";
import type { Contexto } from "../tentativas";

/**
 * A leitura da tela de prática (`/app/sessao`) — AD-115.
 *
 * As quatro peças desta tela têm em comum o que **não** são: nenhuma delas é o
 * plano do dia. O plano já tem duas superfícies (`/app` e `/app/plano`) e uma
 * terceira cópia era o que fazia esta rota parecer supérflua. Aqui mora só o
 * que sobrou de fora das outras duas:
 *
 *   1. a sessão que ficou aberta — hoje só alcançável voltando pelo bloco;
 *   2. a revisão que venceu e **não** virou bloco — hoje invisível em toda tela;
 *   3. o caderno de erros — hoje só em `/app` e `/app/progresso`;
 *   4. o histórico de sessões — hoje só pelo bloco concluído do próprio dia.
 *
 * Uma consulta por peça, todas do próprio aluno por RLS. O agrupamento por
 * sessão é feito aqui e não no banco de propósito: `tentativas` é particionada
 * e agregar por `sessao_id` no `SELECT` obrigaria a varrer partição por
 * partição para montar um número que cabe em memória — são dezenas de linhas,
 * não milhares.
 */

/** Teto do histórico. Acima disso a leitura é do Progresso, não daqui. */
const SESSOES_NO_HISTORICO = 12;

export type ResultadoDoItem = "acerto" | "erro" | "pendente";

export type SessaoAberta = {
  id: string;
  contexto: Contexto;
  topicoId: string | null;
  iniciadaEm: string;
  nItens: number;
  nRespondidas: number;
  /** Um por item, na ordem da sessão — é o que a trilha desenha. */
  resultados: readonly ResultadoDoItem[];
};

export type RevisaoForaDoPlano = {
  topicoId: string;
  due: string;
};

export type ErroDoCaderno = {
  topicoId: string;
  causa: CausaDoCaderno;
  nErros: number;
  ultimoErroEm: string;
};

export type SessaoDoHistorico = {
  id: string;
  contexto: Contexto;
  topicoId: string | null;
  encerradaEm: string;
  nQuestoes: number;
  nAcertos: number;
};

export type DadosDaPratica = {
  sessaoAberta: SessaoAberta | null;
  revisoesForaDoPlano: readonly RevisaoForaDoPlano[];
  caderno: readonly ErroDoCaderno[];
  historico: readonly SessaoDoHistorico[];
};

type SessaoBanco = {
  id: string;
  contexto: Contexto;
  plano_bloco_id: string | null;
  refacao_chave: string | null;
  iniciada_em: string;
  encerrada_em: string | null;
};

type ItemBanco = {
  sessao_id: string;
  questao_id: string;
  ordem: number;
  respondido_em: string | null;
};

type TentativaBanco = {
  sessao_id: string;
  questao_id: string;
  correta: boolean;
};

type CadernoBanco = {
  topico_id: string;
  causa_erro: string;
  n_erros: number;
  ultimo_erro_em: string;
};

type RevisaoBanco = { topico_id: string; due: string };

type BlocoBanco = { id: string; topico_id: string | null };

function falhaAoLer(recurso: string, mensagem: string): Error {
  return new Error(`falha ao ler ${recurso}: ${mensagem}`);
}

/**
 * O tópico de uma sessão não mora em `sessoes`: a tabela é anterior à SPEC 06 e
 * de propósito não conhece o plano. Ele vem da chave da refação (que já carrega
 * `topico|causa`) ou do bloco de origem. Sessão sem os dois é assunto
 * misturado, e `null` é a resposta honesta — não um tópico inventado.
 */
function topicoDaRefacao(chave: string | null): string | null {
  if (chave === null) return null;
  const topico = chave.split("|")[0];
  return topico !== undefined && topico.length > 0 ? topico : null;
}

/** Lê a sessão aberta mais recente do aluno e o quanto dela já foi respondido. */
async function consultarSessaoAberta(
  cliente: SupabaseClient,
  topicosPorBloco: Map<string, string | null>,
  sessao: SessaoBanco | undefined,
): Promise<SessaoAberta | null> {
  if (sessao === undefined) return null;

  const itensConsulta = await cliente
    .from("sessao_itens")
    .select("sessao_id, questao_id, ordem, respondido_em")
    .eq("sessao_id", sessao.id)
    .order("ordem", { ascending: true });

  if (itensConsulta.error) {
    throw falhaAoLer("itens da sessão aberta", itensConsulta.error.message);
  }
  const itens = (itensConsulta.data ?? []) as ItemBanco[];

  // Uma sessão aberta sem item é montagem interrompida, não trabalho pela
  // metade: oferecer "retomar" levaria a uma tela vazia.
  if (itens.length === 0) return null;

  const respondidos = itens.filter((item) => item.respondido_em !== null);
  let acertosPorQuestao = new Map<string, boolean>();

  if (respondidos.length > 0) {
    const tentativasConsulta = await cliente
      .from("tentativas")
      .select("sessao_id, questao_id, correta")
      .eq("sessao_id", sessao.id);

    if (tentativasConsulta.error) {
      throw falhaAoLer("respostas da sessão aberta", tentativasConsulta.error.message);
    }
    acertosPorQuestao = new Map(
      ((tentativasConsulta.data ?? []) as TentativaBanco[]).map((tentativa) => [
        tentativa.questao_id,
        tentativa.correta,
      ]),
    );
  }

  const resultados = itens.map((item): ResultadoDoItem => {
    if (item.respondido_em === null) return "pendente";
    // Item carimbado cuja tentativa não voltou na leitura conta como
    // respondido — o carimbo é o fato; supor acerto seria inventar.
    return acertosPorQuestao.get(item.questao_id) === false ? "erro" : "acerto";
  });

  return {
    id: sessao.id,
    contexto: sessao.contexto,
    topicoId:
      topicoDaRefacao(sessao.refacao_chave) ??
      (sessao.plano_bloco_id === null
        ? null
        : (topicosPorBloco.get(sessao.plano_bloco_id) ?? null)),
    iniciadaEm: sessao.iniciada_em,
    nItens: itens.length,
    nRespondidas: respondidos.length,
    resultados,
  };
}

/** Monta o histórico agregando as tentativas por sessão encerrada. */
async function consultarHistorico(
  cliente: SupabaseClient,
  topicosPorBloco: Map<string, string | null>,
  sessoes: readonly SessaoBanco[],
): Promise<readonly SessaoDoHistorico[]> {
  if (sessoes.length === 0) return [];

  const tentativasConsulta = await cliente
    .from("tentativas")
    .select("sessao_id, questao_id, correta")
    .in(
      "sessao_id",
      sessoes.map((sessao) => sessao.id),
    );

  if (tentativasConsulta.error) {
    throw falhaAoLer("respostas do histórico", tentativasConsulta.error.message);
  }

  const porSessao = new Map<string, { questoes: Set<string>; acertos: number }>();
  for (const tentativa of (tentativasConsulta.data ?? []) as TentativaBanco[]) {
    const atual = porSessao.get(tentativa.sessao_id) ?? { questoes: new Set<string>(), acertos: 0 };
    // `tentativas` só recebe INSERT (invariante 1): uma correção é linha nova
    // sobre a mesma questão. Contar questões distintas é o que impede o mesmo
    // item de aparecer duas vezes no total da sessão.
    if (!atual.questoes.has(tentativa.questao_id)) {
      atual.questoes.add(tentativa.questao_id);
      if (tentativa.correta) atual.acertos += 1;
    }
    porSessao.set(tentativa.sessao_id, atual);
  }

  return sessoes.flatMap((sessao): SessaoDoHistorico[] => {
    const agregado = porSessao.get(sessao.id);
    // Sessão encerrada sem tentativa não é histórico de estudo: é uma visita
    // que o aluno abandonou e o encerramento fechou.
    if (agregado === undefined || sessao.encerrada_em === null) return [];

    return [
      {
        id: sessao.id,
        contexto: sessao.contexto,
        topicoId:
          topicoDaRefacao(sessao.refacao_chave) ??
          (sessao.plano_bloco_id === null
            ? null
            : (topicosPorBloco.get(sessao.plano_bloco_id) ?? null)),
        encerradaEm: sessao.encerrada_em,
        nQuestoes: agregado.questoes.size,
        nAcertos: agregado.acertos,
      },
    ];
  });
}

/**
 * A leitura completa da tela.
 *
 * `blocosComRevisaoHoje` são os tópicos que o plano de hoje já cobre: uma
 * revisão que virou bloco vive lá, e repeti-la aqui é a duplicação que este
 * redesenho existe para remover.
 */
export async function consultarPratica(
  cliente: SupabaseClient,
  opcoes: { topicosNoPlanoDeHoje?: readonly string[]; hoje?: string } = {},
): Promise<DadosDaPratica> {
  const hoje = opcoes.hoje ?? dataHojeDoProduto();
  const noPlano = new Set(opcoes.topicosNoPlanoDeHoje ?? []);

  const [sessoesConsulta, revisoesConsulta, cadernoConsulta] = await Promise.all([
    cliente
      .from("sessoes")
      .select("id, contexto, plano_bloco_id, refacao_chave, iniciada_em, encerrada_em")
      .order("iniciada_em", { ascending: false })
      .limit(SESSOES_NO_HISTORICO + 1),
    cliente
      .from("revisao_agenda")
      .select("topico_id, due")
      .lte("due", hoje)
      .order("due", { ascending: true })
      .order("topico_id", { ascending: true }),
    cliente
      .from("caderno_erros")
      .select("topico_id, causa_erro, n_erros, ultimo_erro_em")
      .order("n_erros", { ascending: false })
      .order("ultimo_erro_em", { ascending: false }),
  ]);

  if (sessoesConsulta.error) throw falhaAoLer("sessões do aluno", sessoesConsulta.error.message);
  if (revisoesConsulta.error) throw falhaAoLer("revisões devidas", revisoesConsulta.error.message);
  if (cadernoConsulta.error) throw falhaAoLer("caderno de erros", cadernoConsulta.error.message);

  const sessoes = (sessoesConsulta.data ?? []) as SessaoBanco[];
  const abertas = sessoes.filter((sessao) => sessao.encerrada_em === null);
  const encerradas = sessoes
    .filter((sessao) => sessao.encerrada_em !== null)
    .slice(0, SESSOES_NO_HISTORICO);

  const idsDosBlocos = [
    ...new Set(
      [...abertas.slice(0, 1), ...encerradas].flatMap((sessao) =>
        sessao.plano_bloco_id === null ? [] : [sessao.plano_bloco_id],
      ),
    ),
  ];
  const topicosPorBloco = new Map<string, string | null>();
  if (idsDosBlocos.length > 0) {
    const blocosConsulta = await cliente
      .from("plano_bloco")
      .select("id, topico_id")
      .in("id", idsDosBlocos);

    if (blocosConsulta.error) {
      throw falhaAoLer("blocos das sessões", blocosConsulta.error.message);
    }
    for (const bloco of (blocosConsulta.data ?? []) as BlocoBanco[]) {
      topicosPorBloco.set(bloco.id, bloco.topico_id);
    }
  }

  const [sessaoAberta, historico] = await Promise.all([
    consultarSessaoAberta(cliente, topicosPorBloco, abertas[0]),
    consultarHistorico(cliente, topicosPorBloco, encerradas),
  ]);

  const revisoesForaDoPlano = ((revisoesConsulta.data ?? []) as RevisaoBanco[])
    .filter(
      (linha) =>
        typeof linha.topico_id === "string" &&
        linha.topico_id.length > 0 &&
        typeof linha.due === "string" &&
        linha.due.length > 0 &&
        !noPlano.has(linha.topico_id),
    )
    .map((linha) => ({ topicoId: linha.topico_id, due: linha.due }));

  const caderno = ((cadernoConsulta.data ?? []) as CadernoBanco[]).flatMap(
    (linha): ErroDoCaderno[] => {
      // Causa fora do domínio é dado corrompido; a tela some com a linha em vez
      // de derrubar a página inteira por causa de uma delas.
      if (!(CAUSAS_DO_CADERNO as readonly string[]).includes(linha.causa_erro)) return [];
      return [
        {
          topicoId: linha.topico_id,
          causa: linha.causa_erro as CausaDoCaderno,
          nErros: Number(linha.n_erros),
          ultimoErroEm: linha.ultimo_erro_em,
        },
      ];
    },
  );

  return { sessaoAberta, revisoesForaDoPlano, caderno, historico };
}
