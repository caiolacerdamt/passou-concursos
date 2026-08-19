# Deploy — o que o código não faz sozinho

> **Requisito**: INFRA-01 AC1 (região São Paulo) · **AD-035** · SPEC 07.
>
> Tudo nesta página é **trabalho manual em painel de terceiro**. O repositório já
> traz o que é código: `vercel.json` fixa a região `gru1` e as variáveis estão
> documentadas em `.env.example`. O que falta é ligar as contas — e isso ninguém
> automatiza sem já ter a conta.

## 1. Vercel — ligar o repositório

1. Criar a conta em <https://vercel.com> e importar o repositório
   `caiolacerdamt/saas_concurso`.
2. Framework: **Next.js** (detecta sozinho). Não mexer no comando de build.
3. **Production Branch**: `main`. É o que faz "merge na `main` publica sozinho".
4. Conferir em *Settings → Functions* que a região é **`gru1` (São Paulo)**. O
   `vercel.json` já declara, mas conta nova costuma nascer com `iad1` no painel —
   se os dois discordarem, corrigir no painel.

⚠️ **Plano.** O `Hobby` basta para a SPEC 07. O `Pro` vira requisito só quando a
flag do tutor ligar (SPEC 24, timeout de streaming) — **não** é requisito do
lançamento (AD-076).

## 2. Vercel — variáveis de ambiente

Em *Settings → Environment Variables*, para o ambiente **Production**:

| Variável | Valor | É segredo? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto `kfpmetkmhjtmgwgaaerl` | não |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave `sb_publishable_...` | não |
| `SUPABASE_SECRET_KEY` | chave `sb_secret_...` | **sim** |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN do projeto `passou-concursos` | não (AD-087f) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` | não |
| `SENTRY_AUTH_TOKEN` | token de upload de source map | **sim** |
| `NEXT_PUBLIC_SITE_URL` | `https://<domínio próprio>` | não |

O `NEXT_PUBLIC_SITE_URL` **não é opcional em produção**: sem ele, o link de
"defina sua senha" é montado a partir do cabeçalho `Host` do pedido, que é
escrito por quem chama. Ver `src/modules/conta/origem.ts`.

## 3. Domínio próprio

1. Registrar o domínio e apontar o DNS conforme *Settings → Domains* da Vercel.
2. Depois que o domínio responder, preencher `NEXT_PUBLIC_SITE_URL` com ele e
   **redeployar** — variável de ambiente só entra em build novo.

## 4. Supabase Auth — o que precisa ser configurado no painel

Em *Authentication → URL Configuration*:

- **Site URL**: o domínio próprio.
- **Redirect URLs**: acrescentar `https://<domínio>/auth/callback` e
  `http://localhost:3000/auth/callback`.

Em *Authentication → Providers → Google*:

1. Criar as credenciais OAuth no Google Cloud Console (tipo *Web application*).
2. **Authorized redirect URI** no Google: o endereço que o próprio painel do
   Supabase exibe (`https://kfpmetkmhjtmgwgaaerl.supabase.co/auth/v1/callback`) —
   **não** o `/auth/callback` do produto.
3. Colar *Client ID* e *Client Secret* no Supabase e ligar o provedor.

Em *Authentication → Providers → Email*: manter "Confirm email" **ligado**.

⚠️ **Não desligue "Confirm email" para encurtar o funil.** É dela que depende o
Success Criteria "entrar por e-mail+senha e por Google com o mesmo e-mail leva à
mesma conta" (PAG-07 AC1): com a confirmação desligada, o Supabase cria um
**segundo** usuário quando a mesma pessoa entra pelo Google, e o aluno perde o
histórico sem nenhum erro aparecer. Nada no repositório acusa isso — é opção de
painel, e o preço dela aparece semanas depois, no suporte.

⚠️ Enquanto o provedor do Google não estiver ligado no painel, o botão "Entrar
com Google" existe na tela e devolve o aviso de "não foi possível continuar com
o Google". É o comportamento correto — a tela não some, ela degrada.

## 5. O que continua fora

- **Preview por branch** e **branch do Supabase** (INFRA-07): SPEC 25. Exige
  Supabase Pro, que é custo sem aluno.
- **Migração aplicada por CI a produção** (INFRA-01 AC3): a SPEC 03 já aplica
  migração por CI; o gate de "só depois do merge" fecha junto do staging, na 25.
- **Backup e retenção de 7 dias**: exige Supabase Pro. Continua pendente.
