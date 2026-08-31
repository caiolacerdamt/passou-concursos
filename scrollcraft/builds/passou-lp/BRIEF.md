# BRIEF — landing do Passou Concursos

Entrevistado: Caio Lacerda (dono). Respostas em PT-BR, na palavra dele, não parafraseadas.

## As oito respostas

**1. Vibe em três a cinco palavras, mais até três referências.**
> "moderno, um pouco minimalista, que passe essa vibe de premium"

Referências dadas: **MindMarket** (para animação), **Duolingo** e **Neuro**
(`neuro-ai-phi.vercel.app`, para personagem). Todas as três são site — a entrevista pede
referência de qualquer meio e ele deu site. Registrado como desvio: o risco é a página sair
parecida com um site existente, e o antídoto foi escolher uma gramática que nenhuma das três
usa (ver `PLANO.md`).

O que foi lido nas referências, não o que foi dito sobre elas:
- MindMarket: Astro + GSAP + **Lenis** + **Rive**. Um mundo ilustrado contínuo (o morro verde)
  atravessado pela página, com cards brancos flutuando por cima. Um truque só, muito bem feito.
- Neuro: personagem 3D chunky, fosco, adulto-infantilizado, sobre canvas creme.

**2. A jornada, seção por seção, na palavra dele.**
Ele não ditou sequência. Disse o objetivo: *"mostrando o que é o produto e tudo mais pra poder
convencer o cara de comprar"*. A sequência foi então derivada do que a spec PAG-08 obriga a
página a conter e apresentada de volta. Registrado como derivado, não ditado.

**3. A curva de energia.**
> "Eu quero a mistura do 1 e do 2. Eu quero o prêmio contido, só que eu quero movimento em toda
> a seção. Obviamente, não precisa ser em todas as seções movimentos muito bruscos, mas tem que
> ter movimento nas seções."

Leitura: piso de movimento em toda seção, teto de intensidade em quase todas, **um** pico.

**4. Como ele deve se sentir, e o UM momento.**
Ver `## A curva de sentimento` e `## O pico` abaixo.

**5. Uma coisa que este site faz que nenhum outro faz.**
Não respondida diretamente. Proposta pelo autor e aceita implicitamente ao aprovar o plano:
o edital desabando (ver `## O pico`).

**6. Quão longe do premium-minimal.**
Resposta 3 responde esta: premium contido com movimento constante. Não brutalista, não
maximalista, não austero.

**7. Um mundo contínuo ou cenas distintas?**
> "Cenas distintas, cada uma com um truque (Recomendado)"

Decisão explícita dele. Isso **exclui** worldflight, que é justamente o que o MindMarket faz —
a referência de animação foi usada como fonte de ideia, não de estrutura, exatamente como ele
pediu.

**8. Que ativos ele já tem.**
- Marca, paleta e tipografia travadas em `DESIGN.md` (canvas bege `#F5F2E9`, verde `#245B46`,
  Geist). Régua de contraste já calculada e aprovada em AA.
- Uma ilustração da landing atual (`public/arte/prova-lida.png`) — **rejeitada por ele**:
  *"Eu não gostei daquele personagem, por exemplo, da Hero."*
- Pipeline de geração que já existe e já foi usado: `scripts/design/gerar-imagem.mjs`
  (OpenRouter, `openai/gpt-image-2`) + `scripts/design/recortar-fundo.mjs` (flood fill das
  bordas, deixa alpha de verdade).
- Dados reais, que é o ativo que importa: **205 questões** de prova oficial do Banco do Brasil
  já ingeridas, com banca, ano e gabarito conferido.
- Sem footage, sem foto, sem `KIE_AI_API_KEY`. Mundo gerado, não filmado.

## Correções feitas ao que foi prometido em conversa

- Custo por imagem: prometido ~US$ 0,014 (número do `DESIGN.md`), **real US$ 0,21** em
  `--quality high`. Corrigido com ele antes de gastar o orçamento.
- Vídeo: ele perguntou se o pico não seria melhor em vídeo. Não é, e a razão está registrada:
  os chips carregam texto e número reais vindos do banco, e vídeo congela dado, borra tipografia,
  pesa megabytes e não responde ao scroll. Mundo = imagem gerada; dado = código.

## A curva de sentimento

Escrita antes dos atos existirem. Uma linha por ato: o sentimento, depois o que na tela o causa.

| Ato | Sentimento | O que na tela causa |
| --- | --- | --- |
| 1 · O formato se declara | **Reconhecimento inquieto** | Duas colunas lado a lado na primeira tela, os dois títulos legíveis de uma vez: à esquerda o jeito dele, à direita o outro. Ele se vê na esquerda. |
| 2 · O custo do escuro | **Desconforto** | A coluna escura cresce. O divisor é empurrado para a direita. As linhas chegam alternando de lado, sem nunca deixar tela vazia. |
| 3 · Alguém contou | **Quieto** — o silêncio autoral | Uma frase curta e um número real (205). Quase nada se move. É o único respiro da página e existe para o ato 4 bater. |
| 4 · **O edital desaba** | **Espanto** ← PICO | ~180 chips cinzas idênticos despencam da coluna esquerda, cruzam o divisor e se ordenam sozinhos numa barra de frequência real. Ele rola e o Raio-X se desenha na mão dele. |
| 5 · Por que o número aguenta | **Confiança** | Gabarito oficial, IA que não decide alternativa, revisão espaçada, 242 estudos. O número acabou de impressionar; agora precisa se sustentar. |
| 6 · Hoje × ainda não | **Respeito** | Dois razonetes se abrindo das bordas para o divisor. Ele lê o que **não** existe antes de ver o preço. |
| 7 · O colapso | **Decisão** | O divisor viaja para a esquerda e some. A coluna medida toma a página inteira. O preço, a garantia e os links legais vivem dentro da coluna que ganhou. |

Nenhum sentimento se repete em atos vizinhos. O ato 3 é mais quieto que o 4 por construção.

## O pico

A frase que o visitante diria para um amigo:

> "Cara, você rola a página e o edital inteiro despenca e se organiza sozinho num gráfico do que
> a banca cobra de verdade. Dá pra parar no meio e ver acontecendo."

Vive no **ato 4**. Recebe o maior span da página (4.0 alturas de tela contra 2.0 do segundo
maior), o orçamento de arte, e o silêncio do ato 3 antes dele.

## Silêncio autoral

**Ato 3** é silêncio de propósito, não scroll morto. Uma frase, um número que sobe, e o resto
da tela vazia. Se a verificação apontar "pouca mudança visual" ali, está correta e é o
desenhado — o que ela não pode apontar é ausência de conteúdo, e não há.

## A frase de contar para alguém

> É o site onde **o edital desaba na sua mão e se ordena sozinho no que a banca cobra de verdade.**

Experiência, não nome de dispositivo.
