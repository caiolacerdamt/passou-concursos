# SPEC 38 — tasks (Ritual B)

> Ritual **B**: o design mora aqui no topo, não há `design.md`. No fim do arquivo entra o relatório do
> **Verificador independente curto** — só os *Success Criteria*, com evidência `file:line`, sem sensor
> de mutação.

## Design (embutido)

### A decisão de forma: a prova é lida três vezes, cada uma mais cara que a anterior

O AD-138 separa **medir** de **treinar**. Medir é `(prova, número, assunto)`. Este design põe as três
leituras em ordem crescente de custo, e cada uma só acontece quando a anterior não bastou:

| Passo | Custo | O que produz | Quando para |
| --- | --- | --- | --- |
| **1. grade** | zero (regex sobre o texto do PDF) | `prova_blocos` + `itens_declarados` | grade ilegível → `grade_status='ausente'`, fila humana |
| **2. separação** | zero (regex + sequência) | itens `(número, texto)` | fecha com a grade → segue sem modelo nenhum |
| **3. etiqueta** | ~R$ 0,02/prova | `etiquetas_de_item` | sempre custa — é a única chamada de modelo do caminho feliz |

A **reserva por modelo** (`separacao_de_itens`) entra só no passo 2 quando a contagem não fecha, e
fica **registrada na prova** (`separacao_via='modelo'`), nunca em silêncio.

### Por que a grade vem da página de instruções, e não do corpo

Medido nos PDFs de `fontes/entrada/`: a CESGRANRIO imprime a grade numa tabela da página de
instruções, sempre no mesmo formato — `"60 questões objetivas"` e uma linha por grupo com as faixas
coladas: `1 a 101,0 ponto cada11 a 201,0 ponto cada21 a 301,0 ponto cada`. O `1,0` colado no `10` é o
que obriga a regex a exigir **decimal na pontuação** e a deixar o fim da faixa preguiçoso — com a
pontuação inteira o casamento é ambíguo e a linha vira uma faixa `1 a 101`. É o único ponto sutil do
leitor, e tem teste próprio.

O **nome impresso** do bloco não sai dessa tabela: ali os nomes vêm colados (`Língua PortuguesaLíngua
Inglesa…`) ou quebrados em duas linhas (`Língua` / `Portuguesa`), e separar isso por regra é chute. O
nome sai do **corpo**: o último bloco de linhas em caixa alta antes do primeiro item da faixa —
`LÍNGUA PORTUGUESA`, `NOÇÕES DE PROBABILIDADE` + `E ESTATÍSTICA` (juntadas, porque são contíguas).
Cabeçalho de página (`CAIXA ECONÔMICA FEDERAL`) é descartado pela **contagem**, como a assumption da
spec mandou: linha em caixa alta que aparece em mais da metade das páginas é cabeçalho de página, não
de matéria. Sem lista fixa de nomes em lugar nenhum.

Nome não achado **não derruba a grade** — a faixa e a pontuação é que fazem o peso. O bloco fica com
`nome_impresso` nulo e aparece na fila da SPEC 40.

### A separação determinística, e por que a numeração de página não a quebra

A CESGRANRIO escreve o número do item numa linha só, acima do enunciado — e escreve o número da
página do mesmo jeito. Na página 4 da CAIXA 2021 o número `5` aparece **duas vezes**: o rodapé e o
item. A regra é sequencial e resolve isso sem lista de exceção: procurando o item `n`, o separador
olha todas as linhas que são só `n` **antes da primeira linha que é só `n+1`** e fica com a **última**.
O rodapé perde para o item porque vem antes dele.

Medido em 2026-09-06 sobre `fontes/entrada/`: CAIXA 2021 fecha **60/60** e não chama modelo; BB 2021
A/B/C separam 20 de 70 e caem na reserva — que é exatamente o cenário que o AD-138 registrou.

### O que a grade barra

`registrar_grade_declarada` compara a soma das faixas com o total declarado e **grava o veredito**:

- soma = total → `grade_status='lida'`;
- soma ≠ total, ou faixas sobrepostas → `grade_status='inconsistente'`, e a prova **sai** de
  `provas_medidas` (BANCO-15 AC5);
- nada legível → `grade_status='ausente'` e a prova entra em `grade_ausente_fila` (AC4). **Não existe
  caminho que infira grade** — a ausência de `insert into prova_blocos` fora dessa função é o AC.

`cobertura = itens_ingeridos ÷ itens_declarados`, onde `itens_ingeridos` é a contagem de
`etiquetas_de_item` da prova. É view (`cobertura_da_prova`), não coluna: coluna precisaria de gatilho
para não mentir.

### Etiqueta: quem vence quem

```
questão publicada  >  etiqueta humana  >  etiqueta de IA
```

