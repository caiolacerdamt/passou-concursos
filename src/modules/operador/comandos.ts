import "server-only";

import {
  ConfiguracaoRecusada,
  setConfig,
} from "@/modules/config/escrita";
import { existeNoCatalogo, type Chave } from "@/modules/config/catalogo";

import {
  decisaoDaFilaSchema,
  decisaoDeCandidatoSchema,
  correcaoDeQuestaoSchema,
  edicaoDeTaxonomiaSchema,
  alteracaoDeConfiguracaoSchema,
  recursoEstudoSchema,
} from "./contratos";
import {
  comOperador,
  EntradaDoOperadorInvalida,
  type ClienteDoOperador,
} from "./fronteira";

function rejeitarEntrada(codigo: string): never {
  throw new EntradaDoOperadorInvalida(codigo);
}

async function rpc<T>(
  cliente: ClienteDoOperador,
  nome: string,
  argumentos: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await cliente.rpc(nome, argumentos);
  if (error) throw error;
  if (data === null || data === undefined) throw new Error(`${nome}_sem_resultado`);
  return data as T;
}

/** Decide um lote fechado; o autor vem da sessao, nunca da entrada. */
export async function decidirRevisoesEmLote(entrada: unknown): Promise<number> {
  return comOperador("decidir_revisoes_em_lote", async ({ operador, cliente }) => {
    const validada = decisaoDaFilaSchema.safeParse(entrada);
    if (!validada.success) rejeitarEntrada("decisao_de_revisao_invalida");

    const resultado = await rpc<number>(cliente, "decidir_revisoes_em_lote", {
      p_revisoes: validada.data.revisoes,
      p_decisao: validada.data.decisao,
      p_operador: operador.id,
      p_motivo: validada.data.motivo,
    });
    return Number(resultado);
  });
}

/** Corrige uma questao por INSERT de versao nova, com campos fechados. */
export async function corrigirQuestao(entrada: unknown): Promise<{
  questaoId: string;
  questaoVersao: number;
}> {
  return comOperador("corrigir_questao", async ({ operador, cliente }) => {
    const validada = correcaoDeQuestaoSchema.safeParse(entrada);
    if (!validada.success) rejeitarEntrada("correcao_de_questao_invalida");

    const campos = Object.fromEntries(
      Object.entries(validada.data.campos).map(([campo, valor]) => [
        {
          respostaCorreta: "resposta_correta",
          topicoId: "topico_id",
        }[campo] ?? campo,
        valor,
      ]),
    );

    const resultado = await rpc<readonly { questao_id: string; questao_versao: number }[]>(
      cliente,
      "corrigir_questao_operador",
      {
        p_questao_id: validada.data.questaoId,
        p_questao_versao: validada.data.questaoVersao,
        p_operador: operador.id,
        p_mudanca_tipo: validada.data.mudancaTipo,
        p_motivo: validada.data.motivo,
        p_campos: campos,
      },
    );
    const linha = resultado[0];
    if (!linha) throw new Error("correcao_sem_versao_nova");
    return { questaoId: linha.questao_id, questaoVersao: Number(linha.questao_versao) };
  });
}

/** Aprova ou rejeita um candidato sem permitir que a entrada escolha o autor. */
export async function decidirTopicoCandidato(entrada: unknown): Promise<string | null> {
  return comOperador("decidir_candidato_taxonomia", async ({ operador, cliente }) => {
    const validada = decisaoDeCandidatoSchema.safeParse(entrada);
    if (!validada.success) rejeitarEntrada("decisao_de_candidato_invalida");

    return rpc<string | null>(cliente, "decidir_topico_candidato", {
      p_candidato_id: validada.data.candidatoId,
      p_decisao: validada.data.decisao,
      p_operador: operador.id,
      p_materia_id: validada.data.materiaId ?? null,
      p_nome: validada.data.nome ?? null,
      p_motivo: validada.data.motivo,
    });
  });
}

/** Edita somente as chaves que a RPC da taxonomia aceita. */
export async function editarTaxonomia(entrada: unknown): Promise<boolean> {
  return comOperador("editar_taxonomia", async ({ operador, cliente }) => {
    const validada = edicaoDeTaxonomiaSchema.safeParse(entrada);
    if (!validada.success) rejeitarEntrada("edicao_de_taxonomia_invalida");

    const campos = Object.fromEntries(
      Object.entries(validada.data.campos).map(([campo, valor]) => [
        campo === "materiaId" ? "materia_id" : campo,
        valor,
      ]),
    );

    return rpc<boolean>(cliente, "editar_taxonomia_operador", {
      p_tipo: validada.data.tipo,
      p_id: validada.data.id,
      p_operador: operador.id,
      p_motivo: validada.data.motivo,
      p_campos: campos,
    });
  });
}

/** Grava uma configuracao append-only com autor derivado da sessao. */
export async function alterarConfiguracao(
  entrada: unknown,
): Promise<void> {
  return comOperador("alterar_configuracao", async ({ operador }) => {
    const validada = alteracaoDeConfiguracaoSchema.safeParse(entrada);
    if (!validada.success || !existeNoCatalogo(validada.data.chave)) {
      rejeitarEntrada("configuracao_invalida");
    }

    try {
      await setConfig(validada.data.chave as Chave, validada.data.valor as never, {
        autorId: operador.id,
        motivo: validada.data.motivo,
      });
    } catch (erro) {
      if (erro instanceof ConfiguracaoRecusada) {
        rejeitarEntrada("configuracao_invalida");
      }
      throw erro;
    }
  });
}

/** Salva ou substitui uma URL curada sem permitir autoria forjada. */
export async function salvarRecursoEstudo(entrada: unknown): Promise<string> {
  return comOperador("salvar_recurso_estudo", async ({ operador, cliente }) => {
    const validada = recursoEstudoSchema.safeParse(entrada);
    if (!validada.success) rejeitarEntrada("recurso_de_estudo_invalido");

    return rpc<string>(cliente, "salvar_recurso_estudo_operador", {
      p_recurso_id: validada.data.recursoId ?? null,
      p_topico_id: validada.data.topicoId,
      p_titulo: validada.data.titulo,
      p_url: validada.data.url,
      p_tipo: validada.data.tipo,
      p_duracao_minutos: validada.data.duracaoMinutos,
      p_ordem: validada.data.ordem,
      p_ativo: validada.data.ativo,
      p_operador: operador.id,
      p_motivo: validada.data.motivo,
    });
  });
}
