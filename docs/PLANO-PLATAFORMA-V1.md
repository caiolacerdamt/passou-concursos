# Plano mestre — Plataforma V1

> Este documento substitui o roadmap de SPECs para a próxima etapa do produto.
> As invariantes de segurança e dados do `AGENTS.md` continuam válidas; o ritual
> de SPECs, TLC, verificadores por tarefa e documentação de processo não se
> aplica a este plano.

## 1. Resultado do programa

Entregar uma plataforma profissional para o concurso do **Banco do Brasil —
Escriturário, Agente Comercial** que responda diariamente:

1. o que estudar hoje;
2. por que esse conteúdo entrou no plano;
3. onde estudar;
4. quais questões resolver;
5. quando revisar;
6. onde o aluno está forte ou fraco;
7. quanto está avançando no edital.

O produto não oferece videoaulas próprias nesta fase. Ele organiza o estudo,
indica recursos externos curados, conduz questões e revisões e forma hábito por
gamificação solo.

## 2. Fatos do baseline

- Stack: Next.js 16 App Router, TypeScript, Supabase/Postgres/Auth/RLS e Vitest.
- O código das antigas SPECs 01–15 está integrado.
- A landing foi redesenhada; o app ainda usa um shell parecido com o público.
- Existem mais de mil questões no acervo operacional. Conforme informado pelo
  responsável do produto, somente 100 estão publicadas, todas de Português.
  O executor deve conferir o banco antes de usar números em UI ou marketing.
- `tentativas` é append-only e continua sendo a fonte histórica.
- A tela de progresso lê `dominio_topico` e `caderno_erros`, mas uma resposta
  não recalcula essas projeções imediatamente; hoje o cron pode deixar a tela
  vazia até a madrugada.
- O módulo FSRS e a régua fixa `1/3/7/14/30` existem, mas
  `agendarRevisao()` não é chamado pelo fluxo de produção. A revisão espaçada
  está construída e testada isoladamente, não integrada ao aluno.
- `/app/raio-x` e `/app/reembolso` existem sem navegação normal. Conta fica
  escondida atrás da tela de Progresso.
- O importador NDJSON, o mapa de taxonomia, o lote de 1.395 questões e as
  imagens necessárias estão versionados. PDFs oficiais permanecem locais e
  ignorados pelo Git.

## 3. Fluxo-alvo do aluno

```text
compra confirmada
  -> definição de senha
  -> onboarding: concurso, dias, tempo e nível
  -> dashboard "Hoje"
  -> plano diário dentro de um ciclo do edital
  -> conteúdo + motivo + recurso curado
  -> técnica de estudo escolhida
  -> questões do conteúdo
  -> feedback e explicação
  -> progresso/domínio atualizado imediatamente
  -> próxima revisão agendada
  -> anel, pontos, missão e sequência atualizados
  -> próximo dia reorganizado sem abandonar o edital
```

## 4. Regras do produto

### 4.1 Ciclo de estudos

O plano não escolhe simplesmente o maior ponto fraco. Ele distribui a capacidade
semanal para fechar o edital e adapta dentro desse ciclo.

Critérios do agendamento, todos determinísticos:

- peso da matéria e do conteúdo no Raio-X;
- cobertura restante do edital;
- tempo disponível e dias declarados;
- domínio do aluno;
- revisão vencida;
- recência da matéria, com cooldown;
- limite de participação semanal por matéria;
- janela máxima sem tocar em matéria relevante.

Fraqueza aumenta frequência e profundidade, mas nunca permite que uma matéria
monopolize a semana. O plano separa capacidade para **avançar**, **praticar** e
**revisar**. Percentuais iniciais são configuração calibrável, não constantes
espalhadas no código.

O aluno pode:

- reordenar os blocos do dia;
- adiar um bloco para o próximo dia disponível;
- escolher uma versão curta do bloco.

O aluno não pode apagar a prioridade nem trocar livremente uma matéria por
outra na V1.

### 4.2 Revisão espaçada

