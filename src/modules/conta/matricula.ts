import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";

/**
 * A guarda de matricula do lado da aplicacao (PAG-01, PAG-06 AC2).
 *
 * A trava de verdade e a RLS: sem matricula, o banco devolve zero linha do
 * acervo. Esta camada existe para a **experiencia**, nao para a seguranca —
 * sem ela o aluno sem matricula veria uma tela vazia e concluiria que o produto
 * esta quebrado, em vez de ver o convite para assinar.
 *
 * Isso e proposital e vale registrar: se alguem apagar este arquivo, o produto
 * fica feio e continua fechado. Se alguem apagar a policy do banco, o produto
 * fica bonito e aberto.
 */

export type Matricula = {
  id: string;
  estado: string;
  fim_em: string;
};

type Leitor = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  from: (tabela: string) => {
    select: (colunas: string) => {
      eq: (
        coluna: string,
        valor: string,
      ) => {
        gt: (
          coluna: string,
          valor: string,
        ) => {
          maybeSingle: () => Promise<{ data: Matricula | null }>;
        };
      };
    };
  };
};

/**
 * A matricula ativa do aluno da sessao, ou `null`.
 *
 * A consulta nao filtra por `user_id`: **a RLS faz isso**. Filtrar aqui daria a
 * impressao de que a policy e opcional, e a proxima tela copiaria a consulta
 * sem o filtro achando que esta protegida pelo filtro anterior.
 */
export async function matriculaAtiva(
  cliente?: Leitor,
): Promise<Matricula | null> {
  const supabase = (cliente ?? (await clienteDaSessao())) as Leitor;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("matriculas")
    .select("id, estado, fim_em")
    .eq("estado", "ativa")
    .gt("fim_em", new Date().toISOString())
    .maybeSingle();

  return data ?? null;
}

/**
 * Toda tela de conteudo pago comeca por aqui. Sem matricula: `/assinar`.
 * **Nunca** meia tela — o m8 §P1 AC6 proibe conteudo parcial, e o jeito de nao
 * mostrar conteudo parcial e nao chegar a renderizar.
 */
export async function exigirMatriculaAtiva(): Promise<Matricula> {
  const matricula = await matriculaAtiva();
  if (!matricula) redirect("/assinar");
  return matricula;
}
