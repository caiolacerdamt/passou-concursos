# M3 — Áudio / TTS das Explicações · Especificação

> Fonte: `PRD.md` §M3, §4.2, §7.1, §10 (risco 4); `docs/historico/DECISOES-TECNICAS.md` D14 (partes A e B).
> Decisões: AD-014. Herda contratos: **AD-052/IA-09** (explicação amarrada a `questao_versao`,
> com versão e `status` próprios; mudança **substantiva** invalida, **cosmética** não),
> **AD-039/AD-040** (questão: `id` + `questao_versao`, `alternativas`, `tipo_questao`,
> `imagens`), **AD-036** (fábrica em scripts standalone disparados por GitHub Actions —
> nunca em função da Vercel), **AD-035** (Supabase Storage), **AD-037** (falha visível e
> alertada), **AD-019/RAIOX-15** (ordem por frequência real).
> Gray zone resolvida em Discuss (2026-07-23): **AD-062** (teste cego da voz é **porteiro do
> primeiro lote**), **AD-063** (o áudio lê **questão + explicação** num arquivo contínuo),
> **AD-064** (M3 é **fast-follow**, atrás de flag), **AD-065** (ElevenLabs principal, slot de
> reserva **em standby**; entrantes novos e custo revisado do lote). Os quatro **refinam o
> AD-014**, que permanece.

## Problem Statement

O aluno concurseiro estuda em deslocamento, e a explicação escrita não serve nessa hora. O áudio é
gerado **uma única vez por explicação** e guardado, então **latência não importa** e o critério passa a ser
qualidade máxima. O risco específico deste produto é a voz **ler número ou sigla errado** — "R$ 1.250,00",
"12,5%", "CDB", "Selic", "IOF" — porque num conteúdo bancário isso não é um detalhe de sotaque, é ensinar
errado. Por isso existe um passo de **normalização antes da voz**, e não se confia no ranking de qualidade
do provedor para resolver. Duas amarras herdadas mandam no ciclo de vida: o áudio **morre junto** com a
explicação que ele narra, e a voz precisa estar **decidida e travada** antes de qualquer geração em lote —
trocar a voz depois obriga refazer tudo.

## Goals

- [ ] Toda explicação com áudio tem a leitura correta de números, valores, percentuais e siglas — validada
      pela normalização, não pela sorte do provedor.
- [ ] O áudio narra **a questão inteira e a explicação** num arquivo contínuo, de modo que dê para estudar
      sem olhar a tela.
