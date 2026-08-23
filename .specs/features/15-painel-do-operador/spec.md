# SPEC 15 — Painel do operador

| | |
| --- | --- |
| **Ordem** | 15 de 36 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 10, SPEC 07 |
| **Habilita** | SPEC 27, 29 (as telas de curadoria delas herdam este painel) |
| **Tasks (estimativa)** | ~10 |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Média |
| **Status** | 🟠 Em implementação — pausa após T120 |
| **Requisitos** | **BANCO-10**, **BANCO-07** (superfície), **INFRA-11** (tela de administração da configuração) |
| **Fonte dos requisitos** | `.specs/modulos/m1-banco-questoes/spec.md` · `.specs/modulos/m9-infra/spec.md` |

## Problem Statement

A SPEC 10 criou a fila de revisão e a porta de publicação; hoje só dá para operá-las por SQL. O
acervo é o fosso e depende de um humano decidindo rápido — a fila precisa de tela. E a configuração
da SPEC 02 tem escrita com autor obrigatório e nenhuma forma de usá-la sem escrever INSERT à mão.

## Goals

- [ ] Operador revisa a fila de questões em lote: aprovar, rejeitar, corrigir gerando versão nova.
- [ ] Taxonomia editável, com aprovação de candidato a tópico novo.
- [ ] Configuração e feature flags trocáveis pela tela, com histórico visível por chave.
- [ ] Toda ação registra quem, quando e por quê.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-07 (superfície) | tela da fila, decisão registrada em `questao_revisoes`, correção vira versão nova | m1 §P1: QA misto |
| BANCO-10 | tela de curadoria da taxonomia; aprovar candidato cria o tópico canônico; mudança vale para classificação futura sem deslocar histórico | m1 §P3: Tela de curadoria |
| INFRA-11 (superfície) | tela de configuração: valor vigente, histórico da chave, `motivo` obrigatório | m9 §P1: Configuração (AC7) |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Regras de QA, piso de confiança, amostra | SPEC 10 (aqui é só a tela) |
| Curadoria de atualidade do Raio-X | SPEC 27 |
| Revisão em lote das questões suspeitas do flywheel | SPEC 29 |
| Trilha de auditoria da LGPD | SPEC 16 (esta tela **vira consumidora** dela depois) |

## Assumptions & Open Questions

| Assumption | Default | Rationale | Confirmado? |
| --- | --- | --- | --- |
| Quem opera | papel único de operador de conteúdo (time de 3) | O recorte não precisa de hierarquia entre três pessoas. | y |
| Autorização | allowlist `operadores` ligada a `auth.users`, conferida no servidor em toda leitura e mutação | Revogação é imediata e não depende de renovar token nem de deploy. | y (2026-08-23) |
| Chave sensível na tela | a tela é de operador autenticado; o navegador não consulta tabelas internas nem recebe a chave de serviço | Preserva a fronteira server-only da AD-081. | y (AD-081) |
| Lote | no máximo 50 itens e transação atômica | Evita abuso e impede meia decisão quando uma questão falha. | y (2026-08-23) |
| Correção | cria versão `em_revisao`; a versão anterior congela e sai de vigência | Falha fechada: conteúdo conhecido como incorreto não continua sendo servido. | y (2026-08-23) |

**Open questions:** none — as decisões de implementação foram aprovadas em 2026-08-23.

## User Stories

### P1: Curar o acervo

Como operador de conteúdo, quero decidir a fila, corrigir questões e manter a taxonomia para publicar
conteúdo conferido sem operar o banco por SQL. Os critérios de aceite permanecem em **BANCO-07** e
**BANCO-10**; esta spec não os copia.

### P1: Administrar configuração

Como operador de conteúdo, quero trocar valor ou flag e consultar o histórico para operar o produto
sem deploy e com autoria explícita. Os critérios de aceite permanecem em **INFRA-11**.

## Security Criteria — ASVS v5.0.0 L2

| Local ID | ASVS reference | Decisão para esta superfície | Verificação |
| --- | --- | --- | --- |
| SEC-01 | v5.0.0-8.2.1, v5.0.0-8.3.1 | Página e Server Action exigem operador ativo em guarda server-side; dado do formulário não concede acesso. | Teste de guarda e de chamada direta sem papel. |
| SEC-02 | v5.0.0-15.3.3 | Cada mutação aceita uma lista fechada de campos; autor e estado de destino são derivados no servidor/banco. | Testes de campo extra, autor forjado e transição inválida. |
| SEC-03 | v5.0.0-15.3.1 | A tela recebe somente os campos necessários; tabelas internas continuam sem acesso de `anon`/`authenticated`. | Teste do DTO e dos privilégios/RLS. |
| SEC-04 | v5.0.0-16.2.1 | Toda mutação registra quando, quem, o quê e motivo não vazio, com horário do banco. | Testes das funções atômicas e do histórico. |
| SEC-05 | v5.0.0-16.3.2 | Tentativa de acesso sem papel é negada e reportada sem conteúdo ou segredo. | Teste do reporte de autorização negada. |
| SEC-06 | v5.0.0-16.5.1, v5.0.0-16.5.3 | Falha inesperada não mostra consulta, stack ou chave e não deixa mudança parcial. | Testes de mensagem genérica e rollback. |

## Requirement Traceability

| Requirement ID | Fonte | Superfície nesta spec | Status |
| --- | --- | --- | --- |
| BANCO-07 | M1 §P1 | fila, lote, publicação e versão corrigida | Implementing |
| BANCO-10 | M1 §P3 | taxonomia e candidato | Implementing |
| INFRA-11 | M9 §P1 | valor vigente, escrita e histórico | Implementing |
| SEC-01 | ASVS v5.0.0 L2 | autorização explícita | Implementing |
| SEC-02 | ASVS v5.0.0 L2 | lista fechada de campos | Implementing |
| SEC-03 | ASVS v5.0.0 L2 | retorno mínimo de dados | Implementing |
| SEC-04 | ASVS v5.0.0 L2 | autoria e motivo | Implementing |
| SEC-05 | ASVS v5.0.0 L2 | negativa de acesso reportada | In Tasks |
| SEC-06 | ASVS v5.0.0 L2 | falha fechada e genérica | Implementing |

## Success Criteria

- [ ] Aprovar uma questão da fila a publica e registra a decisão
- [ ] Corrigir uma questão publicada gera versão nova, não reescreve a anterior
- [ ] Aprovar candidato a tópico cria o tópico e não desloca nenhum histórico
- [ ] Trocar uma flag pela tela vale sem deploy e aparece no histórico com autor e motivo
