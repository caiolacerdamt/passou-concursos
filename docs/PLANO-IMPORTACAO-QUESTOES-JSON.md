# Plano de implementação — importação direta de `questoes.json`

## Objetivo

Importar as questões oficiais já existentes em `questoes.json` para o acervo do
Supabase, sem chamar a API da OpenAI, usando:

- o gabarito definitivo que já está no próprio JSON;
- a taxonomia consolidada a partir dos dois levantamentos de editais;
- deduplicação por prova + número oficial da questão;
- o schema e as travas já entregues nas SPECs 04, 09, 10 e 15.

Este é um plano operacional da SPEC 09/10, não uma nova fábrica de extração por
PDF e não uma nova chamada de IA.

## Regra de execução com subagents

Se a sessão dividir a classificação ou as tarefas de implementação entre
subagents, aplicar estas regras:

- usar os subagents nativos da sessão atual do Codex;
- não usar Orca, `orca-cli`, agentes remotos ou worktrees externos;
- usar o modelo `gpt-5.6-luna`;
- usar `reasoning effort = max`;
- confirmar no despacho que o modelo e o esforço efetivos são esses; se a
  interface não permitir selecionar essa configuração, parar e informar o
  usuário em vez de trocar silenciosamente de modelo;
- essa regra vale somente para os agentes desta execução e não deve virar nome
  de modelo hardcoded no código, nos testes ou na configuração do produto.

O agente principal continua responsável por integrar os resultados, rodar as
validações e decidir quando o job de escrita no banco pode ser executado.

## Retrato da entrada

O script de auditoria já confirmou:

- 1.395 registros;
- 24 cadernos de prova, referentes a 20 concursos/editais;
- 1.281 questões de múltipla escolha;
- 114 questões de certo/errado;
- 20 questões anuladas;
- 1 questão com gabarito alterado;
- todas com `natureza = real`;
- todas com `assunto` vazio — a classificação será feita pelo mapa de tópicos;
- 23 referências de imagem e 24 referências de PDF no JSON;
- os 47 arquivos locais referenciados já foram copiados para o projeto,
  preservando `imagens/...` e `fontes/entrada/...`.

## Decisões do plano

1. **Sem OpenAI.** O job usa apenas Node/TypeScript, `pg` e o banco. Não importa
   o gateway de IA e não exige `OPENAI_API_KEY`.

2. **JSON é a fonte dos dados da questão.** Texto, alternativas, prova, número,
   situação do gabarito e proveniência vêm do JSON. O script não recalcula nem
   “confere por opinião” a alternativa correta.

3. **Taxonomia vem de um mapa fechado.** A lista de matérias e tópicos será
   montada a partir do documento detalhado por edital, usando o documento
   consolidado como conferência. O importador só aceita tópico que esteja nesse
   mapa; ele não cria tópico com base em texto de questão.

4. **Duplicata é ignorada, não apagada.** Se já existir uma questão para a mesma
   `(prova_id, numero)`, o JSON será contado como `já existente` e não será
   inserido novamente. O schema atual bloqueia `DELETE` em `questoes`, então a
   substituição destrutiva não faz parte deste plano.

5. **Anulada permanece no acervo.** Questão com `gabarito_definitivo =
   "ANULADA"` recebe `anulada = true` e `resposta_correta = null`. Ela não entra
   no treino, mas preserva o histórico e pode contar para análises da prova.

6. **Nenhuma confiança artificial.** Como o JSON não foi produzido por este
   pipeline de IA, `confianca_ia` e `dificuldade` ficam nulos, salvo se já houver
   um valor confiável no dado. O job não grava `1.0` apenas para forçar uma
   publicação.

7. **Publicação continua obedecendo a porta existente.** A importação grava as
   questões como `rascunho` ou `em_revisao`. A publicação atual também exige
   explicação aprovada e, em alguns casos, revisão humana. O JSON não contém
   explicações. Portanto, importar no banco e disponibilizar imediatamente ao
   aluno são etapas diferentes.

## Arquivos novos

O trabalho será concentrado em poucos arquivos:

```text
scripts/data/taxonomia-concursos-bancarios.json
scripts/data/mapeamento-questoes.json
scripts/jobs/importar-questoes-json.mts
scripts/jobs/importar-questoes-json.test.ts
docs/PLANO-IMPORTACAO-QUESTOES-JSON.md
```

