# M8 — Negócio, Pagamentos & Onboarding · Especificação

> Fonte: `PRD.md` §M8, §4.1 (item 4), §7.4, §9, §10 (abertas 3, 5, 9). Decisões: AD-031, AD-032,
> AD-033, AD-034. Herda contratos: **AD-017/AD-044** (diagnóstico pulável → plano do 1º dia; a IA que
> escreve o plano inicial é 1 chamada e sua falha não derruba o plano), **AD-051** (tutor entra no MVP —
> vira argumento da página de vendas), **AD-047** (declaração 18+ é requisito do M7 que o checkout
> implementa), **AD-045** (o relógio de retenção do M7 conta do fim da matrícula), **AD-035** (Vercel +
> Supabase SP), **AD-037** (falha visível/alertada). Gray zone resolvida em Discuss (2026-07-23):
> AD-053 (preço/desconto Pix parametrizados), AD-054 (trava de antecipação na janela de garantia),
> AD-055 (fim da matrícula).

## Problem Statement

O produto está inteiro atrás de um muro: o aluno **paga antes de usar**. Isso resolve caixa e filtra quem
é sério, mas transfere todo o peso da conversão para a página de vendas — e torna o caminho
pagamento → conta → primeiro plano um ponto único de falha. Se o webhook do gateway falhar, alguém pagou
e não entrou. A cobrança é **compra de 1 ano** (12x no cartão ou à vista no Pix/boleto), não assinatura
recorrente, com **garantia de 7 dias**. O gateway é o **Asaas**, em checkout próprio, porque emite nota
fiscal nativamente — o que evita um segundo serviço só para isso.

## Goals

- [ ] Visitante compra informando só o e-mail, pagando por cartão 12x, Pix ou boleto.
- [ ] Pagamento aprovado vira conta ativa + matrícula de 12 meses **sem intervenção manual**, e sem perder
      ninguém se o webhook falhar.
- [ ] Aluno define senha, entra e chega ao **plano do 1º dia** na mesma sessão.
- [ ] Garantia de 7 dias funciona de ponta a ponta, sem prejuízo escondido de antecipação.
- [ ] Nota fiscal emitida pelo próprio gateway em toda compra.

## Out of Scope

| Feature | Motivo |
| ------- | ------ |
| Escada de tiers / mensalidade recorrente (Leitura B) | AD-032 — só com dado do flywheel (P3, fast-follow) |
| Cupons, afiliados, campanhas complexas | Não no lançamento |
| Kiwify ou 2º gateway como espinha | AD-033 — Asaas é o único; Kiwify no máximo campanha pontual |
| Conteúdo da página de vendas (copy, design) | M8 define o que ela SHALL conter, não como é escrita |
| Diagnóstico, plano diário, projeções | É M4 (M8 só encadeia o onboarding até lá) |
| Regras de retenção/DELETE dos dados | É M7 (M8 só informa o fim da matrícula, que dispara o relógio) |
| Emissão de NF por meio próprio | Nativa do Asaas — o produto não constrói isso |
| App mobile nativo | Fora de escopo (PRD §4.3) — web responsivo |

---

## Assumptions & Open Questions

