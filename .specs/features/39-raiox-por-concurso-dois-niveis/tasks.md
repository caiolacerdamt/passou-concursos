# SPEC 39 — Tasks

> Ritual **A**. O design está em [`design.md`](./design.md); o que prova está em
> [`validation.md`](./validation.md). Um commit atômico por task, Conventional Commits com requisito e
> AD no corpo.

- [x] **T1 — `prova_blocos.materia_id` e a via explícita da grade**
  Coluna `materia_id` (nullable, FK `materias`) em `prova_blocos`; `registrar_grade_declarada` passa a
  aceitar `materia_id` no objeto do bloco; função `vincular_bloco_a_materia(prova, ordem, materia)`
  para o caminho do operador. Nada mais escreve em `prova_blocos`.
  · RAIOX-16 AC2 · BANCO-15

- [x] **T2 — `concurso_peso_materia`: o peso que o edital declara**
  Tabela `(concurso_id, materia_id, peso_declarado, base)` + `registrar_peso_do_edital`. É o nível 1 do
  degrau 2. Privilégios iguais aos do resto do acervo: nem `anon` nem `authenticated`.
  · RAIOX-16 AC2 · RAIOX-18 AC1

- [x] **T3 — colunas de lastro nas duas projeções**
  `degrau`, `n_provas`, `anos`, `base_do_peso` em `raiox_projecoes` e `raiox_projecoes_materia`, com
  `comment on column` dizendo o que cada uma significa. Nenhuma coluna existente sai.
  · RAIOX-17 AC4 · RAIOX-18 AC1

- [x] **T4 — `provas_pendentes_de_ingestao`**
  View das provas com grade lida e cobertura abaixo de `param.m1.cobertura_minima`. É a lista que a
  RAIOX-17 AC2 exige quando a prova fica de fora.
  · RAIOX-17 AC2

- [x] **T5 — `param.m5.peso_degrau_3` no catálogo**
  Peso relativo da distribuição transferida de outro órgão. Default 0,5, dono `m5`, descrição dizendo
  que é calibração pendente.
  · RAIOX-18 AC2 · AD-078

- [x] **T6 — `materia_do_bloco`: a resolução em duas vias**
  Função que devolve `coalesce(bloco.materia_id, moda das etiquetas da faixa)`. Bloco irresolúvel
  devolve `null` e continua no denominador do peso oficial.
  · RAIOX-16 AC2

- [x] **T7 — `recalcula_raiox` reescrita: nível 1 × nível 2**
  Peso oficial por prova, share por prova, combinação por média ponderada pelo decaimento,
  amortecimento contra a média da matéria, porteiro antes da multiplicação, partes iguais para matéria
  sem item. Sem denominador único; sem `tentativas`; idempotente.
  · RAIOX-16 AC1/AC3/AC4/AC5 · RAIOX-17 AC1/AC5

- [x] **T8 — provas fonte, piso de cobertura e caderno irmão**
  Próprias por `(orgao, cargo)` do concurso, vizinhas por banca; piso aplicado na entrada; caderno
  irmão entra uma vez pelo `distinct on` de `provas_medidas`. Persiste `n_provas` e `anos`.
  · RAIOX-17 AC2/AC3/AC4

- [x] **T9 — degraus 1–4**
  Regra do elo mais fraco; degrau 3 transfere só o desenho de dentro da matéria; sem documento próprio
  a linha cai para 4. Tendência recalculada sobre a contribuição por prova.
  · RAIOX-18 AC1/AC2

- [x] **T10 — o lastro no DTO**
  `DadosRaioX` ganha `degrau`, `nProvas`, `anos`, `baseDoPeso` e o texto de lastro montado no servidor,
  por matéria e por tópico.
  · RAIOX-18 AC3

- [x] **T11 — a tela para na matéria quando o degrau manda**
  Texto do lastro em toda linha; sem percentual por assunto quando `degrau ≠ 1`; degraus diferentes
  coexistindo.
  · RAIOX-18 AC3/AC4/AC5

- [x] **T12 — gates e handoff**
  `test:unit`, `test:db`, `tsc --noEmit`, `eslint`. `STATE.md` §Handoff e a linha da SPEC 39 no
  `ROADMAP.md`.
