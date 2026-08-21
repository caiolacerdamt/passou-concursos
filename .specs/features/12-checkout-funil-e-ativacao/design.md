# SPEC 12 — Design: checkout, funil de venda e ativação

**Status:** Draft para execução

**Ritual:** A — design explícito, tarefas atômicas, gates por task e verificador
independente com sensor de mutação ao final.

## Decisões de desenho

### 1. Fonte de verdade e fronteiras

- O Postgres é a fonte de verdade para preço vendido, aceite, cobrança, eventos,
  fatura, estado do pagamento e matrícula. O Asaas é a fonte de verdade para o
  estado externo da cobrança; a reconciliação compara os dois.
- A ativação é paga-primeiro: nenhum formulário público cria conta ou matrícula.
  O webhook confirmado, ou a reconciliação, inicia a ativação.
- O servidor é o único ponto que acessa Supabase com chave de serviço, Asaas e
  PostHog. O navegador fala apenas com páginas próprias e rotas próprias.
- A página de vendas é a `/` pública existente, agora substituída pelo conteúdo
  honesto do método. `/checkout`, `/termos` e `/privacidade` também são públicas.
  O restante continua privado por lista de permissão no `proxy.ts`.

### 2. Modelo de dados

A migration `pagamentos` cria as tabelas abaixo, todas sem escrita para `anon` e
`authenticated`:

| Tabela | Papel | Retenção |
| --- | --- | --- |
| `pagamentos` | Uma tentativa de compra, com e-mail, valor congelado, meio, referências Asaas, estado e datas | Exceção fiscal do apagamento |
| `pagamento_aceites` | 18+, versão dos termos e timestamp do aceite ligado ao pagamento | Exceção contratual/fiscal |
| `pagamento_eventos` | ID do evento Asaas, tipo, cobrança relacionada e resultado mínimo de processamento | Retido pelo necessário para idempotência/diagnóstico |
| `pagamento_transicoes` | Log append-only das mudanças da máquina de estados | Exceção fiscal ligada ao pagamento |
| `faturas` | Referência da cobrança e da nota fiscal emitida/agendada | Exceção fiscal do apagamento |
| `pagamento_pendencias` | Fila de ativação, NF, reconciliação ou alerta para retry | Retida com o pagamento |

`pagamentos.estado` será enum e terá exatamente estes estados de negócio:

```text
pendente -> confirmada -> ativada
pendente -> expirada
confirmada -> reembolsada
ativada -> reembolsada
```

O banco rejeita qualquer outra transição, inclusive reembolso antes da
confirmação. O caminho `ativada -> reembolsada` é a extensão necessária para a
garantia após a conta ter sido criada; o contrato público continua exibindo a
sequência `pendente → confirmada → ativada`.

O registro de evento é protegido por `unique(evento_id)`. A rota insere o evento
antes de processar. Evento repetido vira no-op; evento novo que falha fica com
resultado de falha e abre pendência, para a reconciliação retentar sem criar
segunda conta.

O claim de ativação será uma operação condicional no banco. Só uma execução pode
reservar a linha `confirmada`; uma reserva abandonada pode ser recuperada pela
reconciliação depois de um intervalo operacional. A criação de usuário é externa
ao Postgres, por isso a fila é necessária para não esconder uma ativação parcial.

### 3. Checkout e integração Asaas

O checkout próprio valida com Zod no servidor:

- e-mail normalizado;
- meio `CREDIT_CARD`, `PIX` ou `BOLETO`;
- declaração afirmativa de 18+;
- aceite dos termos com versão e timestamp;
- valor lido do catálogo de configuração no momento da criação.

O cartão usa 12 parcelas; Pix e boleto usam o valor à vista configurado. O
pagamento recebe uma referência externa estável com o UUID interno, e o preço
vendido é copiado para `pagamentos`, portanto mudar a configuração depois não
altera uma compra já criada.

O adaptador `GatewayDePagamento` esconde o HTTP. A implementação Asaas usa
`ASAAS_API_KEY`, `ASAAS_API_URL` e `ASAAS_WEBHOOK_TOKEN` somente no servidor. A
criação usa os endpoints diretos de cobrança para manter a jornada no domínio
próprio, sem depender da página hospedada do Asaas. Respostas de Pix/boleto e
links de acompanhamento ficam em `/checkout/resultado/[id]`, nunca em parâmetros
com e-mail ou CPF.

O requisito de “só e-mail” é preservado na primeira etapa do funil. Se a conta
Asaas exigir dados cadastrais para o pagador, o formulário pede apenas os campos
exigidos pelo provedor e os valida; não há data de nascimento e não há valor
fictício. Essa pendência de contrato/cadastro do Asaas permanece externalizada na
seção de Assumptions da SPEC.

Falha de criação mantém a tentativa `pendente` com erro sanitizado e devolve ao
checkout com e-mail e meio preservados, permitindo trocar Pix, boleto ou cartão.
Analytics nunca decide se a compra deu certo.

