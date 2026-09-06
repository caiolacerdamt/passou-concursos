# SPEC 37 — tasks (Ritual B)

> Ritual **B**: o design mora aqui no topo, não há `design.md`. No fim do arquivo entra o relatório do
> **Verificador independente curto** — só os *Success Criteria*, com evidência `file:line`, sem sensor
> de mutação.

## Design (embutido)

### A decisão de forma: duas camadas, nenhuma cópia

`topicos` **já é** o assunto canônico. Ele é o átomo onde `questoes.topico_id` e o snapshot de
`tentativas` gravam, e o AD-139 não pede outro lugar — pede que ninguém mais grave em nome de matéria.
Então a camada de dentro **não muda de schema**: `materias → topicos` continua sendo a taxonomia
canônica (dois níveis, o teto registrado como assumption na spec).

A camada de fora é nova e é só nomenclatura + agrupamento:

```
concursos (orgao, cargo)  1:1  perfil_concurso      ← banca, edital, data_prova, formato ficam onde estão
  └─ concurso_materias (nome e ordem DO EDITAL dele)
       └─ concurso_materia_assuntos → topicos       ← mapa, não árvore: nenhuma taxonomia duplicada
```

Um `topico` pode estar sob **Vendas e Negociação** no BB e sob **Atendimento Bancário** na CAIXA;
renomear a linha de um concurso não toca no outro porque o nome vive na linha do concurso, não no
tópico. `unique (concurso_id, topico_id)` garante que dentro de um mesmo concurso o assunto tem um pai
só — entre concursos, não (RAIOX-19 AC5).

**Por que `concursos` é tabela nova e não `perfil_concurso` renomeado.** `perfil_concurso` é lido hoje
por `raiox_peso_topico`, `raiox_projecoes`, `raiox_projecoes_materia`, `trajetoria.ts` e
`raiox/index.ts`. Renomear ou mexer nas colunas dele arrisca o "flag desligada = hoje". A tabela nova
carrega só o que não existia — chave natural `(orgao, cargo)`, visibilidade e o edital — e aponta 1:1
para o perfil. Consequência boa e barata: **a projeção já é por concurso**, porque
`raiox_projecoes(perfil_concurso_id, …)` e cada concurso tem o seu perfil (RAIOX-19 AC2). O que estava
errado nunca foi a escrita da projeção — era a **leitura**, que casava por `p.ativo`.

### O caminho da leitura passa a ser o aluno

| Antes | Depois |
| --- | --- |
| `raiox_peso_topico` (view, global, `p.ativo`) | `raiox_peso_do_aluno(user_id)` — a view continua existindo intacta, para o legado e para o fallback |
| `gera_plano_do_dia` junta a view em 6 pontos | junta `raiox_peso_do_aluno(v_aluno.user_id)` nos mesmos 6 pontos |
| `consultarRaioX()` lê o perfil `ativo` | `consultarRaioX(cliente, userId?)` resolve o perfil pelo concurso do aluno |

`concurso_do_aluno(user_id)` é o único lugar que decide, e é ele que segura o AC "flag desligada =
hoje": com `flag.m5.multi_concurso` desligada ele **ignora** `perfil_estudo.concurso_id` e devolve o
concurso do `perfil_concurso` marcado `ativo` — exatamente a linha que a view usa hoje. Com a flag
ligada, devolve a escolha do aluno; sem escolha, o padrão configurado (que também é o `ativo`).

### Visibilidade e prontidão

`oculto → elegivel → publicado`. `avaliar_prontidao_do_concurso()` é regra/SQL e só sabe subir
`oculto → elegivel`; **publicar é `publicar_concurso(concurso, operador, motivo)`**, que exige operador
ativo e grava `operador_acoes` (RAIOX-20 AC2, ação humana registrada). Publicado que cai abaixo do piso
**não** é despublicado: carimba `prontidao_alerta_em` (AC4). A lista do que falta é a view
`prontidao_do_concurso`, que reusa `param.m1.minimo_aptas_por_topico` e ordena por peso do Raio-X (AC3).

