# SPEC 14 — Validação independente final

- Data: 2026-08-23
- Feature/spec: .specs/features/14-progresso-lgpd-minima-e-go-live/spec.md
- Branch: feat/m4-p1-progresso-lgpd-go-live
- Diff range: main ac479c4bd399e94f1ad3066385dc7ddf81b46ad1 até HEAD 44e73dc7bf755b5b14a9e1d3d3c3b835dade8f51
- Commits finais revalidados: 05e1e5b03b3289be88d6b0736fe19073d27e2ee2, 8a2e962c1399d3c805aa4147fca945761a4cd176, fbb237303b1fc93e4613a773498fb4d53c0472eb, ac2462ed4b40fc644ef903e3f88de4c20ce58513 e 44e73dc7bf755b5b14a9e1d3d3c3b835dade8f51
- Verifier independente: autor da implementação não é o verificador desta rodada.
- Escopo de escrita: somente este validation.md; nenhum código, migration, teste, spec, task, documentação auxiliar, commit, push ou stash foi alterado.

## Validation

**Result**: PASS

## Veredito geral

PASS técnico e de evidência automatizada. Os 10 Acceptance Criteria das user stories têm evidência
com caminho, linha e asserção; T1–T12 relevantes estão cobertos; o sensor proporcional de caminho
crítico matou 10/10 mutações; e os quatro gates finais passaram. As limitações de produção,
terceiros, jurídico e UAT abaixo continuam manuais e não foram convertidas em falsa evidência.

Não há GAP técnico ou de evidência automatizada não resolvido nesta rodada. As duas observações de
conteúdo/processo foram corrigidas após a rodada: o comentário de exceções financeiras agora reflete
o inventário real e as metas numéricas de assertions foram removidas das tasks conforme AD-090.
Permanece apenas whitespace de Markdown e linhas finais em arquivos alterados; lint/build continuam
verdes e isso não muda o comportamento.

## Task Completion — T1 a T12

| Task | Resultado independente | Evidência principal |
| --- | --- | --- |
| T1 — sequência/folga | PASS | tests/db/spec14-sequencia.test.ts:106-127,176-181,199-210,252-262,266-295 — toMatchObject, toEqual, toBe(0), toBe(5) e toEqual({ sequencia: 1, estado: "cumprido" }); SQL base em supabase/migrations/20260822230000_spec14_sequencia.sql:222-232,245-247,251-369. |
| T2 — esquecimento/retenção | PASS | supabase/migrations/20260822231000_spec14_esquecimento.sql:46-117,131-169; tests/db/spec14-esquecimento.test.ts:166-227,231-261,265-279; tests/db/grupo-1.test.ts:20-58. |
| T3 — job | PASS | tests/db/spec14-cron.test.ts:24-37,39-63 — schedule, active, RPC, ordem, lock, fuso, janela e count 1. |
| T4 — repositório | PASS | src/modules/aluno/progresso.test.ts:48-64,68-126,128-205 — allowlist/UUID, dois eq no caderno, ausência de tentativas, estado inicial e erros controlados. |
| T5 — tela | PASS; UAT visual manual | src/app/app/progresso/page.test.tsx:67-131 e src/modules/aluno/progresso-tela.test.tsx:27-88 — guarda, filtros, estados e vocabulário solo; src/app/app/progresso/page.tsx:15,44-75 — SSR/dynamic. |
| T6 — Resend/server-only | PASS | src/modules/lgpd/email.ts:1,54-95; src/modules/lgpd/email.test.ts:13-16,18-129; package.json:23-37; vitest.config.mts:9-15,22-36; import real do pacote server-only falha fechado fora do grafo server. |
| T7 — conta/action | PASS | src/app/app/conta/acoes.ts:10-42; src/app/app/conta/acoes.test.ts:41-83; src/modules/lgpd/esquecimento.ts:97-143; src/modules/lgpd/esquecimento.test.ts:23-86. |
| T8 — documentos/go-live | PASS documental; pré-requisitos manuais | src/app/paginas-publicas.test.tsx:10-25; src/app/page.test.tsx:27-39; src/app/checkout/page.test.tsx:26-33; docs/GO-LIVE-SPEC14.md:3-104. |
| T9 — última data/zero/fim de semana | PASS | supabase/migrations/20260823093000_spec14_sequencia_ultima_data.sql:47-53 e 116-127; supabase/migrations/20260823094000_spec14_sequencia_estado_inicial.sql:46-54; tests/db/spec14-sequencia.test.ts:199-210,214-264,266-295. |
| T10 — fixture de 30/inventário final | PASS | tests/db/spec14-esquecimento.test.ts:91-103,166-170,211-227 — loop 28 + duas tentativas, expect count 30 antes do apagamento, inventário zero aberto salvo fila e zero após finalização. |
| T11 — três causas/solo | PASS | src/modules/aluno/progresso-tela.test.tsx:70-87 e 37-51; src/app/app/progresso/page.test.tsx:67-84. |
| T12 — barreira server-only/rastreabilidade | PASS | src/modules/lgpd/email.ts:1; src/modules/lgpd/email.test.ts:13-16; vitest.config.mts:9-15,22-36; design.md:95-101; tasks.md:442-469. |