Referências do contrato externo usadas no adaptador: [criar cobrança Asaas](https://docs.asaas.com/reference/criar-nova-cobranca),
[autenticação da API](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1) e
[token de webhook](https://docs.asaas.com/docs/webhooks-3).

### 4. Webhook, ativação e reconciliação

`POST /api/webhooks/asaas` lê o corpo bruto, compara `asaas-access-token` com o
segredo configurado usando comparação de tempo constante e só então faz parse do
JSON. O corpo bruto nunca vai para logs. Eventos desconhecidos são registrados
como ignorados e alertados; eventos válidos fora de ordem são registrados como
rejeitados e não alteram a matrícula.

Para pagamento recebido:

1. localizar a cobrança por ID Asaas ou referência interna;
2. gravar o evento idempotente;
3. mudar `pendente` para `confirmada`;
4. reservar a ativação;
5. localizar ou criar o usuário Supabase pelo e-mail;
6. criar a matrícula de 12 meses usando `produtos.meses_de_acesso`;
7. enviar o fluxo de definição de senha;
8. ligar pagamento ao usuário/matrícula e mudar para `ativada`;
9. registrar a fatura e tentar agendar a NF sem bloquear o acesso;
10. em qualquer falha após a confirmação, abrir `pagamento_pendencias` e alertar.

A criação de usuário é idempotente por e-mail; a matrícula continua protegida
por `matriculas_uma_ativa_por_aluno`. O job de reconciliação consulta cobranças
pagas do Asaas para pagamentos locais pendentes e repete a mesma função de
ativação. Ele também expira pendências vencidas. O job não roda em serverless;
fica como script chamado por GitHub Actions, seguindo AD-035/AD-036.

### 5. Garantia e reembolso

`src/modules/pagamentos/garantia.ts` terá funções puras para contar dias
corridos desde `confirmado_em`, calcular os dias restantes e explicar a recusa.
O pedido autenticado grava solicitante, timestamp e meio. O servidor só chama o
Asaas dentro da janela de sete dias; depois da confirmação de reembolso, marca o
pagamento como `reembolsado`, muda a matrícula para `reembolsada` e o paywall
fecha o acesso. A tentativa antes da confirmação é rejeitada pela máquina do
banco e reportada.

O histórico financeiro e a fatura não são apagados quando o aluno pede
esquecimento na SPEC 14. Essa exceção será registrada em
`src/modules/lgpd/grupo-1.ts` nesta spec, antes da rotina de apagamento existir.

### 6. Analytics do funil

O navegador chama apenas `POST /api/analytics`. A rota aceita uma allowlist de
quatro eventos:

```text
pagina_vista
checkout_iniciado
meio_escolhido
pagamento_confirmado
```

As propriedades permitidas são apenas `meio` com enum fechado; página vista e
checkout iniciado não têm propriedades. A rota descarta e registra como
rejeitados e-mail, nome, CPF, telefone, ID de usuário, ID de pagamento e
qualquer chave desconhecida. Sem `POSTHOG_KEY` ou com PostHog indisponível,
responde sucesso local e não interrompe a compra. Não há session replay, script
de analytics de terceiro no navegador ou `user_id`.

`flag.m9.analytics_logado` nasce `false` no catálogo. Nenhum componente da
superfície logada emitirá evento enquanto a flag não for explicitamente tratada
em uma spec posterior.

### 7. Página e acessibilidade

A página `/` mostra método, evidências da base científica sem prometer aprovação,
preço parcelado, preço à vista, garantia, termos, privacidade e o estado atual
do produto. O layout reutiliza `Shell`, é mobile-first e não cria largura fixa.
O checkout usa labels, mensagens não técnicas, preserva a escolha após erro e
não imprime resposta bruta do Asaas. `/termos` e `/privacidade` são páginas
públicas de texto inicial, com aviso de revisão jurídica pendente.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Token do webhook exposto ou evento não autenticado | Segredo só no servidor, comparação constante, parse depois da autenticação e teste de rota |
| Evento duplicado cria duas contas | `unique(evento_id)`, claim condicional e índice de uma matrícula ativa |
| Auth criada e matrícula não criada | Pendência visível, alerta e reconciliação recuperável |
| Analytics derruba o checkout | Rota isolada, timeout curto, erro engolido no cliente e compra sem dependência |
| Preço alterado depois da compra | Valor e desconto congelados na linha de `pagamentos` |
| Dado cadastral inventado para satisfazer a API | Adaptador recusa falta de campo exigido; UI pede o campo real ou bloqueia com mensagem clara |
| Fatura/NF falha depois do pagamento | Registro da cobrança permanece, pendência de NF é separada da ativação e alerta operacional |

## Evidência esperada

- testes unitários para preço, estados, validação, assinatura, allowlist,
  garantia, adaptador HTTP e reconciliação com gateway falso;
- testes de banco para enum, constraints, transições, idempotência, fila, RLS,
  retenção e criação de matrícula;
- teste de renderização da página, checkout, termos, privacidade e resultado;
- `npm run lint`, `npm run test:unit`, `npm run test:db` e `npm run build` no gate
  final;
- verificador independente conferindo todos os Success Criteria da SPEC com
  evidência `arquivo:linha` e sensor de mutação scratch.