- [ ] Um áudio nunca sobrevive à explicação que ele narra: mudança substantiva descarta e refaz.
- [ ] A camada de voz é trocável por configuração — nenhum requisito, teste ou código cita provedor ou voz.
- [ ] Nenhuma geração em lote acontece antes da voz estar escolhida por teste cego e registrada.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
| ------- | ------ |
| Voz ao vivo / narração sob demanda no pedido do aluno | **Nunca** (D14) — contraria pré-computa (AD-010) e destrói a previsibilidade de custo |
| Geração e revisão do **texto** da explicação | É M2 (M3 consome o texto aprovado e o sinal de invalidação) |
| Escolha final da voz específica | **Tarefa humana** de escuta, fora da spec — a spec só define que ela **trava o lote** (AD-062) |
| Dublagem, múltiplas vozes, entonação dramática, efeitos | Fora do desenho (uma voz só, consistente) |
| Transcrição / voz do aluno (fala para o app) | Não existe no produto |
| Descrição automática de imagem, gráfico ou tabela em áudio | Fora do MVP — questão com imagem não recebe áudio (ver assumption) |
| Download offline / player avançado | Refino de front-end; o MVP serve o arquivo do Storage |
| Ordem de prioridade da fila (qual assunto primeiro) | É M5 (RAIOX-15) — M3 apenas **consome** a ordem |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido.

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| Pendência da voz específica | Voz vive em **configuração**; o **teste cego trava o primeiro lote** — nenhuma geração em massa antes de uma voz travada e registrada com data e critério | Discuss 2026-07-23 → **AD-062**; gerar antes e trocar depois obriga refazer todo o acervo | **y** |
| O que o áudio narra | **Um arquivo contínuo**: enunciado + alternativas + explicação | Discuss 2026-07-23 → **AD-063**; é o único formato que serve para estudar sem tela, que é a razão do módulo | **y** |
| Quando o M3 vai ao ar | **Fast-follow**, atrás de flag; pipeline pronto, geração roda depois que o acervo de explicações estabilizar | Discuss 2026-07-23 → **AD-064**; nas primeiras semanas a taxa de correção é máxima e cada correção paga o áudio de novo | **y** |
| Provedor de reserva | ElevenLabs `eleven_v3` principal (D14); slot de reserva **em standby**, deliberadamente vazio — a camada trocável é construída, a escolha fica para quando houver motivo | Discuss 2026-07-23 → **AD-065** | **y** |
| Custo do lote de lançamento | **Revisado**: com questão + explicação e ~10 mil questões (~18M caracteres), ElevenLabs sai por **~US$1.800–3.700**, não "centenas de USD" como o D14 estimava | Pesquisa de 2026-07-23; a mudança vem do AD-063 (2,5× mais caracteres) e de preço de lista atual | y (ordem de grandeza) / n (preços de fonte secundária) |
| Candidatos novos ao teste cego | Registrados: **Inworld TTS-1.5 Max** (~US$10/1M) e **Hume Octave 2** (~US$7,60/1M) — não existiam na rodada do D14 e **não têm qualidade em pt-BR verificada** | Pesquisa de 2026-07-23; decisão por escuta, nunca por tabela de preço | n (a verificar na rodada) |
| Questão com imagem, gráfico ou tabela | **Não recebe áudio** no MVP; fica marcada com o motivo e a tela informa que aquela questão é só de leitura | Áudio que omite a figura ensina errado; descrever imagem é outro problema | n (default registrado) |
| Questão `certo_errado` | `alternativas` é `null` (AD-040) → o roteiro narra o enunciado e a formulação de Certo/Errado, sem listar letras | Contrato de dados do M1 | y |
| Dicionário de siglas | Lista curada e **versionada** (CDB, LCI, LCA, Selic, IOF, FGC, BACEN, CMN, Pix, DREX…), com a versão gravada junto do áudio | D14 parte B; permite refazer o que foi narrado com dicionário velho | y |
| Falha da normalização | Se um valor numérico ou símbolo não puder ser convertido com segurança, a explicação **não vai para a voz** e entra em fila humana | Invariante "não ensinar errado" vale para o áudio também | **y** |
| Chave de dedup do áudio | `questao_id` + `questao_versao` + `explicacao_versao` + id da voz + versão do normalizador/dicionário | AD-036 (jobs retomáveis) + AD-014 (refaz quando o texto muda) | y |
| Formato e armazenamento | Arquivo comprimido em **Supabase Storage**, servido por URL; `explicacoes.audio_url` aponta para ele | PRD §7.1 | y |
| Classificação LGPD | O áudio é **acervo**, não dado pessoal — não pertence a nenhum dos 3 grupos do M7 | AD-027 | y |
| Orçamento do lote | Cada execução em lote declara um **teto de gasto**; ultrapassar **interrompe o lote** e alerta | O lote é grande, único e caro; diferente do tutor (AD-051), aqui parar é seguro | n (default registrado) |

**Open questions:** none — as quatro pendências foram fechadas em Discuss. A escolha da voz permanece
**tarefa humana pendente**, mas não é uma questão em aberto da spec: está especificada como porteiro
(TTS-06) e o produto funciona sem ela até o lote rodar.

---

## User Stories

### P1: Normalização de número e sigla antes da voz ⭐ (P1 do módulo — módulo é fast-follow)

**User Story**: Como aluno, quero ouvir "mil duzentos e cinquenta reais" e "certificado de depósito
bancário", para não aprender o número ou a sigla errada enquanto estudo sem olhar a tela.

**Why P1**: É o risco específico deste produto. Sem isso o áudio ensina errado, e nenhum ranking de voz
resolve.

**Acceptance Criteria**:

1. WHEN um texto vai virar áudio, THEN o sistema SHALL executar a **normalização antes** de chamar a voz:
   valores monetários, números, percentuais e símbolos SHALL ser convertidos para a forma por extenso, e
   as siglas SHALL ser expandidas pelo **dicionário curado**.
2. A normalização SHALL ser um passo **próprio e testável**, independente do provedor de voz; SHALL NOT ser
   delegada a instrução dentro do pedido ao provedor.
3. WHEN a normalização encontra um valor que **não consegue converter com segurança**, THEN o item SHALL
   NOT ser enviado à voz e SHALL entrar na fila de revisão humana, com o trecho apontado.
4. O sistema SHALL gravar, junto de cada áudio, a **versão do normalizador e do dicionário** usadas.
5. WHEN o dicionário de siglas é atualizado, THEN os áudios gerados com a versão anterior SHALL entrar na
   fila de refazer — SHALL NOT ser refeitos automaticamente sem confirmação (custo é decisão humana).

