# DESIGN — Passou Concursos

> Calmo, preciso, quente e funcional. O design desaparece enquanto o aluno trabalha e aparece
> quando precisa orientar, ensinar ou celebrar.

**Status.** Rodada 1 cobre **só a landing** (`/`). O app (`/app/*`) continua no visual atual até
uma rodada própria. Referência de estilo estudada: `docs/referencias/mindmarket-style.md`.

## Duas superfícies, dois modos, uma base

O erro caro seria tratar tudo como um sistema só. Não é.

| | **Landing** (`/`, `/assinar`, `/checkout`) | **App** (`/app/*`) |
| --- | --- | --- |
| Modo | **Persuade** — o visitante decide e compra | **Operate** — o aluno executa uma tarefa |
| Referência | MindMarket / Duolingo: editorial, ilustrado, quente | Precision SaaS: denso, quieto, previsível |
| Escala tipográfica | display gigante (72–128px) | 14–32px, sem display — **uma exceção**, abaixo |
| Ilustração | protagonista | nenhuma |
| Movimento | GSAP, scroll-linked | transição de estado, 150–200ms |
| Raio | generoso (24–40px em cards, pill em botão) | contido (8–14px) |
| Cor | verde vivo pode pintar superfície | verde **só** indica ação, seleção, progresso e estado |
| Breu | duas das sete seções | barra de navegação + **um** cartão por tela (AD-111) |
| Tema | claro sempre — o ritmo claro→breu→claro é a peça | claro / escuro / segue o sistema (AD-149) |

**O que as duas compartilham:** a paleta de neutros, os tokens semânticos de estado, a família
tipográfica (Geist) e a régua de acessibilidade. É isso que impede o produto de parecer dois
produtos.

## Tokens

Todos moram em `@theme` no [globals.css](src/app/globals.css) — Tailwind v4 não tem
`tailwind.config.js`. Os valores abaixo **substituem** a paleta azul da SPEC 07.

### Neutros — a estrutura (85% da tela)

| Token | Valor | Papel |
| --- | --- | --- |
| `--color-fundo` | `#F5F2E9` | canvas quente. **Nunca** `#FFFFFF` como fundo de página |
| `--color-painel` | `#FFFDF8` | superfície elevada: card, nav flutuante |
| `--color-fundo-suave` | `#F1F2EE` | superfície recuada, seção alternada |
| `--color-texto` | `#1B1D1A` | texto primário — 15.2:1 sobre o canvas |
| `--color-suave` | `#63665E` | texto secundário — 5.2:1 |
| `--color-linha` | `#DDD9CD` | divisor. Decorativo: **nunca** carrega texto |

> **Correção obrigatória.** O `#74776F` do briefing dá **4.07:1** sobre o bege — reprova em AA para
> texto normal, e UI-03 AC3 exige contraste suficiente. Subimos para `#63665E` (5.22:1). Mesmo
> motivo derruba o `#74776F` como cor de qualquer parágrafo.

### Verde — a intenção (10%)

| Token | Valor | Papel | Contraste s/ canvas |
| --- | --- | --- | --- |
| `--color-marca` | `#245B46` | ação primária, link, seleção. Branco por cima: 7.9:1 | 7.05:1 |
| `--color-marca-apoio` | `#357055` | verde de texto/borda quando precisa ler | 5.21:1 |
| `--color-marca-viva` | `#4F8B72` | **só preenchimento e ilustração** — 3.56:1, não carrega texto | 3.56:1 |
| `--color-marca-suave` | `#E6EEE9` | fundo de seleção, estado ativo | — |

### Estados e acentos (5%)

Dois valores por estado: um que **pinta** e um que **lê**. Trocá-los é o erro clássico.

| Estado | Preenchimento | Texto/ícone | Fundo |
| --- | --- | --- | --- |
| Sucesso | `#2C7A55` | `#2C7A55` (4.66:1) | `#E6EEE9` |
| Conquista | `#B8862D` | `#8A6318` (4.84:1) | `#FAF4E6` |
| Alerta | `#D9A441` | `#8A6510` (4.75:1) | `#FAF4E6` |
| Erro | `#D94A4A` | `#C03A3A` (4.80:1) | `#FBEDED` |

> `#B8862D` (2.89:1), `#D9A441` (2.01:1) e `#D94A4A` (3.73:1) **reprovam** como texto sobre o bege.
> Eles existem só como fill de badge, barra e ícone grande.

### Tipografia

**Geist** para tudo — display e corpo. Uma família só, como o MindMarket faz com Inter: a autoridade
vem da escala e do tracking, não de uma segunda fonte. `Geist Mono` só em número de questão, código
de prova e dado tabular.

