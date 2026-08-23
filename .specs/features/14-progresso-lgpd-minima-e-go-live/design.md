# SPEC 14 — Design

**Spec**: `.specs/features/14-progresso-lgpd-minima-e-go-live/spec.md`  
**Status**: Approved  
**Ritual**: A — apagamento irreversível com verificação independente

## Architecture Overview

A entrega será banco-primeiro e server-rendered. O progresso e o caderno leem as projeções já produzidas
por `recalcula_projecoes()`. A sequência terá uma projeção diária própria para o histórico e uma função
pequena para calcular o estado de hoje na abertura da tela. O navegador nunca escolhe `user_id`: páginas e
ações derivam a identidade da sessão e o banco repete a autorização.

```mermaid
flowchart TD
  A[Aluno autenticado] --> B[/app/progresso]
  B --> C[Leitura das projeções próprias]
  C --> D[dominio_topico + caderno_erros]
  B --> E[consultar_sequencia_do_dia]
  E --> F[sequencia_dia + plano de hoje + sessões de hoje]
  G[Job pg_cron] --> H[recalcula_sequencia]
  H --> F
  I[Conta: confirmar apagamento] --> J[apagar_dados_do_usuario]
  J --> K[Porta app.esquecimento_user_id]
  K --> L[Grupo 1 apagado]
  J --> M[Pagamentos/faturas mínimos preservados]
  L --> N[Resend por HTTPS]
  N --> O[Excluir auth e finalizar pedido]
```

A alternativa rejeitada é calcular progresso e sequência lendo `tentativas` a cada render. Ela quebra a
regra de projeção, torna a tela pesada e expõe o log cru a uma superfície que só precisa de números
derivados. Também fica rejeitado manter estado de hábito no navegador: seria manipulável e não sobreviveria
a outro dispositivo.

## Code Reuse Analysis

| Componente existente | Local | Uso nesta spec |
| --- | --- | --- |
| Cliente autenticado | `src/lib/db/sessao.ts` | Ler dados próprios e derivar `auth.uid()` no servidor. |
| Cliente de serviço | `src/lib/db/servidor.ts` | Chamar as funções protegidas de rotina, nunca expor a chave ao navegador. |
| Guarda de matrícula | `src/modules/conta/matricula.ts` | Proteger a superfície de estudo antes de ler acervo ou projeções. |
| Projeções M4 | `supabase/migrations/20260817130000_projecoes.sql` | Fonte do histórico e do caderno, sem consulta pesada ao log. |
| Job M4 | `supabase/migrations/20260817135000_cron_m4.sql` | Mesmo padrão de lock, idempotência e `pg_cron` para a sequência. |
| Shell e estados | `src/modules/ui/shell.tsx`, `src/modules/ui/estado.tsx` | Layout, acessibilidade e estados vazio/erro já padronizados. |
| Reporte único | `src/modules/observabilidade/reporte.ts` | Erros genéricos para o aluno e contexto saneado no Sentry. |
| Versão do checkout | `src/modules/pagamentos/contratos.ts` | Fonte da versão registrada em `pagamento_aceites`. |

## Components

### Migrations de sequência, apagamento e agenda

- **Purpose**: Criar as projeções, a folga declarada e a porta transacional do direito ao esquecimento.
- **Location**: `supabase/migrations/20260822230000_spec14_sequencia.sql`,
  `supabase/migrations/20260822231000_spec14_esquecimento.sql` e
  `supabase/migrations/20260822232000_spec14_cron.sql`
- **Interfaces**:
  - `recalcula_sequencia(p_user_id, p_ate)` — job de serviço, recalculável e idempotente.
  - `consultar_sequencia_do_dia()` — RPC autenticada, sem `user_id` recebido do cliente.
  - `apagar_dados_do_usuario(p_user_id)` — serviço, abre `app.esquecimento_user_id` e remove grupo 1.
  - `registrar_email_esquecimento(p_user_id)` — registra a confirmação enviada sem guardar o corpo do e-mail.
  - `finalizar_esquecimento(p_user_id)` — remove a fila residual depois de a conta Auth ser invalidada.
- **Dependencies**: tabelas M4, M8 e matrícula existentes; privilégios `service_role`.
- **Reuses**: trava do log em `20260817122000_tentativas_trava.sql` e lock das funções M4.

### Repositório de progresso

- **Purpose**: Mapear projeções do banco para DTOs PT-BR e validar filtros antes da consulta.
- **Location**: `src/modules/aluno/progresso.ts`
- **Interfaces**:
  - `consultarProgresso(cliente, filtros)` — histórico, caderno, tópicos de filtro e sequência.
  - `normalizarFiltrosProgresso(entrada)` — allowlist de causas e UUID de tópico.
