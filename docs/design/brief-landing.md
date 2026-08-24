# Brief — Landing `/` (rodada 1)

Saída da fase `shape` da skill `impeccable`. Não é spec: as specs mandam no *conteúdo*
(PAG-08, UI-01, UI-03); este documento manda na *forma*. Onde discordarem, vence a spec.

## 1. Trabalho e público

Chega o **concurseiro bancário mirando o BB** — adulto, 20–40, rotina irregular, ansioso, aposta de
vida. Ele não conhece a marca, não pode testar o produto (paywall total) e chega quase sempre pelo
celular. Estado de espírito: cético e apressado, já viu promessa de cursinho antes.

**Modo: Persuade.** O design é o produto nesta superfície. Só aqui.

## 2. Resultado e prova

**Ação primária:** iniciar o checkout. Um clique a partir de `/` (exigência literal do Independent
Test de PAG-08).

**Sucesso:** o visitante entende o método, entende o preço e a garantia, e clica — ou sai sabendo
exatamente o que o produto é, sem ter sido enganado.

**A prova disponível, e só ela:**

- os estudos científicos de `docs/EVIDENCIAS-CIENTIFICAS.md` (evidência de **método**);
- questões reais com proveniência completa — banca, ano, órgão, cargo, número;
- a explicação conferida por gabarito oficial + verificação por código.

**A prova que NÃO existe e SHALL NOT ser fabricada:** aluno, depoimento, aprovado, número de
aprovação, logo de imprensa, contagem de usuários. O produto não lançou.

## 3. Direção

**Autoridade visual:** `DESIGN.md` — Persuade sobre papel quente `#F5F2E9`, Geist em escala display,
verde `#245B46` como única âncora cromática estrutural, ilustração paper-cut gerada por IA.

**Tese estrutural:** *a página é a prova, não a promessa*. Em vez de listar benefício, ela **mostra**
— uma questão real jogável na primeira dobra útil, com a proveniência exposta. O argumento não é
"nosso método funciona", é "olha de onde vem o que a gente ensina".

**Momento focal:** o instante em que o visitante responde a questão e vê a explicação com a etiqueta
da prova de origem. É a única coisa nesta página que um concorrente não copia sem fazer o trabalho.

**Ângulo do herói:** dor 1 — *"estudo o que não cai"*. Abre pelo Raio-X, que é o diferencial mais
defensável, e emenda na proveniência.

## 4. Sequência

1. **Nav flutuante** — marca, poucos links, CTA. Pill sobre o canvas, sem barra retangular.
2. **Herói** — display gigante no ângulo do Raio-X. Subtítulo curto. CTA primário + âncora `#precos`.
   Ilustração sangrando pela borda inferior para a próxima seção.
3. **A questão jogável** — vitrine. Responder → explicação conferida → proveniência exposta.
   É a dobra que carrega a página.
4. **O método em três tempos** — Raio-X, plano do dia, revisão espaçada. Lista/rows, **não** grid de
   3 cards. Cada um com uma frase do que é e uma do que ele resolve.
5. **A evidência** — os estudos, citados com honestidade sobre o que provam (método, não produto).
6. **O que existe hoje** — declaração afirmativa e sem eufemismo do que está ligado (plano do dia,
   sessão, progresso, conta) e do que não está. Cumpre AC2 e vira argumento de confiança.
7. **Preço** — enxuto: os dois formatos, garantia numa linha, CTA. Link "ver detalhes" → `/precos`.
8. **Rodapé** — termos, privacidade, contato, CNPJ.

## 5. Estados e faixas

- **Vitrine:** 3 questões. Estados: não respondida → respondida certa → respondida errada. A errada
  não pune, mostra a explicação igual. Sem placar, sem "você errou".
- **Preço:** vem de `obterPrecosPublicos()`, que lê configuração. Nunca hardcoded. A página tem que
  aguentar preço ausente ou config ilegível sem quebrar — nesse caso esconde o bloco e mantém o CTA.
- **Sem JS:** o texto do herói, o método, a evidência, o preço e os links existem no HTML. Só a
  vitrine e o movimento degradam.

## 6. Interação e layout

- **Topologia:** coluna única de leitura, editorial. Sem sidebar, sem grid de produto, sem tabela de
  planos. A ilustração dá o interesse lateral.
- **Responsivo:** mobile-first de verdade — o display cai para 56–72px, a vitrine vira uma coluna, a
  nav vira pill compacta. O documento nunca rola na horizontal.
- **Movimento:** GSAP, entrada e revelação por scroll. Sem loop infinito. Só `transform` e `opacity`.
  `gsap.matchMedia()` concordando com `prefers-reduced-motion`.
- **Feedback:** responder a questão é a única interação com estado. Resposta instantânea, sem spinner.

## 7. Restrições e decisões em aberto

**Vinculante:**

- PAG-08 AC1 — método, evidências, garantia e **os dois preços** na página; checkout a um clique.
- PAG-08 AC2 — declaração honesta; nada de prometer o que está atrás de flag desligada (AD-076).
- PAG-08 AC3/AC4 — responsiva, funciona sem login, linka termos e privacidade.
- INFRA-12 — os quatro eventos do funil continuam anônimos e a compra não depende deles.
- UI-01/UI-03 — sem scroll horizontal, foco visível, zoom livre, contraste da tabela do `DESIGN.md`.
- Next.js 16 App Router, Tailwind v4 (tokens em `@theme`, sem `tailwind.config.js`), React 19.

**Decisões que o construtor NÃO pode inventar:**

- o número de questões do acervo (ler do banco; hoje **zero publicadas** de 206 extraídas);
- o preço (vem de configuração);
- qualquer estatística de aprovação, depoimento ou contagem de aluno.

**Aberto — precisa de decisão antes da implementação:**

1. **Munição da vitrine.** Zero questões publicadas. Sem 3 questões com explicação conferida, a dobra
   4 não existe e a página perde seu argumento central.
2. **AD-100 no `STATE.md`.** Trocar os tokens do `@theme` atinge todas as telas; é decisão nova.
3. **Onde a página nasce.** Recomendado: rota paralela até passar no `audit`, depois substitui a `/`
   — a `/` atual está vendendo com checkout homologado no Asaas.
4. **`/precos`.** Fora desta rodada. O link aponta para a âncora `#precos` até a rota existir.
