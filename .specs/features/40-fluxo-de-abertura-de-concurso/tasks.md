# SPEC 40 — Tasks

> Ritual **B**. O design mora neste arquivo. Ao fim da Execute, um Verificador independente curto
> confere os *Success Criteria* com evidência `file:line`, sem sensor de mutação. Cada task termina
> com seu teste, gate e commit atômico; meta numérica de testes é proibida (AD-090).

## Execution Protocol (obrigatório)

Ative `tlc-spec-driven` e siga o fluxo Execute. Reconcile primeiro `STATE.md`, git e este arquivo;
execute T1→T8 sem redesenhar a feature. A abertura acontece na sessão do Codex ou Claude Code. A
pesquisa usa as ferramentas nativas do agente e consome o limite daquela sessão: **não** criar busca
pela API da OpenAI, provider de busca, tarefa `web_search` ou tarefa nova na matriz de modelos. Não
faça push, deploy, alteração manual no banco nem ligue flag. No `test:db`, aplique uma vez a regra de
rede do `AGENTS.md`.

**Spec**: `.specs/features/40-fluxo-de-abertura-de-concurso/spec.md`  
**Status**: Ready for Execute  
**Branch sugerida**: `feat/spec40-abertura-concurso`

## Design (embutido)

### Decisão de forma: o agente conduz; os comandos validam e gravam

O operador inicia na conversa com “abra o concurso X”. A skill do repositório conduz o fluxo:

```text
operador pede o concurso
  → agente consulta a allowlist e pesquisa a web com as ferramentas da própria sessão
  → comando local valida e registra os links candidatos
  → agente apresenta achados e faltantes → aprovação humana 1
  → comando baixa apenas os aprovados e mede as provas com o pipeline existente
  → agente lê o trecho do programa do edital e propõe os vínculos canônicos
  → agente apresenta assuntos e quase-duplicatas → aprovação humana 2
  → comando aplica decisões, recalcula e mostra prontidão
  → operador confirma a publicação
```

A pesquisa, a leitura do programa do edital e a preparação da proposta consomem a sessão do Codex ou
Claude Code. O produto não chama modelo para isso. A regra de segurança e a verdade persistida não
ficam no prompt: o comando local valida entradas, estados, URLs, documentos, IDs e decisões antes de
escrever no banco. Se o agente não tiver ferramenta de busca ou acesso à rede, ele para e pede URLs
oficiais ao operador; nunca troca silenciosamente para uma API paga.

Não nascem telas web em `/operador` nesta spec. As duas aprovações e a confirmação final acontecem na
conversa, com resumo estruturado emitido pelo comando. O banco conserva a execução para que outra
sessão possa retomá-la sem confiar no histórico do chat.

### Fronteira exata das chamadas pagas

A SPEC 40 acrescenta **zero tarefas de IA**. Ela reaproveita a SPEC 38:

- `etiqueta_de_item`: chamada do caminho normal da medição, hoje configurada para `gpt-5.6-luna`
  com esforço `max`;
- `separacao_de_itens`: mesma configuração, mas só como reserva quando o separador local não fecha
  com a grade declarada.

Essas tarefas classificam itens para o Raio-X; não criam a questão completa. A extração completa de
questões continua sendo o pipeline independente da SPEC 09 (`extracao_pdf`, hoje Luna com esforço
`high` e Batch) e não é acionada automaticamente pela abertura do concurso. Modelo e esforço seguem
somente na configuração; nenhum nome de modelo entra em `src/`, `scripts/` ou testes.

### Pesquisa, proveniência e download

A skill primeiro executa o comando que devolve `param.m1.dominios_oficiais`. O agente usa essa lista
ao pesquisar com a ferramenta disponível na sessão e entrega candidatos estruturados ao comando:
`tipo`, `url`, `titulo` e metadados conhecidos de banca/ano/órgão/cargo/caderno. O agente não decide
que uma URL é segura.

O código aceita somente HTTPS, normaliza o hostname e compara com a allowlist antes de persistir e em
cada redirecionamento antes de baixar. Host local, IP literal, endereço privado e URL com credencial
são recusados. Config ausente ou inválida fecha o fluxo. Resultado recusado nunca aparece na lista de
aprovação; só aumenta `descartados`. O download ocorre exclusivamente depois da primeira confirmação.

