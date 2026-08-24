# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primário — o concurseiro bancário mirando o Banco do Brasil.** Adulto de 20 a 40 anos, muitas vezes
já trabalhando ou estudando em paralelo, mirando o cargo de Escriturário do BB (agente comercial ou
agente de tecnologia). Contexto: **rotina irregular** — nem todo dia tem o mesmo tempo livre;
**ansioso** — aposta alta, medo de perder o edital; **aposta de vida** — a vaga muda a renda. Compete
de verdade por vaga limitada.

As cinco dores que ele traz, nas palavras dele:

1. "Não sei o que estudar / estudo o que não cai."
2. "Estudo mas esqueço."
3. "Monto plano na mão e não sigo."
4. "Tenho medo de aprender errado."
5. "O edital ainda não saiu e não sei nem a banca."

**Secundários (não são foco, mas o produto não pode atrapalhá-los):** concurseiro de outros bancos
(Caixa, BNB, BASA, Banrisul); operador interno — os três sócios, que fazem curadoria de taxonomia e
revisam questões e explicações, mas **não** analisam questão por questão.

## Product Purpose

**A tarefa que o aluno contrata o produto para fazer:** *"Me faça passar no concurso bancário: diga o
que estudar hoje, do jeito que a ciência mostra que funciona, encaixando na minha rotina irregular,
sem eu ter que montar meu próprio plano nem ter medo de aprender coisa errada — e me mantenha
estudando até a prova."*

Sucesso é o aluno abrir o app, ver o que fazer hoje, fazer, e voltar amanhã — sem ter montado plano
nenhum.

## Positioning

**O fosso é o acervo, não a interface.** Banco de questões reais extraídas de **PDF oficial da banca**
(ato oficial, Lei 9.610/1998 art. 8º IV), cada questão com proveniência completa — banca, ano, órgão,
cargo, número — e gabarito conferido. Raspar concorrente é proibição absoluta do projeto.

Em cima disso: plano diário adaptativo com revisão espaçada (FSRS) e o **Raio-X da banca** — a
frequência real com que cada assunto cai, calculada só sobre questão de origem `real`.

O que um concorrente não copia sem fazer o mesmo trabalho: a proveniência auditável, a explicação
conferida por gabarito oficial + verificação por código, e o Raio-X calculado sobre prova real em vez
de opinião de professor.

## Operating Context

O aluno usa em sessões curtas e irregulares, alternando celular e desktop. Web responsivo apenas —
**sem app nativo e sem PWA** no lançamento. O produto está inteiro atrás do paywall: paga primeiro,
conta criada automaticamente depois da confirmação. A landing é a única chance de convencer, porque
não há como experimentar antes.

Matrícula anual (12 meses), com pagamento em cartão parcelado ou Pix/boleto à vista com desconto.
Garantia de 7 dias corridos a partir da confirmação.

## Capabilities and Constraints

**Ligado no lançamento (4 superfícies):** plano do dia, sessão de questões, progresso, conta. Todo o
resto é construído mas nasce atrás de flag desligada — tutor de dúvidas, tela do Raio-X, gamificação
além da sequência, diagnóstico adaptativo, flywheel, analytics da superfície logada.

**Consequência direta para a landing:** ela SHALL NOT prometer o que está atrás de flag desligada. A
honestidade sobre o que existe hoje é critério de aceite (PAG-08 AC2), não escolha editorial.

**Invariantes de produto que o design não pode contradizer:**

- A IA não decide a alternativa correta — verdade é gabarito oficial + verificação por código.
- O diagnóstico inicial é sempre pulável: é semente, não porteiro.
- O plano é regra e SQL; a IA só escreve a frase, nunca escolhe o que estudar.
- **Sem ranking entre alunos** no lançamento — o público compete de verdade por vaga limitada, e
  expor o mais fraco é dano, não motivação.
- Notificação honesta: teto de ~1 lembrete/dia + 1 aviso de sequência. Nunca mentir para criar urgência.
- Gamificação ligada a progresso real. Sem moeda, sem lojinha, sem avatar infantil.

**Terminologia (PT-BR, travada):** questões, tentativas, matrícula, plano do dia, sessão, Raio-X,
sequência, acervo, proveniência, origem `real` × `inédita`.

**Indeciso — não inventar:** preço final (mora em configuração no banco, não em código); número de
alunos; qualquer estatística de aprovação.

## Brand Commitments

- Nome: **Passou Concursos**. Domínio: `passouconcursos.com`.
- Idioma: PT-BR em tudo que o aluno lê. Voz direta, sem analogia, sem hype.
- A identidade visual anterior (azul `#2f64d6`, papel frio) foi descartada nesta rodada e serve como
  anti-referência, não como base.
- Referência de estilo tornada vinculante pelo usuário para a landing: MindMarket e Duolingo —
  editorial ilustrado sobre papel quente, personagem paper-cut, movimento. Registro em
  `docs/referencias/mindmarket-style.md`.

## Evidence on Hand

- **Existe:** `docs/EVIDENCIAS-CIENTIFICAS.md` — estudos que embasam o método (testing effect, revisão
  espaçada, FSRS). É evidência de **método**, não de resultado do produto.
- **Existe:** o acervo real de questões extraídas de PDF oficial, com proveniência. O número exato de
  questões publicadas SHALL ser lido do banco na hora de escrever a landing — não usar número de
  memória.
- **Não existe, e SHALL NOT ser fabricado:** aluno, depoimento, aprovado, estudo de caso, número de
  aprovação, logo de imprensa, contagem de usuários. O produto ainda não lançou. Confirmado pelo
  usuário em 2026-08-23.

## Product Principles

1. **Honestidade é requisito, não tom.** Declarar o que existe hoje e o que não existe é AC de spec.
   A landing vende o método real, não uma versão futura do produto.
2. **A proveniência é o argumento.** O diferencial defensável é de onde a questão veio e como o
   gabarito foi conferido — não a beleza da tela.
3. **O aluno decide, o produto organiza.** Diagnóstico pulável, plano automático, nada de porteiro.
4. **Sem competição exposta.** O público disputa vaga limitada de verdade; o produto compara o aluno
   com ele mesmo.
5. **A rotina é irregular por definição.** Qualquer promessa de "X minutos por dia" trai a persona.

## Accessibility & Inclusion

WCAG 2.1 AA como piso, codificado como critério de aceite da SPEC 07 (UI-01, UI-03) e já aplicado em
`src/app/globals.css`:

- todo elemento focável tem indicador de foco visível (regra global, não por componente);
- o documento nunca rola horizontalmente — conteúdo largo rola dentro do próprio container;
- zoom nunca é travado (`maximumScale` deliberadamente ausente do viewport);
- contraste mínimo 4.5:1 para texto normal;
- `prefers-reduced-motion` desliga animação globalmente — qualquer motion novo concorda com isso.
