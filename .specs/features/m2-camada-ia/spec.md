# M2 — Camada de IA · Especificação

> Fonte: `PRD.md` §M2, §4.1, §4.2, §6, §8, §9 (invariantes 4, 7, 11, 12), §10 (abertas 8 e 11).
> Decisões: AD-007, AD-010, AD-011, AD-012, AD-013. Herda contratos: **AD-039** (questão: `id` +
> `questao_versao`, correção = nova versão; enums), **AD-040** (formato de dados da questão:
> `alternativas`, `resposta_correta`, `imagens`, `fonte_citacao`, `embedding` + `fts`), **AD-042** (log
> `tentativas` — o tutor lê contexto, nunca escreve no log), **AD-036** (fábrica pesada em GitHub Actions
> + Batch, nunca em função da Vercel), **AD-035** (tutor ao vivo por streaming na Vercel), **AD-037**
> (falha visível/alertada), **AD-005** (embeddings Cohere embed-v4). Gray zone resolvida em Discuss
> (2026-07-23): AD-049 (matriz de modelos pesquisada + rotina de revisão), AD-050 (fonte mínima quando não
> há documento de referência), AD-051 (tutor no MVP com travas), AD-052 (explicação amarrada à versão da
> questão).
>
> **Migração de modelos (2026-08-04):** **AD-073** substitui a matriz do AD-049 — `gpt-5.6-luna` em todas
> as tarefas, `gpt-5.6-terra` só no refaz 1×, e o gateway passa a resolver **`(modelo, esforço, batch,
> cache, fallback)`** por tarefa. **AD-074** fixa acesso por **SDK nativo da OpenAI**, com a OpenRouter
> reservada ao eval trimestral. **AD-075** substitui o mecanismo de citação: saída estruturada + conferência
> por código nosso, no lugar do recurso de citations do fornecedor.

## Problem Statement

A IA precisa custar pouco por aluno e **nunca ensinar errado**. São dois problemas separados. O de
**custo** se resolve por arquitetura: quase tudo é gerado **uma vez** nos bastidores e servido do banco
para todos — o custo por aluno tende a zero e o produto continua de pé se a API de IA cair. O de
**verdade** se resolve por conferência: a resposta certa vem do **gabarito oficial** (a IA nunca decide
qual alternativa é a correta); o risco mora na **explicação** (o "porquê") e no **tutor**. A defesa é em
dois trilhos — a IA só pode afirmar o que está num documento entregue a ela (e cita a fonte), e todo
número é conferido **rodando a conta por código** antes de publicar.

## Goals

- [ ] Explicação escrita, conferida e com fonte citada para cada questão publicada — gerada 1× e servida
      do banco.
- [ ] Nenhuma explicação quantitativa publicada sem o número bater com o gabarito **e** com o texto.
- [ ] Cada tarefa de IA aponta um modelo por **configuração** — trocar de modelo é trocar uma linha, e só
      entra quem passar no teste às cegas em português.
- [ ] Tutor ao vivo no lançamento, cercado por teto diário + reaproveitamento de pergunta repetida +
      contexto injetado, com custo previsível.
- [ ] Feedback do aluno é sinal, nunca autoridade — não altera explicação sozinho.

## Out of Scope

| Feature | Motivo |
| ------- | ------ |
| Escolha da voz / geração de áudio | É M3 (M2 só sinaliza quando o texto muda) |
| Extração do PDF em si, catálogo, dedup, publicação | É M1 (M2 define o **contrato** da chamada de IA que o M1 usa) |
| Construção física da base de referência item a item | Esteira de curadoria humana, por frequência — não é código |
| Busca ao vivo na internet (web search) | Não existe no lançamento (AD-012) |
| Geração de questões inéditas | P2 no M1 (AD-041); a matriz de modelos já prevê a linha |
| Chamada de embeddings (dedup/busca) | Contrato em AD-005/M1; M2 só registra que **não passa pelo gateway** |
| Fine-tuning / treinar modelo próprio | Fora do desenho |
| Personalização da explicação por aluno | Contradiz pré-computa (AD-010); explicação é a mesma para todos |

---

