# Validação da SPEC 13 — PASS técnico

Resultado: **PASS**. Verificação independente após a execução das oito tasks,
com releitura da `spec.md`, inspeção do diff final e sensor de discriminação em
worktree descartável. Nenhum mutante sobreviveu.

Data: 2026-08-22  
Escopo: onboarding, plano do dia, sessão retomável, resposta, causa do erro,
explicação por questão-versão, proveniência, imagens assinadas e superfície
responsiva.  
Ritual: B.  
Verificador: fallback standalone do agente, sem subagent separado disponível;
limitação de processo registrada, não uma lacuna funcional encontrada.

## Critérios ancorados na spec

| Critério | Evidência | Resultado |
| --- | --- | --- |
| Matrícula válida mostra onboarding com meta, ritmo, agenda e nível | `src/app/app/page.test.tsx:76` e `src/app/app/acoes.test.ts:57` | ✅ PASS |
| Diagnóstico é pulável e o plano não depende da frase da IA | `src/app/app/page.test.tsx:106`; `src/modules/aluno/onboarding.ts:90` | ✅ PASS |
| Plano separa piso/meta cheia, tempo, tipo e motivo | `src/app/app/page.test.tsx:91`; `src/modules/aluno/plano.ts:72` | ✅ PASS |
| Sessão só aceita questão publicada, vigente e não anulada; tópico e repetição são respeitados | `src/modules/aluno/sessao.test.ts:118`; `src/modules/aluno/sessao.ts:169` | ✅ PASS |
| Sessão aberta é retomada e a concorrência é protegida | `src/modules/aluno/sessao.test.ts:175`; `supabase/migrations/20260822223000_spec13_uma_sessao_aberta.sql:8` | ✅ PASS |
| Proveniência e imagem assinada chegam sem gabarito antes da resposta | `src/modules/aluno/sessao.test.ts:149`; `src/modules/aluno/sessao.ts:357`; `src/modules/aluno/sessao.ts:599` | ✅ PASS |
| Resposta deriva usuário/contexto, preserva tempo/chute e deduplica | `src/app/app/sessao/acoes.test.ts:150`; `src/app/app/sessao/acoes.test.ts:201`; `src/app/app/sessao/acoes.ts:132` | ✅ PASS |
| Erro no treino exige causa, incluindo `nao_sei_dizer` | `src/app/app/sessao/acoes.test.ts:180`; `src/app/app/sessao/acoes.ts:173` | ✅ PASS |
| Explicação aprovada é lida pela mesma versão; divergente ou ausente vira revisão | `supabase/migrations/20260822220000_spec13_onboarding_e_sessao.sql:62`; `src/app/app/sessao/acoes.test.ts:231`; `src/app/app/sessao/acoes.test.ts:240` | ✅ PASS |
| Rota e tela preservam conclusão, erro, fonte, alternativas e revisão | `src/app/app/sessao/[id]/page.test.tsx:66`; `src/modules/aluno/sessao/tela.test.tsx:56`; `src/modules/aluno/sessao/tela.test.tsx:92` | ✅ PASS |

## Casos de borda

- Acervo vazio: estado seguro e retorno ao plano (`src/modules/aluno/sessao.test.ts:198`, `src/app/app/sessao/[id]/page.test.tsx:93`).
- Questão anulada, versão antiga e questão recente de treino: filtros de domínio (`src/modules/aluno/sessao.test.ts:118`).
- Saída no meio: a leitura consulta somente `respondido_em is null`; a tentativa já gravada não é desfeita (`src/modules/aluno/sessao.ts:378`, `src/app/app/sessao/acoes.ts:274`).
- Duplo clique e abertura concorrente: RPC idempotente + índice parcial (`src/app/app/sessao/acoes.test.ts:201`, `supabase/migrations/20260822223000_spec13_uma_sessao_aberta.sql:8`).
- Matrícula ausente/expirada: guarda antes do conteúdo (`src/app/app/page.test.tsx:115`, `src/app/app/sessao/acoes.test.ts:263`).

## Gates

| Gate | Resultado |
| --- | --- |
| `validate_spec.py --strict` | ✅ 0 erros, 0 warnings |
| `validate_tasks.py --strict` | ✅ 0 erros, 0 warnings |
| `npm run build` | ✅ Next 16.3.1; rotas `/app/sessao` e `/app/sessao/[id]` incluídas |
| `npm run lint` | ✅ exit 0 |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run test:unit` | ✅ 90 arquivos, 626 testes |
| `npm run test:db` | ✅ 43 arquivos, 351 testes contra Supabase de desenvolvimento |
| `git diff --check` e workspace final | ✅ sem erro e sem alteração não commitada |

O baseline unitário antes da SPEC 13 era 589 testes; a suíte terminou com 626.
O banco exigiu autorização de rede para o Postgres remoto; a execução autorizada
passou integralmente.

## Sensor de discriminação

Worktree temporário `.sensor-spec13`, criado a partir de `1d05b45`, removido ao
final. O workspace real permaneceu limpo antes e depois.

| Mutação comportamental | Teste alvo | Resultado |
| --- | --- | --- |
| Permitir questão anulada no filtro | `src/modules/aluno/sessao.test.ts:118` | ✅ Mutante morto |
| Reintroduzir questão recente no treino | `src/modules/aluno/sessao.test.ts:118` | ✅ Mutante morto |
| Deslocar o `slice` de seleção em uma posição | `src/modules/aluno/sessao.test.ts:175` | ✅ Mutante morto |
| Tratar `causa_obrigatoria` como erro genérico | `src/app/app/sessao/acoes.test.ts:180` | ✅ Mutante morto |
| Servir explicação que contradiz o gabarito | `src/app/app/sessao/acoes.test.ts:240` | ✅ Mutante morto |
| Inverter a detecção de primeira resposta/duplo clique | `src/app/app/sessao/acoes.test.ts:201` | ✅ Mutante morto |

Resultado do sensor: **6/6 mutantes mortos**. Não houve sinal que exigisse
registrar lesson.

## Qualidade e limites

- Tokens visuais permanecem centralizados em `src/app/globals.css:10` e o shell
  conserva foco/link de pulo em `src/modules/ui/shell.tsx:20`.
- O conteúdo do navegador nunca recebe `resposta_correta`; a leitura pública da
  explicação é uma RPC autenticada e filtrada por vigência.
- A validação visual foi feita por testes de renderização estática e build; não
  foi feita homologação manual com uma conta de aluno matriculada. Para produção,
  ainda é necessário executar a migração no projeto Supabase de produção e
  conferir as credenciais/bucket privado de imagens.

## Checagens externas pós-validação

Em 2026-08-22, a rotina protegida de migração foi executada contra o projeto de
desenvolvimento `kfpmetkmhjtmgwgaaerl`: o banco informou que está atualizado, sem
migrations pendentes. Também foi consultado o Storage desse mesmo projeto: o
bucket `questoes` existe e está privado (`public: false`).

Não foi aplicada migration em produção porque o workspace não possui um alvo de
produção separado nem credenciais de produção configuradas; a proteção existente
recusa inferir esse alvo. A homologação com uma conta autenticada também continua
pendente, pois não há uma sessão/conta de teste fornecida e não foi criado dado
externo descartável sem necessidade.

## Commits

`ea87981..1d05b45` — oito tasks da SPEC 13 e o teste adicional de proteção da
explicação divergente. As checagens externas pós-validação foram registradas no
commit documental seguinte.
