# M5 — Raio-X da Banca · Especificação

> 🧭 **Spec temática — fonte de requisito, não unidade de implementação.** A ordem de construção é a
> de [`.specs/ROADMAP.md`](../../ROADMAP.md); estes requisitos são construídos pelas specs numeradas
> em `.specs/features/NN-*/`. Aqui mora o **texto** do requisito; lá mora **quando** ele entra.
> M5 → specs **26, 27, 34, 38**. As specs 26 e 27 são **pré-lançamento** (AD-076 exige a conta do
> Raio-X ligada desde o dia 1).

> Fonte: `PRD.md` §M5, §4.1, §7.3, §9, §10 (riscos 1 e 11); `docs/historico/DECISOES-TECNICAS.md` D19–D22.
> Decisões: AD-019, AD-020, AD-021, AD-022. Herda contratos: **AD-039/AD-040** (questão:
> `origem`, `status`, `anulada`, `materia_id`/`topico_id`, `fonte_citacao` com banca/ano —
> o Raio-X é projeção **sobre o schema de `questoes` do M1**), **AD-035/AD-036** (job em
> pg_cron / trabalho pesado fora do serverless), **AD-037** (falha visível/alertada),
> **AD-046** (piso de anonimato — não se aplica aqui, ver AC de privacidade).
> Gray zone resolvida em Discuss (2026-07-23): **AD-056** (fórmula: decaimento por ano +
> amortecimento por baixa amostra), **AD-057** (teto do empurrão e corte núcleo/condicional,
> ambos por posição). Os dois **refinam o AD-020**, que estava `[provisório]`.
> **AD-066** confirma que as histórias **P1 desta spec são MVP** — o `PRD.md` §4.1 dizia
> "Raio-X pode ser só frequência real, sem multi-sinal completo" e foi corrigido: o Raio-X é a
> primeira tela e o argumento de venda, e a matemática é barata. Seguem fast-follow apenas
> **RAIOX-07** (tela de curadoria do empurrão) e **RAIOX-09/10** (formato e diff de edital).
> Registrado junto: **a qualidade do Raio-X vem do acervo, não da fórmula** — a ingestão do M1
> é o caminho crítico deste módulo.

## Problem Statement

O plano diário (M4) multiplica "quanto o assunto cai" pela "fraqueza do aluno". O Raio-X é quem produz
o primeiro fator. A trava do tema é que **a banca do BB ainda não foi definida** (risco nº1, confirmado
aberto) — então o Raio-X precisa dar uma resposta útil **antes** de saber quem vai fazer a prova, e virar
a chave sem retrabalho no dia do anúncio. A solução é conteúdo-primeiro: um esqueleto único de assuntos
(o edital verticalizado) com **uma coluna de peso por banca**, e uma **visão combinada** enquanto a banca
é desconhecida. O Raio-X é **projeção recalculável sobre o acervo** — nunca um número congelado, nunca
uma opinião. A armadilha a evitar: se ele contasse questão inédita gerada por IA, encher o banco de um
assunto inflaria artificialmente o "quanto cai" e o produto passaria a mandar o aluno estudar o que **nós**
geramos, não o que a banca cobra.

## Goals

- [ ] Todo assunto do edital tem uma nota "quanto cai" calculada só a partir de **prova real**, como taxa,
      com ano recente pesando mais — pronta para o motor de prioridade do M4 consumir.
- [ ] Com a banca indefinida, o aluno já vê **núcleo** (seguro em qualquer banca) separado de
      **condicional** (rotulado "depende da banca") e estuda o que importa desde já.
- [ ] Assunto emergente sobe (Pix, DREX), mas com **teto** auditável, sem passar na frente do que cai
      todo ano — e assunto novo no edital com frequência zero tem uma faixa própria.
- [ ] Assunto com pouca amostra não vira prioridade por coincidência estatística.
- [ ] Quando a banca for anunciada, virar a chave é **trocar a coluna ativa** no perfil de concurso e
      passar o edital novo por diff — no mesmo dia, sem reconstruir nada.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| Radar automático de internet / varredura de notícias | **Rejeitado** em D21/AD-021 — caro e ruidoso para um problema pequeno e visível |