## Assumptions & Open Questions

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| Matriz de modelos por tarefa | Tabela pesquisada em **2026-08-04** (ver **AD-073**, substitui AD-049): **`gpt-5.6-luna` em todas as tarefas**, `gpt-5.6-terra` só no refaz 1×; vive em **configuração**, nenhum código ou teste depende do nome | Corte de preço da OpenAI em 30/07/2026 (−80% na Luna) tornou a matriz anterior cara sem ganho | y (tabela) / n (nomes envelhecem) |
| Esforço de raciocínio por tarefa | **Faz parte da configuração**, não do código: `high` na fábrica, **`max`** na verificação quantitativa e no refaz 1×, **`medium`** no tutor | Tokens de raciocínio são cobrados como **saída**; no tutor custam também latência antes da primeira palavra (AD-073) | y |
| Provedor de acesso | **SDK nativo da OpenAI** (Responses API), adapter único no dia 1; OpenRouter **só no eval trimestral**, com chave separada | AD-074 — 100% das tarefas são OpenAI hoje; 5,5% de taxa compraria capacidade não usada, e recurso novo demora a ser repassado por agregador | y |
| Tópico sem documento de referência | Publica, usando **prova + gabarito oficial** como fonte mínima, e **proibida** de afirmar norma/prazo/percentual externo; tópico entra na fila por frequência | Discuss 2026-07-23 (AD-050); base construída por frequência (PRD §10.8) | y |
| Tutor no MVP | **Sim, P1** — default hoje `gpt-5.6-luna` com esforço **`medium`** (em config, AD-073), teto **3 perguntas/dia/aluno**, cache de pergunta repetida, alerta de gasto (sem desligamento automático) | Discuss 2026-07-23 (AD-051). O `PRD.md` §4.2 e o M9 (INFRA-05) foram **corrigidos** para acompanhar em **AD-066** — não há mais divergência entre os três documentos | y |
| Nova versão da questão × explicação | Mudou gabarito/enunciado/alternativas → explicação **invalidada na hora**, refeita e revisada por humano antes de voltar; mudança cosmética → segue válida | Discuss 2026-07-23 (AD-052) | y |
| Tamanho do eval cego | **~50 questões** com "explicação boa" definida pelo time; nota mínima e critério de aprovação a definir no Design | PRD §M2; risco #11 ("detalhe, não arquitetura") | n (calibra) |
| Refaz 1× da verificação de cálculo | O reprocessamento sobe **de modelo e de esforço**: primeira tentativa `gpt-5.6-luna` em `max`, refaz em **`gpt-5.6-terra` em `max`** (em config, AD-073) antes de ir à fila humana. É **uma única** tentativa extra — nunca um laço | AD-012 diz "refaz 1×, senão humano"; usar o mesmo modelo no mesmo esforço repetiria o erro | n (custo baixo, volume pequeno) |
| Como a conta é conferida | **Catálogo fechado de fórmulas + função própria testada**; a IA só escolhe a fórmula e os parâmetros. **Sem execução de código gerado por IA, sem sandbox** | Discuss 2026-07-23 → **AD-069**; determinístico, testável uma vez, sem superfície de segurança, mais barato (a IA escreve menos) | **y** |
| Cobertura do catálogo | Desconhecida até a 1ª leva. A taxa de "quantitativa sem fórmula aplicável" SHALL ser medida na primeira leva; **se for alta, reabrir a decisão** de executar código | Risco honesto do AD-069: matemática financeira é fechada, RLM não | n (medir) |
| Tolerância de comparação numérica | Em configuração (arredondamento de centavos e de percentual) | Gabarito da banca e conta exata divergem na última casa | n (calibra) |
| Custo estimado da fábrica | Ordem de **US$15–30** uma vez para ~10 mil questões (`gpt-5.6-luna` a US$0,20/US$1,20, com Batch −50% e cache de entrada a US$0,02), já contando esforço `high`. O refaz em Terra soma ordem de **US$5–10** | Recálculo de 2026-08-04 (AD-073); a estimativa anterior de < US$100 era com Sonnet 5 | n (estimativa) |
| Fatiamento do PDF na extração | A extração **SHALL** enviar o PDF em **blocos de questões**, nunca a prova inteira num pedido, e usar `detail: low` quando a questão não tiver gráfico/figura | Requisição acima de **272K tokens** é cobrada a 2× entrada / 1,5× saída, e PDF entra como texto **e** imagem de página (`detail` padrão `high` no GPT-5.6) — sem fatiar, o desconto do modelo é anulado (AD-073) | y |
| Teto de gasto de IA | **Alerta** quando o gasto do mês passa do limite configurado; **SHALL NOT** desligar o tutor automaticamente | Discuss 2026-07-23 — o usuário optou por alerta sem desligamento | y |
| Idempotência da fábrica | Toda chamada de IA tem **chave de dedup** (`questao_id` + `questao_versao` + tarefa + versão do prompt); rerodar não regenera nem cobra de novo | AD-036 (jobs retomáveis) | y |
| Versão do prompt | Cada tarefa guarda a **versão do prompt** usada, junto com o modelo e a data | Auditoria: saber com que instrução e que modelo cada explicação nasceu | y |

