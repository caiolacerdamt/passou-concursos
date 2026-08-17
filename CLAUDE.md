@AGENTS.md

## Específico do Claude Code

**Fluxo de feature.** Use a skill `tlc-spec-driven`. O trabalho é por **spec numerada**, na ordem de
`.specs/ROADMAP.md` — quando o pedido for "desenvolva a SPEC XX", abra
`.specs/features/XX-<nome>/spec.md` e entre **direto em Design**: a spec já existe, **não refaça
Specify**. Exceção declarada: a **SPEC 07** (interface, conta e deploy) é a única sem requisito
numerado de origem e precisa de Specify curto antes do Design.

**Ritual (AD-090) — obedeça ao que o cabeçalho da spec declara, não rode as 4 fases por reflexo:**

| Ritual | O que produzir |
| --- | --- |
| **A — completo** | `design.md` + `tasks.md` + `validation.md` + **Verificador independente completo** (AC por AC + sensor de mutação). Só nas specs 05, 12, 14, 18, 24, 28, 33 |
| **B — normal** | `tasks.md` com o design embutido no topo. **Sem `design.md` separado.** Ao fim, **Verificador independente curto**: só os *Success Criteria*, evidência `file:line`, **sem sensor de mutação**, relatório como seção no fim do `tasks.md` |
| **C — leve** | `tasks.md` direto + autoverificação do autor |

**`autor ≠ verificador` não cai em nenhum ritual** — a SPEC 04 se verificou sozinha e abriu dívida
`Major`. O Ritual B corta o **escopo** do verificador, não a independência. A skill roda o Verificador
completo por padrão; **o ritual da spec substitui esse padrão** (as regras do projeto vencem as da
skill). Diga qual ritual está seguindo antes de começar.

`tasks.md` é **checklist**: teto de ~10 linhas por task. **Meta numérica de teste é proibida** — nada
de "+8 testes (total ≥ 151)". Testa-se o que quebra.

**Antes de escrever qualquer código:** leia (a) a spec numerada inteira, (b) as seções da spec
temática em `.specs/modulos/m*/spec.md` que ela cita — é lá que moram os critérios de aceite — e
(c) as ADs citadas. Respeite o `Out of Scope`: o que está lá é de outra spec, não é esquecimento.
Se a spec apontar um `design.md`/`tasks.md` de rodada anterior, **aproveite; não refaça**.

**Dependência.** Uma spec só pode depender dela mesma ou de spec de número menor. Se durante o Design
aparecer dependência para frente, **pare e registre** — é bug do roadmap, vira AD nova.

**Ao terminar uma rodada:** atualize só a seção `## Handoff` do `.specs/STATE.md` (substitua o corpo,
não acumule) **e a linha da spec no `.specs/ROADMAP.md`** (status e, se a fase Tasks desmentiu a
estimativa, o número de tasks). Decisão nova = `AD-NNN` nova no fim de `## Decisions` do `STATE.md`,
append-only. **Nunca escreva em `.specs/STATE-ARQUIVO.md`** — ele é histórico congelado (AD-090), e
não deve ser lido por rotina: só quando precisar do texto de uma AD específica.

**Documentação de biblioteca:** use o MCP do Context7 antes de afirmar API, config ou versão — vale
para Next.js, Supabase, `ts-fsrs`, SDK do Claude, Asaas. Não responda de memória sobre lib.

**Git.** Nunca commite direto na `main`. Branch → commits atômicos → PR. Detalhe em `docs/GITFLOW.md`.

**Comunicação.** Português, direto, sem analogia. Se um número não estiver decidido, diga que não
está — não invente valor para preencher spec.
