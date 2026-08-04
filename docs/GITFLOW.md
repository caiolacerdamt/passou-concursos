# Gitflow do projeto

## Princípio

**Trunk-based com branch curta.** Só existe uma linha permanente: `main`. Todo trabalho nasce numa
branch curta, vira PR e volta pra `main` em poucos dias.

Isso funciona aqui por causa do **AD-001**: todo módulo entra atrás de feature flag. Você mergeia
código incompleto com a flag desligada, sem quebrar produção e sem manter branch viva por semanas.
Branch longa é o que produz conflito de merge e integração dolorosa — a flag é o que permite evitá-la.

## Branches

| Prefixo | Para que | Exemplo |
|---|---|---|
| `feat/` | funcionalidade nova | `feat/m4-p1-log-tentativas` |
| `fix/` | correção de bug em produção | `fix/gabarito-anulada-duplicado` |
| `spec/` | rodada de Specify/Design/Tasks (só documento) | `spec/m4-design` |
| `chore/` | infra, config, dependência, tooling | `chore/setup-supabase` |
| `docs/` | documentação que não é spec | `docs/gitflow` |
| `exp/` | experimento descartável, pode nunca virar PR | `exp/teste-cego-voz` |

**Padrão do nome de `feat/`:** `feat/<modulo>-<fase>-<slug>`
O módulo é `m1`…`m9`. A fase é `p1`/`p2`/`p3` (prioridade da spec) ou o número da fase de tasks.

**Regra de tamanho — a mais importante:** uma branch vive **até 3 dias** e **até ~10 commits**.
Estourou? Não é uma branch, são duas. Quebre por fase de tasks e abra o PR do que já está pronto.

**`main` é sempre deployável.** Se você não colocaria em produção, não mergeia — mesmo com flag off,
o código tem que compilar, passar teste e não quebrar rota existente.

## O ciclo, passo a passo

```bash
git checkout main && git pull
git checkout -b feat/m4-p1-log-tentativas
```

Trabalhe: **um commit atômico por task**. A skill `tlc-spec-driven` já faz isso — cada task só é
commitada depois de passar o gate de verificação. Nunca junte várias tasks num commit; nunca commite
com teste vermelho.

```bash
git push -u origin feat/m4-p1-log-tentativas
gh pr create --fill
```

O PR abre um **Preview da Vercel** e uma **branch de preview no Supabase**. Você revisa o diff na
interface do GitHub — é o momento em que você lê o que foi escrito, e não durante a digitação.

```bash
gh pr merge --merge --delete-branch   # merge commit, apaga a branch
git checkout main && git pull
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Escopo = o módulo.

```
feat(m4): registra tentativa como INSERT imutável

ALUNO-01, ALUNO-02. Snapshot da etiqueta do assunto no momento da resposta,
para que reclassificação futura não desloque o histórico.

Refs: AD-015, AD-042
```

- **Assunto:** ≤50 caracteres, imperativo, minúscula, sem ponto final.
  Complete a frase "se aplicado, este commit vai _______".
- **Corpo:** só quando o "por quê" não é óbvio. Cite o(s) requisito(s) e a(s) AD(s).
- **Tipos:** `feat` `fix` `docs` `chore` `refactor` `test` `perf` `revert`.
- Quebra de contrato de dados → `!` no tipo: `feat(m1)!: ...`

## Pull Request

Todo merge na `main` passa por PR, **inclusive os seus**. O PR não é burocracia de time grande — é
onde você lê o diff inteiro de uma vez, onde o CI roda e onde o Preview existe. Trabalhando com
agente de IA isso vale mais ainda: é o ponto onde um humano confere o que foi gerado.

O template em `.github/pull_request_template.md` cobra:

- **Requisito atendido** — qual `BANCO-`/`ALUNO-`/`IA-`… este PR entrega
- **Critério de aceite verificado** — como você sabe, com evidência
- **Invariante** — nenhum dos 15 do `AGENTS.md` foi violado
- **Migration** — incluída e reversível, se houver
- **Flag** — qual controla isso, e em que estado entra em produção

## Merge: `--no-ff`, nunca squash

Merge commit preserva os commits atômicos por task. Isso importa por dois motivos:

1. **`git bisect` funciona.** Um bug entra numa task específica, não num bolo de 10.
2. **Reverter uma feature inteira é um comando:** `git revert -m 1 <hash-do-merge>`.

Squash destrói exatamente a granularidade que a skill produz de propósito. Rebase preserva os
commits, mas reescreve os hashes — e o `STATE.md` registra hash de commit por task, que ficaria
apontando pro vazio.

## Proteção da `main`

> **Hoje a proteção do servidor não está ligada.** Proteção de branch e rulesets do GitHub não
> funcionam em repositório **privado** no plano **Free** — a API responde `403 Upgrade to GitHub Pro`.
> Enquanto for assim, a trava é local (abaixo).

**Trava local — ative uma vez por clone:**

```bash
git config core.hooksPath .githooks
```

O hook `.githooks/pre-push` recusa push direto na `main` e mostra como mover o trabalho para uma
branch. Escape consciente: `git push --no-verify`.

**Quando o repositório virar GitHub Pro** (~US$ 4/mês), ligue a proteção de verdade:

```bash
gh api -X PUT repos/caiolacerdamt/passou-concursos/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -F "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=Varredura de segredos" \
  -f "required_status_checks[contexts][]=Integridade dos documentos" \
  -f "required_status_checks[contexts][]=Typecheck, teste e build" \
  -F "enforce_admins=false" \
  -F "required_pull_request_reviews[required_approving_review_count]=0" \
  -F "restrictions=null" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false"
```

Isso exige PR, exige CI verde, bloqueia force-push e deleção. **Zero aprovações exigidas** de
propósito: o GitHub não deixa o autor aprovar o próprio PR, e com um humano só isso travaria tudo.
Quando entrar a segunda pessoa, troque para `required_approving_review_count=1`.

## Banco de dados

Migration versionada em `supabase/migrations/`, uma por PR sempre que der. Nunca altere schema pelo
painel do Supabase — o painel não deixa rastro no repositório e a próxima migration quebra.

Toda migration precisa ser aplicável em banco vazio e em banco com dado. Migration que apaga coluna
usada por código em produção vira **duas** PRs: primeiro para de usar, depois apaga.

## Ambientes

| | Vercel | Supabase |
|---|---|---|
| PR aberto | Preview (URL própria) | branch de preview |
| `main` | Produção | projeto de produção (SP) |

**Deploy ≠ release.** Todo merge vai pra produção. O que decide se o aluno vê é a **feature flag**.
"Lançar o M5" = ligar a flag, não fazer merge.

## Situações especiais

**Bug em produção.** `fix/<slug>` a partir da `main`, PR, merge. Não existe branch de hotfix separada
— a `main` já é a produção.

**Rodada de spec/design.** Branch `spec/<modulo>-<fase>`, só toca `.specs/` e `PRD.md`. PR mesmo
assim: o diff de uma spec é a melhor forma de revisar decisão.

**Experimento.** `exp/<slug>`. Pode morrer sem PR. Se virar produto, o código é reescrito num `feat/`
— não se promove experimento a produção por merge.

**Reverter.** `git revert -m 1 <hash-do-merge>` na `main`, via PR. Nunca `reset --hard` em branch
que já foi empurrada.

## Comandos do dia a dia

```bash
gh pr status                      # meus PRs e o que está pendente
gh pr checks                      # CI deste PR
gh pr view --web                  # abrir no navegador
git log --oneline --graph -20     # a forma da history
git log --oneline main..HEAD      # o que esta branch adiciona
```
