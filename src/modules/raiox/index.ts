import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDeServico } from "@/lib/db/servidor";

export type TendenciaRaioX = "subindo" | "estavel" | "caindo";

export type PerfilRaioX = {
  orgao: string;
  banca: string;
  dataProva: string | null;
  formato: string;
};

export type LinhaRaioX = {
  topicoId: string;
  topico: string;
  peso: number;
  nQuestoes: number;
  tendencia: TendenciaRaioX;
  amostraBaixa: boolean;
};

export type DadosRaioX = {
  perfil: PerfilRaioX | null;
  linhas: LinhaRaioX[];
};

type PerfilBanco = {
  id: string;
  orgao: string;
  banca: string;
  data_prova: string | null;
  formato: string;
};

type ProjecaoBanco = {
  topico_id: string;
  peso: number | string;
  n_questoes: number;
  tendencia: TendenciaRaioX;
  amostra_baixa: boolean;
};

type TopicoBanco = { id: string; nome: string };

function falhaAoLer(recurso: string, mensagem: string): Error {
  return new Error(`falha ao ler ${recurso}: ${mensagem}`);
}

/**
 * Leitura pública do M5. O cliente de serviço fica aqui, no servidor; a tela
 * recebe apenas o perfil e os campos que precisa apresentar.
 */
export async function consultarRaioX(
  cliente: SupabaseClient = clienteDeServico(),
): Promise<DadosRaioX> {
  const perfilConsulta = await cliente
    .from("perfil_concurso")
    .select("id, orgao, banca, data_prova, formato")
    .eq("ativo", true)
    .maybeSingle();

  if (perfilConsulta.error) {
    throw falhaAoLer("perfil_concurso", perfilConsulta.error.message);
  }

  const perfil = perfilConsulta.data as PerfilBanco | null;
  if (!perfil) return { perfil: null, linhas: [] };

  const projecoesConsulta = await cliente
    .from("raiox_projecoes")
    .select("topico_id, peso, n_questoes, tendencia, amostra_baixa")
    .eq("perfil_concurso_id", perfil.id)
    .order("peso", { ascending: false })
    .order("topico_id", { ascending: true });

  if (projecoesConsulta.error) {
    throw falhaAoLer("raiox_projecoes", projecoesConsulta.error.message);
  }

  const projecoes = (projecoesConsulta.data ?? []) as ProjecaoBanco[];
  if (projecoes.length === 0) {
    return {
      perfil: {
        orgao: perfil.orgao,
        banca: perfil.banca,
        dataProva: perfil.data_prova,
        formato: perfil.formato,
      },
      linhas: [],
    };
  }

  const topicoIds = projecoes.map((projecao) => projecao.topico_id);
  const topicosConsulta = await cliente
    .from("topicos")
    .select("id, nome")
    .in("id", topicoIds);

  if (topicosConsulta.error) {
    throw falhaAoLer("topicos", topicosConsulta.error.message);
  }

  const nomes = new Map(
    ((topicosConsulta.data ?? []) as TopicoBanco[]).map((topico) => [
      topico.id,
      topico.nome,
    ]),
  );

  if (nomes.size !== new Set(topicoIds).size) {
    throw new Error("raiox_projecoes aponta para tópico que não existe");
  }

  return {
    perfil: {
      orgao: perfil.orgao,
      banca: perfil.banca,
      dataProva: perfil.data_prova,
      formato: perfil.formato,
    },
    linhas: projecoes.map((projecao) => {
      const peso = Number(projecao.peso);
      if (!Number.isFinite(peso)) {
        throw new Error("raiox_projecoes contém peso inválido");
      }

      return {
        topicoId: projecao.topico_id,
        topico: nomes.get(projecao.topico_id)!,
        peso,
        nQuestoes: Number(projecao.n_questoes),
        tendencia: projecao.tendencia,
        amostraBaixa: projecao.amostra_baixa,
      };
    }),
  };
}
