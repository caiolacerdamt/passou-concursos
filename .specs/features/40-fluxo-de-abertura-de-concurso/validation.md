# SPEC 40 — Verificação

> Ritual **B**. Verificador independente **curto**: só os *Success Criteria*, cada um com
> evidência `file:line`, **sem sensor de mutação**. Este relatório não repete o `tasks.md` nem
> descreve o que foi implementado — ele confere se o que a spec prometeu está de pé.

**Veredito: APROVADO COM RESSALVAS.** Os 7 Success Criteria passam com evidência. Duas ressalvas
`Minor` e uma calibração medida ficam registradas abaixo; nenhuma bloqueia o fecho.

## Gates

| Gate | Resultado |
| --- | --- |
| `npm run lint` (`eslint src scripts tests`) | 0 erros · 2 warnings **pré-existentes** (`grupo3-classificacao.mts:396`, `importar-questoes-json.test.ts:11`) |
| `npx tsc --noEmit` | limpo |
| `npm run build` | OK |
| `npm run test:unit` | **1339 testes / 0 falhas** (171 arquivos) |
| `npm run test:db` | **530 testes / 0 falhas** (68 arquivos) |

A migration `20260909120000_spec40_abertura_concurso.sql` foi aplicada por `npm run db:push` no
Supabase de desenvolvimento — que **é o mesmo banco de produção** enquanto a SPEC 25 não separar
ambientes. Nenhuma flag foi ligada e nenhum dado existente foi alterado.

Gate de rede do `AGENTS.md`: não foi acionado. O `test:db` conectou na primeira tentativa; não
houve `EACCES` nem `fetch failed`.

## Success Criteria

### SC1 · "Abrir CAIXA / técnico bancário" percorre o fluxo sem edição de código — **PASS**

O roteiro inteiro é comando + conversa. As 11 ações cobrem pesquisa → confirmação → medição →
confirmação → Raio-X → publicação:

- `scripts/jobs/abrir-concurso.mts:87` — `USO` declara as 11 ações.
- `.agents/skills/abrir-concurso/SKILL.md` — o roteiro numerado de 1 a 10, com o JSON de cada
  entrada e o texto que o operador precisa ler.
- `scripts/skills-de-abertura.test.ts:76` — o teste **lê as ações do próprio `USO`** e exige que a
  skill cite todas e nenhuma a mais. Não é lista digitada à mão: renomear ação e esquecer a skill
  fica vermelho.
- `package.json` — `jobs:abrir-concurso` registrado.

O único ponto que exige mão humana fora do comando é a resposta do operador nas três portas — que é
o desenho, não uma lacuna.

### SC2 · Agregador não aparece na lista, e o descarte é número — **PASS**

- `src/modules/acervo/documentos-oficiais.ts:236` — `descartados += 1`; a URL recusada não entra em
  nenhuma estrutura de retorno.
- `src/modules/acervo/documentos-oficiais.ts:185` — `avaliarUrl` é o único juiz, com 6 motivos de
  recusa distintos.
- `src/modules/acervo/documentos-oficiais.test.ts` — "separa aceitos de descartados e nunca devolve
  a URL recusada" fecha com `expect(JSON.stringify(triagem)).not.toContain("qconcursos")`.
- `tests/db/spec40-abertura-concurso.test.ts` — "registra achados, recusa decisao prematura e baixa
  somente o aprovado" confere `aceitos: 2 / descartados: 1` e que o nome do agregador não aparece
  no relatório.

O casamento é por **rótulo**, não por `endsWith`: `falsocesgranrio.org.br` e
`cesgranrio.org.br.agregador.com` são recusados (teste "o furo clássico do endsWith").

### SC3 · Cada documento ingerido tem a URL oficial gravada — **PASS**

- `supabase/migrations/20260909120000_spec40_abertura_concurso.sql:524` —
  `update public.provas set url_origem = v_documento.url`, dentro de `registrar_documento_baixado`.
- Mesma migration, `provas.url_origem` com `check (url_origem like 'https://%')`.
- `tests/db/spec40-abertura-concurso.test.ts` — "a prova baixada guarda a URL oficial de origem"
  assere o valor exato, e o retry do download não troca a origem.

