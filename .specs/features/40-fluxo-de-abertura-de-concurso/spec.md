# SPEC 40 — Fluxo de abertura de concurso: busca oficial, aprovação e comandos

| | |
| --- | --- |
| **Ordem** | 40 de 40 · [ROADMAP](../../ROADMAP.md) · pós-lançamento |
| **Depende de** | SPEC 15, SPEC 37, SPEC 38, SPEC 39 |
| **Habilita** | — (fecha o fluxo) |
| **Tasks** | 8 · [`tasks.md`](./tasks.md) · [`validation.md`](./validation.md) |
| **Ritual** | **B — normal** (`tasks.md` com design embutido + Verificador independente curto, sem sensor) |
| **Dificuldade** | Média |
| **Status** | ✅ Concluída (Execute T1–T8; verificação APROVADA COM RESSALVAS) |
| **Requisitos** | **RAIOX-07** (estende), **RAIOX-20**, **BANCO-01**, **BANCO-02** (estendem) |
| **Fonte dos requisitos** | `.specs/modulos/m5-raiox-banca/spec.md` · `.specs/modulos/m1-banco-questoes/spec.md` |
| **Decisões** | **AD-145** (substitui AD-144 e recorta AD-140) · herda **AD-003** (fonte legal, sem exceção para agregador), AD-035/AD-036, AD-078 (config sem deploy), AD-141 |

## Problem Statement

As specs 37, 38 e 39 constroem as peças; ninguém as costura. Sem costura, abrir um concurso é uma
sequência de comandos que só quem escreveu sabe rodar, e o trabalho manual do operador continua sendo o
gargalo — que é exatamente o que se quis remover. Esta spec fecha o fluxo: a pessoa diz ao Codex ou
Claude Code qual é o órgão e o cargo; o agente pesquisa com as ferramentas e o limite da própria
sessão, reporta **o que achou e o que faltou** e conduz duas confirmações na conversa. O produto não
ganha API nem provedor de busca. O limite legal é duro e vem do AD-003:
a fonte é o PDF oficial da banca, do órgão ou do diário oficial — **agregador é proibido**, e a busca
de 2026-09-05 confirmou que é justamente onde a maior parte das provas antigas está indexada. O fluxo
assume essa perda em vez de escondê-la.

## Goals

- [ ] "Abrir o concurso X" é um roteiro de comandos, não uma rodada de engenharia.
- [ ] A busca só aceita domínio oficial; o que vem de agregador é descartado, não exibido.
- [ ] O operador aprova na conversa duas listas curtas: os documentos achados e os assuntos novos.
- [ ] O mesmo roteiro executa em Claude Code e em Codex, porque mora no repositório.
- [ ] O relatório final diz, matéria por matéria, em que degrau o Raio-X ficou.
- [ ] A abertura não cria chamada de busca nem tarefa nova na API do produto.

## Escopo

| Requisito | O que entra aqui | AC completos em |
| --- | --- | --- |
| BANCO-01 / BANCO-02 | busca de edital e prova pelo agente da sessão, restrita à lista de domínios oficiais em configuração; comando revalida e grava a URL de origem; resultado fora da lista é descartado sem exibição; catálogo-alvo registra o que achou **e** o que faltou | m1 §P1: Proveniência · §P1: Catálogo-alvo |
| RAIOX-07 | confirmação na conversa: documentos achados, assuntos novos propostos e **fusão** de assunto quase-duplicado contra a lista canônica existente | m5 §P2: Sinal de atualidade sem radar (curadoria conduzida pelo agente) |
| RAIOX-20 | relatório de prontidão por matéria com o degrau de lastro; publicação do concurso como ação humana registrada | m5 §P1: Prontidão |

## Out of Scope

