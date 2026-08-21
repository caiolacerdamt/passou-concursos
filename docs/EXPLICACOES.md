# Fábrica de explicações

Este job gera explicações pré-computadas para questões que já têm gabarito oficial. Ele não publica
questões sozinho: a publicação continua protegida pelo banco e depende da explicação aprovada, da
proveniência, do gabarito e das revisões exigidas.

## O que ele faz

Para cada questão vigente sem explicação aprovada, o job:

1. procura um documento `conferido` do tópico; documento `oficial` vence `resumo_nosso`;
2. se não houver documento, monta uma fonte mínima com proveniência, enunciado, alternativas e gabarito;
3. envia a questão e a referência juntas ao gateway de IA;
4. confere a saída estruturada por código: alternativa contra o gabarito e cada trecho citado contra o
   documento, ignorando somente caixa, acentos, pontuação e espaços;
5. grava uma explicação aprovada ou coloca o motivo na fila única `questao_revisoes`.

Uma explicação rejeitada fica fora de vigência. Saída que nem respeita o formato estruturado não é
gravada como explicação. A chave de deduplicação é a questão, a versão e a versão do pedido; repetir o
job não cria uma segunda explicação nem reenvia uma geração já registrada no gateway.

O banco abre automaticamente uma pendência de revisão para questão real abaixo do piso de confiança,
para a amostra configurada e para origem gerada por IA. Essa pendência nasce antes da publicação; a
porta de publicação continua exigindo uma decisão humana aprovada. Quando a fonte é mínima, há ainda
uma verificação independente que rejeita no texto marcadores de norma, prazo, percentual ou regra
externa, mesmo que a IA não os declare no campo próprio.

## Operação manual

Pré-requisitos:

- `DATABASE_URL` do projeto Supabase de desenvolvimento ou do ambiente autorizado;
- `OPENAI_API_KEY` no `.env` local ou nos segredos do GitHub;
- uma linha válida de `param.m2.matriz_de_modelos` para `explicacao`, com `batch: false`, porque este
  job chama o gateway uma questão por vez;
- preços da matriz, se o custo quiser aparecer preenchido em `ia_geracoes`.

Confira a matriz com:

```bash
npm run ia:matriz
```

Execute localmente depois de cruzar o gabarito:

```bash
npm run jobs:explicacoes
```

O mesmo comando pode ser disparado em **Actions → Fábrica de explicações → Run workflow**. O workflow
é manual para não gerar custo sem uma decisão do operador.

Sem `OPENAI_API_KEY`, o job sai com sucesso sem abrir conexão. Isso deixa intactos o banco de questões,
o plano e as demais superfícies que não dependem de IA. Falha de banco, configuração ou gateway sai
vermelha e é reportada; rode novamente depois de corrigir a causa.

## Revisão no Supabase Studio

A fila é operada pelo Studio nesta spec. Procure `public.questao_revisoes` filtrando
`status = 'pendente'`. Cada linha traz `motivo`, `prioridade`, `questao_id`, `questao_versao` e,
quando decidida pelo operador, `decidido_por` e `decidida_em`. A decisão deve ser registrada pela
função SQL `public.registrar_decisao_questao_revisao`; não altere a linha diretamente.

O Studio também permite conferir `public.explicacoes`: somente `status = 'aprovada'` e `vigente = true`
podem satisfazer a porta de publicação. A tela de operação e a tela do aluno entram em specs futuras.

## O que testar manualmente

Com uma questão de teste e uma referência conferida, rode o job duas vezes. A primeira execução deve
criar uma linha aprovada; a segunda deve informar que nada novo precisa ser gravado. Altere um trecho
da resposta de teste para um texto que não esteja na referência: o resultado deve ficar rejeitado e a
fila deve receber um motivo que começa com `explicacao_`.
