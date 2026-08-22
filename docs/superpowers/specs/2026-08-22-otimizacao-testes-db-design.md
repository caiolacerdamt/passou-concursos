# Otimização dos testes de banco

## Objetivo

Reduzir o tempo da suíte `db` na CI sem mudar o banco-alvo, sem paralelizar os testes e sem perder o isolamento por transação definido na AD-083.

## Decisão

A suíte mantém um único worker e passa a reutilizar uma conexão PostgreSQL por meio de um `Pool` com limite 1. Cada chamada de teste ainda abre uma transação própria e executa `ROLLBACK` no fim. O cliente é devolvido ao pool depois de cada uso e não pode mais ser consultado pelo teste que o liberou.

O projeto `db` do Vitest desliga o isolamento de módulos entre arquivos. Como `fileParallelism` continua falso, isso permite compartilhar o mesmo pool no worker sequencial sem permitir execução concorrente.

A CI separa o job rápido, com build, lint e unitários, do job de banco. Os dois começam depois do checkout e da instalação de suas próprias dependências. Execuções obsoletas do mesmo PR são canceladas, e somente um job pode usar o Supabase de desenvolvimento por vez.

## Critérios de aceite

1. Dois usos consecutivos de `comBanco` SHALL observar o mesmo `pg_backend_pid()` enquanto o cliente liberado SHALL rejeitar novas consultas.
2. `comTransacaoRevertida` SHALL executar `ROLLBACK` mesmo quando o teste falhar.
3. A suíte `db` SHALL continuar com `fileParallelism: false` e SHALL compartilhar módulos no único worker.
4. A CI SHALL executar build/lint/unitários e banco em jobs distintos.
5. A CI SHALL cancelar uma execução antiga do mesmo PR e SHALL impedir dois jobs de banco simultâneos contra o projeto de desenvolvimento.
6. O log da suíte SHALL informar quantos usos do helper e quantas conexões físicas ocorreram.

## Fora de escopo

- Paralelizar testes ou arquivos de banco.
- Trocar o Supabase de desenvolvimento por Docker, staging ou outro banco.
- Reescrever fixtures em CTE antes de medir o ganho desta mudança.
- Alterar timeouts para mascarar lentidão.

## Verificação

Rodar `npm run test:unit`, `npm run lint`, `npm run build` e `npm run test:db`. A comparação de desempenho usa a duração e o contador de conexões publicados pelo Vitest na CI.