| Assumption / decisão | Default escolhido | Racional | Confirmed? |
| --- | --- | --- | --- |
| Preço | **R$197/ano** como âncora, **valor em configuração**; o comportamento (plano único anual, 12x, à vista, garantia) é que é fixo | Discuss 2026-07-23 (AD-053); AD-031 marcava [provisório] | y (estrutura) / n (número) |
| Desconto no Pix/boleto à vista | **~10%** (ex.: R$197 no cartão 12x, **R$177** à vista), percentual em configuração | Discuss 2026-07-23; Pix rende mais líquido **e** entra na hora | y |
| Taxas do Asaas (pesquisadas 2026-07-23) | Pix R$1,99 · boleto R$1,99 · cartão à vista R$0,49+2,99% · **7–12x R$0,49+3,99%** · antecipação 1,25%/mês à vista e **1,70%/mês parcelado** · NF R$0,49 · sem mensalidade/adesão · cartão à vista D+32 | Página pública `asaas.com/precos-e-taxas` | y (na data) |
| Líquido por venda | Pix ≈ **R$174,52** (sobre R$177) · cartão 12x sem antecipar ≈ **R$188,16** · cartão 12x antecipando tudo ≈ **~R$167** | Cálculo sobre as taxas acima | n (estimativa) |
| Antecipação × garantia | Venda dentro da janela de 7 dias SHALL ficar marcada **não-antecipável**; depois disso, antecipar é decisão de caixa | Discuss 2026-07-23 (AD-054); resolve a aberta nº9 do PRD | y |
| Fim dos 12 meses | Avisos em **30** e **7** dias; no vencimento o **acesso ao conteúdo encerra**; o histórico é preservado e o relógio de retenção do M7 começa a contar dali | Discuss 2026-07-23 (AD-055); resolve a aberta nº5 | y |
| CNPJ / regime tributário para NF | **ME no Simples** como hipótese (MEI provavelmente não cobre o faturamento) | PRD §10.3 — *due diligence com contador*; não trava o Design | n (contador) |
| Reembolso: o que volta | Devolve o valor pago ao aluno; a **taxa do cartão** normalmente **não** é devolvida pelo gateway | Prática de mercado; confirmar no contrato do Asaas | n |
| Idade mínima | Declaração 18+ no checkout (AD-047/DADOS-11) | M7 | y |
| Provedor de e-mail transacional | Supabase Auth para "defina a senha"/link mágico; e-mails de negócio (aviso de vencimento) por provedor a definir no Design | AD-034 | n (Design) |
| Moeda / internacional | Só **BRL**, só Brasil no lançamento | Público é concurso brasileiro | y |
| Medição do funil de venda | Eventos **anônimos** pré-login na ferramenta do INFRA-12 (default **PostHog região Estados Unidos**, AD-079); sem e-mail/nome/CPF/dado de pagamento | O produto está atrás do paywall e a página é a única superfície de conversão — sem isso, tráfego pago é gasto às cegas. Pré-login não tem `user_id` e não entra nos grupos do AD-027 | y (escopo) / n (base legal — advogado, junto do M7) |

**Open questions:** none — as pendências acima são *due diligence* (contador, contrato do Asaas) ou
detalhe de Design, todas com default registrado.

---

## User Stories

### P1: Checkout — comprar informando só o e-mail ⭐ MVP

**User Story**: Como visitante, quero comprar informando só o e-mail e pagar (cartão 12x, Pix ou boleto),
para entrar com o mínimo de atrito.

**Why P1**: É a única porta de entrada do produto. Todo atrito aqui é receita perdida.

**Acceptance Criteria**:

1. O checkout SHALL ser **próprio** (hospedado por nós, integrado ao Asaas), SHALL NOT redirecionar para
   uma página de terceiro.
2. O checkout SHALL pedir, antes do pagamento, **apenas o e-mail** e os dados exigidos pelo meio de
   pagamento escolhido; SHALL NOT exigir criar senha, nome de usuário ou perfil.
3. O checkout SHALL oferecer **cartão parcelado em até 12x**, **Pix** e **boleto** à vista.
4. O preço SHALL vir de **configuração**: um valor para cartão parcelado e um valor **à vista com desconto**
   (default ~10%); a página SHALL exibir os dois claramente antes da escolha.
5. O checkout SHALL exigir **declaração afirmativa de 18 anos ou mais** e aceite dos termos, registrando
   data/hora (implementa DADOS-11/AD-047).
6. O lançamento SHALL vender **um plano único** — SHALL NOT apresentar tiers — e SHALL NOT cobrar
   mensalidade recorrente.
7. WHEN o e-mail informado já tem matrícula **ativa**, THEN o checkout SHALL avisar e oferecer login em vez
   de cobrar de novo.
8. WHEN o pagamento é recusado, THEN o sistema SHALL manter os dados preenchidos e permitir trocar de meio
   de pagamento sem recomeçar.

**Independent Test**: Concluir uma compra de ponta a ponta em cada meio (cartão, Pix, boleto) em ambiente
de teste, informando só o e-mail.

---

### P1: Buy-then-activate — pagamento vira conta automaticamente ⭐ MVP

**User Story**: Como plataforma, quero que o pagamento aprovado crie a conta e a matrícula sozinho, para o
aluno acessar sem cadastro manual antes de pagar.