A URL gravada é a do documento aprovado. **Ressalva Minor 1**, abaixo.

### SC4 · Duas listas confirmadas na sessão, publicação registrada com autor — **PASS**

- `…spec40_abertura_concurso.sql:400` — `decidir_documentos` recusa decisão fora de ordem, recusa ID
  de outra abertura e **recusa deixar documento pendente** (`documentos_pendentes_restantes`).
- `…spec40_abertura_concurso.sql:643` — `decidir_assuntos` aplica o quadro inteiro numa transação;
  linha inválida derruba tudo (teste "uma linha invalida derruba o quadro inteiro").
- `…spec40_abertura_concurso.sql:307, 460, 771, 808` — `registrar_acao_operador` nos quatro pontos.
- `scripts/jobs/abrir-concurso.mts:1134` — `acaoPublicar` chama `concluir_abertura` e
  `publicar_concurso`; `--motivo` é obrigatório só aqui.
- Teste DB "publicar recusa concurso que a prontidao nao aprovou, e nao fecha a abertura": o estado
  volta íntegro a `pronto_para_recalculo`.

Nenhuma das três portas tem default. Fusão nunca é automática
(`…spec40_abertura_concurso.sql:643`, ramo `fundir` exige `origem_id` **e** `topico_id`).

### SC5 · Relatório diz o degrau por matéria e o que falta para subir — **PASS**

- `scripts/jobs/abrir-concurso.mts:1035` — `proximoPasso` traduz cada degrau (1–4) em instrução, e
  no degrau 1 conta quantas provas faltam para `param.m1.meta_provas_por_concurso`.
- `scripts/jobs/abrir-concurso.mts:1059` — `formatarRelatorioDaAbertura` imprime matéria, degrau,
  nº de provas, anos e base do peso, mais a cobertura contra o piso.
- `scripts/jobs/abrir-concurso.test.ts` — "mostra o lastro materia por materia, com anos e o que
  falta" e "no degrau 1 conta quantas provas faltam para a meta".

O mesmo comando serve de retomada: `comoRetomar` (`abrir-concurso.mts:1101`) nomeia o próximo
comando em cada um dos 7 estados, e o teste DB "o relatorio le o estado real e diz o proximo
comando" confere que ele acompanha o estado de verdade.

### SC6 · O mesmo roteiro em Codex e Claude Code, sem regra só no prompt — **PASS**

- `.agents/skills/abrir-concurso/SKILL.md` — fonte canônica única.
- `.claude/skills/abrir-concurso/SKILL.md` — adaptador de 17 linhas que só manda ler a canônica e
  declara que ela vence em caso de divergência.
- `scripts/skills-de-abertura.test.ts:49` — confere que **os dois arquivos estão versionados**
  (`git ls-files`), o que exigiu a exceção em `.gitignore:49`; sem ela o Claude Code de outra
  máquina não teria a skill e o teste passaria mentindo.
- Mesmo arquivo: o adaptador tem `< 30` linhas e as duas `description` são idênticas, para os dois
  agentes acionarem no mesmo pedido.

**Nenhuma regra de validação existe só na skill.** Confirmado por leitura: todo `NUNCA` do roteiro
tem contraparte em código ou no banco — allowlist (`documentos-oficiais.ts:185`), ordem
(`abertura_em_estado`, `…sql:234`), autoria (`exigir_operador_ativo` em cada RPC), prova fora da
conversa (não existe ação que devolva texto de prova).

### SC7 · Sem cliente, tarefa de matriz, segredo ou chamada de API para pesquisar — **PASS**

- `src/modules/ia/sem-busca-do-produto.test.ts:29` — varre `src/`, `scripts/`, `tests/`,
  `.github/` e `supabase/` atrás de 9 famílias de provedor de busca/raspagem; confere que `TAREFAS`
  não ganhou tarefa de busca ou edital, e que nenhuma chave de configuração guarda credencial ou
  endpoint. Tem sensor de auto-verificação ("o sensor enxerga").
- `scripts/jobs/abrir-concurso.mts` — `motivoDeParada` exige **só** `DATABASE_URL`; teste
  "o arquivo nao importa gateway, tarefa de IA nem provedor de busca" varre o próprio arquivo.
