# Handoff — portar a landing do protótipo para o Next.js

Cole o bloco abaixo numa sessão nova, na raiz do projeto.

---

Preciso portar uma landing page já aprovada, que hoje existe como protótipo HTML/CSS/JS
estático, para os componentes Next.js deste projeto. **O design está decidido e aprovado — não
é para redesenhar nada.** O trabalho é de porte fiel, com as adaptações que o Next.js e as
regras do projeto exigem.

## Antes de escrever qualquer código, leia

1. `AGENTS.md` e `CLAUDE.md` na raiz — as regras do projeto vencem qualquer instinto meu ou seu.
2. `DESIGN.md` — sistema de design, tokens, régua de contraste, anti-slop.
3. `scrollcraft/builds/passou-lp/PLANO.md` — o que foi decidido, por quê, e os sete defeitos que
   já foram encontrados e corrigidos. **Não reintroduza nenhum deles.**
4. `scrollcraft/builds/passou-lp/BRIEF.md` — a entrevista com o dono, na palavra dele.
5. `src/app/(landing)/page.test.tsx` — o contrato que o teste guarda.

## O protótipo

Roda em `scrollcraft/builds/passou-lp/`. Para ver rolando:

```bash
node "C:/Users/Caio Lacerda/.claude/plugins/cache/nateherk/nateherk-design/0.2.0/skills/scrollcraft/scripts/serve.mjs" --root scrollcraft/builds/passou-lp --port 4500
```

| Arquivo | O que é |
| --- | --- |
| `index.html` | A página. Sete seções, HTML semântico, comentários explicando cada decisão. |
| `pagina.css` | Todo o estilo próprio. Nenhum seletor `[data-sc-*]` é reestilizado. |
| `pagina.js` | Comportamento próprio: barra de progresso, o movimento assinatura, contador pt-BR. |
| `raiox.js` | Frequência real extraída do banco em 2026-08-25. |
| `scrollcraft.js` / `.css` | O motor de scroll (vanilla, da skill scrollcraft). **Não editar.** |
| `assets/*.png` | Sete ilustrações 3D já geradas e com fundo recortado (alfa real). |
| `prompts/` | O prompt de cada imagem e o elenco, para regerar ou variar a série. |
| `lab/desk`, `lab/mob`, `lab/red` | Capturas de verificação: desktop, celular 390px, movimento reduzido. |

## O destino

- Página: `src/app/(landing)/page.tsx`
- Componentes: `src/modules/ui/landing/*.tsx` (hoje: `secoes.tsx`, `ciclo.tsx`, `estrutura.tsx`,
  `marca.tsx`, `movimento.tsx`, `props.tsx`). Reorganize como fizer sentido; o conteúdo atual
  desses arquivos vai ser substituído.
- Tokens: `@theme` em `src/app/globals.css`. **Tailwind v4 — não existe `tailwind.config.js`.**
- Imagens: `public/arte/`.

## As sete seções, na ordem

| # | Seção | Dispositivo | Span |
| --- | --- | --- | --- |
| 1 | Herói | `flow` + título cinético + paralaxe na arte | — |
| 2 | O problema (fundo escuro) | `pin`, falas que se substituem no lugar | 2.6 |
| 3 | 1.395 questões | `flow` + `reveal` + contador pt-BR | — |
| 4 | **O edital desaba** (fundo escuro) — o pico | `pin` + movimento assinatura | 4.6 |
| 5 | Método, 3 cartões | `flow` + entrada escalonada + `tilt` | — |
| 6 | Hoje × ainda não, 2 cartões | `flow` + dois `reveal` + `tilt` | — |
| 7 | Oferta e preço | `flow` + entrada escalonada + `tilt` | — |

## Decisões que NÃO podem ser revertidas no porte

1. **O motor `scrollcraft.js` não é editado.** Ele é vanilla e lê atributos `data-sc-*` do DOM.
   Monte-o num client component com `ScrollCraft.mount(document.body)` depois da hidratação. As
   seções continuam server components — o motor só lê o DOM que elas produzem, exatamente como
   o `movimento.tsx` atual já faz com o GSAP.
2. **O movimento assinatura é DOM, nunca vídeo nem imagem.** Os 86 chips carregam nome de tópico
   e contagem reais. Em vídeo isso borra, não é selecionável, não é lido por leitor de tela e
   congela — na próxima prova ingerida estaria mentindo. Essa decisão foi discutida e fechada
   com o dono; não reabra.
3. **Só `transform` e `opacity`** no laço de desenho. Nada de `width`/`height`/`top`/`left`:
   são 86 elementos por quadro.
4. **As falas dos atos fixados são blocos empilhados na mesma célula do grid**, não parágrafos
   soltos com margem. Parágrafo solto colide assim que um título quebra numa linha a mais — foi
   um bug real, está corrigido, e a estrutura do HTML é o que o impede de voltar.