- **Dependencies**: `SupabaseClient`, RLS das tabelas de grupo 1.
- **Reuses**: padrão de leitura e erros de `src/modules/raiox/index.ts`.

### Superfície de progresso

- **Purpose**: Exibir histórico, estado inicial, sequência própria e caderno com os dois filtros combinados.
- **Location**: `src/app/app/progresso/page.tsx`, `src/modules/aluno/progresso-tela.tsx`.
- **Interfaces**: `PageProps<"/app/progresso">` com `searchParams` para `causa` e `topico`.
- **Dependencies**: matrícula ativa, flag `flag.m4.caderno_erros`, repositório de progresso.
- **Reuses**: `Shell`, `Estado`, tipografia e tokens existentes.

### Conta e apagamento

- **Purpose**: Explicar a consequência, exigir confirmação explícita, apagar no servidor e invalidar a conta.
- **Location**: `src/app/app/conta/page.tsx`, `src/app/app/conta/acoes.ts`, `src/modules/lgpd/esquecimento.ts`.
- **Interfaces**:
  - `solicitarExclusao(formulario)` — Server Action que autentica, valida confirmação, executa a rotina,
    envia confirmação antes de `auth.admin.deleteUser()` e encerra a sessão.
  - `processarApagamento(cliente, userId)` — coordena RPCs sem aceitar identidade do formulário.
- **Dependencies**: cliente de sessão, cliente de serviço, adaptador de e-mail, Sentry.
- **Reuses**: padrão das actions de onboarding e reembolso para autenticação, reporte e redirect.

### Adaptador de e-mail de confirmação

- **Purpose**: Enviar somente a confirmação mínima por HTTPS, sem deixar o apagamento concluir silenciosamente.
- **Location**: `src/modules/lgpd/email.ts`.
- **Interfaces**: `enviarConfirmacaoDeExclusao(email, fetcher?)`.
- **Dependencies**: `RESEND_API_KEY` e `EMAIL_FROM` no servidor.
- **Reuses**: `fetch` nativo e testes com dependência injetada; nenhum SDK ou segredo no cliente.

### Documentos e checklist de lançamento

- **Purpose**: Publicar a política e os termos versionados, declarar operadores e registrar a conferência
  manual das superfícies ligadas.
- **Location**: `src/app/privacidade/page.tsx`, `src/app/termos/page.tsx`,
  `docs/GO-LIVE-SPEC14.md`, `.env.example`, `docs/DEPLOY.md`.
- **Dependencies**: versão do aceite do checkout e dados reais do controlador/DPO preenchidos manualmente.

## Data Models

### `sequencia_dia` — grupo 1

```sql
user_id uuid not null,
data date not null,
agendado boolean not null,
folga boolean not null,
piso_entregue boolean not null,
piso_cumprido boolean not null,
estado text not null,
sequencia integer not null,
atualizado_em timestamptz not null
primary key (user_id, data)
```

O registro guarda a agenda e a folga como fotografia do dia. Dias fora da agenda e folgas carregam a
sequência anterior; um dia agendado com piso não concluído zera o contador da versão mínima desta spec.
Escudos, janela de recuperação e reset suave continuam fora do escopo e entram na SPEC 26.

### `folgas_programadas` — grupo 1

```sql
user_id uuid not null,
data date not null,
motivo text,
criada_em timestamptz not null
primary key (user_id, data)
```

RLS limita leitura e escrita ao próprio titular. A ação aceita somente datas válidas e não recebe outro
`user_id`.

### `solicitacoes_esquecimento` — grupo 1 operacional

```sql
user_id uuid primary key,
estado text not null,
dados_apagados_em timestamptz,
email_enviado_em timestamptz,
ultima_falha_codigo text,
atualizado_em timestamptz not null
```

A linha existe apenas enquanto a operação precisa ser retomada. A rotina de finalização a remove depois da
exclusão do Auth; nenhum `user_id` de pedido concluído permanece.

## Data Flow and Authorization

1. A página autenticada chama a consulta sem fornecer identidade no formulário.
2. A RLS de `dominio_topico`, `caderno_erros`, `sequencia_dia` e `folgas_programadas` restringe o titular.
3. A Server Action valida a confirmação e deriva `user.id` de `clienteDaSessao()`.
4. A função de apagamento roda como `security definer`, mas só fica executável por `service_role`; a função
   declara `set local app.esquecimento_user_id` antes de apagar `tentativas` e `revisao_evento`.
5. Pagamentos e faturas não são apagados: referências ao titular são anuladas ou mascaradas conforme a
   retenção fiscal, e capacidades temporárias do checkout são eliminadas.
6. O adaptador Resend recebe somente o e-mail e o texto de confirmação. Falha do provedor impede a
   invalidação da conta e deixa o pedido retomável.

