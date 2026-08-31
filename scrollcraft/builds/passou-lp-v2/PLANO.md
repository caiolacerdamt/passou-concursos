# PLANO — landing v2

> **Leia junto:** a copy palavra por palavra de todos os 8 atos ja esta escrita em
> **`COPY.md`**, nesta mesma pasta. **Nao reescrever.** Este arquivo diz o que cada ato faz e
> como se move; o `COPY.md` diz o que cada ato fala.

Refatoracao visual da landing. O escopo e **uma pagina bonita, com movimento em toda secao**.
Cada secao vai ser mexida depois pelo dono; aqui esta o desenho e a mecanica de animacao.

Numeros na tela sao **placeholder**. Podem ser ficticios e genericos, e estao marcados no codigo
para serem faceis de achar e trocar. Nao ha ligacao com banco de dados nesta rodada.

Tres defeitos que originaram a refatoracao:

1. **A headline sumia.** Ja corrigido: `[data-sc-in]` nascia com `opacity: 0` e so o motor
   devolvia, entao "motor nao montou" e "pagina sem texto" eram o mesmo evento.
2. **A pagina era de um concurso so.** Copy nova, generica, sobre features e gatilhos.
3. **Faltava movimento.** Eram 7 secoes e so 2 tinham animacao de verdade; as outras 5 faziam um
   fade-in e acabou.

## Gramatica: filmic one-shot

O dono pediu **video scrubado ocupando a tela principal inteira, com a headline por cima, a
esquerda**. Isso e a primeira tela do filmic one-shot e e proibido nas outras sete gramaticas da
skill, entao a escolha esta feita por decisao dele, nao por gosto do autor.

## Portao de impressao digital

Contra a unica linha existente (`passou-lp`). Precisa diferir em 4 das 6; difere em 5.

| Dimensao | passou-lp | v2 | |
| --- | --- | --- | --- |
| Gramatica | chaptered editorial adaptada | filmic one-shot | ok |
| Chrome | barra fina opaca desde o topo | **sem barra sobre o video**; ela se materializa quando o heroi termina | ok |
| Heroi | `flow`, duas colunas, tipo cinetico | `scrub` em sangria, 121 quadros sob a rolagem | ok |
| Sequencia | 7 atos, 13,7vh, 2 `pin` | 8 atos, trilho lateral mais longo, 3 `pin` | ok |
| Fecho | `pin` resolvendo a tela com preco | o preço encerra a conversão; o rodapé vem depois | ok |
| Assinatura | o edital desaba | **o dia que se refaz** | ok |

## O movimento assinatura — "o dia que se refaz"

Um controle so, visivel a partir do fim do heroi: **quanto tempo voce tem hoje**, com `30 min`,
`1 h` e `2 h`, padrao `1 h`.

Mexeu nele e a pagina recalcula na frente do visitante: o plano do ato 4 ganha ou perde bloco, a
contagem de questoes muda, a fila de revisao do ato 6 se reordena, o anel do dia anda.

Roda de arrays escritos na propria pagina, com numeros placeholder. Vive em `assinatura.ts`,
lendo `--sc-p`. O motor nao e tocado. Precisa funcionar por teclado e ter foco visivel.

## A curva de sentimento

| Ato | Sentimento | O que na tela causa |
| --- | --- | --- |
| 1 O corredor | **Reconhecimento, depois alivio** | Paredes de prova empilhada sem fim para cima. A camera avanca e sobe ate uma mesa onde alguem estuda |
| 2 A pergunta de terca | **Desconforto** | A lista do edital correndo sem fim ao lado das falas |
| 3 Alguem contou | **Quieto** (silencio autoral) | Uma frase e um numero grande. Quase nada se move |
| 4 **O dia se monta** | **Alivio com controle** (PICO) | O plano se escreve sozinho, bloco a bloco, e o dial refaz tudo na mao dele |
| 5 A questao | **Concentracao** | Uma questao com etiqueta. A alternativa e escolhida. O carimbo cai |
| 6 O que volta | **Confianca** | O erro se desprende e entra numa linha do tempo: 3 dias, 9, 21 |
| 7 Por que aguenta | **Seguranca** | Trilho lateral de garantias, cada cartao um fato |
| 8 O preco | **Decisao** | Dois precos, garantia, links legais |