| Papel | Tamanho | Line-height | Tracking |
| --- | --- | --- | --- |
| `display` | 96–128px (landing, ≥lg) | 0.95 | -0.045em |
| `display-sm` | 56–72px (landing, mobile) | 1.0 | -0.035em |
| `heading` | 32–40px | 1.15 | -0.02em |
| `subheading` | 20–24px | 1.3 | -0.01em |
| `body` | 17–18px | 1.6 | 0 |
| `micro` | 13–14px | 1.4 | +0.02em, uppercase |

### Forma e elevação

- **Raio.** Não é um valor só — é o que o briefing pede e o MindMarket viola. Botão: pill.
  Card da landing: 28px. Card do app: 12px. Input: 10px. Chip/tag: 8px. Ilustração: sem clip.
- **Elevação.** A pilha de superfície (`#F5F2E9` → `#FFFDF8`) faz o trabalho. Sombra existe **só**
  onde há camada real que flutua sobre conteúdo: nav sticky, dropdown, modal, toast. Card não tem
  sombra.

### Tema escuro — só o `/app/*` (AD-149)

Três estados de escolha: **claro**, **escuro** e **segue o sistema** (o padrão, e o comportamento
de sempre). O controle é um botão no rodapé da navegação — barra lateral no desktop, folha da Conta
no celular —, nunca dentro do formulário de preferências: preferências é o formulário do *estudo*,
e tudo lá alimenta `gera_plano_do_dia`. A preferência mora em `perfil_estudo.tema`, com espelho em
cookie para o shell pintar sem piscar.

**O que fica de fora, e por quê.** A landing (`/`), `/assinar`, `/checkout`, as telas de acesso
(`.acesso`) e `/operador/*` continuam claros. A landing tem ritmo claro→breu→claro dirigido por
GSAP (AD-106): num tema escuro esse ritmo deixa de existir e a peça perde o pico. Tema escuro serve
ao modo **Operate** — o aluno que estuda de noite. Não serve ao **Persuade**.

Os tokens escuros ficam **fora de `@theme`**, em `[data-tema="escuro"]` e na gêmea
`[data-tema="sistema"]` sob `prefers-color-scheme: dark`: `@theme` não pode ser aninhado em seletor
nem em `@media`, mas as utilidades que ele gera emitem `var(--color-*)`, então redefinir o token num
seletor comum cascateia. Sem `@theme inline` e sem `@custom-variant` — nenhum componente precisou de
exceção pontual.

Contraste medido pela fórmula WCAG 2.1, não estimado. Fundo `#14150F`, painel `#1E2019`:

| Token | Claro | Escuro | Contraste | Papel |
| --- | --- | --- | --- | --- |
| `fundo` / `papel` | `#F5F2E9` | `#14150F` | — | canvas |
| `painel` / `papel-alto` | `#FFFDF8` | `#1E2019` | 1.12:1 | superfície elevada |
| `fundo-suave` / `papel-recuo` | `#F1F2EE` | `#0E0F0A` | 1.05:1 | seção recuada |
| `texto` / `tinta` | `#1B1D1A` | `#F3EEE2` | **15.86:1** | texto primário |
| `suave` / `tinta-suave` | `#63665E` | `#ACA697` | **7.57:1** | texto secundário |
| `linha` / `risco` | `#DDD9CD` | `#383A2F` | 1.59:1 | divisor — nunca carrega texto |
| `marca` / `verde` | `#245B46` | `#8CC4A6` | **9.23:1** | ação, link, seleção |
| `marca-apoio` / `verde-texto` | `#357055` | `#8CC4A6` | 8.28:1 s/ painel | verde que se lê |
| `marca-viva` / `verde-vivo` | `#4F8B72` | `#6FAE8E` | 7.10:1 | preenchimento e ilustração |
| `marca-suave` / `verde-tenue` | `#E6EEE9` | `#22332B` | 1.38:1 | fundo de seleção |
| `ok` | `#2C7A55` | `#7FC8A4` | **9.35:1** | sucesso |
| `conquista` / `ouro-texto` | `#8A6318` | `#D8AE5C` | **8.85:1** | conquista |
| `aviso` | `#8A6510` | `#E0B15C` | **9.28:1** | alerta |
| `erro` | `#C03A3A` | `#F09A9A` | **8.56:1** | erro |

`#F3EEE2` e `#ACA697` não são inventados: são `breu-tinta` e `breu-suave`, que já rodavam sobre
breu. Uma matéria só.