| Camada de **formato/estilo** (A–E × Certo-Errado, "uma errada anula uma certa") | Fica **na gaveta** (AD-022) — só resolve com a banca definida; P3 aqui, execução em M4/simulado |
| Motor de prioridade e montagem do plano | É M4 (M5 **entrega o fator**, não decide o que o aluno estuda) |
| Fraqueza do aluno, domínio, caderno | É M4 — o Raio-X **não lê `tentativas`** (ver RAIOX-14) |
| Extração/classificação/curadoria de questão | É M1 (M5 só **lê** o que está publicado e **consome** a flag de baixa confiança) |
| Dificuldade real calibrada pelo uso | É M7 grupo 2 (alimenta M4, não o Raio-X) |
| Construção da base de referência | É M2 (M5 só **ordena a fila** dela por frequência real) |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| "Ano recente pesa mais" | **Decaimento gradual por ano** (fator de decaimento em configuração); nenhum ano vira zero | Discuss 2026-07-23 → **AD-056**; banca muda devagar, corte brusco descarta acervo curado | **y** |
| Teto do empurrão de atualidade | **Teto por posição** — o empurrão SHALL NOT levar o assunto ao topo (percentil de corte em config); só a faixa especial passa | Discuss 2026-07-23 → **AD-057**; auditável na tela e independente da escala da nota | **y** |
| Critério de "cai forte" numa banca | **Corte por posição dentro da própria banca** (percentil em config); forte nas 3 = núcleo, forte em 1–2 = condicional | Discuss 2026-07-23 → **AD-057**; se auto-ajusta a bancas com acervo grande ou pequeno | **y** |
| Assunto com poucas questões | **Amortecimento**: taxa puxada em direção à média geral, proporcional ao tamanho da amostra + rótulo "pouca amostra" na tela | Discuss 2026-07-23 → **AD-056**; taxa de 3 aparições em 10 anos pode ser coincidência | **y** |
| Valor do fator de decaimento por ano | Config (meia-vida inicial conservadora, ex.: ~5 anos) | Risco #11: "número exato = afinação de spec, não arquitetura" | n (calibra) |
| Percentil de corte núcleo/condicional | Config (início no terço superior de cada banca) | Idem | n (calibra) |
| Percentil-teto do empurrão | Config (início: empurrão não entra no decil superior) | Idem | n (calibra) |
| Constante do amortecimento (`k`) e piso de `n_questoes` para o rótulo | Config | Idem | n (calibra) |
| **Questão `anulada` na frequência** | **Conta** na taxa (a banca **cobrou** aquele assunto naquela prova) e **não** vira treino (contrato do M4) | Frequência mede o que a banca pergunta, não o que é respondível; a anulação é defeito do item, não do assunto | n (default registrado) |
| Janelas de `tendencia` | Compara janela recente × janela anterior (tamanhos em config); saída em `{subindo, estavel, caindo}` | D19 item 5 pede a direção, não a magnitude | n (calibra) |
| Escopo de bancas na coluna | Cesgranrio, FGV, Cebraspe (AD-009); coluna nova = linha de config, sem migração de esquema | Fase 1 cobre o BB em qualquer cenário | y |
| Recálculo do Raio-X | Job agendado (pg_cron), **não** ao vivo; defasagem de horas é aceitável | Invariante #7 (pré-computa) e AD-035 | y |
| Validade do empurrão de atualidade | Todo empurrão tem **data de validade** e expira sozinho se não for renovado | Impede que achismo de 2026 continue pesando em 2029 sem ninguém reavaliar | n (default registrado) |
| Ator da curadoria | Mesmo papel único **operador de conteúdo** do M1 | Time de 3; separar papéis é refino de M8 | y (coerente c/ M1) |

**Open questions:** none — os quatro números provisórios do AD-020 foram fechados em Discuss; o que resta
acima é calibração de parâmetro, registrada com default e local (configuração).

---

## User Stories

### P1: Frequência real como taxa, só de prova real ⭐ MVP

**User Story**: Como plataforma, quero calcular quanto cada assunto cai por banca, contando **apenas**
questões reais e como **taxa**, para que o "quanto cai" reflita a banca e não o nosso acervo.

**Why P1**: É o fosso e o fator que o plano do M4 multiplica. Sem ele o plano não tem direção.

**Acceptance Criteria**:

1. WHEN o Raio-X calcula a taxa de um tópico numa banca, THEN o sistema SHALL considerar **somente**
   questões com `origem='real'` **e** `status='publicada'`; questão `origem='gerada_ia'` SHALL NOT entrar
   no cálculo em nenhuma hipótese (invariante anti-viés).