### Done when — evidência item a item

#### T1 — tasks.md:86-98

- Projeção conserva piso, agenda, folga e estado: tests/db/spec14-sequencia.test.ts:106-127 —
  expect(linhas.rows).toHaveLength(3) e três expect(linhas.rows[i]).toMatchObject(...).
- Fora da agenda/folga não quebra e piso pendente zera: tests/db/spec14-sequencia.test.ts:176-181 —
  expect(rows.map(...)).toEqual([cumprido 1, folga 1, piso_pendente 0]); e :114-127 —
  expect(linhas.rows[1/2]).toMatchObject({ estado: "fora_agenda", sequencia: 1 }).
- Identidade e privilégio: supabase/migrations/20260822230000_spec14_sequencia.sql:245-247,
  266-267 e 371-374 — revoke all/grant execute e auth.uid(); tests/db/spec14-sequencia.test.ts:190-210 —
  expect(rows[0].estado).toBe("fora_agenda"), expect(rows[0].sequencia).toBe(0) e expect(projeção[0].n).toBe("0").
- Idempotência: tests/db/spec14-sequencia.test.ts:129-138 — expect(segundo.rows[0].n).toBe(3) e
  expect(total.rows[0].n).toBe("3").
- Cobertura: tests/db/spec14-sequencia.test.ts:72-321 — 21 ocorrências de expect em 6 testes;
  os valores exercitam agendado, fora da agenda, folga, piso, inicial, isolamento e idempotência.
- Gate: npm run test:db exit 0, 46 arquivos e 364 testes, zero skips.

#### T2 — tasks.md:122-136

- Serviço/porta: supabase/migrations/20260822231000_spec14_esquecimento.sql:46-61,131-133 —
  lock, set_config local e grant somente service_role; tests/db/spec14-esquecimento.test.ts:270-278 —
  rejects.toThrow(/permission denied|execute|porta|esquecimento/).
- Grupo 1 e INSERT-only: supabase/migrations/20260822231000_spec14_esquecimento.sql:69-88 —
  deletes explícitos; tests/db/tentativas-trava.test.ts:30-214,238-294 —
  rejects.toThrow(/UPDATE proibido|TRUNCATE proibido|rotina de esquecimento/) e
  expect(comandos).toEqual(["INSERT", "SELECT"]).
- Retenção/tokens: tests/db/spec14-esquecimento.test.ts:179-209 —
  expect(financeiro[0]).toMatchObject({ user_id: null, matricula_id: null, asaas_cliente_id: null }),
  expect(retidos[0]).toEqual({ fatura: "1", aceite: "1", evento: "1" }) e expect(tokens[0].n).toBe("0").
- Retry/idempotência: tests/db/spec14-esquecimento.test.ts:231-261 —
  expect(antesDoEmail[0]).toEqual({ estado: "dados_apagados", ultima_falha_codigo: null }),
  expect(email[0].estado).toBe("email_enviado"), finalização false/true e fila toHaveLength(0).
- Inventário fechado: tests/db/grupo-1.test.ts:20-58 —
  expect(noBanco.filter(...)).toEqual([]) e expect(rows.map(...).sort()).toEqual([...TABELAS_GRUPO_1].sort()).
- Cobertura: tests/db/spec14-esquecimento.test.ts:160-300 — 21 ocorrências de expect em 4 testes.
- Gate: npm run test:db exit 0, 46 arquivos e 364 testes, zero skips.

#### T3 — tasks.md:159-169

- Job único, ativo, RPC e ordem: tests/db/spec14-cron.test.ts:24-37 —
  expect(encontrado).toBeDefined(), toMatchObject({ schedule: "0 7 * * *", active: true }),
  toMatch(/public\.recalcula_sequencia\(\)/) e toBeGreaterThan(...).
- Lock, fuso e janela até ontem: tests/db/spec14-cron.test.ts:39-54 —
  expect(rows).toHaveLength(1), toMatch(/pg_try_advisory_xact_lock/),
  toMatch(/Sao_Paulo/) e toMatch(/- 1/).
- Repetição não cria segundo job: tests/db/spec14-cron.test.ts:56-63 —
  expect(rows[0].n).toBe("1").
- Cobertura: tests/db/spec14-cron.test.ts:24-63 — 9 ocorrências de expect em 3 testes.
- Gate: npm run test:db exit 0, 46 arquivos e 364 testes, zero skips.