O PDF tem limite configurado de 25 MiB, extensão, `Content-Type` e `%PDF-` conferidos, e nome interno
gerado pelo comando. Cada documento aceito guarda a URL oficial. Faltantes permanecem no relatório;
o sistema não inventa documento nem permite agregador.

### Estado persistido e retomada

O fluxo é monotônico:

```text
pesquisa_pendente → documentos_pendentes → documentos_aprovados
                   → processamento_em_andamento → assuntos_pendentes
                   → pronto_para_recalculo → concluida → elegivel → publicado
```

`aberturas_concurso` guarda uma execução ativa por concurso, estado, operador, contagens e faltantes.
`concurso_documentos` guarda os candidatos aceitos, proveniência, decisão humana e vínculo com a prova.
`abertura_assuntos` guarda a proposta produzida pelo agente, candidatos canônicos e decisão humana.
As tabelas não têm acesso de `anon`/`authenticated`; o comando usa a credencial administrativa já
prevista para jobs e exige o identificador do operador para autoria. Retry não duplica abertura,
documento, prova, assunto nem custo.

O banco recusa saltos: candidato não aprovado não é baixado; proposta não aprovada não muda o edital;
publicação continua dependendo de `avaliar_prontidao_do_concurso`. Falha conserva o último estado
íntegro e o comando `relatorio` diz exatamente como retomar.

### Edital, assuntos e quase-duplicatas

Depois do download, o comando extrai texto localmente. Texto de prova não vai ao chat: a prova segue
direto para `medir-prova`. Para o edital, o comando oferece ao agente somente o trecho delimitado do
programa, com páginas e limite de tamanho; é esse trecho que a sessão interpreta, sem chamada à API
do produto. Se o trecho não for encontrado de forma confiável, o fluxo marca pendência e pede revisão
manual, sem enviar o documento inteiro.

O agente devolve uma proposta em schema estrito. O código casa nomes exatos e calcula candidatos
quase-duplicados deterministicamente. Na segunda aprovação, o operador escolhe por linha: mapear para
canônico existente, criar via `topico_candidato`, fundir com a função da SPEC 37 ou rejeitar. Nada é
criado ou fundido automaticamente. A confirmação grava o quadro completo, pesos e vínculos de bloco
em uma transação.

### Skill compartilhada

O roteiro canônico mora em `.agents/skills/abrir-concurso/SKILL.md`. Ele descreve capacidades, não o
nome rígido de uma ferramenta: Codex ou Claude usam sua busca web disponível, respeitam a allowlist,
chamam os mesmos comandos e pausam nas mesmas confirmações. `.claude/skills/abrir-concurso/SKILL.md`
é um adaptador mínimo que manda ler a fonte canônica. Nenhuma regra de validação ou escrita existe só
na skill.

## Security criteria — ASVS v5.0.0, alvo L2

| ID | ASVS | Decisão verificável |
| --- | --- | --- |
| SEC-01 | v5.0.0-2.2.1, v5.0.0-13.2.4, v5.0.0-13.2.5, v5.0.0-15.3.2 | Candidato produzido pelo agente é entrada não confiável; busca/download aceitam somente HTTPS allowlisted e revalidam cada redirect, sem fallback permissivo. |
| SEC-02 | v5.0.0-2.2.2, v5.0.0-13.2.2 | Validação e escrita ocorrem no comando/RPC, não na conversa; IDs precisam pertencer à abertura e toda decisão recebe operador explícito e auditável. |
| SEC-03 | v5.0.0-2.3.1, v5.0.0-2.3.3 | Aprovações e transições são ordenadas e transacionais; não se baixa, aplica edital ou publica fora de ordem. |
| SEC-04 | v5.0.0-5.1.1, v5.0.0-5.2.1, v5.0.0-5.2.2, v5.0.0-5.3.2 | PDF tem tamanho máximo, tipo e magic bytes conferidos, caminho interno e nome externo ignorado. |
| SEC-05 | v5.0.0-16.2.1, v5.0.0-16.3.3, v5.0.0-16.3.4, v5.0.0-16.5.1, v5.0.0-16.5.3 | Log registra quem/o quê/quando e falhas, sem PDF, segredo ou URL recusada; erro é resumido e fecha o fluxo. |

Excluídos por escopo: navegador do produto, OAuth novo, multi-tenant novo e upload por aluno. A
feature foi especificada contra os requisitos acima; isto não declara o produto conforme ao ASVS.

## Test Coverage Matrix

