# SPEC 07 — Interface, conta e deploy · Tasks

| | |
| --- | --- |
| **Ritual** | **B** — design embutido aqui, sem `design.md`; Verificador independente **curto** no fim |
| **Branch** | `feat/m8-p1-interface-conta-deploy` |
| **Tasks** | T54 … T64 (11) + Verificador |
| **Requisitos** | UI-01…UI-04 (Specify curto na `spec.md`) · PAG-01 · PAG-04 · PAG-06 (parte) · PAG-07 · INFRA-01 |

---

## Design (curto)

### D1 · Camada de estilo → **Tailwind CSS v4** (vira **AD-093**)

A escolha estava em aberto no cabeçalho da spec. **Tailwind v4**, sem biblioteca de componentes.

Por quê: (a) o requisito duro é **mobile-first sem rolagem horizontal** (UI-01) e o Tailwind é
mobile-first por construção — `sm:`/`md:` **acrescentam**, nunca desfazem; (b) v4 não tem arquivo de
configuração em JS: os tokens moram num bloco `@theme` dentro do próprio CSS, que é **um** lugar;
(c) zero runtime — nada de CSS-in-JS pesando no cliente; (d) não entra biblioteca de componentes,
então não há design system para manter antes de existir aluno.

O que foi descartado: **CSS Modules puro** (obrigaria escrever a mão a escala de breakpoints, os
tokens e o reset — trabalho que não é o do produto) e **shadcn/ui + Radix** (traz ~20 dependências e
um design system inteiro para 5 telas; é a definição de infra maior que o problema de hoje).

### D2 · Sessão → `@supabase/ssr` + `proxy.ts`

O `src/lib/db/servidor.ts` de hoje usa a **chave secreta** e passa por cima da RLS — ele continua
sendo o cliente de *serviço*, e **não** serve para sessão de aluno. Entram dois clientes novos, com a
chave **publicável**, que leem e escrevem o cookie de sessão:

- `clienteDoNavegador()` — componentes cliente.
- `clienteDaSessao()` — componentes e ações de servidor, via `cookies()` do Next.
- `src/proxy.ts` — **Next 16 renomeou `middleware.ts` para `proxy.ts`** (runtime `nodejs`, o `edge`
  não é suportado lá). Ele renova a sessão a cada requisição e redireciona quem não tem sessão para
  `/entrar`. Nada roda entre `createServerClient` e `auth.getUser()`.

Login por **e-mail+senha** (ação de servidor) e por **Google** (OAuth PKCE → `/auth/callback` →
`exchangeCodeForSession`). Mesmo e-mail = mesma conta é propriedade do próprio Supabase Auth
(`auth.users.email` é único); o teste prova o contrato, não reimplementa.

### D3 · `matriculas` — a chave única

```
produtos    (id, codigo unique, nome, meses_de_acesso, ativo)   ← PAG-04: mais de um plano depois,
matriculas  (id, user_id → auth.users, produto_id → produtos,      sem migração destrutiva
             estado, inicio_em, fim_em, criada_em, atualizada_em)
```

- `estado ∈ {ativa, vencida, reembolsada, encerrada}` — enum, para transição inválida ser erro.
- **Uma** matrícula ativa por aluno: índice único parcial `where estado = 'ativa'`.
- `fim_em` = `inicio_em + meses_de_acesso` — 12 meses vêm do **produto**, não de constante no código.
- `public.tem_matricula_ativa()` — `security definer`, `search_path` vazio, lê `auth.uid()`. É a
  função que as policies chamam.
- **O paywall é RLS de verdade**: `questoes`, `provas`, `materias`, `topicos` têm RLS ligada **sem
  policy nenhuma** desde a SPEC 04 — ou seja, hoje ninguém lê. Esta spec abre uma policy de `select`
  **condicionada a `tem_matricula_ativa()`**. É por isso que "sem conteúdo parcial" não depende de o
  código lembrar de checar: sem matrícula o banco devolve zero linha.