**Independent Test**: Submeter um texto com "R$ 1.250,00", "12,5%", "CDB" e "Selic" e conferir o roteiro
normalizado antes da chamada; injetar um valor malformado e ver o item cair na fila em vez de virar áudio.

---

### P1: Áudio de máxima qualidade, gerado 1× e amarrado à versão ⭐

**User Story**: Como plataforma, quero gerar cada áudio uma única vez, com o modelo de máxima qualidade,
amarrado à versão exata do que ele narra.

**Why P1**: Latência não importa (é lote), então qualidade manda; e áudio desamarrado da versão vira áudio
que ensina errado depois de uma retificação.

**Acceptance Criteria**:

1. WHEN um áudio é gerado, THEN o sistema SHALL usar o modelo de **máxima qualidade** do provedor
   configurado; SHALL NOT usar variante "fast"/"flash" (que existe para conversa ao vivo).
2. O arquivo SHALL ser guardado no **Supabase Storage** e referenciado em `explicacoes.audio_url`, amarrado
   a **`questao_id` + `questao_versao` + `explicacao_versao`**.
3. WHEN a explicação é **invalidada** por mudança substantiva de gabarito, enunciado ou alternativas
   (AD-052), THEN o áudio correspondente SHALL sair do ar **imediatamente**, SHALL ser descartado e SHALL
   ser refeito somente depois que a nova explicação passar por revisão humana.
4. WHEN a nova versão é **cosmética** (typo, formatação, acento), THEN o áudio existente SHALL permanecer
   válido e SHALL NOT ser refeito.
5. Toda geração SHALL ter **chave de dedup** (`questao_id` + `questao_versao` + `explicacao_versao` + voz +
   versão do normalizador); rerodar o job SHALL NOT gerar nem cobrar de novo o que já existe.
6. A geração SHALL rodar em **script standalone disparado por GitHub Actions** (AD-036); SHALL NOT rodar em
   função da Vercel.
7. WHEN a geração falha, THEN a falha SHALL ser visível e alertada (AD-037); o job SHALL retomar do ponto
   pela chave de dedup, SHALL NOT reprocessar o lote inteiro.

**Independent Test**: Retificar o gabarito de uma questão com áudio publicado e confirmar que o arquivo
saiu do ar na hora; corrigir um acento na explicação e confirmar que o mesmo arquivo continuou servindo.

---

### P1: O áudio narra a questão inteira e a explicação ⭐

**User Story**: Como aluno em deslocamento, quero ouvir o enunciado, as alternativas e depois a explicação
num áudio só, para estudar sem precisar ler nada na tela.

**Why P1**: É o que torna o módulo útil. Áudio que começa na explicação só serve para quem já leu a
questão — ou seja, para quem está em frente à tela.

**Acceptance Criteria**:

1. WHEN um áudio é gerado, THEN o roteiro SHALL conter, nesta ordem: **enunciado**, **alternativas** (para
   `tipo_questao='multipla_escolha'`) e **explicação**, num único arquivo contínuo (AD-063).
2. WHEN `tipo_questao='certo_errado'` (`alternativas` é `null`, AD-040), THEN o roteiro SHALL narrar o
   enunciado e a formulação Certo/Errado, SHALL NOT enumerar letras.
3. O roteiro SHALL marcar a transição entre questão e explicação de forma audível, para o aluno saber
   quando a resposta começa.
4. WHEN a questão tem `imagens` não vazio (gráfico, tabela ou figura), THEN o sistema SHALL NOT gerar
   áudio para ela, SHALL registrar o motivo e a interface SHALL informar que aquela questão é só de
   leitura.
5. O áudio SHALL ser gerado a partir do **texto aprovado** da questão e da explicação publicada; SHALL NOT
   reescrever, resumir ou acrescentar conteúdo (o áudio narra, não interpreta).

**Independent Test**: Gerar o áudio de uma questão de múltipla escolha e ouvir enunciado, as cinco
alternativas e a explicação em sequência; submeter uma questão com gráfico e confirmar que ela não entrou
na fila de geração.

---

### P1: Teste cego da voz como porteiro do lote ⭐

**User Story**: Como plataforma, quero que nenhuma geração em massa aconteça antes de a voz estar escolhida
por escuta e travada em configuração, para não gerar milhares de arquivos e ter que refazer todos.

**Why P1**: É o único ponto onde uma pendência humana pode custar caro se for ignorada.

