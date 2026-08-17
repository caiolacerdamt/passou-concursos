# SPEC 21 — Página de vendas e funil pré-login

| | |
| --- | --- |
| **Ordem** | 21 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 19, SPEC 20 |
| **Habilita** | — (é a ponta do funil) |
| **Tasks (estimativa)** | ~9 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **PAG-08**, **PAG-17**, **INFRA-12** |
| **Fonte dos requisitos** | `.specs/modulos/m8-negocio-pagamentos/spec.md` · `.specs/modulos/m9-infra/spec.md` §P2: Analytics do funil |

## Problem Statement

O produto está inteiro atrás do muro: a página de vendas é a **única** superfície de conversão. E um
funil que converte 2% sem nenhum erro é silêncio total para o Sentry — por isso a medição do funil
pré-login entra junto, em modo anônimo.

## Goals

- [ ] Página responsiva, sem login, que apresenta método, evidências, garantia e os dois preços.
- [ ] Declaração honesta do que existe hoje — nunca prometer o que não foi entregue.
- [ ] Quatro eventos do funil medidos em modo anônimo, por proxy reverso do domínio próprio.
- [ ] Bloqueador de anúncio derrubando a medição **não** afeta nenhuma compra.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| PAG-08 | conteúdo obrigatório da página (método, `docs/EVIDENCIAS-CIENTIFICAS.md`, garantia, preço nos dois formatos), responsividade, link para política e termos | m8 §P1: Página de vendas |
| PAG-17 / INFRA-12 | eventos: página vista, checkout iniciado, meio escolhido, pagamento confirmado — **anônimos**, sem e-mail/nome/CPF/dado de pagamento, bloqueio na origem; proxy reverso do Next; superfície logada **atrás de flag desligada** com as 3 condições do AD-079; sem session replay; sem error tracking da ferramenta | m9 §P2: Analytics |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Copy e arte finais | decisão de marketing — a spec define **o que** a página contém |
| Analytics da superfície logada | nasce desligada; ligar exige as 3 condições do AD-079 (política, deleção amarrada na SPEC 32, lista de eventos revisada) |
| Feature flag pela ferramenta de analytics | **proibido** — flags vivem na SPEC 02 (AD-078) |
| Conciliação financeira | SPEC 20 — o analytics diz **onde** se perde, nunca **quanto** entrou |

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Ferramenta | **PostHog Cloud, região Estados Unidos** (org criada em 2026-08-16) | y (AD-079) |
| Custo | free tier provavelmente suficiente | **n — conferir em fonte primária antes de ligar** |
| Base legal e instrumento da transferência internacional | pendente | **n — advogado** (art. 33 LGPD) |

## Success Criteria

- [ ] Abrir no celular, entender método/preço/garantia e chegar ao checkout em um clique
- [ ] Os quatro eventos aparecem sem nenhum dado pessoal nas propriedades
- [ ] Bloquear o analytics no navegador e concluir a compra normalmente
- [ ] Flag da superfície logada confirmada **desligada**
