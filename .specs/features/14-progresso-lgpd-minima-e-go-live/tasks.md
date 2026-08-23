# SPEC 14 — Tasks

**Spec**: `.specs/features/14-progresso-lgpd-minima-e-go-live/spec.md`  
**Design**: `.specs/features/14-progresso-lgpd-minima-e-go-live/design.md`  
**Status**: Remediation tasks in progress — T9 complete; T10/T11 pending commit
**Ritual**: A — apagamento irreversível com verificação independente

## Test Coverage Matrix

| Camada | Onde ficam os testes | Cobertura obrigatória | Gate mínimo |
| --- | --- | --- | --- |
| Banco / integração | `tests/db/spec14-*.test.ts` | RLS, identidade derivada, idempotência, sequência em dia agendado/fora da agenda/folga, porta de apagamento, retenção mínima de faturas e jobs | `npm run test:db` |
| Domínio / repositório | `src/modules/aluno/progresso.test.ts` | allowlist de causa, UUID de tópico, filtros combinados, estado inicial, ausência de ranking e mapeamento de erro | `npm run test:unit` |
| Renderização / ações | `src/app/app/progresso/**/*.test.tsx`, `src/app/app/conta/**/*.test.tsx` | guarda de matrícula, própria conta, query string segura, confirmação explícita, ordem e falha do e-mail, estados vazio/erro | `npm run test:unit` |
| Integração de e-mail | `src/modules/lgpd/email.test.ts` | payload mínimo, nenhum segredo no corpo, resposta não-2xx, timeout/ausência de configuração e sucesso | `npm run test:unit` |
| Documentação / contrato de publicação | `src/app/paginas-publicas.test.tsx` e validação de build | versão única dos termos, política e termos sem checkbox nuclear, checklist com pendências manuais | `npm run lint` + `npm run build` |

Cada tarefa que altera uma camada deve colocar o teste correspondente no mesmo commit. A meta é manter
os testes novos determinísticos, sem chamadas de rede reais, e sem depender de um navegador para provar
autorização.

## Gate Check Commands

| Gate | Comando | Uso |
| --- | --- | --- |
| Quick | `npm run test:unit` | Tarefas TypeScript, domínio, telas, ações e e-mail |
| Full | `npm run test:db` | Tarefas de migration, RPC, RLS e pg_cron contra o Supabase de desenvolvimento |
| Build | `npm run lint` e `npm run build` | Integração final e contrato das rotas Next |
| Final | `npm run test:unit`, `npm run test:db`, `npm run lint`, `npm run build` | Verificador independente antes da entrega |

## Execution Plan

As fases são sequenciais. Dentro de uma fase, as setas mostram as dependências que também aparecem no
campo `Depends on` de cada tarefa.

### Foundation (Phase 1)

Primeiro entram os contratos de banco, a porta de apagamento e a agenda automática.

```text
T1 -> T2
T1 -> T3
```

### Core Implementation (Phase 2)

Depois entram a leitura do progresso, a tela e a integração de e-mail.

```text
T4 -> T5
```

### Account and Launch (Phase 3)

Por fim, a conta usa a porta e o e-mail, e a documentação fecha o go-live.

```text
T6 -> T7
T7 -> T8
```

## Task Breakdown

### Phase 1: Foundation

### T1: Criar contrato de sequência e folga

**What**: Criar a projeção diária `sequencia_dia`, a tabela de `folgas_programadas` e as RPCs para
recalcular o histórico e consultar o estado do dia sem receber `user_id` do navegador.  
**Where**: `supabase/migrations/20260822230000_spec14_sequencia.sql`  
**Depends on**: None  
**Reuses**: `supabase/migrations/20260817130000_projecoes.sql`,
`supabase/migrations/20260817133000_plano.sql` e `supabase/migrations/20260817122000_tentativas_trava.sql`  
**Requirement**: GAM-02, ALUNO-02 AC2

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `asvs`

**Files in this task**:

- `src/modules/lgpd/grupo-1.ts`
- `tests/db/spec14-sequencia.test.ts`

**Done when**:

- [x] A projeção conserva o piso diário, a agenda, a folga e o estado calculado por data.
- [x] Dia fora da agenda e folga carregam a sequência sem quebrá-la; piso pendente quebra a sequência no
  próximo dia agendado.
- [x] A RPC autenticada deriva `auth.uid()` e a RPC de job só executa com `service_role`.
- [x] Reprocessar o mesmo intervalo produz o mesmo resultado e não duplica linhas.
- [x] Pelo menos 8 assertions de banco cobrem os caminhos agendado, fora da agenda, folga, piso cumprido,
  piso pendente, estado inicial, isolamento e idempotência.
- [x] Gate full passa: `npm run test:db`.

