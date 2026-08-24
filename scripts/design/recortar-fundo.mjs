#!/usr/bin/env node
/**
 * Recorta o fundo de uma ilustracao gerada, deixando alpha no lugar.
 *
 * Ferramenta de design; nada em `src/` importa isto.
 *
 * Por que existe: o `gpt-image-2` ignora pedido de fundo transparente e sempre
 * devolve um creme claro que **nao e uniforme** (varia ~#FBF5E8 a #FDF6E8 no
 * mesmo quadro). Enquanto a arte pisa numa cor chapada da para disfarcar com
 * `mix-blend-mode: darken`, mas isso quebra em dois casos que a landing precisa:
 * camada sobre camada (parallax do GSAP) e arte com pecas claras — uma camisa
 * creme desapareceria junto com o fundo.
 *
 * Como funciona: **flood fill a partir das bordas**, nao limiar global. So vira
 * transparente o pixel de fundo que esta *conectado* a moldura, entao qualquer
 * area clara cercada de arte sobrevive. E o unico jeito de recortar sem comer o
 * branco do olho e da folha de papel.
 *
 *   node scripts/design/recortar-fundo.mjs --in arte.png [--out arte.png] [--tolerancia 26]
 *
 * `--tolerancia` e a distancia de cor (0-255) que ainda conta como fundo. Baixo
 * demais deixa moldura; alto demais come a arte.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`);
  if (i === -1) return padrao;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : padrao;
}

const entrada = arg("in");
if (!entrada) {
  console.error("uso: --in <arquivo.png> [--out <arquivo.png>] [--tolerancia 26]");
  process.exit(1);
}
const saida = arg("out", entrada);
const tolerancia = Number(arg("tolerancia", "26"));

const { data, info } = await sharp(entrada)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width: largura, height: altura, channels: canais } = info;
const total = largura * altura;

/** Cor de referencia do fundo: mediana dos quatro cantos, resistente a ruido. */
function corDoCanto(x, y) {
  const i = (y * largura + x) * canais;
  return [data[i], data[i + 1], data[i + 2]];
}
const cantos = [
  corDoCanto(2, 2),
  corDoCanto(largura - 3, 2),
  corDoCanto(2, altura - 3),
  corDoCanto(largura - 3, altura - 3),
];
const fundo = [0, 1, 2].map((c) => {
  const valores = cantos.map((k) => k[c]).sort((a, b) => a - b);
  return Math.round((valores[1] + valores[2]) / 2);
});

const distancia = (i) =>
  Math.max(
    Math.abs(data[i] - fundo[0]),
    Math.abs(data[i + 1] - fundo[1]),
    Math.abs(data[i + 2] - fundo[2]),
  );

/*
 * BFS com pilha explicita e nao recursao: 1.5M de pixels estouraria a pilha de
 * chamadas do Node muito antes de terminar.
 */
const ehFundo = new Uint8Array(total);
const pilha = [];

for (let x = 0; x < largura; x++) {
  pilha.push(x, x + (altura - 1) * largura);
}
for (let y = 0; y < altura; y++) {
  pilha.push(y * largura, largura - 1 + y * largura);
}

while (pilha.length > 0) {
  const p = pilha.pop();
  if (ehFundo[p]) continue;
  if (distancia(p * canais) > tolerancia) continue;

  ehFundo[p] = 1;

  const x = p % largura;
  const y = (p - x) / largura;
  if (x > 0) pilha.push(p - 1);
  if (x < largura - 1) pilha.push(p + 1);
  if (y > 0) pilha.push(p - largura);
  if (y < altura - 1) pilha.push(p + largura);
}

/*
 * Suavizacao da borda. Sem isto sobra um halo creme de um pixel em volta de toda
 * a arte, que e exatamente o defeito que este script existe para eliminar: o
 * pixel de transicao e meio fundo, meio arte, e cortar em degrau o denuncia.
 *
 * O pixel vizinho de fundo entra com alpha proporcional a quanto ele ja se
 * afastou da cor do fundo.
 */
let recortados = 0;
for (let p = 0; p < total; p++) {
  const i = p * canais;
  if (ehFundo[p]) {
    data[i + 3] = 0;
    recortados++;
    continue;
  }

  const x = p % largura;
  const y = (p - x) / largura;
  const vizinhoDeFundo =
    (x > 0 && ehFundo[p - 1]) ||
    (x < largura - 1 && ehFundo[p + 1]) ||
    (y > 0 && ehFundo[p - largura]) ||
    (y < altura - 1 && ehFundo[p + largura]);

  if (vizinhoDeFundo) {
    const d = distancia(i);
    if (d < tolerancia * 2) {
      data[i + 3] = Math.round(255 * (d / (tolerancia * 2)));
    }
  }
}

fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
await sharp(data, { raw: { width: largura, height: altura, channels: canais } })
  .png({ compressionLevel: 9 })
  .toFile(saida);

const porcento = ((recortados / total) * 100).toFixed(1);
console.log(
  `${saida}  fundo #${fundo.map((c) => c.toString(16).padStart(2, "0")).join("")} · ${porcento}% recortado · ${(fs.statSync(saida).size / 1024).toFixed(0)} KB`,
);
