import type {
  DadosMapaPrioridade,
  DadosRaioX,
  EstadoCobertura,
  EstadoRevisao,
  FaixaDominio,
  LinhaMapaPrioridade,
  NivelPrioridade,
} from "./index";
import { faixaDeDominio } from "./index";

/**
 * O Mapa de Prioridade lido por matéria.
 *
 * A tela abre pela matéria e só desce ao tópico quando o aluno pede. Este
 * módulo é **só agregação** — nenhuma consulta, nenhum número novo: ele recebe
 * o mapa por tópico que `consultarMapaPrioridade` já produziu e a projeção por
 * matéria que `consultarRaioX` já leu, e costura os dois. Manter isso puro é o
 * que permite testar a matemática sem banco.
 */
export type LinhaMateriaMapa = {
  materiaId: string;
  materia: string;
  /** Peso normalizado da matéria — o mesmo número da leitura do edital. */
  fatia: number;
  /**
   * Domínio da matéria: média dos scores dos tópicos **ponderada pelo peso**
   * de cada tópico. Média simples deixaria um tópico irrelevante com uma
   * resposta certa mascarar o tópico que carrega a matéria.
   */
  score: number | null;
  dominio: FaixaDominio;
  nTopicos: number;
  nTopicosCobertos: number;
  nRevisoesDevidas: number;
  cobertura: EstadoCobertura;
  revisao: EstadoRevisao;
  prioridade: number;
  nivel: NivelPrioridade;
  motivo: string;
  ordem: number;
  /** Os tópicos da matéria, na ordem de leitura que o mapa por tópico definiu. */
  topicos: LinhaMapaPrioridade[];
};

export type DadosMapaPorMateria = {
  dataReferencia: string;
  linhas: LinhaMateriaMapa[];
};

/** Semente segura do motor W2 quando ainda não há domínio observado. */
const FRAQUEZA_SEM_DOMINIO = 0.9;

function nivelDaMateria(sinais: {
  nTopicosCobertos: number;
  nRevisoesDevidas: number;
  dominio: FaixaDominio;
}): NivelPrioridade {
  if (
    sinais.nRevisoesDevidas > 0 ||
    sinais.nTopicosCobertos === 0 ||
    sinais.dominio === "fraco"
  ) {
    return "maior_atencao";
  }
  if (sinais.dominio === "em_desenvolvimento") return "acompanhar";
  return "rotacao";
}

function motivoDaMateria(linha: {
  nTopicos: number;
  nTopicosCobertos: number;
  nRevisoesDevidas: number;
  dominio: FaixaDominio;
}): string {
  const naoIniciados = linha.nTopicos - linha.nTopicosCobertos;

  if (linha.nRevisoesDevidas > 0) {
    return linha.nRevisoesDevidas === 1
      ? "Uma revisão desta matéria está devida; ela volta antes do conteúdo se afastar."
      : `${linha.nRevisoesDevidas} revisões desta matéria estão devidas; elas voltam antes do conteúdo se afastar.`;
  }
  if (linha.nTopicosCobertos === 0) {
    return "Você ainda não respondeu nenhum tópico desta matéria; a cobertura do edital vem primeiro.";
  }
  if (linha.dominio === "fraco") {
    return naoIniciados > 0
      ? `Seu domínio está fraco aqui, e ${naoIniciados} ${naoIniciados === 1 ? "tópico ainda não foi tocado" : "tópicos ainda não foram tocados"}.`
      : "Seu domínio está fraco aqui, combinado com o peso observado da banca.";
  }
  if (linha.dominio === "em_desenvolvimento") {
    return "Seu domínio está em desenvolvimento; mantenha esta matéria na rotação.";
  }
  return "Peso da banca, domínio e revisão estão estáveis; o ciclo mantém a rotação.";
}

/**
 * Cruza o mapa por tópico com a projeção por matéria.
 *
 * Matéria sem projeção agregada não aparece — a leitura por matéria e a
 * leitura do edital mostram exatamente o mesmo conjunto, ou a tela contaria
 * duas histórias sobre a mesma prova.
 */
export function agruparMapaPorMateria(
  dados: DadosRaioX,
  mapa: DadosMapaPrioridade,
): DadosMapaPorMateria {
  const porTopico = new Map(
    mapa.linhas.map((linha) => [linha.topicoId, linha] as const),
  );

  const linhas = dados.materias.map((materia) => {
    const topicos = materia.topicos
      .map((topico) => porTopico.get(topico.topicoId))
      .filter((linha): linha is LinhaMapaPrioridade => linha !== undefined)
      .sort((a, b) => a.ordem - b.ordem);

    let pesoComScore = 0;
    let somaPonderada = 0;
    let nTopicosCobertos = 0;
    let nRevisoesDevidas = 0;
    let temAgenda = false;

    for (const topico of topicos) {
      if (topico.nRespostas > 0) nTopicosCobertos += 1;
      if (topico.revisao === "devida") nRevisoesDevidas += 1;
      if (topico.revisao !== "sem_agenda") temAgenda = true;
      if (topico.score !== null && topico.peso !== null && topico.peso > 0) {
        pesoComScore += topico.peso;
        somaPonderada += topico.peso * topico.score;
      }
    }

    const score = pesoComScore > 0 ? somaPonderada / pesoComScore : null;
    const cobertura: EstadoCobertura =
      nTopicosCobertos > 0 ? "coberto" : "nao_iniciado";
    const revisao: EstadoRevisao =
      nRevisoesDevidas > 0 ? "devida" : temAgenda ? "em_dia" : "sem_agenda";
    // `nTopicosCobertos` faz o papel de `n_respostas`: uma matéria sem nenhum
    // tópico respondido é "não iniciada" mesmo que o score chegue nulo por
    // outro caminho.
    const dominio = faixaDeDominio(score, nTopicosCobertos);
    const fraqueza = score === null ? FRAQUEZA_SEM_DOMINIO : 1 - score;
    const sinais = { nTopicosCobertos, nRevisoesDevidas, dominio };

    return {
      materiaId: materia.materiaId,
      materia: materia.materia,
      fatia: materia.fatia,
      score,
      dominio,
      nTopicos: materia.nTopicos,
      nTopicosCobertos,
      nRevisoesDevidas,
      cobertura,
      revisao,
      prioridade: Number((materia.fatia * fraqueza).toFixed(6)),
      nivel: nivelDaMateria(sinais),
      motivo: motivoDaMateria({ ...sinais, nTopicos: materia.nTopicos }),
      ordem: 0,
      topicos,
    } satisfies LinhaMateriaMapa;
  });

  linhas.sort((a, b) => {
    if (a.prioridade !== b.prioridade) return b.prioridade - a.prioridade;
    if (a.nRevisoesDevidas !== b.nRevisoesDevidas) {
      return b.nRevisoesDevidas - a.nRevisoesDevidas;
    }
    return a.materia.localeCompare(b.materia, "pt-BR");
  });

  return {
    dataReferencia: mapa.dataReferencia,
    linhas: linhas.map((linha, indice) => ({ ...linha, ordem: indice + 1 })),
  };
}
