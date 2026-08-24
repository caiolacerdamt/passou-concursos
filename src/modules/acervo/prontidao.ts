import type { ClienteSql } from "@/modules/ia";

/** Prontidão de um tópico para o go-live: questão apta e recurso ativo. */
export type LinhaDaProntidaoConteudo = {
  materiaId: string;
  materia: string;
  topicoId: string;
  topico: string;
  noEdital: boolean;
  publicadas: number;
  aptasSessao: number;
  recursosAtivos: number;
  minimoAptas: number;
  pronto: boolean;
};

/**
 * A view é a única fonte: piso, contagem e vínculo com o edital vêm do banco.
 * O relatório não recalcula nada em memória para não abrir uma segunda verdade.
 */
export const CONSULTA_DA_PRONTIDAO_CONTEUDO = `
  select materia_id, materia, topico_id, topico, no_edital,
         publicadas, aptas_sessao, recursos_ativos, minimo_aptas, pronto
    from public.prontidao_conteudo
   order by no_edital desc, materia, topico
`;

type LinhaBruta = {
  materia_id: string;
  materia: string;
  topico_id: string;
  topico: string;
  no_edital: boolean;
  publicadas: number | string;
  aptas_sessao: number | string;
  recursos_ativos: number | string;
  minimo_aptas: number | string;
  pronto: boolean;
};

function mapear(linha: LinhaBruta): LinhaDaProntidaoConteudo {
  return {
    materiaId: String(linha.materia_id),
    materia: linha.materia,
    topicoId: String(linha.topico_id),
    topico: linha.topico,
    noEdital: linha.no_edital === true,
    publicadas: Number(linha.publicadas),
    aptasSessao: Number(linha.aptas_sessao),
    recursosAtivos: Number(linha.recursos_ativos),
    minimoAptas: Number(linha.minimo_aptas),
    pronto: linha.pronto === true,
  };
}

export async function consultarProntidaoConteudo(
  cliente: ClienteSql,
): Promise<readonly LinhaDaProntidaoConteudo[]> {
  const resultado = await cliente.query(CONSULTA_DA_PRONTIDAO_CONTEUDO);
  return resultado.rows.map((linha) => mapear(linha as LinhaBruta));
}

/** Tópicos do edital que ainda não podem receber um aluno hoje. */
export function pendenciasDoEdital(
  linhas: readonly LinhaDaProntidaoConteudo[],
): readonly LinhaDaProntidaoConteudo[] {
  return linhas.filter((linha) => linha.noEdital && !linha.pronto);
}
