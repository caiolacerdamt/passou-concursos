# SPEC 07 — Interface, conta e deploy

| | |
| --- | --- |
| **Ordem** | 07 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 03 |
| **Habilita** | SPEC 11, 12, 13, 14, 15, 25 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-07**, **PAG-01**, **PAG-04**, **PAG-06** (parte: `matricula`), **INFRA-01**, `UI-NN` (a criar) |
| **Fonte dos requisitos** | `.specs/modulos/m8-negocio-pagamentos/spec.md` · `.specs/modulos/m9-infra/spec.md` |
| **Vem de** | SPEC 15 + SPEC 17 + parte da SPEC 16 do recorte de 42 (AD-089) |

## Problem Statement

Três specs de servidor já rodaram e **nada aparece numa tela**. Esta spec quebra isso: entra cedo
porque só depende do Sentry (SPEC 03), não do acervo. Ao fim dela existe site no ar, com login, e um
paywall testável — antes de existir dinheiro para testá-lo.

A `matricula` é a **única** chave que libera conteúdo pago. Ela nasce aqui, vazia, para que o gate
seja construído e provado sem depender do checkout (SPEC 12).

## Lacuna de Specify — ler antes das Tasks

É a **única spec sem requisito numerado de origem** para a parte de interface. Rode um Specify curto
(meia hora, não uma rodada): vire critério verificável o que hoje está espalhado — responsivo
mobile-first (AD-077/PAG-08 AC3), estado inicial explícito em vez de zero, degradação clara quando a
IA cai (IA-01 AC3), aviso de "em revisão" sem explicação válida (IA-09 AC5). Os requisitos novos
ganham prefixo `UI-NN` e entram na tabela de rastreio desta spec.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| `UI-NN` | camada de estilo escolhida e registrada em AD; shell responsivo mobile-first; padrão único de carga/erro/vazio/degradado; acessibilidade base (foco visível, contraste, rótulo); erro de UI chega ao Sentry | esta spec (Specify curto) |
| PAG-07 | login por **e-mail+senha e Google**; mesmo e-mail = mesma conta; "defina sua senha" pelo Supabase Auth | m8 §P1: Entrar e chegar ao plano (AC1/AC5) |
| PAG-01 | paywall: matrícula é a única chave, sem conteúdo parcial, SHALL NOT haver segundo mecanismo de liberação | m8 §Goals + AD-031 |
| PAG-06 (parte) | `matricula` com estados e validade de 12 meses; RLS na aplicação **e** no banco | m8 §P1: Buy-then-activate (AC2) |
| PAG-04 | um plano único; modelo de dados aceita mais de um plano depois sem migração destrutiva | m8 §P3 (AC1) |
| INFRA-01 | Vercel ligada ao repo, deploy da `main`, domínio próprio, região SP; segredo por ambiente | m9 §P1: Região SP (AC1) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| **Link mágico** como terceiro caminho de login | SPEC 25 — dois caminhos bastam para lançar |
| **Preview por branch e branch do Supabase** (INFRA-07) | SPEC 25 — exige Supabase Pro, é custo sem aluno |
| Checkout, webhook, criação de conta pelo pagamento | SPEC 12 |
| Qualquer tela de produto (plano, sessão, progresso, Raio-X) | SPEC 11, 13, 14 |
| Tela do operador | SPEC 15 |
| App nativo ou PWA | fora do lançamento (AD-077) |
| Tema claro/escuro | fora, salvo se o Design decidir que sai de graça |

## Contratos que esta spec fixa para as próximas

- **`matricula` é a chave única.** Nenhuma spec posterior inventa outro caminho de liberação.
- `auth.users`, perfil e `matricula` são **grupo 1** — entram na rotina de apagamento da SPEC 14.
- Troca de e-mail: a matrícula segue o usuário, não o e-mail antigo.
- Os quatro estados (carga, erro, vazio, degradado) são componente único. Tela posterior que
  inventar o seu próprio reprova.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Camada de estilo | **em aberto** — decisão do Design, vira AD nova. Infra do tamanho do problema de hoje | n |
| Biblioteca de componentes | em aberto; sem design system pronto no MVP | n |
| Provedor de auth | Supabase Auth (AD-034) | y |
| Papéis | um papel de operador, sem separar revisor/admin | y |

**Pendência externa:** conta na Vercel.

## Success Criteria

- [ ] Uma página funciona de 360px a desktop sem rolagem horizontal
- [ ] Os quatro estados têm componente único e teste
- [ ] Entrar por e-mail+senha e por Google com o mesmo e-mail leva à mesma conta
- [ ] Usuário sem matrícula válida não vê conteúdo pago — nem parcial
- [ ] Aluno A não lê dado do aluno B (RLS)
- [ ] Erro não tratado na interface aparece no Sentry
- [ ] `main` mergeada publica sozinha no domínio próprio

---

## Specify curto — os requisitos `UI-NN` (2026-08-19)

> **Por que esta seção existe.** A parte de interface desta spec não tinha requisito numerado em
> nenhum módulo — o material estava espalhado em AD-077, PAG-08 AC3, IA-01 AC3 e IA-09 AC5. Aqui ele
> vira critério verificável. Este é o **único** lugar onde `UI-NN` mora; nenhum módulo o copia.

