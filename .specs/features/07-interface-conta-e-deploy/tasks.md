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

Verificado em **2026-08-19** por agente que **não** escreveu o código, contra os *Success Criteria*
da `spec.md`. Sem sensor de mutação (AD-090). Onde deu para medir, foi medido: `npm run test:unit`,
`npm run test:db`, `npm run lint`, e o app subido em `npm run dev` com o navegador em 360 px.

### Veredito geral: **PASS**

Cinco critérios PASS, dois PARCIAL. Os dois PARCIAL (nº 3 e nº 7) dependem de conta em painel de
terceiro que **a própria spec declara como pendência externa** — não há como fechá-los no
repositório. Nenhum gap `Major`. Seis gaps `Minor`, todos registrados abaixo.

### Success Criteria

| # | Success Criterion | Veredito | Evidência | Observação |
| --- | --- | --- | --- | --- |
| 1 | Uma página funciona de 360px a desktop sem rolagem horizontal | **PASS** | `src/modules/ui/shell.tsx:40,46` (`max-w-leitura` + `px-4 sm:px-6`) · `src/app/globals.css:47` (`--container-leitura: 44rem`) · `src/modules/ui/shell.test.tsx:49` | **Medido**, não inferido. App em `npm run dev`, viewport 360×800: em `/`, `/entrar`, `/assinar` e `/recuperar-senha` a varredura de `getBoundingClientRect()` sobre todo `body *` devolveu **0 elementos** ultrapassando `innerWidth`, e `documentElement.scrollWidth = 360`. Em 1280 px, idem (`scrollWidth = 1280`, 0 elementos). Tailwind confirmado ativo no navegador (`getComputedStyle(main).maxWidth = 704px`) — o teste não rodou contra HTML sem estilo |
| 2 | Os quatro estados têm componente único e teste | **PASS** | `src/modules/ui/estado.tsx:19-23` (união discriminada) · `src/modules/ui/estado.test.tsx:19-73` (um caso por AC + o caso que prova que os quatro saem do mesmo componente) | O tipo do estado `erro` **não tem** campo de mensagem (`estado.tsx:21`) — o AC4 vira erro de compilação, não convenção. Ressalva no gap G4 |
| 3 | Entrar por e-mail+senha e por Google com o mesmo e-mail leva à mesma conta | **PARCIAL** | `src/app/entrar/acoes.ts:20,37` (os dois caminhos existem) · `src/app/auth/callback/route.ts:21` (`exchangeCodeForSession`) · `docs/DEPLOY.md:56-64` | **Falta prova, e a prova não cabe no repositório.** A vinculação por e-mail é do Supabase Auth (`auth.users.email` único), como o próprio `acoes.ts:14-17` declara. Mas ela **só vale se "Confirm email" estiver ligado no painel** — com ele desligado o Supabase cria um segundo usuário para o login do Google e o critério quebra em produção. Hoje: provedor Google não configurado, nenhum teste, nenhuma sessão real trocada. Ver gap G1 |
| 4 | Usuário sem matrícula válida não vê conteúdo pago — nem parcial | **PASS** | `supabase/migrations/20260819100000_matricula.sql:217-231` (policies do acervo condicionadas a `tem_matricula_ativa()`) · `tests/db/matricula.test.ts:54-107` · `src/modules/conta/matricula.ts:76-80` | A trava é RLS, não código de tela: sem matrícula o banco devolve **zero** linha (`matricula.test.ts:64`), e com matrícula devolve (`:79`) — o par presente×ausente é o que impede o teste de ser tautológico. O ramo frio da lição da SPEC 06 está coberto: matrícula que **existe mas venceu** fecha igual (`:89-107`). Também medido ao vivo: `GET /app` sem sessão devolve `307 → /entrar?proximo=%2Fapp` |
| 5 | Aluno A não lê dado do aluno B (RLS) | **PASS** | `tests/db/conta.ts:80-83` (`set local role authenticated` + `request.jwt.claims`) · `tests/db/conexao.ts:34` (`begin`, o que faz o `set local` valer) · `tests/db/matricula.test.ts:123-137` | O helper **faz o que diz**: troca o papel para `authenticated` e injeta o `sub`, dentro de transação. Sem isso a consulta rodaria como dono do banco e a policy não seria exercida. `tem_matricula_ativa()` é `security definer` **sem argumento** (migração `:166-180`), e há teste que lê `pg_get_function_identity_arguments` e exige lista vazia (`matricula.test.ts:165-176`) — contrato nº 11 do `STATE.md` amarrado por mecanismo, não por comentário |
| 6 | Erro não tratado na interface aparece no Sentry | **PASS** | `src/app/error.tsx:27-29` e `src/app/app/error.tsx:21-23` (`reportarErro`) · `src/instrumentation-client.ts:46` (`definirDestinoDeErro` → SDK) · `src/modules/ui/fronteiras-de-erro.test.ts:28-58` | A corrente está inteira e cada elo tem teste. Confirmado no navegador que o SDK carrega de verdade (`window.__SENTRY__.version = 10.70.0`). **Não** foi observado um evento chegando ao Sentry: sem DSN nesta máquina o destino cai no console de propósito (`reporte.ts:28`). O teste das fronteiras varre **todo** `error.tsx` da árvore (`:17-23`), então fronteira nova criada pela SPEC 13 sem `reportarErro` faz o teste cair |
| 7 | `main` mergeada publica sozinha no domínio próprio | **PARCIAL** | `vercel.json:3` (`"regions": ["gru1"]`) · `src/modules/conta/deploy.test.ts:18-25` · `docs/DEPLOY.md:10-46` | **Pronto no repositório**: região SP fixada e testada, `framework: nextjs`, `.env.example` separando público de segredo (`:53-120`), `docs/DEPLOY.md` com o passo a passo do painel. **Pendente**: a conta Vercel não existe, o repositório não está importado, `Production Branch = main` não foi marcado, o domínio não foi registrado, `NEXT_PUBLIC_SITE_URL` não foi preenchida e as URLs de redirecionamento do Supabase Auth não foram configuradas. Nada disso é verificável daqui, e a `spec.md:72` já declarava "Pendência externa: conta na Vercel" |