2. O valor SHALL ser uma **taxa** — a participação do tópico **dentro das questões daquela banca** — e
   SHALL NOT ser contagem bruta, de modo que ter mais provas de uma banca não distorça a comparação.
3. WHEN a taxa é calculada, THEN cada questão SHALL entrar com **peso decrescente conforme o ano fica mais
   antigo** (decaimento gradual, fator em configuração); nenhum ano do acervo SHALL ser descartado por
   corte de janela (AD-056).
4. Cada linha do Raio-X SHALL persistir `n_questoes` (quantas questões reais sustentam a taxa) e
   `tendencia ∈ {subindo, estavel, caindo}`.
5. O Raio-X SHALL ser **recalculável do zero** a partir do acervo, por job agendado; SHALL NOT ser
   editável à mão como número (o único ajuste humano permitido é o empurrão registrado — RAIOX-06/07).

**Independent Test**: Publicar 50 inéditas de um tópico e confirmar que a taxa dele não muda; publicar 1
prova real recente e confirmar que a taxa se move mais do que moveria uma prova de 10 anos atrás.

---

### P1: Amortecimento por amostra pequena ⭐ MVP

**User Story**: Como aluno, não quero que um assunto que apareceu 3 vezes em 10 anos apareça como
prioridade máxima só porque a conta deu alto.

**Why P1**: Sem isso, o motor do plano manda o aluno gastar semanas num assunto raro por coincidência.

**Acceptance Criteria**:

1. WHEN `n_questoes` de uma linha é baixo, THEN a taxa usada na ordenação SHALL ser **puxada em direção à
   média geral dos tópicos daquela banca**, com a força do puxão **inversamente proporcional ao tamanho da
   amostra** (constante em configuração) — quanto menos amostra, mais perto da média (AD-056).
2. WHEN `n_questoes` está abaixo do piso configurado, THEN a linha SHALL ser marcada `amostra_baixa=true` e
   a interface SHALL exibir o rótulo de pouca amostra junto do número.
3. O amortecimento SHALL NOT eliminar o tópico do Raio-X nem do plano — ele SHALL continuar elegível, com
   nota menos extrema.
4. WHEN `n_questoes = 0` **e** o tópico está no edital, THEN a nota SHALL ser a da média amortecida (não
   zero) — estar no edital nunca zera (D19 item 3); zerar é atribuição exclusiva do porteiro (RAIOX-06).

**Independent Test**: Semear um tópico com 3 questões e taxa bruta altíssima e confirmar que ele não
aparece entre os prioritários e que a tela mostra "baseado em poucas questões".

---

### P1: Visão combinada núcleo × condicional (banca indefinida) ⭐ MVP

**User Story**: Como aluno do BB sem banca definida, quero saber o que é seguro estudar agora e o que
depende de quem for a banca, para não parar de estudar esperando o edital.

**Why P1**: É a resposta ao risco nº1 e o argumento de venda do produto antes do edital.

**Acceptance Criteria**:

1. WHEN a `banca` do perfil de concurso é `indefinida`, THEN o Raio-X SHALL produzir a **visão combinada**
   sobre as três colunas, classificando cada tópico em `nucleo` ou `condicional`.
2. Um tópico SHALL ser considerado **forte** numa banca quando estiver **acima do corte de posição dentro
   daquela mesma banca** (percentil em configuração) — SHALL NOT ser um limite de porcentagem absoluta
   igual para as três, para não penalizar banca com prova curta (AD-057).
3. WHEN um tópico é forte nas **três** bancas, THEN SHALL ser classificado `nucleo` e receber prioridade
   máxima; WHEN é forte em **uma ou duas**, THEN SHALL ser `condicional`, com peso menor e **rótulo
   visível** de que depende da banca.
4. A classificação SHALL ser exibida ao aluno como **duas faixas nomeadas**, SHALL NOT ser colapsada num
   número único que esconda a incerteza.
5. WHEN a banca do perfil está **definida**, THEN a visão combinada SHALL dar lugar à **coluna daquela
   banca**, e o rótulo "depende da banca" SHALL desaparecer.

**Independent Test**: Com a banca indefinida, ver um tópico forte nas 3 marcado como núcleo e um forte só
na Cebraspe marcado como condicional; definir a banca como Cebraspe e ver o segundo subir.

---

### P1: Três sinais separados — porteiro, motor e empurrão com teto ⭐ MVP

**User Story**: Como plataforma, quero que edital, frequência e atualidade entrem por portas diferentes,
para que achismo nunca vire frequência disfarçada.