**Open questions:** none — as pendências acima são calibração (nota do eval, tamanho do lote) ou detalhe
de Design, todas registradas.

---

## User Stories

### P1: Explicação conferida, com fonte citada ⭐ MVP

**User Story**: Como aluno, quero uma explicação escrita e confiável de por que a resposta é aquela, com a
fonte citada, para aprender sem medo de decorar errado.

**Why P1**: É o produto. Sem explicação conferida, o banco de questões é só uma lista.

**Acceptance Criteria**:

1. WHEN uma explicação é gerada na fábrica, THEN o sistema SHALL entregar à IA, no mesmo pedido, o
   **documento de referência** do tópico (buscado pela etiqueta de assunto da questão) e SHALL exigir que
   todo fato, número, prazo ou regra afirmado esteja **naquele material**.
2. WHEN a explicação é gerada, THEN a IA SHALL devolver as citações em **saída estruturada**, como lista de
   `(doc_id, trecho)`; o sistema SHALL **conferir por código**, antes de aceitar, que cada `trecho` existe
   **literalmente no documento entregue naquele pedido** (comparação normalizada — espaços, acentuação,
   pontuação). SHALL gravar as citações conferidas em `explicacoes.fontes_citadas`, e SHALL rejeitar,
   enviando à fila humana, a explicação que não traga nenhuma citação **ou** que traga citação que não bate
   com a fonte (**AD-075**). O sistema SHALL NOT depender de recurso de citação do fornecedor.
3. WHEN a IA não encontra base para um fato, THEN ela SHALL NOT afirmá-lo — SHALL omitir, nunca inventar.
4. WHEN o tópico da questão **ainda não tem documento de referência**, THEN o sistema SHALL usar como
   fonte mínima a **própria prova + o gabarito oficial** (documentos oficiais, AD-003), SHALL permitir
   explicar o raciocínio da questão, SHALL NOT permitir afirmar norma/prazo/percentual/regra externa, e
   SHALL registrar o tópico na fila de construção da base, priorizada por frequência.
5. A explicação SHALL NOT decidir qual é a alternativa correta — a resposta certa vem sempre do
   **gabarito oficial** (`resposta_correta`, AD-040). WHEN a explicação contradiz o gabarito, THEN ela
   SHALL ser rejeitada e enviada à fila humana.
6. WHEN extração (saída estruturada, M1) e explicação (com citações) são necessárias, THEN o sistema SHALL
   fazê-las em **chamadas separadas** — SHALL NOT combiná-las na mesma chamada (invariante nº12).
7. A explicação SHALL ser gerada **1× por (questão, versão)** e servida do banco a todos os alunos; SHALL
   NOT ser gerada por aluno nem no momento da leitura.

**Independent Test**: Gerar a explicação de uma questão cujo tópico tem documento e ver as citações
gravadas; gerar a de um tópico sem documento e confirmar que a explicação não cita nenhuma norma externa.

---

### P1: Verificação de cálculo por catálogo de fórmulas ⭐ MVP

**User Story**: Como operador, quero que questão de conta (Matemática Financeira / RLM) só publique se o
número foi recalculado por **código nosso, testado** e bate com o gabarito **e** com o texto da explicação,
para não publicar conta errada.

**Why P1**: Invariante nº11. É a única forma de garantir número certo sem revisar tudo à mão — e
matemática financeira de concurso bancário é um **conjunto fechado de fórmulas**, o que torna
desnecessário executar código gerado pela IA (**AD-069**, substitui o sandbox do AD-012.3).

**Acceptance Criteria**:

1. WHEN a questão é classificada como **quantitativa**, THEN a IA SHALL devolver, em **saída estruturada**,
   apenas **qual fórmula do catálogo** se aplica e **quais parâmetros** ela recebe (ex.: juros compostos ·
   capital · taxa · períodos); o cálculo em si SHALL ser feito por **função própria do produto**, escrita e
   coberta por testes unitários. O sistema SHALL NOT executar código gerado pela IA.
2. O catálogo SHALL cobrir, no mínimo: juros simples e compostos, taxa proporcional × equivalente,
   desconto simples e composto, séries uniformes de pagamento, amortização SAC e Price, valor presente e
   valor futuro. Ampliar o catálogo SHALL ser mudança de código revisada, nunca inferência da IA.
3. O sistema SHALL publicar somente se o **cruzamento duplo** passar: (a) o resultado calculado bate com a
   alternativa correta oficial **e** (b) o número escrito na explicação é igual ao calculado (comparação
   com tolerância declarada em configuração, por causa de arredondamento).
4. WHEN a questão é quantitativa mas **não encaixa em nenhuma fórmula do catálogo** (ex.: RLM, pegadinha
   de enunciado), THEN o sistema SHALL enviá-la à **fila de revisão humana** e SHALL NOT publicar por conta
   própria — e SHALL registrar o caso, para medir a taxa de não-cobertura.
5. WHEN o cruzamento falha, THEN o sistema SHALL refazer **exatamente 1×**, **escalando de modelo e de
   esforço** (default hoje: primeira tentativa `gpt-5.6-luna` em `max`, refaz em `gpt-5.6-terra` em `max`,
   ambos resolvidos por config — AD-068/AD-073); WHEN a segunda tentativa também falha, THEN SHALL enviar à
   **fila de revisão humana** e SHALL NOT publicar. O sistema SHALL NOT tentar uma terceira vez, e SHALL NOT
   reprocessar automaticamente uma questão que já esteja na fila humana.
6. WHEN o cálculo falha por erro técnico (parâmetro inválido, divisão por zero, estouro), THEN o sistema
   SHALL tratar como falha do cruzamento (não como aprovação) e SHALL registrar o erro (AD-037).
7. O sistema SHALL registrar, junto da explicação, **qual fórmula e quais parâmetros** produziram o número
   conferido (auditoria).

**Independent Test**: Semear uma questão de juros compostos cuja explicação traz o número errado e
confirmar que ela não publica, que houve uma segunda tentativa e que ela terminou na fila humana; semear
uma questão de RLM sem fórmula aplicável e confirmar que ela cai direto na fila, contabilizada como
não-coberta.

---

### P1: Gateway de modelos por tarefa ⭐ MVP

**User Story**: Como plataforma, quero que cada tarefa de IA aponte um modelo por configuração, com versão
fixada e fallback, para trocar de modelo sem reescrever código.

**Why P1**: O líder de mercado muda toda semana; o que dura é o desenho, não o nome (AD-011).

**Acceptance Criteria**:

1. Toda chamada de IA SHALL passar por um **gateway** que resolve `tarefa → (modelo, versão fixada,
   **esforço de raciocínio**, **batch on/off**, **cache on/off**, fallback, parâmetros)` a partir de
   **configuração** (**AD-073**). Nenhum **trecho de código** e nenhum **teste automatizado** SHALL depender
   do nome de um modelo **nem do nível de esforço** — ambos vivem **só** na configuração, e trocá-los SHALL
   NOT exigir alteração de código. Mudar o esforço de **uma** tarefa SHALL NOT afetar as demais. Specs, ADs
   e comentários **PODEM** citar o default vigente: isso é documentação do que está configurado hoje, não
   acoplamento (**AD-068**).
2. As tarefas cobertas SHALL ser exatamente: **extração de PDF**, **explicação**, **verificação
   quantitativa** (escolha de fórmula + parâmetros), **classificação no tópico**, **plano inicial
   pós-diagnóstico**, **frase do plano diário**, **tutor**, **rascunho de inéditas** (P2), **reprocessamento
   de verificação**. A chamada de **embeddings** SHALL NOT passar pelo gateway (é chamada direta ao Cohere —
   `gpt-5.6-luna` não expõe endpoint de embeddings, confirmado em 2026-08-04; AD-005/AD-073).
   > **Pendente de decisão:** duas chamadas de IA existem em outros módulos e **ainda não estão nesta
   > lista** — o pré-diagnóstico de questão suspeita (M7, esteira 2, P2) e a extração do programa do edital
   > (M5, RAIOX-09, P3). Ou entram na matriz com modelo e esforço próprios, ou viram exceção registrada em
   > AD. Resolver antes do Design do M7/M5.