**Why P1**: É a costura entre dinheiro e produto. Se falhar, alguém pagou e não entrou — o pior defeito
possível.

**Acceptance Criteria**:

1. WHEN o Asaas confirma o pagamento (webhook), THEN o sistema SHALL criar o usuário no Supabase Auth,
   SHALL registrar `matricula` com **validade de 12 meses** e SHALL disparar o e-mail "defina sua senha".
2. A `matricula` válida SHALL ser a **única** coisa que libera o conteúdo pago (verificada por RLS e pela
   aplicação); SHALL NOT haver segundo mecanismo de liberação.
3. O webhook SHALL ter sua **assinatura/autenticidade verificada**; requisição não verificada SHALL ser
   rejeitada e registrada.
4. O webhook SHALL ser **idempotente**: o mesmo evento entregue N vezes SHALL produzir exatamente uma conta
   e uma matrícula (dedup pelo id do evento/cobrança).
5. WHEN o webhook não chega (perda, indisponibilidade), THEN um **job de reconciliação** SHALL consultar o
   Asaas periodicamente e ativar as compras pagas que ficaram sem conta — SHALL NOT depender só do webhook.
6. WHEN a criação da conta falha após o pagamento confirmado, THEN a falha SHALL ser **alertada**
   (AD-037), a compra SHALL ficar numa fila visível de pendências e SHALL ser retomável — SHALL NOT ser
   perdida em silêncio.
7. Os estados da compra SHALL ser explícitos e as transições SHALL ser registradas:
   `pendente → confirmada → ativada` e `confirmada → reembolsada`; `pendente → expirada` (boleto/Pix não
   pago); WHEN uma transição inválida é tentada, THEN SHALL ser rejeitada.
8. WHEN a compra é confirmada, THEN o sistema SHALL emitir a **nota fiscal** pelo gateway e SHALL guardar
   a referência da nota em `faturas`.
9. `pagamentos` e `faturas` SHALL ser retidos pelo prazo fiscal e SHALL sobreviver ao DELETE-por-
   esquecimento (M7/DADOS-04).

**Independent Test**: Disparar o mesmo webhook três vezes e confirmar uma única conta; apagar o webhook e
ver o job de reconciliação ativar a compra sozinho.

---

### P1: Entrar e chegar ao plano do 1º dia ⭐ MVP

**User Story**: Como aluno, quero definir a senha por e-mail, entrar e já receber meu plano, para o
produto começar a valer na primeira sessão.

**Why P1**: É a ativação. Pagar e não saber o que fazer é reembolso na certa.

**Acceptance Criteria**:

1. O login SHALL oferecer **e-mail + senha**, **Google** e **link mágico**; os três SHALL levar à mesma
   conta quando o e-mail for o mesmo.
2. WHEN o aluno entra pela primeira vez, THEN o sistema SHALL conduzir o **onboarding**: declarar a
   **meta** (concurso alvo + tempo disponível por dia) e oferecer o **diagnóstico** — sempre **pulável**
   (AD-017).
3. WHEN o onboarding termina (com ou sem diagnóstico), THEN o sistema SHALL entregar o **plano do 1º dia**
   na mesma sessão (contrato de M4, ALUNO-05/ALUNO-12).
4. WHEN a chamada de IA que escreve o plano inicial falha, THEN o plano SHALL ser entregue mesmo assim pela
   regra/SQL — SHALL NOT bloquear a ativação (invariante nº7).
5. WHEN o e-mail "defina sua senha" não chega ou expira, THEN o aluno SHALL conseguir entrar pelo **link
   mágico** informando o mesmo e-mail, sem falar com suporte.
6. WHEN um usuário sem matrícula válida tenta acessar conteúdo pago, THEN o sistema SHALL bloquear e
   oferecer a compra — SHALL NOT mostrar conteúdo parcial.

**Independent Test**: Pagar, receber o e-mail, definir senha, pular o diagnóstico e ainda assim ver o
plano do 1º dia — tudo em uma sessão.

---

### P1: Garantia de 7 dias ⭐ MVP

**User Story**: Como aluno, quero garantia de 7 dias para testar sem risco numa marca nova.

**Why P1**: É o contrapeso do paywall — sem ela, o muro converte muito menos.

**Acceptance Criteria**:

1. WHEN o aluno pede reembolso **dentro de 7 dias** da confirmação do pagamento, THEN o sistema SHALL
   processar a devolução pelo Asaas e SHALL encerrar o acesso.
2. A janela SHALL ser contada a partir da **confirmação do pagamento**, em dias corridos, e SHALL ficar
   visível para o aluno (quantos dias restam).
3. WHEN o reembolso é efetivado, THEN a matrícula SHALL ir para `reembolsada`, o acesso SHALL encerrar e a
   nota fiscal SHALL ser cancelada/ajustada conforme a regra do gateway.
4. O reembolso SHALL ser registrado com quem pediu, quando e por qual meio; o histórico de estudo do aluno
   SHALL seguir as regras do M7 (não é apagado automaticamente — o DELETE é pedido à parte).
5. WHEN o pedido chega **depois** de 7 dias, THEN o sistema SHALL informar que a garantia venceu — SHALL
   NOT processar devolução automática.

**Independent Test**: Comprar, pedir reembolso no 5º dia e ver devolução + acesso encerrado; repetir no 9º
dia e ver a recusa com mensagem clara.

---

### P1: Trava de antecipação durante a garantia ⭐ MVP

**User Story**: Como negócio, quero que nenhuma venda seja antecipada enquanto estiver na janela de
garantia, para não pagar custo de antecipação de um valor que vou devolver.

**Why P1**: Resolve a questão aberta nº9 do PRD. Sem isso, cada reembolso custa ~11% a mais em silêncio.

**Acceptance Criteria**:

1. O sistema SHALL saber dizer, para qualquer venda e a qualquer momento, se ela ainda está **dentro da
   janela de garantia**.
2. WHEN a venda está dentro da janela, THEN ela SHALL ser marcada **não-antecipável** e SHALL NOT ser
   incluída em nenhuma solicitação de antecipação.
3. WHEN a janela fecha sem pedido de reembolso, THEN a venda SHALL passar a **antecipável**, e antecipar ou
   não SHALL ser decisão manual do time — SHALL NOT ser automático.
4. O sistema SHALL expor um relatório do que está antecipável, com o valor líquido estimado, para essa
   decisão.

**Independent Test**: Criar uma venda de hoje e confirmar que ela aparece como não-antecipável; adiantar o
relógio 8 dias e ver a mesma venda virar antecipável.

---

### P1: Fim da matrícula — aviso, encerramento e histórico preservado ⭐ MVP

**User Story**: Como aluno, quero ser avisado antes de o meu ano acabar e não perder meu histórico se eu
voltar, porque concurso é anual e eu volto.

**Why P1**: Resolve a questão aberta nº5 do PRD e amarra com a janela de retenção do M7.

**Acceptance Criteria**:

1. O sistema SHALL avisar o aluno **30 dias** e **7 dias** antes do vencimento da matrícula, com oferta de
   renovação.
2. WHEN a matrícula vence, THEN o acesso ao conteúdo pago SHALL encerrar; SHALL NOT haver cobrança
   automática de renovação (modelo de venda única, AD-031/AD-032).
3. WHEN a matrícula vence, THEN o **histórico do aluno SHALL ser preservado** (log, projeções, caderno de
   erros) e o relógio de retenção do M7 SHALL passar a contar a partir do fim da matrícula (AD-045).
4. WHEN o aluno renova dentro da janela de retenção, THEN o histórico SHALL voltar intacto e o relógio
   SHALL reiniciar.
5. Os avisos de vencimento SHALL ser transacionais (relativos ao contrato) — SHALL NOT depender do
   consentimento de marketing (M7/DADOS-01).

**Independent Test**: Semear uma matrícula vencendo em 30 dias e ver os dois avisos; deixar vencer e
confirmar acesso bloqueado com histórico intacto.

---

### P1: Página de vendas como superfície de conversão ⭐ MVP

**User Story**: Como visitante, quero entender o método e por que ele funciona antes de pagar, já que não
consigo experimentar o produto.

**Why P1**: O produto está atrás do muro; a página é a única chance de convencer (AD-034).

**Acceptance Criteria**:

1. A página SHALL apresentar: o **método** (questões + revisão espaçada + plano diário), as **evidências
   científicas** (`docs/EVIDENCIAS-CIENTIFICAS.md`), a **garantia de 7 dias** e o preço nos dois formatos
   (12x e à vista com desconto).
