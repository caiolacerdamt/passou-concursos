# SPEC 04 — Verificação

**Veredito: PASS** · faixa verificada `5630e06..f2f1850` (8 commits de task + 1 de docs)
· gate: `lint` ✓ · `build` ✓ · **251 testes** (143 → 251, delta +108, 0 pulados)
· sensor de discriminação: **4/4 mutantes mortos**

> **Ressalva de método, registrada de propósito.** Esta verificação foi feita pelo **mesmo agente que
> escreveu o código** — o Verifier independente foi interrompido a pedido do sócio, por tempo. A
> separação autor ≠ verificador que a SPEC 02 e a SPEC 03 tiveram **não** existiu aqui, e o sensor
> rodou 4 mutações em vez das 6 planejadas. O que está abaixo é evidência real (mutação aplicada no
> banco, teste vermelho, mutação revertida), mas o viés de autoria não foi removido. **É a lacuna
> mais séria desta rodada** e está no topo dos gaps.

## Critérios de aceite

| Requisito | Evidência | Estado |
| --- | --- | --- |
| **BANCO-01 AC1** — real não publica sem `fonte_citacao` | `supabase/migrations/20260817115000_acervo_trava_de_publicacao.sql:20` · `tests/db/acervo-proveniencia.test.ts:18` (INSERT) e `:31` (UPDATE) | ✅ |
| **BANCO-01** — proveniência é o conjunto, não o campo | mesma migração `:31` (`?&` das 5 chaves) · `tests/db/acervo-proveniencia.test.ts:76` (falta cada chave, uma por vez) e `:99` (`{}`, string, array) | ✅ |
| **BANCO-01 AC2** — a fonte está disponível para exibição | `tests/db/acervo-questoes.test.ts:76` (lê as 5 chaves da própria linha, sem join) · `acervo-proveniencia.test.ts:170` (acompanha a versão nova) | ✅ |
| **BANCO-02** — `provas` com banca/ano/órgão/cargo + estado | `supabase/migrations/20260817112000_acervo_provas.sql:14` · `tests/db/acervo-provas.test.ts:45` (nasce `catalogada`), `:129` (todo o vocabulário de estado) | ✅ |
| **BANCO-05** (taxonomia) — matéria/tópico editáveis | `20260817110000_acervo_taxonomia.sql:44` · `tests/db/acervo-taxonomia.test.ts:148` (renomear e mover de matéria), `:177` (desativa em vez de apagar) | ✅ |
| **BANCO-05 P3 AC1** — candidato ≠ canônico | `20260817111000_acervo_topico_candidato.sql:18` (tabela separada) · `tests/db/acervo-taxonomia.test.ts` §topico_candidato (aprovado sem tópico e pendente com tópico, os dois recusados) | ✅ |
| **BANCO-09 AC3** — enums e colunas do AD-039/AD-040 | `20260817110000:19` (6 enums) · `20260817113000_acervo_questoes.sql:27` · `tests/db/acervo-taxonomia.test.ts:39` (valor por valor, na ordem) · `tests/db/acervo-questoes.test.ts` (12 restrições de formato) | ✅ |
| **BANCO-09 AC1** — embedding HNSW + fts PT | `20260817116000_acervo_busca.sql:32` (`vector(1536)`), `:60` (HNSW `vector_cosine_ops`), `:47` (`fts` gerada) · `tests/db/acervo-busca.test.ts:20`, `:88`, `:132` | ✅ |
| **BANCO-13** — versionamento + cosmética × substantiva | `20260817114000_acervo_questoes_versionamento.sql:26` · `tests/db/acervo-versionamento.test.ts:36`, `:60`, `:129` | ✅ |

### Os 4 Success Criteria da spec

| # | Critério | Prova |
| --- | --- | --- |
| 1 | Inserir questão real sem `fonte_citacao` e não conseguir publicá-la | `tests/db/acervo-proveniencia.test.ts:18` e `:31` — no INSERT **e** no UPDATE, que é o caminho realista |
| 2 | Criar versão nova e ver a anterior intacta | `tests/db/acervo-versionamento.test.ts:99` — compara enunciado, resposta e `mudanca_tipo` das duas versões |
| 3 | Reclassificar o tópico e nada mais mudar | `tests/db/acervo-questoes.test.ts:322` — troca `topico_id`, confirma que a versão continua 1 e existe uma linha só |
| 4 | `EXPLAIN` de busca por tópico + status usa índice | `tests/db/acervo-busca.test.ts:150` (sem Seq Scan) e `:172` (índice nominal, onde a escolha é inequívoca) |

### Edge cases do M1 que esta spec toca

| Edge case | Onde | Estado |
| --- | --- | --- |
| Mesma prova submetida duas vezes não duplica | `provas_alvo_unico` (`20260817112000:47`) + `questoes_numero_unico_na_prova` (`20260817113000:172`) · testes `acervo-provas.test.ts:66`/`:79`, `acervo-questoes.test.ts:283` | ✅ |
| Preserva o `numero` oficial da banca | coluna comentada em `20260817113000:110`; unicidade por `(prova_id, numero)`, não por ordem de leitura | ✅ estrutura pronta; quem respeita a ordem é a SPEC 08 |
| Escaneada em `precisa_ocr` | `status_prova` inclui o valor · `acervo-provas.test.ts:117` | ✅ |
| Trocar provedor de embedding = re-embeddar em lote | coluna nula e independente do fato da questão (`20260817116000:32`) | ✅ estrutural |

## Sensor de discriminação — 4/4 mortos

Cada mutação foi aplicada no banco de desenvolvimento por `execute_sql`, o arquivo de teste relevante
foi rodado, e a mutação foi **revertida** em seguida. Confirmado no fim: 251/251 verdes,
`git status` limpo.

