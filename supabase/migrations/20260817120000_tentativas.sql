-- ALUNO-01 (AC2, AC3, AC4) · ALUNO-04 (AC2) · INFRA-04 (AC4) · AD-015 · AD-042 · AD-043
--
-- A aposta fundacional do produto (AD-015): toda projecao do aluno — dominio por
-- topico, caderno de erros, agenda de revisao, Raio-X, flywheel — e reconstruida
-- daqui. Nada nesta tabela pode mudar depois de escrito, e por isso ela nasce
-- particionada e travada: reparticionar e destravar depois e caro e arriscado.
--
-- Tres decisoes de forma explicam o resto:
--
-- (1) **Snapshot congelado com id E rotulo.** `topico_id` diz de que topico a
--     questao era; `topico_rotulo` diz como aquele topico se chamava no momento
--     da resposta. Reclassificar o topico na SPEC 09/15 muda o presente e nao
--     desloca o passado (ALUNO-01 AC3). Guardar so o id perderia o rotulo;
--     guardar so o rotulo perderia a ligacao.
--
-- (2) **A chave de particao entra na PK.** Postgres exige que toda constraint
--     unica de tabela particionada contenha a coluna de particao, entao a PK e
--     `(id, respondida_em)` e nao `id`. E o mesmo par que
--     `tentativa_causa_simulado` referencia.
--
-- (3) **`user_id` nao tem FK.** Deliberado. Uma FK para `auth.users` com
--     `on delete cascade` seria uma **segunda porta de DELETE** nesta tabela, e
--     o AD-029 exige que exista uma so, nomeada (`app.esquecimento_user_id`, na
--     migracao seguinte). A identidade do aluno e da SPEC 07.
--
-- Grupo LGPD: **grupo 1** (dado identificado). A classificacao formal no schema
-- e a auditoria sao da SPEC 16; a rotina de apagamento e da SPEC 14. O que esta
-- spec entrega e a porta por onde essa rotina passa.

-- ── Vocabulario do log ──────────────────────────────────────────────────────

-- ALUNO-01 AC4: o contexto de uma resposta e um destes cinco, e o enum e o que
-- torna "qualquer outro" impossivel em vez de improvavel.
create type public.contexto_tentativa as enum
  ('diagnostico', 'plano', 'treino', 'simulado', 'revisao');

-- ALUNO-04 AC2 / AD-043: as 6 causas + "nao sei dizer" + `faltou_tempo`.
-- Os valores sao literais do AD-043; mudar um aqui muda o caderno de erros
-- (SPEC 06) e o remedio que o plano aplica.
--
-- `faltou_tempo` esta no enum mas e RECUSADO nesta tabela por CHECK: no simulado
-- a causa vem depois da prova e vive na tabela vizinha, que e onde esse valor e
-- aceito. Um enum so, duas regras de uso — a alternativa (dois enums) obrigaria
-- a converter valor entre tabelas que falam da mesma coisa.
create type public.causa_erro as enum
  ('nao_sabia_conteudo', 'errei_a_conta', 'entendi_errado_enunciado',
   'confundi_conceitos', 'fiquei_na_duvida', 'chutei', 'nao_sei_dizer',
   'faltou_tempo');

-- AD-043: no MVP a causa e sempre auto-relato. `sistema` existe para a deducao
-- por IA do flywheel (SPEC 29), que nasce rebaixada — quem le o caderno de erros
-- precisa poder separar o que o aluno disse do que a maquina supos.
create type public.causa_origem as enum ('aluno', 'sistema');

-- ── O fato cru ──────────────────────────────────────────────────────────────