## Error Handling Strategy

| Cenário | Tratamento | Impacto para o aluno |
| --- | --- | --- |
| Projeção ainda vazia | DTO `estadoInicial=true` | Texto de começo, sem apresentar zero como fracasso. |
| Filtro inválido | Ignorar o valor inválido e usar filtro vazio | Página continua segura; nenhum UUID arbitrário vira consulta. |
| RPC de progresso falha | Lançar erro interno | `error.tsx` mostra mensagem genérica e o Sentry recebe o evento saneado. |
| Resend sem credencial ou fora do ar | Falhar antes de invalidar Auth; manter pedido retomável | Mensagem genérica e instrução para tentar novamente. |
| Falha depois de apagar grupo 1 | Estado persistido em `solicitacoes_esquecimento` | Nova execução não repete nem desfaz; finaliza a etapa faltante. |
| Concorrência entre dois pedidos | Lock por titular + chave única | Uma única operação efetiva. |

## Security Criteria (ASVS L2 scoped)

| Local ID | ASVS | Decisão específica | Verificação |
| --- | --- | --- | --- |
| SEC-01 | v5.0.0-2.2.1, v5.0.0-2.2.2 | Validar checkbox, filtros, datas e UUIDs no servidor com allowlist. | Testes unitários e de action. |
| SEC-02 | v5.0.0-2.3.1, v5.0.0-2.3.3 | Apagamento em transações SQL, com lock e sem pular etapas de e-mail/Auth. | Teste de banco e teste de ordem da action. |
| SEC-03 | v5.0.0-8.2.1, v5.0.0-8.2.2, v5.0.0-8.3.1 | Identidade vem da sessão; RPCs não aceitam titular arbitrário do navegador. | Testes de RLS/action e inspeção da migration. |
| SEC-04 | v5.0.0-14.2.1, v5.0.0-14.2.3, v5.0.0-14.3.2 | Nenhum dado sensível em query de exclusão; Resend recebe só o mínimo; páginas protegidas são dinâmicas. | Testes de rota e checklist de headers/cache. |
| SEC-05 | v5.0.0-16.2.5, v5.0.0-16.5.1, v5.0.0-16.5.2 | Não registrar e-mail/segredo; devolver mensagem genérica; falha externa não abre caminho de sucesso. | Testes de erro e inspeção do reporte. |

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| O schema atual não tem auditoria formal de LGPD | `.specs/features/14.../spec.md` Out of Scope | Não há trilha completa até a SPEC 16. | Manter o pedido retomável e os erros no Sentry; não ligar o flywheel logado. |
| A rotina de pagamentos tem tabelas sem `user_id` direto | `supabase/migrations/20260821110000_pagamentos_schema.sql` | Um DELETE ingênuo poderia quebrar retenção ou deixar capacidade bearer. | Anular/mascarar `pagamentos`, preservar `faturas` e remover tokens temporários por relação. |
| Não existe e-mail transacional configurado | `.env.example` | A confirmação não funcionaria em produção sem configuração. | Adaptador fail-closed, variáveis documentadas e checklist com verificação de domínio. |
| Identidade do controlador/DPO ainda é uma decisão externa | `src/app/privacidade/page.tsx` | Política não deve ir ao ar com dados fictícios. | Texto operacional explícito e tarefa manual bloqueante no checklist. |
| A sequência mínima não cobre perdão/reset | M6, SPEC 26 | Um dia perdido pode zerar a versão de lançamento. | Limitar a implementação a GAM-02; declarar o comportamento e não prometer escudos. |

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Fonte do progresso | Projeções `dominio_topico` e `caderno_erros` | Cumpre AD-015 e evita cálculo pesado ao vivo. |
| Estado de hoje | RPC autenticada pequena sobre plano/sessões | Cumpre AD-071 sem esperar o job e sem entregar identidade por parâmetro. |
| Histórico da sequência | `sequencia_dia` recalculada por `pg_cron` | Permite retomada e mantém fotografia da agenda vigente no dia. |
| Confirmação de exclusão | Resend REST via `fetch` | O projeto não possui provedor transacional; não adicionar SDK reduz superfície. |
| Flag da superfície | `flag.m4.caderno_erros` | Progresso e caderno nascem ligados como uma única superfície do lançamento; a conta é superfície ligada por AD-076. |

## Manual prerequisites

Antes de ligar o lançamento, o responsável precisa configurar a conta Resend e o domínio remetente, preencher
controlador/CNPJ/encarregado e e-mail reais na política, aplicar as migrations em cada ambiente, conferir a
retenção de backups de sete dias e percorrer o checklist de `docs/GO-LIVE-SPEC14.md`. Nenhuma dessas etapas
será simulada por código.