| O que | Onde entra |
| --- | --- |
| Cadastro de concurso, assunto canônico, escolha do aluno | SPEC 37 |
| Leitura de PDF, grade, separação, etiqueta | SPEC 38 |
| A conta do Raio-X | SPEC 39 |
| Busca pela API da OpenAI ou outro provedor pago | rejeitada para esta operação — a pesquisa usa a sessão do agente (AD-145) |
| Telas web próprias para abrir concurso | substituídas pelas confirmações na sessão do Codex/Claude (AD-145) |
| Varredura automática de notícias / radar de atualidade | **Rejeitado** em AD-021 — segue rejeitado |
| Obter PDF que não existe em fonte oficial | fora do sistema: é trabalho humano, e o fluxo apenas informa o que falta |
| Preço, matrícula ou tier por concurso | SPEC 34 |

## Contratos que esta spec fixa para as próximas

- **A pesquisa e a interpretação do programa moram na sessão; a validação e a verdade moram no
  comando.** A skill orienta o agente a pesquisar, preparar propostas e fazer perguntas. Cada escrita
  passa por comando do repositório com entrada e saída definidas. Trocar de agente não perde o estado.
- **PDF de prova não entra no contexto do agente.** O agente pode ler somente o trecho delimitado do
  programa do edital; as provas seguem para o leitor da SPEC 38 e o agente lê apenas o relatório.
- **A SPEC 40 não cria tarefa de IA.** A medição reutiliza `etiqueta_de_item` e, quando necessário,
  `separacao_de_itens`, ambas já construídas na SPEC 38/AD-141. Extração completa de questões continua
  no fluxo separado da SPEC 09.
- **A lista de domínios oficiais é configuração** (AD-078): incluir uma banca nova é linha de config,
  não deploy. Configuração ilegível deixa a busca **desligada**, nunca permissiva.
- Todo documento ingerido carrega a URL de origem, e a origem é auditável depois.

## Assumptions & Open Questions

| Assumption | Default | Confirmado? |
| --- | --- | --- |
| Entrada do fluxo | órgão + cargo; banca é opcional e pode ser descoberta no documento | y |
| Lista de domínios oficiais | `param.m1.dominios_oficiais`, semeada com banca, órgão e diário oficial das 3 bancas do AD-009 | n (calibra) |
| Resultado de busca fora da lista | descartado silenciosamente do resultado, e o total descartado é reportado como número | y (AD-003) |
| Aprovação humana obrigatória | duas portas: lista de documentos e lista de assuntos novos; publicar o concurso é a terceira | y |
| Meta de provas para um concurso "sério" | 4 provas etiquetadas como alvo operacional, não como trava de código | n (default registrado, não medido) |
| Fusão de assunto quase-duplicado | proposta pelo sistema, decidida por humano; nunca automática | y |
| Onde o fluxo roda | sessão do Codex ou Claude Code; trabalho pesado reutiliza comandos/Actions das specs anteriores | y (AD-145) |
| Custo de busca e edital na API do produto | zero; consome apenas o limite da sessão do agente | y (AD-145) |
| Custo de medição das provas | chamadas já existentes da SPEC 38; entre R$ 0,01 e R$ 0,05 por prova na medição registrada | n (medido em 1 prova) |

**Open questions:** none — o que resta acima é calibração de parâmetro, com default e local registrados.

## Success Criteria

- [ ] "Abrir CAIXA / técnico bancário" na conversa percorre pesquisa → confirmação → medição → confirmação → Raio-X sem edição de código
- [ ] Resultado de busca em agregador não aparece na lista de aprovação, e o descarte é reportado como número
- [ ] Cada documento ingerido tem a URL oficial de origem gravada
- [ ] O operador confirma duas listas na sessão, e a publicação do concurso fica registrada com autor
- [ ] O relatório final diz, matéria por matéria, o degrau de lastro e o que falta para subir de degrau
- [ ] O mesmo roteiro executa em Codex e Claude Code, sem nenhuma regra de escrita que só exista no prompt
- [ ] Não existe cliente, tarefa de matriz, segredo nem chamada de API para pesquisar documentos ou interpretar o edital
