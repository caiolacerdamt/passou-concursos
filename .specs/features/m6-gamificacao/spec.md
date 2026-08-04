# M6 — Gamificação de Hábito · Especificação

> Fonte: `PRD.md` §M6, §4.2, §9 (invariantes de honestidade), §10 (risco 11);
> `docs/historico/DECISOES-TECNICAS.md` D23–D25. Decisões: AD-023, AD-024, AD-025.
> Herda contratos: **AD-042** (log `tentativas` — o hábito é **projeção** sobre ele, o M6
> **nunca escreve** no log), **AD-043** (causa do erro obrigatória ao errar no treino),
> **AD-044** (plano diário emite **`piso` e `meta_cheia`** — ALUNO-11 — e as projeções rodam
> por job), **AD-017** (agenda e horário declarados no onboarding; progresso medido do
> **ponto de partida**), **AD-019/AD-022** (`data_prova` vive no perfil de concurso, M5,
> e pode estar vazia), **AD-026** (notificação fora do app = base legal **consentimento**),
> **AD-035/AD-037** (job agendado; falha visível/alertada).
> Gray zone resolvida em Discuss (2026-07-23): **AD-058** (escudos por constância, teto 2),
> **AD-059** (reset suave = congela + janela de recuperação), **AD-060** (**anti-trapaça sem
> trava de tempo** — anel por bloco concluído; **substitui** essa parte do AD-025),
> **AD-061** (sinal "no prazo" sem data da prova vira ritmo de avanço).

## Problem Statement

O produto precisa manter um **adulto ansioso** estudando por meses, e os dois caminhos óbvios estragam o
método: premiar presença pura ensina o aluno a fugir do trabalho difícil que o motor de prioridade
escolheu, e ranking entre candidatos que disputam a **mesma vaga** afasta justamente o mais fraco — que é
quem mais precisa continuar. A saída é separar em **quatro sinais**, cada um com uma função única, e
deixar a **barra da sequência dentro do plano**: como a primeira fatia do plano é o bloco Revisar (revisão
espaçada), o mínimo que mantém a sequência já é, por construção, o trabalho de maior valor. O perdão é
generoso de propósito (a sequência existe para o aluno aparecer), enquanto a honestidade sobre passar ou
não passar mora em **outro** sinal, que não se congela.

## Goals

- [ ] Quatro sinais separados e legíveis — sequência, anel do dia, "no prazo" e progresso — sem nenhum
      número único que finja resumir tudo.
- [ ] A sequência se mantém cumprindo o **piso** entregue pelo sistema (~5–10 min de revisões), medida
      contra a **agenda que o próprio aluno declarou**, nunca contra presença diária crua.
- [ ] Um dia perdido não destrói meses: escudo automático e, depois dele, tropeço recuperável — **nunca
      zerar**.
- [ ] Nada do que o aluno acumula pode ser preenchido clicando no automático — sem cronômetro e sem
      invalidar resposta em silêncio.