### UI-01 — Shell responsivo mobile-first

**User Story**: Como aluno que estuda no celular na fila do ônibus, quero a mesma página funcionando
no telefone e no computador, para não depender de qual aparelho tenho na mão.

**Acceptance Criteria**:

1. Toda página SHALL renderizar de **360 px de largura** até desktop **sem rolagem horizontal**.
2. O layout SHALL ser **mobile-first**: o estilo base vale para o telefone e os pontos de quebra
   acrescentam, SHALL NOT haver estilo de desktop desfeito por *media query* de telefone.
3. SHALL existir **um** shell (cabeçalho, área de conteúdo, largura máxima de leitura) reusado por
   toda tela logada; tela que montar o seu próprio shell reprova.
4. O produto SHALL ser **web responsivo apenas** — SHALL NOT haver app nativo nem PWA no lançamento
   (AD-077).

**Independent Test**: Renderizar a mesma rota em 360 px e em 1280 px e conferir que nenhum elemento
excede a largura da janela.

---

### UI-02 — Quatro estados, um componente só

**User Story**: Como aluno, quero saber se a tela está carregando, se deu erro, se está vazia porque
ainda não fiz nada, ou se está funcionando pela metade — sem ter que adivinhar.

**Acceptance Criteria**:

1. SHALL existir **um único** componente que cobre os quatro estados — `carga`, `erro`, `vazio`,
   `degradado`. Tela posterior que inventar o seu próprio reprova (contrato desta spec).
2. O estado **vazio** SHALL dizer o que fazer para sair dele — SHALL NOT ser um zero solto nem uma
   tela em branco.
3. O estado **degradado** SHALL declarar **o que** está indisponível e afirmar que o restante
   continua funcionando; SHALL NOT bloquear a tela inteira por causa de uma parte (IA-01 AC3).
4. O estado de **erro** SHALL NOT exibir a mensagem técnica nem qualquer dado pessoal; SHALL dizer
   que o time foi avisado.
5. Conteúdo marcado **em revisão** (explicação sem versão válida, IA-09 AC5) SHALL usar o estado
   `degradado` com aviso explícito — SHALL NOT ser escondido em silêncio nem exibido como válido.

**Independent Test**: Renderizar os quatro estados e conferir texto de ação no vazio, nome do que
caiu no degradado e ausência de mensagem técnica no erro.

---

### UI-03 — Acessibilidade base

**User Story**: Como aluno que navega por teclado ou enxerga mal, quero conseguir usar o produto.

**Acceptance Criteria**:

1. Todo elemento focável SHALL ter **indicador de foco visível**; SHALL NOT haver `outline: none`
   sem substituto.
2. Todo controle SHALL ter **nome acessível** (rótulo associado, `aria-label` ou texto próprio);
   campo de formulário sem rótulo reprova.
3. A paleta SHALL declarar par de texto/fundo com contraste **≥ 4,5:1** para texto normal.
4. SHALL existir **link de pulo** para o conteúdo principal, e a área de conteúdo SHALL ser
   marcada com `<main>`.
5. A página SHALL declarar `lang="pt-BR"`.

**Independent Test**: Navegar a tela de login só por teclado, alcançar todos os campos com foco
visível e conferir que cada campo tem rótulo.

---

### UI-04 — Erro de interface chega ao Sentry

**User Story**: Como time, quero saber que a tela quebrou antes de o aluno reclamar.

**Acceptance Criteria**:

1. WHEN a árvore do React quebra em qualquer segmento de rota, THEN o erro SHALL ser reportado ao
   Sentry pelo **ponto único de reporte** (AD-087) e o aluno SHALL ver o estado `erro` do UI-02.
2. O reporte SHALL NOT exibir a mensagem do erro na tela (repete UI-02 AC4 do lado do código).
3. SHALL existir fronteira de erro **por segmento** além do `global-error.tsx`, para o cabeçalho
   sobreviver a um erro de conteúdo.

**Independent Test**: Lançar um erro proposital dentro de um segmento e ver o estado `erro` na tela
com o evento no Sentry, sem a mensagem técnica aparecer.

---

### Tabela de rastreio desta spec

| Requisito | Origem | Coberto por |
| --- | --- | --- |
| UI-01 | esta spec (AD-077, PAG-08 AC3) | T56 |
| UI-02 | esta spec (IA-01 AC3, IA-09 AC5) | T55 |
| UI-03 | esta spec | T55, T56, T59 |
| UI-04 | esta spec (AD-087) | T62 |
| PAG-07 AC1 | m8 §P1 Entrar | T58, T59 |
| PAG-07 AC5 (parte) | m8 §P1 Entrar | T60 |
| PAG-01 / PAG-06 AC2 | m8 §P1 Buy-then-activate | T57, T61 |
| PAG-06 AC1 (parte: `matricula` 12 meses) | m8 §P1 Buy-then-activate | T57 |
| PAG-04 / m8 §P3 AC1 | m8 §P3 | T57 |
| INFRA-01 AC1 | m9 §P1 Região SP | T63 |
