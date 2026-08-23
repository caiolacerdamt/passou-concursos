import { z } from "zod";

import {
  alternativasSchema,
  type Alternativa,
  type FonteCitacao,
} from "@/modules/acervo/contrato";
import type { ConfiguracaoAdministrativa } from "@/modules/config/escrita";

export const DECISOES_DA_FILA = ["aprovada", "rejeitada"] as const;
export type DecisaoDaFila = (typeof DECISOES_DA_FILA)[number];

export type QuestaoDaFila = {
  tipoQuestao: "multipla_escolha" | "certo_errado";
  origem: "real" | "gerada_ia";
  enunciado: string;
  alternativas: readonly Alternativa[] | null;
  respostaCorreta: string | null;
  anulada: boolean;
  proveniencia: FonteCitacao | null;
};

export type RevisaoDaFila = {
  id: number;
  questaoId: string;
  questaoVersao: number;
  motivo: string;
  prioridade: number;
  criadaEm: string;
  questao: QuestaoDaFila;
};

export type CandidatoDeTopico = {
  id: string;
  nomeSugerido: string;
  materiaId: string | null;
  ocorrencias: number;
  sugeridoEm: string;
};

export type TopicoDoOperador = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
};

export type MateriaDoOperador = {
  id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
  topicos: readonly TopicoDoOperador[];
};

export type TaxonomiaDoOperador = {
  materias: readonly MateriaDoOperador[];
  candidatos: readonly CandidatoDeTopico[];
};

export type ResultadoDaConfiguracao = readonly ConfiguracaoAdministrativa[];

const textoObrigatorio = z.string().trim().min(1);
const uuid = z.string().uuid();

const camposDeCorrecao = z
  .object({
    enunciado: textoObrigatorio.optional(),
    alternativas: alternativasSchema.nullable().optional(),
    respostaCorreta: textoObrigatorio.optional(),
    topicoId: uuid.nullable().optional(),
    dificuldade: z.number().int().min(1).max(5).optional(),
    anulada: z.boolean().optional(),
  })
  .strict()
  .refine((campos) => Object.keys(campos).length > 0, {
    message: "correcao_deve_ter_ao_menos_um_campo",
  });

export const decisaoDaFilaSchema = z
  .object({
    revisoes: z.array(z.number().int().positive()).min(1).max(50),
    decisao: z.enum(DECISOES_DA_FILA),
    motivo: textoObrigatorio,
  })
  .strict()
  .superRefine((entrada, contexto) => {
    if (new Set(entrada.revisoes).size !== entrada.revisoes.length) {
      contexto.addIssue({
        code: "custom",
        path: ["revisoes"],
        message: "lote_de_revisoes_tem_id_duplicado",
      });
    }
  });

export const correcaoDeQuestaoSchema = z
  .object({
    questaoId: uuid,
    questaoVersao: z.number().int().positive(),
    mudancaTipo: z.enum(["cosmetica", "substantiva"]),
    motivo: textoObrigatorio,
    campos: camposDeCorrecao,
  })
  .strict();

export const decisaoDeCandidatoSchema = z
  .object({
    candidatoId: uuid,
    decisao: z.enum(["aprovado", "rejeitado"]),
    materiaId: uuid.nullable().optional(),
    nome: textoObrigatorio.nullable().optional(),
    motivo: textoObrigatorio,
  })
  .strict();

const camposDeMateria = z
  .object({
    nome: textoObrigatorio.optional(),
    ordem: z.number().int().optional(),
    ativa: z.boolean().optional(),
  })
  .strict()
  .refine((campos) => Object.keys(campos).length > 0, {
    message: "edicao_de_taxonomia_deve_ter_campo",
  });

const camposDeTopico = z
  .object({
    nome: textoObrigatorio.optional(),
    ordem: z.number().int().optional(),
    ativo: z.boolean().optional(),
    materiaId: uuid.optional(),
  })
  .strict()
  .refine((campos) => Object.keys(campos).length > 0, {
    message: "edicao_de_taxonomia_deve_ter_campo",
  });

export const edicaoDeTaxonomiaSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("materia"),
    id: uuid,
    motivo: textoObrigatorio,
    campos: camposDeMateria,
  }).strict(),
  z.object({
    tipo: z.literal("topico"),
    id: uuid,
    motivo: textoObrigatorio,
    campos: camposDeTopico,
  }).strict(),
]);

export type DecisaoDaFilaInput = z.infer<typeof decisaoDaFilaSchema>;
export type CorrecaoDeQuestaoInput = z.infer<typeof correcaoDeQuestaoSchema>;
export type DecisaoDeCandidatoInput = z.infer<typeof decisaoDeCandidatoSchema>;
export type EdicaoDeTaxonomiaInput = z.infer<typeof edicaoDeTaxonomiaSchema>;

export const alteracaoDeConfiguracaoSchema = z
  .object({
    chave: textoObrigatorio,
    valor: z.unknown().refine((valor) => valor !== undefined, "valor_obrigatorio"),
    motivo: textoObrigatorio,
  })
  .strict();

export type AlteracaoDeConfiguracaoInput = z.infer<
  typeof alteracaoDeConfiguracaoSchema
>;
