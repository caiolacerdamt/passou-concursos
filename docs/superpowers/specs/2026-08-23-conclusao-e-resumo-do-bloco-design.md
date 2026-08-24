# Conclusão e resumo do bloco

## Resultado

Ao concluir as dez questões de um bloco, o aluno volta ao plano e vê o cartão marcado como
**Concluído**, com quantidade de questões e acertos. O cartão deixa de iniciar uma nova sessão e passa
a abrir um resumo da sessão encerrada.

Esta mudança usa `sessoes`, `sessao_itens` e `tentativas` como fonte da verdade. Não cria coluna de
conclusão em `plano_bloco`, não altera tentativas e não depende do recálculo diário das projeções.

## Requisitos

- **BLR-01** — WHEN a última questão de uma sessão é respondida, THEN o sistema SHALL encerrar a sessão
  e SHALL mostrar no retorno ao plano o bloco como concluído na mesma navegação.
- **BLR-02** — WHEN um bloco possui uma sessão encerrada, THEN o cartão SHALL mostrar o total de
  respostas e acertos e SHALL oferecer **Ver resumo** em vez de **Começar bloco**.
- **BLR-03** — WHEN o aluno abre o resumo de uma sessão própria encerrada, THEN o sistema SHALL mostrar
  o total de acertos e, para cada questão, enunciado, resposta dada, gabarito, resultado, proveniência e
  explicação aprovada da mesma questão-versão, ou o aviso de explicação em revisão.
- **BLR-04** — WHEN a sessão está aberta, não existe ou pertence a outro aluno, THEN o sistema SHALL NOT
  expor o resumo e SHALL apresentar um estado seguro com retorno ao plano.
- **BLR-05** — WHEN existem sessões encerradas repetidas para o mesmo bloco, THEN o plano SHALL usar a
  sessão encerrada mais recente como resumo do cartão.

## Comportamento visual

O cartão concluído permanece na mesma posição do plano e preserva tipo, assunto, motivo e duração. Ele
ganha um estado visual de sucesso com o rótulo **Concluído**, a linha **10 questões · 3 acertos** e o
botão **Ver resumo**. Os demais cartões continuam mostrando **Começar bloco**.

O resumo abre em uma página de leitura dentro do mesmo `Shell`. O topo mostra **Bloco concluído**, o
placar `3 de 10` e a taxa de acerto. Abaixo, cada questão aparece em ordem com sua proveniência,
enunciado, resposta do aluno, gabarito e resultado. A explicação aprovada é mostrada sem edição; quando
ausente, aparece **Explicação em revisão**.

## Arquitetura e fluxo de dados

`consultarPlanoDoDia()` continua lendo `plano_dia` e `plano_bloco`. Depois de obter os blocos, consulta
as sessões encerradas ligadas a esses IDs e agrega as tentativas da sessão mais recente de cada bloco.
`BlocoDoPlano` recebe `conclusao`, nulo para bloco pendente ou contendo `sessaoId`, `nQuestoes`,
`nAcertos` e `encerradaEm`.

`PlanoTela` apenas representa esse estado: conclusão existente produz o resumo e o novo link;
conclusão ausente mantém o fluxo atual. A decisão não fica no navegador.

Uma leitura separada, `consultarResumoDaSessao()`, recebe o ID da sessão, exige que ela esteja encerrada
e lê os itens, as tentativas e as versões exatas das questões. A rota
`/app/sessao/[id]/resumo` exige matrícula ativa antes da consulta. As explicações continuam vindo pela
RPC existente, amarradas a `(questao_id, questao_versao)`.

Não haverá migração de banco. O histórico por assunto em `dominio_topico` continua sendo uma projeção
recalculada pelo job; o resumo imediato vem diretamente da sessão encerrada e evita que o aluno
interprete esse intervalo como perda de respostas.

## Segurança — ASVS v5.0.0, alvo L2

| ID | Referência | Decisão específica | Verificação |
| --- | --- | --- | --- |
| SEC-01 | v5.0.0-8.2.1, v5.0.0-8.3.1 | Página e consulta exigem autenticação e matrícula no servidor; nenhuma decisão de autorização depende do cliente. | Teste da rota sem matrícula e inspeção da guarda. |
| SEC-02 | v5.0.0-8.2.2, v5.0.0-8.4.1 | O ID da URL nunca basta: RLS e vínculo `sessoes.user_id = auth.uid()` restringem o resumo ao dono. | Teste tenta ler sessão de outro aluno e recebe estado seguro sem conteúdo. |
| SEC-03 | v5.0.0-8.2.3 | Gabarito e explicação só são liberados no resumo quando a sessão própria está encerrada. | Teste de sessão aberta confirma ausência desses campos. |
| SEC-04 | v5.0.0-14.2.2, v5.0.0-14.3.2 | A rota autenticada de resumo é dinâmica e não reutiliza resposta entre usuários. | Evidência de configuração dinâmica e teste de isolamento. |

O conteúdo textual continua renderizado pelo React como texto, cobrindo o requisito aplicável
v5.0.0-3.2.2. Requisitos gerais de cookies, cabeçalhos e CORS permanecem fora deste recorte porque a
mudança não altera esses controles.

## Tratamento de falhas

- Sessão inexistente, aberta ou alheia: estado seguro, sem diferenciar para o navegador qual condição
  ocorreu.
- Tentativa ou versão de questão inconsistente: erro observado no servidor e estado genérico na tela;
  nunca completar o resumo com dados inventados.
- Explicação ausente: mostrar **Explicação em revisão**, mantendo o gabarito oficial.
- Bloco sem sessão encerrada: manter **Começar bloco**.

## Verificação

- Teste de domínio cobre bloco pendente, concluído e escolha da sessão encerrada mais recente.
- Teste do plano confirma **Concluído**, placar e **Ver resumo**, além de preservar **Começar bloco** nos
  pendentes.
- Teste do resumo confirma ordem, placar, resposta, gabarito, proveniência, explicação e estado em
  revisão.
- Teste de autorização confirma que uma sessão alheia ou aberta não expõe respostas nem gabarito.
- Gates finais: testes unitários relacionados, lint e build.

## Fora de escopo

- Recalcular `dominio_topico` e `caderno_erros` em tempo real.
- Anel do dia, progresso no prazo ou gamificação da SPEC 19.
- Alterar ou apagar tentativas já registradas.
- Permitir refazer uma sessão concluída pelo mesmo cartão.