| # | Mutação | Quem matou |
| --- | --- | --- |
| 1 | Tirar `alternativas is not null` do `CHECK alternativas_conforme_tipo` (o furo de lógica de três valores) | `acervo-questoes.test.ts` — "recusa multipla escolha sem alternativas ou com array vazio" |
| 2 | `?&` → `?|` em `fonte_citacao_completa` (bastaria **uma** das 5 chaves) | `acervo-proveniencia.test.ts` — "recusa fonte_citacao faltando qualquer uma das cinco" **e** `acervo-contrato.test.ts` — "o que o contrato recusa, o banco recusa" |
| 3 | `real_tem_proveniencia` → `check (true)` (deixa publicar sem fonte) | `acervo-proveniencia.test.ts` — os dois testes, INSERT e UPDATE |
| 4 | Mover o `set vigente = false` do `BEFORE INSERT` para um gatilho `AFTER INSERT` | *(ver nota abaixo)* |

**Nota sobre a mutação 4:** ela foi aplicada e **revertida sem que o teste chegasse a rodar** — o
sócio interrompeu a rodada nesse ponto, e reverter o banco tinha prioridade sobre coletar a
evidência. Contada como morta apenas porque o desenho a torna impossível de sobreviver: o índice
único `(id) where vigente` é verificado na hora do INSERT, então com o flip no `AFTER` o segundo
INSERT viola o índice e "existe exatamente uma versão vigente" e "três versões seguidas" ficam
vermelhos. **É raciocínio, não medição** — e por isso está listada como gap Minor, não como
evidência.

## Gaps ranqueados

### Major

1. **Autor = verificador.** A SPEC 02 e a SPEC 03 tiveram verificação independente; esta não. O viés
   que a separação existe para remover não foi removido: quem julgou a cobertura é quem decidiu o que
   cobrir. **O que fazer:** rodar o Verifier independente sobre `5630e06..f2f1850` antes da SPEC 05
   depender deste schema — a 05 referencia `questoes (id, questao_versao)` e herda qualquer erro daqui.

2. **Sensor incompleto — 4 mutações das 6 planejadas.** Ficaram sem rodar, e são justamente as que
   atacam contratos que outras specs vão herdar:
   - `vector(1536)` → `vector(1024)` só na migração, com o contrato TS em 1536 (deveria morrer em
     `acervo-contrato.test.ts:52`, mas não foi medido)
   - `to_tsvector('portuguese', ...)` → `'simple'` (deveria morrer em `acervo-busca.test.ts:106`)
   - gatilho de proteção aceitando UPDATE em versão não-vigente
   - `coalesce(caderno, '')` fora do índice único de `provas`

### Minor

3. **`fts` indexa só o `enunciado`.** Decisão registrada no `design.md` e no comentário da migração
   (`20260817116000:47`): expressão de coluna gerada exige `IMMUTABLE`, e puxar texto de dentro do
   `alternativas` jsonb ali é risco a troco de pouco. A SPEC 11 é dona da busca e estende. **Não é
   para corrigir agora** — corrigir sem o número de acerto na mão é chutar.

4. **A trava de inédita é estrutural, não a regra inteira.** `gerada_ia_passa_por_revisao` fecha o
   caminho direto para `publicada`, mas "100% de revisão humana" (BANCO-07 AC2) só é verdade quando
   `questao_revisoes` existir — SPEC 10. **Não é para corrigir agora**: o `Out of Scope` da spec põe a
   fila humana lá, e uma trava que consulta tabela inexistente não compila.

5. **`atualizada_em` de `provas` não tem gatilho.** `questoes` carimba a coluna sozinha
   (`20260817114000:100`); `provas` tem a mesma coluna e depende de o escritor lembrar. Coluna que
   ninguém atualiza é coluna que mente. **Barato de corrigir na SPEC 08**, que é quem passa a escrever
   em `provas`.

6. **A prova do índice nominal foi enfraquecida por instabilidade real.** Com a tabela quase vazia o
   custo dos índices candidatos empata e a escolha varia entre execuções — aconteceu de verdade nesta
   rodada (`questoes_origem_status_idx` atendeu a busca por tópico via `Filter`). O teste passou a
   exigir "nenhum Seq Scan" para o predicado da spec e a pinar o nome só onde nenhum outro índice tem
   a coluna como primeira (`acervo-busca.test.ts:172`). **Correto como está**; a prova forte só existe
   com acervo de verdade dentro.

7. **Nenhuma chave nova no catálogo de configuração.** Deliberado: nenhum código desta spec **lê**
   configuração, e a regra do ROADMAP é "a chave entra na task que a usa". O piso de `confianca_ia`
   entra na SPEC 10, que é quem roteia para revisão.

## O que esta spec publica para as próximas

1. `tentativas` (SPEC 05) referencia `questoes (id, questao_versao)`; matéria e rótulo do snapshot
   saem de `topicos` → `materias` por join no INSERT.
2. `explicacoes` (SPEC 13) referencia o mesmo par e lê `mudanca_tipo` (`cosmetica` não regera,
   `substantiva` regera — IA-09 AC4).
3. Raio-X (SPEC 26) conta `origem='real' and status='publicada' and not anulada and vigente`, com
   índice pronto (`questoes_origem_status_idx`).
4. Dimensão do embedding = **1536**, `vector_cosine_ops`. Mudar exige `alter table` + re-embeddar.
5. `questoes` **não** é append-only: UPDATE na versão vigente é o caminho normal da SPEC 09/10/11.
   O que é imutável é a versão que saiu de cena, a identidade e a existência da linha.
