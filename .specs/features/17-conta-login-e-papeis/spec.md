# SPEC 17 — Conta, login e papéis

| | |
| --- | --- |
| **Ordem** | 17 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 15, SPEC 16 |
| **Habilita** | SPEC 18, 19, 22, 24, 25 |
| **Tasks (estimativa)** | ~10 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-07**, **PAG-01**, **PAG-04**, **PAG-06** (parte: `matricula`) |
| **Fonte dos requisitos** | `.specs/modulos/m8-negocio-pagamentos/spec.md` |

## Problem Statement

Todas as telas do produto são de aluno autenticado, e o produto inteiro está atrás do muro do
paywall. A `matricula` válida é a **única** coisa que libera conteúdo pago — e ela precisa existir
antes do checkout que a preenche, para que o gate seja construído e testado sem depender do dinheiro.

## Goals

- [ ] Login por e-mail+senha, Google e link mágico levando à **mesma** conta quando o e-mail é o mesmo.
- [ ] `matricula` com validade de 12 meses, verificada por RLS **e** pela aplicação.
- [ ] Sem matrícula válida não há conteúdo parcial: bloqueia e oferece a compra.
- [ ] Papel de **operador de conteúdo** separado do aluno, para a SPEC 18.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| PAG-07 | os três caminhos de login; "defina sua senha" e link mágico pelo Supabase Auth | §P1: Entrar e chegar ao plano (AC1/AC5) |
| PAG-01 | paywall: matrícula é a única chave; SHALL NOT haver segundo mecanismo de liberação | §Goals + AD-031 |
| PAG-06 (parte) | tabela `matricula` com estados e validade de 12 meses; RLS | §P1: Buy-then-activate (AC2) |
| PAG-04 | um plano único, sem recorrência — o modelo de dados aceita mais de um plano no futuro sem migração destrutiva | §P3 (AC1) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Checkout, webhook, criação automática de conta pelo pagamento | SPEC 19 |
| Onboarding, meta, diagnóstico, plano do 1º dia (PAG-14) | SPEC 24 |
| Avisos de vencimento e fim da matrícula (PAG-11) | SPEC 20 |
| Exportação, correção e exclusão de dados (DADOS-10) | SPEC 32 |
| Opt-out do flywheel e consentimento de marketing | SPEC 31 |

## Contratos que esta spec fixa para as próximas

- **`matricula` é a chave única.** Nenhuma spec posterior inventa outro caminho de liberação.
- `auth.users`, perfil e matrícula são **grupo 1** (LGPD) — entram na rotina da SPEC 32.
- Troca de e-mail: a matrícula segue o usuário, não o e-mail antigo.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Provedor de auth | Supabase Auth (AD-034) | y |
| E-mail transacional de negócio (aviso de vencimento) | provedor a definir | n (Design da SPEC 20) |
| Papéis | um papel de operador, sem separar revisor/admin no MVP | y (M1/M5) |

## Success Criteria

- [ ] Entrar pelos três caminhos com o mesmo e-mail leva à mesma conta
- [ ] Usuário sem matrícula válida não vê conteúdo pago — nem parcial
- [ ] Aluno A não lê dado do aluno B (RLS)
- [ ] Operador acessa a área de operação; aluno não
