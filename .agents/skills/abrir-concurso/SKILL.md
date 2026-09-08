---
name: abrir-concurso
description: Abrir um concurso novo no Passou Concursos — pesquisar edital e provas em fonte oficial, conduzir as confirmações do operador e entregar o Raio-X com o lastro medido. Use quando o pedido for "abra o concurso X", "cadastre o concurso Y", "quero o Raio-X da CAIXA", ou quando alguém pedir para catalogar edital ou provas de um órgão/cargo. Funciona igual em Codex e em Claude Code.
---

# Abrir um concurso

Você conduz a conversa. **O comando é a verdade.**

A pesquisa acontece na **sua sessão**, com a ferramenta de busca que você tiver
e consumindo o limite dela. O produto não tem provedor de busca, não tem chave
para isso e não vai ganhar uma (AD-145). Toda validação, toda escrita e toda
ordem passam por `npm run jobs:abrir-concurso`.

Entrada mínima: **órgão + cargo**. A banca é opcional — costuma estar no próprio
edital.

## As três portas

O fluxo para em três lugares e **espera uma pessoa**. Você nunca decide por ela,
nem "adianta" a decisão óbvia:

1. **Documentos** — o operador aprova ou rejeita cada link achado.
2. **Assuntos** — o operador decide, linha a linha, o que mapear, criar, fundir
   ou rejeitar. **Fusão nunca é automática.**
3. **Publicação** — o operador manda publicar, com motivo, e isso fica assinado.

## O roteiro

Rode tudo com `npm run jobs:abrir-concurso -- --acao <acao> ...`.

### 1. Veja onde você pode procurar

```
--acao dominios
```

Devolve a allowlist de fonte oficial. **Pesquise só dentro dela.** O que vier de
agregador é descartado pelo comando sem aparecer — não tente contornar isso, e
não mostre ao operador um link que você sabe que vai cair. A fonte legal é o PDF
da banca, do órgão ou do diário oficial (AD-003); agregador é ilegal aqui mesmo
quando tem o arquivo.

### 2. Abra a execução

```
--acao iniciar --concurso <uuid> --operador <uuid>
```

Idempotente: se a sessão caiu, rodar de novo devolve a **mesma** execução, no
estado em que ela parou. Não crie uma segunda.

### 3. Pesquise, na sua sessão

Procure, para aquele órgão e cargo:

- o **edital** vigente (ou o mais recente);
- os **cadernos de prova** das últimas edições — a meta operacional é 4.

**Se você não tem ferramenta de busca ou não tem rede: pare e peça as URLs
oficiais ao operador.** Nunca troque silenciosamente para uma API paga, e nunca
invente um link plausível.

Escreva o que achou num arquivo JSON:

```json
{
  "candidatos": [
    {
      "tipo": "edital",
      "url": "https://...",
      "titulo": "Edital nº 1/2026",
      "metadados": {}
    },
    {
      "tipo": "prova",
      "url": "https://...",
      "titulo": "Caderno tipo 1",
      "metadados": {
        "banca": "Cesgranrio",
        "ano": 2021,
        "orgao": "CAIXA",
        "cargo": "Técnico Bancário",
        "caderno": "Tipo 1"
      }
    }
  ],
  "faltantes": ["prova de 2018 — não achei em fonte oficial"]
}
```

Prova **exige** banca, ano, órgão e cargo: é a chave do catálogo-alvo. Edital não
precisa de nenhum deles. `faltantes` é honestidade, não desculpa — o que não
existe em fonte oficial é trabalho humano fora do sistema, e o relatório final
carrega a pendência em vez de escondê-la.

```
--acao registrar-achados --abertura <uuid> --operador <uuid> --entrada achados.json
```

### 4. Primeira confirmação

O comando devolve a lista com ID, título e URL de cada documento aceito, mais
quantos foram descartados. **Leve essa lista ao operador em texto, na conversa**,
e espere a resposta dele. Nada foi baixado ainda.

Com a decisão em mãos:

```json
[
  { "id": "<uuid>", "decisao": "aprovado" },
  { "id": "<uuid>", "decisao": "rejeitado" }
]
```

```
--acao decidir-documentos --abertura <uuid> --operador <uuid> --entrada decisao.json
```

Todo documento precisa de decisão — deixar um pendente segura a etapa, de
propósito. Só depois disso o download acontece.

### 5. Leia o programa do edital

```
--acao programa --abertura <uuid> --operador <uuid>
```

Devolve **só o trecho do conteúdo programático**, cortado localmente. Se o corte
não fechar, o comando sai com pendência e não emite uma linha do edital — nesse
caso peça ao operador as páginas do programa; **não peça o PDF inteiro**.

Não existe ação que devolva o texto de uma prova. Prova vai para a medição, nunca
para a conversa.

### 6. Monte a proposta