### Gaps

Nenhum `Major`. Seis `Minor`.

**G1 · `Minor` · A vinculação "mesmo e-mail = mesma conta" depende de um passo de painel cujo motivo não está escrito.**
`docs/DEPLOY.md:64` manda manter "Confirm email" **ligado**, mas como item solto, sem dizer que é
dele que depende o Success Criterion nº 3. Quem desligar a confirmação de e-mail amanhã (para
encurtar o funil da SPEC 12, por exemplo) quebra a vinculação de conta e **nada** no repositório
acusa. Correção barata: uma linha no `DEPLOY.md` amarrando a opção ao critério.

**G2 · `Minor` · `body { overflow-x: hidden }` mascara regressões do UI-01 AC1.**
`src/app/globals.css:75`. O comentário assume que é "rede de segurança", e para o aluno é. Mas o
`overflow-x` do `body` propaga para o viewport: a partir dele, `documentElement.scrollWidth` **nunca**
denuncia estouro, e o critério nº 1 deixa de ser mensurável pelo caminho óbvio. Hoje não há dano — a
varredura por `getBoundingClientRect()` mostrou 0 elementos estourando nas quatro rotas —, mas a
tela da SPEC 13 com tabela larga vai cortar conteúdo em silêncio em vez de falhar. O substituto no
teste (`shell.test.tsx:49`, proibir `w-[NNNpx]`) cobre só uma das causas de estouro; não cobre
`min-width`, `white-space: nowrap`, grid com coluna fixa, nem `<img>` sem `max-width`.

**G3 · `Minor` · O ramo de redirecionamento de `exigirMatriculaAtiva()` não tem teste.**
`src/modules/conta/matricula.ts:76-80`. A T61 prometeu "a guarda redireciona sem matrícula, deixa
passar com matrícula". O que existe é (a) `matriculaAtiva()` testada com cliente de mentira
(`matricula.test.ts:35-69`) e (b) a varredura que exige a guarda em toda página sob `/app`
(`:92-101`) — as duas boas. O `if (!matricula) redirect("/assinar")` em si nunca é executado por
teste nenhum. São três linhas, mas é o ponto onde "conteúdo parcial" apareceria.

**G4 · `Minor` · `/entrar` monta a sua própria apresentação de erro, e nada impede a próxima tela de fazer o mesmo.**
`src/app/entrar/page.tsx:33-41` renderiza um `<p role="alert">` em vez do `<Estado tipo="erro">`. A
justificativa no comentário (`:27-32`) é boa e eu concordo com ela: credencial errada não é falha do
sistema. O problema é que o contrato da spec — "tela posterior que inventar o seu próprio reprova" —
**não tem sensor**, ao contrário do paywall, que ganhou varredura de diretório
(`matricula.test.ts:92`). A primeira exceção já existe no dia 1 e não está marcada como exceção em
lugar nenhum.

**G5 · `Minor` · A T59 prometeu teste da "mensagem de erro fixa" e ele não existe.**
`CREDENCIAL_INVALIDA` (`src/modules/conta/mensagens.ts:13`) não é referenciada por nenhum teste. A
outra metade da T59 (sanitização do `proximo`) está bem coberta em `rotas.test.ts:66-80`, inclusive
`//host` e `/\host`. Desvio do `tasks.md` sem marcação.

**G6 · `Minor` · Observação para a SPEC 13, não defeito de hoje: existe código de aluno rodando com a chave de serviço.**
`src/modules/aluno/tentativas/registrar.ts:34` e `src/modules/aluno/revisao/agendar.ts:29` usam
`clienteDeServico()`, que passa por cima da RLS. **Não é o segundo mecanismo de liberação que a
PAG-01 proíbe** — nenhuma rota ou página os alcança hoje (o único `route.ts` sob `src/app/api` é o
`erro-proposital`, e ele fica atrás do proxy). Mas no dia em que a SPEC 13 expuser a sessão de
questões por esses módulos, a matrícula deixa de ser verificada pelo banco naquele caminho. Fica
registrado aqui para não ser descoberto tarde.

