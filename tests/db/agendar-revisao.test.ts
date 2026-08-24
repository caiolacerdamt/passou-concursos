import type { Client } from "pg";
import { afterEach, expect, it } from "vitest";

import { agendarRevisao } from "@/modules/aluno/revisao";
import type { Chave } from "@/modules/config/catalogo";
import {
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config/leitura";

import { criarTopico } from "./acervo";
import {
  comoAluno,
  criarSessao,
  inserirTentativa,
  novoAluno,
  questaoParaResponder,
  recusa,
} from "./aluno";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";
import { supabaseNaTransacao } from "./supabase-na-transacao";

/**
 * SPEC 06 · T50 — `agendarRevisao` de ponta a ponta (ALUNO-09, AD-072, AD-092).
 *
 * E o **Independent Test da story**, nas duas metades:
 *   1. aluno novo, sem historico nenhum, ja recebe intervalo do FSRS;
 *   2. trocar a chave de configuracao faz a regua fixa assumir **sem perder
 *      nenhum agendamento**.
 *
 * O cliente do Supabase e o adaptador que fala com a transacao revertida: o
 * cliente real abriria outra conexao e nao veria o topico que o teste semeou.
 */

/** Sobrescreve so as chaves passadas; o resto cai no default do catalogo. */
function configFixa(valores: Partial<Record<Chave, unknown>>): void {
  definirLeitorDeConfig(async (chaves) =>
    Object.fromEntries(
      chaves
        .filter((chave) => chave in valores)
        .map((chave) => [chave, valores[chave]]),
    ),
  );
}

afterEach(() => {
  restaurarLeitorPadrao();
});

type Agenda = {
  /** `date` chega como texto — ver `setup.ts`. */
  due: string;
  algoritmo: string;
  regua_passo: number;
  ultima_nota: number;
  fsrs_card: Record<string, unknown> | null;
};

async function agendaDe(
  cliente: Client,
  aluno: string,
  topico: string,
): Promise<Agenda | null> {
  const { rows } = await cliente.query<Agenda>(
    `select due, algoritmo, regua_passo, ultima_nota, fsrs_card
       from public.revisao_agenda where user_id = $1 and topico_id = $2`,
    [aluno, topico],
  );
  return rows[0] ?? null;
}

function diasEntre(due: Date | string, base: Date): number {
  const alvo = typeof due === "string" ? new Date(`${due}T00:00:00Z`) : due;
  const umDia = 24 * 60 * 60 * 1000;
  const dia = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((dia(alvo) - dia(base)) / umDia);
}

const HOJE = new Date("2026-08-17T12:00:00Z");

descreveComBanco("agendarRevisao — FSRS desde o dia 1 (ALUNO-09 AC1)", () => {
  it("aluno SEM historico nenhum ja recebe intervalo do FSRS, em dias", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({});
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      const resultado = await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.8, agora: HOJE },
        supabaseNaTransacao(cliente),
      );

      // O ponto do AD-072: os 21 pesos padrao da biblioteca funcionam sem
      // historico, entao nao ha cold-start que justifique comecar pela regua.
      expect(resultado.algoritmo).toBe("fsrs");
      expect(resultado.nota).toBe(3);

      // AD-092: com os passos de curto prazo ligados, `bom` num cartao novo
      // devolveria 10 MINUTOS — o topico nasceria vencido no mesmo dia e o motor
      // de prioridade nunca sairia do lugar.
      const dias = diasEntre(resultado.due, HOJE);
      expect(dias).toBeGreaterThanOrEqual(1);

      const agenda = await agendaDe(cliente, aluno, topico);
      expect(agenda?.algoritmo).toBe("fsrs");
      expect(agenda?.ultima_nota).toBe(3);
      // O `Card` fica gravado: e o estado acumulado que a proxima revisao usa.
      expect(agenda?.fsrs_card).not.toBeNull();
      expect(agenda?.fsrs_card).toHaveProperty("stability");
    });
  });

  it("nota melhor adia mais que nota pior — o intervalo responde ao desempenho", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({});
      const topico = await criarTopico(cliente);

      async function diasPara(percentual: number): Promise<number> {
        const { due } = await agendarRevisao(
          {
            userId: novoAluno(),
            topicoId: topico,
            percentualAcerto: percentual,
            agora: HOJE,
          },
          supabaseNaTransacao(cliente),
        );
        return diasEntre(due, HOJE);
      }

      const errei = await diasPara(0.2);
      const bom = await diasPara(0.8);
      const facil = await diasPara(1);

      expect(bom).toBeGreaterThan(errei);
      expect(facil).toBeGreaterThan(bom);
    });
  });

  it("a segunda revisao usa o Card gravado, e nao recomeca do zero", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({});
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);
      const supabase = supabaseNaTransacao(cliente);

      const primeira = await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.8, agora: HOJE },
        supabase,
      );
      const depois = new Date(primeira.due);
      const segunda = await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.8, agora: depois },
        supabase,
      );

      // Se o `Card` nao fosse reidratado do jsonb, a segunda revisao seria
      // identica a primeira — o intervalo nunca cresceria e o FSRS viraria
      // regua de 3 dias em silencio.
      expect(diasEntre(segunda.due, depois)).toBeGreaterThan(
        diasEntre(primeira.due, HOJE),
      );

      // Uma linha por aluno e topico: a agenda e estado, nao log.
      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_agenda where user_id = $1",
        [aluno],
      );
      expect(rows[0].n).toBe("1");
    });
  });
});