Nenhum sentimento se repete em atos vizinhos. O 3 e mais quieto que o 4 por construcao.

## O pico

O heroi **nao** e o pico: ele e a promessa. O pico e o ato 4, onde a maquina aparece — o dia
inteiro se montando e se refazendo sob o dial. Recebe o maior span depois do heroi e tem o
silencio do ato 3 antes dele.

> "Voce rola e o plano do dia se escreve sozinho. E tem um botao de quanto tempo voce tem hoje:
> mexe nele e a pagina inteira se refaz na sua frente."

## A tabela de score

**Total: 8 atos.** O ato 7 ganhou mais uma tela de viagem para o trilho lateral comportar cartões
maiores; o comprimento final é conferido pela captura do harness.

| # | Ato | Dispositivo | Span | Estado |
| --- | --- | --- | --- | --- |
| 1 | O corredor | `scrub` | **2.8** | construido |
| 2 | A pergunta de terca | `pin` + trilho | 1.6 | falta |
| 3 | Alguem contou | `flow` + `count` | 1.0 | falta |
| 4 | **O dia se monta** | `pin` + assinatura | 2.8 | falta |
| 5 | A questao | `pin` | 1.4 | falta |
| 6 | O que volta | `reveal` + `parallax` | 1.2 | falta |
| 7 | Por que aguenta | `pan` | 1.6 | construido |
| 8 | O preco | `flow` | 0.9 | falta |

Regras que precisam continuar valendo: seis familias distintas de dispositivo, nenhuma repetida
em atos vizinhos, **um** `scrub` so na pagina inteira, e o ato 4 com o maior span depois do heroi.


## O que cada ato mostra na tela

Descricao visual. O texto de cada um esta no `COPY.md`.

> **Nenhum ato daqui em diante precisa de geracao de imagem ou video.** Os atos 2 a 8 sao DOM,
> CSS e SVG, custo zero. Se durante a construcao alguem achar que um ato pede arte nova, isso e
> **decisao nova** e gasto novo, nao algo que este plano ja autorizou.

**1 · O corredor** (`scrub`, 2.8) — construido. Video em sangria: paredes de prova empilhada
subindo para fora do quadro, camera avancando e subindo ate chegar por cima do ombro de alguem
estudando numa mesa. Headline ancorada a esquerda, veu claro so atras dela. Barra escondida.

**2 · A pergunta de terca** (`pin` + trilho, 1.6) — a tela trava. A esquerda, tres falas que se
substituem uma na outra conforme rola. A direita, uma **lista de topicos rolando sem fim**,
desfocada nas bordas de cima e de baixo, que nunca acaba — e o edital como coisa infinita. Um
trilho vertical fino entre as duas colunas se preenche e marca em qual das tres falas voce esta.

**3 · Alguem contou** (`flow` + `count`, 1.0) — o respiro. Fundo claro, quase tudo vazio. Uma
frase curta em cima e **um numero enorme** que sobe de zero ate o valor com `data-sc-count`.
Nada mais se move. E o silencio antes do pico, e e proposital que pareca pouco.

**4 · O dia se monta** (`pin` + assinatura, 2.8) — o PICO. A tela trava numa superficie clara,
tipo uma folha. Conforme rola, **o plano se escreve sozinho**: entra o bloco 1 com tema e
contagem, depois o 2, depois o 3, depois a revisao de ontem descendo por cima com um selo. Um
anel de progresso se preenche ao lado. E aparece **o dial** — 30 min / 1 h / 2 h — que ao ser
tocado refaz tudo na frente do visitante: blocos entram e saem, contagens mudam, o anel anda.

**5 · A questao** (`pin`, 1.4) — a tela trava. Um cartao de questao ocupa o centro, com etiqueta
de banca e ano no topo. As alternativas entram uma a uma conforme rola. Uma e escolhida, e um
**carimbo** cai em cima dela. Abaixo, a explicacao comeca pela alternativa errada, nao pelo
gabarito.

