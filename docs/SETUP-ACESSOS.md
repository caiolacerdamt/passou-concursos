# Checklist de acessos

Pegue os dados abaixo. Depois cole o formulário do fim numa sessão nova e peça pra configurar.

---

## 1. Supabase — banco, auth, storage

**Criar:** conta em <https://supabase.com/dashboard> → organização → **assinar o plano Pro** (~US$25/mês,
é por organização) → novo projeto `passou-concursos-prod`, **região South America (São Paulo)**.

> ⚠️ Confira a região. Não muda depois, e a spec exige Brasil (LGPD).
> ⚠️ Pro não é opcional: o staging por branch e o backup diário só existem nele.

**Pegar:**
- Access Token `sbp_…` → Account → [Tokens](https://supabase.com/dashboard/account/tokens)
- Project ref → Settings → General
- Project URL → Settings → API
- Publishable (anon) key → Settings → API
- `service_role` key → Settings → API
- Senha do banco → você define ao criar

**Configuração:** MCP do Supabase no projeto (usa o access token + o project ref) · `supabase link` no
CLI · o resto vai no `.env` e nos GitHub Secrets.

---

## 2. Vercel — hospedagem

**Criar:** conta em <https://vercel.com/signup> **entrando com o GitHub** → **assinar o Pro**
(~US$20/mês).

> Pro é requisito de lançamento: o tutor ao vivo precisa de streaming, e o Hobby corta o timeout antes.
> Não importe o repo ainda — não existe `package.json`.

**Pegar:**
- Access Token → <https://vercel.com/account/settings/tokens>

**Configuração:** `vercel login` no CLI · MCP da Vercel (autentica sozinho por OAuth, não precisa de
chave) · o token vai pro GitHub Secrets.

---

## 3. OpenAI — toda a IA do projeto

**Criar:** conta em <https://platform.openai.com> → **adicionar crédito** → criar API key de projeto.

> ⚠️ Coloque crédito logo. Conta nova entra no tier mais baixo, e o tier limita a fila da Batch API —
> que é o que a fábrica de 10 mil questões usa.
> Confira também se a organização precisa de verificação de identidade; costuma demorar.

**Pegar:**
- API key `sk-proj-…`

**Configuração:** só `.env` + GitHub Secrets. Não tem MCP.

---

## 4. Cohere — embeddings

**Criar:** conta em <https://dashboard.cohere.com> → **ativar billing** → criar API key.

> A trial key tem limite de taxa que não aguenta o volume.

**Pegar:**
- API key

**Configuração:** só `.env` + GitHub Secrets. Não tem MCP.

---

## 5. Sentry — erros em produção

**Criar:** conta em <https://sentry.io/signup/> → projeto do tipo **Next.js**. Free tier basta.

**Pegar:**
- DSN (aparece na criação do projeto)
- Auth token da organização → Settings → Auth Tokens

**Configuração:** MCP do Sentry (OAuth, sem chave) · DSN no `.env` e na Vercel · auth token no GitHub
Secrets.

---

## 6. GitHub — já tem

Conta `caiolacerdamt` e `gh` já autenticado. Nada a pegar. A sessão nova cadastra os secrets sozinha
com o que você trouxer dos itens acima.

---

## Deixe pra depois

| O quê | Quando |
| --- | --- |
| **Asaas** (sandbox é grátis e sem CNPJ) | ao começar o M8 — pagamentos |
| **Domínio** `.com.br` no registro.br | antes de subir produção |
| **OpenRouter** | só no eval trimestral de modelos, com chave separada |
| **ElevenLabs** + chaves de TTS | só no teste cego de voz do M3 |

---

## O que a sessão nova vai configurar

**MCPs no projeto** (arquivo `.mcp.json` na raiz, versionado, valendo só aqui):
`supabase` · `context7` · `vercel` · `sentry` · `playwright`

Só o Supabase precisa de chave; Vercel e Sentry autenticam por OAuth no navegador.

**CLIs:** `supabase login` + `link` · `vercel login` · `gh` já pronto.

**Segredos:** `.env` local · uma variável de ambiente do Windows (`SUPABASE_ACCESS_TOKEN`, porque o MCP
lê do sistema e não do `.env`) · GitHub Secrets · variáveis da Vercel.

---

## Formulário — preencha e cole na sessão nova

```
SUPABASE
  access token (sbp_):
  project ref:
  project url:
  anon/publishable key:
  service_role key:
  senha do banco:
  região confirmada São Paulo? (sim/não):

VERCEL
  access token:
  plano Pro ativo? (sim/não):

OPENAI
  api key (sk-proj-):
  crédito adicionado? (sim/não):

COHERE
  api key:

SENTRY
  dsn:
  auth token:
  org slug:
  project slug:
```
