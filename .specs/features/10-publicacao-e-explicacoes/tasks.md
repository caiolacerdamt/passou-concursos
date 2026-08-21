# SPEC 10 — Publicação do acervo e explicações · Tasks

> **Ritual B** (AD-090): design embutido, tasks atômicas e Verificador independente curto no fim.
> A unidade de mudança é uma task por commit; a fila continua operável pelo Supabase Studio nesta
> spec. A tela do operador e a tela do aluno ficam fora do escopo.

## Design embutido

### Fronteira

O banco é a porta confiável da publicação. A fábrica roda em script standalone e usa o gateway de IA
existente. A IA recebe a referência no mesmo pedido, devolve saída estruturada, e o código confere a
alternativa, as citações e as restrições da fonte antes de persistir.

### Dados e fluxo

`questao_revisoes` é a fila única, com motivo, prioridade, decisão, operador e data. `base_referencia`
guarda documentos por tópico, com origem `oficial` ou `resumo_nosso` e status `rascunho` ou `conferido`;
na leitura, documento oficial conferido vence resumo conferido. `explicacoes` referencia o par
`(questao_id, questao_versao)`, tem versão própria, status e `fontes_citadas`.

O job seleciona questão com gabarito e sem explicação vigente, monta a referência do tópico ou a fonte
mínima formada pela questão e pelo gabarito oficial, e chama `explicacao` uma vez pelo gateway. Uma
resposta válida grava explicação e citações conferidas. Resposta sem citação, com trecho inexistente,
com alternativa divergente ou com afirmação externa na fonte mínima grava motivo na fila e não publica.

Publicação exige, no banco, proveniência e gabarito já existentes, explicação aprovada, e revisão
humana quando a confiança está abaixo do piso, quando a questão real cai na amostra, ou quando a origem
é `gerada_ia`. A amostra é determinística por questão para ser auditável e testável. A decisão da
revisão guarda operador e timestamp.

### Critérios de segurança aplicáveis (ASVS v5.0.0, alvo L2)

| ID | Referência | Decisão da SPEC 10 | Verificação |
| --- | --- | --- | --- |
| SEC-01 | v5.0.0-2.2.1, v5.0.0-2.2.2 | Saída estruturada e publicação são validadas no serviço confiável/banco; cliente não decide publicação. | Testes unitários e DB atacando funções/tabela diretamente. |
| SEC-02 | v5.0.0-2.2.3, v5.0.0-2.3.2 | Questão, versão, gabarito, explicação e revisão precisam formar combinação coerente; baixa confiança não abre publicação. | Testes de publicação e de explicação. |
| SEC-03 | v5.0.0-2.3.3 | Gravação da explicação e seus metadados é atômica; falha não deixa resultado parcial publicável. | Teste de transação/estado e constraints. |
| SEC-04 | v5.0.0-16.2.1, v5.0.0-16.3.3 | Revisão registra quem, quando, motivo e decisão; falhas de validação entram na fila. | Testes DB e relatório do job. |
| SEC-05 | v5.0.0-16.5.2, v5.0.0-16.5.3 | Falha ou ausência da API não abre publicação nem impede o núcleo sem IA. | Testes do job e gate do núcleo existente. |
| SEC-06 | v5.0.0-15.3.5 | Entradas estruturadas são validadas com tipos e comparação estrita; nenhum código devolvido pela IA é executado. | Testes de schema e citações. |

### Limites assumidos

- Defaults iniciais de calibração: piso de confiança `0.95` e amostra de auditoria `0.10`; ambos são
  parâmetros do banco e podem ser trocados sem deploy.
- O primeiro lote usa a fonte mínima quando não houver tópico/documento conferido. A fila registra a
  pendência de base quando houver tópico canônico; não cria tópico pela fábrica.
- Quantitativas não ganham verificação por fórmula nesta rodada; entram na fila humana conforme o corte
  da SPEC 10.

## Matriz de cobertura

| Camada | Teste | Local | Gate |
| --- | --- | --- | --- |
| Configuração e contratos | unit | `src/modules/config/**`, `src/modules/acervo/**`, `src/modules/ia/**` | `npm run test:unit` |
| Schema, RLS, fila e publicação | integração | `tests/db/publicacao-explicacoes.test.ts` | `npm run test:db` |
| Job | unit | `scripts/jobs/explicacoes.test.ts` | `npm run test:unit` |
| Fechamento | todos | projeto inteiro | `npm run build && npm run lint && npm test` |

## Gate Check Commands

- **Quick**: `npm run test:unit`
- **Full**: `npm run test:unit && npm run test:db`
- **Build**: `npm run build && npm run lint && npm test`

## Execution Plan

### Fase 1 — contrato de dados e publicação