- Conteúdo novo concluído recebe primeira revisão no dia seguinte.
- Desempenho nas questões e revisões ajusta as datas seguintes.
- O FSRS permanece como padrão; a régua fixa continua como fallback.
- O aluno sempre vê a próxima data de revisão.
- Revisão vencida ocupa espaço limitado do plano e não paralisa o avanço do
  edital.
- Nenhuma chamada de IA participa do agendamento.

### 4.3 Recursos de estudo

Curadoria única, armazenada no banco. Estrutura mínima:

- `topico_id`;
- título;
- URL;
- tipo (`video`, `artigo`, `pdf`);
- duração estimada;
- ordem;
- ativo/inativo.

Começar com um recurso principal e, quando possível, uma alternativa por
conteúdo. A carga inicial pode ser CSV/JSON. Não buscar links nem chamar IA na
abertura do plano. Um link quebrado é desativado ou substituído pelo operador.

### 4.4 Técnicas de estudo

São modos de execução, nunca o algoritmo que escolhe a matéria.

V1:

1. **Pomodoro**: foco e pausa guiados.
2. **Foco contínuo**: bloco único de 30, 45 ou 60 minutos.

Depois: recuperação ativa. O aluno escolhe a técnica ao iniciar o conteúdo; o
plano continua sendo o mesmo.

### 4.5 Inteligência e gamificação

- Raio-X por matéria e conteúdo.
- Mapa de Prioridade cruzando peso da banca, domínio, cobertura e revisão.
- Domínio: não iniciado, fraco, em desenvolvimento, forte e dominado.
- Anel diário separado em estudo, questões e revisão.
- Uma atividade significativa mantém a sequência; completar o piso fecha o
  anel.
- Pontos recompensam estudo prioritário, conclusão, revisão no prazo e
  recuperação de erro — nunca volume vazio.
- Missões diárias e conquistas pessoais.
- Sem ranking, liga, moeda, loja ou vidas que punam erro.

## 5. Entregas

| ID | Entrega | Resultado observável |
|---|---|---|
| E1 | Núcleo corrigido | Progresso imediato, revisão ligada e rotas acessíveis |
| E2 | Plataforma profissional | AppShell, menu lateral, dashboard e boas-vindas |
| E3 | Ciclo Agente Comercial | Plano cobre o edital com rotação e limites |
| E4 | Experiência de estudo | Recursos, técnicas, questões e próxima revisão |
| E5 | Inteligência | Raio-X, domínio, Mapa de Prioridade e erros acionáveis |
| E6 | Gamificação | Anel, pontos, missões, sequência e conquistas |
| E7 | Go-live | Acervo distribuído e jornada comercial validada |

## 6. Política de agentes

### 6.1 Configuração obrigatória

Todo trabalhador é criado com:

```text
model: gpt-5.6-luna
reasoning_effort: max
fork_turns: none
```

Não substituir silenciosamente modelo ou esforço. Se a ferramenta não aceitar
essa configuração, o coordenador para e informa o responsável.

O GPT-5.6 Luna suporta `max` e é apropriado a trabalho de alto volume e custo
sensível. O contexto grande não é licença para mandar o repositório inteiro.

### 6.2 Regras duras dos trabalhadores

- Não criar subagentes, revisores, verificadores ou outra orquestração.
- Não usar `brainstorming`, `using-superpowers`, `tlc-spec-driven`,
  `visualize`, ImageGen ou geração de mockup/apresentação.
- Não ler `.specs/STATE-ARQUIVO.md`, o histórico das 36 SPECs ou
  `docs/historico/`.
