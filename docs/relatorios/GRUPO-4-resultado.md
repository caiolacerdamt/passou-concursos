# Resultado do Grupo 4

Data da execução: 24/08/2026.

## Publicação

- 893 questões novas foram publicadas em cinco lotes.
- O total vigente publicado passou para 1.014.
- Das 21 explicações antigas do lote 02, 6 foram mantidas, 13 foram reescritas e 2 foram mantidas com a fonte normalizada; todas foram versionadas, sem apagar ou editar a versão antiga.
- O arquivo `scripts/data/explicacoes-lote-02.jsonl` também foi sincronizado e não contém mais fonte autorreferente.

| Matéria | Publicadas |
| --- | ---: |
| Atualidades do Mercado Financeiro | 75 |
| Conhecimentos Bancários | 297 |
| Conhecimentos de Informática | 156 |
| Língua Inglesa | 44 |
| Língua Portuguesa | 215 |
| Matemática | 11 |
| Matemática Financeira | 9 |
| Vendas e Negociação | 207 |

## Pendências

Ficaram 361 questões fora da publicação por dois motivos gerais:

1. 258 são quantitativas, principalmente de Matemática e Matemática Financeira. O projeto ainda não possui o catálogo fechado de fórmulas/verificador determinístico necessário para recalcular o resultado e compará-lo com o gabarito. A explicação gerada não foi usada para contornar essa trava.
2. 103 não quantitativas não tinham material suficiente para uma explicação confiável no fechamento: alternativas oficiais ausentes ou ilegíveis, figuras/dados necessários faltando e itens que não chegaram a ser processados nesta rodada.

Para resolver: completar a extração oficial (incluindo alternativas, gráficos e figuras), ou encaminhar os casos para revisão humana; para as quantitativas, implementar e testar o catálogo fechado de fórmulas e só então rerodar a verificação contra texto e gabarito. Depois, os arquivos pendentes podem passar pelo mesmo dry-run e pelo job de publicação.

Vinte registros do acervo não entraram no alvo por estarem anulados, não vigentes ou fora do recorte publicável.

## Gamificação

`flag.m6.gamificacao` foi ligada por uma inserção append-only na tabela de configuração, com autor operador ativo e motivo registrado. A tela recusou o login fornecido, então foi usado o fallback manual permitido pelo plano. Nenhuma outra flag foi ligada; as únicas flags vigentes são `flag.m5.raiox` e `flag.m6.gamificacao`.

A renderização visual de `/app` não pôde ser conferida porque a sessão local ficou sem autenticação. O banco confirma a flag e os gates de código passaram; a conferência visual deve ser repetida com uma conta autenticada.

## Validação

- Dry-run dos cinco lotes e da correção do lote 02: aprovado.
- `npm run test:unit`: 132 arquivos, 833 testes aprovados.
- `npm.cmd run build`: aprovado.
- Nenhuma questão quantitativa deste lote foi publicada sem verificação.