**Why P1**: É a política central do AD-019/AD-020 e o que protege o método.

**Acceptance Criteria**:

1. O **edital** SHALL funcionar como **porteiro binário**: tópico fora do programa oficial SHALL receber
   nota **zero** e SHALL NOT entrar no plano, por mais que tenha caído no passado; tópico dentro SHALL ser
   elegível. O edital SHALL NOT contribuir com intensidade (não dá nota).
2. A **frequência real** (P1 acima) SHALL ser o **motor da ordem** entre os elegíveis.
3. A **atualidade** SHALL ser um **empurrão com teto por posição**: o empurrão SHALL NOT levar o tópico
   acima do percentil-teto configurado da lista, de modo que assunto emergente apareça no radar sem, de
   rotina, passar na frente do que cai todo ano (AD-057).
4. Todo empurrão de atualidade SHALL ser **registrado e auditável** — quem aplicou, por quê, quando e até
   quando vale — e SHALL ser **reversível** em um passo.
5. WHEN o prazo de validade de um empurrão vence, THEN ele SHALL deixar de ser aplicado automaticamente e o
   tópico SHALL voltar à ordem que a frequência real determina.
6. WHEN um tópico é **recém-incluído no edital** *E* **sinalizado** na curadoria, THEN ele SHALL entrar na
   **faixa especial** (alta prioridade apesar de frequência zero) — SHALL exigir as **duas** condições
   juntas, nunca uma só, e essa é a **única** via que ultrapassa o percentil-teto do item 3.
7. Os três sinais SHALL ficar visíveis separadamente na tela interna; o sistema SHALL NOT expor apenas um
   número opaco que impeça auditar de onde veio a ordem.

**Independent Test**: Marcar "hype de cursinho" num tópico fora do edital e ver a nota permanecer zero;
aplicar empurrão num tópico elegível e confirmar que ele sobe mas não entra no topo; incluir esse mesmo
tópico no edital como novo + sinalizado e ver a faixa especial levá-lo ao alto, com registro de quem fez.

---

### P1: Perfil de concurso — uma app, multi-concurso ⭐ MVP

**User Story**: Como plataforma, quero que órgão, banca, edital, data da prova e formato vivam num
**perfil de concurso**, para que mudar esses campos re-mire o produto inteiro sem código novo.

**Why P1**: É o que permite atravessar o anúncio da banca e, depois, atender outro concurso na mesma app
(AD-022).

**Acceptance Criteria**:

1. O sistema SHALL persistir `perfil_concurso` com `orgao`, `banca` (aceitando o valor **`indefinida`**),
   `programa_edital`, `data_prova` (aceitando vazio) e `formato`.
2. WHEN a `banca` do perfil muda, THEN as telas e o plano SHALL passar a ler a **coluna daquela banca** no
   recálculo seguinte, SHALL NOT exigir reconstrução do esqueleto de assuntos nem migração de dados.
3. WHEN o perfil muda, THEN as `tentativas` já gravadas SHALL permanecer intactas (snapshot congelado,
   AD-042) — a mudança afeta projeções e plano, nunca o histórico.
4. WHEN `data_prova` está vazia, THEN o produto SHALL funcionar integralmente sem contagem regressiva
   (M6 trata o efeito no sinal "no prazo").
5. O sistema SHALL suportar **mais de um perfil de concurso** no mesmo banco de assuntos, sem duplicar
   questões nem taxonomia.

**Independent Test**: Trocar a banca de `indefinida` para `FGV` num ambiente semeado e ver o plano do dia
seguinte reordenar sem nenhuma alteração de código nem perda de histórico.

---

### P2: Sinal de atualidade sem radar — 3 camadas + tela de curadoria

**User Story**: Como operador, quero uma fila de "candidato a tópico novo" alimentada de graça pelo próprio
banco, mais uma tela para registrar o que está em alta, para captar assunto emergente sem construir um
varredor de notícias.

**Why P2**: O sinal #3 é um filete de assuntos por ano e tem rede dupla — se ninguém marcar, a frequência
real captura quando o assunto cair (AD-021). Não bloqueia o lançamento.

**Acceptance Criteria**:

1. WHEN a classificação do M1 devolve **baixa confiança** ou não encaixa o item na taxonomia, THEN o
   sistema SHALL registrar um **candidato a tópico novo** na fila, com a prova de origem e exemplos.