- [ ] Zero ranking, zero liga, zero placar entre alunos no lançamento.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| Montagem do plano, `piso` e `meta_cheia` | É M4 (ALUNO-11) — o M6 **consome**, não decide o que entra no plano |
| Gravação de resposta, `tempo_ms`, causa do erro | É M4/AD-042/AD-043 — o M6 **lê**, nunca escreve no log |
| Prêmio em dinheiro / recompensa material | **Rejeitado** (D25) |
| Ranking, liga, placar entre alunos | **Rejeitado no lançamento** (D25) |
| Grupo privado de responsabilidade (social opt-in) | P3/fast-follow, sem cabo-de-guerra — fora do MVP |
| Infra de push/e-mail e coleta do consentimento | É M9/M7 (M6 define **quando** e **o quê**, não o canal) |
| Cálculo de domínio por tópico | É M4 (`dominio_topico`) — o M6 só apresenta o progresso desde o ponto de partida |
| Cobrança/renovação/avisos de vencimento | É M8 (AD-055), transacional, não é gamificação |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| Como o aluno ganha escudo | **Por constância**: 1 escudo a cada N dias de agenda cumpridos, **teto 2** guardados | Discuss 2026-07-23 → **AD-058**; prende a proteção ao esforço e impede virar licença para sumir | **y** |
| O que acontece quando o escudo acaba | **Congela + janela**: a sequência para de crescer, fica marcada como tropeçada e volta de onde parou se o aluno cumprir a **meta cheia** dentro da janela; só cai se a janela vencer | Discuss 2026-07-23 → **AD-059**; segunda chance com prazo claro, nunca a zero | **y** |
| Anti-"clique automático" | **Sem trava de tempo.** O anel conta **bloco do plano concluído**, não questão respondida; e o bloco só fecha com a **causa declarada em cada erro** (AD-043) | Discuss 2026-07-23 → **AD-060**; **substitui** o "resposta rápida demais não conta" do AD-025 — invalidar em silêncio pune resposta legítima e o aluno não descobre por quê | **y** |
| Sinal "no prazo" sem `data_prova` | Vira **ritmo de avanço** (abriu conteúdo novo nos últimos N dias × só revisou), sem prometer cobertura; **troca sozinho** para contagem regressiva quando a data entra no perfil | Discuss 2026-07-23 → **AD-061**; o BB está sem edital e D25 proíbe fabricar urgência | **y** |
| N de dias por escudo, teto, tamanho da janela de recuperação | Configuração (início: 1 escudo a cada 7 dias cumpridos, teto 2, janela de 3 dias) | Risco #11: "número exato = afinação de spec, não arquitetura" | n (calibra) |
| Janela do "ritmo de avanço" | Configuração (início: conteúdo novo nos últimos ~7 dias) | Idem | n (calibra) |
| `tempo_ms` no MVP | Continua **gravado** no log (AD-042) e usado em relatório interno; SHALL NOT ser porteiro do anel nem da sequência | AD-060 tira o papel de porteiro, não o dado | **y** |
| Fuso do "dia" da sequência | Fuso declarado pelo aluno; a virada do dia usa esse fuso, não o do servidor | Sequência é contrato emocional — virar meia-noite errada quebra injustamente | n (default registrado) |
| Placar do hábito — **duas velocidades** | **Na hora**: `anel do dia` e `sequência` são calculados **na abertura da tela**, direto do plano do dia + tentativas de hoje daquele aluno (consulta pequena: 1 aluno × 1 dia). **Por job**: progresso, domínio, caderno e o histórico da sequência. | Discuss 2026-07-23 → **AD-071**. O anel é o retorno imediato do esforço: se ele só atualizasse no job diário do M4, o aluno fecharia um bloco e não veria nada mudar até o dia seguinte — o módulo perderia a função. Não fere o invariante #7 (que proíbe **IA** ao vivo e conta pesada ao vivo, não uma consulta de um aluno) | **y** |
| Efeito retroativo de mudança de agenda | Mudar a agenda declarada vale **daqui pra frente**; SHALL NOT reescrever dias passados | Senão a sequência vira número editável pelo próprio aluno | n (default registrado) |
| Notificação fora do app | Exige **consentimento** (AD-026); dentro do app, o aviso é parte do produto contratado | Base legal por finalidade | y |

**Open questions:** none — os quatro pontos abertos foram fechados em Discuss; o resto é calibração de
parâmetro, com default e local registrados.

---

## User Stories

### P1: Quatro sinais separados ⭐ MVP

**User Story**: Como aluno, quero ver quatro coisas diferentes — constância, esforço de hoje, se estou
avançando e o quanto cresci — para entender minha situação sem um número que esconde a verdade.

**Why P1**: É a arquitetura inteira do módulo (D23). Um número único ou premiaria presença ou desmotivaria
quem está começando.

**Acceptance Criteria**:

1. O sistema SHALL apresentar **quatro sinais distintos**: **sequência** (constância), **anel do dia**
   (quanto do plano foi feito hoje), **no prazo** (está avançando o suficiente) e **progresso** (quanto
   cresceu desde o ponto de partida). SHALL NOT combiná-los num índice único.
