import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDeServico } from "@/lib/db/servidor";
import { faixaDeDominio } from "@/modules/raiox";

import {
  contarDiasParaProva,
  type ContagemDaProva,
} from "./painel-do-dia";
import { dataHojeDoProduto } from "./plano";

/**
 * "Como eu sei que estou terminando o edital?"
 *
 * Nenhuma tela respondia isso. O Progresso mostra domínio por tópico e o
 * caderno de erros; o Raio-X mostra o que mais cai. Nenhum dos dois cruza
 * **quanto do edital já foi tocado** com **quanto tempo falta**.
 *
 * Nada aqui inventa tabela: o universo vem do acervo, o toque vem de
 * `dominio_topico`, o peso vem da projeção do Raio-X, o prazo vem do perfil de
 * estudo e o ritmo vem das tentativas das últimas quatro semanas.
 */

/** Quantos dias de tentativa entram no cálculo do ritmo. */
const JANELA_DE_RITMO_EM_DIAS = 28;

/** Abaixo disto a base é curta demais para projetar uma data. */
const SEMANAS_MINIMAS_PARA_PROJETAR = 2;

export type CoberturaDaMateria = {
  materiaId: string;
  nome: string;
  ordem: number;
  nTopicos: number;
  /** Tópicos com ao menos uma resposta. */
  nTocados: number;
  /** Tópicos na faixa de topo de `faixaDeDominio`. */
  nDominados: number;
  /** 0..1 — quanto essa matéria cai, pela projeção por matéria do Raio-X. */
  pesoRaioX: number;
};

export type PrevisaoDeTermino = {
  /** `YYYY-MM-DD`. `null` quando não há base para projetar. */
  dataEstimada: string | null;
  /** Dias de folga antes da prova. Negativo = o edital fecha depois dela. */
  diasAntesDaProva: number | null;
  /** `false` = base curta demais; a tela não mostra data nenhuma. */
  confiavel: boolean;
};

export type Trajetoria = {
  porMateria: readonly CoberturaDaMateria[];
  total: {
    nTopicos: number;
    nTocados: number;
    nDominados: number;
    /** Σ peso(tocado) / Σ peso(todos). É o número que manda. */
    coberturaPonderada: number;
  };
  ritmo: { topicosNovosPorSemana: number; semanasObservadas: number };
  contagem: ContagemDaProva;
  previsao: PrevisaoDeTermino;
};

type TopicoBanco = {
  id: string;
  materia_id: string;
  materias?: { nome?: unknown; ordem?: unknown; ativa?: unknown } | null;
};
type InventarioBanco = { topico_id: string | null; aptas_sessao: number | string | null };
type PerfilConcursoBanco = { id: string };
type ProjecaoTopicoBanco = { topico_id: string; peso: number | string };
type ProjecaoMateriaBanco = { materia_id: string; peso: number | string };
type DominioBanco = {
  topico_id: string;
  n_respostas: number | string;
  score: number | string | null;
};
type TentativaBanco = { topico_id: string | null; respondida_em: string };

function falhaAoLer(recurso: string, mensagem: string): Error {
  return new Error(`falha ao ler ${recurso}: ${mensagem}`);
}