2. O sistema SHALL oferecer uma **tela de curadoria** onde o operador aprova/rejeita candidatos e registra
   um item de atualidade em poucos campos: assunto, situação, tamanho do empurrão (dentro do teto),
   justificativa e validade.
3. O sistema SHALL NOT fazer busca na internet nem varredura automática de notícias em nenhum ponto do
   MVP (decisão registrada; nova superfície exige novo AD).
4. WHEN a passagem de edital humana marca um tópico como recém-incluído, THEN esse fato SHALL ficar
   gravado no perfil (é o que habilita a faixa especial da RAIOX-06).

**Independent Test**: Forçar uma classificação de baixa confiança no M1 e ver o item aparecer na fila de
candidatos; aprovar e registrar um empurrão, e conferir a trilha de auditoria completa.

---

### P2: Fila da base de referência ordenada por frequência

**User Story**: Como operador, quero que a fila de construção da base de referência (M2) venha ordenada
pelo que mais cai, para investir curadoria onde ela rende mais.

**Why P2**: Contrato já assumido pelo M2 (IA-05, AC3); é uma leitura do Raio-X, barata de entregar.

**Acceptance Criteria**:

1. O sistema SHALL expor a ordenação dos tópicos por frequência real (já amortecida) para consumo do M2.
2. WHEN um tópico sobe na ordem, THEN a fila SHALL refletir a nova posição no recálculo seguinte, SHALL NOT
   exigir reordenação manual.

**Independent Test**: Subir a taxa de um tópico e ver a fila da base de referência reordenar sozinha.

---

### P3: Pivot do edital por diff (dia do anúncio)

**User Story**: Como operador, quero que o edital novo seja processado por comparação com o anterior,
conferindo só o que mudou, para virar a chave no mesmo dia do anúncio.

**Why P3**: Só executa quando o edital sair; o produto funciona sem isso (AD-022 chamou de fast-follow).

**Acceptance Criteria**:

1. WHEN um edital novo é submetido, THEN o sistema SHALL extrair o programa com **citações** e SHALL
   comparar com o programa vigente por **similaridade de embedding**, produzindo um **diff** (entrou /
   saiu / mudou de redação).
2. O operador SHALL conferir **apenas o diff**, não o edital inteiro; nenhuma mudança de porteiro SHALL ser
   aplicada sem confirmação humana.
3. WHEN o diff é aprovado, THEN o novo programa SHALL propagar para o porteiro e o Raio-X SHALL ser
   recalculado, preservando o histórico por snapshot (AD-042).
4. WHEN um tópico **sai** do edital, THEN ele SHALL ir a zero no plano a partir do recálculo, e as
   tentativas antigas naquele tópico SHALL permanecer no histórico.

**Independent Test**: Submeter uma versão do edital com dois itens novos e um removido e ver o operador
receber exatamente três linhas para conferir.

---

### P3: Módulo de formato na gaveta (A–E × Certo/Errado)

**User Story**: Como plataforma, quero os módulos de formato prontos e desligados, para ligar o certo no
dia em que a banca for anunciada.

**Why P3**: Não combina entre bancas (AD-019 item 6); só resolve com a banca definida.

**Acceptance Criteria**:

1. O sistema SHALL manter o `formato` no perfil de concurso e SHALL selecionar o módulo correspondente
   (múltipla escolha A–E ou Certo/Errado com a regra de compensação) por **configuração/flag**.
2. WHEN a banca é indefinida, THEN o produto SHALL entregar o núcleo universal de "fazer a prova"
   (reaproveitando a causa de erro do M4, AD-043) e SHALL NOT forçar treino num formato específico.

**Independent Test**: Trocar o `formato` do perfil e ver o simulado do M4 mudar de A–E para Certo/Errado
sem alteração de código.

---

## Edge Cases

- WHEN um tópico está no edital mas **nunca** caiu (`n_questoes = 0`), THEN ele SHALL receber a nota
  amortecida (média), SHALL NOT receber zero — zero é exclusividade do porteiro (fora do programa).
- WHEN uma banca tem acervo muito fino (poucas provas ingeridas), THEN as linhas daquela coluna SHALL vir
  majoritariamente com `amostra_baixa=true`, e o peso do edital e da atualidade SHALL, na prática, decidir
  mais — comportamento esperado e registrado (D19 item 7, risco de banca com pouco acervo).
- WHEN o acervo está **vazio** (antes da primeira ingestão), THEN o Raio-X SHALL devolver todas as linhas
  do edital com a nota amortecida e `amostra_baixa=true`, SHALL NOT falhar nem devolver lista vazia.