2. O **progresso** SHALL ser expresso como crescimento **desde o ponto de partida** medido no diagnóstico
   (AD-017) e SHALL NOT ser apresentado como veredito de domínio absoluto.
3. O progresso SHALL NOT ser usado como moeda do hábito — SHALL NOT alimentar sequência nem anel.
4. Os quatro sinais SHALL ser **projeções** recalculáveis a partir de `tentativas` + plano do dia; o M6
   SHALL NOT gravar nada em `tentativas` (AD-042).
5. WHEN os sinais são recalculados do zero, THEN SHALL produzir os mesmos valores (idempotente).
6. **Anel do dia** e **sequência** SHALL ser calculados **na abertura da tela**, a partir do plano do dia e
   das tentativas de hoje daquele aluno; **progresso** e o histórico da sequência SHALL vir de **job**
   (AD-071). WHEN o aluno conclui um bloco, THEN o anel SHALL refletir isso **na carga seguinte da tela**,
   SHALL NOT esperar o job diário.

**Independent Test**: Apagar a projeção de hábito e reconstruí-la só do log + planos e obter os mesmos
quatro números.

---

### P1: Sequência de barra baixa dentro do plano ⭐ MVP

**User Story**: Como aluno, quero manter a sequência cumprindo o piso do plano (as revisões devidas, uns
5–10 minutos), para criar hábito sem ter que fazer tudo todo dia.

**Why P1**: É o motor de retorno diário, e a barra baixa só é honesta porque o piso é o trabalho de maior
valor.

**Acceptance Criteria**:

1. WHEN o aluno conclui o **`piso`** do plano do dia (contrato ALUNO-11), THEN o sistema SHALL manter ou
   incrementar a sequência.
2. A tarefa que compõe o piso SHALL ser a **entregue pelo sistema** (regra/SQL do M4), SHALL NOT ser
   escolha livre do aluno — não existe o que trapacear porque o aluno não escolhe o que vale.
3. A sequência SHALL medir **compromisso com a agenda declarada** pelo aluno (dias por semana, AD-017);
   WHEN o dia não faz parte da agenda declarada, THEN não estudar SHALL NOT quebrar nem interromper a
   sequência.
4. WHEN o aluno declara uma **folga programada** (viagem, prova na faculdade), THEN os dias declarados
   SHALL NOT contar contra a sequência.
5. WHEN o aluno muda a agenda declarada, THEN a mudança SHALL valer a partir daquele momento e SHALL NOT
   reescrever dias já avaliados.

**Independent Test**: Declarar 5 dias por semana, cumprir só o piso nesses 5 e ver a sequência intacta
depois de um fim de semana sem estudar.

---

### P1: Anel do dia com teto no plano ⭐ MVP

**User Story**: Como aluno, quero um anel que enche quando eu faço o plano, para ver meu esforço sem que
exista um número para eu inflar.

**Why P1**: É a métrica de esforço diário e o ponto onde o produto poderia acidentalmente premiar volume.

**Acceptance Criteria**:

1. O anel SHALL medir **quanto do plano do dia foi concluído**, tendo a **`meta_cheia`** (ALUNO-11) como
   **teto**; responder além do plano SHALL NOT aumentar o anel.
2. A unidade do anel SHALL ser o **bloco do plano concluído** (Revisar / Avançar / Treinar), SHALL NOT ser
   a contagem de questões respondidas (AD-060).
3. WHEN um bloco contém erros, THEN ele SHALL ser considerado concluído somente após a **causa de cada
   erro** ter sido declarada (obrigação já existente no treino, AD-043).
4. O sistema SHALL NOT aplicar nenhuma **trava por tempo de resposta**; nenhuma resposta SHALL ser
   descartada silenciosamente por ter sido rápida (revoga essa parte do AD-025 — ver AD-060).
5. `tempo_ms` SHALL continuar sendo gravado no log e SHALL poder ser usado em relatório interno de
   qualidade; SHALL NOT decidir se o dia conta.
6. WHEN o aluno estuda além do plano, THEN o sistema SHALL registrar normalmente as tentativas e SHALL
   reconhecer o esforço extra em texto, sem mover o anel além do teto.

