# Checklist de go-live — SPEC 14

Este documento fecha o código da SPEC 14, mas não transforma configuração de
painel em trabalho feito. Marque cada item somente quando houver uma evidência
real (log, captura do painel, execução do comando ou teste manual). O merge da
branch não aplica migration em produção, não cria contas de terceiros e não
substitui a revisão jurídica.

## 1. Código e banco

- [ ] Conferir que o alvo é o projeto Supabase de produção antes de aplicar as
  migrations `20260822230000_spec14_sequencia.sql`,
  `20260822231000_spec14_esquecimento.sql` e
  `20260822232000_spec14_cron.sql`.
- [ ] Aplicar as migrations pelo fluxo aprovado do projeto e guardar o log da
  execução. O desenvolvimento já foi usado para os testes desta spec; isso não
  comprova produção.
- [ ] Executar `npm run test:unit`, `npm run test:db`, `npm run lint` e
  `npm run build` no commit que será publicado.
- [ ] Confirmar no banco que o job `m4-recalcula-sequencia` está agendado uma vez,
  que a função usa o fuso de São Paulo e que não há duas execuções concorrentes.
- [ ] Testar uma solicitação de apagamento em ambiente seguro: grupo 1 some,
  registros financeiros mínimos permanecem, o e-mail chega e o usuário Auth é
  invalidado apenas depois da confirmação.

## 2. Flags e superfícies do lançamento

O lançamento liga apenas plano do dia, sessão de questões, progresso e conta.
As flags são globais e vivem na tabela versionada de configuração.

- [ ] `flag.m4.caderno_erros` está ligada para a superfície de progresso.
- [ ] `flag.m4.diagnostico_adaptativo` permanece desligada.
- [ ] `flag.m4.simulado_semanal` permanece desligada.
- [ ] `flag.m5.raiox` permanece desligada como tela dedicada; a conta de
  frequência usada pelo plano deve estar respondendo.
- [ ] `flag.m9.analytics_logado` permanece desligada.
- [ ] Tutor, ranking, gamificação além da sequência, diagnóstico adaptativo,
  flywheel e qualquer outra superfície não listada acima permanecem desligados.
- [ ] Confirmar que nenhuma tela do lançamento exibe ranking, liga, placar,
  percentil ou posição relativa entre alunos.

## 3. Contas, domínio e observabilidade

- [ ] Conta e projeto da Vercel estão criados, o domínio principal responde por
  HTTPS e a região da função continua `gru1`.
- [ ] Variáveis de produção estão preenchidas conforme `docs/DEPLOY.md` e
  `docs/SEGREDOS.md`; nunca colocar `DATABASE_URL` na Vercel.
- [ ] `NEXT_PUBLIC_SITE_URL` usa o domínio principal sem barra final e o Supabase
  tem as Redirect URLs de `/auth/callback` e `/auth/confirm`.
- [ ] Fazer um erro controlado em ambiente de teste e confirmar que o Sentry
  recebe o evento saneado. Não ligar a rota de erro proposital em produção.
- [ ] Entrar por e-mail/senha e, se o provedor estiver habilitado, por Google;
  confirmar que a sessão e a matrícula são a mesma conta.

## 4. E-mail de privacidade

- [ ] Criar/verificar no Resend o domínio ou remetente usado em `RESEND_FROM`.
- [ ] Cadastrar `RESEND_API_KEY` somente na Vercel e nos secrets do GitHub que
  realmente executarem o fluxo; nunca no repositório.
- [ ] Fazer um teste de apagamento com um endereço controlado e confirmar a
  mensagem mínima. Sem chave ou remetente verificado, o sistema deve falhar
  fechado e não invalidar Auth.
- [ ] Definir quem acompanha uma falha recuperável de apagamento e como a nova
  tentativa será executada. A LGPD formal, auditoria e canal com prazo entram
  nas specs posteriores; no MVP o atendimento complementar é manual.

## 5. Jurídico e identidade pública

- [ ] Substituir `Passou Concursos` e `privacidade@passouconcursos.com` pela
  razão social/nome, CNPJ e canal real do controlador/encarregado.
- [ ] Fazer revisão jurídica da política e dos termos, incluindo bases legais,
  retenção, transferência internacional para fornecedores e direitos do titular.
- [ ] Confirmar que a versão exibida nas duas páginas é a mesma constante
  `VERSAO_ATUAL_DOS_TERMOS` registrada no aceite do checkout.
- [ ] Publicar a versão revisada antes de qualquer venda comercial; registrar a
  nova versão no código e no contrato se o texto mudar.
- [ ] Confirmar que o checkbox do checkout é aceite contratual/maioridade e que
  não existe checkbox de consentimento necessário para usar o núcleo. Marketing,
  quando entrar, deve ter consentimento separado.

## 6. Dependências externas que ainda travam a venda

- [ ] CNPJ, conta Asaas, contrato lido e configuração fiscal conferida.
- [ ] Três ou quatro PDFs oficiais de provas do Banco do Brasil estão disponíveis
  para o primeiro acervo; não usar raspagem de concorrente.
- [ ] Free tier do PostHog Cloud foi confirmado em fonte primária e a transferência
  internacional foi tratada na documentação jurídica.
- [ ] Domínio, conta Vercel e credenciais de produção estão sob controle do
  responsável pelo produto.

## Evidência da execução

Preencher quando o lançamento for efetivamente conferido:

| Item | Evidência | Responsável | Data |
| --- | --- | --- | --- |
| Migrations de produção |  |  |  |
| Testes e build |  |  |  |
| Flags |  |  |  |
| Domínio/Vercel/Supabase |  |  |  |
| Sentry |  |  |  |
| Resend |  |  |  |
| Jurídico/identidade |  |  |  |
| Asaas/acervo/PostHog |  |  |  |