3. O acesso ao provedor SHALL ser por **SDK nativo da OpenAI** (Responses API), com **um único adapter** no
   lançamento (**AD-074**). A OpenRouter SHALL NOT ser usada na fábrica nem no tutor; SHALL ser usada
   **apenas** no eval cego trimestral (IA-11), com chave separada. Acrescentar um segundo adapter à produção
   SHALL exigir decisão registrada (novo AD).
4. A versão do modelo SHALL ser **fixada** na configuração (nunca um apelido flutuante), e o gateway SHALL
   gravar, em cada geração, **qual modelo, qual versão, qual esforço e qual versão do prompt** produziram o
   resultado.
5. WHEN o modelo principal de uma tarefa falha ou fica indisponível, THEN o gateway SHALL acionar o
   **fallback** configurado e SHALL registrar o evento; WHEN também o fallback falha, THEN o job SHALL
   parar de forma visível/alertada (AD-037), SHALL NOT publicar resultado parcial.
6. WHEN um modelo candidato entra em **tarefa sensível** (extração, explicação, tutor), THEN ele SHALL
   passar antes no **eval cego de PT-BR** (~50 questões com "explicação boa" definida pelo time, avaliadas
   sem saber qual modelo escreveu qual) — o eval é **porteiro**, SHALL NOT ser opcional.
7. A matriz de modelos SHALL ser **revista periodicamente** (rotina agendada, default trimestral): puxar
   preços/opções atuais, rodar o eval nos candidatos, trocar se houver ganho. A data da última revisão
   SHALL ficar registrada. O corte de 80% no preço da `gpt-5.6-luna` em 30/07/2026, quatro dias antes da
   AD-073, é o caso que justifica a rotina.
8. Toda geração da fábrica SHALL ter **chave de dedup** (`questao_id` + `questao_versao` + tarefa +
   versão do prompt); rerodar o job SHALL NOT regerar nem cobrar de novo o que já existe (AD-036).
9. As chamadas em lote da fábrica SHALL usar a **Batch API** (−50%), já que latência não importa fora do
   tutor, e SHALL usar **prompt caching** no trecho estável do pedido (instrução + documento de referência),
   cobrado a **0,1×** da entrada. Os dois descontos SHALL ser acumulados. WHEN uma tarefa é marcada
   `batch: não` na configuração (plano inicial e tutor), THEN ela SHALL usar a chamada síncrona — SHALL NOT
   ser empurrada para a fila de lote.
10. A extração de PDF SHALL enviar o documento em **blocos de questões**, SHALL NOT enviar a prova inteira
    num único pedido, e SHALL usar `detail: low` para questão sem gráfico/figura — requisição acima de
    **272K tokens** é cobrada a 2× entrada e 1,5× saída (AD-073).

**Independent Test**: Trocar o modelo da tarefa "classificação" na configuração e ver o pipeline rodar sem
alteração de código; mudar só o esforço do tutor e confirmar que nenhuma outra tarefa muda de
comportamento; derrubar o principal e ver o fallback assumir com registro.

---

### P1: Pré-computa primeiro — uma única superfície ao vivo ⭐ MVP

**User Story**: Como plataforma, quero que tudo que é IA seja gerado nos bastidores e servido do banco,
para o custo por aluno ser previsível e o produto sobreviver a uma queda da API.

**Why P1**: Invariante nº7; é a decisão que torna o preço de R$197/ano viável.

**Acceptance Criteria**:

1. Explicação, áudio, classificação, embeddings e a frase do plano SHALL ser gerados **fora do pedido do
   aluno** (fábrica/jobs) e servidos do banco.
2. A **única** superfície de IA ao vivo do lançamento SHALL ser o **tutor**; qualquer nova superfície ao
   vivo SHALL exigir decisão registrada (novo AD).