descreveComBanco("agendarRevisao — a regua fixa como plano B (ALUNO-09 AC4)", () => {
  it("com a chave trocada a data sai de 1/3/7/14/30, na MESMA coluna `due`", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({ "param.m4.algoritmo_revisao": "regua_fixa" });
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);
      const supabase = supabaseNaTransacao(cliente);

      const passos: number[] = [];
      let quando = HOJE;
      for (let i = 0; i < 6; i += 1) {
        const r = await agendarRevisao(
          { userId: aluno, topicoId: topico, percentualAcerto: 0.8, agora: quando },
          supabase,
        );
        passos.push(diasEntre(r.due, quando));
        quando = new Date(r.due);
      }

      // 1, 3, 7, 14, 30 e depois trava no ultimo degrau.
      expect(passos).toEqual([1, 3, 7, 14, 30, 30]);

      const agenda = await agendaDe(cliente, aluno, topico);
      expect(agenda?.algoritmo).toBe("regua_fixa");
      // Nenhuma coluna nova: e a mesma `due` que o FSRS escreveria.
      expect(agenda?.due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("errar volta ao primeiro degrau", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({ "param.m4.algoritmo_revisao": "regua_fixa" });
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);
      const supabase = supabaseNaTransacao(cliente);

      await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.8, agora: HOJE },
        supabase,
      );
      await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.8, agora: HOJE },
        supabase,
      );
      const errou = await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.1, agora: HOJE },
        supabase,
      );

      expect(diasEntre(errou.due, HOJE)).toBe(1);
      expect((await agendaDe(cliente, aluno, topico))?.regua_passo).toBe(0);
    });
  });

  it("trocar de FSRS para regua fixa NAO perde o agendamento nem o Card", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);
      const supabase = supabaseNaTransacao(cliente);

      configFixa({});
      await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.8, agora: HOJE },
        supabase,
      );
      const comFsrs = await agendaDe(cliente, aluno, topico);
      expect(comFsrs?.fsrs_card).not.toBeNull();

      // A troca acontece sem migracao de dado nenhuma: so a chave muda.
      configFixa({ "param.m4.algoritmo_revisao": "regua_fixa" });
      await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.8, agora: HOJE },
        supabase,
      );

      const comRegua = await agendaDe(cliente, aluno, topico);
      expect(comRegua?.algoritmo).toBe("regua_fixa");
      // O `Card` continua guardado: quem voltar ao FSRS depois nao recomeca do
      // zero, e e por isso que a troca e reversivel nos dois sentidos.
      expect(comRegua?.fsrs_card).toEqual(comFsrs?.fsrs_card);

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_agenda where user_id = $1",
        [aluno],
      );
      expect(rows[0].n).toBe("1");
    });
  });
});