create table public.tentativas (
  id             uuid        not null default gen_random_uuid(),
  user_id        uuid        not null,

  -- O par que a SPEC 04 fixou como PK de `questoes`. A FK aponta para a versao
  -- que o aluno de fato respondeu: se a questao for corrigida depois, a linha
  -- antiga continua existindo e esta tentativa continua apontando para ela.
  questao_id     uuid        not null,
  questao_versao integer     not null,

  -- ── snapshot congelado (AD-042 / ALUNO-01 AC2) ────────────────────────────
  materia_id     uuid           not null references public.materias(id),
  materia_rotulo text           not null,
  topico_id      uuid           not null references public.topicos(id),
  topico_rotulo  text           not null,
  banca          text           not null,
  tipo_questao   tipo_questao   not null,
  dificuldade    smallint       not null,
  origem         origem_questao not null,

  -- ── contexto ──────────────────────────────────────────────────────────────
  sessao_id       uuid               not null,
  contexto        contexto_tentativa not null,
  ordem_na_sessao integer            not null,

  -- ── resultado e sinais crus ───────────────────────────────────────────────
  resposta_dada text    not null,
  correta       boolean not null,
  tempo_ms      integer check (tempo_ms is null or tempo_ms >= 0),
  -- Anti-coasting: acerto marcado como chute nao conta como dominio seguro
  -- (AD-044). O desconto e da SPEC 06; aqui so se guarda o sinal cru.
  marcou_chute  boolean not null default false,

  -- ── causa do erro no treino (ALUNO-03 AC1) ────────────────────────────────
  -- No proprio INSERT, nunca por UPDATE depois: e o que faz a causa conviver
  -- com o so-INSERT (AD-043).
  causa_erro   causa_erro,
  causa_origem causa_origem,

  respondida_em timestamptz not null default now(),

  primary key (id, respondida_em),

  -- A questao respondida existe, naquela versao. `restrict` e o default e esta
  -- explicito de proposito: `questoes` nao e apagavel hoje, e se um dia for, e
  -- esta linha que da voz ao log.
  constraint tentativas_questao_fk
    foreign key (questao_id, questao_versao)
    references public.questoes (id, questao_versao) on delete restrict,

  -- A letra respondida tem de existir no tipo da questao. Certo-errado usa
  -- 'C'/'E', que colide de proposito com as letras C e E da multipla: o tipo e
  -- que desempata, e por isso o CHECK e por tipo e nao uma lista solta.
  constraint resposta_valida check (
    case tipo_questao
      when 'multipla_escolha' then resposta_dada in ('A','B','C','D','E')
      when 'certo_errado'     then resposta_dada in ('C','E')
    end
  ),

  -- ALUNO-03 AC1: errou no treino, disse por que. Acerto nao pede causa, e os
  -- outros contextos tambem nao (diagnostico e simulado nao interrompem).
  constraint causa_obrigatoria_no_treino check (
    contexto <> 'treino' or correta or causa_erro is not null
  ),

  -- Causa e explicacao de erro. Em resposta certa nao ha o que explicar, e uma
  -- causa ali envenenaria o caderno de erros com linha que nao e erro.
  constraint causa_so_com_erro check (
    causa_erro is null or correta = false
  ),

  -- ALUNO-04 AC3: `faltou_tempo` so existe no simulado, e no simulado a causa
  -- mora na tabela vizinha. Logo, nesta tabela ele nunca entra.
  constraint faltou_tempo_so_no_simulado check (
    causa_erro is distinct from 'faltou_tempo'
  ),

  -- `causa_origem` acompanha a causa: uma sem a outra e linha ambigua.
  constraint causa_origem_acompanha_causa check (
    (causa_erro is null) = (causa_origem is null)
  ),

  constraint dificuldade_1_a_5 check (dificuldade between 1 and 5),
  constraint ordem_na_sessao_positiva check (ordem_na_sessao >= 1)
) partition by range (respondida_em);

comment on table public.tentativas is
  'Log imutavel de respostas (AD-015/AD-042). So-INSERT: correcao e linha nova ou tabela vizinha. Particionada por mes (INFRA-04). Grupo LGPD 1 — apagamento pela porta `app.esquecimento_user_id` (AD-029).';

comment on column public.tentativas.topico_rotulo is
  'Nome do topico NO MOMENTO da resposta. Copia proposital: reclassificar o topico depois nao desloca o historico (ALUNO-01 AC3).';

comment on column public.tentativas.marcou_chute is
  'Sinal cru. O desconto do acerto-por-chute no dominio e da SPEC 06 (AD-044).';

-- ── Indices de acesso (INFRA-04 AC4) ────────────────────────────────────────
--
-- Os quatro caminhos de leitura que ja estao escritos em outras specs. Nascem na
-- primeira migracao porque criar indice em tabela grande depois e downtime.
-- Em tabela particionada, o indice declarado no pai vira indice em cada
-- particao, inclusive nas que o pg_partman criar no futuro.

-- "o que este aluno respondeu neste periodo" — a leitura do progresso (SPEC 14)
-- e a que o INFRA-04 AC2 usa para provar o pruning.
create index tentativas_user_periodo_idx
  on public.tentativas (user_id, respondida_em desc);

-- "o que aconteceu nesta sessao" — fechamento de bloco (SPEC 06/13).
create index tentativas_sessao_idx
  on public.tentativas (sessao_id);

-- "quem respondeu esta questao" — indice de discriminacao do flywheel (SPEC 29).
create index tentativas_questao_idx
  on public.tentativas (questao_id, questao_versao);

-- "como este aluno vai neste topico" — motor de prioridade do plano (SPEC 06).
create index tentativas_topico_idx
  on public.tentativas (user_id, topico_id, respondida_em desc);
