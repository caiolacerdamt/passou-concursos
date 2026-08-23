import "server-only";

import {
  alternativasSchema,
  fonteCitacaoSchema,
  type Alternativa,
  type FonteCitacao,
} from "@/modules/acervo/contrato";
import {
  lerConfiguracoesAdministrativas,
  type ConfiguracaoAdministrativa,
} from "@/modules/config/escrita";

import { comOperador, type ClienteDoOperador } from "./fronteira";
import type {
  CandidatoDeTopico,
  MateriaDoOperador,
  QuestaoDaFila,
  ResultadoDaConfiguracao,
  RevisaoDaFila,
  TaxonomiaDoOperador,
  TopicoDoOperador,
} from "./contratos";

const FILA_SELECT =
  "id, questao_id, questao_versao, motivo, prioridade, criada_em, questoes!inner(tipo_questao, origem, enunciado, alternativas, resposta_correta, anulada, fonte_citacao)";

type QuestaoDaFilaBruta = {
  tipo_questao: string;
  origem: string;
  enunciado: string;
  alternativas: unknown;
  resposta_correta: string | null;
  anulada: boolean;
  fonte_citacao: unknown;
};

type RevisaoDaFilaBruta = {
  id: number;
  questao_id: string;
  questao_versao: number;
  motivo: string;
  prioridade: number;
  criada_em: string;
  questoes: QuestaoDaFilaBruta | readonly QuestaoDaFilaBruta[] | null;
};

function relacaoDaQuestao(
  relacao: RevisaoDaFilaBruta["questoes"],
): QuestaoDaFilaBruta {
  const questao = Array.isArray(relacao) ? relacao[0] : relacao;
  if (!questao) throw new Error("questao_da_revisao_ausente");
  return questao;
}

function proveniencia(valor: unknown): FonteCitacao | null {
  if (valor === null || valor === undefined) return null;
  const resultado = fonteCitacaoSchema.safeParse(valor);
  if (!resultado.success) throw new Error("proveniencia_da_questao_invalida");
  return resultado.data;
}

function alternativas(
  tipo: string,
  valor: unknown,
): readonly Alternativa[] | null {
  if (tipo === "certo_errado") {
    if (valor !== null && valor !== undefined) {
      throw new Error("alternativas_da_questao_invalidas");
    }
    return null;
  }

  const resultado = alternativasSchema.safeParse(valor);
  if (!resultado.success) throw new Error("alternativas_da_questao_invalidas");
  return resultado.data;
}

function mapearRevisao(linha: RevisaoDaFilaBruta): RevisaoDaFila {
  const questao = relacaoDaQuestao(linha.questoes);
  if (
    !["multipla_escolha", "certo_errado"].includes(questao.tipo_questao) ||
    !["real", "gerada_ia"].includes(questao.origem)
  ) {
    throw new Error("enum_da_questao_invalido");
  }

  const dto: QuestaoDaFila = {
    tipoQuestao: questao.tipo_questao as QuestaoDaFila["tipoQuestao"],
    origem: questao.origem as QuestaoDaFila["origem"],
    enunciado: questao.enunciado,
    alternativas: alternativas(questao.tipo_questao, questao.alternativas),
    respostaCorreta: questao.resposta_correta,
    anulada: questao.anulada,
    proveniencia: proveniencia(questao.fonte_citacao),
  };

  return {
    id: Number(linha.id),
    questaoId: String(linha.questao_id),
    questaoVersao: Number(linha.questao_versao),
    motivo: linha.motivo,
    prioridade: Number(linha.prioridade),
    criadaEm: linha.criada_em,
    questao: dto,
  };
}

/** Fila pendente com somente os campos que a mesa editorial precisa. */
export async function consultarFilaRevisao(): Promise<readonly RevisaoDaFila[]> {
  return comOperador("consultar_fila_revisao", async ({ cliente }) => {
    const { data, error } = await cliente
      .from("questao_revisoes")
      .select(FILA_SELECT)
      .eq("status", "pendente")
      .order("prioridade", { ascending: false })
      .order("criada_em", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as RevisaoDaFilaBruta[]).map(mapearRevisao);
  });
}

type CandidatoBruto = {
  id: string;
  nome_sugerido: string;
  materia_id: string | null;
  ocorrencias: number;
  sugerido_em: string;
};

function mapearCandidato(linha: CandidatoBruto): CandidatoDeTopico {
  return {
    id: linha.id,
    nomeSugerido: linha.nome_sugerido,
    materiaId: linha.materia_id,
    ocorrencias: Number(linha.ocorrencias),
    sugeridoEm: linha.sugerido_em,
  };
}

/** Candidatos pendentes, mais frequentes primeiro. */
export async function consultarCandidatosDeTopico(): Promise<
  readonly CandidatoDeTopico[]
> {
  return comOperador("consultar_candidatos_taxonomia", async ({ cliente }) => {
    const { data, error } = await cliente
      .from("topico_candidato")
      .select("id, nome_sugerido, materia_id, ocorrencias, sugerido_em")
      .eq("status", "pendente")
      .order("ocorrencias", { ascending: false })
      .order("sugerido_em", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as CandidatoBruto[]).map(mapearCandidato);
  });
}

type MateriaBruta = { id: string; nome: string; ordem: number; ativa: boolean };
type TopicoBruto = {
  id: string;
  materia_id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
};

/** Taxonomia completa para a curadoria, sem datas ou colunas de banco internas. */
export async function consultarTaxonomia(): Promise<TaxonomiaDoOperador> {
  return comOperador("consultar_taxonomia", async ({ cliente }) => {
    const materias = await cliente
      .from("materias")
      .select("id, nome, ordem, ativa")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (materias.error) throw materias.error;

    const topicos = await cliente
      .from("topicos")
      .select("id, materia_id, nome, ordem, ativo")
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });
    if (topicos.error) throw topicos.error;

    const linhasDeTopico = (topicos.data ?? []) as TopicoBruto[];
    const resultado: MateriaDoOperador[] = ((materias.data ?? []) as MateriaBruta[]).map(
      (materia) => {
        const itens: TopicoDoOperador[] = linhasDeTopico
          .filter((topico) => topico.materia_id === materia.id)
          .map((topico) => ({
            id: topico.id,
            nome: topico.nome,
            ordem: Number(topico.ordem),
            ativo: topico.ativo,
          }));

        return {
          id: materia.id,
          nome: materia.nome,
          ordem: Number(materia.ordem),
          ativa: materia.ativa,
          topicos: itens,
        };
      },
    );

    const candidatos = await consultarCandidatosInterno(cliente);
    return { materias: resultado, candidatos };
  });
}

async function consultarCandidatosInterno(
  cliente: ClienteDoOperador,
): Promise<readonly CandidatoDeTopico[]> {
  const { data, error } = await cliente
    .from("topico_candidato")
    .select("id, nome_sugerido, materia_id, ocorrencias, sugerido_em")
    .eq("status", "pendente")
    .order("ocorrencias", { ascending: false })
    .order("sugerido_em", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CandidatoBruto[]).map(mapearCandidato);
}

/** Leitura administrativa protegida pela mesma guarda do restante do painel. */
export async function consultarConfiguracoes(): Promise<ResultadoDaConfiguracao> {
  return comOperador("consultar_configuracao", async () => {
    return (await lerConfiguracoesAdministrativas()) as readonly ConfiguracaoAdministrativa[];
  });
}