2. A página SHALL declarar honestamente o que existe hoje e o que não existe — SHALL NOT prometer
   funcionalidade não entregue (invariante de notificação honesta, nº14, vale também para a venda).
3. A página SHALL ser **responsiva** (web mobile-first) e SHALL funcionar sem login.
4. A página SHALL linkar a política de privacidade e os termos (M7).
5. A página e o checkout SHALL emitir os **eventos do funil pré-login** (INFRA-12/AD-079) — no mínimo:
   página de vendas vista, checkout iniciado, meio de pagamento escolhido, pagamento confirmado — em
   **modo anônimo**, SHALL NOT enviar e-mail, nome, CPF nem dado de meio de pagamento, e SHALL NOT tornar
   nenhum passo da compra dependente de a medição funcionar.
6. A **taxa de conversão** medida por esses eventos SHALL ser tratada como sinal de onde o visitante
   desiste; a verdade do dinheiro SHALL continuar sendo a conciliação do PAG-15 (vendas confirmadas ×
   valores recebidos), SHALL NOT ser o número do analytics.

**Independent Test**: Abrir a página no celular, entender método/preço/garantia e chegar ao checkout em um
clique; percorrer o funil e ver os quatro eventos sem nenhum dado pessoal nas propriedades; bloquear o
analytics no navegador e concluir a compra normalmente.

---

### P2: Nota fiscal e conciliação financeira

**User Story**: Como operador, quero a nota fiscal emitida pelo próprio gateway e um lugar para conferir o
que entrou, para cumprir a obrigação sem um segundo serviço.

**Why P2**: A NF é obrigação, mas depende do CNPJ/regime (due diligence com contador) — não trava o loop.

**Acceptance Criteria**:

1. WHEN a compra é confirmada, THEN a NF SHALL ser emitida pelo Asaas e sua referência SHALL ser gravada.
2. WHEN a emissão da NF falha, THEN a compra SHALL permanecer **ativada** (o aluno não é penalizado) e a
   falha SHALL entrar numa fila alertada para reemissão.
3. O sistema SHALL oferecer um relatório de conciliação: vendas confirmadas × valores recebidos × taxas ×
   notas emitidas.

**Independent Test**: Confirmar uma compra e ver a NF referenciada em `faturas`; simular falha de emissão e
ver o aluno ativo com a pendência na fila.

---

### P3: Escada de tiers / mensalidade (fast-follow)

**User Story**: Como negócio, quero desenhar tiers ou mensalidade com dado do flywheel, para capturar
quem paga mais e quem não pode pagar à vista.

**Why P3**: AD-032 — sem dado, qualquer tier é chute; o checkout simples converte mais no lançamento.

**Acceptance Criteria**:

1. O modelo de dados de `matricula`/`pagamentos` SHALL permitir mais de um produto/plano no futuro sem
   migração destrutiva.
2. Nenhum tier SHALL ser lançado antes de haver dado de uso do flywheel (M7).

---

## Edge Cases

- WHEN o boleto ou o Pix é gerado e não é pago, THEN a compra SHALL expirar após o prazo e SHALL NOT criar
  conta; o e-mail SHALL poder comprar de novo normalmente.
- WHEN o pagamento é confirmado **depois** de a compra ter expirado (boleto pago em atraso), THEN o sistema
  SHALL ativar mesmo assim e SHALL registrar o caso.
- WHEN o mesmo e-mail compra duas vezes por engano, THEN o sistema SHALL detectar matrícula ativa, SHALL
  NOT criar segunda conta, e a segunda compra SHALL entrar na fila de reembolso.
- WHEN o Asaas está fora do ar no momento do checkout, THEN o sistema SHALL exibir mensagem clara e SHALL
  NOT registrar compra fantasma; a falha SHALL ser alertada.
- WHEN chega um webhook de evento desconhecido ou fora de ordem (reembolso antes da confirmação), THEN o
  sistema SHALL registrá-lo, SHALL NOT quebrar, e a transição inválida SHALL ser rejeitada com alerta.
- WHEN o aluno faz chargeback (contestação no cartão), THEN o sistema SHALL encerrar o acesso ao receber o
  evento do gateway e SHALL registrar separadamente do reembolso por garantia.