- WHEN uma questão é **reclassificada** no M1 (muda de tópico), THEN o recálculo seguinte SHALL refletir a
  nova classificação; o histórico do aluno SHALL NOT se deslocar (snapshot, AD-042).
- WHEN uma questão ganha **nova versão** (AD-039), THEN ela SHALL contar **uma vez só** na frequência
  (versões da mesma questão não somam).
- WHEN a mesma questão aparece em duas provas (duplicata confirmada no M1, BANCO-06), THEN a frequência
  SHALL contar a **canônica** uma vez por prova em que apareceu, SHALL NOT contar a vinculada em dobro.
- WHEN o job de recálculo do Raio-X falha, THEN a projeção anterior SHALL continuar servindo (defasada, não
  corrompida) e a falha SHALL ser visível/alertada (INFRA-09/AD-037); rerodar SHALL produzir o mesmo
  resultado (idempotente).
- WHEN o operador tenta aplicar um empurrão **acima do teto**, THEN o sistema SHALL recusar e SHALL exibir
  o limite — o teto SHALL NOT ser contornável pela tela.
- WHEN um tópico é sinalizado como emergente **e** já cai muito, THEN o empurrão SHALL ser irrelevante (ele
  já está acima do teto pela frequência) — SHALL NOT somar vantagem em cima.
- WHEN dois recálculos rodam ao mesmo tempo, THEN a projeção resultante SHALL ser consistente (uma execução
  por vez, por trava), SHALL NOT gravar mistura de duas execuções.

---

## Rodada 2026-09-05 — o denominador era o acervo (AD-138/AD-139/AD-140)

> Entra pelas specs **37** e **39**. O AD-138 **revoga o AC2 da RAIOX-04** e o denominador único
> assumido em AD-020/AD-056. O decaimento por ano, o amortecimento e o `amostra_baixa` (AD-056)
> continuam valendo, agora **dentro da matéria**; os cortes por posição (AD-057) seguem intactos.

### P1: Peso em dois níveis — matéria oficial × distribuição estimada ⭐ MVP

**User Story**: Como plataforma, quero que o peso da matéria venha do documento oficial e só a
distribuição interna seja estimada, para que o Raio-X pare de depender de quantas questões foram
ingeridas.

**Why P1**: É a correção do defeito central. Com o nível 1 vindo do documento, um concurso com acervo
fino já tem o peso de matéria certo e a incerteza fica confinada e limitada.

**Acceptance Criteria**:

1. O sistema SHALL calcular `peso(assunto) = peso_oficial(matéria) × share(assunto | matéria)`.
2. O `peso_oficial(matéria)` SHALL vir da grade declarada pela prova ou pelo edital (BANCO-15) e
   SHALL NOT ser derivado da contagem de questões ingeridas.
3. O `share(assunto | matéria)` SHALL ser estimado somente de itens de `origem='real'`, SHALL receber
   o amortecimento do AD-056 tomando como âncora a **média daquela matéria**, e a soma dos shares
   dentro de uma matéria SHALL ser 1.
4. WHEN uma matéria não tem nenhum item etiquetado, THEN seus assuntos elegíveis SHALL dividir o peso
   oficial da matéria em partes iguais e SHALL ser marcados `amostra_baixa=true`.
5. O porteiro binário do edital (RAIOX-06 AC1) SHALL continuar valendo: assunto fora do programa
   vigente SHALL receber zero antes de qualquer multiplicação.

**Independent Test**: Zerar as questões de uma matéria e confirmar que o peso da matéria não muda e
que os assuntos dela passam a dividir esse peso em partes iguais, com rótulo de pouca amostra.

---

### P1: A prova é a unidade de medida ⭐ MVP

**User Story**: Como plataforma, quero que cada prova produza a taxa dela e só depois as provas sejam
combinadas, para que uma prova ingerida pela metade não desloque as outras.

**Why P1**: É o que impede que o esforço de digitação vire sinal de banca.

**Acceptance Criteria**:

1. O sistema SHALL calcular a taxa **dentro de cada prova** e SHALL agregar entre provas pela **média
   ponderada** pelo decaimento por ano (AD-056), SHALL NOT somar itens de provas diferentes num
   denominador único.
2. WHEN a `cobertura` de uma prova está abaixo do piso configurado, THEN ela SHALL NOT entrar no
   cálculo e SHALL aparecer na lista de provas pendentes de ingestão.
