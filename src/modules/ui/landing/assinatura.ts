import { entradaDoBloco } from "./dia";
import {
  FILA_DE_REVISAO,
  planoDe,
  TEMPO_PADRAO,
  totalDeQuestoes,
  type BlocoDoPlano,
  type PlanoDoDia,
  type TempoDoDia,
} from "./plano-do-dia";

/* ==========================================================================
   Comportamento proprio da landing.

   Nada aqui toca `scrollcraft.js`. O motor publica `--sc-p` no elemento do ato
   a cada quadro; este arquivo le esse numero para publicar o estado desenhado
   do pico e liga a unica interacao que nao e rolagem: o dial do dia.

   Tres coisas:
     1. Barra    — progresso e a sombra que so aparece quando ela flutua.
     2. Assinatura — o plano do dia, o anel e a fila se refazem no dial.
     3. Contador — o total em pt-BR, que o contador do motor nao formata.

   Os dados dos tres planos vivem em `plano-do-dia.ts`. O servidor e este
   controlador leem a mesma fonte: o no-JS e o clique nunca mostram planos
   diferentes.
   ========================================================================== */

const SVG_NS = "http://www.w3.org/2000/svg";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/*
 * O motor escreve `--sc-p` com `setProperty`, entao o valor esta no style
 * inline. Ler dali evita um `getComputedStyle` por elemento por quadro.
 */
function progressoDe(el: HTMLElement | null): number {
  if (!el) return 0;
  return parseFloat(el.style.getPropertyValue("--sc-p")) || 0;
}

function tempoDe(valor: string | undefined): TempoDoDia | null {
  switch (Number(valor)) {
    case 30:
      return 30;
    case 60:
      return 60;
    case 120:
      return 120;
    default:
      return null;
  }
}

type ElementosDoDia = {
  secao: HTMLElement;
  palco: HTMLElement;
  lista: HTMLOListElement;
  arcos: SVGGElement | null;
  total: HTMLElement | null;
  blocos: HTMLElement | null;
  minutos: HTMLElement | null;
  fila: HTMLUListElement | null;
  radios: HTMLInputElement[];
};

function encontrarElementosDoDia(): ElementosDoDia | null {
  const secao = document.querySelector<HTMLElement>(".secao--dia");
  const lista = secao?.querySelector<HTMLOListElement>("[data-plano]");
  const palco = secao?.querySelector<HTMLElement>("[data-sc-stage]");
  const radios = secao
    ? Array.from(
        secao.querySelectorAll<HTMLInputElement>(
          'input[type="radio"][name="tempo-do-dia"]',
        ),
      )
    : [];

  if (!secao || !palco || !lista || radios.length === 0) return null;

  return {
    secao,
    palco,
    lista,
    arcos: palco.querySelector<SVGGElement>("[data-anel-arcos]"),
    total: palco.querySelector<HTMLElement>("[data-plano-total]"),
    blocos: palco.querySelector<HTMLElement>("[data-plano-blocos]"),
    minutos: palco.querySelector<HTMLElement>("[data-plano-minutos]"),
    fila: document.querySelector<HTMLUListElement>("[data-fila]"),
    radios,
  };
}

function criarBloco(bloco: BlocoDoPlano, indice: number, total: number): HTMLLIElement {
  const item = document.createElement("li");
  item.className = `bloco${bloco.revisao ? " bloco--revisao" : ""}`;
  item.style.setProperty("--em", entradaDoBloco(indice, total).toFixed(3));

  const rotulo = document.createElement("p");
  rotulo.className = "bloco__k";
  rotulo.textContent = bloco.acao;

  const topico = document.createElement("p");
  topico.className = "bloco__t";
  topico.textContent = bloco.topico;

  const motivo = document.createElement("p");
  motivo.className = "bloco__m";
  motivo.textContent = bloco.descricao;

  const quantidade = document.createElement("p");
  quantidade.className = "bloco__n";
  quantidade.append(String(bloco.questoes), " ");
  const unidade = document.createElement("span");
  unidade.textContent = "questões";
  quantidade.append(unidade);

  item.append(rotulo, topico, motivo, quantidade);

  return item;
}