#### T4 — tasks.md:194-201

- Causa/UUID/allowlist: src/modules/aluno/progresso.test.ts:48-64 —
  expect(...).toEqual({ causa: "errei_a_conta", topicoId: UUID_A }),
  expect(...).toEqual({ causa: null, topicoId: UUID_B }) e toHaveLength(8).
- Filtros combinados sem log cru: src/modules/aluno/progresso.test.ts:105-126 —
  expect(resultado.caderno[0].nErros).toBe(3), expect(falso.chamadas).not.toContain("tentativas")
  e dois toHaveBeenCalledWith em caderno_erros.
- Vazio/solo: src/modules/aluno/progresso.test.ts:138-146 e
  src/app/app/progresso/page.test.tsx:81-84 —
  toMatchObject({ historico: [], caderno: [], sequencia: null, estadoInicial: true }) e cinco
  expect(texto).not.toContain(palavra).
- DTO/RLS/erro: tests/db/projecoes-schema.test.ts:302-335 —
  expect(rows.map(...)).toEqual([aluno]), rejects de INSERT e expect(rows).toHaveLength(4)/
  expect(rows.every(...)).toBe(true); page.test.tsx:112-122 — mensagem técnica ausente e reporte.
- Cobertura: src/modules/aluno/progresso.test.ts:48-205 — 17 ocorrências de expect em 9 testes.
- Gate: npm run test:unit exit 0, 97 arquivos e 665 testes, zero skips.

#### T5 — tasks.md:229-236

- Guarda: src/app/app/progresso/page.test.tsx:67-76,125-131 —
  expect(dependencias.matricula).toHaveBeenCalledTimes(1),
  toHaveBeenCalledWith(...dois filtros...) e not.toHaveBeenCalled para flag/cliente quando a matrícula falha.
- Estados: src/modules/aluno/progresso-tela.test.tsx:37-68 e
  src/app/app/progresso/page.test.tsx:87-122 —
  contém "Nenhum erro encontrado com esses filtros", "Seu ponto de partida",
  "Seu caderno ainda está vazio", "Algo deu errado" e not.toContain("detalhe interno").
- Filtros/solo: src/app/app/progresso/page.test.tsx:67-84 —
  consultarProgresso recebe causa e tópico e loop not.toContain cobre ranking, liga, placar,
  percentil e posição; src/modules/aluno/progresso-tela.tsx:137-168 mostra os dois campos no mesmo form.
- Server render/responsividade: src/app/app/progresso/page.tsx:15,44-75 —
  force-dynamic, consulta server-side e render de ProgressoTela; src/modules/aluno/progresso-tela.tsx:137-168
  usa classes responsivas sm:. A validação visual de largura real permanece manual.
- Cobertura: src/app/app/progresso/page.test.tsx:67-131 tem 19 expect e
  src/modules/aluno/progresso-tela.test.tsx:27-88 tem 12 expect.
- Gate: npm run test:unit exit 0, 97 arquivos e 665 testes, zero skips.

#### T6 — tasks.md:266-277

- Barreira: src/modules/lgpd/email.ts:1 declara import "server-only"; src/modules/lgpd/email.test.ts:13-16 —
  expect(fonte).toContain('import "server-only";'); node_modules/server-only/index.js:1-4 lança erro
  ao ser importado fora de Server Component; vitest.config.mts:9-15 limita o shim ao projeto unit.
- Payload mínimo/segredo: src/modules/lgpd/email.test.ts:46-71 —
  expect(resultado).toEqual({ enviado: true }), endpoint fixo, autorização e objeto from/to/subject/text;
  expect(JSON.stringify(corpo)).not.toContain("re_teste_nao_real").
- Falhas fechadas: src/modules/lgpd/email.test.ts:18-44,88-120 —
  configuração ausente sem chamar fetch, destinatário inválido, não-2xx, timeout e CRLF retornam
  motivos controlados; expect(JSON.stringify(resultado)).not.toContain("segredo do provedor").
- Cobertura: src/modules/lgpd/email.test.ts:12-129 — 18 ocorrências de expect em 9 testes.
- Gate: npm run test:unit exit 0 e npm run build exit 0.

#### T7 — tasks.md:302-314

- Confirmação e identidade: src/app/app/conta/acoes.ts:10-36 e
  src/app/app/conta/acoes.test.ts:41-60 —
  redirect de confirmação antes de clienteDaSessao e expect(executar).toHaveBeenCalledWith({ id: "aluno-real", email: ... })
  junto de not.toHaveBeenCalledWith(id do formulário).
