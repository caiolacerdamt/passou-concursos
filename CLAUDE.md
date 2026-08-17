@AGENTS.md

## Específico do Claude Code

**Fluxo de feature.** Use a skill `tlc-spec-driven`. O trabalho é por **spec numerada**, na ordem de
`.specs/ROADMAP.md` — quando o pedido for "desenvolva a SPEC XX", abra
`.specs/features/XX-<nome>/spec.md` e entre **direto em Design**: a spec já existe, **não refaça
Specify**. Exceção declarada: a **SPEC 15** (fundação da interface) é a única sem requisito numerado
de origem e precisa de Specify curto antes do Design.

**Antes de escrever qualquer código:** leia (a) a spec numerada inteira, (b) as seções da spec
temática em `.specs/modulos/m*/spec.md` que ela cita — é lá que moram os critérios de aceite — e
(c) as ADs citadas. Respeite o `Out of Scope`: o que está lá é de outra spec, não é esquecimento.
Se a spec apontar um `design.md`/`tasks.md` de rodada anterior, **aproveite; não refaça**.

**Dependência.** Uma spec só pode depender dela mesma ou de spec de número menor. Se durante o Design
aparecer dependência para frente, **pare e registre** — é bug do roadmap, vira AD nova.

**Ao terminar uma rodada:** atualize só a seção `## Handoff` do `.specs/STATE.md` (substitua o corpo,
não acumule) **e a linha da spec no `.specs/ROADMAP.md`** (status e, se a fase Tasks desmentiu a
estimativa, o número de tasks). Decisão nova = `AD-NNN` nova no fim de `## Decisions`, append-only.

**Documentação de biblioteca:** use o MCP do Context7 antes de afirmar API, config ou versão — vale
para Next.js, Supabase, `ts-fsrs`, SDK do Claude, Asaas. Não responda de memória sobre lib.

**Git.** Nunca commite direto na `main`. Branch → commits atômicos → PR. Detalhe em `docs/GITFLOW.md`.

**Comunicação.** Português, direto, sem analogia. Se um número não estiver decidido, diga que não
está — não invente valor para preencher spec.