**Tests**: integration — `tests/db/spec14-sequencia.test.ts` (mínimo 8 assertions)  
**Gate**: full
**Commit**: `feat(gam-02): add daily sequence projection`

---

### T2: Criar porta de esquecimento e retenção financeira mínima

**What**: Criar a fila idempotente e as funções de serviço que apagam o grupo 1 usando a porta nominal,
removem tokens transitórios, desvinculam pagamentos e preservam faturas/aceites necessários.  
**Where**: `supabase/migrations/20260822231000_spec14_esquecimento.sql`  
**Depends on**: T1  
**Reuses**: `app.esquecimento_user_id`, `tentativas` INSERT-only, `matriculas` e o schema de pagamentos  
**Requirement**: DADOS-04

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `asvs`

**Files in this task**:

- `src/modules/lgpd/grupo-1.ts`
- `tests/db/spec14-esquecimento.test.ts`

**Done when**:

- [x] A função aceita somente execução de serviço e abre a porta nominal na mesma transação dos deletes.
- [x] O apagamento cobre as tabelas de grupo 1 existentes, inclusive `tentativas`, projeções, sessões,
  plano, matrícula, folga e sequência; nenhum `DELETE` de edição é liberado.
- [x] `faturas` e o mínimo financeiro necessário permanecem, sem e-mail identificável do aluno; tokens
  de resultado são removidos.
- [x] Repetir a operação é seguro, mantém um único pedido e retorna estado concluído sem duplicar efeitos.
- [x] Há um teste que lista as tabelas atuais com `user_id` e falha se a rotina não cobrir a lista registrada.
- [x] Pelo menos 10 assertions de banco cobrem sucesso, autorização, trigger da porta, retenção,
  idempotência e falha/resume.
- [x] Gate full passa: `npm run test:db`.

**Tests**: integration — `tests/db/spec14-esquecimento.test.ts` (mínimo 10 assertions)  
**Gate**: full
**Commit**: `feat(dados-04): add selective erasure door`

---

### T3: Agendar recálculo da sequência

