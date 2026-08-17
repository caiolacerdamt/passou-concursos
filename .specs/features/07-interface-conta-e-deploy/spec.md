# SPEC 07 — Interface, conta e deploy

| | |
| --- | --- |
| **Ordem** | 07 de 36 · [ROADMAP](../../ROADMAP.md) · **MVP** |
| **Depende de** | SPEC 03 |
| **Habilita** | SPEC 11, 12, 13, 14, 15, 25 |
| **Tasks (estimativa)** | ~12 |
| **Ritual** | **B — normal** (`design` como seção do `tasks.md`, autoverificação com evidência) |
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
