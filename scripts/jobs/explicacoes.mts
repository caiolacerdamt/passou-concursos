#!/usr/bin/env node
/**
 * Fábrica standalone das explicações do acervo (SPEC 10 / IA-01).
 *
 * O job só pega questão com gabarito oficial e explicação aprovada ausente,
 * entrega a referência ao gateway, confere a resposta e grava. Rerodar é
 * seguro: a consulta exclui o que já está aprovado e as duas tabelas têm
 * chaves de dedup. Nenhuma rota da aplicação chama este arquivo.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import {
  alternativasSchema,
  fonteCitacaoSchema,
  gravarExplicacaoAprovada,
  gravarExplicacaoRejeitada,
  selecionarReferencia,
  type QuestaoParaReferencia,
} from "@/modules/acervo";
import { definirLeitorDeConfig } from "@/modules/config";
import {
  type ClienteSql,
  type ExplicacaoGerada,
  ExplicacaoRejeitada,
  GatewayParou,
  QuestaoSemGabaritoParaExplicacao,
  TarefaSemPerfil,
  alvoDaExplicacao,
  conferirExplicacao as conferirExplicacaoDaIa,
  definirRepositorioDeIa,
  executarTarefa,
  explicacaoGeradaSchema,
  chaveDedupDaExplicacao,
  leitorDeConfigPorPg,
  montarPedidoDeExplicacao,
  repositorioPorPg,
} from "@/modules/ia";
import { reportarErro } from "@/modules/observabilidade";

import { lerEnv } from "../alvo-do-banco.mjs";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

export const CONSULTA_DAS_QUESTOES = `
  select q.id, q.questao_versao, q.topico_id, q.prova_id, q.numero,
         q.origem::text as origem, q.enunciado, q.alternativas,
         q.resposta_correta, q.gabarito_versao,
         q.fonte_citacao
    from public.questoes q
   where q.vigente
     and not q.anulada
     and q.status <> 'rejeitada'
     and q.resposta_correta is not null
     and q.gabarito_versao is not null
     and not exists (
       select 1
         from public.explicacoes e
        where e.questao_id = q.id
          and e.questao_versao = q.questao_versao
          and e.vigente
          and e.status = 'aprovada'
     )
   order by q.id, q.questao_versao
`;

export type QuestaoDaFabrica = QuestaoParaReferencia & {
  origem: "real" | "gerada_ia";
};

export type Resumo = {
  total: number;
  geradas: number;
  reaproveitadas: number;
  rejeitadas: number;
};

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

function uuidOuNulo(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

function numeroOuNulo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function questaoDaLinha(linha: Record<string, unknown>): QuestaoDaFabrica {
  const alternativasBrutas = linha.alternativas;
  const alternativas =
    alternativasBrutas === null || alternativasBrutas === undefined
      ? null
      : alternativasSchema.parse(alternativasBrutas);
  const fonte = fonteCitacaoSchema.safeParse(linha.fonte_citacao);

  return {
    id: String(linha.id),
    questaoVersao: Number(linha.questao_versao),
    topicoId: uuidOuNulo(linha.topico_id),
    provaId: uuidOuNulo(linha.prova_id),
    numero: numeroOuNulo(linha.numero),
    enunciado: String(linha.enunciado),
    alternativas,
    respostaCorreta: textoOuNulo(linha.resposta_correta),
    gabaritoVersao: textoOuNulo(linha.gabarito_versao),
    fonteCitacao: fonte.success ? fonte.data : null,
    origem: linha.origem === "gerada_ia" ? "gerada_ia" : "real",
  };
}

export async function questoesSemExplicacao(
  cliente: ClienteSql,
): Promise<QuestaoDaFabrica[]> {
  const { rows } = await cliente.query(CONSULTA_DAS_QUESTOES);
  return rows.map(questaoDaLinha);
}

async function enfileirar(
  cliente: ClienteSql,
  questao: QuestaoDaFabrica,
  motivo: string,
  observacao: string,
): Promise<void> {
  await cliente.query(
    `select public.enfileirar_questao_revisao(
       $1::uuid, $2::integer, $3::text, 0::smallint, $4::text
     ) as id`,
    [
      questao.id,
      questao.questaoVersao,
      motivo,
      observacao.slice(0, 2000),
    ],
  );
}

function registroParaPersistencia(
  questao: QuestaoDaFabrica,
  resultado: ExplicacaoGerada,
  baseReferenciaId: string | null,
) {
  return {
    questaoId: questao.id,
    questaoVersao: questao.questaoVersao,
    chaveDedup: chaveDedupDaExplicacao(questao),
    resultado,
    baseReferenciaId,
  };
}

/** Processa as questões na ordem e para em falha de infraestrutura. */
export async function gerarExplicacoes(
  cliente: ClienteSql,
  questoes: readonly QuestaoDaFabrica[],
): Promise<Resumo> {
  let geradas = 0;
  let reaproveitadas = 0;
  let rejeitadas = 0;

  for (const questao of questoes) {
    let referencia: Awaited<ReturnType<typeof selecionarReferencia>> | null = null;
    let bruto: unknown;

    try {
      referencia = await selecionarReferencia(cliente, questao);
      const pedido = montarPedidoDeExplicacao(questao, referencia);
      const resposta = await executarTarefa({
        tarefa: "explicacao",
        pedido,
        alvo: alvoDaExplicacao(questao),
      });
      bruto = resposta.estruturado;

      const conferida = conferirExplicacaoDaIa(
        bruto,
        questao,
        referencia,
      );
      const gravada = await gravarExplicacaoAprovada(
        cliente,
        registroParaPersistencia(questao, conferida, referencia.baseReferenciaId),
      );

      if (gravada.inserida) geradas += 1;
      else reaproveitadas += 1;
    } catch (erro) {
      if (erro instanceof ExplicacaoRejeitada) {
        const estruturada = explicacaoGeradaSchema.safeParse(bruto);
        if (estruturada.success) {
          await gravarExplicacaoRejeitada(cliente, {
            ...registroParaPersistencia(
              questao,
              estruturada.data,
              referencia?.baseReferenciaId ?? null,
            ),
            resultado: estruturada.data,
          });
        }

        await enfileirar(
          cliente,
          questao,
          `explicacao_${erro.motivo}`,
          erro.message,
        );
        reportarErro(erro, {
          modulo: "ia",
          job: "explicacoes",
          questao_id: questao.id,
          questao_versao: questao.questaoVersao,
          motivo: "explicacao rejeitada e enviada para revisao humana",
        });
        rejeitadas += 1;
        continue;
      }

      if (erro instanceof QuestaoSemGabaritoParaExplicacao) {
        await enfileirar(cliente, questao, "gabarito_ausente", erro.message);
        rejeitadas += 1;
        continue;
      }

      // Falha de gateway/configuração/banco é fatal para a execução. Parar
      // evita gastar repetidamente e deixa o job vermelho para retomada.
      throw erro;
    }
  }

  return { total: questoes.length, geradas, reaproveitadas, rejeitadas };
}