**Independent Test**: Responder 200 questões fora do plano e ver o anel parar na meta cheia; deixar um erro
sem causa declarada e ver o bloco não fechar.

---

### P1: Sinal "no prazo" — anti-acomodamento ⭐ MVP

**User Story**: Como aluno, quero um aviso honesto de que estou só revisando e não avançando, para não
manter uma sequência linda e reprovar.

**Why P1**: É a correção própria do produto sobre a máquina de hábito — sem ela, a barra baixa vira
armadilha para o nosso público.

**Acceptance Criteria**:

1. WHEN o perfil de concurso tem `data_prova` preenchida, THEN o sinal SHALL comparar o **ritmo de
   cobertura do edital** com o tempo restante e SHALL dizer, sem rodeio, se o ritmo é suficiente.
2. WHEN `data_prova` está **vazia**, THEN o sinal SHALL medir **ritmo de avanço** — se o aluno abriu
   conteúdo novo (bloco Avançar) dentro da janela configurada ou está apenas revisando — e SHALL NOT
   afirmar nada sobre cobrir o edital a tempo (AD-061).
3. WHEN a `data_prova` passa a existir no perfil (M5/RAIOX-08), THEN o sinal SHALL passar sozinho para o
   modo com contagem regressiva, sem intervenção manual.
4. O sinal "no prazo" SHALL NOT ser congelável, adiável ou protegido por escudo — o perdão vale **só** para
   a sequência (AD-024).
5. WHEN o aluno está acomodado (só piso, sem avançar), THEN o sistema SHALL dizer a verdade **sem retirar o
   mérito da constância** — a sequência SHALL permanecer intacta e os dois sinais SHALL coexistir.
6. O sinal SHALL NOT usar informação fabricada nem estimativa apresentada como fato para criar urgência
   (D25 — nunca mentir).

**Independent Test**: Semear 15 dias cumprindo só o piso e ver a sequência em 15 **e** o "no prazo" em
alerta, dizendo há quantos dias não há conteúdo novo.

---

### P2: Perdão da sequência — escudo, folga e reset suave

**User Story**: Como aluno com rotina irregular, quero que um dia perdido não apague meses de constância,
para não abandonar o produto no primeiro tropeço.

**Why P2**: É a correção do defeito fatal do streak "tudo ou nada"; o núcleo (P1) funciona sem, mas a
retenção sofre.

**Acceptance Criteria**:

1. O aluno SHALL acumular **escudos por constância** — 1 a cada N dias de agenda cumpridos (config) — com
   **teto de 2** guardados (AD-058).
2. WHEN um dia da agenda é perdido **e** há escudo disponível, THEN o sistema SHALL gastá-lo
   **automaticamente**, a sequência SHALL sobreviver e o gasto SHALL ser informado ao aluno com clareza.
3. WHEN um dia da agenda é perdido **e** não há escudo, THEN a sequência SHALL **congelar** no valor
   atual, SHALL ser marcada como **tropeçada** e SHALL abrir uma **janela de recuperação** (config)
   (AD-059).
4. WHEN o aluno cumpre a **meta cheia** dentro da janela de recuperação, THEN a sequência SHALL voltar a
   contar **de onde parou**.
5. WHEN a janela de recuperação vence sem meta cheia, THEN a sequência SHALL cair — e SHALL NOT ir a zero
   em nenhuma hipótese (piso de queda em config).
6. Escudos SHALL NOT ser compráveis, transferíveis nem obtidos por assistir anúncio.
7. WHEN a sequência é recalculada do log, THEN o consumo de escudos e o tropeço SHALL ser reproduzidos de
   forma determinística (a projeção é recalculável, AD-044).

**Independent Test**: Perder um dia com escudo e ver a sequência intacta com aviso; perder outro sem
escudo, ver "tropeçou", cumprir a meta cheia no dia seguinte e ver a contagem retomar do mesmo número.

---

### P2: Notificação leve, tom de treinador