**Acceptance Criteria**:

1. A voz SHALL viver em **configuração** (identificador do provedor + identificador da voz); nenhum
   requisito, teste ou trecho de código SHALL depender de qual voz é.
2. WHEN a configuração de voz está **vazia ou não travada**, THEN o job de geração em lote SHALL recusar-se
   a rodar, com mensagem explícita; SHALL NOT escolher uma voz padrão por conta própria (AD-062).
3. A escolha SHALL ser registrada com **data, critério e responsável**, e o critério SHALL ser a leitura
   correta de número, valor, percentual e sigla em português — SHALL NOT ser ranking geral de qualidade
   (que mede inglês).
4. O teste SHALL ser cego (o avaliador não sabe qual provedor ou voz gerou cada amostra) e SHALL usar
   explicações reais carregadas de número e jargão bancário.
5. WHEN a voz travada é trocada depois, THEN todo o acervo de áudio gerado com a voz anterior SHALL entrar
   na fila de refazer, e o custo SHALL ser apresentado antes da confirmação.

**Independent Test**: Apagar a voz da configuração e disparar o job em lote, confirmando que ele recusa
rodar com mensagem clara em vez de gerar com algum padrão.

---

### P2: Camada de voz trocável, com reserva em standby

**User Story**: Como plataforma, quero trocar o provedor de voz por configuração, para baratear ou reagir a
uma indisponibilidade sem reescrever o pipeline.

**Why P2**: A camada precisa existir desde o início (senão o pipeline nasce grudado num provedor), mas o
segundo provedor não precisa estar preenchido no dia 1.

**Acceptance Criteria**:

1. Toda chamada de voz SHALL passar por uma **camada trocável** que resolve provedor, modelo, voz e
   parâmetros a partir de configuração.
2. O slot de **reserva** SHALL existir na configuração e SHALL poder ficar **vazio** (standby); WHEN está
   vazio e o principal falha, THEN o lote SHALL parar de forma visível e alertada — SHALL NOT gerar com um
   provedor não configurado (AD-065).
3. WHEN um provedor de reserva é preenchido, THEN o pipeline SHALL funcionar com ele **sem alteração de
   código** no restante.
4. WHEN um provedor novo entra em consideração, THEN ele SHALL passar pelo mesmo teste cego em português da
   TTS-06 antes de ser configurado — SHALL NOT ser escolhido por tabela de preço.
5. O sistema SHALL registrar, por áudio gerado, **qual provedor, modelo e voz** o produziram.

**Independent Test**: Trocar o provedor na configuração num ambiente de teste e ver o lote rodar sem
alteração de código; esvaziar o principal e ver o lote parar com alerta em vez de improvisar.

---

### P2: Escopo por frequência, atrás de flag

**User Story**: Como operador, quero gerar áudio primeiro das explicações que mais caem, com o módulo atrás
de uma flag, para controlar custo e ligar quando o acervo estiver estável.

**Why P2**: É o que torna o M3 fast-follow sem ficar pela metade — o pipeline existe pronto e desligado.

**Acceptance Criteria**:

1. O módulo SHALL ser controlado por **feature flag**; WHEN desligado, THEN a interface SHALL NOT prometer
   áudio ao aluno e o restante do produto SHALL funcionar integralmente.
2. A fila de geração SHALL ser ordenada pela **frequência real** do tópico (ordem produzida pelo M5,
   RAIOX-15); SHALL NOT gerar tudo de uma vez por padrão.
3. O sistema SHALL gerar áudio **apenas** de explicações com `status` publicado; SHALL NOT gerar de
   rascunho, de explicação invalidada ou de questão `anulada`.
4. Cada execução em lote SHALL declarar um **teto de gasto**; WHEN o teto é alcançado, THEN o lote SHALL
   ser interrompido de forma limpa e retomável, e o time SHALL ser alertado.
5. WHEN uma explicação não tem áudio (ainda não gerado ou não elegível), THEN a interface SHALL indicar
   isso claramente; SHALL NOT apresentar como erro nem como botão quebrado.

**Independent Test**: Ligar a flag com um teto baixo e ver o lote gerar os assuntos do topo do Raio-X,
parar no teto e retomar do ponto na execução seguinte.

---

### P3: Controles de escuta

**User Story**: Como aluno, quero controlar a velocidade e retomar de onde parei, para ouvir do meu jeito.

**Why P3**: Conforto de uso; não afeta a corretude do conteúdo.

**Acceptance Criteria**:

1. O player SHALL oferecer controle de velocidade e retomada da posição.
2. WHEN o áudio de uma explicação é substituído por uma versão nova, THEN a posição salva SHALL ser
   descartada, SHALL NOT retomar no meio de um arquivo que não existe mais.

---

## Edge Cases

- WHEN a explicação é atualizada **enquanto** o áudio dela está sendo gerado, THEN o resultado SHALL ser
  descartado pela chave de dedup (a versão não bate), SHALL NOT sobrescrever com áudio de texto velho.
- WHEN duas execuções do lote rodam ao mesmo tempo sobre a mesma explicação, THEN a chave de dedup SHALL
  garantir um único arquivo gravado.
- WHEN o provedor devolve áudio truncado ou vazio, THEN o sistema SHALL descartar o arquivo, SHALL tentar
  novamente conforme política e, persistindo, SHALL enviar à fila humana — SHALL NOT publicar áudio
  incompleto.
- WHEN o provedor responde erro de limite de taxa, THEN o job SHALL aguardar e retomar do ponto.
- WHEN a explicação é muito longa para uma única chamada do provedor, THEN o sistema SHALL dividir em
  trechos e **concatenar num arquivo só**, mantendo a mesma voz e sem corte no meio de frase.
- WHEN a questão é **anulada** pela banca, THEN o sistema SHALL NOT gerar áudio para ela; o áudio existente
  SHALL ser marcado junto com a questão.
- WHEN o texto contém uma sigla que não está no dicionário, THEN ela SHALL ser lida letra a letra e o item
  SHALL ser registrado como **candidato a entrar no dicionário** — SHALL NOT ser inventada uma expansão.
- WHEN o áudio existe mas o arquivo sumiu do Storage, THEN a interface SHALL tratar como "sem áudio" e o
  item SHALL voltar para a fila de geração; SHALL NOT quebrar a tela da explicação.
- WHEN a flag do módulo é desligada com áudios já publicados, THEN os arquivos SHALL permanecer guardados
  (não são apagados) e apenas deixam de ser oferecidos.
- WHEN o teto de gasto do lote é atingido no meio de um item, THEN aquele item SHALL ser descartado inteiro
  (não parcial) e reentrar na fila.

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| TTS-01 | P1: Geração 1×, máxima qualidade, amarrada à versão da explicação (AD-014) | Design | Pending |
| TTS-02 | P1: Normalização de número e sigla **antes** da voz (AD-014.B) | Design | Pending |
| TTS-03 | P2: Camada de voz trocável, ElevenLabs principal (AD-014.A) | Design | Pending |
| TTS-04 | P2: Escopo por frequência; refaz quando o texto muda (AD-014.B/AD-052) | Design | Pending |
| TTS-05 | P1: Áudio narra **questão + explicação** num arquivo contínuo (AD-063) | Design | Pending |
| TTS-06 | P1: **Teste cego é porteiro** do primeiro lote; voz travada e registrada (AD-062) | Design | Pending |
| TTS-07 | P2: Módulo atrás de **feature flag** (fast-follow) + teto de gasto por lote (AD-064) | Design | Pending |
| TTS-08 | P2: Slot de **reserva em standby**; parar em vez de improvisar provedor (AD-065) | Design | Pending |
| TTS-09 | P1: Questão com imagem **não recebe áudio**, com motivo registrado (AD-063) | Design | Pending |
| TTS-10 | P1: Chave de dedup + versão de voz/normalizador gravadas por áudio (AD-036) | Design | Pending |
| TTS-11 | P3: Controles de escuta (velocidade, retomada) | - | Pending |

**ID format:** `TTS-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 requisitos, 0 mapeados a tasks (Specify), 0 sem cobertura de story.

---

## Success Criteria

- [ ] Nenhum áudio publicado lê valor, percentual ou sigla de forma diferente do texto normalizado.
- [ ] O áudio de uma questão de múltipla escolha traz enunciado, alternativas e explicação num arquivo só.
- [ ] Retificar um gabarito tira o áudio do ar na mesma hora; corrigir um acento não refaz nada.
- [ ] Disparar o lote sem voz travada é impossível — o job recusa rodar.
- [ ] Trocar o provedor de voz é mudar configuração; nenhum teste quebra pelo nome do provedor ou da voz.
- [ ] Rerodar o lote inteiro não gera nem cobra nada em cima do que já existe.
- [ ] Com a flag desligada, o produto inteiro funciona e nenhuma tela promete áudio.
- [ ] Nenhuma questão com gráfico ou tabela recebe áudio, e a tela diz por quê.