> Gerada de `AGENTS.md`, `docs/GITFLOW.md`, `vitest.config.mts`, `package.json`, SPECS 37–39,
> `medir-prova`, jobs e gateway. Os AC e casos de borda são o alvo; o padrão existente define
> localização e estilo, não reduz cobertura.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Config e schemas de entrada | unit | Todos os ramos; config ilegível e manifesto hostil fecham; prova de que nenhuma tarefa de IA foi adicionada | `src/**/*.test.ts` | `npm run test:unit` |
| URL, download e extração local | unit | HTTPS/allowlist/redirect, tamanho/tipo/magic bytes, trecho limitado do edital e ausência de prova no stdout | `src/**/*.test.ts` | `npm run test:unit` |
| Estado, decisões e auditoria | db | Ordem, atomicidade, idempotência, escopo dos IDs, autoria e integração com SPECS 37–39 | `tests/db/spec40-*.test.ts` | `npm run test:db -- tests/db/spec40-abertura-concurso.test.ts` |
| CLI de abertura | unit + db integration | Caminho feliz, retomada, recusa prematura, falha externa, relatórios e integração com `medir-prova` | `scripts/jobs/*.test.ts` | `npm run test:unit` + gate DB focal |
| Skills do repositório | unit | Codex e Claude usam a mesma fonte, busca é da sessão, há duas pausas e nenhuma busca/API nova do produto | `scripts/**/*.test.ts` | `npm run test:unit` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Task só com unitários | `npm run test:unit` |
| Full | Task com migration ou contrato entre camadas | `npm run test:unit && npm run test:db -- tests/db/spec40-abertura-concurso.test.ts` |
| Build | Fim de fase e T8 | `npm run lint && npx tsc --noEmit && npm run build && npm run test:unit && npm run test:db` |

## Execution Plan

```text
Phase 1 — contratos       T1 → T2
Phase 2 — entrada segura  T2 → T3 → T4
Phase 3 — operação        T4 → T5 → T6
Phase 4 — agentes/fecho   T6 → T7 → T8
```

## Task Breakdown

### T1: Fixar configuração sem criar tarefa de IA

**What**: adicionar `param.m1.dominios_oficiais`, `param.m1.meta_provas_por_concurso` (4), `param.m1.tamanho_maximo_pdf_mib` (25) e `param.m1.limiar_quase_duplicata` (0,78), com validação fechada; acrescentar teste que prova que a SPEC 40 não criou tarefa, perfil ou segredo de busca.  
**Where**: `src/modules/config/catalogo.ts`  
**Depends on**: None  
**Reuses**: catálogo Zod, `TAREFAS`, testes anti-modelo-hardcoded.  
**Requirement**: BANCO-01, BANCO-02, AD-078, AD-140, AD-145, SEC-01, SEC-04  
**Tools/Skills**: `apply_patch`; `asvs`.  
**Done when**: config inválida fecha; defaults são calibrações; `tarefas.ts` e a matriz não ganham busca nem extração de edital; unitários focais verdes.  
**Tests**: unit  
**Gate**: quick  
**Commit**: `feat(m1): configura abertura pela sessão`

### T2: Persistir a abertura e travar a ordem das confirmações

**What**: criar migration com `aberturas_concurso`, `concurso_documentos`, `abertura_assuntos`, vínculo de origem em `provas` e RPCs transacionais de registro/decisão; restringir privilégios, exigir autoria e tornar retries idempotentes.  
**Where**: `supabase/migrations/20260909120000_spec40_abertura_concurso.sql`  
**Depends on**: T1  
**Reuses**: `registrar_acao_operador`, `publicar_concurso`, `fundir_assuntos_canonicos`, `provas_alvo_unico`.  
**Requirement**: BANCO-01, BANCO-02, RAIOX-07, RAIOX-20, SEC-02, SEC-03  
**Tools/Skills**: `apply_patch`; `asvs`.  
**Done when**: salto de estado, ID cruzado e decisão sem operador falham; retry não duplica; prova nova guarda URL oficial; teste DB focal verde.  
**Tests**: db  
**Gate**: full  
**Commit**: `feat(m1): persiste abertura conduzida pelo agente`

### T3: Validar candidatos e baixar somente fonte aprovada

