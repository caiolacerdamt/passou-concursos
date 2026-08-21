# Ingerir uma prova — do PDF oficial às questões no banco

> O acervo é o fosso. Ele não sai de API nenhuma: sai do **PDF oficial da banca**
> (Lei 9.610/1998, art. 8º IV). Raspar concorrente é proibido — não é preferência, é ilegal aqui.

Este documento é o passo a passo do operador. O que está por trás está na
[SPEC 09](../.specs/features/09-ingestao-do-primeiro-lote/tasks.md).

## O que acontece, em três frases

1. **`enviar`** lê o PDF, decide se ele tem texto nativo, corta em blocos de páginas que caibam no
   teto de tokens e manda para a Batch API da OpenAI.
2. **`colher`**, horas depois, pega o que voltou, confere questão por questão e grava — cada uma como
   `rascunho`, ou `em_revisao` quando tem figura.
3. **`gabarito`** cruza o gabarito definitivo por número de questão, marca as anuladas e transforma
   qualquer retificação em uma **versão nova** da questão.

Nada disso roda na Vercel. Roda em GitHub Actions ou na sua máquina (AD-036) — há um teste que falha
se alguém importar o pipeline de dentro de uma rota.

## Antes de começar

| O que | Onde |
| --- | --- |
| O PDF oficial, com texto nativo | na sua máquina, ou num caminho do repositório se for pelo Actions |
| A linha da prova em `provas` | você cataloga à mão — é dela que sai a proveniência |
| `OPENAI_API_KEY` | `.env` local e GitHub Secrets |
| `param.m2.matriz_de_modelos` na tabela `configuracoes` | ver [`docs/IA.md`](IA.md) — **a matriz nasce vazia de propósito** |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` | para a imagem da questão ir ao Storage |
| O bucket do Storage (`questoes`, por padrão) | crie no painel do Supabase, privado |

Catalogar a prova:

```bash
psql "$DATABASE_URL" -c "insert into public.provas (banca, ano, orgao, cargo, caderno) values ('Cesgranrio', 2023, 'Banco do Brasil', 'Escriturario', 'Tipo 1') returning id;"
```

Guarde o `id` que voltou: é o `--prova` de todos os comandos abaixo.

## 1. Enviar

```bash
npm run jobs:ingestao -- --prova <uuid> --pdf ./provas/bb-2023.pdf --acao enviar
```

O que pode acontecer:

- **`precisa_ocr`** — o PDF não tem texto nativo (é escaneado). A prova é marcada e **nenhuma chamada
  ao modelo acontece**. OCR está fora do MVP (AD-041); a fila existe para depois.
- **`N páginas em M blocos; K enviados agora`** — o normal.
- **`0 enviados`** — todos os blocos já tinham sido enviados antes. Isso é a retomada funcionando,
  não um erro.
- **parada com o número de uma página** — uma página sozinha estourou o teto de tokens. Não truncamos:
  meia página produziria questões pela metade. Baixe `param.m1.teto_tokens_por_pedido` não resolve;
  o caminho é cortar aquele PDF.

## 2. Colher

O lote da OpenAI tem janela de até 24 horas. Rodar antes da hora **não é erro**:

```bash
npm run jobs:ingestao -- --prova <uuid> --pdf ./provas/bb-2023.pdf --acao colher
```

O mesmo PDF vai de novo porque as **imagens** moram nele — só o texto foi ao modelo.

- `X blocos colhidos, Y ainda no provedor` — rode de novo mais tarde para os Y.
- `Prova extraída.` — todos os blocos fecharam.
- Questão recusada aparece no log com o número e o motivo. Ela não derruba as irmãs do bloco: o bloco
  já foi pago inteiro.

Colher duas vezes não duplica nada — nem questão, nem custo.

## 3. Cruzar o gabarito

Dois formatos. JSON, com a versão dentro:

```json
{
  "versao": "definitivo-2023-10-05",
  "itens": [
    { "numero": 1, "resposta": "C" },
    { "numero": 2, "anulada": true }
  ]
}
```

CSV, com a versão declarada por fora (é o que sai de uma planilha):

```
numero,resposta,anulada
1,C,
2,,sim
```

```bash
npm run jobs:gabarito -- --prova <uuid> --gabarito ./provas/bb-2023-gabarito.csv --versao definitivo-2023-10-05
```

**A versão é obrigatória.** Sem ela, aplicar uma retificação e rodar o mesmo arquivo duas vezes seriam
a mesma coisa para o banco.

O que o comando faz com cada questão:

| Situação | O que acontece |
| --- | --- |
| ainda sem gabarito | preenche `resposta_correta` e `gabarito_versao` |
| gabarito anula | `anulada = true`, e a questão **é mantida** — ela conta na frequência do Raio-X e não vira treino |
| mesmo gabarito de novo | nada muda |
| mesma letra, rótulo de versão novo | carimba o rótulo; é mudança cosmética |
| **letra diferente** | nasce uma `questao_versao` nova, marcada `substantiva`. A anterior fica congelada, e quem já respondeu continua apontando para ela |

Se o gabarito chegar antes de a extração terminar, ele conta os itens sem questão e **espera** — rode
de novo depois.

## Pelo GitHub Actions

Actions → **Ingestão de prova** → *Run workflow*. Escolha `enviar`, `colher` ou `gabarito`, informe o
id da prova e o caminho do arquivo dentro do repositório.

## Depois disso

Toda questão está em `rascunho` ou `em_revisao`. **Nenhuma chega ao aluno**: publicar é da SPEC 10,
que traz o piso de confiança, a fila de revisão e a porta de publicação. Tópico que a IA sugeriu e que
não existe na taxonomia virou `topico_candidato` — quem aprova é o operador, na tela da SPEC 15.

## Os números que dá para mexer sem deploy

Todos vivem na tabela `configuracoes` (AD-078):

| Chave | Padrão | O que é |
| --- | --- | --- |
| `param.m1.teto_tokens_por_pedido` | 272000 | o degrau de preço da OpenAI. Acima dele, 2× a entrada e 1,5× a saída |
| `param.m1.margem_do_teto` | 0.2 | folga, porque a contagem do nosso lado é estimativa |
| `param.m1.chars_por_token` | 3.5 | a estimativa. Calibra comparando com o `usage` que voltou em `ia_geracoes` |
| `param.m1.bucket_de_imagens` | `questoes` | onde a figura da questão é guardada |

## Limites conhecidos

- **O texto é extraído aqui, não pelo modelo.** É o que permite decidir `precisa_ocr` e cortar em
  blocos sem reenviar a prova inteira a cada pedido. Fonte com codificação exótica sai com acento
  torto; fonte assim na prova inteira faz a prova cair em `precisa_ocr`, que é o lado seguro do erro.
- **Só imagem JPEG é extraída.** Bitmap comprimido com Flate exigiria um codificador PNG. A questão
  que dependia dele vai para revisão com `imagens` vazio — meia imagem é pior do que nenhuma.
- **Toda questão com figura nasce `em_revisao`**, mesmo quando a imagem sobe. O `alt_text` acessível
  só existe depois que uma pessoa olha a figura, e o modelo leu o texto da prova, nunca a imagem.
- **A verificação da conta em questão quantitativa é manual no primeiro lote** (SPEC 22).