- Não alterar `.specs/**`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` ou este plano,
  salvo ordem explícita do coordenador.
- Não executar suíte completa por hábito.
- Não criar relatório longo de verificação.
- Não fazer refatoração oportunista fora do objetivo.
- Implementar, testar o comportamento alvo e devolver o resultado.
- Respeitar a lista de arquivos próprios e compartilhados de cada pacote.
- Nunca incluir segredo, `.env`, PDFs-fonte, cache ou screenshot no commit.

### 6.3 Validação proporcional

Trabalhador:

- bug/regra: teste que reproduz o comportamento e testes do módulo tocado;
- UI: teste da rota/componente tocado; build somente quando mudar contrato de
  página, layout ou bundling;
- SQL/migration: teste DB diretamente relacionado;
- importador: teste do job e dry-run quando aplicável.

Proibidos no trabalhador:

- verificador independente;
- mutation testing;
- sensor de discriminação;
- validação AC por AC;
- outro agente para revisar;
- `npm run test:db` repetido após bloqueio de rede.

Coordenador, uma vez por onda:

- revisa os diffs e contratos compartilhados;
- roda `npm run test:unit`;
- roda `npm run build` se a onda tocar aplicação;
- roda `npm run test:db` uma vez, com rede autorizada, se houver SQL/migration;
- integra na ordem declarada;
- atualiza somente a tabela de estado deste plano.

Não existe revisor `gpt-5.6-sol` automático no fim. O responsável pode pedir
uma revisão global manualmente em outra sessão.

## 7. Como evitar releitura do projeto

Cada despacho é composto por:

1. **Prefixo compartilhado**, abaixo, com o contrato do produto.
2. **Apêndice da tarefa**, com objetivo, evidência atual, arquivos e testes.
3. **Commit-base**, para o agente saber de qual estado partiu.
4. **Leitura inicial limitada**, normalmente 3–7 arquivos.

O agente começa pela lista obrigatória. Ele só expande a leitura seguindo um
import/call path necessário para a implementação. Não faz `rg --files` no
repositório inteiro, não lê todos os documentos e não reabre arquivo já incluído
integralmente no pacote.

Nenhum agente pode editar com base apenas no resumo: antes de alterar, lê o
arquivo-alvo atual e seu teste vizinho. O objetivo é remover contexto inútil,
não trabalhar às cegas.

Após cada onda, o coordenador gera os pacotes seguintes usando o código já
integrado. Pacote posterior não reutiliza line numbers ou contratos antigos sem
conferir o commit-base.

## 8. Prefixo compartilhado do prompt

O coordenador copia este bloco literalmente e acrescenta um único apêndice de
tarefa da seção 10:

```text
Você é um trabalhador de implementação do Passou Concursos.

CONFIGURAÇÃO EXIGIDA
- Modelo: gpt-5.6-luna.
- Reasoning effort: max.
- Esta tarefa começa sem histórico herdado. Use somente este pacote e os
  arquivos obrigatórios indicados.

PRODUTO
- Web responsivo para Banco do Brasil — Escriturário, Agente Comercial.
- O aluno abre o app para saber o que estudar hoje, onde estudar, quais
  questões fazer, quando revisar e como está evoluindo.
- O plano fecha o edital por ciclo: fraqueza ajusta, mas não monopoliza.
- Recursos de estudo são links curados do banco, sem IA ao vivo.
- Gamificação é solo e ligada a progresso real.

STACK E CONTRATOS
- Next.js 16 App Router + TypeScript + Supabase/Postgres/RLS + Vitest.
- Domínio e UI em PT-BR.
- `tentativas` é append-only; correção nunca altera tentativa existente.
- Gabarito oficial é a verdade; IA nunca decide alternativa correta.
- Raio-X conta somente questões `origem='real'`.
- Plano é regra/SQL; IA não escolhe o que estudar.
- Tabela com `user_id` exige RLS e inclusão no apagamento.
- Não hardcode nome de modelo no código do produto.
- Leia a documentação relevante em `node_modules/next/dist/docs/` somente se
  modificar uma API do Next.

PROCESSO
- Não crie subagente, revisor ou nova orquestração.
- Não use brainstorming, using-superpowers, TLC, visualização ou mockup.
- Não leia o arquivo histórico do STATE, as 36 specs ou docs/historico.
- Não altere arquivos fora da propriedade declarada.
- Preserve mudanças preexistentes.
- Use apply_patch para editar.
- Teste somente o comportamento alvo e dependências diretas.
- Faça um commit convencional curto quando estiver verde.

RETORNO OBRIGATÓRIO
1. resultado em até cinco linhas;
2. arquivos alterados;
3. testes executados e resultado;
4. hash do commit;
5. risco ou integração pendente, se houver.