- Ordem/falha de e-mail: src/modules/lgpd/esquecimento.ts:97-140 e
  src/modules/lgpd/esquecimento.test.ts:23-50 —
  expect(ordem).toEqual(["apagar", "enviar", "email_registrado", "auth", "finalizar"]) e
  expect(excluirAuth).not.toHaveBeenCalled() quando o e-mail falha.
- Retry/estado recuperável: tests/db/spec14-esquecimento.test.ts:231-261 e
  src/modules/lgpd/esquecimento.test.ts:52-86 —
  estado dados_apagados, email_enviado, finalização false antes de Auth, true depois e
  rejects.toMatchObject({ motivo: "fila_indisponivel" }).
- Tela: src/app/app/conta/page.test.tsx:31-50 —
  contém "Será apagado", "Faturas, aceite", "APAGAR", input e mensagem segura sem stack.
- Cobertura: acoes.test.ts:41-83 tem 9 expect e page.test.tsx:31-50 tem 10 expect; juntas superam
  a cobertura declarada para autorização, conteúdo, ordem e falhas.
- Gate: npm run test:unit exit 0, 97 arquivos e 665 testes, zero skips.

#### T8 — tasks.md:340-353

- Versão e links públicos: src/app/paginas-publicas.test.tsx:10-25 —
  expect(termos/privacidade).toContain("Versão " + VERSAO_ATUAL_DOS_TERMOS), links recíprocos,
  Resend, faturas e canal.
- Venda e checkout apontam os documentos: src/app/page.test.tsx:27-37 e
  src/app/checkout/page.test.tsx:26-33 —
  href /termos e /privacidade e ordem dos documentos antes do checkout; campos contratuais
  maiorDeIdade/aceitouTermos são distintos de consentimento de marketing em
  src/app/checkout/formulario.tsx:15-23.
- Política: src/app/privacidade/page.tsx:35-73 e src/app/paginas-publicas.test.tsx:18-25 —
  Resend, faturas, apagamento operacional, canal provisório e revisão jurídica visíveis.
- Checklist honesto: docs/GO-LIVE-SPEC14.md:3-7,9-104 —
  itens de migration, testes, flags, terceiros, jurídico e evidência permanecem [ ] e o texto
  diz explicitamente que o merge não executa produção.
- Cobertura: src/app/paginas-publicas.test.tsx:10-25 — 12 ocorrências de expect.
- Gate: npm run lint e npm run build exit 0.

#### T9 — tasks.md:372-395

- Última data, não maior histórico: supabase/migrations/20260823093000_spec14_sequencia_ultima_data.sql:47-53
  usa order by s.data desc limit 1; tests/db/spec14-sequencia.test.ts:266-295 insere sequência antiga 9,
  histórico recente pendente 0 e exige expect(rows).toEqual([{ sequencia: 1, estado: "cumprido" }]).
- Zero explícito: supabase/migrations/20260823094000_spec14_sequencia_estado_inicial.sql:46-54
  usa coalesce(..., 0); tests/db/spec14-sequencia.test.ts:199-210 exige expect(rows[0].sequencia).toBe(0),
  expect(rows[0].tem_historico).toBe(false) e expect(projeção[0].n).toBe("0").
- Cinco dias, sábado e quebra: tests/db/spec14-sequencia.test.ts:214-264 exige
  expect(rows).toEqual([... sequencias 1..5, sábado fora_agenda 5]); :266-295 exige a quebra
  histórica seguida de dia cumprido.
- Gate: npm run test:db exit 0 com migration aplicada no Supabase de desenvolvimento.

#### T10 — tasks.md:400-418

- Fixture representativa: tests/db/spec14-esquecimento.test.ts:67-103 cria duas tentativas explícitas
  mais loop de 28; :166-170, antes do apagamento, executa expect(tentativasAntes[0].n).toBe("30").
- Inventário zero com fila aberta: tests/db/spec14-esquecimento.test.ts:211-219 —
  expect(group1.filter(...).every(...)).toBe(true) e expect(...solicitacoes...).toBe("1").
- Zero após Auth/finalização: tests/db/spec14-esquecimento.test.ts:221-227 —
  expect(finalizar_esquecimento).toBe(true) e expect(depoisDaFinalizacao.every(...)).toBe(true).
- Financeiro retido: tests/db/spec14-esquecimento.test.ts:196-209 —
  expect(retidos[0]).toEqual({ fatura: "1", aceite: "1", evento: "1" }) e token 0.
- Gate: npm run test:db exit 0.

#### T11 — tasks.md:422-438

- Três causas: src/modules/aluno/progresso-tela.test.tsx:70-87 —
  expect(html).toContain("Errei a conta"), "Chutei" e "Faltou tempo".
- Vocabulário solo: src/modules/aluno/progresso-tela.test.tsx:47-51 e
  src/app/app/progresso/page.test.tsx:81-84 —
  expect(texto).not.toContain(palavra) para ranking, liga, placar, percentil e posição.