- Grupo LGPD **1**. `on delete cascade` a partir de `auth.users`, e a tabela entra no registro de
  apagamento da T64.

### D4 · Os quatro estados e o shell

Um componente `<Estado tipo="carga|erro|vazio|degradado">`, em `src/modules/ui/`. Teste por
`renderToStaticMarkup` do `react-dom/server` — o projeto não tem jsdom nem Testing Library e não
precisa ganhar dois: o que os AC pedem é **o que está escrito no HTML**, e isso a string entrega.

`<Shell>` = link de pulo + cabeçalho + `<main>` com largura máxima de leitura. Nenhuma tela monta o
seu próprio.

### Fora do escopo desta spec (não improvisar)

Link mágico (SPEC 25) · preview por branch (SPEC 25) · checkout e criação de conta por pagamento
(SPEC 12) · qualquer tela de produto (11/13/14) · tela do operador (15) · tema claro/escuro.

---

## Tasks

### T54 · Camada de estilo (Tailwind v4) + tokens

- Instalar `tailwindcss@4`, `@tailwindcss/postcss`, `postcss`; criar `postcss.config.mjs`.
- `src/app/globals.css`: `@import "tailwindcss"` + bloco `@theme` com a paleta e as fontes.
- Importar o CSS no `layout.tsx`; declarar `viewport` e manter `lang="pt-BR"` (UI-03 AC5).
- Registrar **AD-093** no `.specs/STATE.md`.
- **Done when**: `npm run build` passa e a página inicial sai estilizada.

### T55 · Componente único dos quatro estados (UI-02, UI-03)

- `src/modules/ui/estado.tsx` — `<Estado tipo>` com `carga`, `erro`, `vazio`, `degradado`.
- `vazio` exige texto de ação; `degradado` exige o **nome** do que caiu; `erro` **não** recebe nem
  imprime a mensagem técnica; `carga` marca `aria-busy` e `role="status"`.
- Teste `estado.test.tsx` com `renderToStaticMarkup`: um caso por AC do UI-02.
- Habilitar `src/**/*.test.tsx` no projeto `unit` do Vitest.
- **Done when**: `npm run test:unit` verde e o componente é o único caminho dos 4 estados.

### T56 · Shell responsivo mobile-first (UI-01, UI-03)

- `src/modules/ui/shell.tsx` — link de pulo → `<main id="conteudo">`, cabeçalho, largura de leitura.
- Base mobile; `sm:`/`md:` só acrescentam. Nada com largura fixa em px maior que 360.
- Teste: o HTML tem `<main>`, o link de pulo aponta para ele, e nenhuma classe usa `w-[NNNpx]`.
- Reescrever `src/app/page.tsx` usando o Shell.
- **Done when**: teste verde e `npm run build` passa.

### T57 · `produtos`, `matriculas` e o paywall no banco (PAG-06 AC2, PAG-04)

- Migração: enum `matricula_estado`, tabelas `produtos` e `matriculas`, índice único parcial da
  matrícula ativa, `fim_em` derivado de `produtos.meses_de_acesso`, semente do plano único.
- `public.tem_matricula_ativa()` — `security definer`, `search_path = ''`, amarra `auth.uid()`.
- RLS: aluno lê **só a própria** matrícula, não escreve; policy de `select` em `questoes`, `provas`,
  `materias` e `topicos` condicionada a `tem_matricula_ativa()`.
- `revoke insert, update, delete, truncate` de `anon`/`authenticated` nas duas tabelas novas.
- Teste `tests/db/matricula.test.ts`: sem matrícula → 0 questões; com matrícula → lê; matrícula
  vencida → 0; aluno A não lê a matrícula de B; segunda matrícula ativa é recusada.
- **Done when**: `npm run test:db` verde com a migração aplicada.

### T58 · Clientes de sessão + `proxy.ts` (PAG-07)