**6 · O que volta** (`reveal` + `parallax`, 1.2) — o cartao errado do ato anterior **se desprende**
e entra numa linha do tempo horizontal que se desenha com `clip-path`: hoje, 3 dias, 9 dias, 21
dias. Cada marco acende quando a revelacao passa por ele. Atras, uma curva de esquecimento
achatando, em paralaxe mais lento que o resto.

**7 · Por que aguenta** (`pan`, 1.6) — um trilho de cartoes que **corre de lado** enquanto a
pagina desce. Cada cartao e um fato com titulo, rotulo e uma linha. Sete cartoes maiores, cada um
com seu acento visual. Sem ilustracao: o argumento e a leitura, e viagem lateral le como "opcoes"
em vez de "argumento".

**8 · O preco** (`flow`, 0.9) — nao anima nada alem da entrada. Dois cartoes de preco lado a
lado, um deles destacado, a garantia de 7 dias abaixo, e os links legais antes do CTA. Valores
placeholder. **Manter esses quatro elementos** ou o `page.test.tsx` fica vermelho.

## Ativos

| Arquivo | O que e |
| --- | --- |
| `public/video/heroi.mp4` | 1920x1080, 24fps, 5,04s, GOP 8, crf 22 — 4,9 MB |
| `public/video/heroi-m.mp4` | 720p, GOP 4, crf 24 — 2,1 MB |
| `public/video/heroi-poster*.webp` | primeiro quadro do proprio clipe |
| `arte-bruta/a2-entrada.png` | quadro inicial: o corredor |
| `arte-bruta/a2-chegada.png` | quadro final: por cima do ombro, folha em branco |

Descartados, mas guardados: `a1-caos` / `a1-ordem` / `a1-hero.mp4` (a mesa que se organiza) e
`a1-corredor*` (o corredor vazio).

A folha na mesa fica em branco no clipe de proposito: o que se escreve nela e DOM, para ficar
nitido e ser facil de editar depois.

## Celular

O clipe e 16:9. Coberto numa tela 9:16 o recorte come a mesa, que e o argumento da cena. Entao no
celular o video **nao** e sangria: vive numa caixa 16:9 no topo e a copy desce para uma faixa
embaixo. E tambem o caminho mais seguro no iPhone.

---

# HANDOFF — estado da landing v2

## Estado

| | |
| --- | --- |
| Branch | `feat/landing-v2-corredor` |
| Atos 1 a 8 | construidos e verificados |

## Onde o codigo mora

| Arquivo | Papel |
| --- | --- |
| `src/app/(landing)/page.tsx` | monta a pagina com os 8 atos |
| `src/app/(landing)/page.test.tsx` | teste que ja existe. Roda antes de dar por pronto |
| `src/app/(landing)/layout.tsx` | fonte, tokens e o script inline que arma o revelar |
| `src/modules/ui/landing/secoes.tsx` | `Heroi` (novo) + as secoes antigas |
| `src/modules/ui/landing/pico.tsx` | o pico ANTIGO. Vai ser substituido pelo ato 4 |
| `src/modules/ui/landing/assinatura.ts` | comportamento proprio: barra, progresso, o dial |
| `src/modules/ui/landing/landing.css` | composicao. Cor vem do `@theme` de `globals.css` |
| `src/modules/ui/landing/motor.tsx` | unico client component. Monta o motor em `main#topo` |
| `public/motor/scrollcraft.js` | o motor. Copia literal da skill, nunca editada |

**De/para dos componentes:**

| Ato novo | O que fazer |
| --- | --- |
| 1 O corredor | pronto (`Heroi`) |
| 2 A pergunta de terca | reaproveitar a estrutura de `Problema`, copy nova |
| 3 Alguem contou | reaproveitar `Medida`, copy nova, `data-sc-count` no numero |
| 4 O dia se monta | **substitui `pico.tsx` inteiro** |
| 5 A questao | novo |
| 6 O que volta | novo |
| 7 Por que aguenta | trilho `pan` com sete cartões maiores |
| 8 O preco | `Oferta` praticamente como esta |

**Sobre o ato 8:** manter os dois precos, a garantia e os links legais. Nao por cerimonia — o
`page.test.tsx` que ja existe fica vermelho sem eles. Os valores podem ser ficticios.

## Contrato do motor — quebrar qualquer um destes e bug