Se uma dependência fora do pacote impedir o trabalho, pare e devolva a
evidência. Não amplie o escopo por conta própria.
```

## 9. Ondas e propriedade de arquivos

Máximo de três trabalhadores simultâneos. Três é teto, não meta.

### Onda 1 — fundações paralelas

| Pacote | Entrega | Propriedade principal | Não tocar |
|---|---|---|---|
| W1-A | Progresso e revisão em tempo real | `modules/aluno/revisao/**`, `modules/aluno/progresso.ts`, `app/sessao/acoes.ts`, migration própria e testes diretos | páginas/componentes visuais, shell, importadores |
| W1-B | AppShell e navegação | `app/app/**/page.tsx`, novo layout/shell interno, componentes visuais do app | regras de progresso/revisão, SQL, importadores |
| W1-C | Acervo e recursos | importadores, relatório por matéria, nova base de recursos e migration própria | páginas do aluno, sessão, progresso, shell |

W1-A e W1-C podem criar migrations diferentes. O coordenador reserva nomes
ordenados antes do despacho. Nenhum deles altera a migration do outro.

Ordem de integração: W1-A, W1-C, W1-B. Depois, o coordenador resolve apenas o
encaixe do AppShell nos caminhos alterados; conflito comportamental volta ao
trabalhador dono.

### Onda 2 — motor central, sem paralelismo

| Pacote | Entrega | Motivo de ser sequencial |
|---|---|---|
| W2-A | Ciclo adaptativo do Agente Comercial | Fixa schema, regras e contrato consumido por todas as telas seguintes |

O W2-A implementa cobertura do edital, rotação, teto de fraqueza, cooldown,
capacidade semanal, adiar, reordenar e versão curta. O contrato integrado vira
a única base da Onda 3.

### Onda 3 — três superfícies separadas

| Pacote | Entrega | Propriedade principal |
|---|---|---|
| W3-A | Dashboard e visualização do plano | `/app`, componentes de plano e dashboard |
| W3-B | Estudo guiado | rota própria de estudo, recursos, Pomodoro e foco contínuo |
| W3-C | Raio-X e Mapa de Prioridade | módulo/rota do Raio-X, domínio e cruzamento de prioridade |

Os três consomem o contrato da Onda 2 sem alterá-lo. Mudança necessária no
contrato é escalada ao coordenador e tratada antes de continuar.

### Onda 4 — dois domínios, sem integração visual compartilhada

| Pacote | Entrega | Propriedade principal |
|---|---|---|
| W4-A | Progresso acionável | domínio, tendência, caderno com refação, relatório semanal |
| W4-B | Gamificação de domínio | anel, pontos, missões, sequência e conquistas no banco/domínio |

W4-B não edita dashboard nem Progresso. Ele entrega contratos consumíveis pela
integração seguinte.

### Onda 5 — integração visual, um trabalhador

| Pacote | Entrega |
|---|---|
| W5-A | Integrar gamificação, relatório, contagem da prova e recuperação nas superfícies compartilhadas |

Um único dono evita conflito em dashboard, navegação e Progresso.

### Onda 6 — go-live

| Pacote | Entrega | Pode ser paralelo? |
|---|---|---|
| W6-A | Acervo distribuído por matéria e recursos mínimos | sim |
| W6-B | Jornada automatizada compra -> plano -> estudo -> revisão -> progresso | sim, sem editar os dados do W6-A |

Correções encontradas pelo W6-B são despachadas uma por vez ao dono do módulo.
O agente de jornada não vira um refatorador geral.

## 10. Apêndices de despacho da Onda 1

### W1-A — Progresso e revisão

```text
PACOTE W1-A — NÚCLEO EM TEMPO REAL

Objetivo:
Depois que o aluno conclui um bloco, Progresso deve refletir as tentativas sem
esperar o cron, e a agenda de revisão do tópico deve ser criada/atualizada.

Evidência atual:
- `registrarTentativa` grava o fato.
- Progresso lê projeções reconstruídas por `recalcula_projecoes`.
- O cron roda somente de madrugada.
- `agendarRevisao` existe, mas nenhuma chamada de produção o usa.

