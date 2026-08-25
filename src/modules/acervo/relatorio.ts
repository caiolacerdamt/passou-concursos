import type { ClienteSql } from "@/modules/ia";

/** Contagem efetiva do acervo por matéria e tópico. */
export type LinhaDoInventarioAcervo = {
  materiaId: string;
  materia: string;
  topicoId: string;
  topico: string;
  total: number;
  importadas: number;
  publicadas: number;
  aptasSessao: number;
};

/**
 * A view é a fonte única do relatório. `vigente` já está no join da view e as
 * quatro contagens vêm do banco; nenhum número de fixture ou memória chega à
 * UI por este contrato.
 */
export const CONSULTA_DO_INVENTARIO_ACERVO = `
  select materia_id, materia, topico_id, topico,
         total, importadas, publicadas, aptas_sessao
    from public.inventario_acervo
   order by materia_id, topico_id
`;

type LinhaBruta = {
  materia_id: string;
  materia: string;
  topico_id: string;
  topico: string;
  total: number | string;
  importadas: number | string;
  publicadas: number | string;
  aptas_sessao: number | string;
};

function mapear(linha: LinhaBruta): LinhaDoInventarioAcervo {
  return {
    materiaId: String(linha.materia_id),
    materia: linha.materia,
    topicoId: String(linha.topico_id),
    topico: linha.topico,
    total: Number(linha.total),
    importadas: Number(linha.importadas),
    publicadas: Number(linha.publicadas),
    aptasSessao: Number(linha.aptas_sessao),
  };
}

export async function consultarInventarioAcervo(
  cliente: ClienteSql,
): Promise<readonly LinhaDoInventarioAcervo[]> {
  const resultado = await cliente.query(CONSULTA_DO_INVENTARIO_ACERVO);
  return resultado.rows.map((linha) => mapear(linha as LinhaBruta));
}
