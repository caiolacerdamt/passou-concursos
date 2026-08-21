import type { Client } from "pg";

/**
 * Fixtures do acervo, compartilhadas pelos testes da SPEC 04.
 *
 * Tudo aqui roda dentro da transacao revertida de `conexao.ts`, entao nada
 * precisa (nem consegue) ser apagado no fim: `questoes` recusa DELETE por
 * gatilho.
 */

/** Sufixo unico por chamada: o banco de desenvolvimento e compartilhado. */
export function sufixo(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function criarTopico(cliente: Client): Promise<string> {
  const { rows: materia } = await cliente.query<{ id: string }>(
    "insert into public.materias (nome) values ($1) returning id",
    [`Materia ${sufixo()}`],
  );
  const { rows: topico } = await cliente.query<{ id: string }>(
    "insert into public.topicos (materia_id, nome) values ($1, $2) returning id",
    [materia[0].id, `Topico ${sufixo()}`],
  );
  return topico[0].id;
}

export async function criarProva(cliente: Client): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.provas (banca, ano, orgao, cargo)
     values ('Cesgranrio', 2023, $1, 'Escriturario')
     returning id`,
    [`Banco do Brasil ${sufixo()}`],
  );
  return rows[0].id;
}

/** As duas alternativas do AD-040 que todo teste de multipla escolha reusa. */
export const ALTERNATIVAS = JSON.stringify([
  { letra: "A", texto: "R$ 1.000,00" },
  { letra: "B", texto: "R$ 1.100,00" },
  { letra: "C", texto: "R$ 1.210,00" },
  { letra: "D", texto: "R$ 1.331,00" },
  { letra: "E", texto: "R$ 1.464,10" },
]);

export function fonteCitacao(numero = 1) {
  return JSON.stringify({
    banca: "Cesgranrio",
    ano: 2023,
    orgao: "Banco do Brasil",
    cargo: "Escriturario",
    numero,
  });
}

export type DadosDaQuestao = {
  id?: string;
  questao_versao?: number;
  prova_id?: string | null;
  numero?: number | null;
  origem?: "real" | "gerada_ia";
  fonte_citacao?: string | null;
  topico_id?: string | null;
  tipo_questao?: "multipla_escolha" | "certo_errado";
  enunciado?: string;
  alternativas?: string | null;
  imagens?: string;
  resposta_correta?: string | null;
  gabarito_versao?: string | null;
  anulada?: boolean;
  status?: string;
  dificuldade?: number | null;
  confianca_ia?: number | null;
  mudanca_tipo?: "cosmetica" | "substantiva" | null;
  mudanca_motivo?: string | null;
};

const COLUNAS = [
  "id",
  "questao_versao",
  "prova_id",
  "numero",
  "origem",
  "fonte_citacao",
  "topico_id",
  "tipo_questao",
  "enunciado",
  "alternativas",
  "imagens",
  "resposta_correta",
  "gabarito_versao",
  "anulada",
  "status",
  "dificuldade",
  "confianca_ia",
  "mudanca_tipo",
  "mudanca_motivo",
] as const;

/**
 * INSERT em `questoes` com os defaults de uma questao real de multipla escolha
 * valida. Cada teste sobrescreve so o campo que quer provar — assim a razao de a
 * linha ser recusada e sempre a que o teste diz, e nao um campo esquecido.
 */
export async function inserirQuestao(
  cliente: Client,
  dados: DadosDaQuestao = {},
): Promise<{ id: string; questao_versao: number }> {
  // `?? default` seria errado aqui: o teste que quer provar "recusa sem numero"
  // passa `numero: null` de proposito, e o `??` o transformaria de volta no
  // default. Toda coluna usa `=== undefined` para que NULL explicito chegue ao
  // banco como NULL.
  const ou = <T>(valor: T | null | undefined, padrao: T): T | null =>
    valor === undefined ? padrao : valor;

  const valores: Record<string, unknown> = {
    id: ou(dados.id, null),
    questao_versao: ou(dados.questao_versao, null),
    prova_id: ou(dados.prova_id, null),
    numero: ou(dados.numero, 1),
    origem: ou(dados.origem, "real"),
    fonte_citacao: ou(dados.fonte_citacao, fonteCitacao(ou(dados.numero, 1) ?? 1)),
    topico_id: ou(dados.topico_id, null),
    tipo_questao: ou(dados.tipo_questao, "multipla_escolha"),
    enunciado: ou(dados.enunciado, "Qual o montante de R$ 1.000,00 a 10% ao ano?"),
    alternativas: ou(dados.alternativas, ALTERNATIVAS),
    imagens: ou(dados.imagens, "[]"),
    resposta_correta: ou(dados.resposta_correta, "C"),
    gabarito_versao: ou(dados.gabarito_versao, "definitivo"),
    anulada: ou(dados.anulada, false),
    status: ou(dados.status, "rascunho"),
    dificuldade: ou(dados.dificuldade, 3),
    confianca_ia: ou(dados.confianca_ia, 0.95),
    mudanca_tipo: ou(dados.mudanca_tipo, null),
    mudanca_motivo: ou(dados.mudanca_motivo, null),
  };

  const pediuPublicada = valores.status === "publicada";
  if (pediuPublicada) valores.status = "rascunho";

  if (valores.prova_id === null && valores.origem === "real") {
    valores.prova_id = await criarProva(cliente);
  }

  // `coalesce($n, default)` para as colunas que o banco preenche: passar NULL
  // explicito num `not null default` daria erro em vez de usar o default.
  const sql = `
    insert into public.questoes (${COLUNAS.join(", ")})
    values (
      coalesce($1::uuid, gen_random_uuid()),
      coalesce($2::integer, 1),
      $3::uuid, $4::integer, $5::public.origem_questao, $6::jsonb, $7::uuid,
      $8::public.tipo_questao, $9::text, $10::jsonb, $11::jsonb, $12::text,
      $13::text, $14::boolean, $15::public.status_questao, $16::smallint,
      $17::numeric, $18::public.tipo_mudanca, $19::text
    )
    returning id, questao_versao
  `;

  const { rows } = await cliente.query<{ id: string; questao_versao: number }>(
    sql,
    COLUNAS.map((coluna) => valores[coluna]),
  );

  if (pediuPublicada && valores.origem === "real" && valores.fonte_citacao !== null && valores.resposta_correta !== null) {
    const operador = await cliente.query<{ id: string }>(
      "insert into auth.users (id) values (gen_random_uuid()) returning id",
    );
    const revisao = await cliente.query<{ id: string }>(
      `select public.enfileirar_questao_revisao(
         $1::uuid, $2::integer, 'fixture_publicacao'::text, 1::smallint, null::text
       ) as id`,
      [rows[0].id, rows[0].questao_versao],
    );
    await cliente.query(
      `select public.registrar_decisao_questao_revisao($1, 'aprovada', $2, 'fixture')`,
      [revisao.rows[0].id, operador.rows[0].id],
    );
    await cliente.query(
      `insert into public.explicacoes
         (questao_id, questao_versao, status, texto, alternativa_correta,
          fontes_citadas, chave_dedup)
       values ($1, $2, 'aprovada', 'explicacao fixture', $3,
               '[{"doc_id":"fixture","trecho":"fixture"}]'::jsonb, $4)`,
      [
        rows[0].id,
        rows[0].questao_versao,
        valores.resposta_correta,
        `fixture:explicacao:${rows[0].id}:${rows[0].questao_versao}`,
      ],
    );
  }

  if (pediuPublicada) {
    await cliente.query(
      "update public.questoes set status = 'publicada' where id = $1 and questao_versao = $2 and vigente",
      [rows[0].id, rows[0].questao_versao],
    );
  }

  return rows[0];
}