3. Cadernos irmãos da mesma prova (BANCO-16 AC6) SHALL entrar **uma vez só**.
4. O sistema SHALL persistir, por linha do Raio-X, **quantas provas** e **quais anos** a sustentam.
5. O Raio-X SHALL continuar recalculável do zero e idempotente (RAIOX-14), e SHALL NOT ler
   `tentativas`.

**Independent Test**: Ingerir 40 itens de uma prova e 15 de outra do mesmo ano e confirmar que as duas
pesam igual; baixar a cobertura de uma abaixo do piso e ver a linha citar só a outra.

---

### P1: Degraus de lastro e granularidade honesta ⭐ MVP

**User Story**: Como aluno, quero saber em que evidência cada número se apoia e não quero ver decimal
inventado quando não há prova suficiente.

**Why P1**: É o que faz o Raio-X parecer pesquisado sem mentir, e é a diferença entre um concurso com
10 provas e um recém-aberto.

**Acceptance Criteria**:

1. Cada linha do Raio-X SHALL registrar um **degrau de lastro**: `1` provas do próprio concurso, `2`
   grade do edital sem provas, `3` provas da mesma banca em outro órgão, `4` sem dado.
2. WHERE o degrau é `3`, o sistema SHALL transferir **apenas a distribuição dentro da matéria** da
   banca de origem e SHALL NOT transferir o peso da matéria — o peso da matéria SHALL vir do
   documento do próprio concurso ou, na ausência dele, a linha SHALL cair para degrau `4`.
3. A tela SHALL exibir, por linha, o degrau e o lastro em texto — quantas provas, de quais anos e de
   qual origem.
4. WHILE o degrau de uma matéria é `2`, `3` ou `4`, a tela SHALL apresentar o resultado no nível da
   **matéria** e SHALL NOT exibir percentual por assunto dentro dela.
5. Linhas de degraus diferentes SHALL poder coexistir na mesma tela, cada uma com o seu rótulo.

**Independent Test**: Abrir um concurso só com edital e confirmar que a tela mostra peso por matéria,
rotula degrau 2 e não exibe nenhum percentual por assunto.

---

### P1: Raio-X por concurso, com o nome do edital do aluno ⭐ MVP

**User Story**: Como aluno da CAIXA, quero ver "Atendimento Bancário" como está no meu edital, e não o
nome que outro concurso usa para o mesmo conteúdo.

**Why P1**: Sem isso, multi-concurso mostra a cada aluno o edital de outra pessoa (AD-139).

**Acceptance Criteria**:

1. O sistema SHALL persistir, por concurso, a lista de matérias **com o nome e a ordem do edital
   daquele concurso**, e cada matéria SHALL apontar para um conjunto de assuntos canônicos.
2. A projeção do Raio-X SHALL ser calculada e persistida **por concurso**; SHALL NOT existir uma
   projeção única servindo todos.
3. WHEN o aluno abre o Raio-X, THEN a tela SHALL usar exclusivamente os nomes de matéria do concurso
   dele e SHALL NOT expor nome de assunto canônico nem nome de matéria de outro concurso.
4. WHEN um assunto canônico é renomeado ou reagrupado num concurso, THEN os demais concursos SHALL
   permanecer inalterados.
5. O mesmo assunto canônico SHALL poder pertencer a matérias de nomes diferentes em concursos
   diferentes, e o sistema SHALL NOT exigir que ele tenha o mesmo pai em todos.

**Independent Test**: Cadastrar CAIXA e BB, apontar o mesmo assunto canônico para matérias de nomes
diferentes nos dois, e confirmar que cada aluno vê o nome do edital dele.

---

### P1: Prontidão — concurso nasce oculto ⭐ MVP

**User Story**: Como plataforma, não quero mostrar um concurso cujo Raio-X aponta assunto que o plano
não tem como servir.

**Why P1**: O Raio-X mede sem acervo (é o ponto do AD-138), mas o plano não estuda sem questão. Sem
gate, o aluno entra num concurso vazio.

**Acceptance Criteria**:

1. O concurso SHALL nascer com visibilidade **oculta** e SHALL NOT aparecer na escolha do aluno.
2. WHEN a cobertura de conteúdo dos assuntos de maior peso atinge o piso configurado, THEN o concurso
   SHALL ficar **elegível** à publicação; a publicação em si SHALL exigir ação humana registrada.