- `gravar_etiquetas_ia` só toca linha `origem='ia'` ou inexistente. Reexecutar não duplica (é
  `on conflict (prova_id, numero)`) e não apaga correção humana (BANCO-14 AC4/AC5).
- `alinhar_etiquetas_com_questoes` sobrepõe o `topico_id` da questão publicada, e roda **dentro** da
  gravação. É o AC3: uma classificação só por item.
- `corrigir_etiqueta` grava `origem='humano'` + `operador_acoes`, e **recusa** item que já tem questão
  publicada — nesse item a correção certa é na questão, senão as duas classificações voltam a existir.

### Caderno irmão (BANCO-16 AC6)

`provas.caderno_irmao_de` aponta para o caderno principal. Índice único parcial
`(banca, ano, orgao, cargo) where caderno_irmao_de is null` garante **um** principal por chave natural,
e `provas_medidas` só mostra principal. O irmão continua ingerido e etiquetado; ele só não soma peso.

### Nada de PDF no transcript

O job `medir-prova` imprime **relatório**: contagens, veredito e custo. O texto do PDF nunca vai para
stdout. O agente lê o relatório; o PDF vive no disco do runner do GitHub Actions (AD-140).

### Fora daqui, de propósito

A conta do Raio-X sobre esses dados (SPEC 39), a busca dos PDFs em fonte oficial e as telas de operador
(SPEC 40), a extração completa de questão (SPEC 09/10, intacta) e o OCR (fila `precisa_ocr`, só o
roteamento entra aqui).

---

## Tasks

- [ ] **T1 — schema da medição.** Enums `grade_status`, `separacao_via`, `origem_etiqueta`; colunas
  novas em `provas` (`itens_declarados`, `grade_status`, `separacao_via`, `conferencia_motivo`,
  `caderno_irmao_de`); tabelas `prova_blocos` e `etiquetas_de_item` com unicidade por
  `(prova_id, numero)`; índice único do caderno principal; RLS ligada e privilégios revogados de
  `anon`/`authenticated`, como o resto do acervo.
- [ ] **T2 — as funções que ninguém contorna.** `registrar_grade_declarada` (o veredito da soma),
  `gravar_etiquetas_ia` (substitui só IA, nunca duplica), `alinhar_etiquetas_com_questoes`,
  `corrigir_etiqueta` (humano + `operador_acoes`), `vincular_caderno_irmao`; views
  `cobertura_da_prova`, `grade_ausente_fila` e `provas_medidas`.
- [ ] **T3 — configuração.** `param.m1.tolerancia_grade` (0), `param.m1.cobertura_minima` (0.9) e
  `param.m1.itens_por_pedido_de_etiqueta` (20) no catálogo do M1, com descrição e o registro de que
  os três calibram.
- [ ] **T4 — o leitor da grade declarada.** `grade.ts`: total declarado, faixas com pontuação, base
  `pontos`/`itens`, veredito de consistência. Teste com a linha colada da CAIXA e da BB.
- [ ] **T5 — o separador determinístico.** `itens.ts`: sequência com desempate por página, nome do
  bloco pelo corpo com descarte de cabeçalho de página por contagem, e a conferência contra a grade
  dentro da tolerância.
- [ ] **T6 — a etiqueta.** `etiqueta.ts`: instrução, schema de saída, lotes de N itens, casamento com
  o assunto canônico reusando `casarTopico`. Duas tarefas novas no gateway (`separacao_de_itens`,
  `etiqueta_de_item`) — **AD-141**, porque `tarefas.ts` proíbe `push` sem AD.
- [ ] **T7 — o comando.** `scripts/jobs/medir-prova.mts` com `grade`, `separar`, `etiquetar` e
  `relatorio`; retomável; relatório sem uma linha de PDF.
- [ ] **T8 — a reserva por modelo.** Quando o separador não fecha, `separacao_de_itens` refaz a
  separação e a prova registra `separacao_via='modelo'`; conferência contra a grade continua valendo e
  divergência acima da tolerância marca `conferencia_motivo`.
- [ ] **T9 — GitHub Actions.** `.github/workflows/medicao-de-prova.yml` + `npm run jobs:medir-prova`,
  no molde do `ingestao.yml` (AD-035/036).
- [ ] **T10 — os AC contra o banco.** `tests/db/spec38-medicao-de-prova.test.ts`: humano sobrevive à
  reexecução, questão publicada vence, soma inconsistente barra, caderno irmão não soma, cobertura.
- [ ] **T11 — fechar.** Custo medido anotado na spec, `ROADMAP.md`, `## Handoff` do `STATE.md`,
  `AD-141`, e o relatório do Verificador curto no fim deste arquivo.
