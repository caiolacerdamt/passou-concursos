# SPEC 12 — Verificação quantitativa por catálogo de fórmulas

| | |
| --- | --- |
| **Ordem** | 12 de 42 · [ROADMAP](../../ROADMAP.md) |
| **Depende de** | SPEC 07, SPEC 10 |
| **Habilita** | SPEC 13 (nenhuma explicação de conta publica sem passar por aqui) |
| **Tasks (estimativa)** | ~9 |
| **Dificuldade** | Média |
| **Status** | ⬜ Não iniciada |
| **Requisitos** | **IA-06**, **IA-15** |
| **Fonte dos requisitos** | `.specs/modulos/m2-camada-ia/spec.md` §P1: Verificação de cálculo |

## Problem Statement

Invariante nº11: questão de conta só publica se o número calculado por código bater com o gabarito
**e** com o texto. E o AD-069 fecha o caminho: **nunca executar código gerado por IA**. A IA escolhe
qual fórmula do catálogo e quais parâmetros; a conta é feita por função nossa, testada.

## Goals

- [ ] Catálogo fechado de fórmulas de matemática financeira, cada uma com teste unitário próprio.
- [ ] Cruzamento duplo: resultado bate com a alternativa oficial **e** com o número escrito na explicação.
- [ ] Quantitativa sem fórmula aplicável vai à fila humana **e é contabilizada** (taxa de não-cobertura).
- [ ] Falha de cruzamento refaz **exatamente 1×**, escalando modelo e esforço; depois é humano.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| IA-06 | catálogo mínimo (juros simples/compostos, taxa proporcional × equivalente, desconto simples/composto, séries uniformes, SAC e Price, VP e VF); saída estruturada só com fórmula + parâmetros; tolerância de comparação em configuração; registro de qual fórmula e quais parâmetros produziram o número | §P1: Verificação de cálculo |
| IA-15 | classificação de "não coberta", envio à fila e **medição da taxa** — se for alta, a decisão do AD-069 volta à mesa | §P1: Verificação (AC4) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Texto da explicação em si | SPEC 13 (aqui só o número é conferido) |
| Ampliar o catálogo por inferência da IA | **proibido** — ampliar é mudança de código revisada |
| Sandbox / execução de código gerado | **proibido** (AD-069) |

## Contratos que esta spec fixa para as próximas

- A SPEC 13 **não publica** explicação quantitativa sem o veredito daqui.
- Rede de segurança: explicação com número numa questão **não** classificada como quantitativa
  também é marcada para verificação (proteção contra classificação errada).

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Cobertura do catálogo | desconhecida até a 1ª leva — **medir** | n (risco declarado no AD-069) |
| Tolerância numérica | em configuração (centavos e percentual) | n (calibra) |
| Escalonamento do refaz | `gpt-5.6-luna` em `max` → `gpt-5.6-terra` em `max`, ambos por config | y (AD-073) |

## Success Criteria

- [ ] Questão de juros compostos com número errado na explicação **não** publica, tem exatamente uma segunda tentativa e termina na fila humana
- [ ] Questão de RLM sem fórmula aplicável cai direto na fila, contabilizada como não-coberta
- [ ] Erro técnico de cálculo (divisão por zero, parâmetro inválido) conta como falha, nunca como aprovação
- [ ] Nenhum código gerado por IA é executado em nenhum caminho