Do trecho, escreva as matérias do edital e os assuntos de cada uma:

```json
{
  "materias": [
    {
      "nome": "Língua Portuguesa",
      "ordem": 1,
      "peso": { "valor": 20, "base": "itens" },
      "assuntos": ["Crase", "Regência verbal"]
    }
  ]
}
```

`peso` é opcional: só preencha quando o edital **declarar** o número (questões,
pontos ou percentual). Não estime.

```
--acao propor-assuntos --abertura <uuid> --operador <uuid> --entrada proposta.json
```

O comando casa os nomes exatos com a taxonomia e calcula as quase-duplicatas por
código. Você não decide nada aqui.

### 7. Segunda confirmação

Leve as linhas ao operador. Para cada uma, ele escolhe:

- `mapear` — é o assunto canônico que já existe (`topico_id`);
- `criar` — é assunto novo (`materia_id` da matéria canônica);
- `fundir` — o que existe é duplicata: `topico_id` é o destino que fica,
  `origem_id` é o que some;
- `rejeitar` — não entra no edital.

```json
{
  "decisoes": [
    { "id": "<uuid>", "decisao": "mapear", "topico_id": "<uuid>" },
    { "id": "<uuid>", "decisao": "criar", "materia_id": "<uuid>" },
    { "id": "<uuid>", "decisao": "fundir", "topico_id": "<destino>", "origem_id": "<origem>" }
  ],
  "pesos": []
}
```

Em `pesos`, copie o bloco que `propor-assuntos` sugeriu — depois de o operador o
conferir.

```
--acao decidir-assuntos --abertura <uuid> --operador <uuid> --entrada decisao2.json --motivo "..."
```

Aplica o quadro inteiro numa transação. Uma linha inválida derruba tudo: não há
edital pela metade.

### 8. Meça as provas

```
--acao processar-provas --abertura <uuid> --operador <uuid>
```

Delega ao `medir-prova` da SPEC 38. Prova que falha aparece no resumo e não
derruba as outras.

### 9. Recalcule e leia o resultado

```
--acao recalcular --abertura <uuid> --operador <uuid>
--acao relatorio  --abertura <uuid>
```

O relatório diz, **matéria por matéria**, em que degrau o Raio-X ficou e o que
falta para subir. Leve-o ao operador como está.

### 10. Terceira confirmação

Só com o "pode publicar" dele:

```
--acao publicar --abertura <uuid> --operador <uuid> --motivo "<o que o operador disse>"
```

Concurso que não atingiu o piso de prontidão é recusado pelo banco. Isso não é
erro seu — é o relatório dizendo que falta acervo.

## Concurso que já existe no acervo

Antes de abrir uma execução para um concurso **que já está no banco** — provas
catalogadas em outra época, questões publicadas, Raio-X mostrando `0%` —, olhe o
que existe:

```
--acao inventario-legado --concurso <uuid>
```

**Somente leitura.** Ele não escreve nada, não funde linha nenhuma e não decide
qual prova pertence a qual concurso. O que ele mostra, prova por prova: quantas
questões vigentes e publicadas ela tem, quantas etiquetas, quantos itens já
medidos, o estado da grade, a cobertura, se ela já está vinculada ao concurso e
o que falta para ela entrar no Raio-X.

Três leituras que o relatório pede cuidado:

- **"órgão parecido"** é sugestão, não conclusão. Nome de cargo não prova
  equivalência — leve a lista ao operador e deixe **ele** dizer quais provas são
  daquele concurso.
- **duplicidades de chave** (a mesma edição catalogada com duas grafias de
  banca, por exemplo) aparecem como aviso. Não funda, não apague, não escolha
  sozinho: em geral a linha certa é a que **tem** questões.
- **arquivos locais** são listados só pelo nome, marcados como não confirmados.
  Nome de arquivo não é procedência: a origem oficial continua sendo a URL da
  banca, do órgão ou do diário oficial.

O vínculo entre prova e concurso nasce quando o operador aprova aquele documento
dentro de uma abertura (`decidir-documentos`). Não há outro caminho, e não há
comando de vincular à mão.

## Se você se perder

```
--acao relatorio --abertura <uuid>
```

O estado mora no banco, não no histórico do chat. Esse comando diz onde a
execução parou e qual comando vem agora — outra sessão retoma daí sem você.

## O que nunca fazer

- **Nunca** pesquise com API paga, provedor de busca ou tarefa nova de IA do
  produto. A busca é da sua sessão, ou é do operador.
- **Nunca** aprove documento, funda assunto ou publique concurso por conta
  própria — nem quando a resposta parecer óbvia.
- **Nunca** mostre ou registre um link de agregador.
- **Nunca** peça, cole ou leia o PDF de uma prova na conversa.
- **Nunca** invente banca, ano, peso ou URL para preencher um campo. Campo que
  falta vira `faltantes`.