3. WHEN a API de IA está indisponível, THEN o núcleo do produto (responder questão, ver explicação, plano,
   projeções) SHALL continuar funcionando integralmente; apenas o tutor SHALL degradar, com mensagem
   clara.
4. WHEN a chamada de IA que escreve a frase do plano falha, THEN o plano SHALL ser entregue mesmo assim
   pela regra/SQL, sem a frase (contrato de M4, ALUNO-12).
5. A fábrica SHALL rodar em **scripts disparados por GitHub Actions** (AD-036), SHALL NOT rodar em função
   serverless da Vercel.

**Independent Test**: Desligar a chave de API num ambiente de teste e completar o loop central inteiro
(responder, ver explicação, receber plano) sem erro.

---

### P1: Tutor de dúvidas com trava ⭐ MVP

**User Story**: Como aluno, quero um tutor que responda minha dúvida com base na explicação já aprovada,
com limite diário, para tirar dúvida sem o app virar um chat solto.

**Why P1**: Entra no lançamento por decisão de 2026-07-23 (AD-051), alterando o §4.2 do PRD.

**Acceptance Criteria**:

1. WHEN o tutor é acionado, THEN o sistema SHALL injetar no pedido a **explicação e as fontes já
   aprovadas** daquela questão; o tutor SHALL NOT fazer busca própria, ao vivo, na internet ou no banco.
2. O tutor SHALL aplicar **teto de 3 perguntas por aluno por dia** (número em configuração); WHEN o aluno
   bate o teto, THEN o sistema SHALL exibir mensagem clara de que volta amanhã — SHALL NOT apresentar como
   erro técnico.
3. WHEN duas perguntas semelhantes chegam **na mesma questão**, THEN o sistema SHALL reaproveitar a
   resposta já gerada (cache por similaridade) em vez de gerar de novo, e a resposta reaproveitada SHALL
   NOT contar de forma diferente para o aluno.
4. O tutor SHALL responder por **streaming** (AD-035), SHALL NOT depender de resposta completa dentro do
   timeout curto de função.
5. WHEN a resposta do tutor contradiz a explicação aprovada, THEN ela SHALL ser tratada como defeito e o
   caso SHALL ser registrado para revisão; o tutor SHALL NOT ser autoridade acima da explicação conferida.
6. O sistema SHALL acompanhar o **gasto mensal de IA** e SHALL **alertar** o time quando ultrapassar o
   limite configurado; SHALL NOT desligar o tutor automaticamente (decisão de 2026-07-23).
7. As perguntas do tutor SHALL NOT ser gravadas em `tentativas` (o log é só de resposta a questão,
   AD-042); SHALL viver em tabela própria, classificada no **grupo 1** da LGPD (M7, DADOS-02).

**Independent Test**: Fazer 3 perguntas e ver a 4ª bloqueada com mensagem amigável; repetir a mesma
pergunta com outro aluno na mesma questão e confirmar que não houve nova chamada ao modelo.

---

### P1: Explicação amarrada à versão da questão ⭐ MVP

**User Story**: Como plataforma, quero que a explicação saia do ar automaticamente quando a questão muda
de um jeito que a invalida, para nunca deixar explicação errada visível.

**Why P1**: AD-039 criou versões de questão; sem esta regra, uma retificação de gabarito deixaria a
explicação antiga ensinando errado.

**Acceptance Criteria**:

1. `explicacoes` SHALL referenciar `questao_id` **e** `questao_versao`, e SHALL ter versão própria e
   `status`.
2. WHEN a questão ganha nova versão por mudança de **gabarito, enunciado ou alternativas**, THEN a
   explicação vigente SHALL ser **invalidada imediatamente** (sai do ar), SHALL ser regerada pela fábrica
   e SHALL voltar ao ar somente após **revisão humana**; o áudio correspondente SHALL ser descartado e
   refeito (contrato de M3, TTS-04/AD-014).
3. WHEN a nova versão é **cosmética** (erro de digitação, formatação, acento), THEN a explicação vigente
   SHALL permanecer válida e SHALL NOT ser regerada.
4. A classificação "cosmética × substantiva" SHALL ser registrada no momento em que a nova versão é criada
   (campo do M1) — SHALL NOT ser inferida depois pela IA.
