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

Em *Settings → Environment Variables*, marcando **Production** (e Preview, se
quiser que os preview builds funcionem).

São **6 obrigatórias** e 1 opcional. As quatro `NEXT_PUBLIC_` vão para o
navegador de propósito — não são segredo, e não adianta escondê-las.

| # | Variável | Valor | Onde pegar | Segredo? |
| --- | --- | --- | --- | --- |
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | `https://kfpmetkmhjtmgwgaaerl.supabase.co` | já é este | não |
| 2 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Supabase → *Project Settings → API Keys → Publishable key* | não |
| 3 | `SUPABASE_SECRET_KEY` | `sb_secret_...` | Supabase → *Project Settings → API Keys → Secret keys* | **SIM** |
| 4 | `NEXT_PUBLIC_SENTRY_DSN` | o DSN do projeto `passou-concursos` (está no seu `.env` local) | Sentry → *Settings → Client Keys (DSN)* | não (AD-087f) |
| 5 | `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` | valor literal | não |
| 6 | `NEXT_PUBLIC_SITE_URL` | `https://www.passouconcursos.com` | **só depois** que o domínio responder — ver seção 3 | não |
| 7 | `SENTRY_AUTH_TOKEN` | token de upload de source map | Sentry → *Settings → Auth Tokens* | **SIM** |

**Ordem**: 1 a 5 podem entrar agora, antes do domínio. A **6** só faz sentido
depois do passo 3, e exige **redeploy** — variável de ambiente não vale para
build já feito.

Sobre a **7**: é a única opcional. Sem ela o build passa e o Sentry funciona; o
que se perde é o *source map*, ou seja, o erro aparece apontando para o código
minificado em vez do arquivo original. Vale a pena, mas não trava o deploy.

⚠️ `NEXT_PUBLIC_SITE_URL` **não é opcional em produção** (por isso está na lista
das obrigatórias, e não junto da 7): sem ela, o link de "defina sua senha" é
montado a partir do cabeçalho `Host` do pedido, que é escrito por quem faz o
pedido. Ver `src/modules/conta/origem.ts`.

⚠️ **`DATABASE_URL` não vai para a Vercel.** Ela é a conexão direta do Postgres,
usada por migração e por teste — o site fala com o banco pelo Supabase, não por
ela. Colocá-la lá seria expor a senha do banco sem nenhum ganho.

## 3. Domínio próprio — `passouconcursos.com`, DNS na Hostinger

O domínio está registrado na **Hostinger**. A escolha aqui é manter o DNS **na
Hostinger** e só apontar dois registros para a Vercel — em vez de trocar os
nameservers. Trocar nameservers moveria *todo* o DNS do domínio para a Vercel, e
qualquer registro de e-mail que exista hoje (MX) precisaria ser recriado lá. Dois
registros resolvem, e o e-mail não é tocado.

### Passo 1 — pedir os valores à Vercel (antes de mexer na Hostinger)

Na Vercel: *Settings → Domains → Add Domain* → `passouconcursos.com`. Ela vai
sugerir acrescentar `www.passouconcursos.com` — **aceite**, é a configuração
recomendada.

A Vercel então mostra um cartão por domínio com os valores exatos.
**Copie de lá, não daqui.**

⚠️ **Não use valor decorado da internet.** O IP do registro A e o alvo do CNAME
são **por projeto**: o `76.76.21.21` e o `cname.vercel-dns.com` que aparecem em
tutoriais antigos valem para projetos antigos. Projeto novo recebe endereço de um
pool, e o CNAME tem forma de `d1d4fc829fe7bc7c.vercel-dns-017.com`. Usar o valor
errado dá domínio que não verifica, sem mensagem clara do porquê.

### Passo 2 — criar os registros na Hostinger

No painel da Hostinger: *Domínios → passouconcursos.com → **DNS / Nameservers*** →
seção **Registros DNS**.

| Tipo | Nome (Host) | Aponta para | TTL |
| --- | --- | --- | --- |
| `A` | `@` | o IP que **o cartão da Vercel mostrar** | 3600 (ou o menor disponível) |
| `CNAME` | `www` | o alvo que **o cartão da Vercel mostrar** | 3600 |

Os valores que a Vercel entregou para **este** projeto em 2026-08-19 — anotados
para conferência, **não** para copiar sem olhar o cartão:

| Tipo | Nome | Valor |
| --- | --- | --- |
| `A` | `@` | `216.198.79.1` |
| `CNAME` | `www` | `b7aa9575f84c94a9.vercel-dns-017.com` |

Repare que o IP **não** é o `76.76.21.21` que circula em tutorial, e o CNAME não
é `cname.vercel-dns.com`. O próprio painel da Vercel diz que os dois antigos
continuam funcionando — mas os corretos para este projeto são os de cima.

O `CNAME` aparece no painel com **ponto final** (`...vercel-dns-017.com.`). Cole
**sem** o ponto na Hostinger.

Estado do DNS antes da mudança (2026-08-19), e **o que precisa ser apagado antes
de adicionar**:

| Tipo | Nome | Conteúdo | Ação |
| --- | --- | --- | --- |
| `ALIAS` | `@` | `...cdn.hstgr.net` | **apagar primeiro** |
| `CNAME` | `www` | `www.passouconcursos.com.cdn.hstgr.net` | apagar |

⚠️ **Consultar o DNS de fora não mostra o que a zona contém.** Um `nslookup` em
`passouconcursos.com` devolvia dois IPs (`91.108.127.250` e `89.116.213.214`), o
que parece dois registros `A` — mas a zona tinha **um `ALIAS`**, e aqueles IPs
eram o resultado dele já resolvido. A diferença importa porque a Hostinger recusa
o `A` novo com

```
DNS record validation error : RRset passouconcursos.com IN ALIAS
must not be used with A on the same name.
```

`ALIAS` e `A` não coexistem no mesmo nome. Apagar o `ALIAS` destrava.

**Nenhum registro `MX`**: não há e-mail neste domínio, então não há o que
preservar. Se um dia houver, os `MX` e o `TXT` de SPF **não** são tocados por
nada disto.

Detalhes da Hostinger que costumam atrapalhar:

- **`@` é o domínio raiz.** Alguns campos da Hostinger já completam o domínio
  sozinhos — se o painel mostrar `@.passouconcursos.com`, o campo espera só `@`
  mesmo. O mesmo vale para `www`: escreva `www`, não `www.passouconcursos.com`.
- **Apague o registro que já existe.** Domínio novo da Hostinger nasce com um `A`
  em `@` apontando para o parking dela, e às vezes um `CNAME` em `www`. Dois
  registros `A` no mesmo nome fazem o tráfego alternar entre a Vercel e a página
  de parking — o sintoma é "às vezes funciona".
- **Não mexa nos registros `MX`** nem no `TXT` de SPF, se houver. Eles são de
  e-mail e não têm relação com o site.
- **Propagação**: minutos na maioria das vezes, até 24–48h no pior caso. A Vercel
  troca o status do domínio para *Valid Configuration* sozinha quando enxergar.

### Passo 3 — apex ou www como principal

Deixe **`www.passouconcursos.com` como Primary** na Vercel e o apex
(`passouconcursos.com`) redirecionando para ele. É o que a Vercel recomenda, e o
motivo é prático: `www` é um `CNAME`, então o endereço por trás pode mudar sem
você tocar no DNS; o apex é um `A` com IP fixo.

Se preferir o apex como principal — é uma escolha legítima e o endereço fica mais
curto —, inverta o redirecionamento na Vercel. **O que não pode é os dois
responderem sem redirecionar um para o outro**: o mesmo conteúdo em dois
endereços divide o Google e, mais concreto aqui, faz a sessão do aluno valer num
endereço e não no outro, porque o cookie é gravado por domínio.

### Passo 4 — só depois que o domínio responder

Preencher `NEXT_PUBLIC_SITE_URL` na Vercel com o endereço **principal, com
`https://` e sem barra no fim** (ex.: `https://www.passouconcursos.com`) e
**redeployar** — variável de ambiente só entra em build novo.

Depois disso, voltar ao Supabase e acrescentar `https://www.passouconcursos.com`
como *Site URL* e `https://www.passouconcursos.com/auth/callback` nas *Redirect
URLs* (seção 4 abaixo). Enquanto isso não for feito, o login por Google volta
para o endereço errado.

## 4. Supabase Auth — o que precisa ser configurado no painel

Em *Authentication → URL Configuration*:

- **Site URL**: o domínio próprio.
- **Redirect URLs**: acrescentar `https://<domínio>/auth/callback`,
  `https://<domínio>/auth/confirm`, `http://localhost:3000/auth/callback` e
  `http://localhost:3000/auth/confirm`.

### Templates de e-mail — a fonte é `docs/emails/`, não o painel

O texto que o aluno recebe é produto, e produto mora no repositório. Os dois
templates que este produto usa de verdade vivem em `docs/emails/`, e sobem por
script:

```bash
node scripts/aplicar-emails-auth.mjs          # mostra o diff, não escreve
node scripts/aplicar-emails-auth.mjs --sim    # aplica
```

O script grava o estado anterior em `.temp/auth-config-backup-<hora>.json`
antes de tocar em qualquer coisa, e confere o que voltou. Editar direto no
painel funciona, mas deixa o texto sem histórico e sem revisão — e a próxima
pessoa que abrir a caixa não tem como saber se o que está lá é o que deveria.

| Template | Arquivo | Quem dispara |
| --- | --- | --- |
| **Confirm signup** | `docs/emails/confirm-signup.html` | `/criar-conta` (conta gratuita, AD-133) |
| **Reset Password** | `docs/emails/reset-password.html` | "defina sua senha" pós-pagamento **e** `/recuperar-senha` |

Os outros — *Invite user*, *Magic Link*, *Change Email Address*,
*Reauthentication* e as notificações de segurança — **não são disparados por
nenhum caminho do produto hoje**. Link mágico é da SPEC 25; as notificações
estão desligadas no painel. Traduzir e estilizar todos eles agora seria
manutenção para e-mail que ninguém recebe. Quando um caminho novo acender um
desses, o template dele entra em `docs/emails/` junto com o código que o
dispara.

⚠️ Os dois links usam `{{ .TokenHash }}`, e **nunca** `{{ .ConfirmationURL }}`:
o padrão devolve os tokens num fragmento (`#...`), e fragmento não é enviado ao
servidor. O aluno confirmaria e cairia na home sem sessão — foi o defeito da
SPEC 12. O handler `/auth/confirm` valida o token no servidor e encaminha:
`recovery` para `/definir-senha`, `signup`/`email` para `/app` com o trial já
concedido.

### Rate limits do Auth — os valores vigentes (AD-133)

O cadastro gratuito depende deles, então eles ficam escritos aqui em vez de
serem supostos. Lidos do projeto `kfpmetkmhjtmgwgaaerl` em **2026-09-04**, pela
Management API (`GET /v1/projects/{ref}/config/auth`):

| Chave | Valor | O que ela segura |
| --- | --- | --- |
| `rate_limit_email_sent` | 30 / hora | e-mails de confirmação e de recuperação, **por projeto** |
| `rate_limit_verify` | 30 / 5 min por IP | validação de token (`/auth/confirm`) |
| `rate_limit_otp` | 30 / hora | envio de OTP |
| `rate_limit_anonymous_users` | 30 / hora por IP | contas anônimas (não usadas aqui) |
| `rate_limit_token_refresh` | 150 / 5 min por IP | renovação de sessão |
| `mailer_otp_exp` | 3600 s | validade do link de confirmação |
| `mailer_autoconfirm` | `false` | "Confirm email" **ligado**, como o produto exige |
| `security_captcha_enabled` | `false` | sem captcha — decisão registrada no AD-133 |

**SMTP próprio já está configurado** — Resend (`smtp.resend.com:587`, remetente
`no-reply@auth.passouconcursos.com`, nome "Passou Concursos"). Ou seja, o teto
de e-mail **não** é mais o do SMTP compartilhado do Supabase.

⚠️ Mas `rate_limit_email_sent` continua valendo, e é **por projeto, não por
IP**: com SMTP próprio o Supabase ainda recusa acima de **30 e-mails por hora**
no total. Qualquer campanha que traga mais de 30 cadastros numa hora derruba a
confirmação de todo mundo — inclusive a recuperação de senha de quem já paga.
**Antes de ligar a flag do trial com tráfego, subir esse número** em
*Authentication → Rate Limits*, respeitando o teto do plano do Resend.

Fora de escopo por decisão, e não por esquecimento: captcha/Turnstile,
fingerprint de dispositivo e bloqueio por IP próprio. Se aparecer abuso medido,
o primeiro passo é Turnstile no cadastro — e isso vira AD nova, com o número do
abuso na mão.

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