- WHEN uma parcela futura do cartão é recusada, THEN o acesso SHALL NOT ser cortado automaticamente (é
  venda única, o risco de crédito é do gateway/operadora) e o caso SHALL entrar em relatório.
- WHEN o aluno troca o e-mail da conta, THEN a matrícula SHALL seguir o usuário, não o e-mail antigo.
- WHEN o aluno entra por Google com um e-mail diferente do da compra, THEN o sistema SHALL NOT liberar
  acesso e SHALL orientar a entrar com o e-mail da compra.
- WHEN o preço em configuração muda, THEN as matrículas já vendidas SHALL NOT ser afetadas (o valor pago
  fica registrado na compra).
- WHEN o aluno pede reembolso e DELETE de dados ao mesmo tempo, THEN o reembolso SHALL ser processado
  primeiro e as faturas SHALL ser retidas pelo prazo fiscal (M7/DADOS-04).

---

## Requirement Traceability

| Requirement ID | Story | Fase | Status |
| --- | --- | --- | --- |
| PAG-01 | P1: Paga-primeiro / paywall; matrícula é a única chave (AD-031) | Design | Pending |
| PAG-02 | P1: Compra anual 12x no cartão + Pix/boleto à vista (AD-031) | Design | Pending |
| PAG-03 | P1: Garantia de 7 dias com devolução e encerramento (AD-031) | Design | Pending |
| PAG-04 | P1: Um plano único, sem recorrência (AD-032) | Design | Pending |
| PAG-05 | P1: Gateway Asaas em checkout próprio + NF nativa (AD-033) | Design | Pending |
| PAG-06 | P1: Buy-then-activate por webhook + matrícula 12 meses (AD-034) | Design | Pending |
| PAG-07 | P1: Login e-mail+senha, Google e link mágico (AD-034) | Design | Pending |
| PAG-08 | P1: Página de vendas (método + evidências + garantia + preço) (AD-034) | Design | Pending |
| PAG-09 | P1: Preço em config + desconto à vista no Pix/boleto (AD-053) | Design | Pending |
| PAG-10 | P1: Venda na janela de garantia é não-antecipável (AD-054) | Design | Pending |
| PAG-11 | P1: Fim da matrícula — avisos 30/7 dias, encerra acesso, preserva histórico (AD-055) | Design | Pending |
| PAG-12 | P1: Declaração 18+ no checkout (implementa DADOS-11/AD-047) | Design | Pending |
| PAG-13 | P1: Webhook verificado + idempotente + job de reconciliação (dimensão implícita) | Design | Pending |
| PAG-14 | P1: Onboarding meta + diagnóstico pulável → plano do 1º dia (AD-017/AD-034) | Design | Pending |
| PAG-15 | P2: Emissão de NF + relatório de conciliação (AD-033) | Design | Pending |
| PAG-16 | P3: Tiers/mensalidade com dado do flywheel (AD-032) | - | Pending |
| PAG-17 | P2: Eventos do funil pré-login, anônimos, sem virar caminho crítico da compra (AD-079/INFRA-12) | Design | Pending |

**ID format:** `PAG-NN`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 17 requisitos, 0 mapeados a tasks (Specify), 0 sem cobertura de story.

---

## Success Criteria

- [ ] Um visitante compra informando só o e-mail e chega ao plano do 1º dia na mesma sessão, sem
      intervenção humana.
- [ ] Nenhum pagamento confirmado fica sem conta: webhook duplicado gera uma conta só, e webhook perdido é
      recuperado pela reconciliação.
- [ ] Pedido de reembolso dentro de 7 dias devolve o dinheiro e encerra o acesso; fora da janela, recusa
      com mensagem clara.
- [ ] Nenhuma venda dentro da janela de garantia aparece como antecipável.
- [ ] Matrícula vencida bloqueia o conteúdo e preserva o histórico; renovar traz tudo de volta.
- [ ] Toda compra confirmada tem nota fiscal referenciada, e falha de emissão nunca bloqueia o aluno.
- [ ] Trocar o preço na configuração não afeta matrículas já vendidas.
- [ ] O funil pré-login é mensurável ponta a ponta sem nenhum dado pessoal, e bloquear o analytics no
      navegador não impede ninguém de comprar.