- `scripts/jobs/abrir-concurso.mts:809` — `medidorPadrao` **delega por processo** ao `medir-prova`.
  É essa escolha que mantém o gateway e a chave do provedor fora deste arquivo.
- Teste DB "a segunda confirmacao inteira nao gera UMA chamada de modelo" e "`recalcular` roda so
  regra e SQL": contagem de `ia_geracoes` antes e depois, igual.
- `scripts/skills-de-abertura.test.ts` — as duas skills também são varridas: uma skill que
  sugerisse um provedor levaria a sessão a tentar.

`TAREFAS` continua com as 11 de sempre; `etiqueta_de_item` e `separacao_de_itens` são as da SPEC 38.

## Ressalvas

**Minor 1 — a proveniência grava a URL pedida, não a URL final do redirect.**
`registrar_documento_baixado` usa `v_documento.url` (`…sql:524`), que é o link aprovado pelo
operador. O download resolve redirecionamentos e conhece a URL final (`PdfBaixado.urlFinal`,
`documentos-oficiais.ts:261`), mas ela não é persistida. As duas são oficiais — cada salto é
revalidado contra a allowlist —, então não há furo de AD-003. O que se perde é auditoria fina: se
a banca mover o arquivo, a origem gravada é a que o operador viu, não a que serviu os bytes.
Registrado, não corrigido: mudar isso troca o significado da coluna e é decisão de produto.

**Minor 2 — `processar-provas` avança o estado mesmo quando toda prova falha.**
`acaoProcessarProvas` (`abrir-concurso.mts:844`) chama `avancar_abertura` depois do laço,
independentemente do código de saída de cada medição. O comando sai com código 1 e o resumo mostra
`FALHOU`, então a falha é visível e a sessão para. Mas a execução fica em
`processamento_em_andamento` com zero prova medida — e o operador que ignorar o vermelho segue para
o edital sem lastro. O relatório final expõe isso (degrau 4, "sem dado"), o que limita o dano.

**Calibração medida — `param.m1.limiar_quase_duplicata` = 0,78 é estrito demais.**
Não é ressalva de implementação: o número entrou como a spec o registrou, e a spec o marca como
`n (calibra)`. A medição está em `src/modules/acervo/programa-edital.test.ts` ("registra o que o
limiar de 0,78 deixa passar e o que ele barra"):

| dupla | similaridade | passa em 0,78? |
| --- | --- | --- |
| `Politica Monetaria` × `Politicas Monetarias` | 0,800 | sim |
| `Produtos Bancarios` × `Produtos e Servicos Bancarios` | 0,776 | **não** |
| `Regencia Verbal` × `Regencia Verbal e Nominal` | 0,762 | **não** |
| `Regencia Verbal` × `Regencia Nominal` | 0,606 | não |
| `Juros Simples` × `Juros Compostos` | 0,400 | não |

Com 0,78 o sistema só pergunta sobre variação de plural, e **cala** nos dois casos que mais
interessam ao operador. Uma faixa entre 0,70 e 0,75 pegaria os três primeiros sem alcançar
`Regencia Verbal` × `Regencia Nominal`, que são assuntos irmãos e não duplicatas. O valor vive em
configuração (AD-078): trocar é linha na tabela, sem deploy. **Decisão de produto, não do autor.**

## O que esta spec NÃO entregou

Dito explicitamente para o status final não afirmar o que não existe:

- **Nenhuma tela web.** As três confirmações acontecem na conversa; não nasceu rota em `/operador`.
- **Nenhuma busca do produto.** O comando não pesquisa: ele valida o que a sessão trouxe.
- **Nenhuma prova de fluxo ponta a ponta contra concurso real.** Todo o `test:db` roda em transação
  revertida com fixtures. O roteiro nunca foi executado contra a CAIXA de verdade — depende de PDF
  oficial na mão, que segue como pendência externa no `ROADMAP.md`.
- **`param.m1.meta_provas_por_concurso` (4) e `param.m1.tamanho_maximo_pdf_mib` (25)** continuam
  sem medição. Aparecem no relatório como alvo operacional, não como trava.
