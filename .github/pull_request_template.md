## O que este PR entrega

<!-- Uma frase. Se precisar de duas, provavelmente são dois PRs. -->

**Requisitos:** <!-- ALUNO-01, BANCO-03… ou "nenhum (chore/docs)" -->
**Decisões:** <!-- AD-042, AD-015… -->

## Como sei que funciona

<!-- Critério de aceite verificado, com evidência: teste que roda, consulta que retorna,
     tela que abre. "Testei manualmente" sem dizer o quê não conta. -->

## Checklist

- [ ] Nenhum dos 15 invariantes do `AGENTS.md` foi violado
- [ ] Teste cobre o requisito e falharia se a implementação estivesse errada
- [ ] Nada fora do escopo da spec (conferi a seção `Out of Scope`)
- [ ] Nenhum segredo no diff
- [ ] Nome de modelo de IA não aparece em código nem em teste (AD-068)

## Banco

- [ ] Não mexe em schema
- [ ] Migration incluída em `supabase/migrations/`, aplicável em banco vazio **e** com dado
- [ ] Não apaga coluna que código em produção ainda usa

## Feature flag

**Flag:** <!-- nome, ou "nenhuma" -->
**Estado ao entrar em produção:** <!-- desligada / ligada -->

## Ficou de fora

<!-- O que você viu e decidiu não fazer agora, e por quê. Vazio é resposta válida. -->