- Gate: npm run test:unit exit 0.

#### T12 — tasks.md:442-469

- Pacote real: package.json:23-37 e package-lock.json:9349-9355 registram server-only como dependency;
  node_modules/server-only/index.js:1-4 lança a barreira; vitest.config.mts:9-15 usa shim somente no
  projeto unit.
- Teste da barreira e cenários antigos: src/modules/lgpd/email.test.ts:13-16,46-129 —
  expect da declaração, payload mínimo, ausência de segredo e falha fechada.
- Nome da configuração alinhado: design.md:95-101 usa RESEND_FROM; src/modules/lgpd/email.ts:59-60,
  docs/SEGREDOS.md:26-27 e .env.example:135-141 usam o mesmo nome.
- Gate: npm run test:unit e npm run build exit 0.

## Spec-Anchored Acceptance Criteria

| Critério | Resultado esperado definido pela spec | Evidência file:line + expressão de asserção | Resultado |
| --- | --- | --- | --- |
| Progresso AC1 — abrir progresso lê projeções e mostra estado inicial explícito | Histórico vem de projeções, não do log cru; sem respostas, estado inicial explícito | src/modules/aluno/progresso.ts:159-174 consulta dominio_topico/caderno_erros/RPC e não tentativas; src/modules/aluno/progresso.test.ts:110-126 — expect(falso.chamadas).not.toContain("tentativas"); :138-146 — toMatchObject({ historico: [], caderno: [], sequencia: null, estadoInicial: true }); src/modules/aluno/progresso-tela.test.tsx:54-68 — contém "Seu ponto de partida" e "Seu caderno ainda está vazio" | PASS |
| Progresso AC2 — causa e tópico juntos | Os dois filtros chegam juntos ao caderno | src/modules/aluno/progresso.ts:164-168 — dois eq condicionais no mesmo cadernoBuilder; src/modules/aluno/progresso.test.ts:121-126 — toHaveBeenCalledWith("causa_erro", "errei_a_conta") e toHaveBeenCalledWith("topico_id", UUID_A); src/app/app/progresso/page.test.tsx:67-80 — action recebe { causa, topico } e HTML contém os dois selects | PASS |
| Progresso AC3 — somente próprio aluno e sem comparação | RLS/identidade própria; nenhuma tela exibe ranking, liga, placar ou percentil | tests/db/projecoes-schema.test.ts:302-321 — expect(rows.map(...)).toEqual([aluno]) e INSERT rejeitado; src/app/app/progresso/page.test.tsx:81-84 e src/modules/aluno/progresso-tela.test.tsx:47-51 — cinco not.toContain; src/modules/aluno/progresso-tela.tsx:217-223 — copy explicita caminho próprio | PASS |
| Sequência AC1 — piso cumprido mantém/incrementa | Cumprir o piso mantém ou incrementa | tests/db/spec14-sequencia.test.ts:224-255 — expect(rows).toEqual com sequências 1,2,3,4,5; :282-295 — expect(rows).toEqual([{ sequencia: 1, estado: "cumprido" }]); SQL final em supabase/migrations/20260823094000_spec14_sequencia_estado_inicial.sql:110-118 | PASS |
| Sequência AC2 — fora da agenda/folga não interrompe | Estado fora da agenda/folga carrega sequência anterior | tests/db/spec14-sequencia.test.ts:114-127 — toMatchObject({ estado: "fora_agenda", sequencia: 1 }); :176-181 — toEqual([["cumprido",1],["folga",1],["piso_pendente",0]]) e folga true; SQL:102-114 trata os estados | PASS |
| Sequência AC3 — abertura usa plano/sessões sem esperar job | RPC calcula o dia atual com o plano/sessões do titular; job fecha somente até ontem | supabase/migrations/20260823094000_spec14_sequencia_estado_inicial.sql:76-98,102-118; tests/db/spec14-sequencia.test.ts:257-262 — expect(hojeConsultado[0].sequencia).toBe(5); tests/db/spec14-cron.test.ts:39-54 — toMatch(/pg_try_advisory_xact_lock/), /Sao_Paulo/ e /- 1/ | PASS |
| DADOS-04 AC1 — apagar grupo 1 pela porta e reter faturas | Apaga dado operacional incluindo projeções/log/partições pela porta nomeada; preserva faturas fiscais | supabase/migrations/20260822231000_spec14_esquecimento.sql:49-51,69-110; tests/db/spec14-esquecimento.test.ts:166-177 — expect count 30 e estado dados_apagados; :179-209 — identidade financeira nula/mascarada, fatura/aceite/evento 1 e token 0; :211-227 — inventário zero antes e depois; tests/db/grupo-1.test.ts:20-58 — inventário sem órfãos | PASS |
| DADOS-04 AC2 — retry após falha parcial converge | Mesmo estado final sem duplicar efeitos | tests/db/spec14-esquecimento.test.ts:231-261 — retry limpa ultima_falha, marca email, finalização false antes de Auth, true depois, fila length 0 e segunda finalização true; SQL:46-67 usa lock/on conflict | PASS |
| DADOS-04 AC3 — confirmação antes de Auth e falha visível | E-mail precede Auth; provedor ausente/erro não conclui silenciosamente | src/modules/lgpd/esquecimento.ts:97-143; src/modules/lgpd/esquecimento.test.ts:23-50 — ordem exata e Auth não chamado em falha; src/modules/lgpd/email.test.ts:18-30,88-110 — configuração ausente, não-2xx e timeout controlados sem mensagem externa; src/app/app/conta/acoes.test.ts:72-83 — redirect de erro/reportar | PASS |
| DADOS-01 AC4 — documentos públicos e núcleo sem consentimento | Política/termos PT-BR, versionados, ligados da venda/checkout; checkbox geral não é porteiro do núcleo | src/app/paginas-publicas.test.tsx:10-25 — versões, links, Resend, faturas e revisão; src/app/page.test.tsx:27-37 — links da venda antes do checkout; src/app/checkout/page.test.tsx:26-33 — links no checkout e apenas campos contratuais; src/app/privacidade/page.tsx:56-73 — texto explícito de não depender de checkbox de consentimento e marketing separado | PASS documental; revisão jurídica manual |

