import { expect, it } from "vitest";

import { inserirQuestao } from "./acervo";
import { comTransacaoSemPerfilConcurso } from "./conexao";
import {
  criarMateria,
  criarPerfil,
  criarProvaMedida,
  lerTopicos,
  recalcular,
} from "./medicao";
import { descreveComBanco } from "./setup";

/**
 * `recalcula_raiox` — o que o AD-138 preservou.
 *
 * Este arquivo era escrito contra a formula revogada, em que o denominador era
 * o acervo e a questao publicada era a unidade de medida. O que sobrevive
 * intacto — e continua sendo verificado aqui — sao os tres mecanismos do
 * AD-056, que mudaram de lugar mas nao de forma:
 *
 *   * o **decaimento por ano**, que agora pondera a media entre provas;
 *   * o **amortecimento por amostra**, que agora tem como ancora a media
 *     daquela materia;
 *   * a **idempotencia** e o silencio sobre `tentativas` (RAIOX-14).
 *
 * A formula em dois niveis em si esta em `spec39-raiox-dois-niveis.test.ts`.
 */

descreveComBanco("recalcula_raiox — fonte da medicao", () => {
  it("mede pela etiqueta do item, e a questao do acervo nao move linha", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const materia = await criarMateria(cliente, 2);
      const { perfilId, orgao } = await criarPerfil(cliente, materia.topicos);

      await criarProvaMedida(cliente, {
        orgao,
        ano: 2025,
        blocos: [{ materiaId: materia.materiaId, itens: 4 }],
        etiquetas: {
          1: materia.topicos[0],
          2: materia.topicos[0],
          3: materia.topicos[0],
          4: materia.topicos[1],
        },
      });

      expect(await recalcular(cliente)).toBe(2);
      const antes = await lerTopicos(cliente, perfilId);
      const porTopico = new Map(antes.map((linha) => [linha.topico_id, linha]));

      expect(porTopico.get(materia.topicos[0])!.n_questoes).toBe(3);
      expect(porTopico.get(materia.topicos[1])!.n_questoes).toBe(1);

      // Publicar questao real do mesmo assunto nao desloca nada: quem mede e a
      // etiqueta, e ela ja contou aquele item uma vez.
      await inserirQuestao(cliente, {
        topico_id: materia.topicos[1],
        numero: 9,
        status: "publicada",
      });
      await recalcular(cliente);
      expect(await lerTopicos(cliente, perfilId)).toEqual(antes);

      const { rows: funcao } = await cliente.query<{ definicao: string }>(
        "select pg_get_functiondef('public.recalcula_raiox(date)'::regprocedure) as definicao",
      );
      expect(funcao[0].definicao).not.toMatch(/\btentativas\b/);
    });
  });
});

descreveComBanco("recalcula_raiox — decaimento e tendência", () => {
  it("dá mais peso ao recente e produz as três tendências", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      // Uma matéria, três assuntos: subindo, caindo e sem item nenhum.
      const materia = await criarMateria(cliente, 3);
      const [subindo, caindo, parado] = materia.topicos;
      const { perfilId, orgao } = await criarPerfil(cliente, materia.topicos);

      // Janela recente (referência 2026, 3 anos): 2024–2026.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2025,
        cargo: "Escriturario",
        blocos: [{ materiaId: materia.materiaId, itens: 10 }],
        etiquetas: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            i + 1,
            i < 8 ? subindo : caindo,
          ] as const),
        ),
      });
      // Janela anterior: 2021–2023. A proporção se inverte.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2022,
        cargo: "Agente Comercial",
        blocos: [{ materiaId: materia.materiaId, itens: 10 }],
        etiquetas: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            i + 1,
            i < 2 ? subindo : caindo,
          ] as const),
        ),
      });

      await recalcular(cliente, "2026-01-15");
      const porTopico = new Map(
        (await lerTopicos(cliente, perfilId)).map((linha) => [linha.topico_id, linha]),
      );

      // O decaimento por ano dá mais voz à prova de 2025 do que à de 2022:
      // as duas proporções são simétricas, e o desempate é o tempo.
      expect(Number(porTopico.get(subindo)!.peso)).toBeGreaterThan(
        Number(porTopico.get(caindo)!.peso),
      );
      expect(porTopico.get(subindo)!.tendencia).toBe("subindo");
      expect(porTopico.get(caindo)!.tendencia).toBe("caindo");
      // Sem item em nenhuma das duas janelas não há direção a afirmar.
      expect(porTopico.get(parado)!.tendencia).toBe("estavel");
    });
  });
});