**What**: Registrar o job diário de sequência com lock, janela até ontem e comportamento seguro quando o
job é repetido.  
**Where**: `supabase/migrations/20260822232000_spec14_cron.sql`  
**Depends on**: T1  
**Reuses**: `supabase/migrations/20260817135000_cron_m4.sql`  
**Requirement**: GAM-02 AC1/AC2

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`

**Files in this task**:

- `tests/db/spec14-cron.test.ts`

**Done when**:

- [x] O job existe uma única vez, aponta para a RPC de sequência e segue o timezone operacional do
  projeto.
- [x] O recálculo não tenta fechar o dia atual antes da abertura da tela.
- [x] O teste comprova existência do job e que a função continua idempotente quando chamada novamente.
- [x] Pelo menos 3 assertions de banco passam.
- [x] Gate full passa: `npm run test:db`.

**Tests**: integration — `tests/db/spec14-cron.test.ts` (mínimo 3 assertions)  
**Gate**: full
**Commit**: `chore(gam-02): schedule sequence projection`

---

### Phase 2: Core Implementation

### T4: Implementar repositório de progresso e caderno

**What**: Implementar os DTOs e consultas próprias de histórico, tópicos, caderno e sequência, com
allowlist de filtros e estado inicial explícito.  
**Where**: `src/modules/aluno/progresso.ts`  
**Depends on**: T1, T3  
**Reuses**: `src/modules/raiox/index.ts`, `src/lib/db/sessao.ts` e `src/modules/config/catalogo.ts`  
**Requirement**: ALUNO-02, ALUNO-10

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `asvs`

**Files in this task**:

- `src/modules/aluno/progresso.test.ts`

**Done when**:

- [x] Causa inválida é descartada e tópico aceita somente UUID válido.
- [x] Causa e tópico podem ser usados juntos, sem concatenar SQL nem consultar o log cru.
- [x] Histórico vazio retorna estado inicial claro e nenhum ranking/posição relativa.
- [x] Todos os DTOs representam somente dados do cliente autenticado e mapeiam erro sem vazar detalhes.
- [x] Pelo menos 12 assertions unitárias cobrem filtros, vazio, sucesso, erro e autorização por cliente.
- [x] Gate quick passa: `npm run test:unit`.

**Tests**: unit — `src/modules/aluno/progresso.test.ts` (mínimo 12 assertions)  
**Gate**: quick
**Commit**: `feat(aluno-02): add progress repository`

---

### T5: Entregar tela de progresso e caderno

**What**: Criar a rota autenticada `/app/progresso`, renderizar sequência/histórico/caderno com filtros
combinados e ligar a navegação da superfície de estudo.  
**Where**: `src/app/app/progresso/page.tsx`  
**Depends on**: T4  
**Reuses**: `src/modules/ui/shell.tsx`, `src/modules/ui/estado.tsx` e `src/modules/aluno/plano-tela.tsx`  
**Requirement**: ALUNO-02, ALUNO-10, GAM-08

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `asvs`

**Files in this task**:

- `src/modules/aluno/progresso-tela.tsx`
- `src/app/app/progresso/page.test.tsx`
- `src/modules/aluno/progresso-tela.test.tsx`

**Done when**:

- [x] A rota exige matrícula e autenticação conforme as páginas existentes.
- [x] A tela diferencia sem histórico, filtro sem resultado e erro de leitura.
- [x] Os dois filtros aparecem e são enviados juntos; nenhum ranking ou comparação entre alunos é exibido.
- [x] A superfície funciona sem depender de estado mantido no navegador e permanece responsiva.
- [x] Pelo menos 8 assertions de renderização cobrem estados, links, query string e ausência de ranking.
- [x] Gate quick passa: `npm run test:unit`.

**Tests**: unit — `src/app/app/progresso/page.test.tsx` e `src/modules/aluno/progresso-tela.test.tsx` (mínimo 8 assertions)  
**Gate**: quick
**Commit**: `feat(aluno-10): add progress and error notebook screen`

---

### Phase 3: Account and Launch

### T6: Criar adaptador de e-mail de confirmação

**What**: Criar um adaptador server-only para enviar confirmação mínima por HTTPS ao Resend, com falha
fechada quando configuração ou resposta do provedor não forem confiáveis.  
**Where**: `src/modules/lgpd/email.ts`  
**Depends on**: None  
**Reuses**: `src/modules/observabilidade/reporte.ts` e o padrão de segredos em `.env.example`  
**Requirement**: DADOS-04, DADOS-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `asvs`

**Files in this task**:

- `src/modules/lgpd/email.test.ts`
- `.env.example`
- `docs/SEGREDOS.md`

**Done when**:

- [x] A função não pode ser importada para o bundle do navegador e nunca recebe segredo do cliente.
- [x] O payload contém apenas destinatário, remetente configurado, assunto e mensagem mínima, sem dados
  apagados nem token.
- [x] Ausência de `RESEND_API_KEY`/remetente, timeout e resposta não-2xx retornam erro controlado.
- [x] Pelo menos 8 assertions unitárias cobrem sucesso, configuração ausente, payload mínimo e falhas.
- [x] Gate quick passa: `npm run test:unit`.

**Tests**: unit — `src/modules/lgpd/email.test.ts` (mínimo 8 assertions)  
**Gate**: quick
**Commit**: `feat(dados-04): add privacy email adapter`

---

### T7: Entregar conta e confirmação de apagamento

**What**: Criar a página `/app/conta` e a Server Action que valida a confirmação, apaga grupo 1, envia
e-mail antes de invalidar Auth e finaliza a fila somente após sucesso externo.  
**Where**: `src/app/app/conta/acoes.ts`  
**Depends on**: T6, T2  
**Reuses**: `src/app/app/acoes.ts`, `src/lib/db/servidor.ts`, `src/lib/db/sessao.ts` e `src/modules/lgpd/email.ts`  
**Requirement**: DADOS-04, DADOS-01

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `asvs`

**Files in this task**:

- `src/app/app/conta/page.tsx`
- `src/modules/lgpd/esquecimento.ts`
- `src/app/app/conta/acoes.test.ts`
- `src/app/app/conta/page.test.tsx`

**Done when**:

- [x] A ação deriva a conta da sessão, recusa confirmação ausente e não aceita `user_id` do formulário.
- [x] A ordem é apagamento → e-mail → exclusão Auth → finalização; falha do e-mail não invalida Auth.
- [x] Nova tentativa é idempotente e uma falha externa deixa status recuperável, sem fingir sucesso.
- [x] A tela explica o que será removido e o que permanece, exige confirmação explícita e aponta o
  procedimento manual de atendimento.
- [x] Pelo menos 10 assertions unitárias cobrem autorização, ordem, idempotência, falhas e conteúdo.
- [x] Gate quick passa: `npm run test:unit`.

**Tests**: unit — `src/app/app/conta/acoes.test.ts` (mínimo 10 assertions)  
**Gate**: quick
**Commit**: `feat(dados-04): add account erasure flow`

---

### T8: Fechar documentos, versão e checklist de go-live

**What**: Atualizar privacidade/termos e contrato do checkout com a versão comum, documentar segredos e
pré-requisitos manuais e publicar o checklist verificável da SPEC 14.  
**Where**: `src/app/privacidade/page.tsx`  
**Depends on**: T7  
**Reuses**: `src/app/termos/page.tsx`, `src/modules/pagamentos/contratos.ts` e `docs/GITFLOW.md`  
**Requirement**: DADOS-01, DADOS-04 e go-live checklist

**Tools**:

- MCP: NONE
- Skill: `tlc-spec-driven`, `asvs`

**Files in this task**:

- `src/app/termos/page.tsx`
- `src/modules/pagamentos/contratos.ts`
- `src/app/paginas-publicas.test.tsx`
- `docs/GO-LIVE-SPEC14.md`
- `docs/SEGREDOS.md`

**Done when**:

- [x] As duas páginas públicas têm versão explícita e a mesma versão usada no aceite do checkout.
- [x] O núcleo do produto não depende de checkbox de consentimento; marketing continua separado.
- [x] A política informa apagamento operacional, faturas retidas, provedor de e-mail e canal default a
  substituir antes da publicação comercial.
- [x] O checklist marca migrations, testes, segredos, conta Asaas, PDFs oficiais, Vercel, PostHog e
  revisão jurídica como itens verificáveis, sem afirmar que foram feitos automaticamente.
- [x] Pelo menos 6 assertions de documentação/build passam.
- [x] Gate build passa: `npm run lint` e `npm run build`.

**Tests**: unit/build — `src/app/paginas-publicas.test.tsx` (mínimo 6 assertions)  
**Gate**: build
**Commit**: `docs(dados-01): document spec14 go-live contract`

---

### Validation remediation

O Verificador independente encontrou uma falha de continuidade na consulta da sequência e três lacunas
de evidência que podiam ser fechadas sem ampliar o produto. Estas tasks são correções da própria SPEC 14,
não dependem de specs futuras.

```text
T1 -> T9
T3 -> T9
T2 -> T10
T4 -> T11
T5 -> T11
```

### T9: Corrigir continuidade da sequência e provar o fim de semana

**What**: Fazer a abertura do dia usar a última data histórica, com zero explícito no estado inicial, e
testar cinco dias úteis, fim de semana e a quebra seguida de um novo dia cumprido.
**Where**: `supabase/migrations/20260823094000_spec14_sequencia_estado_inicial.sql`
**Depends on**: T1, T3
**Requirement**: GAM-02, ALUNO-02 AC2

**Done when**:

- [x] A sequência não usa o maior valor antigo para ressuscitar um período interrompido.
- [x] Conta sem histórico continua recebendo sequência zero, nunca `NULL`.
- [x] O teste cobre cinco dias declarados, sábado fora da agenda e o caso de dia agendado perdido.
- [x] `npm run test:db` passa com a migration aplicada no Supabase de desenvolvimento.

**Tests**: integration — `tests/db/spec14-sequencia.test.ts`
**Gate**: full
**Commit**: `fix(gam-02): preserve last sequence state`

---

### T10: Provar apagamento completo com fixture representativa

**What**: Aumentar a fixture para 30 tentativas e afirmar zero em cada tabela do inventário depois que a
fila é finalizada, mantendo a prova de que a fatura sobrevive enquanto a fila está aberta.
**Where**: `tests/db/spec14-esquecimento.test.ts`
**Depends on**: T2
**Requirement**: DADOS-04

**Done when**:

- [ ] A fixture cria 30 tentativas e exercita a rotina sobre o conjunto completo.
- [ ] Toda tabela do inventário, exceto a fila enquanto aberta, fica com contagem zero.
- [ ] Depois da invalidação Auth e finalização, nenhuma linha com `user_id` do titular sobrevive.
- [ ] Fatura, aceite e evento continuam retidos durante a prova.
- [ ] `npm run test:db` passa.

**Tests**: integration — `tests/db/spec14-esquecimento.test.ts`
**Gate**: full
**Commit**: `test(dados-04): prove complete erasure inventory`

---

### T11: Ampliar asserções da superfície solo

**What**: Cobrir três causas no caderno e fechar o vocabulário proibido de comparação entre alunos nas
asserções da tela.
**Where**: `src/modules/aluno/progresso-tela.test.tsx`
**Depends on**: T4, T5
**Requirement**: ALUNO-10, GAM-08

**Done when**:

- [ ] A renderização mostra três causas diferentes para revisão.
- [ ] Os testes recusam `ranking`, `liga`, `placar`, `percentil` e `posição`.
- [ ] `npm run test:unit` passa.

**Tests**: unit — `src/modules/aluno/progresso-tela.test.tsx`, `src/app/app/progresso/page.test.tsx`
**Gate**: quick
**Commit**: `test(gam-08): cover solo progress vocabulary`

---

## Task Approval Checklist

- [x] Design aprovado pelo usuário antes da execução.
- [x] Cada tarefa tem entrega, dependência, testes, gate e commit atômico.
- [x] As tarefas não dependem de spec futura.
- [x] As superfícies de usuário não escolhem `user_id`.
- [x] Tasks validator passou sem erro.
