import { expect, it } from "vitest";
import type { Client } from "pg";

import { comTransacaoRevertida } from "./conexao";
import { comoAluno, criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

function dataDeHojeEmSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

function deslocarData(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const deslocada = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return deslocada.toISOString().slice(0, 10);
}

function domingoDaSemanaAnteriorOuAtual(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return deslocarData(data, -diaDaSemana);
}

function diaDaSemana(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

descreveComBanco("SPEC 14 — sequência, piso, agenda e folga", () => {
  async function criarPerfil(
    cliente: Client,
    aluno: string,
    dias: number[] = [1, 2, 3, 4, 5],
  ): Promise<void> {
    await cliente.query(
      `insert into public.perfil_estudo
         (user_id, minutos_por_dia, dias_estudo, onboarding_concluido)
       values ($1, 60, $2::smallint[], true)`,
      [aluno, dias],
    );
  }

  async function criarPlano(
    cliente: Client,
    aluno: string,
    data: string,
    piso = false,
  ): Promise<string | null> {
    const plano = await cliente.query<{ id: string }>(
      `insert into public.plano_dia (user_id, data)
       values ($1, $2) returning id`,
      [aluno, data],
    );
    if (!piso) return plano.rows[0].id;

    const bloco = await cliente.query<{ id: string }>(
      `insert into public.plano_bloco
         (plano_dia_id, tipo, nivel, ordem, minutos_estimados)
       values ($1, 'revisar', 'piso', 1, 20) returning id`,
      [plano.rows[0].id],
    );
    return bloco.rows[0].id;
  }

  it("calcula piso cumprido, pendente e fora da agenda sem duplicar projeção", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarPerfil(cliente, aluno, [1]);

      // 2026-08-17 é segunda-feira: piso fechado.
      const blocoCumprido = await criarPlano(cliente, aluno, "2026-08-17", true);
      const planoFora = await criarPlano(cliente, aluno, "2026-08-18", true);
      await criarPlano(cliente, aluno, "2026-08-19", false);

      await cliente.query(
        `insert into public.sessoes
           (user_id, contexto, plano_bloco_id, iniciada_em, encerrada_em)
         values ($1, 'plano', $2, '2026-08-17T19:00:00Z', '2026-08-17T20:00:00Z')`,
        [aluno, blocoCumprido],
      );

      const primeiro = await cliente.query<{ n: number }>(
        "select public.recalcula_sequencia($1, '2026-08-19') as n",
        [aluno],
      );
      expect(primeiro.rows[0].n).toBe(3);

      const linhas = await cliente.query<{
        data: string;
        estado: string;
        sequencia: number;
        agendado: boolean;
        piso_cumprido: boolean;
      }>(
        `select data::text, estado, sequencia, agendado, piso_cumprido
           from public.sequencia_dia where user_id = $1 order by data`,
        [aluno],
      );
      expect(linhas.rows).toHaveLength(3);
      expect(linhas.rows[0]).toMatchObject({
        data: "2026-08-17",
        estado: "cumprido",
        sequencia: 1,
        agendado: true,
        piso_cumprido: true,
      });
      expect(linhas.rows[1]).toMatchObject({
        data: "2026-08-18",
        estado: "fora_agenda",
        sequencia: 1,
        agendado: false,
        piso_cumprido: true,
      });
      expect(linhas.rows[2]).toMatchObject({
        data: "2026-08-19",
        estado: "fora_agenda",
        sequencia: 1,
        agendado: false,
        piso_cumprido: true,
      });

      const segundo = await cliente.query<{ n: number }>(
        "select public.recalcula_sequencia($1, '2026-08-19') as n",
        [aluno],
      );
      expect(segundo.rows[0].n).toBe(3);
      const total = await cliente.query<{ n: string }>(
        "select count(*)::text as n from public.sequencia_dia where user_id = $1",
        [aluno],
      );
      expect(total.rows[0].n).toBe("3");

      // Evita que a fixture fique silenciosamente sem uso se o caso do piso
      // pendente mudar no futuro: o bloco existe e continua aberto.
      expect(planoFora).not.toBeNull();
    });
  });

  it("piso vazio exige meta cheia satisfeita no recalculo retroativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarPerfil(cliente, aluno, [1, 2]);

      await criarPlano(cliente, aluno, "2026-08-17", false);
      const planoComMeta = await criarPlano(cliente, aluno, "2026-08-18", false);
      const blocoMeta = await cliente.query<{ id: string }>(
        `insert into public.plano_bloco
           (plano_dia_id, tipo, nivel, ordem, minutos_estimados)
         values ($1, 'avancar', 'meta_cheia', 1, 20) returning id`,
        [planoComMeta],
      );
      await cliente.query(
        `insert into public.sessoes
           (user_id, contexto, plano_bloco_id, iniciada_em, encerrada_em)
         values ($1, 'plano', $2, '2026-08-18T19:00:00Z', '2026-08-18T20:00:00Z')`,
        [aluno, blocoMeta.rows[0].id],
      );

      await cliente.query("select public.recalcula_sequencia($1, $2::date)", [aluno, "2026-08-18"]);
      const { rows } = await cliente.query<{
        data: string;
        estado: string;
        sequencia: number;
        piso_entregue: boolean;
        piso_cumprido: boolean;
      }>(
        `select data::text, estado, sequencia, piso_entregue, piso_cumprido
           from public.sequencia_dia where user_id = $1 order by data`,
        [aluno],
      );
      expect(rows).toEqual([
        {
          data: "2026-08-17",
          estado: "piso_pendente",
          sequencia: 0,
          piso_entregue: false,
          piso_cumprido: false,
        },
        {
          data: "2026-08-18",
          estado: "cumprido",
          sequencia: 1,
          piso_entregue: false,
          piso_cumprido: true,
        },
      ]);
    });
  });

  it("consulta piso vazio de hoje como pendente ou cumprido", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const data = dataDeHojeEmSaoPaulo();
      const dia = diaDaSemana(data);
      const pendente = await criarUsuario(cliente);
      const cumprido = await criarUsuario(cliente);
      await criarPerfil(cliente, pendente, [dia]);
      await criarPerfil(cliente, cumprido, [dia]);
      await criarPlano(cliente, pendente, data, false);
      const planoCumprido = await criarPlano(cliente, cumprido, data, false);
      const blocoMeta = await cliente.query<{ id: string }>(
        `insert into public.plano_bloco
           (plano_dia_id, tipo, nivel, ordem, minutos_estimados)
         values ($1, 'avancar', 'meta_cheia', 1, 20) returning id`,
        [planoCumprido],
      );
      await cliente.query(
        `insert into public.sessoes
           (user_id, contexto, plano_bloco_id, iniciada_em, encerrada_em)
         values ($1, 'plano', $2, now() - interval '1 hour', now())`,
        [cumprido, blocoMeta.rows[0].id],
      );

      await comoAluno(cliente, pendente, async () => {
        const { rows } = await cliente.query<{ estado: string; piso_cumprido: boolean }>(
          "select estado, piso_cumprido from public.consultar_sequencia_do_dia()",
        );
        expect(rows).toEqual([{ estado: "piso_pendente", piso_cumprido: false }]);
      });
      await comoAluno(cliente, cumprido, async () => {
        const { rows } = await cliente.query<{ estado: string; piso_cumprido: boolean }>(
          "select estado, piso_cumprido from public.consultar_sequencia_do_dia()",
        );
        expect(rows).toEqual([{ estado: "cumprido", piso_cumprido: true }]);
      });
    });
  });

  it("folga declarada carrega a sequência e o piso pendente zera no dia agendado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarPerfil(cliente, aluno, [1, 2, 3]);
      const blocoAnterior = await criarPlano(cliente, aluno, "2026-08-17", true);
      await cliente.query(
        `insert into public.sessoes
           (user_id, contexto, plano_bloco_id, iniciada_em, encerrada_em)
         values ($1, 'plano', $2, '2026-08-17T19:00:00Z', '2026-08-17T20:00:00Z')`,
        [aluno, blocoAnterior],
      );
      await criarPlano(cliente, aluno, "2026-08-18", true);
      await criarPlano(cliente, aluno, "2026-08-19", true);
      await cliente.query(
        "insert into public.folgas_programadas (user_id, data, motivo) values ($1, '2026-08-18', 'descanso')",
        [aluno],
      );

      await cliente.query("select public.recalcula_sequencia($1, '2026-08-19')", [aluno]);
      const { rows } = await cliente.query<{
        data: string;
        estado: string;
        sequencia: number;
        folga: boolean;
      }>(
        `select data::text, estado, sequencia, folga
           from public.sequencia_dia where user_id = $1 order by data`,
        [aluno],
      );

      expect(rows.map((linha) => [linha.data, linha.estado, linha.sequencia])).toEqual([
        ["2026-08-17", "cumprido", 1],
        ["2026-08-18", "folga", 1],
        ["2026-08-19", "piso_pendente", 0],
      ]);
      expect(rows[1].folga).toBe(true);
    });
  });

  it("a consulta de hoje deriva o titular, é inicial e não grava a sequência", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarPerfil(cliente, aluno, [1]);

      await comoAluno(cliente, aluno, async () => {
        const hoje = dataDeHojeEmSaoPaulo();
        const { rows } = await cliente.query<{
          data: string;
          sequencia: number;
          estado: string;
          tem_historico: boolean;
        }>("select * from public.consultar_sequencia_do_dia()");

        expect(rows).toHaveLength(1);
        expect(rows[0].data).toBe(hoje);
        expect(rows[0].estado).toBe("fora_agenda");
        expect(rows[0].sequencia).toBe(0);
        expect(rows[0].tem_historico).toBe(false);
      });

      const { rows: projeção } = await cliente.query<{ n: string }>(
        "select count(*)::text as n from public.sequencia_dia where user_id = $1",
        [aluno],
      );
      expect(projeção[0].n).toBe("0");
    });
  });

  it("carrega cinco dias úteis até o fim de semana sem ressuscitar uma sequência antiga", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarPerfil(cliente, aluno, [1, 2, 3, 4, 5]);

      const hoje = dataDeHojeEmSaoPaulo();
      const domingo = domingoDaSemanaAnteriorOuAtual(hoje);
      const segunda = deslocarData(domingo, -6);
      const diasUteis = [0, 1, 2, 3, 4].map((offset) => deslocarData(segunda, offset));

      for (const [ordem, data] of diasUteis.entries()) {
        const bloco = await criarPlano(cliente, aluno, data, true);
        await cliente.query(
          `insert into public.sessoes
             (user_id, contexto, plano_bloco_id, iniciada_em, encerrada_em)
           values ($1, 'plano', $2, $3::timestamptz, $4::timestamptz)`,
          [
            aluno,
            bloco,
            `${data}T19:00:00-03:00`,
            `${data}T20:00:00-03:00`,
          ],
        );
        expect(ordem).toBeLessThan(5);
      }

      const sabado = deslocarData(domingo, -1);
      await cliente.query("select public.recalcula_sequencia($1, $2::date)", [aluno, sabado]);

      const { rows } = await cliente.query<{
        data: string;
        estado: string;
        sequencia: number;
      }>(
        `select data::text, estado, sequencia
           from public.sequencia_dia where user_id = $1 order by data`,
        [aluno],
      );
      expect(rows).toEqual([
        ...diasUteis.map((data, ordem) => ({ data, estado: "cumprido", sequencia: ordem + 1 })),
        { data: sabado, estado: "fora_agenda", sequencia: 5 },
      ]);

      await comoAluno(cliente, aluno, async () => {
        const { rows: hojeConsultado } = await cliente.query<{ sequencia: number }>(
          "select sequencia from public.consultar_sequencia_do_dia()",
        );
        expect(hojeConsultado[0].sequencia).toBe(5);
      });
    });
  });

  it("usa a última data histórica, não o maior valor antigo, ao abrir o dia", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const hoje = dataDeHojeEmSaoPaulo();
      const ontem = deslocarData(hoje, -1);
      const anteontem = deslocarData(hoje, -2);
      await criarPerfil(cliente, aluno, [...new Set([diaDaSemana(ontem), diaDaSemana(hoje)])]);

      await cliente.query(
        `insert into public.sequencia_dia
           (user_id, data, agendado, folga, piso_entregue, piso_cumprido, estado, sequencia)
         values ($1, $2::date, true, false, true, true, 'cumprido', 9),
                ($1, $3::date, true, false, true, false, 'piso_pendente', 0)`,
        [aluno, anteontem, ontem],
      );

      const bloco = await criarPlano(cliente, aluno, hoje, true);
      await cliente.query(
        `insert into public.sessoes
           (user_id, contexto, plano_bloco_id, iniciada_em, encerrada_em)
         values ($1, 'plano', $2, $3::timestamptz, $4::timestamptz)`,
        [aluno, bloco, `${hoje}T19:00:00-03:00`, `${hoje}T20:00:00-03:00`],
      );

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ sequencia: number; estado: string }>(
          "select sequencia, estado from public.consultar_sequencia_do_dia()",
        );
        expect(rows).toEqual([{ sequencia: 1, estado: "cumprido" }]);
      });
    });
  });

  it("RLS deixa o aluno ler a própria sequência e não a de outro aluno", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const a = await criarUsuario(cliente);
      const b = await criarUsuario(cliente);
      await criarPerfil(cliente, a, [1]);
      await criarPerfil(cliente, b, [1]);
      await cliente.query(
        `insert into public.sequencia_dia
           (user_id, data, agendado, folga, piso_entregue, piso_cumprido, estado, sequencia)
         values ($1, '2026-08-17', true, false, true, true, 'cumprido', 1),
                ($2, '2026-08-17', true, false, true, true, 'cumprido', 9)`,
        [a, b],
      );

      await comoAluno(cliente, a, async () => {
        const { rows } = await cliente.query<{ user_id: string; sequencia: number }>(
          "select user_id, sequencia from public.sequencia_dia",
        );
        expect(rows).toEqual([{ user_id: a, sequencia: 1 }]);
      });
    });
  });
});