Não será criada uma tabela intermediária nem um serviço novo.

### `taxonomia-concursos-bancarios.json`

Catálogo humano da forma:

```json
{
  "materias": [
    {
      "nome": "Língua Portuguesa",
      "ordem": 1,
      "topicos": ["Interpretação de textos", "Crase", "Regência"]
    }
  ]
}
```

Os nomes gravados serão os nomes canônicos de `materias` e `topicos`. Tópicos
específicos de um edital continuam válidos no catálogo global, mas só serão
usados nas questões que tiverem sido mapeadas para eles.

### `mapeamento-questoes.json`

Mapa produzido pelo Codex em lotes, sem API externa:

```json
{
  "BB-2021-AC-A-001": {
    "materia": "Língua Portuguesa",
    "topico": "Interpretação de textos"
  }
}
```

O identificador do JSON é usado para auditoria. A identidade no banco continua
sendo `prova_id + numero`, conforme o schema existente.

### Arquivos de prova e imagem

O JSON também possui `fonte.arquivo_local` e `blocos[].arquivo`. Todos os
caminhos locais usados pelo lote foram copiados para a raiz do projeto:

```text
fontes/entrada/   # 24 PDFs das provas
imagens/originais/ # imagens extraídas da prova
imagens/processadas/ # imagens já processadas
```

As URLs em `fonte.url_oficial`, `fonte.url_gabarito_oficial` e
`fonte.url_resposta_recursos` são apenas metadados de proveniência. O job não
precisa acessá-las para importar o JSON.

Os PDFs também **não são necessários para o importador direto**: o texto, as
alternativas, o gabarito e os metadados já estão no JSON. Eles ficam somente na
máquina do operador, ignorados pelo Git, como auditoria e fallback caso seja
preciso conferir uma questão ou voltar ao fluxo original da SPEC 09.

## Fluxo de execução

```text
questoes.json
    ↓
auditoria sem escrita
    ↓
taxonomia + mapa de classificação
    ↓
catalogar/ localizar as 24 provas
    ↓
inserir somente questões ausentes
    ↓
cruzar gabarito definitivo por prova
    ↓
relatório de inseridas, duplicadas e pendências
    ↓
revisão/publicação pelo fluxo já existente
```

## Tasks

### 1. Auditar e adaptar o JSON

Criar o leitor NDJSON e validar antes de qualquer escrita:

- JSON válido linha a linha;
- `natureza = real`;
- `tipo_resposta` compatível com alternativas;
- gabarito em `A`–`E` ou `ANULADA`;
- número positivo e único dentro de cada prova;
- `fonte` com `source_id`;
- nenhuma questão sem enunciado ou alternativa necessária.

O comando terá `--dry-run`, que imprime os totais por prova e encerra sem abrir
transação de escrita.

### 2. Preparar a taxonomia e o mapa

O Codex classificará as questões usando a disciplina do JSON, o texto da
questão e a taxonomia dos editais. O resultado será gravado no mapa, e não
consultado por modelo durante a importação.

Regras:

- usar os tópicos detalhados por edital como base;
- não aplicar automaticamente um tópico de 2024 a todas as versões antigas;
- reutilizar o mesmo tópico quando o conceito for realmente comum;
- deixar sem importação ativa a questão cujo mapa esteja ausente ou ambíguo;
- o script falha antes de escrever se o mapa apontar para matéria/tópico que não
  existe no catálogo.

### 3. Garantir o catálogo de matérias e tópicos

O job fará `insert ... on conflict` para criar ou localizar as matérias e os
tópicos do arquivo de taxonomia, usando a chave de serviço do job.

Ele não aceitará sugestão livre vinda do JSON e não apagará nem renomeará um
tópico existente. Divergência de nome será reportada para ajuste do arquivo de
taxonomia antes da aplicação.

### 4. Catalogar as provas

Para cada grupo distinto do JSON, o job localizará ou criará uma linha em
`provas` usando:

```text
(banca, ano, instituicao, cargo, caderno_tipo)
```

`source_id`, URLs oficiais e o nome do arquivo serão preservados em
`provas.observacao` como JSON de auditoria. O `id` UUID da tabela continua sendo
gerado pelo banco.

Os valores de ano, banca, cargo e caderno usados na importação serão os do
JSON, não os números resumidos nos documentos de tópicos.

### 5. Inserir as questões sem IA