#### T87: Configuração da QA de publicação

**What**: declarar piso de confiança e taxa de amostra no catálogo, com testes de tipo/default e sem
chave órfã. **Where**: `src/modules/config/catalogo.ts`, testes do catálogo. **Done when**: defaults
`0.95` e `0.10`, valores fora de `0..1` recusados, unit gate verde. **Depends**: SPEC 09.

**Status**: ✅ concluída. **Gate**: `npm run test:unit` — 450 testes passando.

**Post-gate adequacy**:

| Critério | Evidência | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| Dois parâmetros existem com defaults calibráveis | `src/modules/config/catalogo.test.ts:83` — `expect(piso.padrao).toBe(0.95)` e `src/modules/config/catalogo.test.ts:84` — `expect(amostra.padrao).toBe(0.1)` | Piso `0.95` e amostra `0.10` | ✅ |
| Valores fora de `0..1` são recusados | `src/modules/config/catalogo.test.ts:86-87` — `expect(tipo.safeParse(-0.01).success).toBe(false)` e `expect(tipo.safeParse(1.01).success).toBe(false)` | Configuração inválida não passa pelo schema | ✅ |
| Nenhuma chave fica órfã | `src/modules/config/catalogo.test.ts:55` — `expect([...flags, ...parametros].sort()).toEqual([...CHAVES].sort())` | Catálogo e lista esperada permanecem alinhados | ✅ |

Necessidade: todos os critérios da task têm asserts específicos; nenhum teste excede a task.

#### T88: Schema de revisão, base e explicação

**What**: criar enums/tabelas, FKs ao par da questão, versão da explicação, origem/status da base,
privilegios fechados e índices da fila. **Where**: nova migration e `tests/db/publicacao-explicacoes.test.ts`.
**Done when**: constraints, RLS, ausência de `user_id` e privilégios passam no DB gate. **Depends**: T87.

**Status**: ✅ concluída. **Gate**: `npm run test:db -- tests/db/publicacao-explicacoes.test.ts` — 4 testes passando.

**Post-gate adequacy**:

| Critério | Evidência | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| RLS e privilégios fechados | `tests/db/publicacao-explicacoes.test.ts:17` — `expect(grants).toEqual([])` e `:29` — `expect(rls).toEqual([...])` | Navegador não lê nem escreve; as três tabelas têm RLS | ✅ |
| Explicação/revisão usam questão e versão, sem `user_id` | `tests/db/publicacao-explicacoes.test.ts:50` — `expect(rows).toEqual([...])` | Referência ao par e nenhum dado de aluno | ✅ |
| FK impede par inexistente | `tests/db/publicacao-explicacoes.test.ts:67` — `rejects.toThrow(/explicacoes_questao_fk|foreign key/i)` | Explicação órfã é recusada | ✅ |
| Explicação aprovada exige fonte | `tests/db/publicacao-explicacoes.test.ts:81` — `rejects.toThrow(/explicacoes_aprovada_tem_fonte/)` | Nenhuma explicação aprovada sem citação | ✅ |

Necessidade: todos os critérios da task têm asserts de estado/erro; os critérios de decisão da fila ficam
na T89 e os de seleção da base na T91, conforme as dependências.

#### T89: Operação da fila humana

**What**: criar funções SQL para enfileirar motivo e registrar decisão com operador/data, sem permitir
decisão incompleta. **Where**: migration de T88 e testes DB. **Done when**: pendência, aprovação,
rejeição e auditoria ficam observáveis e idempotentes. **Depends**: T88.

**Status**: ✅ concluída. **Gate**: `npm run test:db -- tests/db/publicacao-explicacoes.test.ts` — 6 testes passando.

**Post-gate adequacy**:

| Critério | Evidência | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| Uma pendência por motivo e prioridade maior prevalece | `tests/db/publicacao-explicacoes.test.ts:98` — `expect(segunda.rows[0].id).toBe(primeira.rows[0].id)` e `:104` — `expect(rows[0]).toMatchObject({ status: "pendente", prioridade: 8, ... })` | Repetição não duplica e mantém prioridade maior | ✅ |
| Aprovação registra decisão, operador e data | `tests/db/publicacao-explicacoes.test.ts:137-140` — asserts de `status`, `decidido_por`, `decidida_em` e observação | Quem e quando ficam registrados | ✅ |
| Pendência decidida não pode ser decidida de novo | `tests/db/publicacao-explicacoes.test.ts:144` — `rejects.toThrow(/revisao_nao_esta_pendente/)` | Não há sobrescrita silenciosa da decisão | ✅ |

Necessidade: os asserts verificam estado persistido e erro de transição, não apenas chamadas.

#### T90: Porta de publicação no banco