Não há spec-precision gap bloqueante: os critérios definem estados e relações observáveis suficientes
para asserções acima. A redação de cópia visual não é fixada pela spec; as asserções usam o estado
de domínio e marcadores de conteúdo que a própria spec exige.

## Success Criteria

| Critério de sucesso | Evidência | Resultado |
| --- | --- | --- |
| Três causas diferentes | src/modules/aluno/progresso-tela.test.tsx:70-87 — três toContain de labels | PASS |
| Filtros juntos | src/modules/aluno/progresso.test.ts:121-126 — dois toHaveBeenCalledWith no caderno | PASS |
| Aluno novo | src/modules/aluno/progresso.test.ts:138-146 e src/modules/aluno/progresso-tela.test.tsx:54-68 — estadoInicial true e copy inicial | PASS |
| Cinco dias/fim de semana | tests/db/spec14-sequencia.test.ts:214-264 — sequências 1..5 e sábado fora_agenda 5 | PASS |
| Nenhuma posição relativa | src/app/app/progresso/page.test.tsx:81-84 e src/modules/aluno/progresso-tela.test.tsx:47-51 — vocabulário recusado | PASS |
| 30 tentativas e zero por inventário | tests/db/spec14-esquecimento.test.ts:166-170,211-227 — count 30 antes e zero aberto/finalizado | PASS |
| Fatura/retry | tests/db/spec14-esquecimento.test.ts:196-209,231-261 — fatura/aceite/evento retidos e retry convergente | PASS |
| Loop central | spec.md:156 está desmarcado; fica fora da prova automatizada desta spec | Limitação manual |
| Checklist de go-live | spec.md:157 e docs/GO-LIVE-SPEC14.md:9-104 permanecem desmarcados por desenho | Limitação manual |

## Edge cases

- Progresso: causa desconhecida/UUID inválido, array repetido, tópico ausente, score NaN,
  projeção vazia e RPC indisponível em src/modules/aluno/progresso.test.ts:55-64,128-205.
- Progresso solo: filtro sem resultado, estado inicial e cinco palavras proibidas em
  src/modules/aluno/progresso-tela.test.tsx:37-68 e src/app/app/progresso/page.test.tsx:81-84.
- Sequência: zero inicial, última data, valor histórico antigo, pending seguido de cumprimento,
  cinco dias, sábado, folga, RLS, idempotência e consulta sem gravação em
  tests/db/spec14-sequencia.test.ts:72-321.
- Apagamento: 30 tentativas, todo inventário, fila aberta, Auth antes da finalização, retry,
  porta/RLS, fatura/aceite/evento retidos e token removido em
  tests/db/spec14-esquecimento.test.ts:160-300.
- INSERT-only: UPDATE/TRUNCATE/DELETE sem porta, partição e RLS em
  tests/db/tentativas-trava.test.ts:30-294.
- E-mail: ausência de configuração, destinatário inválido/CRLF, payload mínimo, segredo fora do
  corpo, não-2xx, timeout, remetente inválido e 204 em src/modules/lgpd/email.test.ts:12-129.
- Flags: catálogo usa caderno true e diagnóstico/simulado/Raio-X/analytics logado false em
  src/modules/config/catalogo.ts:233-260,374-379; valores efetivos de produção são manuais.