**What**: criar módulo que recebe os candidatos encontrados pelo agente, valida schema/HTTPS/allowlist, registra aceitos e descartados e baixa somente os aprovados com revalidação de redirect, limite e assinatura PDF. Não implementar pesquisa.  
**Where**: `src/modules/acervo/documentos-oficiais.ts`  
**Depends on**: T2  
**Reuses**: config, `reportarErro` e padrões de injeção de dependência dos jobs.  
**Requirement**: BANCO-01, BANCO-02, AD-003, AD-140, AD-145, SEC-01, SEC-04, SEC-05  
**Tools/Skills**: `apply_patch`; `asvs`.  
**Done when**: HTTP, domínio fora, IP/host privado, credencial, redirect cruzado, oversized e falso PDF são recusados; nenhuma função pesquisa a web; unitários focais verdes.  
**Tests**: unit  
**Gate**: quick  
**Commit**: `feat(m1): valida documentos encontrados na sessão`

### T4: Entregar a primeira confirmação pelo comando

**What**: criar CLI `abrir-concurso` com ações `iniciar`, `dominios`, `registrar-achados` e `decidir-documentos`; entrada de achados é JSON estrito produzido pelo agente, e a saída mostra IDs, títulos, URLs aceitas, faltantes e descartados sem baixar antes da confirmação.  
**Where**: `scripts/jobs/abrir-concurso.mts`  
**Depends on**: T3  
**Reuses**: `alvo-do-banco`, repositório/config por `pg`, Sentry dos jobs e RPCs da T2.  
**Requirement**: BANCO-01, BANCO-02, AD-140, AD-145, SEC-02, SEC-03, SEC-05  
**Tools/Skills**: `apply_patch`.  
**Done when**: o agente consegue iniciar e registrar links sem edição de código; decisão prematura falha; aprovação baixa apenas aceitos; retomada devolve o mesmo relatório; unitários e DB focal verdes.  
**Tests**: unit + db integration  
**Gate**: full  
**Commit**: `feat(m1): conduz aprovação de documentos no cli`

### T5: Preparar e aplicar a segunda confirmação sem API de modelo

**What**: acrescentar ações `programa`, `propor-assuntos` e `decidir-assuntos`; extrair localmente trecho limitado do edital, aceitar proposta estruturada produzida pelo agente, calcular quase-duplicatas por código e aplicar o quadro completo somente após confirmação.  
**Where**: `scripts/jobs/abrir-concurso.mts`  
**Depends on**: T4  
**Reuses**: leitor de PDF, `normalizarNome`, `casarTopico`, `registrar_peso_do_edital`, `vincular_bloco_a_materia`, `fundir_assuntos_canonicos`.  
**Requirement**: RAIOX-07, RAIOX-20, AD-139, AD-140, AD-145, SEC-02, SEC-03, SEC-05  
**Tools/Skills**: `apply_patch`; `asvs`.  
**Done when**: só o trecho do programa aparece; saída parcial vira pendência; nenhuma chamada ao gateway ocorre; nada canônico muda sem decisão; unitários e DB focal verdes.  
**Tests**: unit + db integration  
**Gate**: full  
**Commit**: `feat(m5): conduz aprovação do programa no cli`

### T6: Reusar a medição existente e fechar o relatório

**What**: acrescentar ações `processar-provas`, `recalcular`, `relatorio` e `publicar`, delegando grade/separação/etiqueta ao `medir-prova` da SPEC 38 e prontidão/publicação às RPCs da SPEC 39/37, sem tarefa nova de IA nem extração completa automática de questões.  
**Where**: `scripts/jobs/abrir-concurso.mts`  
**Depends on**: T5  
**Reuses**: `medir-prova`, `avaliar_prontidao_do_concurso`, `publicar_concurso`, `degrau`, `etiqueta_de_item`, `separacao_de_itens`.  
**Requirement**: RAIOX-20, BANCO-01, AD-035, AD-036, AD-140, AD-141, AD-145, SEC-03, SEC-05  
**Tools/Skills**: `apply_patch`.  
**Done when**: caminho determinístico não chama modelo; etiqueta e reserva usam apenas tarefas existentes; relatório mostra degrau e próximo passo; publicação exige confirmação/eligibilidade; gates focais verdes.  
**Tests**: unit + db integration  
**Gate**: full  
**Commit**: `feat(m5): fecha abertura com pipeline existente`

### T7: Ensinar Codex e Claude a conduzir a mesma sessão