- `@supabase/ssr`; `src/lib/db/navegador.ts` e `src/lib/db/sessao.ts` com a chave **publicável**.
- `src/proxy.ts`: renova a sessão, protege `/app`, deixa passar rota pública e `/auth`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no `.env.example` e no `.env` local.
- Teste unitário do **matcher** e da lista de rotas públicas (a decisão de quem passa é uma função
  pura, testável sem subir o Next).
- **Done when**: `npm run build` passa e o teste do roteamento é verde.

### T59 · `/entrar` — e-mail+senha e Google (PAG-07 AC1)

- Página `/entrar` com formulário rotulado (UI-03 AC2) + botão do Google.
- Ações de servidor: `entrarComSenha` (`signInWithPassword`) e `entrarComGoogle`
  (`signInWithOAuth`, PKCE) → `redirect`.
- `src/app/auth/callback/route.ts`: `exchangeCodeForSession`, `next` só relativo.
- Erro de credencial usa o `<Estado tipo="erro">` e **não** vaza a mensagem do provedor.
- Teste: sanitização do `next` do callback e a mensagem de erro fixa.
- **Done when**: `npm run build` passa e os testes são verdes.

### T60 · "Defina sua senha" pelo Supabase Auth (PAG-07)

- `/recuperar-senha`: pede o e-mail → `resetPasswordForEmail` com `redirectTo` do callback.
- `/definir-senha`: exige sessão de recuperação → `updateUser({ password })`.
- Resposta **sempre igual**, exista ou não a conta — não confirmar e-mail cadastrado.
- Regra mínima de senha em um lugar só, com teste.
- **Done when**: teste verde e `npm run build` passa.

### T61 · Paywall na aplicação (PAG-01, PAG-06 AC2)

- `src/modules/conta/matricula.ts`: `matriculaAtiva()` e `exigirMatriculaAtiva()` (redireciona).
- Rota `/app` protegida: sem matrícula → `/assinar` (marco), **nunca** conteúdo parcial.
- `/assinar` é só o aviso do paywall — o checkout é da SPEC 12.
- Teste: a guarda redireciona sem matrícula, deixa passar com matrícula, e não existe segundo
  caminho de liberação (varredura por `tem_matricula_ativa`/`matriculaAtiva`).
- **Done when**: testes verdes.

### T62 · Erro de interface no Sentry (UI-04)

- `src/app/error.tsx` e `src/app/app/error.tsx`: reportam pelo ponto único (AD-087) e mostram
  `<Estado tipo="erro">`.
- Nenhuma tela imprime `error.message`.
- Teste: o HTML do estado de erro não contém a mensagem injetada.
- **Done when**: teste verde e `npm run build` passa.

### T63 · Deploy na Vercel (INFRA-01 AC1)

- `vercel.json` com região **`gru1`** (São Paulo) e o comando de build.
- `.env.example` com as variáveis do deploy e o que é público × secreto.
- `docs/DEPLOY.md`: passo a passo do que precisa ser feito **à mão** na Vercel e no Supabase Auth
  (URLs de redirecionamento, provedor Google, domínio próprio).
- Teste: o `vercel.json` declara `gru1` (a região é requisito, não preferência).
- **Done when**: teste verde; a ligação da conta Vercel fica como pendência externa declarada.

### T64 · Registro das tabelas do grupo 1 (contrato nº 9)

- `src/modules/lgpd/grupo-1.ts`: lista das tabelas com `user_id` que a rotina de apagamento da
  SPEC 14 vai varrer.
- Teste de banco: **toda** tabela de `public` com coluna `user_id` está na lista — tabela nova não
  registrada faz o teste **falhar**, não passar em silêncio.
- **Done when**: `npm run test:db` verde com `matriculas` na lista.

---

## Verificador independente (curto — Ritual B)

Preenchido por agente que **não** escreveu o código, contra os *Success Criteria* da `spec.md`,
com evidência `file:line`. Sem sensor de mutação (AD-090).