3. O sistema SHALL exibir ao operador **quais** assuntos de alto peso estão sem questão suficiente.
4. IF um concurso publicado cai abaixo do piso, THEN ele SHALL NOT ser despublicado automaticamente e
   o operador SHALL ser alertado.

**Independent Test**: Abrir um concurso, calcular o Raio-X sem nenhuma questão e confirmar que ele não
aparece para o aluno e que o operador vê a lista do que falta.

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| RAIOX-01 | P1: Conteúdo-primeiro, esqueleto único e banca = coluna (AD-019) | Design | Pending |
| RAIOX-02 | P1: Visão combinada núcleo × condicional (AD-019) | Design | Pending |
| RAIOX-03 | P1: Três sinais separados, frequência real manda (AD-019/AD-020) | Design | Pending |
| RAIOX-04 | P1: Anti-viés — só `origem='real'`, como taxa (AD-019) | Design | Pending |
| RAIOX-05 | P1: `n_questoes` + `tendencia` por linha (AD-019) | Design | Pending |
| RAIOX-06 | P1: Edital porteiro binário + empurrão com teto + faixa nova-do-edital (AD-020) | Design | Pending |
| RAIOX-07 | P2: Sinal #3 sem radar (edital + banco + skim) e tela de curadoria (AD-021) | Design | Pending |
| RAIOX-08 | P1: Perfil de concurso / uma app multi-concurso (AD-022) | Design | Pending |
| RAIOX-09 | P3: Módulo de formato na gaveta (A–E × C/E) (AD-022) | Design | Pending |
| RAIOX-10 | P3: Pivot do edital por diff com conferência só do delta (AD-022) | Design | Pending |
| RAIOX-11 | P1: Taxa com **decaimento gradual por ano**, sem corte de janela (AD-056) | Design | Pending |
| RAIOX-12 | P1: **Amortecimento** por amostra pequena + rótulo `amostra_baixa` (AD-056) | Design | Pending |
| RAIOX-13 | P1: Teto do empurrão **por posição** e corte núcleo/condicional **por posição dentro da banca** (AD-057) | Design | Pending |
| RAIOX-14 | P1: Raio-X é projeção recalculável do acervo, por job; **não lê `tentativas`** (AD-019/AD-035) | Design | Pending |
| RAIOX-15 | P2: Fila da base de referência (M2) ordenada por frequência real (AD-021/IA-05) | Design | Pending |
| RAIOX-16 | P1: Peso em dois níveis — matéria oficial × share dentro da matéria (AD-138) | Design | Pending |
| RAIOX-17 | P1: A prova é a unidade de medida; cobertura e caderno único (AD-138) | Design | Pending |
| RAIOX-18 | P1: Degraus de lastro, transferência só do desenho interno, granularidade honesta (AD-138) | Design | Pending |
| RAIOX-19 | P1: Projeção por concurso com o nome do edital do aluno (AD-139) | Design | Pending |
| RAIOX-20 | P1: Prontidão de conteúdo — concurso nasce oculto (AD-140) | Design | Pending |

**ID format:** `RAIOX-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 20 requisitos, 0 mapeados a tasks (Specify), 0 sem cobertura de story.

> **RAIOX-04 AC2 está revogado pelo AD-138.** A taxa não é mais participação dentro das questões da
> banca; é média por prova de `peso_oficial(matéria) × share(assunto | matéria)`. O restante da
> RAIOX-04 (só `origem='real'` e `status='publicada'`) permanece.

---

## Success Criteria

- [ ] Publicar centenas de inéditas não muda nenhuma taxa do Raio-X.
- [ ] Um tópico com 3 aparições em 10 anos não aparece entre os prioritários, e a tela diz por quê.
- [ ] Com a banca indefinida, o aluno vê núcleo e condicional separados e com rótulo explícito.
- [ ] Tópico fora do edital fica em zero mesmo tendo caído muito no passado.
- [ ] Nenhum empurrão de atualidade coloca um assunto no topo; só a faixa "novo no edital + sinalizado"
      chega lá, e todo empurrão tem autor, motivo e validade registrados.
- [ ] Trocar `banca` de `indefinida` para uma das três reordena o plano no dia seguinte, sem migração e
      sem tocar no histórico.
- [ ] Apagar a tabela do Raio-X e recalculá-la do acervo devolve exatamente os mesmos números.
- [ ] Nenhuma consulta do Raio-X toca `tentativas` (auditável no código).