1. **Nunca editar `scrollcraft.js` nem `scrollcraft.css`.** Comportamento proprio vai em
   `assinatura.ts`, lendo `--sc-p`, com `data-sc-*` de nome nosso.
2. **Secoes sao server components.** Elas so produzem DOM com ganchos; quem liga o movimento e
   `motor.tsx`, depois da hidratacao.
3. **Nunca por `position` no palco.** O motor injeta `.sc-stage`, que traz o `position: sticky`
   que fixa o ato. Qualquer regra de autor com especificidade maior apaga isso, o ato deixa de
   fixar **em silencio**, e todos os testes automaticos continuam passando.
4. **Cuidado com alinhamento herdado.** `.lp .palco` define `justify-content: center`, e isso vale
   em grid tanto quanto em flex: trocar o `display` sem trocar o alinhamento centraliza a coluna
   inteira. Custou uma rodada.
5. **Veu so onde o texto esta.** Veu de quadro inteiro e proibido: lava a cena.
6. **Numero desenhado dentro de imagem ou video e proibido.** Nao da para editar depois.

## Armadilhas ja pagas — nao redescobrir

1. **`opacity: 0` que depende de JS.** `scrollcraft.css` esconde todo `[data-sc-in]` ate o motor
   devolver. Se o motor nao montar, o texto some para sempre. A rede de seguranca esta em
   `landing.css` (`sc-armado` / `sc-falhou`) e em `motor.tsx`. **Nao remover.**
2. **`proxy.ts` engole asset novo.** O matcher trata como rota de pagina tudo que nao estiver na
   lista de excecoes. `/motor/scrollcraft.js` ja custou um defeito; `/video/heroi.mp4` custou
   outro, e o sintoma foi `DEMUXER_ERROR_COULD_NOT_OPEN`, que **parece codec quebrado e nao e**.
   Ativo com extensao nova entra na lista antes de ser usado.
3. **Palco que nao fixa** — contrato do motor, item 3.
4. **Coluna centralizada por heranca** — item 4.
5. **Cue sem saudacao.** Um cue que comeca acima de 0 deixa o primeiro quadro da tela sem o texto.
   Terceiro valor `0` resolve.
6. **Clipe que nao termina antes de soltar.** O padrao do motor mapeia o clipe pela vida visivel
   inteira do palco, incluindo a saida, e a proxima secao entra com o video pela metade. No heroi
   se usa `data-sc-clip-map="travel"`.

## Como verificar

O `<skill>` abaixo resolve para:
`C:/Users/Caio Lacerda/.claude/plugins/cache/nateherk/nateherk-design/0.2.0/skills/scrollcraft`

```bash
npm run dev
node <skill>/scripts/shoot.mjs --url http://localhost:3000 --out .temp/tiros
node <skill>/scripts/shoot.mjs --url http://localhost:3000 --out .temp/mob --width 390 --height 844
node <skill>/scripts/shoot.mjs --url http://localhost:3000 --out .temp/red --reduced-motion
npx tsc --noEmit && npx eslint src && npx vitest run --project unit "src/app/(landing)"
```

Depois **olhar `sheet.png`**: o harness prova que o clipe anda, nao que a composicao presta.

Dois veredictos do harness esperados nesta pagina, que **nao** devem ser "consertados":

- *"clip held on its LAST frame while the stage slides out"* — e o pedido do dono: o video termina
  antes de a proxima secao entrar, e o ultimo quadro e a chegada na mesa.
- *"CONTRAST FAIL 2,67:1 (media 12,74)"* no titulo do heroi — o numero nao se moveu nem alterando o
  veu nem o cue, o que aponta para a regua amostrar com o palco fixo escondido. A olho o titulo
  esta sobre parede clara. Continua em aberto, nao resolvido.

## Nao verificado ainda

- **iPhone de verdade.** Chrome sem cabeca nao reproduz decoder, autoplay nem Low Power Mode. O
  clipe do heroi e o item que mais quebra la.
- **Aviso de hidratacao** do script inline que arma o revelar. Nao quebra nada, mas suja o console.
  Conserto idiomatico e `suppressHydrationWarning` no `<html>` do layout raiz.
- **Celular e movimento reduzido do ato 1** foram escritos no CSS mas ainda nao capturados.
