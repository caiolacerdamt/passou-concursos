import type { ClienteSql } from "@/modules/ia";

/**
 * Classificacao da questao no topico (BANCO-05, parte).
 *
 * A regra que este arquivo existe para cumprir cabe numa frase do M1: **a IA
 * sugere, o codigo so casa ou enfileira**. Topico que ela inventou e que nao
 * existe na taxonomia vira `topico_candidato` pendente, e quem decide se ele
 * vira canonico e o operador, na tela de curadoria (SPEC 15).
 *
 * A classificacao **nao** e uma segunda chamada ao modelo. O topico sugerido
 * chega no mesmo JSON da extracao, pelo mesmo texto ja lido e ja pago; pedir de
 * novo, questao por questao, dobraria o custo do acervo para responder o que ja
 * estava na mao.
 */

/** Um topico canonico, como o catalogo o entrega. */
export type TopicoCanonico = {
  id: string;
  nome: string;
  materiaId: string;
  materiaNome: string;
};

export type Classificacao = {
  /** Preenchido quando o sugerido casou com a taxonomia. */
  topicoId: string | null;
  /** Preenchido quando nao casou e a sugestao virou candidato. */
  candidatoId: string | null;
};

/**
 * Nome comparavel: sem acento, sem caixa, sem espaco sobrando.
 *
 * "Juros Compostos", "juros compostos" e "JUROS  COMPOSTOS" sao o mesmo topico.
 * Sem isto, cada variacao de digitacao do modelo criaria um candidato novo e a
 * fila de curadoria viraria uma lista de sinonimos.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    // A faixa combinante literal (U+0300-U+036F) tem bytes invisiveis no
    // editor: um copiar-colar que os perca deixaria a funcao sem tirar acento
    // nenhum, em silencio. A propriedade Unicode diz a mesma coisa em ASCII.
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Acha o topico canonico correspondente, se houver.
 *
 * A materia entra como **desempate**, nao como exigencia: "Juros Simples" existe
 * em Matematica Financeira e pode existir em Conhecimentos Bancarios (e o
 * comentario da propria migracao da taxonomia). Quando o modelo acerta a
 * materia, casa o par; quando so o nome do topico e unico no catalogo, casa
 * assim mesmo. Nome ambiguo sem materia **nao casa** — chutar entre dois
 * topicos poria a questao na materia errada do plano do aluno.
 */
export function casarTopico(
  topicoSugerido: string,
  materiaSugerida: string,
  catalogo: readonly TopicoCanonico[],
): TopicoCanonico | null {
  const alvo = normalizarNome(topicoSugerido);
  if (alvo === "") return null;

  const mesmoNome = catalogo.filter((t) => normalizarNome(t.nome) === alvo);
  if (mesmoNome.length === 0) return null;
  if (mesmoNome.length === 1) return mesmoNome[0];

  const materia = normalizarNome(materiaSugerida);
  const naMateria = mesmoNome.filter(
    (t) => normalizarNome(t.materiaNome) === materia,
  );
  return naMateria.length === 1 ? naMateria[0] : null;
}

export const CONSULTA_DO_CATALOGO = `
  select t.id, t.nome, m.id as materia_id, m.nome as materia_nome
    from public.topicos as t
    join public.materias as m on m.id = t.materia_id
   where t.ativo and m.ativa
   order by m.nome, t.nome
`;

/** A taxonomia canonica **ativa**. Topico desativado nao classifica nada novo. */
export async function lerCatalogo(
  cliente: ClienteSql,
): Promise<TopicoCanonico[]> {
  const { rows } = await cliente.query(CONSULTA_DO_CATALOGO);
  return rows.map((linha) => ({
    id: String(linha.id),
    nome: String(linha.nome),
    materiaId: String(linha.materia_id),
    materiaNome: String(linha.materia_nome),
  }));
}

/**
 * Classifica uma questao: casa com a taxonomia, ou enfileira o candidato.
 *
 * **Nao existe um terceiro caminho.** Nao ha, em lugar nenhum deste arquivo, um
 * `insert into topicos` — e essa ausencia que cumpre o AC. A questao que nao
 * casou fica com `topico_id` nulo, e ela nao chega ao aluno assim: publicar e da
 * SPEC 10, e questao sem topico nao entra em plano nenhum.
 */
export async function classificar(
  cliente: ClienteSql,
  sugestao: { topicoSugerido: string; materiaSugerida: string },
  catalogo: readonly TopicoCanonico[],
): Promise<Classificacao> {
  const casado = casarTopico(
    sugestao.topicoSugerido,
    sugestao.materiaSugerida,
    catalogo,
  );
  if (casado !== null) return { topicoId: casado.id, candidatoId: null };

  if (normalizarNome(sugestao.topicoSugerido) === "") {
    // Modelo que nao arriscou palpite nenhum nao gera candidato vazio.
    return { topicoId: null, candidatoId: null };
  }

  // A materia do candidato so vai junto quando ela **existe**: apontar para uma
  // materia inventada seria criar taxonomia por tabela vizinha.
  const materia = catalogo.find(
    (t) => normalizarNome(t.materiaNome) === normalizarNome(sugestao.materiaSugerida),
  );

  const { rows } = await cliente.query(
    "select public.registrar_topico_candidato($1, $2) as id",
    [sugestao.topicoSugerido, materia?.materiaId ?? null],
  );

  return { topicoId: null, candidatoId: String(rows[0]?.id ?? "") || null };
}
