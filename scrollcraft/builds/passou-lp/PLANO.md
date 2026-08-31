# PLANO — landing do Passou Concursos

Lê o `BRIEF.md` primeiro.

## Histórico da decisão estrutural

A primeira rodada foi construída em **split stage** (duas colunas em tensão a página
inteira, "no escuro" × "medido", divisor como chrome). Foi construída, verificada e
**rejeitada pelo dono**:

> "não gostei desse estilo de duas colunas, quero algo mais convencional mesmo, só com as
> animações por sessões"

Registrado como o que é: decisão dele, não defeito técnico. O que sobreviveu da rodada —
a arte, a paleta, a copy, os números reais e o movimento assinatura — foi mantido.

## O que está construído agora

**Layout convencional**: sete seções empilhadas em largura cheia, uma embaixo da outra,
cada uma com o seu próprio movimento. Barra fina fixa no topo com marca, três links e uma
ação. Chão creme quase o tempo todo; **duas** seções viram escuras, e uma delas é o pico.
É esse racionamento que faz o pico valer.

Isto **não** é nenhuma das oito gramáticas da skill em estado puro. A mais próxima é a
*chaptered editorial* (capítulos com chão próprio, corte duro entre eles, sem interpolação
de fundo), e a build desobedece dois pontos dela por instrução direta do dono: existe barra
fixa, e a seção 2 é um ato fixado de tipo. Ambos são o que "convencional" significa para
ele. Desvio declarado, não descuido.

## O movimento assinatura: "o edital desaba"

Uma interação que existe só neste site. Escrita na página, dirigida por `--sc-p`.
**O motor `scrollcraft.js` não é tocado.**

Na seção 4, os **86 tópicos reais** do edital estão empilhados sem ordem, todos cinzas e do
mesmo tamanho. Conforme o scroll avança eles despencam, atravessam a tela numa curva com
barriga para baixo, se ordenam por **frequência real medida no acervo**, e viram barras: os
doze primeiros ganham verde, rótulo e número; os outros 74 encolhem e viram sedimento com a
legenda honesta do que somam. Reversível e travado no scroll.

**Por que HTML/CSS e não vídeo nem imagem:** os chips carregam nome de tópico e contagem
reais. Em vídeo isso borra, não é selecionável, não é lido por leitor de tela e **congela** —
na próxima prova ingerida o vídeo estaria mentindo. Em DOM o número vem de `raiox.js`, que
saiu do banco, e continua verdadeiro. Além disso 86 `<div>` em `transform` pesam zero e
rodam a 60fps; um clipe de 5s em 1440p pesa megabytes e briga com autoplay no iPhone.

## Os números, e de onde vieram

Extraídos do acervo em 2026-08-25 (`questoes` vigentes, `origem='real'`, excluída a matéria
de fixture `TESTE-%`). **Nada é estimado.**

| Fato | Valor |
| --- | --- |
| Questões de prova real | **1.395** |
| Provas oficiais | **28**, de **2010 a 2025**, 7 bancas |
| Tópicos ativos | **86** |
| Top 12 tópicos | **567 questões = 40,6%** |
| Tópicos com ≤5 questões | **19 tópicos = 65 questões = 4,7%** |
| Cauda (73 restantes) | **828 questões** |

> Correção de rota registrada: eu tinha trazido "205 questões" da memória. O acervo tem
> **1.395**. O número da memória estava velho e teria virado copy falsa.

## A partitura

| # | Seção | Dispositivo | Span | Por quê |
| --- | --- | --- | --- | --- |
| 1 | Herói | `flow` + `kinetic` (linhas) + `parallax` na arte | — | A primeira tela não deve segurar ninguém, deve deixar passar. |
| 2 | O problema | `pin` + cues que se substituem no lugar | 2.4 | A tensão precisa de tempo para assentar. Único ato de tipo fixado da página. |
| 3 | Alguém contou | `reveal` (`up`) + contador **1.395** | — | Wipe é mudança de estado. Seção curta e quieta: é o respiro que faz o pico bater. |
| 4 | **O EDITAL DESABA** | `pin` + movimento assinatura em `--sc-p` | **4.0** | PICO. Precisa de curso para o desabamento ser evento, não corte. |
| 5 | O método | `flow` + entrada escalonada + contador **242** | — | A única seção que se lê como documento. É o que faz as fixadas em volta valerem. |
| 6 | Hoje × ainda não | dois `reveal` grandes, cada um de uma borda | — | A honestidade é dois lados. Ele lê o que **não** existe antes do preço. |
| 7 | O fecho | `pin`, cues que seguram | 1.4 | Última tela resolve inteira: título, preço, garantia, legal e CTA de uma vez. |

Famílias distintas: `pin`, `flow/in`, `reveal`, `kinetic`, `count`, `parallax` = 6.
Zero `scrub` (não há footage; o mundo é ilustrado). Pico com 4.0 contra 2.4 do segundo maior.

