@AGENTS.md

## Específico do Claude Code

**Fluxo de feature.** Use a skill `tlc-spec-driven`. As specs já existem em
`.specs/features/<modulo>/spec.md` — **não refaça Specify**. Entre direto em Design pelo módulo da
vez (ordem no handoff do `.specs/STATE.md`).

**Antes de escrever qualquer código:** leia a spec do módulo inteira e as ADs que ela cita. A spec
tem a lista de `Out of Scope` — respeite; não implemente o que ela excluiu de propósito.

**Ao terminar uma rodada:** atualize só a seção `## Handoff` do `.specs/STATE.md` (substitua o corpo,
não acumule). Decisão nova = `AD-NNN` nova no fim de `## Decisions`, append-only.

**Documentação de biblioteca:** use o MCP do Context7 antes de afirmar API, config ou versão — vale
para Next.js, Supabase, `ts-fsrs`, SDK do Claude, Asaas. Não responda de memória sobre lib.

**Git.** Nunca commite direto na `main`. Branch → commits atômicos → PR. Detalhe em `docs/GITFLOW.md`.

**Comunicação.** Português, direto, sem analogia. Se um número não estiver decidido, diga que não
está — não invente valor para preencher spec.