**User Story**: Como aluno, quero poucos lembretes, no horário que eu escolhi, sem culpa, para o app não
virar mais uma fonte de ansiedade.

**Why P2**: Melhora o retorno diário; o produto funciona sem, e uma notificação mal calibrada queima a
marca com um público já ansioso.

**Acceptance Criteria**:

1. O sistema SHALL enviar no máximo **1 lembrete de estudo por dia** e, no máximo, **1 aviso de "sequência
   em risco"** no fim do dia.
2. O lembrete SHALL cair no **horário declarado** pelo aluno (AD-017), SHALL NOT ser aleatório.
3. As notificações SHALL ser configuráveis (ligar/desligar por tipo) e SHALL respeitar **horário de
   silêncio**.
4. O conteúdo SHALL ter **tom de treinador**, SHALL NOT usar culpa, ameaça ou comparação com outros alunos.
5. O sistema SHALL NOT afirmar nada falso para criar urgência (nada de "outros já estudaram hoje"
   fabricado) — invariante de honestidade.
6. WHEN a notificação sai **fora do app** (push/e-mail), THEN SHALL depender do **consentimento** de
   comunicação (AD-026/DADOS-01); WHEN o aluno não consentiu, THEN o aviso SHALL existir apenas **dentro**
   do produto.

**Independent Test**: Declarar horário de estudo às 20h e silêncio depois das 22h, e confirmar um único
lembrete às 20h e nenhum depois das 22h.

---

### P2: 100% solo, sem ranking

**User Story**: Como aluno que disputa uma vaga real, não quero ver posição comparada a outros candidatos,
para não estudar com medo do lugar na lista.

**Why P2**: É uma restrição dura de produto (D25); vale como requisito verificável, não como feature.

**Acceptance Criteria**:

1. O produto SHALL NOT expor ranking, liga, placar, percentil entre alunos ou qualquer posição relativa no
   lançamento.
2. A **única** comparação apresentada SHALL ser do aluno **com ele mesmo** (ponto de partida × hoje).
3. WHEN o produto exibir qualquer número derivado de outros alunos (ex.: dificuldade real de uma questão),
   THEN ele SHALL ser **agregado e anônimo**, respeitando o piso de respondentes do M7 (AD-046), e SHALL
   NOT identificar nem posicionar o aluno.

**Independent Test**: Varrer todas as telas do MVP e não encontrar nenhuma posição comparativa entre
alunos.

---

### P3: Grupo privado de responsabilidade (opt-in)

**User Story**: Como aluno, quero, no futuro, um grupo fechado com pessoas que eu escolher, sem ranking,
para me cobrar com quem eu confio.

**Why P3**: Fast-follow explícito; nunca expõe um aluno ao fracasso na frente de outro.

**Acceptance Criteria**:

1. O grupo SHALL ser **opt-in** e criado pelo próprio aluno.
2. O grupo SHALL NOT ter placar, disputa nem exibição de quem está pior.
3. Compartilhar progresso no grupo SHALL exigir ação explícita do aluno.

---

## Edge Cases

- WHEN o plano do dia não pôde ser gerado (falha do job do M4), THEN o dia SHALL NOT quebrar a sequência e
  SHALL NOT consumir escudo — falha nossa não pune o aluno; o caso SHALL ser alertado (AD-037).
- WHEN o aluno cumpre o piso **depois** da virada do dia no fuso dele, THEN aquilo SHALL contar para o dia
  novo, SHALL NOT ser retroagido ao anterior.
- WHEN o aluno troca de fuso horário, THEN a sequência SHALL usar o fuso vigente declarado e SHALL NOT
  quebrar pela troca em si.
- WHEN o aluno responde questões mas **não fecha nenhum bloco**, THEN o anel SHALL refletir o parcial e a
  sequência SHALL NOT ser mantida (piso não cumprido é piso não cumprido).
- WHEN uma questão do plano está **anulada** ou foi retirada de circulação (M1/M2), THEN o bloco SHALL
  poder fechar sem ela, SHALL NOT travar o aluno num item impossível.