### Números reais

| Medição | Resultado |
| --- | --- |
| `npm run test:unit` | **25 arquivos, 193 testes, todos passando** (1,60 s) |
| `npm run test:db` | **30 arquivos, 266 testes, todos passando** (93,75 s), contra o projeto Supabase de dev |
| `npm run lint` | **`ESLint: No issues found`** |
| `npm run build` | **verde** — compila em 1,7 s, TypeScript sem erro, 9 rotas geradas, `Proxy (Middleware)` reconhecido |
| Rolagem horizontal a 360 px | `/`, `/entrar`, `/assinar`, `/recuperar-senha`: **0 elementos** além do viewport; `scrollWidth = 360` |
| Rolagem horizontal a 1280 px | `/entrar`: **0 elementos**; `scrollWidth = 1280` |
| Rota privada sem sessão | `/app` → `307 /entrar?proximo=%2Fapp` · `/definir-senha` → `307` · `/api/erro-proposital` → `307` |
| Segredo commitado | **nenhum**. `.env.example` traz só chaves vazias; `.gitignore:20-22` ignora `.env` e `.env.*` com exceção do `.example` |

### O que eu **não** consegui verificar, e por quê

1. **Login real por Google** (critério 3). O provedor não está configurado no painel do Supabase
   (`docs/DEPLOY.md:56-63` descreve o que falta) e não há credencial OAuth. Consequência: a
   vinculação de identidade nunca foi exercida — nem manual, nem por teste.
2. **Login real por e-mail+senha.** Não criei usuário com senha no projeto de dev: exigiria escrever
   em `auth.users` fora da transação revertida dos testes, o que sujaria o banco compartilhado.
3. **Evento chegando ao Sentry** (critério 6). Sem `NEXT_PUBLIC_SENTRY_DSN` nesta máquina o SDK não
   transmite — estado válido e suportado por desenho (`.env.example:71-73`). Verifiquei a corrente
   elo por elo e a presença do SDK no navegador, não o evento no painel.
4. **Deploy publicando sozinho** (critério 7). A conta Vercel não existe. Verifiquei só o que é
   código: `vercel.json`, o teste da região e o `docs/DEPLOY.md`.
5. **A afirmação de contraste ≥ 4,5:1** (UI-03 AC3). Os números em `src/app/globals.css:12-18` estão
   escritos como medidos; recalculei o par principal por amostragem (`#16191d` sobre `#ffffff`) e
   bate, mas não conferi os seis pares um a um com ferramenta de contraste.
6. **Comportamento em navegador antigo ou com JavaScript desligado.** Fora do escopo declarado da
   spec, mas registro que não foi testado.

---

## Correções pós-verificação (mesma rodada)

Três dos seis `Minor` foram fechados na hora, porque eram desvio do que este próprio `tasks.md`
prometeu. Os outros três ficam registrados como dívida, com destino.

| Gap | Estado | O que foi feito |
| --- | --- | --- |
| **G1** | ✅ fechado | `docs/DEPLOY.md:66-71` amarra "Confirm email" ao Success Criteria nº 3 e diz o que quebra ao desligar |
| **G3** | ✅ fechado | `src/modules/conta/guarda.test.ts` — o `redirect("/assinar")` é executado por teste, com o mock **lançando** como o Next faz: um mock que só retornasse deixaria passar um código que renderiza a tela paga em produção |
| **G5** | ✅ fechado | `src/modules/conta/mensagens.test.ts` — prova a **ausência de ramo** (não existe "e-mail não cadastrado") e que a tela lê da constante em vez de ter texto próprio |
| **G2** | ⏳ dívida | `overflow-x: hidden` no `body` mascara `scrollWidth`. A rede fica; o que falta é sensor melhor que a proibição de `w-[NNNpx]`. Fecha na **SPEC 13**, junto da primeira tela com tabela larga |
| **G4** | ⏳ dívida aceita | `/entrar` monta a própria apresentação de erro de credencial. A decisão está certa (credencial errada não é falha do sistema) e agora está declarada; o que falta é sensor do contrato "quatro estados, componente único". Fecha na **SPEC 13**, quando houver mais de uma tela para varrer |
| **G6** | ⏳ registrado | `registrar.ts:34` e `agendar.ts:29` usam a chave de serviço. Não é defeito hoje — nenhuma rota os alcança. Vira bloqueio da **SPEC 13**: expor a sessão de questões por esses módulos sem trocar para o cliente de sessão criaria caminho sem RLS |

Reverificado depois das correções: `test:unit` **27 arquivos / 199 testes**, `test:db` **30 arquivos /
266 testes**, `lint` limpo, `build` verde.