/** Ambiente do script: `.env` do projeto vence o ambiente herdado. */
export function ambienteDoScript(
  raiz: string = process.cwd(),
): Record<string, string | undefined> {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

export function motivoDeParada(ambiente: Record<string, string | undefined>): {
  parar: boolean;
  motivo: string | null;
} {
  if (!ambiente.DATABASE_URL?.trim()) {
    return {
      parar: true,
      motivo:
        "DATABASE_URL nao esta definida: sem ela a fabrica nao encontra o acervo. Ver docs/SEGREDOS.md.",
    };
  }
  if (!ambiente.OPENAI_API_KEY?.trim()) {
    return {
      parar: false,
      motivo:
        "OPENAI_API_KEY nao esta definida: nenhuma explicacao sera gerada, e o acervo continua disponivel sem IA.",
    };
  }
  return { parar: false, motivo: null };
}

/** @returns código de saída do job */
export async function executar(
  ambiente: Record<string, string | undefined>,
  abrirConexao: () => ClienteSql & {
    connect(): Promise<void>;
    end(): Promise<void>;
  } = () => new Client({ connectionString: ambiente.DATABASE_URL }) as never,
): Promise<number> {
  const { parar, motivo } = motivoDeParada(ambiente);
  if (motivo !== null) {
    console[parar ? "error" : "warn"](`[explicacoes] ${motivo}`);
    return parar ? 1 : 0;
  }

  if (ambiente.OPENAI_API_KEY) process.env.OPENAI_API_KEY = ambiente.OPENAI_API_KEY;
  await iniciarSentry();

  const cliente = abrirConexao();
  try {
    await cliente.connect();
    definirLeitorDeConfig(leitorDeConfigPorPg(cliente) as never);
    definirRepositorioDeIa(repositorioPorPg(cliente));

    const questoes = await questoesSemExplicacao(cliente);
    if (questoes.length === 0) {
      console.log("[explicacoes] nenhuma questao esta sem explicacao aprovada.");
      await encerrar();
      return 0;
    }

    const resumo = await gerarExplicacoes(cliente, questoes);
    console.log(
      `[explicacoes] ${resumo.geradas} geradas, ${resumo.reaproveitadas} ` +
        `reaproveitadas, ${resumo.rejeitadas} enviadas para revisao de ${resumo.total}.`,
    );
    await encerrar();
    return 0;
  } catch (erro) {
    const conhecido = erro instanceof TarefaSemPerfil || erro instanceof GatewayParou;
    await reportar(erro, {
      origem: "explicacoes",
      motivo: conhecido
        ? "a fabrica parou no gateway/configuracao"
        : "a fabrica parou antes de concluir o lote",
    });
    await encerrar();
    return 1;
  } finally {
    await cliente.end().catch(() => {});
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const ambiente = ambienteDoScript();
  for (const chave of ["NEXT_PUBLIC_SENTRY_DSN", "OPENAI_API_KEY"]) {
    if (ambiente[chave]) process.env[chave] = ambiente[chave];
  }
  process.exit(await executar(ambiente));
}