descreveComBanco("recalcula_raiox — amortecimento e idempotência", () => {
  it("puxa amostra pequena para a média da matéria e dá média ao assunto sem item", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const materia = await criarMateria(cliente, 3);
      const [pequeno, outro, semItem] = materia.topicos;
      const { perfilId, orgao } = await criarPerfil(cliente, materia.topicos);

      // 6 itens medidos: 4 de um assunto, 2 de outro, nenhum do terceiro.
      // n_m = 6 < piso 10, então a linha nasce rotulada de pouca amostra.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2025,
        blocos: [{ materiaId: materia.materiaId, itens: 6 }],
        etiquetas: Object.fromEntries(
          Array.from({ length: 6 }, (_, i) => [i + 1, i < 4 ? pequeno : outro] as const),
        ),
      });

      await recalcular(cliente, "2026-01-15");
      const porTopico = new Map(
        (await lerTopicos(cliente, perfilId)).map((linha) => [linha.topico_id, linha]),
      );
      const linhaPequeno = porTopico.get(pequeno)!;
      const linhaSemItem = porTopico.get(semItem)!;
      // A âncora do amortecimento: a média DAQUELA matéria, 1/3.
      const media = 1 / 3;

      expect(linhaPequeno.n_questoes).toBe(4);
      expect(linhaPequeno.amostra_baixa).toBe(true);
      expect(Number(linhaPequeno.peso)).not.toBe(Number(linhaPequeno.taxa_bruta));
      expect(Math.abs(Number(linhaPequeno.peso) - media)).toBeLessThan(
        Math.abs(Number(linhaPequeno.taxa_bruta) - media),
      );

      // O assunto sem item não vai a zero: ele recebe a média da matéria,
      // amortecida — e diz que a amostra é baixa.
      expect(linhaSemItem.n_questoes).toBe(0);
      expect(Number(linhaSemItem.taxa_bruta)).toBe(0);
      expect(Number(linhaSemItem.peso)).toBeGreaterThan(0);
      expect(linhaSemItem.amostra_baixa).toBe(true);
    });
  });

  it("reroda com o mesmo resultado e não quebra com programa apontando para tópico inexistente", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const materia = await criarMateria(cliente, 2);
      const { perfilId, orgao } = await criarPerfil(cliente, materia.topicos);
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2025,
        blocos: [{ materiaId: materia.materiaId, itens: 4 }],
        etiquetas: {
          1: materia.topicos[0],
          2: materia.topicos[0],
          3: materia.topicos[1],
          4: materia.topicos[1],
        },
      });

      await recalcular(cliente, "2026-01-15");
      const antes = await lerTopicos(cliente, perfilId);
      await recalcular(cliente, "2026-01-15");
      expect(await lerTopicos(cliente, perfilId)).toEqual(antes);

      // O programa aceita JSON por contrato. Antes do AD-138 um UUID órfão
      // derrubava o job na FK da projeção; agora o programa é casado com
      // `topicos` na entrada e o órfão simplesmente não vira linha — o job de
      // um perfil não pode ser derrubado por configuração de outro.
      await cliente.query(
        "update public.perfil_concurso set programa_edital = $1::jsonb where id = $2",
        [JSON.stringify([...materia.topicos, crypto.randomUUID()]), perfilId],
      );
      await recalcular(cliente, "2026-01-15");
      expect(await lerTopicos(cliente, perfilId)).toEqual(antes);
    });
  });
});