**Inversão obrigatória do botão primário.** No claro é verde escuro com texto claro. No escuro é
verde claro com **texto do fundo** — `#14150F` sobre `#8CC4A6`, 9.23:1. Botão verde escuro com texto
branco sobre fundo escuro seria invisível, e o inverso também: `text-white` sobre `bg-marca` no
escuro dá ~1.7:1. Em botão preenchido use `text-fundo` ou `text-painel`, **nunca** `text-white`.

**O `breu` vira um degrau de elevação.** No claro ele é a superfície escura contra papel claro; no
escuro não pode ser isso, e passa a ser um degrau acima do fundo (`#23251D`, 1.18:1 contra o canvas)
— nada na interface brilha. A régua do AD-111 ("um cartão-herói por tela") passa a se apoiar mais em
escala tipográfica do que em matéria. Se um herói sumir, a compensação é **uma** destas, não as três:
borda de 1px em `breu-verde`, subir `breu` para `#282A20`, ou peso tipográfico no título.
Compensar com sombra não funciona: preto com alfa sobre fundo escuro não aparece, e é por isso que a
elevação no escuro é a pilha de superfície, não a sombra.

Foi medida e **descartada** a inversão de papel (herói e barra virando a superfície *clara* sobre
fundo escuro). Passava com folga — 15.86:1 do cartão contra o fundo — e custava as mesmas zero
linhas. Caiu porque uma barra lateral clara na altura inteira da tela é justamente a luz que quem
liga o modo escuro está tentando evitar.

## Ilustração

Gerada por IA, via `scripts/design/gerar-imagem.mjs` (OpenRouter, `openai/gpt-image-2`,
~US$ 0,014/imagem). Prova de conceito em `public/arte/teste-personagem.png`.

**A regra do prompt** — o que faz a série ficar coesa em vez de virar figurinha avulsa:

- estilo: *flat paper-cut vector, bold simple shapes, thin dark ink outline*
- proibido: gradiente, sombra, textura, render 3D, realismo fotográfico, neon, roxo
- paleta travada no prompt: `#245B46`, `#4F8B72`, `#B8862D`, `#1B1D1A`, `#FFFDF8`
- fundo: `#F5F2E9` chapado (o modelo **não** aceita transparência no `gpt-image-2` via OpenRouter)
- sem texto, letra, número ou logo na arte
- pessoas brasileiras, variadas, adultas, expressão de foco calmo — não de euforia

O `.json` sidecar guarda o prompt de cada imagem. Sem ele não dá para regerar nem variar a série.

**Pendência conhecida:** o fundo que volta do modelo é `#F7F3E8`-ish, não `#F5F2E9` exato. Ou
recortamos o fundo, ou casamos o canvas com o que veio. Decidir na montagem, não antes.

## Movimento

GSAP, **só na landing**. Regras:

1. `gsap.matchMedia()` respeitando `prefers-reduced-motion` — o `globals.css` já mata animação
   nesse modo globalmente, e o GSAP tem que concordar, não brigar.
2. Movimento é **entrada e revelação**, não loop infinito. Nada pulsa para sempre.
3. Só `transform` e `opacity`. Nada que force layout.
4. Nenhuma animação segura conteúdo: o texto do herói existe no HTML e é legível com JS desligado.

## Fronteiras que não se negociam

O redesign muda a forma. Não muda estes:

- **PAG-08.** A landing contém: o método, as evidências (`docs/EVIDENCIAS-CIENTIFICAS.md`), a
  garantia, **os dois preços antes da escolha**, link para termos e privacidade, e a declaração
  honesta do que existe hoje. Nada de prometer o que não está ligado (AD-076).
- **UI-01 / UI-03 (SPEC 07).** Sem scroll horizontal no documento; foco visível em todo elemento
  focável; zoom não travado; contraste conforme a tabela acima.
- **INFRA-12.** Os quatro eventos do funil continuam disparando, anônimos.
- Toda cor nova entra pelo `@theme`, nunca hardcoded no componente.

## Anti-slop — a régua

Herdada do briefing e mantida como gate de revisão:

sem hero card dentro do app (**exceção única, AD-111:** o cartão do próximo bloco em `/app` — é
cartão-herói, título de 36px e fundo breu; é um por tela, e um segundo é bug) · sem grid automático de
3–4 cards de métrica · nem todo agrupamento é
card · raio não é igual em tudo · sombra não é em toda superfície · eyebrow label não é em toda
seção · sem ícone decorativo nem badge sem função · sem bento grid automático · sem texto genérico
de demo · prioriza tipografia, espaço, alinhamento, divisor, lista, row e tabela · cor com
significado · elevação com significado · gamificação é evento contextual, não decoração permanente.

**O teste final:** trocar o logo não deveria transformar isto no site de outra empresa.