Leia primeiro:
1. src/app/app/sessao/acoes.ts
2. src/modules/aluno/tentativas/registrar.ts
3. src/modules/aluno/revisao/agendar.ts
4. src/modules/aluno/progresso.ts
5. supabase/migrations/20260817131000_recalcula_projecoes.sql
6. testes vizinhos desses módulos

Propriedade:
- arquivos acima, testes diretos e uma migration nova reservada pelo
  coordenador.

Não tocar:
- componentes/páginas visuais;
- src/modules/ui/**;
- importadores e dados do acervo;
- planejamento/gamificação futura.

Aceite:
- concluir bloco atualiza domínio/caderno daquele aluno antes de abrir
  Progresso;
- conteúdo tópico agenda primeira revisão para amanhã;
- revisão posterior usa desempenho para atualizar `due`;
- duplo clique não duplica tentativa, evento ou agendamento;
- falha de projeção/agendamento é visível e não corrompe o fato append-only;
- identidade sempre deriva da sessão.

Validação do trabalhador:
- testes da action, revisão e progresso tocados;
- teste DB apenas das RPCs/migration deste pacote.
```

### W1-B — AppShell

```text
PACOTE W1-B — PLATAFORMA PROFISSIONAL

Objetivo:
Separar visual e navegação do app da landing. O aluno autenticado deve sentir
que entrou numa plataforma e alcançar todas as superfícies existentes.

Leia primeiro:
1. DESIGN.md (somente "Duas superfícies" e tokens do app)
2. src/modules/ui/shell.tsx
3. src/app/app/page.tsx
4. src/app/app/progresso/page.tsx
5. src/app/app/conta/page.tsx
6. src/app/app/reembolso/page.tsx
7. guia de layouts do Next em node_modules/next/dist/docs, se criar layout

Propriedade:
- páginas do app, novo AppShell/layout e componentes visuais internos.

Não tocar:
- src/app/app/sessao/acoes.ts;
- src/modules/aluno/progresso.ts;
- src/modules/aluno/revisao/**;
- migrations, importadores e regras do plano.

Aceite:
- menu lateral no desktop e navegação equivalente no mobile;
- links para Hoje, Plano, Raio-X, Questões/Revisões quando disponíveis,
  Progresso, Conta e Reembolso;
- dashboard com boas-vindas e estado atual, sem inventar dados;
- landing e app usam modos visuais distintos;
- matrícula e autenticação continuam protegendo rotas;
- nenhuma rota depende de digitação manual da URL.

Validação do trabalhador:
- testes das páginas/componentes alterados;
- npm run build.
- não gerar screenshot ou mockup.
```

### W1-C — Acervo e recursos

```text
PACOTE W1-C — PRONTIDÃO DE CONTEÚDO

Objetivo:
Dar ao próximo motor um inventário confiável por matéria/tópico e uma base
simples para links de estudo curados, sem IA em tempo real.

Leia primeiro:
1. scripts/jobs/importar-questoes-json.mts
2. scripts/data/taxonomia-concursos-bancarios.json
3. src/modules/acervo/contrato.ts
4. migrations de materias/topicos/questoes vigentes
5. src/modules/operador/consultas.ts
6. testes do importador e do acervo diretamente relacionados

Não leia `questoes.json` inteiro manualmente. Use script/consulta para contar.

Propriedade:
- importadores/relatórios do acervo;
- módulo e migration de recursos de estudo;
- testes diretos;
- sem tela do aluno.

Não tocar:
- app/sessao, app/progresso, shell, dashboard ou plano diário.

Aceite:
- relatório por matéria/tópico separa total, importada, publicada e apta a
  sessão;
- nenhum número de memória vira verdade de UI;
- recurso curado liga a tópico, tem tipo, duração, ordem e estado ativo;
- carga inicial aceita CSV/JSON e é retomável;
- leitura do recurso não chama IA nem busca web;
- RLS/escrita permitem operador e impedem aluno de alterar curadoria;
- PDFs-fonte continuam fora do Git.

Validação do trabalhador:
- testes do importador/recursos;
- teste DB da migration uma vez.
```

## 11. Template para pacotes posteriores

```text
PACOTE {ID} — {NOME}

Commit-base: {HASH_DA_MAIN_APOS_ONDA_ANTERIOR}
Depende de: {CONTRATOS_JA_INTEGRADOS}

Objetivo observável:
{UMA FRASE PELO OLHAR DO ALUNO}

Evidência atual:
{COMPORTAMENTO E CALL PATH RELEVANTES, NÃO HISTÓRIA DO PROJETO}

Leia primeiro:
1. {ARQUIVO-ALVO}
2. {TESTE-VIZINHO}
3. {CONTRATO-CONSUMIDO}

Propriedade:
{PATHS QUE PODE ALTERAR}

Não tocar:
{PATHS COMPARTILHADOS OU DE OUTRO PACOTE}

Aceite:
- {CENÁRIO 1}
- {CENÁRIO 2}
- {FALHA SEGURA}

Validação do trabalhador:
- {TESTES DIRETOS}
```

## 12. Prompt para iniciar a nova sessão coordenadora

```text
Execute o programa descrito em docs/PLANO-PLATAFORMA-V1.md.

Você é o coordenador, não o implementador principal. Comece conferindo que a
branch main está limpa e leia o plano mestre uma vez. Execute uma onda por vez.

Para cada trabalhador:
- use exclusivamente gpt-5.6-luna;
- reasoning effort max;
- fork_turns none;
- envie o prefixo compartilhado da seção 8 mais um único apêndice;
- use branch/worktree isolado a partir da main da onda;
- proíba subagentes, verificadores e ampliação de escopo.

Não use brainstorming, using-superpowers, TLC, visualizações ou mockups. Não
recrie specs. Não peça revisão independente por tarefa. O trabalhador faz
testes direcionados; você roda os gates consolidados uma vez por onda, revisa
os diffs, integra na ordem indicada e atualiza o estado do plano.

Não existe revisor final automático. Pare ao concluir a onda ou quando houver
uma decisão real do responsável do produto.
```

## 13. Estado

| Onda | Estado | Main base | Observação |
|---|---|---|---|
| 1 | concluída | `e07ec1b` | W1-A `9e2f524` + `e13bcaf`; W1-C `c8aadad`; W1-B `7c4df3e`. Unit/build e DB da onda verdes; gate DB geral mantém 4 falhas antigas dependentes de acervo/data. |
| 2 | concluída | `3959720` | W2-A `9526442` + `efa12c1` + `5d97cbb` + `b25c467`. Unit (736)/build e DB próprio (8/8) verdes; gate DB geral mantém 3 falhas antigas dependentes de acervo/data (eram 4). |
| 3 | concluída | `c13ad90` | W3-A `ed69597` + `08eab29` + `33f56b4` + `71883da`; W3-B `e6001e6` + `1ac88b5` + `4bfa761`; W3-C `ac957d0`. Unit (768)/build verdes; sem migration, gate DB não se aplica. |
| 4 | concluída | `46831de` | W4-A `d9dd796` + `126467e` + `9c05a4a` + `5d1a96e`; W4-B `324c635` + `7161738` + `cfbf757` + `d3ad89c`. Unit (786)/build e DB próprios (5/5) verdes; migrations aplicadas no dev. Gate DB geral mantém 3 falhas antigas de acervo/data e 1 expectativa temporal antiga da sequência. |
| 5 | pendente | — | integração visual sequencial |
| 6 | pendente | — | acervo e jornada |

## 14. Critério de encerramento

O programa termina quando um aluno controlado consegue:

1. comprar e entrar;
2. escolher Agente Comercial, dias e tempo;
3. receber um plano variado que cobre o edital;
4. abrir um recurso e estudar com uma técnica escolhida;
5. responder questões do conteúdo;
6. ver domínio/progresso imediatamente;
7. receber e cumprir a revisão na data correta;
8. acompanhar Raio-X, mapa, anel, missão e sequência;
9. reorganizar um dia perdido sem apagar prioridades;
10. alcançar Conta e Reembolso pela navegação.

Esse teste é de jornada do produto. Não exige tutor, áudio, ranking, questões
inéditas, múltiplos concursos ou múltiplos planos comerciais.
