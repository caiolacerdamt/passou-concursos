import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDeServico } from "@/lib/db/servidor";

/**
 * A camada de fora da taxonomia (AD-139), do lado da aplicação.
 *
 * Regra que este módulo existe para segurar: **nome de concurso nunca vaza para
 * o núcleo**. O peso, a projeção e o plano trabalham em assunto canônico; o que
 * sai daqui é apresentação — o nome que está no edital do aluno.
 *
 * Quem decide qual é o concurso do aluno é o banco (`concurso_do_aluno`), não
 * este arquivo. Duplicar a regra aqui criaria duas respostas para a mesma
 * pergunta, e a do plano do dia é a do banco.
 */

export type ConcursoPublicado = {
  id: string;
  orgao: string;
  cargo: string;
};

export type MateriaDoEdital = {
  id: string;
  /** O nome como está no edital **deste** concurso. */
  nome: string;
  ordem: number;
  /** Assuntos canônicos que essa matéria agrupa. */
  topicoIds: string[];
};

type LinhaConcurso = { id: string; orgao: string; cargo: string };

type LinhaEdital = {
  id: string;
  nome: string;
  ordem: number;
  concurso_materia_assuntos: { topico_id: string; ordem: number }[] | null;
};

function falhaAoLer(recurso: string, mensagem: string): Error {
  return new Error(`falha ao ler ${recurso}: ${mensagem}`);
}

/**
 * Os concursos que o aluno pode escolher. Oculto e elegível não estão aqui:
 * não há razão para o aluno saber que existe um concurso em preparo
 * (RAIOX-20 AC1, ALUNO-13 AC4).
 */
export async function listarConcursosPublicados(
  cliente: SupabaseClient = clienteDeServico(),
): Promise<ConcursoPublicado[]> {
  const consulta = await cliente
    .from("concursos")
    .select("id, orgao, cargo")
    .eq("visibilidade", "publicado")
    .order("orgao", { ascending: true })
    .order("cargo", { ascending: true });

  if (consulta.error) throw falhaAoLer("concursos", consulta.error.message);
  return ((consulta.data ?? []) as LinhaConcurso[]).map((linha) => ({
    id: linha.id,
    orgao: linha.orgao,
    cargo: linha.cargo,
  }));
}

/** O concurso do aluno, já resolvido pela flag e pelo padrão, ou `null`. */
export async function concursoDoAluno(
  userId: string,
  cliente: SupabaseClient = clienteDeServico(),
): Promise<string | null> {
  const consulta = await cliente.rpc("concurso_do_aluno", { p_user_id: userId });
  if (consulta.error) throw falhaAoLer("concurso_do_aluno", consulta.error.message);
  return (consulta.data as string | null) ?? null;
}

/** O `perfil_concurso` por trás do concurso do aluno — a chave da projeção. */
export async function perfilConcursoDoAluno(
  userId: string,
  cliente: SupabaseClient = clienteDeServico(),
): Promise<string | null> {
  const consulta = await cliente.rpc("perfil_concurso_do_aluno", {
    p_user_id: userId,
  });
  if (consulta.error) {
    throw falhaAoLer("perfil_concurso_do_aluno", consulta.error.message);
  }
  return (consulta.data as string | null) ?? null;
}

/**
 * As matérias do edital de um concurso, na ordem do edital, com os assuntos
 * canônicos que cada uma agrupa.
 */
export async function editalDoConcurso(
  concursoId: string,
  cliente: SupabaseClient = clienteDeServico(),
): Promise<MateriaDoEdital[]> {
  const consulta = await cliente
    .from("concurso_materias")
    .select("id, nome, ordem, concurso_materia_assuntos(topico_id, ordem)")
    .eq("concurso_id", concursoId)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (consulta.error) {
    throw falhaAoLer("concurso_materias", consulta.error.message);
  }

  return ((consulta.data ?? []) as LinhaEdital[]).map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    ordem: Number(linha.ordem),
    topicoIds: [...(linha.concurso_materia_assuntos ?? [])]
      .sort((a, b) => a.ordem - b.ordem)
      .map((assunto) => assunto.topico_id),
  }));
}

/**
 * A escolha do aluno. O titular vem de `auth.uid()` **dentro** da função do
 * banco — passar o `user_id` daqui deixaria um aluno escolher pelo outro.
 */
export async function escolherConcurso(
  concursoId: string,
  cliente: SupabaseClient,
): Promise<void> {
  const { error } = await cliente.rpc("escolher_concurso", {
    p_concurso_id: concursoId,
  });
  if (error) throw new Error(`falha ao escolher concurso: ${error.message}`);
}
