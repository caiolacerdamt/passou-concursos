# SPEC 38 — Leitor de prova: grade declarada, itens e etiqueta barata

| | |
| --- | --- |
| **Ordem** | 38 de 40 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 08, SPEC 09, SPEC 37 |
| **Habilita** | SPEC 39, 40 |
| **Tasks (estimativa)** | ~11 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Difícil |
| **Status** | ✅ Concluída (2026-09-06, branch `feat/spec38-leitor-de-prova`) |
| **Requisitos** | **BANCO-14**, **BANCO-15**, **BANCO-16** |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` |
| **Decisões** | **AD-138**, AD-140 · herda AD-003 (fonte legal), AD-035/AD-036 (job fora do serverless), AD-068 (modelo em configuração), AD-041 (`precisa_ocr`) |

## Problem Statement

Hoje o Raio-X só sabe contar o que virou `questao` — objeto caro: enunciado, alternativas, gabarito
cruzado, explicação conferida. Isso amarra "medir o que a banca cobra" ao custo de "montar acervo", e
é por isso que abrir um concurso novo parece exigir milhares de questões. Não exige: para medir bastam
`(prova, número do item, assunto)`. Medido em 2026-09-05 sobre a CAIXA 2021 Técnico Bancário Novo — 60
itens: extrair o texto do PDF levou **0,13s e custou zero**; a prova **declara a própria grade** no
documento (LP 10 · MF 10 · CB 10 · Prob 5 · Info 10 · Atendimento 15 = 60), lida por código sem IA; e
etiquetar os 60 itens custou **R$ 0,024** (R$ 0,012 em Batch). O mesmo teste mostrou o limite: a
separação por regra de texto fechou 6 das 23 provas de `fontes/entrada/` e perdeu itens nas outras —
então determinismo primeiro, IA de reserva, e a grade declarada conferindo os dois.

## Goals

- [x] Uma prova vira grade declarada + itens separados + etiquetas, por comando, em GitHub Actions.
- [x] Nenhum PDF entra no contexto de conversa de agente; o agente lê resumo, não prova.
- [x] Quando o separador determinístico fecha com a grade, **nenhuma chamada a modelo acontece**.
- [x] Divergência entre etiqueta e grade declarada é pega **automaticamente**, nunca passa em silêncio.
- [x] Correção humana sobrevive a qualquer reexecução.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-15 | blocos declarados (nome impresso, faixa de itens, pontuação por item), `itens_declarados`, `itens_ingeridos`, `cobertura`, base pontos × contagem, grade ausente vai para fila humana, soma inconsistente barra a prova | m1 §P1: A prova declara a própria grade |
| BANCO-16 | separação por regra de texto primeiro; aceite sem modelo quando fecha com a grade; reserva por modelo quando não fecha; sem camada de texto vai para `precisa_ocr`; divergência acima da tolerância vai para conferência; caderno único por `(banca, ano, órgão, cargo)` | m1 §P1: Separação determinística com IA de reserva |
| BANCO-14 | `etiquetas_de_item` com `origem ∈ {ia, humano}` e versão do modelo; unicidade por `(prova, número)`; questão publicada é a verdade; humano vence IA; reexecução substitui só as de IA | m1 §P1: Etiqueta de item |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| A conta do Raio-X sobre esses dados | SPEC 39 |
| Busca dos PDFs em fonte oficial | SPEC 40 |
| Tela de aprovação de assunto novo e fusão de duplicata | SPEC 40 |
| Extração completa de questão (enunciado, alternativas, gabarito, explicação) | já existe — SPEC 09/10. Esta spec **não** a substitui |
| OCR de prova escaneada | fila `precisa_ocr` da SPEC 09 (aqui só o roteamento para ela) |

## Contratos que esta spec fixa para as próximas

- **A grade declarada é o gabarito de qualidade do etiquetador.** A SPEC 39 pode confiar em qualquer
  prova marcada consistente, e a SPEC 40 mostra ao operador só o que divergiu.
- **`cobertura` é público.** A SPEC 39 usa como piso de entrada; a SPEC 40 usa para dizer ao operador
  qual prova terminar de ingerir.
- **Modelo em configuração, nunca no código** (AD-068). O etiquetador lê a matriz do gateway (SPEC 08).
- **Etiqueta nunca vira questão.** Publicar questão continua sendo o caminho da SPEC 09/10, com todas
  as travas de proveniência e gabarito.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Extrator de texto | leitor nativo de PDF, sem modelo; `precisa_ocr` quando não há camada de texto | y (medido: 23 de 24 PDFs têm texto) |
| Detecção de cabeçalho de bloco | cabeçalho de página se repete, cabeçalho de matéria não; a contagem separa os dois, sem lista fixa | n (default registrado — validado em 1 prova) |
| Tolerância de divergência etiqueta × grade | configuração (`param.m1.tolerancia_grade`), início em zero item de folga | n (calibra) |
| Piso de cobertura para a prova contar | configuração (`param.m1.cobertura_minima`) | n (calibra) |
| Tamanho do lote de itens por chamada | configuração; medido a 20 itens por chamada | n (calibra) |
| Custo por prova | R$ 0,01 quando o separador fecha; ~R$ 0,05 na reserva; ~R$ 0,30 com OCR (dólar a R$ 5,40) | n (medido em 1 prova, dia 2026-09-05) |
| Prova que não declara pontuação por item | peso do bloco em contagem de itens, com a base registrada na linha | y (BANCO-15 AC3) |
| Redação e discursiva | fora da grade objetiva; registradas na prova, não entram no peso | n (default registrado) |

**Open questions:** none — o que resta acima é calibração de parâmetro, com default e local registrados.

## Success Criteria

- [x] CAIXA 2021 Técnico Bancário Novo produz 6 blocos somando 60 itens, iguais à capa, sem chamar modelo
- [x] Adulterar um cabeçalho derruba a prova como inconsistente, em vez de gerar peso errado
- [x] Uma prova que o separador não fecha cai na reserva por modelo e fica marcada como tal
- [x] BB 2021 provas A, B e C contam como **uma** prova no peso do ano
- [x] Corrigir três etiquetas à mão e reexecutar preserva as três e não duplica nenhuma linha
- [ ] Custo real de uma prova fica dentro da faixa registrada, e o número medido é anotado na spec —
      **pendente**: a medição custa uma chamada paga e não foi autorizada; ver a seção abaixo
- [x] Nenhum PDF aparece no transcript do agente — só o relatório do comando

## O que a implementação mediu (2026-09-06)

Rodando o código desta spec sobre as 24 provas de `fontes/entrada/`:

| Prova | Grade | Blocos | Declarados | Separados pelo código | Fecha? |
| --- | --- | --- | --- | --- | --- |
| CAIXA 2021 Técnico Bancário Novo | lida | **6** | **60** | **60** | **sim, sem chamar modelo** |
| BB 2021 Prova A | lida | 8 | 70 | 20 | não → reserva |
| BB 2021 Prova B | lida | 8 | 70 | 17 | não → reserva |
| BB 2021 Prova C | lida | 8 | 70 | 70 | sim |
| Outras 20 | ausente (17), sem texto → `precisa_ocr` (1), ilegíveis pelo leitor mínimo (6) | — | — | — | — |

Dois números da spec ficaram **não confirmados de propósito**, e é honesto dizer:

- **Custo real por prova**: não medido nesta rodada, porque a chamada ao provedor **custa dinheiro** e
  não foi autorizada. A matriz já tem as duas linhas (`etiqueta_de_item` e `separacao_de_itens` na
  Luna, esforço `max`, síncronas — decisão de 2026-09-06), então medir é um comando só:
  `npm run jobs:medir-prova -- --acao etiquetar --prova b914f7d8-de48-459c-965e-7500149fa002 --pdf
  "fontes/entrada/CAIXA 2021 PcD - PROVA - TECNICO BANCARIO NOVO.pdf"` (o id é o da CAIXA 2021 PcD já
  catalogada). O número de 2026-09-05 (R$ 0,024 por 60 itens) continua sendo a única medição, e ela
  sustenta o AD-138.
- **Grade "ausente" em 17 provas**: o leitor cobre o formato CESGRANRIO medido. Prova de outra banca
  cai na fila humana, que é o comportamento que o BANCO-15 AC4 pede — não é um furo, é o lado seguro
  do erro. Quem completa a grade dessas provas é a tela da SPEC 40.
