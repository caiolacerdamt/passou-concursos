import type { Client } from "pg";

import { inserirQuestao, sufixo } from "./acervo";

/**
 * Fixtures do M4, no mesmo molde de `tests/db/acervo.ts`.
 *
 * Tudo aqui roda dentro da transacao revertida de `conexao.ts`: `tentativas`
 * recusa DELETE por gatilho, entao nao ha como um teste limpar o que criou de
 * outra forma.
 */

/** Um `user_id` qualquer. `tentativas.user_id` nao tem FK — ver design da SPEC 05. */
export function novoAluno(): string {
  return crypto.randomUUID();
}

export type QuestaoParaResponder = {
  questao_id: string;
  questao_versao: number;
  materia_id: string;
  materia_rotulo: string;
  topico_id: string;
  topico_rotulo: string;
  banca: string;
  tipo_questao: "multipla_escolha" | "certo_errado";
  dificuldade: number;
  origem: "real" | "gerada_ia";
};

/**
 * Cria materia + topico + prova + questao e devolve **o snapshot** que uma
 * tentativa dessa questao deve carregar. E o mesmo join que `registrarTentativa`
 * faz: se a questao mudar de forma, este helper quebra junto.
 */
export async function questaoParaResponder(
  cliente: Client,
  opcoes: { tipo_questao?: "multipla_escolha" | "certo_errado"; dificuldade?: number } = {},
): Promise<QuestaoParaResponder> {
  const tipo = opcoes.tipo_questao ?? "multipla_escolha";

  const { rows: materia } = await cliente.query<{ id: string; nome: string }>(
    "insert into public.materias (nome) values ($1) returning id, nome",
    [`Materia ${sufixo()}`],
  );
  const { rows: topico } = await cliente.query<{ id: string; nome: string }>(
    "insert into public.topicos (materia_id, nome) values ($1, $2) returning id, nome",
    [materia[0].id, `Topico ${sufixo()}`],
  );

  const questao = await inserirQuestao(cliente, {
    topico_id: topico[0].id,
    tipo_questao: tipo,
    alternativas: tipo === "certo_errado" ? null : undefined,
    resposta_correta: tipo === "certo_errado" ? "C" : "C",
    dificuldade: opcoes.dificuldade ?? 3,
  });

  const { rows: prova } = await cliente.query<{ banca: string }>(
    `select p.banca from public.questoes q
       join public.provas p on p.id = q.prova_id
      where q.id = $1 and q.questao_versao = $2`,
    [questao.id, questao.questao_versao],
  );

  return {
    questao_id: questao.id,
    questao_versao: questao.questao_versao,
    materia_id: materia[0].id,
    materia_rotulo: materia[0].nome,
    topico_id: topico[0].id,
    topico_rotulo: topico[0].nome,
    banca: prova[0].banca,
    tipo_questao: tipo,
    dificuldade: opcoes.dificuldade ?? 3,
    origem: "real",
  };
}

export type DadosDaTentativa = {
  user_id?: string;
  sessao_id?: string;
  contexto?: "diagnostico" | "plano" | "treino" | "simulado" | "revisao";
  ordem_na_sessao?: number;
  resposta_dada?: string;
  correta?: boolean;
  tempo_ms?: number | null;
  marcou_chute?: boolean;
  causa_erro?: string | null;
  causa_origem?: "aluno" | "sistema" | null;
  respondida_em?: string | null;
  // Sobrescreve o snapshot vindo da questao — usado pelos testes de CHECK.
  tipo_questao?: "multipla_escolha" | "certo_errado";
  dificuldade?: number;
};

/**
 * INSERT em `tentativas` com um caso valido por default: multipla escolha,
 * contexto `plano`, resposta certa. Cada teste sobrescreve so o campo que quer
 * provar, para que a razao da recusa seja sempre a que o teste diz.
 */
export async function inserirTentativa(
  cliente: Client,
  questao: QuestaoParaResponder,
  dados: DadosDaTentativa = {},
): Promise<{ id: string; respondida_em: string }> {
  const ou = <T>(valor: T | null | undefined, padrao: T): T | null =>
    valor === undefined ? padrao : valor;

  const { rows } = await cliente.query<{ id: string; respondida_em: string }>(
    `insert into public.tentativas (
       user_id, questao_id, questao_versao,
       materia_id, materia_rotulo, topico_id, topico_rotulo, banca,
       tipo_questao, dificuldade, origem,
       sessao_id, contexto, ordem_na_sessao,
       resposta_dada, correta, tempo_ms, marcou_chute,
       causa_erro, causa_origem, respondida_em
     ) values (
       $1, $2, $3,
       $4, $5, $6, $7, $8,
       $9::public.tipo_questao, $10, $11::public.origem_questao,
       $12, $13::public.contexto_tentativa, $14,
       $15, $16, $17, $18,
       $19::public.causa_erro, $20::public.causa_origem,
       coalesce($21::timestamptz, now())
     ) returning id, respondida_em`,
    [
      ou(dados.user_id, novoAluno()),
      questao.questao_id,
      questao.questao_versao,
      questao.materia_id,
      questao.materia_rotulo,
      questao.topico_id,
      questao.topico_rotulo,
      questao.banca,
      ou(dados.tipo_questao, questao.tipo_questao),
      ou(dados.dificuldade, questao.dificuldade),
      questao.origem,
      ou(dados.sessao_id, crypto.randomUUID()),
      ou(dados.contexto, "plano"),
      ou(dados.ordem_na_sessao, 1),
      ou(dados.resposta_dada, "C"),
      ou(dados.correta, true),
      ou(dados.tempo_ms, 4200),
      ou(dados.marcou_chute, false),
      ou(dados.causa_erro, null),
      ou(dados.causa_origem, null),
      ou(dados.respondida_em, null),
    ],
  );
  return rows[0];
}

/**
 * Cria a particao do mes de `data` se ela ainda nao existir.
 *
 * Existe para o teste do T41, que roda **antes** de o `pg_partman` entrar: sem
 * nenhuma particao a tabela recusa todo INSERT. Dentro da transacao revertida o
 * `create table` volta atras junto com o resto.
 */
export async function garantirParticao(cliente: Client, data: Date): Promise<string> {
  const inicio = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
  const fim = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 1));
  const nome = `tentativas_p${inicio.getUTCFullYear()}_${String(inicio.getUTCMonth() + 1).padStart(2, "0")}`;

  const { rows } = await cliente.query<{ existe: boolean }>(
    "select to_regclass('public.' || $1) is not null as existe",
    [nome],
  );
  if (!rows[0].existe) {
    await cliente.query(
      `create table public.${nome} partition of public.tentativas
         for values from ('${inicio.toISOString()}') to ('${fim.toISOString()}')`,
    );
  }
  return nome;
}