5. **Nenhum número inventado.** Todos os que estão na página são verificáveis:

   | Fato | Valor | Origem |
   | --- | --- | --- |
   | Questões de prova real | 1.395 | `questoes` vigentes, `origem='real'`, exclui matéria `TESTE-%` |
   | Provas oficiais | 28, de 2010 a 2025 | `provas` |
   | Tópicos ativos | 86 | `topicos` ativos |
   | Top 12 tópicos | 567 questões = 40,6% | soma dos 12 maiores |
   | Cauda ≤5 questões | 19 tópicos = 4,7% | — |
   | Economia à vista | R$ 19,70 | 197,00 − 177,30 |
   | Meta-análise | Donoghue e Hattie, 242 estudos | `docs/EVIDENCIAS-CIENTIFICAS.md` |

6. **A régua de contraste do `DESIGN.md` vale**, e o lado escuro tem valores novos que estão
   calculados no topo de `pagina.css`. Não invente cor nova; se precisar de uma, calcule o
   contraste e registre.

## Adaptações que o porte EXIGE

1. **`raiox.js` tem que virar consulta, não arquivo congelado.** Hoje é um extrato de
   2026-08-25. No Next.js, leia do banco por uma função do módulo de acervo, com cache, e
   mantenha o extrato como fallback se a consulta falhar. A consulta que gerou os números:

   ```sql
   select t.nome, m.nome as materia, count(*) as n
   from questoes q
   join topicos t on t.id = q.topico_id
   join materias m on m.id = t.materia_id
   where q.vigente and q.origem = 'real' and m.nome not like 'TESTE-%'
   group by t.nome, m.nome
   order by n desc;
   ```

   Invariante 3 do `AGENTS.md`: **o Raio-X só conta `origem='real'`.** A cláusula não é opcional.

2. **Preço vem de `obterPrecosPublicos()`**, como já vem hoje em `page.tsx`. Os valores no
   protótipo (R$ 197,00 / R$ 16,42 / R$ 177,30 / garantia 7 dias) são placeholders do HTML
   estático — no Next.js eles saem da configuração. O selo "Economize R$ 19,70" tem que ser
   **calculado**, não escrito à mão.

3. **`EventoDoFunilNaEntrada evento="pagina_vista"`** continua na página (INFRA-12: os quatro
   eventos do funil continuam disparando, anônimos).

4. **As imagens** vão para `public/arte/` e passam a usar `next/image` com `priority` nas duas
   do herói e `loading="lazy"` no resto. Elas têm alfa de verdade e são 1024×1024.

5. **Fonte**: o protótipo puxa Geist do Google Fonts por `<link>`. No Next.js use o que o
   projeto já usa; não adicione um segundo caminho de carregamento de fonte.

6. **Tokens novos** (o lado escuro: `--breu`, `--breu-tinta`, `--breu-suave`, `--breu-verde`,
   `--breu-linha`, e as duas sombras) entram no `@theme` do `globals.css`. **Nunca hardcode cor
   no componente** — é regra escrita do `DESIGN.md`.

## O teste que guarda o contrato

`src/app/(landing)/page.test.tsx` exige que o HTML renderizado contenha, e nesta ordem no caso
dos dois últimos: `prova real` · `revisão` · `Donoghue` · `242` · `197,00` · `177,30` ·
`Garantia de 7 dias` · `href="/checkout"` · `href="/termos"` · `href="/privacidade"` ·
`Ainda não` · `Tutor de dúvidas` · `não promete aprovação` · `Ranking entre alunos não está` ·
e `Termos de uso` / `Política de privacidade` **antes** de `Conferir o checkout`.

O protótipo respeita todos. Rode `npm run test:unit` e confirme antes de abrir PR.

## Uma regra do projeto que este trabalho revoga

`DESIGN.md` § Ilustração proíbe *render 3D* e manda ilustração *flat paper-cut*. O dono escolheu
explicitamente 3D chunky nesta rodada, depois de ver as duas opções lado a lado. Abra uma
**`AD-NNN` nova** no fim de `## Decisions` do `.specs/STATE.md` registrando a mudança e o que
ela substitui. **Nunca edite uma AD existente.** Atualize também a seção `## Handoff` do
`STATE.md` (substitua o corpo, não acumule).

## Git

`main` é protegida. Branch curta, Conventional Commits com o requisito e a AD no corpo, um
commit atômico por task, PR com merge `--no-ff`. Detalhe em `docs/GITFLOW.md`.

## Como verificar quando terminar

Não basta compilar. A página não tem um estado só — cada posição de scroll é um quadro
diferente, e os defeitos moram entre os dois que você olhou. Suba o dev server e capture o
scroll em desktop, em 390px e com `prefers-reduced-motion`, comparando com as capturas em
`scrollcraft/builds/passou-lp/lab/`. Confira em particular:

- o herói com os dois botões visíveis na primeira tela;
- as falas dos atos fixados sem sobreposição em nenhuma posição;
- o pico: pilha → queda → ordenação → barras com rótulo e número;
- o topo do numerão de 1.395 não decepado pelo wipe;
- o fecho resolvendo por inteiro, com os dois preços, garantia, links legais e CTA.

E diga o que **não** verificou. Chrome headless não reproduz decodificador, autoplay nem toque
de iPhone — aparelho real continua sendo teste não feito até alguém fazer.