- WHEN o aluno erra e escolhe **"não sei dizer"** como causa, THEN isso SHALL contar como causa declarada
  para efeito de fechar o bloco (é resposta válida, AD-043).
- WHEN o aluno usa a app pela primeira vez (sem histórico), THEN os quatro sinais SHALL exibir estado
  inicial explícito, SHALL NOT mostrar zero como se fosse fracasso.
- WHEN a matrícula vence (M8/AD-055), THEN a sequência SHALL ser **preservada no histórico** e SHALL NOT
  ser contabilizada como quebra pelos dias sem acesso; renovar SHALL retomá-la.
- WHEN o job de projeção do hábito falha, THEN os sinais SHALL ficar defasados (não corrompidos) e a falha
  SHALL ser visível/alertada; rerodar SHALL reconstruir os mesmos valores.
- WHEN o aluno pede exclusão dos dados (M7/AD-029), THEN os sinais de hábito SHALL desaparecer com o
  grupo 1, SHALL NOT sobreviver de forma identificável.

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| GAM-01 | P1: Quatro sinais separados, nunca um índice único (AD-023) | Design | Pending |
| GAM-02 | P1: Sequência de barra baixa = `piso` do plano, entregue pelo sistema (AD-023) | Design | Pending |
| GAM-03 | P1: Sinal "no prazo" anti-acomodamento, não congelável (AD-023/AD-024) | Design | Pending |
| GAM-04 | P1: Progresso desde o ponto de partida; nunca é a moeda do hábito (AD-023/AD-017) | Design | Pending |
| GAM-05 | P2: Perdão — compromisso com a agenda + folga programada (AD-024) | Design | Pending |
| GAM-06 | P2: Notificação leve, tom de treinador, nunca mentir, consentimento fora do app (AD-025/AD-026) | Design | Pending |
| GAM-07 | P1: Anel com **teto na `meta_cheia`**, sem métrica de volume (AD-025) | Design | Pending |
| GAM-08 | P2/P3: 100% solo, sem ranking; social opt-in futuro (AD-025) | Design | Pending |
| GAM-09 | P2: Escudos por constância, teto 2, gasto automático (AD-058) | Design | Pending |
| GAM-10 | P2: Reset suave = congela + janela de recuperação, nunca a zero (AD-059) | Design | Pending |
| GAM-11 | P1: Anti-clique **sem trava de tempo** — anel por bloco concluído + causa declarada (AD-060) | Design | Pending |
| GAM-12 | P1: "No prazo" sem `data_prova` = ritmo de avanço; troca sozinho quando a data existe (AD-061) | Design | Pending |
| GAM-13 | P1: Hábito é **projeção** recalculável; M6 nunca escreve em `tentativas` (AD-042/AD-044) | Design | Pending |
| GAM-14 | P1: Anel e sequência calculados **na hora** (abertura da tela); progresso e histórico por job (AD-071) | Design | Pending |

**ID format:** `GAM-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 14 requisitos, 0 mapeados a tasks (Specify), 0 sem cobertura de story.

---

## Success Criteria

- [ ] Os quatro sinais aparecem separados; nenhuma tela do MVP resume o aluno num número só.
- [ ] Cumprir só o piso nos dias da agenda declarada mantém a sequência perfeita por semanas.
- [ ] Perder um dia com escudo não quebra nada; perder sem escudo tropeça, mostra a janela e volta do mesmo
      número ao cumprir a meta cheia — em nenhum caminho a sequência vai a zero.
- [ ] Responder muito além do plano não move o anel além da meta cheia.
- [ ] Nenhuma resposta é descartada por tempo; um bloco com erro sem causa declarada não fecha.
- [ ] Um aluno acomodado vê a sequência intacta **e** o "no prazo" em alerta, ao mesmo tempo.
- [ ] Sem data de prova, o "no prazo" fala de ritmo e não inventa prazo; quando a data entra no perfil, ele
      muda sozinho.
- [ ] No máximo um lembrete por dia, no horário declarado, e nenhum fora do app sem consentimento.
- [ ] Nenhuma tela mostra posição comparada a outro aluno.
