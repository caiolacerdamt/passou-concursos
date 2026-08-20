# A camada de IA — o que está configurado hoje

> Este é um **documento**, e por isso ele pode citar nome de modelo (AD-068). Nenhum arquivo de
> `src/`, `scripts/` ou `tests/` pode — há uma varredura que falha se alguém escrever
> (`src/modules/ia/sem-nome-de-modelo.test.ts`).

## A regra que explica todo o resto

Toda chamada de IA do produto passa pelo **gateway** (`src/modules/ia`). Ele resolve

```
tarefa → (modelo, versão fixada, esforço, batch, cache, fallback)
```

lendo `param.m2.matriz_de_modelos` da tabela `configuracoes`. **Trocar de modelo é inserir uma linha
no banco — não é deploy, não é PR, não é alteração de código.**

A matriz **nasce vazia**. Isso não é esquecimento: é o único jeito de o nome do modelo viver só na
configuração sem ferir a exigência do AD-078 de um default declarado em código. Enquanto não houver
linha, toda tarefa de IA para de forma visível (`TarefaSemPerfil`) e o produto continua funcionando
sem ela — responder questão, ver explicação, receber plano, tudo segue (invariante nº7).

## Provisionar (uma vez)

**1. A chave.** `OPENAI_API_KEY` no `.env` local e em GitHub Secrets. Só ela; a OpenRouter fica de
fora da produção (AD-074).

**2. A matriz.** Cole no SQL Editor do Supabase. Troque `SEU_USER_ID` pelo `id` da sua linha em
`auth.users` — a tabela exige autor em toda alteração (INFRA-11 AC7).

```sql
insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
values (
  'param.m2.matriz_de_modelos',
  '{
    "extracao_pdf":                {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high",  "batch":true, "cache":true, "fallback":null},
    "explicacao":                  {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high",  "batch":true, "cache":true, "fallback":null},
    "classificacao_topico":        {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high",  "batch":true, "cache":true, "fallback":null},
    "verificacao_quantitativa":    {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high",  "batch":true, "cache":true, "fallback":null},
    "reprocessamento_verificacao": {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"max",   "batch":false,"cache":true, "fallback":null},
    "plano_inicial":               {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high",  "batch":false,"cache":true, "fallback":null},
    "frase_do_plano":              {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high",  "batch":false,"cache":true, "fallback":null},
    "tutor":                       {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"medium","batch":false,"cache":true, "fallback":null},
    "rascunho_inedita":            {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high",  "batch":true, "cache":true, "fallback":null}
  }'::jsonb,
  'm2',
  'SEU_USER_ID',
  'matriz inicial: Luna em todas as tarefas (decisao de 2026-08-20)'
);
```

> **Por que Luna em tudo, e o que isso custa.** A AD-073 previa `gpt-5.6-terra` no refaz 1× da
> verificação quantitativa. A decisão de 2026-08-20 foi usar **só a Luna**, que é a mais barata. A
> consequência é que a segunda tentativa não troca de modelo — ela troca **só de esforço**
> (`high` → `max`), e é por isso que a primeira tentativa desceu de `max` para `high`: sem essa
> diferença, o refaz repetiria exatamente a mesma chamada e daria exatamente o mesmo erro. Quem
> revisita isso com dado medido é a **SPEC 22**, que é quem constrói a verificação quantitativa; se a
> taxa de acerto na segunda tentativa for baixa, a Terra volta ao refaz — e é uma linha no banco.

**3. Os preços** (só para somar o gasto; ausência não impede chamada):

```sql
insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
values (
  'param.m2.precos_por_modelo',
  '{
    "gpt-5.6-luna": {"entrada": 0.20, "saida": 1.20, "entrada_cacheada": 0.02}
  }'::jsonb,
  'm2', 'SEU_USER_ID', 'precos vigentes em 2026-08 (AD-073)'
);
```

> Só a Luna está precificada porque só ela está na matriz. Os números vieram do recálculo da AD-073
> (04/08/2026) e **não foram reconferidos em fonte primária** nesta rodada — o efeito de estarem
> errados é a soma do mês ficar torta, nunca uma chamada deixar de acontecer. Reconferir antes de a
> ingestão do acervo rodar em volume (SPEC 09).

Para ver o que está valendo: `npm run ia:matriz`.

## Como cada campo é lido

| Campo | O que é |
| --- | --- |
| `modelo` | o **rótulo da família**. Serve para achar o preço e para ler o relatório |
| `versao` | o **identificador fixado** enviado ao provedor. É o que o IA-02 AC4 exige — nunca um apelido flutuante. Quando a OpenAI publicar um snapshot datado, é aqui que ele entra |
| `esforco` | vai direto em `reasoning.effort`. O código não interpreta o valor |
| `batch` | `true` = a tarefa vai para a Batch API (−50%). Chamada síncrona é **recusada** |
| `cache` | mantém o trecho estável do pedido intacto e na frente, que é o que faz o prompt caching acertar (0,1× da entrada) |
| `fallback` | para onde ir quando o principal falha. `null` = não há para onde, e a falha do principal já é a parada |
| `teto_de_saida` | opcional. Ausente = o que o provedor decidir |

## Trocar de modelo

Insira uma linha nova com a matriz inteira já alterada. A tabela é **append-only** (AD-081): a linha
anterior fica como histórico, e o valor vigente é a última. Leva até 30 segundos para pegar (janela
de cache da configuração) e não precisa de deploy.

⚠️ **Um perfil malformado invalida a matriz inteira**, não só a linha errada — o valor cai para o
default `{}` e toda tarefa de IA para. É queda segura de propósito (nunca um modelo adivinhado), mas
significa que um erro de digitação derruba tudo. Confira com `npm run ia:matriz` depois de trocar.

## O que ainda não existe

| O quê | Onde entra |
| --- | --- |
| Envio e colheita do arquivo de lote (Batch API) | **SPEC 09** — o gateway já monta a linha JSONL |
| Grounding, citação conferida por código | SPEC 10 |
| Catálogo de fórmulas e verificação quantitativa | SPEC 22 — aqui só existe o mecanismo genérico de refazer 1× |
| Eval cego como porteiro e revisão trimestral da matriz | SPEC 30 |
| Tutor e streaming | SPEC 24 |
| Embeddings | **nunca passam pelo gateway** — chamada direta ao Cohere (SPEC 23, AD-005) |

Duas chamadas de IA de outros módulos **não estão** na lista fechada de tarefas e exigem decisão
registrada antes de serem construídas: pré-diagnóstico de questão suspeita (SPEC 29) e extração do
programa do edital (SPEC 27).