5. WHEN uma explicação está invalidada, THEN a questão SHALL ser apresentada ao aluno sem explicação (com
   aviso de "em revisão") ou retirada de circulação, conforme configuração — SHALL NOT mostrar a
   explicação antiga.
6. As `tentativas` já gravadas SHALL seguir apontando para a versão respondida (AD-042); a invalidação da
   explicação SHALL NOT alterar histórico.

**Independent Test**: Retificar o gabarito de uma questão respondida por alunos e confirmar que a
explicação sumiu na hora, entrou na fila e que as tentativas antigas continuam intactas.

---

### P2: Dois sinais de feedback do aluno

**User Story**: Como aluno, quero marcar "foi útil?" e "reportar erro" numa explicação, para pedir
melhoria — sabendo que meu voto não muda a explicação sozinho.

**Why P2**: Melhora a curadoria e alimenta o flywheel; não bloqueia o loop central.

**Acceptance Criteria**:

1. O sistema SHALL oferecer **dois sinais separados**: **"foi útil?"** (👍/👎 — alimenta eval, melhoria e
   flywheel) e **"reportar erro"** (texto — abre item na fila de revisão).
2. WHEN qualquer feedback chega, THEN o sistema SHALL registrá-lo como sinal e SHALL NOT alterar a
   explicação automaticamente (invariante nº4).
3. WHEN vários alunos reportam erro na **mesma** questão, THEN a fila SHALL priorizar por volume.
4. A verdade da explicação SHALL continuar sendo **gabarito oficial + verificação por código + base
   revisada**; o feedback do aluno é sinal, nunca autoridade.
5. `feedback_explicacao` SHALL ser classificada no **grupo 1** da LGPD (some no DELETE, M7).

**Independent Test**: Três alunos reportarem erro na mesma questão e ver o item subir na fila sem que o
texto da explicação mude sozinho.

---

### P2: Base de referência para grounding

**User Story**: Como operador, quero uma base de documentos por tópico, construída pelos assuntos que mais
caem, para as explicações terem fonte de verdade.

**Why P2**: É esteira de curadoria contínua; o dia 1 sobe com fonte mínima (P1, AC4).

**Acceptance Criteria**:

1. `base_referencia` SHALL guardar documentos por **tópico**, com `origem` (oficial × resumo nosso),
   `status` (rascunho × conferido) e data.
2. Quando existir documento **oficial** (norma, resolução, manual), ele SHALL ser preferido; o **resumo
   nosso** SHALL ser usado apenas quando conferido por humano.
3. A fila de construção SHALL ser ordenada por **frequência real** do tópico (sinal do M5).
4. WHEN um documento da base é atualizado, THEN as explicações que o citam SHALL entrar na fila de
   reavaliação — SHALL NOT ser regeradas automaticamente sem revisão.

**Independent Test**: Adicionar um documento oficial de um tópico que só tinha fonte mínima e ver as
explicações daquele tópico entrarem na fila de reavaliação.

---

## Edge Cases

- WHEN a questão é anulada pela banca, THEN o sistema SHALL NOT gerar explicação nova para ela, e a
  existente SHALL ser marcada; questão anulada não conta em nada (contrato de M4).
- WHEN o documento de referência é maior que a janela de contexto do modelo, THEN o sistema SHALL enviar
  apenas os trechos relevantes (busca híbrida, AD-040) e SHALL registrar quais trechos foram enviados.
- WHEN a IA devolve resposta fora do formato esperado (JSON inválido, campo faltando), THEN o sistema SHALL
  descartar, tentar novamente conforme política e, persistindo, SHALL enviar à fila humana — SHALL NOT
  gravar resultado malformado.
- WHEN o provedor responde erro de limite de taxa, THEN o job SHALL aguardar e retomar do ponto (chave de
  dedup), SHALL NOT reprocessar o lote inteiro.
- WHEN duas execuções da fábrica rodam ao mesmo tempo sobre a mesma questão, THEN a chave de dedup SHALL
  garantir uma única explicação gravada.
- WHEN o aluno faz uma pergunta ao tutor que não tem relação com a questão aberta, THEN o tutor SHALL
  responder que só trata daquela questão — SHALL NOT virar assistente de propósito geral.
- WHEN o aluno tenta usar o tutor para obter a resposta antes de responder a questão, THEN o tutor SHALL
  NOT entregar a alternativa correta antes do aluno responder.
