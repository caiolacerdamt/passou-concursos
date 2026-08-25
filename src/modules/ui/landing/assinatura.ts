import type { TopicoFrequente } from "@/modules/acervo";

/* ==========================================================================
   Comportamento próprio da landing.

   Nada aqui toca `scrollcraft.js`. O motor publica `--sc-p` no elemento do ato
   a cada quadro; este arquivo só lê esse número e desenha em cima dele. É a
   regra da skill: comportamento sob medida mora na página, não no motor.

   Três coisas:
     1. Barra    — progresso e a sombra que só aparece quando ela flutua.
     2. O PICO   — os chips que desabam e se ordenam por frequência real.
     3. Contador — o total em pt-BR, que o contador do motor não formata.
   ========================================================================== */

/** Quantos tópicos ganham rótulo, número e verde no gráfico. */
const TOPO = 12;

/** Base fixa do chip, em px: toda variação de tamanho é escala, nunca layout. */
const BASE_W = 200;
const BASE_H = 24;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** LCG determinístico: a mesma pilha em todo carregamento e em toda captura. */
function semente(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function encurtar(nome: string, teto: number): string {
  return nome.length > teto ? `${nome.slice(0, teto - 1)}…` : nome;
}

/*
 * O motor escreve `--sc-p` com `setProperty`, então o valor está no style
 * inline. Ler dali evita um `getComputedStyle` por elemento por quadro.
 */
function progressoDe(el: HTMLElement | null): number {
  if (!el) return 0;
  return parseFloat(el.style.getPropertyValue("--sc-p")) || 0;
}

type Rgb = [number, number, number];

/** Lê um token do `@theme` já resolvido. Uma fonte de cor só, a do CSS. */
function corDoToken(estilo: CSSStyleDeclaration, nome: string, queda: Rgb): Rgb {
  const valor = estilo.getPropertyValue(nome).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(valor);
  if (!hex) return queda;
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function misturar(a: Rgb, b: Rgb, t: number): string {
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(
    lerp(a[1], b[1], t),
  )},${Math.round(lerp(a[2], b[2], t))})`;
}

type Chip = {
  el: HTMLElement;
  barra: HTMLElement;
  rotulo: HTMLElement;
  numero: HTMLElement;
  valor: number;
  destaque: boolean;
  /** Fatia da janela que este chip espera antes de começar a própria viagem. */
  atraso: number;
  /** Último passo de cor escrito. Evita 86 escritas de cor por quadro. */
  passoDaCor: number;
  /** Escala do nome enquanto ele está escrito no papel: cabe ou não cabe. */
  escalaNoPapel: number;
  /* pilha */
  px: number;
  py: number;
  prot: number;
  psx: number;
  psy: number;
  /* posto */
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  fsx: number;
  fsy: number;
  numX: number;
};

type Layout = {
  sedimentoFimY: number;
  rotuloX: number;
  /** Altura do eixo: as doze linhas do gráfico, e só elas. */
  eixoH: number;
  /** Tela estreita: a pilha não comporta rótulo legível. */
  estreito: boolean;
};

/* ---------------------------------------------------------------- CASCATA --
   A viagem inteira acontecia com um `q` só: os 86 papéis saíam juntos e
   chegavam juntos. Visto de fora isso não é ordenação, é teletransporte — o
   leitor vê um monte virar outro monte e não vê o que aconteceu no meio.

   Agora cada chip carrega um `atraso` dentro da mesma janela de rolagem. Os
   doze maiores caem em ordem de tamanho, um depois do outro, e a cauda desaba
   por último. É a mesma quantidade de rolagem; o que mudou é que agora dá para
   ver a regra sendo aplicada, que é a única coisa que a seção precisa mostrar.
   -------------------------------------------------------------------------- */

/** Onde a viagem começa e quanto de `p` ela ocupa. */
const INICIO = 0.1;
const JANELA = 0.62;
/** Maior atraso possível. O que sobra (1 - ATRASO_MAX) é a viagem de um chip. */
const ATRASO_MAX = 0.62;

/**
 * Liga o comportamento e devolve como desligar.
 *
 * Devolver o desligamento não é cerimônia de React: sem ele, o efeito rodando
 * duas vezes (Strict Mode, navegação de volta) deixaria dois laços desenhando
 * os mesmos 86 elementos.
 */
export function ligarComportamento(
  topicos: readonly TopicoFrequente[],
): () => void {
  const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raiz = document.documentElement;
  const barra = document.querySelector<HTMLElement>(".barra");
  const secaoPico = document.querySelector<HTMLElement>(".secao--pico");
  const campo = document.getElementById("raiox");

  let chips: Chip[] = [];
  let eixo: HTMLElement | null = null;
  let nota: HTMLElement | null = null;
  let layout: Layout | null = null;
  let vivo = true;

  /* ========================================================== 1 · BARRA == */
  function desenharBarra() {
    const alcance = raiz.scrollHeight - window.innerHeight;
    raiz.style.setProperty(
      "--progresso",
      alcance > 0 ? (window.scrollY / alcance).toFixed(4) : "0",
    );
    /* Sombra só quando há camada real flutuando sobre conteúdo. No topo a
       barra encosta no herói, e sombra ali é decoração. */
    barra?.classList.toggle("barra--flutua", window.scrollY > 8);
  }

  /* =========================================================== 2 · PICO ==
     O movimento assinatura.

     Cada chip é um tópico real do edital com a contagem real de questões,
     vinda do acervo. Por isso é DOM e não vídeo: o texto precisa ser texto e
     o número precisa poder mudar quando a próxima prova entrar.

     Todo o desenho é `transform` e `background-color`. Nenhuma escrita em
     width/height/top/left — 86 elementos por quadro só cabem em 16ms se
     nenhum deles pedir layout. */
  function construir() {
    if (!campo || topicos.length === 0) return;
    campo.textContent = "";
    chips = topicos.map((topico, i) => {
      const el = document.createElement("div");
      el.className = "chip";

      const barraDoChip = document.createElement("span");
      barraDoChip.className = "chip__b";

      const rotulo = document.createElement("span");
      rotulo.className = "chip__l";
      rotulo.textContent = encurtar(topico.topico, 30);

      const numero = document.createElement("span");
      numero.className = "chip__n";
      numero.textContent = String(topico.questoes);

      el.append(barraDoChip, rotulo, numero);
      campo.append(el);

      return {
        el,
        barra: barraDoChip,
        rotulo,
        numero,
        valor: topico.questoes,
        destaque: i < TOPO,
        /* Os doze caem em ordem de tamanho; a cauda desaba depois, com uma
           dispersão pequena para não parecer uma cortina única descendo. */
        atraso:
          i < TOPO ? (i / TOPO) * 0.4 : 0.36 + semente(i + 77) * 0.26,
        passoDaCor: -1,
        escalaNoPapel: 0.5,
        px: 0,
        py: 0,
        prot: 0,
        psx: 1,
        psy: 1,
        fx: 0,
        fy: 0,
        fw: 0,
        fh: 0,
        fsx: 1,
        fsy: 1,
        numX: 0,
      };
    });

    /* O eixo. Sem ele os doze retângulos verdes flutuam no breu e não leem
       como gráfico; com ele o olho ganha a linha de onde tudo parte. Ele se
       desenha conforme os doze chegam, então também é o sinal de que a
       ordenação terminou. */
    eixo = document.createElement("span");
    eixo.className = "raiox__eixo";
    campo.append(eixo);

    nota = document.createElement("p");
    nota.className = "raiox__nota";
    campo.append(nota);
  }

  /** Recalcula em resize, nunca por quadro. */
  function medir() {
    if (!campo || chips.length === 0) return;
    const caixa = campo.getBoundingClientRect();
    const w = caixa.width;
    const h = caixa.height;
    if (!w || !h) return;

    const estreito = window.innerWidth < 900;
    const linhaH = Math.min(estreito ? 24 : 44, (h * 0.7) / TOPO);
    const barraMaxW = w * (estreito ? 0.38 : 0.3);
    const maiorN = topicos[0].questoes;
    /* Rótulo e número em colunas FIXAS, não colados na ponta de cada barra.
       Seguindo a barra eles ficam serrilhados e o olho perde a linha de
       leitura — que é justamente o que um gráfico existe para dar. */
    const rotuloX = barraMaxW + (estreito ? 14 : 28);
    const numeroX = estreito ? w - 26 : rotuloX + 310;

    /* Sedimento: os tópicos restantes, com largura proporcional ao número
       real de questões. Somam massa visual honesta em vez de sumirem. */
    const cauda = topicos.slice(TOPO);
    const somaCauda = cauda.reduce((soma, t) => soma + t.questoes, 0);
    const linhas = estreito ? 5 : 3;
    const k = Math.max(
      0.5,
      (linhas * w - cauda.length * 5) / Math.max(somaCauda, 1),
    );
    const sedimentoY0 = linhaH * TOPO + (estreito ? 20 : 40);
    const sedimentoH = estreito ? 4 : 6;
    let cx = 0;
    let cy = 0;

    chips.forEach((c, i) => {
      /* No estreito o número fica colado na borda direita, e um rótulo de 30
         caracteres esbarra nele: "Proporções, regra de três e p…" encostava no
         "30". O teto do nome é medida de layout, então mora aqui e é refeito a
         cada resize, não escrito uma vez na construção. */
      c.rotulo.textContent = encurtar(topicos[i].topico, estreito ? 20 : 30);

      // ---- estado inicial: a pilha, espalhada na largura toda
      const s1 = semente(i);
      const s2 = semente(i + 500);
      const s3 = semente(i + 900);
      /* Papel, não confete: retângulos grandes o bastante para lerem como
         folha solta. Miúdos demais viram ruído cinza e o "edital" some. */
      const pw = 78 + s3 * 62;
      const ph = estreito ? 18 : 26;
      c.px = s1 * Math.max(1, w - pw);
      c.py = h * 0.04 + s2 * (h * 0.52);
      c.prot = (s3 - 0.5) * 36;
      c.psx = pw / BASE_W;
      c.psy = ph / BASE_H;
      /* O nome tem que caber NO PAPEL. `offsetWidth` ignora transform, então
         esta é a largura do texto em escala 1; a divisão dá a escala em que
         ele para dentro da folha. Uma leitura de layout por chip, aqui e não
         por quadro — `medir()` só roda em resize. */
      const larguraDoNome = c.rotulo.offsetWidth || 1;
      c.escalaNoPapel = Math.min(
        0.62,
        Math.max(0.3, (pw - 14) / larguraDoNome),
      );

      // ---- estado final
      if (c.destaque) {
        c.fx = 0;
        c.fy = i * linhaH;
        c.fw = Math.max(10, (c.valor / maiorN) * barraMaxW);
        c.fh = linhaH - (estreito ? 6 : 12);
        c.numX = numeroX;
      } else {
        const largura = Math.max(7, c.valor * k);
        if (cx + largura > w) {
          cx = 0;
          cy += sedimentoH + 6;
        }
        c.fx = cx;
        c.fy = sedimentoY0 + cy;
        c.fw = largura;
        c.fh = sedimentoH;
        cx += largura + 5;
      }
      c.fsx = c.fw / BASE_W;
      c.fsy = c.fh / BASE_H;
    });

    layout = {
      sedimentoFimY: sedimentoY0 + cy + sedimentoH + 18,
      rotuloX,
      eixoH: linhaH * TOPO,
      estreito,
    };

    if (eixo) eixo.style.height = `${layout.eixoH.toFixed(1)}px`;

    if (nota) {
      nota.textContent = `Outros ${cauda.length} tópicos · ${somaCauda} questões`;
    }
  }

  /* Papel na pilha, verde vivo nas doze barras, oliva apagado no sedimento.
     A troca de cor acontece TARDE: primeiro o papel chega ao posto, depois
     vira dado. Trocar junto com o movimento embaralha as duas leituras e
     nenhuma das duas fica clara. */
  const estilo = getComputedStyle(document.documentElement);
  const PAPEL = corDoToken(estilo, "--color-pilha-papel", [231, 226, 211]);
  const VERDE = corDoToken(estilo, "--color-verde-vivo", [79, 139, 114]);
  const SEDIMENTO = corDoToken(estilo, "--color-pilha-sedimento", [74, 78, 66]);
  /* Duas cores para o MESMO rótulo: escuro enquanto ele está escrito sobre o
     papel creme, claro depois que ele sai para a coluna sobre o breu. Sem a
     troca, metade da viagem o nome do tópico fica ilegível — e o nome é a
     única coisa que explica o que são os 86 retângulos. */
  const TINTA_NO_PAPEL = corDoToken(estilo, "--color-breu", [25, 26, 21]);
  const TINTA_NO_BREU = corDoToken(estilo, "--color-breu-tinta", [243, 238, 226]);

  /** Onde o nome do tópico fica enquanto ainda é papel, em px da borda. */
  const RECUO_NO_PAPEL = 7;

  function desenharPico() {
    if (chips.length === 0 || !layout) return;
    const p = reduz ? 1 : progressoDe(secaoPico);

    const bruto = clamp01((p - INICIO) / JANELA);
    const viagem = 1 - ATRASO_MAX;
    /* Quanto do gráfico já existe. Serve para dois fins: desenhar o eixo e
       recuar a cauda enquanto os doze pousam — sem isso o papel que ainda não
       caiu passa POR CIMA das barras recém-formadas e some com os rótulos
       delas bem no quadro em que a ordenação fica visível. */
    const dozeProntos = clamp01((bruto - 0.28) / 0.44);

    for (const c of chips) {
      /* Viagem de UM chip: uma curva só, da pilha até o posto, com uma barriga
         para baixo no meio — é o "desabar". Separar em dois movimentos deixaria
         um degrau perceptível bem no quadro que precisa ser fluido. */
      const bl = clamp01((bruto - c.atraso) / viagem);
      const q = easeInOut(bl);
      const barriga = Math.sin(Math.PI * bl) * 64;
      /* A virada de barra é tarde DENTRO da viagem do próprio chip: ele chega,
         assenta e só então vira dado. Global, essa espera fazia os 86 virarem
         verde no mesmo quadro, o que embaralha as duas leituras. */
      const t = easeOut(clamp01((bl - 0.55) / 0.45));

      if (!c.destaque) {
        /* Recua, não some: a massa dos 74 continua sendo o argumento da
           seção. Ela volta ao cheio quando vira sedimento. */
        c.el.style.opacity = (1 - 0.5 * dozeProntos * (1 - t)).toFixed(3);
      }

      const x = lerp(c.px, c.fx, q);
      const y = lerp(c.py, c.fy, q) + barriga;
      const rot = lerp(c.prot, 0, q);
      c.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(
        1,
      )}px,0) rotate(${rot.toFixed(2)}deg)`;

      c.barra.style.transform = `scale(${lerp(c.psx, c.fsx, t).toFixed(
        4,
      )},${lerp(c.psy, c.fsy, t).toFixed(4)})`;

      /* Cor em 16 degraus e só quando o degrau muda. A olho nu é a mesma
         rampa; em escritas de estilo é uma ordem de grandeza a menos. */
      const passo = Math.round(t * 16);
      if (passo !== c.passoDaCor) {
        c.passoDaCor = passo;
        const tc = passo / 16;
        c.barra.style.backgroundColor = misturar(
          PAPEL,
          c.destaque ? VERDE : SEDIMENTO,
          tc,
        );
        if (!layout.estreito) {
          c.rotulo.style.color = misturar(
            TINTA_NO_PAPEL,
            TINTA_NO_BREU,
            clamp01((tc - 0.55) / 0.25),
          );
        }
      }

      /* O rótulo nasce ESCRITO NO PAPEL. Era isto que faltava: sem nome, os 86
         retângulos são confete e a ordenação não tem sujeito. Com nome, o
         leitor vê 86 tópicos do edital caírem e se ordenarem — que é a frase
         da seção, encenada. Em tela estreita o papel não comporta texto
         legível, então lá o rótulo só existe depois que vira linha do gráfico. */
      if (layout.estreito) {
        if (!c.destaque) continue;
        const op = clamp01((t - 0.5) / 0.4);
        c.rotulo.style.opacity = String(op);
        c.numero.style.opacity = String(op);
        c.rotulo.style.transform = `translate3d(${layout.rotuloX.toFixed(
          1,
        )}px,-50%,0)`;
        c.numero.style.transform = `translate3d(${c.numX.toFixed(1)}px,-50%,0)`;
        continue;
      }

      /* A saída para a coluna acontece na SEGUNDA metade de `t`, depois de a
         barra já ter virado verde. Assim o nome atravessa a barra ainda
         escuro — escuro sobre verde lê — e só troca de cor quando já está no
         breu. Mover e trocar de cor juntos deixa um trecho de cinza no meio,
         ilegível contra os dois fundos. */
      const tp = clamp01((t - 0.5) / 0.5);
      const escala = lerp(c.escalaNoPapel, 1, tp);
      const alvoX = c.destaque ? layout.rotuloX : RECUO_NO_PAPEL;
      c.rotulo.style.transform = `translate3d(${lerp(
        RECUO_NO_PAPEL,
        alvoX,
        tp,
      ).toFixed(1)}px,-50%,0) scale(${escala.toFixed(3)})`;
      /* Visível desde o repouso: é o nome no papel que transforma 86
         retângulos em 86 tópicos do edital. Escondê-lo até a viagem começar
         devolvia a pilha de confete que a seção existe para não ser.
         A cauda perde o nome ao virar sedimento: 74 rótulos empilhados em três
         linhas de 6px seriam uma mancha, não uma informação. */
      const visivel = clamp01(p / 0.05) * (c.destaque ? 1 : 1 - t);
      c.rotulo.style.opacity = (visivel * lerp(0.78, 1, tp)).toFixed(3);

      if (c.destaque) {
        c.numero.style.opacity = String(clamp01((t - 0.45) / 0.4));
        c.numero.style.transform = `translate3d(${c.numX.toFixed(1)}px,-50%,0)`;
      }
    }

    /* O eixo cresce com os doze: `bruto` menos o maior atraso da faixa de
       destaque, normalizado. Chega ao fim junto com a décima segunda barra. */
    if (eixo) {
      eixo.style.transform = `scaleY(${easeOut(dozeProntos).toFixed(3)})`;
      /* Só depois que a primeira barra pousou. Antes disso ele é um risco
         solto no breu, longe dos papéis, e lê como sujeira. */
      eixo.style.opacity = String(clamp01((bruto - 0.28) * 8));
    }

    if (nota) {
      nota.style.opacity = String(clamp01((p - 0.74) / 0.14));
      nota.style.transform = `translate3d(0,${layout.sedimentoFimY.toFixed(
        1,
      )}px,0)`;
    }
  }

  /* ================================================== 3 · CONTADOR PT-BR ==
     O contador do motor separa milhar com vírgula (padrão inglês). 1.395 em
     português leva ponto, então este é nosso. Dispara uma vez, na entrada, e
     não re-esconde ao subir: conteúdo que some quando o leitor volta é
     defeito, não efeito. */
  let observador: IntersectionObserver | null = null;
  let observadorDoCampo: ResizeObserver | null = null;

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
          el.textContent = formatar.format(Math.round(easeOut(t) * alvo));
          if (t < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      },
      { threshold: 0.6 },
    );
    observador.observe(el);
  }

  /* ================================================================ LOOP == */
  let pendente = false;
  function quadro() {
    pendente = false;
    if (!vivo) return;
    desenharBarra();
    desenharPico();
  }
  function pedir() {
    if (pendente || !vivo) return;
    pendente = true;
    requestAnimationFrame(quadro);
  }
  function aoRedimensionar() {
    medir();
    pedir();
  }

  function iniciar() {
    if (!vivo) return;
    construir();
    medir();
    contador();
    quadro();

    /*
     * A medida do gráfico depende da caixa do campo, e essa caixa só ganha
     * altura quando o motor fixa o palco: `.raiox` é `flex: 1 1 auto` dentro de
     * um palco que, antes de fixado, tem a altura do próprio conteúdo.
     *
     * Isto foi um defeito real do porte, e um que só a captura pegou: no
     * protótipo o motor montava num `<script>` síncrono, antes deste arquivo
     * rodar; aqui ele entra por `<Script>` depois da hidratação, então a
     * primeira medida caía num campo de altura zero, `medir()` desistia e os 86
     * chips ficavam empilhados no canto — o pico inteiro em branco.
     *
     * O conserto não é impor ordem entre os dois (frágil, e amarraria este
     * arquivo ao ciclo de vida do motor): é medir de novo quando a caixa muda
     * de tamanho, seja porque o motor fixou o palco, porque a fonte assentou ou
     * porque a janela mudou.
     */
    if (campo && typeof ResizeObserver !== "undefined") {
      observadorDoCampo = new ResizeObserver(() => {
        medir();
        pedir();
      });
      observadorDoCampo.observe(campo);
    }
  }

  /* O split de linhas do `kinetic` mede caixas de linha reais, e a medida do
     pico depende da métrica da fonte. Os dois têm que esperar a face carregar. */
  if (document.fonts?.ready) void document.fonts.ready.then(iniciar);
  else iniciar();

  window.addEventListener("scroll", pedir, { passive: true });
  window.addEventListener("resize", aoRedimensionar);

  return () => {
    vivo = false;
    window.removeEventListener("scroll", pedir);
    window.removeEventListener("resize", aoRedimensionar);
    observador?.disconnect();
    observadorDoCampo?.disconnect();
    if (campo) campo.textContent = "";
    chips = [];
    eixo = null;
    nota = null;
    layout = null;
  };
}