### Fundir assunto canônico

`fundir_assuntos_canonicos(origem, destino, operador, motivo)`: move `questoes`, `recursos_estudo`,
`base_referencia`, `topico_candidato` e o mapa dos concursos; **não toca em `tentativas`** — o snapshot
está congelado (AD-042) e é por isso que a fusão é segura. Nas projeções de aluno
(`dominio_topico`, `caderno_erros`, `revisao_agenda`, `revisao_evento`) move a linha quando o aluno não
tem linha no destino e **descarta** a do origem quando tem — o destino já é a verdade viva. O tópico
origem fica `ativo = false` com `fundido_em_topico_id` apontando para o destino, nunca apagado.

### Fora daqui, de propósito

Tela de fusão e de aprovação (SPEC 40), leitor de prova (38), conta de dois níveis e degraus de lastro
(39), tiers e preço por concurso (34). Nenhuma tela de operador nova entra nesta spec: as operações são
funções chamáveis por `service_role`.

---

## Tasks

- [x] **T1 — `concursos`, matérias do edital e o mapa.** Enum `concurso_visibilidade`; tabelas
  `concursos`, `concurso_materias`, `concurso_materia_assuntos` com a FK composta que prende o mapa ao
  concurso; `unique (orgao, cargo)`, `unique (concurso_id, topico_id)`; RLS ligada sem policy e
  privilégios revogados de `anon`/`authenticated`, como o resto do acervo.
- [x] **T2 — o perfil vigente vira o concurso nº 1.** Migração idempotente que cria um `concursos` a
  partir do `perfil_concurso` marcado `ativo` e semeia as matérias do edital com o nome e a ordem das
  `materias` ativas, mapeando os `topicos` ativos. Nenhum DROP, nenhum UPDATE destrutivo.
- [x] **T3 — configuração.** `flag.m5.multi_concurso` (false) e `param.m5.prontidao_piso` (0.8) no
  catálogo do M5, com descrição.
- [x] **T4 — a escolha do aluno.** `perfil_estudo.concurso_id` por referência; `concurso_do_aluno`,
  `perfil_concurso_do_aluno` e `escolher_concurso` (só concurso publicado; recusa com a flag desligada).
- [x] **T5 — o peso segue o aluno.** `raiox_peso_do_aluno(user_id)` com a mesma semântica da view
  (fallback 1.0 sem perfil, porteiro do `programa_edital`), resolvendo o perfil pelo concurso do aluno.
- [x] **T6 — o plano segue o aluno.** `gera_plano_do_dia` reescrito a partir do corpo vigente
  (`20260830130000`), trocando os 6 joins e o `exists(perfil_concurso ativo)` pela resolução por aluno.
- [x] **T7 — prontidão e publicação.** View `prontidao_do_concurso`,
  `avaliar_prontidao_do_concurso` e `publicar_concurso` com registro em `operador_acoes`.
- [x] **T8 — fundir assunto canônico.** `topicos.fundido_em_topico_id`/`fundido_em` e
  `fundir_assuntos_canonicos`.
- [x] **T9 — módulo `concursos` na aplicação.** Listar publicados, ler o concurso do aluno, escolher,
  e o edital (nome + ordem + assuntos) do concurso.
- [x] **T10 — o Raio-X fala o edital do aluno.** `consultarRaioX(cliente, userId)` resolve o perfil
  pelo concurso e, com a flag ligada e edital cadastrado, agrupa as linhas pelas matérias do concurso;
  com a flag desligada o caminho é o de hoje. Tela recebe o `userId`.
- [x] **T11 — testes.** `db`: escolha, isolamento entre dois concursos, histórico intacto na troca,
  flag desligada, prontidão/publicação, fusão. `unit`: catálogo, módulo `concursos`, agrupamento por
  edital no Raio-X.