**Onde a partitura não fecha a régua da skill:** as seções 5 e 6 são as duas `flow`, então
há uma repetição de família em atos vizinhos. Aceito conscientemente — o tratamento é
diferente (entrada escalonada × dois wipes grandes) e forçar um `pin` ali brigaria com o
pedido de "convencional".

## Defeitos encontrados na verificação e corrigidos

1. **Chão fixo reprovava a régua de contraste inteira.** O verificador esconde todo elemento
   `fixed` para amostrar o chão atrás da chrome, e a primeira versão pintava as faixas numa
   camada `position:fixed` — resultado: texto creme medido contra creme, seis reprovações.
   Corrigido pintando o fundo **por seção**. Não foi contornar a ferramenta: a ferramenta
   estava certa sobre o chão ser frágil.
2. **`data-sc-stagger` sozinho não revela nada.** Os três pilares do método ficaram em
   `opacity: 0` para sempre. O motor só observa `[data-sc-in]` e lê o stagger *desse*
   elemento. Faltava o `data-sc-in`.
3. **Barra translúcida ilegível sobre as seções escuras.** Virou opaca.
4. **Cue no invólucro inteiro da oferta reprovava contraste no celular**: a régua compara a
   cor do texto contra o pixel mais escuro do bloco, que era o preenchimento do botão.
   Uma cue por bloco, mesma janela.
5. **Fecho com buraco no topo:** a fala de abertura apagava na metade da fixação. Último ato
   precisa de `0 1 0 0` — cheia em p=0, sem rampa em nenhuma ponta.
6. **Rótulos do gráfico colados na ponta de cada barra**, o que serrilhava a coluna. Colunas
   fixas.
7. **Herói quebrando em seis linhas** e empurrando o CTA para fora da primeira tela.

## Contrato que não muda (PAG-08, guardado por `page.test.tsx`)

`prova real` · `revisão` · `Donoghue` · `242` · `197,00` · `177,30` · `Garantia de 7 dias` ·
`href="/checkout"` · `/termos` e `/privacidade` **antes** do botão · `Ainda não` ·
`Tutor de dúvidas` · `não promete aprovação` · `Ranking entre alunos não está`.
Todos presentes e na ordem exigida.

## Rodada 3 — o que o dono pediu e o que mudou

> "as imagens ao lado muito pequenas" · "seção 2 muito apagadinha" · "seção 3 pouco tempo de
> scroll" · "textos em cima do outro" (seção 4) · "seção 5 muito texto" · "seção 6 movimento
> mais 3d, com sombra nos cards" · "seção 7 coloque cards nos preços" · e a régua geral:
> *"os textos grandes, destaque nas imagens"*, referência MindMarket.

| Onde | O que mudou |
| --- | --- |
| Escala | Display até 5,75rem, título gigante até 4,75rem, lede até 1,5rem, numerão até 10rem. Uma família só (Geist); a autoridade vem do tamanho e do tracking. |
| Arte | Cinco imagens novas geradas. Sem moldura: a ilustração senta direto no canvas, como na referência. No herói ela sangra para fora da coluna. |
| Seção 2 | Torre de provas em altura de palco. O contraste de escala entre a figura minúscula e a torre é o argumento da seção. |
| Seção 3 | Virou duas colunas, número em 10rem, mais alta — mais curso de scroll. |
| Seção 4 | **Bug corrigido**: as falas eram parágrafos soltos com margem e colidiam quando o título quebrava numa linha a mais. Viraram blocos empilhados na mesma célula do grid. Chips agora são papel creme com sombra, não traço cinza. Gráfico maior, barras mais altas. |
| Seção 5 | Copy cortada quase pela metade. Três cartões elevados com inclinação ao ponteiro. |
| Seção 6 | Dois cartões com sombra real e inclinação, mais a arte que diz literalmente a mesma coisa (painel com quatro vistos × painel vazio). |
| Seção 7 | **Deixou de ser ato fixado.** Palco de 100vh não comportava título gigante + arte + dois cartões + garantia + legal + CTA, e sobrava rolagem aninhada que jogava o texto legal contra o rodapé escuro. Conteúdo que não cabe numa tela é seção, não ato. Dois cartões de preço com lista de benefício e selo de economia (R$ 19,70, real). |

Defeitos adicionais pegos e corrigidos nesta rodada: duas barras de progresso empilhadas (a do
motor e a nossa); o bloco `.fala` sem cor própria reprovando a régua de contraste inteira; o
`clip-path` do reveal decepando o topo do numerão porque a caixa é mais curta que os glifos.

## Custo de arte

Sete imagens usadas, US$ 0,213 cada. Mais três testes de estilo descartados.
**Total gasto: ~US$ 2,13.**

## Pendente

- Porte para os componentes Next.js em `src/modules/ui/landing/`. Prompt de handoff pronto em
  `HANDOFF-NEXTJS.md`.
- `DESIGN.md` § Ilustração proíbe render 3D. Precisa de `AD` nova no `.specs/STATE.md`.
- `raiox.js` é um extrato congelado do banco. No porte tem que virar consulta.
