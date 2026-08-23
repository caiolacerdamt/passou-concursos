# Segredos — onde cada um vive

> **INFRA-10.** Segredo nunca mora no código. Este documento diz **onde cada um vive**, **quem o usa**
> e **o que fazer quando vazar**. A regra é conferida por `scripts/varredura-de-segredos.mjs`, que roda
> em toda execução da CI.

## A regra em uma frase

O valor de um segredo existe em **três lugares e só três**: o `.env` da sua máquina (que o git
ignora), os **segredos do repositório no GitHub** (para a CI e os jobs) e as **variáveis de ambiente
da hospedagem** (Vercel e Supabase, quando existirem — SPEC 16). O repositório guarda apenas o
`.env.example`, que documenta **o nome** de cada variável, nunca o valor.

## Inventário

| Variável | É segredo? | Máquina (`.env`) | GitHub Secrets | Vercel / Supabase | Quem usa |
| --- | --- | --- | --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | **sim** | ✅ | ✅ (`SUPABASE_ACCESS_TOKEN`) | — | Supabase CLI, `npm run advisors` |
| `DATABASE_URL` | **sim** (tem a senha do banco) | ✅ | ✅ (`DATABASE_URL`) | — | `npm run db:push`, testes de banco, vigia de jobs, workflow de migração |
| `SUPABASE_SECRET_KEY` | **sim** (passa por cima da RLS) | ✅ | — | Vercel (SPEC 16) | leitura e escrita de configuração no servidor |
| `NEXT_PUBLIC_SUPABASE_URL` | não | ✅ | — | Vercel (SPEC 16) | cliente Supabase |
| `NEXT_PUBLIC_SENTRY_DSN` | **não** — vai para o navegador por desenho | ✅ | ✅ (`SENTRY_DSN`) | Vercel (SPEC 16) | os três `Sentry.init` e os scripts de job |
| `SENTRY_AUTH_TOKEN` | **sim** | opcional | ✅ | Vercel (SPEC 16) | upload de source map no build |
| `OPENAI_API_KEY` | **sim** | — (SPEC 07) | — (SPEC 07) | — | gateway de IA |
| `COHERE_API_KEY` | **sim** | — (SPEC 11) | — (SPEC 11) | — | embeddings |
| `RESEND_API_KEY` | **sim** | ✅ | ✅ | Vercel / Supabase | confirmação do apagamento antes de invalidar Auth (SPEC 14) |
| `RESEND_FROM` | não (configuração) | ✅ | ✅ | Vercel / Supabase | remetente verificado do e-mail de privacidade (SPEC 14) |

**Sobre o DSN do Sentry.** Ele não é segredo: o SDK do navegador precisa dele, então ele aparece no
pacote que qualquer visitante baixa. Ele mora nos segredos do repositório apenas porque é o mesmo
lugar de todo o resto do ambiente — não por sigilo. O que **é** segredo é o `SENTRY_AUTH_TOKEN`.

## O que a CI reprova

`scripts/varredura-de-segredos.mjs` varre todo arquivo versionado e reprova quando encontra:

- token de acesso do Supabase (`sbp_…`) e chave secreta do Supabase (`sb_secret_…`)
- token de autenticação do Sentry (`sntrys_…`)
- chave da OpenAI (`sk-…`), chave de produção de gateway (`sk_live_…`, `rk_live_…`)
- token do Slack, chave de acesso da AWS, token do GitHub, chave da Google
- bloco de chave privada (`-----BEGIN … PRIVATE KEY-----`)
- **senha dentro de string de conexão do Postgres** (`postgres://usuario:senha@…`)
- o próprio `.env` versionado

Ela também **não** trata o DSN do Sentry como segredo — há teste negativo para isso, para a regra não
virar alarme falso que o time aprende a ignorar.

Cada padrão tem um caso de teste em `scripts/varredura-de-segredos.test.ts`, e há um teste que roda a
varredura em cima do repositório inteiro **sem nenhuma exceção** — nem o próprio arquivo de teste é
isento. É por isso que os exemplos lá são montados por concatenação.

## Se um segredo vazar

1. **Rotacione a chave. Primeiro, antes de qualquer outra coisa.** Apagar o commit não resolve: ela já
   esteve no histórico do git, e quem clonou antes continua com ela. Um `git push --force` só some com
   o rastro, não com o vazamento.
2. Troque o valor nos três lugares do inventário.
3. Só então limpe o repositório, se quiser.

Onde rotacionar cada um:

| Segredo | Onde rotacionar |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens → revogar e gerar outro |
| `DATABASE_URL` | Supabase → Project Settings → Database → Reset database password |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret keys |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens |
| `RESEND_API_KEY` | Resend → API Keys → revogar a chave exposta e gerar outra |

## Cadastrar um segredo no repositório

GitHub → o repositório → **Settings** → **Secrets and variables** → **Actions** → **New repository
secret**. O nome tem de bater com o que o workflow lê.

Hoje os workflows leem: `DATABASE_URL`, `SENTRY_DSN` e `SUPABASE_ACCESS_TOKEN`.

**Ausência de segredo não é sempre a mesma coisa.** A regra do projeto:

| Situação | Comportamento | Por quê |
| --- | --- | --- |
| Teste de banco sem `DATABASE_URL` | **pula**, com aviso | quem clona o repositório sem credencial ainda consegue rodar `test:unit` |
| Migração por CI sem `DATABASE_URL` | **falha** | migração que não aplica é um problema, não uma ausência |
| Vigia de jobs sem `DATABASE_URL` | **falha** | vigia que não consegue olhar é pior que vigia nenhum: parece que olhou |
| Qualquer coisa sem `SENTRY_DSN` | segue, escrevendo no log | o alerta é desejável; a visibilidade no log é o piso |