## Discrimination Sensor

Sensor executado em scratch temporário fora do repositório, criado a partir de HEAD, com
node_modules referenciado por junction. Baseline do scratch: 7 arquivos e 39 testes unitários
passando. Cada mutação foi revertida no scratch antes da próxima; o scratch foi removido ao final.

| Mutação | File:line | Comportamento injetado | Asserção que matou | Resultado |
| --- | --- | --- | --- | --- |
| 1 | src/modules/aluno/progresso.ts:168 | Desabilitar o eq de topico_id do caderno | src/modules/aluno/progresso.test.ts:121-126 — toHaveBeenCalledWith("topico_id", UUID_A) | KILLED |
| 2 | src/app/app/conta/acoes.ts:11 | Trocar confirmação APAGAR por NUNCA | src/app/app/conta/acoes.test.ts:51-60 — id real e redirect de sucesso | KILLED |
| 3 | src/modules/lgpd/email.ts:89 | Inverter a condição de resposta não-2xx | src/modules/lgpd/email.test.ts:61-70,88-95,122-129 — sucesso, indisponível e 204 | KILLED |
| 4 | src/modules/lgpd/esquecimento.ts:110 | Trocar apagamento inicial por registro de e-mail | src/modules/lgpd/esquecimento.test.ts:23-34,36-50,52-64,75-86 — ordem e falhas | KILLED |
| 5 | src/modules/lgpd/esquecimento.ts:138 | Inverter guarda de finalização | src/modules/lgpd/esquecimento.test.ts:23-34,75-86 — concluído e fila aberta | KILLED |
| 6 | src/modules/lgpd/email.ts:1 | Remover import server-only | src/modules/lgpd/email.test.ts:13-16 — toContain('import "server-only";') | KILLED |
| 7 | src/app/app/conta/page.tsx:73 | Remover a indicação explícita de Faturas, aceite | src/app/app/conta/page.test.tsx:31-39 — toContain("Faturas, aceite") | KILLED |
| 8 | src/app/app/conta/acoes.ts:36 | Usar user_id do formulário em vez da sessão | src/app/app/conta/acoes.test.ts:48-60 — id real e not.toHaveBeenCalledWith(id do form) | KILLED |
| 9 | src/modules/aluno/progresso-tela.tsx:219 | Inserir ranking no cabeçalho | src/modules/aluno/progresso-tela.test.tsx:47-51 e src/app/app/progresso/page.test.tsx:81-84 — not.toContain("ranking") | KILLED |
| 10 | src/modules/aluno/progresso-tela.tsx:14 | Trocar o vocabulário Chutei | src/modules/aluno/progresso-tela.test.tsx:70-87 — toContain das três causas | KILLED |

Resultado: 10 mutações injetadas, 10 killed, 0 survived. A mutação SQL/migration não foi
executada contra o Supabase compartilhado; o comportamento SQL não mutado foi coberto pelo gate
DB aprovado. Nenhum mutante sobreviveu e nenhuma correção foi feita.

## Gates

| Gate | Resultado exato | Observação |
| --- | --- | --- |
| npm run test:unit | exit 0; 97 Test Files passed; 665 Tests passed; 0 skipped | 9,23 s; inclui o novo teste da barreira server-only |
| npm run test:db | exit 0; 46 Test Files passed; 364 Tests passed; 0 skipped | Supabase de desenvolvimento; 1 conexão física; 111,17 s; execução aprovada com rede |
| npm run lint | exit 0; 304 problems; 0 errors; 304 warnings | Warnings apenas nos diretórios auxiliares não versionados .claude/.github; não tocados |
| npm run build | exit 0; TypeScript passou; static pages 14/14 | Next 16.3.1/Turbopack; rotas geradas sem erro |

O primeiro npm run test:db no sandbox foi interrompido após falhar em massa com o bloqueio de rede
connect EACCES 15.229.150.166:5432: 45 arquivos falhos/1 passante e 359 testes falhos/5
passantes. Não foi tratado como resultado do produto. A única repetição foi a execução aprovada
fora do sandbox, que passou com os números finais acima.

## Test integrity and diff hygiene

- main tinha 133 arquivos de teste e 963 declarações it/test; HEAD tem 143 arquivos e 1015
  declarações: delta +10 arquivos e +52 declarações, sem redução de cobertura.
- git diff --stat main...HEAD: 39 arquivos, 4333 inserções e 26 deleções.
- git diff --check main...HEAD: warnings de whitespace apenas em documentos e blank EOF em arquivos
  novos; nenhum erro de compilação/lint.
- Nenhum scope creep funcional foi observado: o diff fica concentrado em progresso, sequência,
  apagamento, transporte Resend, documentos e remediações T9–T12.

## Validators