**What**: substituir a trava estrutural de inédita por trigger/função que exige revisão quando aplicável
e exige explicação aprovada; manter proveniência/gabarito e amostra configurável. **Where**: migration
nova e testes DB. **Done when**: baixa confiança, amostra e origem gerada são bloqueadas sem decisão;
real aprovada só publica com explicação. **Depends**: T89.

**Status**: ✅ concluída. **Gate**: 71 testes DB passando, incluindo fixtures existentes de acervo e plano.

**Post-gate adequacy**:

| Critério | Evidência | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| Baixa confiança manda real à revisão | `tests/db/publicacao-explicacoes.test.ts:216` — `rejects.toThrow(/questao_exige_revisao_humana/)` | Não publica sem aprovação humana | ✅ |
| Amostra alcança real de alta confiança | `tests/db/publicacao-explicacoes.test.ts:231` — `rejects.toThrow(/questao_exige_revisao_humana/)` com amostra `1` | Amostra configurada bloqueia publicação | ✅ |
| Explicação aprovada é obrigatória | `tests/db/publicacao-explicacoes.test.ts:245` — `rejects.toThrow(/explicacao_nao_aprovada/)` | Questão não fica publicada sem explicação | ✅ |
| Publicação válida muda o estado | `tests/db/publicacao-explicacoes.test.ts:259` — `expect(rows[0].publicar_questao).toBe(true)` e `:265` — `expect(atualizada[0].status).toBe("publicada")` | Porta publica somente após os pré-requisitos | ✅ |
| Inédita exige revisão completa | `tests/db/publicacao-explicacoes.test.ts:283` — `rejects.toThrow(/gerada_ia_passa_por_revisao/)` e `:293` — `expect(rows[0].status).toBe("publicada")` | Sem revisão bloqueia; com aprovação publica | ✅ |
| Proveniência e gabarito continuam travados | `tests/db/acervo-proveniencia.test.ts:25`, `:43` e `:123` — asserts dos nomes das constraints | Real sem fonte e questão sem gabarito continuam recusadas | ✅ |

Necessidade: os testes exercitam trigger, função pública de publicação e fixtures antigas; não dependem
apenas de chamadas do job.

### Fase 2 — contrato e persistência da explicação

#### T91: Seleção da base de referência

**What**: ler documento conferido, preferindo oficial; montar fonte mínima da questão + gabarito quando
não existir base; enfileirar pendência de base. **Where**: `src/modules/acervo/base-referencia.ts` e
testes unit/DB. **Done when**: seleção respeita origem/status e nunca usa rascunho. **Depends**: T88.

**Status**: ✅ concluída. **Gate**: `npm run test:unit` — 51 arquivos e 454 testes passando.

| Critério | Evidência | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| Documento precisa estar conferido | `src/modules/acervo/base-referencia.ts:35-42` — consulta filtra `status = 'conferido'` | Rascunho nunca é entregue à IA | ✅ |
| Origem oficial tem prioridade | `src/modules/acervo/base-referencia.ts:39-40` e `src/modules/acervo/base-referencia.test.ts:67-87` | Documento oficial vem antes de resumo nosso | ✅ |
| Fonte mínima contém dados oficiais | `src/modules/acervo/base-referencia.ts:70-99` e `src/modules/acervo/base-referencia.test.ts:47-59` | Enunciado, alternativas, proveniência e gabarito são entregues | ✅ |
| Falta de base abre pendência | `src/modules/acervo/base-referencia.ts:125-130` e `src/modules/acervo/base-referencia.test.ts:90-104` | A questão não fica sem rastreabilidade | ✅ |
| Fonte mínima sem gabarito é recusada | `src/modules/acervo/base-referencia.test.ts:61-65` | A IA não recebe questão sem verdade oficial | ✅ |

Necessidade: os asserts cobrem a decisão de seleção e o fallback; a precedência real entre registros
oficial/resumo/rascunho será exercitada contra o banco no gate de integração da T96.

#### T92: Saída estruturada e conferência de citações

**What**: schema da explicação, normalização PT-BR, conferência literal de trechos, alternativa correta
e veto de afirmações externas na fonte mínima. **Where**: `src/modules/ia/explicacao.ts` e testes unit.
**Done when**: cada sucesso e cada rejeição da spec tem assert específico. **Depends**: T91.

**Status**: ✅ concluída. **Gate**: `npm run test:unit` — 52 arquivos e 464 testes passando; `npm run lint` limpo.