descreveComBanco("agendarRevisao — o que sai do modulo (ALUNO-09 AC3)", () => {
  it("cada revisao deixa um evento com percentual E nota", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({});
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      await agendarRevisao(
        { userId: aluno, topicoId: topico, percentualAcerto: 0.62, agora: HOJE },
        supabaseNaTransacao(cliente),
      );

      const { rows } = await cliente.query<{
        nota: number;
        percentual: string;
        algoritmo: string;
      }>(
        "select nota, percentual, algoritmo from public.revisao_evento where user_id = $1",
        [aluno],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].nota).toBe(2);
      // O percentual cru fica guardado: sem ele, recalibrar as faixas depois
      // seria impossivel (o risco registrado no AD-072).
      expect(Number(rows[0].percentual)).toBeCloseTo(0.62, 4);
    });
  });

  it("um aluno autenticado NAO grava revisao no nome de outro (G1)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const vitima = novoAluno();
      const topico = await criarTopico(cliente);

      // `registrar_revisao` e `security definer` e esta concedida a
      // `authenticated`: sem a amarra ao `auth.uid()`, o aluno gravaria uma linha
      // no log APPEND-ONLY de outro — e ninguem a apaga depois.
      await comoAluno(cliente, aluno, async () => {
        await recusa(
          cliente,
          () =>
            cliente.query(
              `select * from public.registrar_revisao(
                 $1, $2, 'fsrs', current_date + 3, 3::smallint, 0.8::numeric)`,
              [vitima, topico],
            ),
          /aluno_alheio/,
        );
      });

      const { rows } = await cliente.query(
        "select 1 from public.revisao_evento where user_id = $1",
        [vitima],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("chamada autenticada sem sessao e recusada sem criar agenda", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      await comoAluno(cliente, aluno, async () => {
        await recusa(
          cliente,
          () =>
            cliente.query(
              `select * from public.registrar_revisao(
                 $1, $2, 'fsrs', current_date + 3, 3::smallint, 0.8::numeric)`,
              [aluno, topico],
            ),
          /sessao_obrigatoria/,
        );
      });

      const { rows: eventos } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_evento where user_id = $1",
        [aluno],
      );
      const { rows: agendas } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_agenda where user_id = $1",
        [aluno],
      );
      expect(eventos[0].n).toBe("0");
      expect(agendas[0].n).toBe("0");
    });
  });

  it("sessao propria nao aceita topico que nao aparece nas tentativas", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const sessao = await criarSessao(cliente, aluno, "revisao");
      const questao = await questaoParaResponder(cliente);
      const topicoAlheio = await criarTopico(cliente);

      await inserirTentativa(cliente, questao, {
        user_id: aluno,
        sessao_id: sessao,
        contexto: "revisao",
        correta: true,
      });
      await cliente.query(
        "update public.sessoes set encerrada_em = now() where id = $1",
        [sessao],
      );

      await comoAluno(cliente, aluno, async () => {
        await recusa(
          cliente,
          () =>
            cliente.query(
              `select * from public.registrar_revisao(
                 $1, $2, 'fsrs', current_date + 3, 3::smallint, 0.8::numeric,
                 null, 0, $3)`,
              [aluno, topicoAlheio, sessao],
            ),
          /topico_invalido/,
        );
      });

      const { rows: eventos } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_evento where user_id = $1",
        [aluno],
      );
      const { rows: agendas } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_agenda where user_id = $1",
        [aluno],
      );
      expect(eventos[0].n).toBe("0");
      expect(agendas[0].n).toBe("0");
    });
  });

  it("o job, sem sessao, continua podendo agendar por qualquer aluno", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      // `auth.uid()` nulo = job ou script (AD-035). A amarra do G1 nao pode
      // fechar este caminho, que e o legitimo do recalculo e da SPEC 13.
      const { rows } = await cliente.query<{ due: string }>(
        `select due from public.registrar_revisao(
           $1, $2, 'fsrs', current_date + 3, 3::smallint, 0.8::numeric)`,
        [aluno, topico],
      );
      expect(rows).toHaveLength(1);
    });
  });

  it("conteúdo novo agenda amanhã sem criar falso evento de revisão", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({});
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);
      const sessao = await criarSessao(cliente, aluno, "treino");
      await cliente.query(
        "update public.sessoes set encerrada_em = now() where id = $1",
        [sessao],
      );

      const resultado = await agendarRevisao(
        {
          userId: aluno,
          topicoId: topico,
          percentualAcerto: 0.1,
          primeiraRevisao: true,
          sessaoId: sessao,
          agora: HOJE,
        },
        supabaseNaTransacao(cliente),
      );

      expect(diasEntre(resultado.due, HOJE)).toBe(1);
      const { rows: eventos } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_evento where user_id = $1",
        [aluno],
      );
      expect(eventos[0].n).toBe("0");
    });
  });

  it("retry do mesmo bloco nao duplica evento nem agenda", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({});
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);
      const sessao = await criarSessao(cliente, aluno, "revisao");
      await cliente.query(
        "update public.sessoes set encerrada_em = now() where id = $1",
        [sessao],
      );
      const supabase = supabaseNaTransacao(cliente);

      const primeira = await agendarRevisao(
        {
          userId: aluno,
          topicoId: topico,
          percentualAcerto: 0.8,
          sessaoId: sessao,
          agora: HOJE,
        },
        supabase,
      );
      const segunda = await agendarRevisao(
        {
          userId: aluno,
          topicoId: topico,
          percentualAcerto: 0.2,
          sessaoId: sessao,
          agora: new Date("2026-08-25T12:00:00Z"),
        },
        supabase,
      );

      expect(segunda.due).toEqual(primeira.due);
      const { rows: eventos } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_evento where user_id = $1",
        [aluno],
      );
      const { rows: agendas } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.revisao_agenda where user_id = $1",
        [aluno],
      );
      expect(eventos[0].n).toBe("1");
      expect(agendas[0].n).toBe("1");
    });
  });

  it("percentual fora de 0 a 1 e recusado antes de tocar o banco", async () => {
    await comTransacaoRevertida(async (cliente) => {
      configFixa({});
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      await expect(
        agendarRevisao(
          { userId: aluno, topicoId: topico, percentualAcerto: 1.4, agora: HOJE },
          supabaseNaTransacao(cliente),
        ),
      ).rejects.toThrow(/fora de 0 a 1/);

      expect(await agendaDe(cliente, aluno, topico)).toBeNull();
    });
  });
});