- validate_spec.py .specs/features/14-progresso-lgpd-minima-e-go-live: 0 errors, 0 warnings.
- validate_tasks.py .specs/features/14-progresso-lgpd-minima-e-go-live: 0 errors, 0 warnings.
- ASVS selector OWASP ASVS 5.0.0, nível 2, dimensões authentication, authorization, data_protection,
  validation_business_logic, external_integration e logging_error_handling: 98 required candidates,
  20 advisory, 0 warnings; hash da fonte 8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311.
  Isto é verificação escopada, não certificação ASVS.
- validate_state.py executado depois desta escrita: exit 0; validate_state reportou 0 error(s).

## Quality and security review

- Invariante INSERT-only: tests/db/tentativas-trava.test.ts:30-214,238-294 cobre UPDATE,
  DELETE seletivo, TRUNCATE, partição, RLS e porta nomeada.
- Identidade derivada: supabase/migrations/20260823094000_spec14_sequencia_estado_inicial.sql:21-22
  usa auth.uid(); src/app/app/conta/acoes.ts:26-36 usa user.id da sessão e ignora user_id do form;
  tests correspondentes falham sob as mutações 2 e 8.
- RLS/isolamento: tests/db/projecoes-schema.test.ts:302-335 e
  tests/db/tentativas-trava.test.ts:238-294 confirmam leitura própria, ausência de escrita indevida
  e ausência de policy UPDATE/DELETE.
- Retenção financeira: supabase/migrations/20260822231000_spec14_esquecimento.sql:90-110 mascara
  identidade, remove capability/token e preserva o mínimo fiscal; tests/db/spec14-esquecimento.test.ts:179-209
  afirma os valores.
- Sequência: cálculo é projection/RPC server-side, sem user_id no navegador; abertura usa a última
  data e zero explícito; o job usa lock e janela até ontem.
- Resend: src/modules/lgpd/email.ts:54-95 fixa HTTPS, payload mínimo, timeout, CRLF validation e
  fail-closed; nenhum valor de segredo foi incluído neste relatório.
- server-only: pacote real em dependency, barreira real no adaptador, shim restrito ao projeto unit
  e build final verde.
- Flags/go-live: defaults e superfícies estão no catálogo; checklist permanece manual e desmarcado,
  sem afirmar que produção ou terceiros foram configurados.
- Snapshot congelado, proveniência e Raio-X de questões não foram ampliados pela feature; gates
  completos passaram, mas sua verificação específica continua pertencendo às specs anteriores.

## Limitações manuais

- Produção: migrations, alvo Supabase, cron concorrente, backups e apagamento controlado em produção
  não foram verificados.
- Resend: domínio/remetente verificado, credencial real, entrega, bounce e acompanhamento operacional
  não foram verificados.
- Asaas: CNPJ, conta, contrato, configuração fiscal e fluxo financeiro real não foram verificados.
- PDFs: 3–4 PDFs oficiais para o primeiro acervo não foram verificados.
- Vercel: conta, domínio HTTPS, região, Redirect URLs, variáveis e deploy não foram verificados.
- PostHog: free tier, região EUA, configuração e instrumento jurídico da transferência internacional
  não foram verificados.
- Jurídico: identidade/CNPJ/DPO, bases legais, texto final, retenção, transferência internacional
  e revisão da política/termos permanecem pendentes.
- UAT visual: responsividade real, fluxo autenticado, compra, matrícula, e-mail real e telas reais
  não foram validados visualmente.
- Loop central e checklist de go-live continuam explicitamente desmarcados na spec/docs por serem
  conferências manuais de lançamento.

## Repository integrity

Status real antes e depois do sensor:

    ?? .claude/skills/
    ?? .github/agents/
    ?? .github/hooks/
    ?? .github/skills/
    ?? .specs/features/14-progresso-lgpd-minima-e-go-live/validation.md

HEAD permaneceu 44e73dc7bf755b5b14a9e1d3d3c3b835dade8f51. O scratch foi removido
(exists_after=False). Nenhum diretório .claude/.github foi tocado. Nenhum commit, push ou stash.
O único artefato permitido escrito/substituído foi este validation.md.

## Summary

**Overall**: PASS — pronto do ponto de vista técnico/evidência automatizada; não equivale a go-live
em produção.

**Spec-anchored check**: 10/10 ACs cobertos, 0 spec-precision gaps bloqueantes.
**Task completion**: T1–T12 PASS independente.
**Sensor**: 10/10 mutações killed, 0 survived.
**Gates**: unit 665/665, db 364/364, lint 0 erros, build 14/14 páginas.

**Próximo passo seguro**: executar manualmente o checklist de produção/terceiros/jurídico/UAT antes
de ligar a oferta comercial; não há correção de implementação a aplicar nesta rodada.
