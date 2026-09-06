# SPEC 39 — Design

> Ritual **A**. Este documento decide a **forma**; `tasks.md` decide a ordem; `validation.md` decide o
> que prova. Requisitos: **RAIOX-16**, **RAIOX-17**, **RAIOX-18** · AD-138 (revoga RAIOX-04 AC2),
> AD-056 (decaimento e amortecimento), AD-057 (cortes por posição), AD-139 (assunto canônico × nome
> do edital).

## 1. O defeito, em uma linha

`recalcula_raiox` divide o peso do tópico pelo peso de **todas as questões ingeridas** daquela banca
(CTE `totais`, [20260821101000](../../../supabase/migrations/20260821101000_raiox_recalculo.sql)). O
denominador é o acervo. Ingerir 40 itens de uma prova e 15 de outra faz a primeira pesar 2,7× mais
sem que a banca tenha cobrado nada a mais.

## 2. A forma escolhida

```
peso(assunto) = peso_oficial(matéria) × share(assunto | matéria)
                └── nível 1 ─────┘        └── nível 2 ────────┘
                documento oficial          estimado dos itens reais
```

**Nível 1** vem da **grade declarada** (`prova_blocos`, SPEC 38) ou do **edital**
(`concurso_peso_materia`, nasce aqui). Nunca da contagem do acervo.
**Nível 2** vem das `etiquetas_de_item`, calculado **por prova**, combinado entre provas pela média
ponderada pelo decaimento, amortecido contra **a média daquela matéria** e normalizado para somar 1
dentro dela.

### 2.1 A prova é a unidade

Para cada prova `p` elegível e cada matéria `m`:

| símbolo | definição |
| --- | --- |
| `w_p` | `0.5 ^ ((ano_ref − ano_p) / meia_vida)` — AD-056, inalterado |
| `peso_oficial_p(m)` | `Σ peso_do_bloco(b)` dos blocos de `m` ÷ `Σ peso_do_bloco(b)` de **todos** os blocos de `p` |
| `n_p(m)` | itens de `p` etiquetados dentro dos blocos de `m` **e** dentro do programa do edital |
| `share_p(a\|m)` | itens de `p` etiquetados como `a` ÷ `n_p(m)` |

E a combinação entre provas:

```
peso_oficial(m)   = Σ w_p · peso_oficial_p(m)  ÷  Σ w_p          (todas as provas fonte)
share_bruto(a|m)  = Σ w_p · share_p(a|m)       ÷  Σ w_p          (só provas com n_p(m) > 0)
n_m               = Σ n_p(m)
```

**Nunca há denominador único somando itens de provas diferentes** — é a frase inteira da RAIOX-17 AC1,
e é o que faz a prova de 40 itens e a de 15 do mesmo ano pesarem igual.

### 2.2 O amortecimento, agora dentro da matéria

```
A_m   = quantos assuntos elegíveis a matéria tem no programa do edital
media = 1 / A_m                      ← a média DAQUELA matéria (AD-138), não a média geral
share(a|m) = ( n_ef · share_bruto(a|m) + k · media ) / ( n_ef + k )
```

`n_ef = n_m` quando a fonte é o próprio concurso, e `n_m × param.m5.peso_degrau_3` quando a
distribuição foi transferida de outro órgão — é assim que "prova de outro órgão entra com peso menor"
vira número: ela não muda o peso da matéria, ela só é **menos confiável** e por isso é puxada mais
forte para a média.

Como `share_bruto` soma 1 dentro da matéria e `A_m × (1/A_m) = 1`, o resultado já soma 1; a
normalização final existe só para absorver arredondamento. **Matéria sem nenhum item** (`n_m = 0`) cai
em `share = 1/A_m` para todos — partes iguais — e a linha nasce `amostra_baixa=true` (RAIOX-16 AC4).

### 2.3 O porteiro vem antes

Assunto fora de `programa_edital` **não entra no numerador nem no denominador** de `share_p`, e não
conta em `A_m`. Zero antes de qualquer multiplicação (RAIOX-16 AC5 / RAIOX-06 AC1). Não é um filtro na
saída: é a definição do conjunto.

### 2.4 Degraus de lastro (RAIOX-18)

O degrau é da **matéria**, e o assunto herda o da matéria dele. A regra é o **elo mais fraco**:

| peso da matéria vem de | distribuição interna vem de | degrau |
| --- | --- | --- |
| provas do próprio concurso | etiquetas do próprio concurso | **1** |
| provas do próprio concurso **ou** edital | etiquetas de outro órgão da mesma banca | **3** |
| provas do próprio concurso **ou** edital | nada — partes iguais | **2** |
| não existe | qualquer coisa | **4** |

O degrau 3 transfere **só o desenho de dentro da matéria**. O peso da matéria continua vindo do
documento do próprio concurso; sem documento próprio a linha cai para **4** (RAIOX-18 AC2), nunca
importa peso de outro órgão.

Cada linha persiste `degrau`, `n_provas`, `anos` (array) e `base_do_peso` (`pontos` | `itens` |
`edital` | `sem_dado`) — é o lastro que a tela lê em texto (AC3) e que a SPEC 40 usa no relatório.

### 2.5 Granularidade honesta na tela

`degrau ∈ {2,3,4}` ⇒ a tela **apresenta no nível da matéria e não exibe percentual por assunto**
(AC4). Não é ocultar dado: é não publicar decimal que a evidência não sustenta. Degraus diferentes
coexistem na mesma tela, cada linha com o seu rótulo (AC5).

## 3. Decisões de schema, e por que assim

