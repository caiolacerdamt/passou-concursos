# SPEC 27 — Raio-X: atualidade, curadoria e pivot do edital

| | |
| --- | --- |
| **Ordem** | 27 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 15, SPEC 20 |
| **Tasks (estimativa)** | ~10 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **RAIOX-07**, **RAIOX-10**, e a **tela do Raio-X** (atrás de flag, AD-076) |
| **Fonte dos requisitos** | `.specs/modulos/m5-raiox-banca/spec.md` |

## Problem Statement

O sinal #3 (atualidade) é um filete de assuntos por ano e tem rede dupla: se ninguém marcar, a
frequência real captura quando o assunto cair. Por isso ele é fast-follow — e por isso nunca vira
radar automático de notícias (rejeitado em AD-021). No dia em que a banca for anunciada, o edital
novo precisa entrar por diff, com o operador conferindo **só o que mudou**.

## Goals

- [ ] Fila de candidato a tópico novo alimentada de graça pela classificação de baixa confiança.
- [ ] Tela onde o operador registra um item de atualidade: assunto, situação, tamanho (dentro do teto), justificativa e validade.
- [ ] Empurrão vencido deixa de ser aplicado sozinho; reverter é um passo.
- [ ] Edital novo processado por diff (entrou / saiu / mudou de redação), com confirmação humana.
- [ ] Tela do Raio-X para o aluno, **atrás de flag desligada** (AD-076).

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| RAIOX-07 | fila de candidatos, tela de curadoria, marcação de "recém-incluído no edital" que habilita a faixa especial; **sem** busca na internet | §P2: Sinal de atualidade sem radar |
| RAIOX-10 | extração do programa do edital com citações, comparação por embedding, diff conferido item a item, propagação para o porteiro, recálculo preservando histórico | §P3: Pivot do edital por diff |
| — | tela do Raio-X: três sinais visíveis separadamente, rótulo de pouca amostra, faixas núcleo × condicional | §P1: Três sinais (AC7) |

⚠️ **Decisão pendente antes do Design:** a extração do programa do edital é uma **chamada de IA fora
da lista fechada do IA-02**. Ou entra na matriz do gateway com modelo e esforço próprios, ou vira
exceção registrada em AD nova.

## Success Criteria

- [ ] Classificação de baixa confiança no acervo faz o item aparecer na fila de candidatos
- [ ] Empurrão aplicado sobe o tópico sem levá-lo ao topo; acima do teto é recusado com o limite exibido
- [ ] Empurrão vencido para de valer sozinho e o tópico volta à ordem da frequência
- [ ] Edital com dois itens novos e um removido devolve exatamente três linhas para conferir