**What**: criar a skill canônica e o adaptador Claude; o roteiro consulta domínios, pesquisa com a ferramenta da própria sessão, entrega achados ao CLI, pausa nas duas confirmações, processa e pede confirmação final de publicação. Adicionar teste estático do contrato.  
**Where**: `.agents/skills/abrir-concurso/SKILL.md`  
**Depends on**: T6  
**Reuses**: protocolo de skills do repositório e comandos T4–T6.  
**Requirement**: todos os Success Criteria, AD-140, AD-145, SEC-05  
**Tools/Skills**: `apply_patch`; `skill-creator`; documentação oficial das ferramentas somente para descoberta/sintaxe.  
**Done when**: `$abrir-concurso` e `/abrir-concurso` apontam à mesma fonte; falta de busca pede URLs ao operador; teste prova zero menção a API/provider de busca e a ordem das três confirmações; unitários verdes.  
**Tests**: unit  
**Gate**: quick  
**Commit**: `feat(m5): cria roteiro de abertura por agente`

### T8: Verificar e fechar a SPEC 40

**What**: executar gates completos; Verificador independente curto confere cada Success Criterion com evidência, incluindo ausência de integração de busca/API nova; registrar `validation.md` e fechar spec, ROADMAP e handoff somente com PASS.  
**Where**: `.specs/features/40-fluxo-de-abertura-de-concurso/validation.md`  
**Depends on**: T7  
**Reuses**: validator do `tlc-spec-driven`, matriz de cobertura e `git diff`.  
**Requirement**: todos os requisitos e SEC-01–SEC-05  
**Tools/Skills**: `tlc-spec-driven`; `asvs`; `apply_patch`.  
**Done when**: build e suítes completos passam; Verificador cita `file:line`; `validate_state.py` passa; status final não afirma chamada ou tela que não existe.  
**Tests**: unit + db integration + build  
**Gate**: build  
**Commit**: `docs(spec40): valida fluxo de abertura por sessão`

## Phase Execution Map

```text
T1 ──→ T2 ──→ T3 ──→ T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8
```

## Task Granularity Check

| Task | Entrega atômica | Status |
| --- | --- | --- |
| T1 | contrato de configuração | ✅ coeso |
| T2 | estado persistido | ✅ coeso |
| T3 | fronteira de documento oficial | ✅ coeso |
| T4 | primeira confirmação no CLI | ✅ coeso |
| T5 | segunda confirmação no CLI | ✅ coeso |
| T6 | processamento e prontidão | ✅ coeso |
| T7 | protocolo compartilhado dos agentes | ✅ coeso |
| T8 | verificação e fechamento | ✅ coeso |

Testes e exports colocalizados pertencem à mesma entrega. T4–T6 estendem o mesmo entrypoint em
commits separados, cada um deixando um conjunto fechado de ações testável.

## Diagram-Definition Cross-Check

| Task | Depends on | Diagram shows | Status |
| --- | --- | --- | --- |
| T1 | None | início | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | T3 | T3→T4 | ✅ Match |
| T5 | T4 | T4→T5 | ✅ Match |
| T6 | T5 | T5→T6 | ✅ Match |
| T7 | T6 | T6→T7 | ✅ Match |
| T8 | T7 | T7→T8 | ✅ Match |

## Test Co-location Validation

| Task | Layer | Matrix requires | Task says | Status |
| --- | --- | --- | --- | --- |
| T1 | config/schema | unit | unit | ✅ OK |
| T2 | schema/RPC/state | db | db | ✅ OK |
| T3 | URL/download | unit | unit | ✅ OK |
| T4 | CLI + DB | unit + db integration | unit + db integration | ✅ OK |
| T5 | CLI + DB | unit + db integration | unit + db integration | ✅ OK |
| T6 | CLI + DB | unit + db integration | unit + db integration | ✅ OK |
| T7 | skills | unit | unit | ✅ OK |
| T8 | fechamento | unit + db + build | unit + db integration + build | ✅ OK |

## Requirement Traceability

| Requirement | Tasks |
| --- | --- |
| BANCO-01 | T1, T2, T3, T4, T6 |
| BANCO-02 | T1, T2, T3, T4 |
| RAIOX-07 | T2, T5, T7 |
| RAIOX-20 | T2, T5, T6, T7 |
| AD-140 | T1–T8 |
| AD-141 | T6 |
| AD-145 | T1–T8 |
| SEC-01 | T1, T3 |
| SEC-02 | T2, T4, T5 |
| SEC-03 | T2, T4, T5, T6 |
| SEC-04 | T1, T3 |
| SEC-05 | T3–T8 |