### 3.1 `prova_blocos.materia_id` — a grade precisa saber de que matéria fala

A SPEC 38 gravou o bloco com `nome_impresso` livre ("LÍNGUA PORTUGUESA"). Para o nível 1, o bloco
precisa apontar para a **matéria canônica**. Duas vias, nesta ordem:

1. `prova_blocos.materia_id` preenchido (coluna nova) — a via explícita, do operador/SPEC 40;
2. a **moda das etiquetas** dentro da faixa do bloco — via automática, custo zero.

A via 2 sozinha não basta porque a RAIOX-16 AC4 fala de matéria **sem nenhum item etiquetado**: sem a
coluna, essa matéria não teria nome nem peso. A via 1 sozinha exigiria retrabalho manual em toda prova
já registrada. As duas juntas cobrem os dois estados.

**Bloco cuja matéria não se resolve por nenhuma das vias continua no denominador** de
`peso_oficial_p` e não soma para matéria nenhuma. O peso "some" da tela em vez de ser distribuído a
esmo — a soma dos pesos das matérias fica abaixo de 1 e isso é a verdade daquela prova.

### 3.2 `concurso_peso_materia` — o peso declarado pelo edital

Tabela nova `(concurso_id, materia_id, peso_declarado, base)`. É o nível 1 do **degrau 2**: concurso
recém-aberto, com edital e sem prova.

Por que na matéria **canônica** e não em `concurso_materias`: a projeção inteira (`raiox_projecoes`,
`raiox_projecoes_materia`, `raiox_peso_topico`) é de grão canônico, e uma `concurso_materia` do edital
pode mapear assuntos de mais de uma matéria canônica. Colocar o peso na camada do edital obrigaria a
**estimar** como reparti-lo — exatamente o que o nível 1 existe para não fazer. O nome do edital
continua sendo a camada de fora (AD-139) e continua só apresentação.

### 3.3 O que **não** muda

- A assinatura de `raiox_peso_topico` e de `raiox_peso_do_aluno`: `(topico_id, peso)`. O motor do M4
  não é tocado.
- `raiox_projecoes` e `raiox_projecoes_materia` **ganham colunas**, não perdem nenhuma. `peso`,
  `taxa_bruta`, `n_questoes`, `tendencia` e `amostra_baixa` continuam existindo com o mesmo tipo.
- O `check (peso between 0 and 1)` continua válido: `peso_oficial` soma ≤ 1 entre as matérias e
  `share` soma 1 dentro de cada uma.
- Nada aqui lê `tentativas` (RAIOX-14). O recálculo continua job agendado, com `pg_try_advisory_xact_lock`.

### 3.4 O que muda de significado, e está declarado

| coluna | antes | agora |
| --- | --- | --- |
| `taxa_bruta` | participação da questão no acervo da banca | `peso_oficial(m) × share_bruto(a\|m)` — antes do amortecimento |
| `n_questoes` | questões reais publicadas do tópico | **itens etiquetados** do assunto nas provas fonte |
| `amostra_baixa` | `n_questoes < piso` | `n_m < piso` **ou** degrau ≥ 2 |

`n_questoes` passa a contar etiqueta e não questão porque a unidade de **medição** é a etiqueta
(AD-138); a questão continua sendo a unidade de **treino** e nada no M4 muda.

## 4. Provas elegíveis

Fonte: `provas_medidas` (SPEC 38 — grade lida, sem conferência pendente, um caderno por
`(banca, ano, orgao, cargo)`) **com** `cobertura >= param.m1.cobertura_minima`.

- **próprias**: `orgao` e `cargo` iguais aos do `concursos` do perfil (quando não há linha em
  `concursos`, cai para o `orgao` do `perfil_concurso` e qualquer cargo);
- **vizinhas** (degrau 3): mesma banca do perfil, `(orgao, cargo)` diferente.

Prova abaixo do piso não entra e aparece em `provas_pendentes_de_ingestao` (RAIOX-17 AC2). Caderno
irmão já entra uma vez só, pelo `distinct on` de `provas_medidas` (RAIOX-17 AC3).

## 5. Tendência

Mesma forma de antes (duas janelas, AD-056), agora sobre a **contribuição por prova**: a média de
`peso_oficial_p(m) × share_p(a|m)` na janela recente contra a janela anterior. Sem prova em alguma das
janelas → `estavel`. Não é sinal novo; é o sinal antigo lido na unidade nova.

## 6. Superfície da tela

`DadosRaioX` ganha, por linha de matéria e de tópico: `degrau`, `nProvas`, `anos`, `baseDoPeso` e o
texto de lastro montado no servidor. A tela:

- exibe o texto do lastro em toda linha de matéria;
- **não** renderiza a lista de percentuais por assunto quando `degrau ≠ 1` — no lugar entra a frase que
  diz por que não há detalhe;
- mantém a leitura por matéria intacta para o degrau 1.

## 7. Riscos aceitos

| risco | mitigação |
| --- | --- |
| Bloco sem matéria resolvida derruba a soma dos pesos abaixo de 1 | é a verdade da prova; a tela normaliza para exibição e o lastro diz quantas provas sustentam |
| `n_questoes` muda de significado sem mudar de nome | registrado em §3.4 e no `comment on column` |
| Piso de cobertura em 0,9 sem calibração | herdado da SPEC 38, mesma dívida, mesmo lugar |
| Concurso sem `cargo` casado com prova de cargo diferente | a chave natural do concurso é `(orgao, cargo)`; casamento é exato, e o que não casa vira degrau 3 ou 4 |