function criarArco(indice: number, total: number): SVGCircleElement {
  const fatia = 100 / total;
  const arco = Math.max(fatia - 4, 4);
  const circulo = document.createElementNS(SVG_NS, "circle");

  circulo.setAttribute("class", "anel__arco");
  circulo.setAttribute("cx", "60");
  circulo.setAttribute("cy", "60");
  circulo.setAttribute("r", "52");
  circulo.setAttribute("pathLength", "100");
  circulo.setAttribute(
    "stroke-dasharray",
    `${arco.toFixed(2)} ${(100 - arco).toFixed(2)}`,
  );
  circulo.setAttribute("stroke-dashoffset", (-indice * fatia).toFixed(2));
  circulo.style.setProperty("--em", entradaDoBloco(indice, total).toFixed(3));

  return circulo;
}

function criarItemDaFila(itemDaFila: { topico: string; dias: number }): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "fila__item";

  const topico = document.createElement("span");
  topico.className = "fila__t";
  topico.textContent = itemDaFila.topico;

  const dias = document.createElement("span");
  dias.className = "fila__d";
  dias.textContent = `${itemDaFila.dias} dias`;

  item.append(topico, dias);
  return item;
}

/**
 * Desenha um plano inteiro de uma vez.
 *
 * A troca e deliberadamente atomica para o leitor: blocos, anel, contagem e
 * fila mudam juntos. O `--sc-p` que o motor ja publicou no ato continua no
 * lugar, entao os blocos novos entram no ponto correto da narrativa em vez de
 * nascerem como uma segunda animacao independente.
 */
function desenharPlano(dia: ElementosDoDia, plano: PlanoDoDia): void {
  const quantidadeDeBlocos = plano.blocos.length;
  const blocos = plano.blocos.map((bloco, indice) =>
    criarBloco(bloco, indice, quantidadeDeBlocos),
  );
  dia.lista.replaceChildren(...blocos);

  if (dia.arcos) {
    dia.arcos.replaceChildren(
      ...plano.blocos.map((_, indice) => criarArco(indice, quantidadeDeBlocos)),
    );
  }

  const fila = FILA_DE_REVISAO[plano.minutos] ?? [];
  dia.fila?.replaceChildren(...fila.map(criarItemDaFila));

  if (dia.total) dia.total.textContent = String(totalDeQuestoes(plano));
  if (dia.blocos) dia.blocos.textContent = String(quantidadeDeBlocos);
  if (dia.minutos) dia.minutos.textContent = String(plano.minutos);

  dia.secao.dataset.tempoDoDia = String(plano.minutos);
}

/*
 * Estado compacto do que realmente esta pintado no pico. O harness da
 * scrollcraft usa este atributo para nao tratar um palco fixo customizado
 * como uma tela parada. Nao publicamos `p` cru: cada numero e a opacidade
 * desenhada de um bloco/arco, arredondada para a mesma escala que o olho ve.
 */
function publicarEstadoDoDia(
  dia: ElementosDoDia,
  plano: PlanoDoDia,
  reduz: boolean,
): void {
  const p = reduz ? 1 : progressoDe(dia.secao);
  const opacidadeDe = (elemento: Element): string => {
    const em = parseFloat((elemento as HTMLElement).style.getPropertyValue("--em")) || 0;
    return String(Math.round((reduz ? 1 : clamp01((p - em) * 8)) * 10));
  };
  const blocos = Array.from(dia.lista.querySelectorAll<HTMLElement>(".bloco"))
    .map(opacidadeDe)
    .join("");
  const arcos = dia.arcos
    ? Array.from(dia.arcos.querySelectorAll<SVGCircleElement>(".anel__arco"))
        .map(opacidadeDe)
        .join("")
    : "";

  dia.palco.dataset.scVerifyState = [
    plano.minutos,
    totalDeQuestoes(plano),
    blocos,
    arcos,
  ].join("|");

  const palco = dia.palco.getBoundingClientRect();
  const visivel = palco.bottom > 0 && palco.top < window.innerHeight;
  dia.palco.dataset.scVerifyHold =
    visivel && (reduz || p >= 0.98) ? "true" : "false";
}

