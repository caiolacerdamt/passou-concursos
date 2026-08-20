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
    "extracao_pdf":                {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high","batch":true, "cache":true, "fallback":null},
    "explicacao":                  {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high","batch":true, "cache":true, "fallback":null},
    "classificacao_topico":        {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high","batch":true, "cache":true, "fallback":null},
    "verificacao_quantitativa":    {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"max", "batch":true, "cache":true, "fallback":null},
    "reprocessamento_verificacao": {"modelo":"gpt-5.6-terra","versao":"gpt-5.6-terra","esforco":"max","batch":false,"cache":true, "fallback":null},
    "plano_inicial":               {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high","batch":false,"cache":true, "fallback":null},
    "frase_do_plano":              {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high","batch":false,"cache":true, "fallback":null},
    "tutor":                       {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"medium","batch":false,"cache":true,"fallback":null},
    "rascunho_inedita":            {"modelo":"gpt-5.6-luna","versao":"gpt-5.6-luna","esforco":"high","batch":true, "cache":true, "fallback":null}
  }'::jsonb,
  'm2',
  'SEU_USER_ID',
  'matriz inicial do AD-073 (SPEC 08)'
);
```

**3. Os preços** (só para somar o gasto; ausência não impede chamada):

```sql
insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
values (
  'param.m2.precos_por_modelo',
  '{
    "gpt-5.6-luna":  {"entrada": 0.20, "saida": 1.20, "entrada_cacheada": 0.02},
    "gpt-5.6-terra": {"entrada": 1.25, "saida": 10.00, "entrada_cacheada": 0.125}
  }'::jsonb,
  'm2', 'SEU_USER_ID', 'precos vigentes em 2026-08 (AD-073)'
);
```

> Os preços da Terra ainda **não** foram conferidos em fonte primária nesta rodada. Enquanto não
> forem, a soma do mês pode subestimar o refaz 1×. Conferir antes da SPEC 22, que é quem usa a Terra.

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
