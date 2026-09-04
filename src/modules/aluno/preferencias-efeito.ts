import type { NivelDeclarado } from "./onboarding";

/**
 * A aritmética do painel "o que muda" das preferências.
 *
 * Fica fora do componente porque é conta, não desenho: minutos × dias é o
 * único número que a tela pode mostrar sem inventar nada. Estimar quantas
 * questões cabem no dia seria projeção — e projeção é do motor do plano, não
 * de um formulário.
 */

export const DIAS_DA_SEMANA = [
  { valor: 0, nome: "Domingo", curto: "Dom", inicial: "D" },
  { valor: 1, nome: "Segunda", curto: "Seg", inicial: "S" },
  { valor: 2, nome: "Terça", curto: "Ter", inicial: "T" },
  { valor: 3, nome: "Quarta", curto: "Qua", inicial: "Q" },
  { valor: 4, nome: "Quinta", curto: "Qui", inicial: "Q" },
  { valor: 5, nome: "Sexta", curto: "Sex", inicial: "S" },
  { valor: 6, nome: "Sábado", curto: "Sáb", inicial: "S" },
] as const;

/** Os atalhos de tempo. O campo numérico continua existindo para o resto. */
export const MINUTOS_SUGERIDOS = [30, 45, 60, 90, 120, 180] as const;

export type EstadoDasPreferencias = {
  concursoAlvo: string;
  minutosPorDia: number;
  diasEstudo: number[];
  horarioEstudo: string;
  nivelDeclarado: NivelDeclarado;
};

/** "3 h", "1 h 30", "45 min" — sem "0 h" e sem "90 min". */
export function formatarDuracao(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return "0 min";
  const horas = Math.floor(minutos / 60);
  const resto = Math.round(minutos % 60);
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${String(resto).padStart(2, "0")}`;
}

export function cargaSemanal(minutosPorDia: number, diasEstudo: number[]): number {
  if (!Number.isFinite(minutosPorDia) || minutosPorDia <= 0) return 0;
  return minutosPorDia * diasEstudo.length;
}

/**
 * O próximo dia de estudo, contando hoje.
 *
 * `diaDeHoje` chega de fora — do fuso do produto, calculado no servidor — e
 * não de um `new Date()` aqui dentro: o componente é cliente, e o relógio do
 * navegador do aluno pode estar em qualquer fuso. Com o dia vindo pronto, o
 * que o servidor renderiza e o que o navegador re-renderiza são iguais.
 */
export function proximoEstudo(
  diasEstudo: number[],
  diaDeHoje: number,
): { dia: number; hoje: boolean } | null {
  if (diasEstudo.length === 0) return null;

  for (let adiante = 0; adiante < 7; adiante += 1) {
    const dia = (diaDeHoje + adiante) % 7;
    if (diasEstudo.includes(dia)) return { dia, hoje: adiante === 0 };
  }

  return null;
}

/**
 * Quantos campos mudaram em relação ao que está salvo.
 *
 * Serve para a barra de salvar dizer a verdade sobre o que está pendente. A
 * agenda é comparada como CONJUNTO: marcar e desmarcar o mesmo dia não é uma
 * mudança, e contar como se fosse ensinaria o aluno a ignorar o aviso.
 */
export function contarMudancas(
  salvo: EstadoDasPreferencias,
  atual: EstadoDasPreferencias,
): number {
  const mesmaAgenda =
    salvo.diasEstudo.length === atual.diasEstudo.length &&
    [...salvo.diasEstudo].sort().every((dia, i) => dia === [...atual.diasEstudo].sort()[i]);

  return [
    salvo.concursoAlvo.trim() !== atual.concursoAlvo.trim(),
    salvo.minutosPorDia !== atual.minutosPorDia,
    !mesmaAgenda,
    horarioCurto(salvo.horarioEstudo) !== horarioCurto(atual.horarioEstudo),
    salvo.nivelDeclarado !== atual.nivelDeclarado,
  ].filter(Boolean).length;
}

/** `19:30:00` do banco e `19:30` do input são o mesmo horário. */
export function horarioCurto(horario: string): string {
  return /^(\d{2}:\d{2})/.exec(horario)?.[1] ?? horario;
}

/**
 * O dia da semana de uma data `YYYY-MM-DD` do produto.
 *
 * Monta em UTC de propósito: `new Date("2026-09-03")` já é UTC, mas
 * `new Date("2026-09-03T00:00:00")` seria local, e no Brasil isso volta um
 * dia. O dia da semana de uma data sem hora não pode depender do fuso de quem
 * pergunta.
 */
export function diaDaSemanaDe(dataIso: string): number {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso);
  if (!partes) return new Date().getUTCDay();
  return new Date(
    Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])),
  ).getUTCDay();
}