Para cada registro novo:

- localizar o `topico_id` pelo mapa fechado;
- converter `alternativas[].rotulo` para `alternativas[].letra`;
- converter `tipo_resposta` para `tipo_questao`;
- montar `fonte_citacao` a partir da prova e do número oficial;
- gravar `origem = 'real'`;
- gravar `status = 'rascunho'` para conteúdo textual pronto;
- gravar `status = 'em_revisao'` quando houver imagem ausente, classificação
  pendente ou outro problema que impeça o uso seguro;
- não definir `resposta_correta` diretamente no INSERT: o gabarito passará pela
  função oficial de cruzamento já existente;
- usar `on conflict`/consulta por `(prova_id, numero)` para tornar a execução
  retomável.

### 6. Preservar blocos de texto, fórmulas, tabelas e imagens

O schema atual guarda o enunciado como texto autocontido e imagens como
referências do Storage. O adaptador fará o mínimo necessário:

- `texto_base` e `paragrafo`: juntar ao enunciado na ordem original, sem repetir
  texto já presente;
- `formula`: preservar como bloco textual legível;
- `tabela`: converter para texto tabular legível;
- `imagem`: localizar o arquivo pelo caminho relativo copiado, subir para o
  Storage e preencher `imagens`;
- imagem referenciada mas ausente no futuro: registrar no relatório e manter a
  questão em `em_revisao`, sem inventar a figura.

Para este lote, as 23 imagens já estão disponíveis localmente. Os PDFs não
participam da execução normal; servem apenas para auditoria e conferência visual
quando necessário.

### 7. Cruzar o gabarito do JSON

Depois da inserção de cada prova, o job montará os itens:

```text
numero + resposta + anulada
```

e chamará `public.cruzar_gabarito(...)` com uma versão determinística, por
exemplo `json-definitivo:<source_id>`.

Assim o processo já existente trata corretamente:

- preenchimento inicial do gabarito;
- anuladas;
- execução repetida sem criar versão nova;
- eventual retificação futura como nova `questao_versao`.

### 8. Relatório final e verificação

O job deverá produzir, por prova e no total:

- lidas;
- inseridas;
- já existentes;
- anuladas;
- sem classificação;
- recusadas por formato;
- imagens ausentes;
- gabaritos preenchidos;
- conflitos.

O comando termina com erro se houver questão inválida, mapa ausente ou conflito
de gabarito não resolvido. Duplicata já existente é apenas contada e não é erro.

## Verificações de aceite

- Rodar `--dry-run` não altera o banco e não lê `OPENAI_API_KEY`.
- Uma segunda execução não cria prova, tópico ou questão duplicada.
- Nenhuma questão existente é apagada.
- As 1.395 linhas são contabilizadas, mesmo quando algumas são ignoradas por
  duplicidade.
- Cada questão importada tem proveniência completa.
- Toda questão não anulada tem gabarito válido; toda anulada fica com
  `anulada = true`.
- Questões de certo/errado ficam sem alternativas.
- O número da questão usado no banco é `numero_original`.
- A questão alterada usa o gabarito definitivo do JSON, não o preliminar.
- O mapa só aponta para tópicos canônicos existentes.
- Nenhuma chamada ao gateway de IA ocorre no job.
- Imagens ausentes aparecem no relatório e não são publicadas silenciosamente.
- Os 47 arquivos locais referenciados pelo JSON são encontrados antes da escrita.
- `npm run test:unit` passa; o teste de banco cobre uma execução, uma retomada e
  a deduplicação real.

## O que fica fora deste plano

- buscar ou validar novamente os editais na internet;
- corrigir manualmente o conteúdo das questões;
- recalcular gabarito;
- gerar explicações para 1.395 questões;
- criar OCR ou extrair novas imagens dos PDFs;
- apagar questões antigas do banco;
- implementar uma nova tela de importação.

## Ponto de publicação

O plano resolve a entrada correta no banco. Para aparecer no site, ainda será
necessário passar pela porta de publicação atual, que exige explicação aprovada
e revisão quando aplicável.

Se a decisão for disponibilizar imediatamente as questões oficiais sem gerar
explicações pela API, isso deve ser tratado como uma alteração separada e
explícita da regra de publicação. Não será feito por meio de um valor falso em
`confianca_ia`, de uma explicação vazia ou de um `UPDATE` direto que burle a
trava.