| Critério | Evidência | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| Saída estruturada strict | `src/modules/ia/explicacao.ts:10-33,37-82` e `src/modules/ia/explicacao.test.ts:35-49` | Só o formato declarado pode chegar à conferência | ✅ |
| Citação é comparada por código | `src/modules/ia/explicacao.ts:101-106,162-180` e `src/modules/ia/explicacao.test.ts:50-93` | Caixa, acento, pontuação e espaços não quebram uma citação válida; trecho ausente é rejeitado | ✅ |
| Nenhuma citação também é rejeição | `src/modules/ia/explicacao.ts:25` e `src/modules/ia/explicacao.test.ts:72-80` | Explicação sem fonte não passa | ✅ |
| Gabarito continua sendo oficial | `src/modules/ia/explicacao.ts:140-148` e `src/modules/ia/explicacao.test.ts:108-116` | Contradição da alternativa correta é rejeitada | ✅ |
| Fonte mínima não autoriza fato externo | `src/modules/ia/explicacao.ts:150-158` e `src/modules/ia/explicacao.test.ts:118-140` | Afirmação externa declarada não passa, inclusive na fonte mínima | ✅ |
| Documento citado é o entregue no pedido | `src/modules/ia/explicacao.ts:162-169` e `src/modules/ia/explicacao.test.ts:95-106` | O provedor não escolhe uma fonte diferente | ✅ |

Necessidade: o schema não decide conteúdo por si; a função `conferirExplicacao` é a barreira de código
antes da persistência. A fila e o registro da rejeição serão ligados na T93/T95.

#### T93: Persistência idempotente da explicação

**What**: inserir explicação aprovada/rejeitada vinculada à questão-versão, guardar citações e ligar a
`ia_geracoes` sem duplicar. **Where**: `src/modules/acervo/explicacao.ts`, migration se necessária,
testes unit/DB. **Done when**: duas execuções deixam uma explicação e resultado inválido não abre
publicação. **Depends**: T90, T92.

**Status**: ✅ concluída. **Gate**: `npm run test:unit` — 53 arquivos e 470 testes passando; `npm run lint` limpo.

| Critério | Evidência | Resultado esperado | Coberto |
| --- | --- | --- | --- |
| Aprovada fica ligada à questão-versão e ao dedup do IA | `src/modules/acervo/explicacao.ts:22-52` e `src/modules/acervo/explicacao.test.ts:39-57` | A linha leva par, versão própria, fontes e a mesma chave da geração | ✅ |
| Execuções repetidas não duplicam | `src/modules/acervo/explicacao.ts:31` e `src/modules/acervo/explicacao.test.ts:60-67` | Conflito no banco retorna sem segunda linha | ✅ |
| Rejeitada não fica vigente nem serve como fonte conferida | `src/modules/acervo/explicacao.ts:56-86` e `src/modules/acervo/explicacao.test.ts:70-88` | Resultado semântico rejeitado não abre publicação | ✅ |

Necessidade: a persistência só recebe `ExplicacaoGerada`, que já passou pelo schema; saída malformada
continua fora do banco. A integração da chave com uma geração real e o trigger de publicação ficam no
job/gate da T95/T96.

#### T94: Montagem do pedido da fábrica

**What**: instrução estável e entrada variável com referência no mesmo pedido, schema strict e chave de
dedup por questão-versão. **Where**: `src/modules/ia/explicacao.ts`, testes unit. **Done when**: pedido
não combina extração e explicação e o gateway registra tarefa/prompt. **Depends**: T92.

### Fase 3 — job e fechamento

#### T95: Job standalone da fábrica

**What**: implementar geração retomável em `.mts`, com cliente SQL/repositório e degradação limpa sem
chave. **Where**: `scripts/jobs/explicacoes.mts`, testes e `package.json`. **Done when**: gerar, rejeitar,
enfileirar e deduplicar funcionam; nenhum caminho entra em `src/app`. **Depends**: T93, T94.

#### T96: Testes de integração da publicação e explicação

**What**: completar cobertura dos Success Criteria contra banco e job, incluindo operador/data e núcleo
sem IA. **Where**: `tests/db/publicacao-explicacoes.test.ts`, `scripts/jobs/explicacoes.test.ts`.
**Done when**: Full gate verde quando `DATABASE_URL` estiver disponível. **Depends**: T90, T95.

#### T97: Fechamento da SPEC 10

**What**: atualizar docs, workflow manual, `STATE.md`, roadmap e registrar AD da rodada; rodar gate de
build/lint/test e preparar a validação independente. **Where**: `.specs/*`, `docs/*`, `.github/workflows/*`.
**Done when**: documentação explica como operar a fábrica e o handoff aponta a SPEC 11. **Depends**: T96.

## Verificação independente (Ritual B)

Após T97, um Verificador independente deve reler apenas os Success Criteria, localizar evidência
`file:line`, conferir o resultado esperado contra a spec, rodar os gates disponíveis e escrever
`.specs/features/10-publicacao-e-explicacoes/validation.md`. O Ritual B não usa sensor de mutação.