function numero(valor: number | string | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const convertido = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

/** A matéria pode vir como objeto ou como lista, conforme o join do PostgREST. */
function materiaDoTopico(
  linha: TopicoBanco,
): { nome: string; ordem: number; ativa: boolean } | null {
  const bruta = Array.isArray(linha.materias) ? linha.materias[0] : linha.materias;
  if (!bruta || typeof bruta !== "object") return null;
  const nome = typeof bruta.nome === "string" ? bruta.nome.trim() : "";
  if (nome === "") return null;
  return {
    nome,
    ordem: typeof bruta.ordem === "number" ? bruta.ordem : 0,
    // A coluna tem default `true`; ausência de campo não desativa matéria.
    ativa: bruta.ativa !== false,
  };
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const instante = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return instante.toISOString().slice(0, 10);
}

/**
 * O ritmo é de tópicos **novos**, não de tópicos tocados.
 *
 * Contar tópico revisitado inflaria o número e faria a projeção mentir: quem
 * revisa os mesmos vinte assuntos toda semana apareceria terminando o edital
 * amanhã. Um tópico é novo na janela quando **todas** as suas respostas caem
 * dentro dela — o que se sabe comparando a contagem na janela com o
 * `n_respostas` acumulado em `dominio_topico`, sem consulta extra.
 */
function calcularRitmo(
  tentativas: readonly TentativaBanco[],
  respostasAcumuladas: ReadonlyMap<string, number>,
  hoje: string,
): { topicosNovosPorSemana: number; semanasObservadas: number } {
  if (tentativas.length === 0) {
    return { topicosNovosPorSemana: 0, semanasObservadas: 0 };
  }

  const naJanela = new Map<string, number>();
  let maisAntiga: string | null = null;
  for (const tentativa of tentativas) {
    if (typeof tentativa.topico_id !== "string" || tentativa.topico_id === "") continue;
    naJanela.set(tentativa.topico_id, (naJanela.get(tentativa.topico_id) ?? 0) + 1);
    const dia = tentativa.respondida_em.slice(0, 10);
    if (maisAntiga === null || dia < maisAntiga) maisAntiga = dia;
  }

  if (maisAntiga === null) return { topicosNovosPorSemana: 0, semanasObservadas: 0 };

  let novos = 0;
  for (const [topicoId, contagem] of naJanela) {
    if ((respostasAcumuladas.get(topicoId) ?? contagem) <= contagem) novos += 1;
  }

  const diasDeHistorico =
    (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${maisAntiga}T00:00:00Z`)) / 86_400_000;
  const semanasObservadas = Math.min(
    JANELA_DE_RITMO_EM_DIAS / 7,
    Math.max(1, Math.ceil((diasDeHistorico + 1) / 7)),
  );

  return { topicosNovosPorSemana: novos / semanasObservadas, semanasObservadas };
}

/**
 * Nunca inventar data.
 *
 * Base curta ou ritmo zerado devolve `null` e a tela diz que ainda não dá para
 * projetar o fim. Uma data falsa aqui é pior que nenhuma: ela vira promessa.
 */
function projetarTermino(
  restantes: number,
  ritmo: { topicosNovosPorSemana: number; semanasObservadas: number },
  contagem: ContagemDaProva,
  hoje: string,
): PrevisaoDeTermino {
  if (restantes <= 0 && ritmo.semanasObservadas > 0) {
    return {
      dataEstimada: hoje,
      diasAntesDaProva: contagem.dias,
      confiavel: true,
    };
  }

  if (
    ritmo.semanasObservadas < SEMANAS_MINIMAS_PARA_PROJETAR ||
    ritmo.topicosNovosPorSemana <= 0
  ) {
    return { dataEstimada: null, diasAntesDaProva: null, confiavel: false };
  }

  const dias = Math.ceil((restantes / ritmo.topicosNovosPorSemana) * 7);
  return {
    dataEstimada: somarDias(hoje, dias),
    diasAntesDaProva: contagem.dias === null ? null : contagem.dias - dias,
    confiavel: true,
  };
}

/**
 * `cliente` é o da **sessão**: `dominio_topico` e `tentativas` têm RLS por
 * `auth.uid()`. O acervo e a projeção do Raio-X são públicos e vêm pela chave
 * de serviço — a mesma separação que `consultarMapaPrioridade` já usa.
 *
 * Uma consulta por fonte, sem laço por tópico: é leitura de abertura de tela
 * para 1 aluno, e cabe na exceção do AD-071. Se ficar lenta, vira projeção
 * materializada; não vira laço.
 */
export async function consultarTrajetoria(
  cliente: SupabaseClient,
  opcoes: {
    dataProva?: string | null;
    agora?: Date;
    clientePublico?: SupabaseClient;
  } = {},
): Promise<Trajetoria> {
  const agora = opcoes.agora ?? new Date();
  const hoje = dataHojeDoProduto(agora);
  const contagem = contarDiasParaProva(opcoes.dataProva, agora);
  const publico = opcoes.clientePublico ?? clienteDeServico();
  const inicioDaJanela = new Date(agora.getTime() - JANELA_DE_RITMO_EM_DIAS * 86_400_000);

  const [inventarioConsulta, topicosConsulta, perfilConsulta] = await Promise.all([
    // `inventario_acervo` e não `questoes`: a contagem já vem agregada por
    // tópico, em SQL. Varrer `questoes` daqui lia **uma linha por questão** e
    // batia no teto de linhas do PostgREST (1000): com 1375 publicadas a
    // resposta já voltava `206 Partial Content`, e o supabase-js não trata 206
    // como erro — `error` vem `null`. O tópico cujas questões caíssem na parte
    // cortada sumia do universo, encolhendo o edital e deixando a cobertura e a
    // previsão **otimistas, em silêncio**. Isso contradiz a regra que sustenta
    // esta feature (AD-122: nunca inventar data), e o acervo só cresce — ele é
    // o fosso. A view é uma linha por tópico e não tem esse teto.
    publico.from("inventario_acervo").select("topico_id, aptas_sessao"),
    publico.from("topicos").select("id, materia_id, materias(nome, ordem, ativa)").eq("ativo", true),
    publico.from("perfil_concurso").select("id").eq("ativo", true).maybeSingle(),
  ]);

  if (inventarioConsulta.error) {
    throw falhaAoLer("inventario_acervo", inventarioConsulta.error.message);
  }
  if (topicosConsulta.error) {
    throw falhaAoLer("tópicos do edital", topicosConsulta.error.message);
  }
  if (perfilConsulta.error) {
    throw falhaAoLer("perfil_concurso", perfilConsulta.error.message);
  }

  // O universo é o mesmo do gerador do plano: tópico ativo, de matéria ativa,
  // que tenha ao menos uma questão publicada, vigente e não anulada. Tópico sem
  // questão não é edital coberto nem descoberto — ele não é estudável.
  // `aptas_sessao` conta exatamente o mesmo recorte que a consulta anterior
  // filtrava linha a linha: publicada, vigente e não anulada.
  const comQuestao = new Set(
    ((inventarioConsulta.data ?? []) as InventarioBanco[])
      .filter((linha) => numero(linha.aptas_sessao) > 0)
      .map((linha) => linha.topico_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  const topicos = ((topicosConsulta.data ?? []) as TopicoBanco[])
    .map((linha) => ({ linha, materia: materiaDoTopico(linha) }))
    .filter(
      (item): item is { linha: TopicoBanco; materia: { nome: string; ordem: number; ativa: boolean } } =>
        item.materia !== null && item.materia.ativa && comQuestao.has(item.linha.id),
    );

  const perfil = perfilConsulta.data as PerfilConcursoBanco | null;
  const idsDoUniverso = topicos.map((item) => item.linha.id);

  const [projecaoTopicoConsulta, projecaoMateriaConsulta, dominioConsulta, tentativasConsulta] =
    await Promise.all([
      perfil === null
        ? Promise.resolve({ data: [], error: null })
        : publico
            .from("raiox_projecoes")
            .select("topico_id, peso")
            .eq("perfil_concurso_id", perfil.id),
      perfil === null
        ? Promise.resolve({ data: [], error: null })
        : publico
            .from("raiox_projecoes_materia")
            .select("materia_id, peso")
            .eq("perfil_concurso_id", perfil.id),
      idsDoUniverso.length === 0
        ? Promise.resolve({ data: [], error: null })
        : cliente
            .from("dominio_topico")
            .select("topico_id, n_respostas, score")
            .in("topico_id", idsDoUniverso),
      cliente
        .from("tentativas")
        .select("topico_id, respondida_em")
        .gte("respondida_em", inicioDaJanela.toISOString()),
    ]);

  if (projecaoTopicoConsulta.error) {
    throw falhaAoLer("raiox_projecoes", projecaoTopicoConsulta.error.message);
  }
  if (projecaoMateriaConsulta.error) {
    throw falhaAoLer("raiox_projecoes_materia", projecaoMateriaConsulta.error.message);
  }
  if (dominioConsulta.error) {
    throw falhaAoLer("dominio_topico", dominioConsulta.error.message);
  }
  if (tentativasConsulta.error) {
    throw falhaAoLer("tentativas do ritmo", tentativasConsulta.error.message);
  }

  const pesoDoTopico = new Map(
    ((projecaoTopicoConsulta.data ?? []) as ProjecaoTopicoBanco[]).map((linha) => [
      linha.topico_id,
      numero(linha.peso),
    ]),
  );
  const pesoDaMateria = new Map(
    ((projecaoMateriaConsulta.data ?? []) as ProjecaoMateriaBanco[]).map((linha) => [
      linha.materia_id,
      numero(linha.peso),
    ]),
  );

  const dominios = (dominioConsulta.data ?? []) as DominioBanco[];
  const respostasPorTopico = new Map(
    dominios.map((linha) => [linha.topico_id, numero(linha.n_respostas)]),
  );
  const dominados = new Set(
    dominios
      .filter(
        (linha) =>
          faixaDeDominio(
            linha.score === null ? null : numero(linha.score),
            Math.trunc(numero(linha.n_respostas)),
          ) === "dominado",
      )
      .map((linha) => linha.topico_id),
  );

  const porMateria = new Map<string, CoberturaDaMateria>();
  let pesoTotal = 0;
  let pesoTocado = 0;
  let nTocados = 0;
  let nDominados = 0;

  for (const { linha, materia } of topicos) {
    const tocado = (respostasPorTopico.get(linha.id) ?? 0) > 0;
    const dominado = dominados.has(linha.id);
    const peso = pesoDoTopico.get(linha.id) ?? 0;

    pesoTotal += peso;
    if (tocado) {
      pesoTocado += peso;
      nTocados += 1;
    }
    if (dominado) nDominados += 1;

    const atual = porMateria.get(linha.materia_id) ?? {
      materiaId: linha.materia_id,
      nome: materia.nome,
      ordem: materia.ordem,
      nTopicos: 0,
      nTocados: 0,
      nDominados: 0,
      pesoRaioX: pesoDaMateria.get(linha.materia_id) ?? 0,
    };
    atual.nTopicos += 1;
    if (tocado) atual.nTocados += 1;
    if (dominado) atual.nDominados += 1;
    porMateria.set(linha.materia_id, atual);
  }

  const nTopicos = topicos.length;
  // Sem projeção do Raio-X ainda, todo peso é zero e a ponderada seria 0/0. A
  // fração simples é a resposta honesta nesse estado, não um número inventado.
  const coberturaPonderada =
    pesoTotal > 0 ? pesoTocado / pesoTotal : nTopicos === 0 ? 0 : nTocados / nTopicos;

  const ritmo = calcularRitmo(
    (tentativasConsulta.data ?? []) as TentativaBanco[],
    respostasPorTopico,
    hoje,
  );

  return {
    porMateria: [...porMateria.values()].sort(
      (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"),
    ),
    total: { nTopicos, nTocados, nDominados, coberturaPonderada },
    ritmo,
    contagem,
    previsao: projetarTermino(nTopicos - nTocados, ritmo, contagem, hoje),
  };
}