- WHEN a explicação contém número mas a questão **não** foi classificada como quantitativa, THEN o sistema
  SHALL marcá-la para verificação mesmo assim (rede de segurança contra classificação errada).
- WHEN a mesma pergunta do tutor chega em **questões diferentes**, THEN o cache SHALL NOT ser reaproveitado
  entre questões (contexto injetado é outro).
- WHEN o gasto mensal de IA ultrapassa o limite, THEN o alerta SHALL ser disparado uma vez por período,
  SHALL NOT repetir a cada chamada.

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| IA-01 | P1: Pré-computa primeiro; única superfície ao vivo = tutor (AD-010) | Design | Pending |
| IA-02 | P1: Gateway trocável resolvendo **modelo + esforço + batch + cache + fallback** por tarefa, em config (AD-011/**AD-073**) | Design | Pending |
| IA-03 | P1: Eval cego PT-BR como porteiro de modelo (AD-011) | Design | Pending |
| IA-04 | P1: Grounding por documento entregue + **citação por saída estruturada conferida por código** (AD-012.1/12.2/**AD-075**) | Design | Pending |
| IA-05 | P2: Base de referência oficial-quando-existe + resumo conferido (AD-012.2) | Design | Pending |
| IA-06 | P1: Verificação de conta por **catálogo de fórmulas + código nosso** + cruzamento duplo (AD-012.3/AD-069) | Design | Pending |
| IA-15 | P1: Quantitativa fora do catálogo vai à fila humana, com taxa de não-cobertura medida (AD-069) | Design | Pending |
| IA-07 | P2: Dois sinais de feedback; nada muda a explicação sozinho (AD-013) | Design | Pending |
| IA-08 | P1: Fonte mínima (prova+gabarito) quando não há documento; veto a norma externa (AD-050) | Design | Pending |
| IA-09 | P1: Explicação amarrada a `questao_versao` + invalidação por tipo de mudança (AD-052) | Design | Pending |
| IA-10 | P1: Tutor com teto 3/dia + cache de pergunta repetida + contexto injetado (AD-051) | Design | Pending |
| IA-11 | P1: Rotina periódica de revisão da matriz de modelos, com eval via OpenRouter fora da produção (AD-049/**AD-074**) | Design | Pending |
| IA-12 | P1: Alerta de gasto mensal de IA, sem desligamento automático (AD-051) | Design | Pending |
| IA-13 | P1: Refaz **exatamente 1×**, escalando de modelo **e** de esforço, antes da fila humana (AD-012.3/**AD-073**) | Design | Pending |
| IA-14 | P1: Chave de dedup + versão de prompt/modelo/**esforço** gravadas em toda geração (AD-036) | Design | Pending |
| IA-16 | P1: Acesso por **SDK nativo da OpenAI**, adapter único; OpenRouter só no eval (**AD-074**) | Design | Pending |
| IA-17 | P1: Extração fatia o PDF por blocos + `detail: low` sem figura; Batch e cache acumulados (**AD-073**) | Design | Pending |

**ID format:** `IA-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 17 requisitos, 0 mapeados a tasks (Specify), 0 sem cobertura de story.

---

## Success Criteria

- [ ] Toda questão publicada tem explicação com pelo menos uma citação gravada, e **todo trecho citado foi
      conferido por código contra o documento entregue**; nenhuma afirma norma externa sem documento.
- [ ] Nenhuma questão quantitativa publica com número que não bate com o gabarito e com o texto.
- [ ] Trocar qualquer modelo **ou qualquer nível de esforço** é mudar uma linha de configuração; nenhum
      teste quebra por causa do nome, e mudar uma tarefa não afeta as outras.
- [ ] Nenhum pedido da fábrica passa de 272K tokens; Batch e cache estão ativos onde a config manda.
- [ ] Nenhum modelo novo entra em tarefa sensível sem passar no eval cego de PT-BR.
- [ ] Com a API de IA desligada, o loop central roda inteiro; só o tutor degrada, com mensagem clara.
- [ ] Tutor respeita o teto diário, reaproveita pergunta repetida e nunca busca informação por conta
      própria.
- [ ] Retificar um gabarito tira a explicação do ar na hora e ela só volta com revisão humana.
- [ ] Rerodar a fábrica inteira não gera nem cobra nada em cima do que já existe.