/** Liga o comportamento e devolve como desligar. */
export function ligarComportamento(): () => void {
  const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raiz = document.documentElement;
  const barra = document.querySelector<HTMLElement>(".barra");
  const dia = encontrarElementosDoDia();
  let planoAtual = dia
    ? planoDe(tempoDe(dia.radios.find((radio) => radio.checked)?.value) ?? TEMPO_PADRAO)
    : null;
  let vivo = true;

  /* ========================================================== 1 · BARRA == */
  function desenharBarra() {
    const alcance = raiz.scrollHeight - window.innerHeight;
    raiz.style.setProperty(
      "--progresso",
      alcance > 0 ? (window.scrollY / alcance).toFixed(4) : "0",
    );
    barra?.classList.toggle("barra--flutua", window.scrollY > 8);

    /* A barra nao existe sobre o heroi. O gatilho e a altura do proprio ato,
       nao um numero escrito a mao: mudar o span nao desalinha o chrome. */
    const heroi = document.querySelector<HTMLElement>(".secao--heroi");
    const fimDoHeroi = heroi ? heroi.offsetTop + heroi.offsetHeight * 0.72 : 0;
    barra?.classList.toggle("barra--oculta", window.scrollY < fimDoHeroi);
  }

  /* ======================================================== 2 · ASSINATURA == */
  function desenharAssinatura() {
    if (!dia || !planoAtual) return;
    publicarEstadoDoDia(dia, planoAtual, reduz);
  }

  function aoMudarTempo() {
    if (!dia) return;
    const selecionado = dia.radios.find((radio) => radio.checked);
    const tempo = tempoDe(selecionado?.value);
    if (!tempo || planoAtual?.minutos === tempo) return;

    planoAtual = planoDe(tempo);
    desenharPlano(dia, planoAtual);
    pedir();
  }

  /* ================================================== 3 · CONTADOR PT-BR ==
     O contador do motor separa milhar com virgula. 1.395 em portugues leva
     ponto, entao este e nosso. Dispara uma vez, na entrada, e nao re-esconde
     ao subir: conteudo que some quando o leitor volta e defeito. */
  let observador: IntersectionObserver | null = null;

  function contador() {
    const el = document.querySelector<HTMLElement>("[data-conta]");
    if (!el) return;
    const alvo = parseInt(el.dataset.conta ?? "0", 10);
    if (!Number.isFinite(alvo) || alvo <= 0) return;

    const formatar = new Intl.NumberFormat("pt-BR");
    if (reduz) {
      el.textContent = formatar.format(alvo);
      return;
    }

    el.textContent = formatar.format(0);
    observador = new IntersectionObserver(
      (entradas, obs) => {
        if (!entradas[0].isIntersecting) return;
        obs.disconnect();
        const inicio = performance.now();
        const duracao = 1100;
        const passo = (agora: number) => {
          if (!vivo) return;
          const t = clamp01((agora - inicio) / duracao);
          el.textContent = formatar.format(
            Math.round((1 - Math.pow(1 - t, 3)) * alvo),
          );
          if (t < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      },
      { threshold: 0.6 },
    );
    observador.observe(el);
  }

  /* =============================================================== LOOP == */
  let pendente = false;
  function quadro() {
    pendente = false;
    if (!vivo) return;
    desenharBarra();
    desenharAssinatura();
  }
  function pedir() {
    if (pendente || !vivo) return;
    pendente = true;
    requestAnimationFrame(quadro);
  }
  function aoRedimensionar() {
    pedir();
  }

  function iniciar() {
    if (!vivo) return;
    if (dia && planoAtual) {
      dia.radios.forEach((radio) => radio.addEventListener("change", aoMudarTempo));
      desenharAssinatura();
    }
    contador();
    quadro();
  }

  if (document.fonts?.ready) void document.fonts.ready.then(iniciar);
  else iniciar();

  window.addEventListener("scroll", pedir, { passive: true });
  window.addEventListener("resize", aoRedimensionar);

  return () => {
    vivo = false;
    window.removeEventListener("scroll", pedir);
    window.removeEventListener("resize", aoRedimensionar);
    dia?.radios.forEach((radio) => radio.removeEventListener("change", aoMudarTempo));
    observador?.disconnect();
    dia?.palco.removeAttribute("data-sc-verify-state");
    dia?.palco.removeAttribute("data-sc-verify-hold");
  };
}
