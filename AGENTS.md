# Passou Concursos — regras do projeto

SaaS de preparação para concursos da carreira bancária (foco Banco do Brasil). O produto é
**método + IA**: banco de questões reais com proveniência, explicação conferida, plano diário
adaptativo com revisão espaçada e Raio-X da banca. O fosso é o acervo, não a interface.

## Estado

Fase **Specify concluída** para os 9 módulos (`AD-001`…`AD-086`). O trabalho foi **reorganizado em 42
specs numeradas** (AD-086): a unidade de implementação é a **spec**, não o módulo.
**Já existe código de aplicação** — as specs 01 (fundação) e 02 (configuração e feature flags) estão
concluídas e verificadas.

**A ordem oficial está em `.specs/ROADMAP.md`.** Regra dura: **uma spec só depende dela mesma ou de
spec de número menor**. Dependência para frente é bug do roadmap — vira AD nova, não improviso.
Para trabalhar: *"Desenvolva a SPEC XX seguindo a `/tlc-spec-driven`"*. Próxima: **SPEC 03**.

O AD-076 exige a conta do Raio-X ligada desde o dia 1 — por isso as specs 26 e 27 são
**pré-lançamento**. As specs 39 e 40 (áudio) SHALL NOT entrar em Design enquanto a flag de áudio não
estiver perto de ligar (AD-064).

O lançamento separa **construído × ligado** (AD-076): tudo é construído (exceto M3, congelado), mas só
4 superfícies nascem ligadas — plano do dia, sessão de questões, progresso, conta. O resto (tutor,
tela do Raio-X, gamificação além da sequência, diagnóstico adaptativo, flywheel, **analytics da
superfície logada**) entra atrás de flag desligada. Superfície é **web responsivo só, sem app nativo
nem PWA** no lançamento (AD-077).

## Hierarquia da verdade

Quando dois documentos discordam, **o de cima vence**:

1. **`.specs/STATE.md`** — log append-only de decisões `AD-NNN`. AD mais alto vence AD mais baixo.
2. **`.specs/modulos/m*/spec.md`** — requisitos numerados e critérios de aceite (**o quê**).
   **`.specs/ROADMAP.md`** + **`.specs/features/NN-*/spec.md`** — ordem, fronteira e escopo
   (**quando** e **em qual spec**). Discordância sobre o conteúdo do requisito → vence o módulo;
   sobre em qual spec ele entra → vence o roadmap. Requisito nunca é copiado para os dois lugares.
3. **`PRD.md`** — contrato de produto.
4. **`docs/historico/`** — congelado. Registro de como se chegou aqui. **Pode conter ponto já
   revogado.** Nunca é fonte para decidir; nunca é reescrito.

Decidiu algo novo? Vira uma `AD-NNN` nova no `STATE.md`. **Nunca edite uma AD existente** — AD nova
que diz o que substitui.

## Stack e onde cada coisa roda

| Camada | Escolha | AD |
|---|---|---|
| App | Next.js (App Router), TypeScript, monólito modular | AD-002 |
| Dados | Supabase — Postgres + Auth + Storage + RLS + pgvector, região SP | AD-002, AD-035 |
| IA | SDK nativo OpenAI por gateway trocável, modelo+esforço por tarefa, versão fixada | AD-011, AD-073, AD-074 |
| Hospedagem | Vercel (Pro — requisito só quando a flag do tutor ligar, não do lançamento) | AD-035, AD-076 |
| Trabalho longo | **GitHub Actions + Batch API. Nunca serverless.** | AD-035, AD-036 |
| Bastidor | n8n | AD-002 |
| Pagamento | Asaas, checkout próprio | AD-033 |
| Config + feature flags | Tabela versionada no Postgres. Troca sem deploy, alteração registrada | AD-078 |
| Analytics de produto | PostHog Cloud **região EUA**. Só funil pré-login no lançamento | AD-079 |
| Erro / observabilidade | Sentry. **Não** se confunde com analytics — erro ≠ comportamento | AD-037 |
| Teste | Vitest — `unit` (paralelo) e `db` (sequencial, contra o projeto Supabase de dev). **Sem Docker** | AD-083 |

## Invariantes — quebrar qualquer um destes é bug, não escolha

1. **`tentativas` só recebe INSERT.** Nunca UPDATE, nunca DELETE-por-edição. Correção = linha nova.
   (DELETE por `user_id` para esquecimento é outra coisa e é permitido.)
2. **Snapshot congelado.** Cada tentativa carrega a etiqueta do assunto no momento da resposta.
   Reclassificar assunto não desloca histórico.
3. **Raio-X só conta `origem='real'`.** Questão inédita nunca entra na taxa de frequência.
4. **A IA não decide a alternativa correta.** Verdade = gabarito oficial + verificação por código +
   base revisada. Feedback de aluno nunca altera explicação sozinho — só abre fila humana.
5. **Diagnóstico é sempre pulável.** É semente, não porteiro.
6. **Plano é regra/SQL.** A IA só escreve a frase, nunca escolhe o que estudar.
7. **Pré-computa primeiro.** Única superfície de IA ao vivo é o tutor com trava. Áudio nunca ao vivo.
   Projeção pesada roda por job. Exceção autorizada: anel do dia e sequência, calculados na abertura
   da tela (1 aluno × 1 dia) — AD-071.
8. **DELETE seletivo.** Esquecimento apaga grupo 1 (com nome) e grupo 3 (pseudonimizado), inclusive
   backups. Agregado anônimo do grupo 2 sobrevive (art. 12 LGPD).
9. **Núcleo sem checkbox.** Produto não fica atrás de consentimento. Consentimento só para marketing.
10. **Automação só no seguro.** Automação ajusta número que afina o plano. Mudar o que se ensina ou
    gabarito = decisão humana.
11. **Quantitativa conferida.** Questão de conta só publica se o número calculado por código bate com
    o gabarito **e** com o texto. Falhou → refaz 1×, senão fila humana.
12. **Extração e explicação são chamadas separadas** ao modelo. Nunca a mesma chamada.
13. **Retenção.** Dado com nome vive conta ativa + 24 meses, depois apaga (não anonimiza in-place).
14. **Notificação honesta.** Teto ~1 lembrete/dia + 1 aviso de sequência. Nunca mentir para criar urgência.
15. **Sem ranking** entre alunos no lançamento.

## Proibições absolutas

- **Nunca raspar concorrente.** Fonte de questão é PDF oficial da banca (ato oficial, Lei 9.610/1998
  art. 8º IV). Qualquer outra origem é ilegal aqui.
- **Nunca executar código gerado por IA.** Verificação de conta usa catálogo fechado de fórmulas +
  função nossa testada; a IA só devolve qual fórmula e quais parâmetros (AD-069).
- **Nunca hardcodar nome de modelo** em código ou teste automatizado. Vai em configuração. Em
  documento pode (AD-068).
- **Nunca commitar segredo.** `.env` é ignorado; `.env.example` documenta sem valor.
- **Nunca publicar questão sem proveniência** (banca/ano/órgão/cargo/número) e gabarito conferido.

## Convenções

**IDs.** Decisão = `AD-NNN`. Requisito = prefixo do módulo + número:
`BANCO-` (M1) · `IA-` (M2) · `TTS-` (M3) · `ALUNO-` (M4) · `RAIOX-` (M5) · `GAM-` (M6) ·
`DADOS-` (M7) · `PAG-` (M8) · `INFRA-` (M9).

**Idioma.** Domínio em **PT-BR** — tabelas, colunas, tipos e funções de domínio seguem o vocabulário
já travado nas specs (`questoes`, `tentativas`, `n_respostas`, `gabarito_versao`, `origem`, `anulada`,
`precisa_ocr`, `confianca_ia`). Infra, utilitários, testes e nomes técnicos em **inglês**
(`RateLimiter`, `chunk`, `retry`). Documentos, specs e UI em PT-BR. Sem camada de tradução entre
banco e código.

**Feature flags e configuração.** Todo módulo entra atrás de flag (AD-001). Merge com a flag desligada
é o normal — é o que permite trunk-based sem branch longa. O valor vive numa **tabela versionada no
Postgres**, não em variável de ambiente: trocar flag ou parâmetro **não exige deploy**, e toda
alteração é registrada com autor (AD-078/INFRA-11). Flag é **booleana e global** no lançamento — sem
rollout percentual, sem A/B. Env var é só para o que precede o banco (URL/chave do Supabase, segredos).
Todo parâmetro que as specs mandam para "configuração" (`retencao_meses`, `piso_anonimato`, preço,
teto do tutor, matriz de modelos, decaimento do Raio-X, faixas do FSRS, voz do TTS) mora nessa tabela.
Config ilegível deixa a flag **desligada**, nunca ligada.

**Git.** Ver `docs/GITFLOW.md`. Resumo: `main` protegida, branch curta por fase, Conventional Commits
com o requisito e a AD no corpo, um commit atômico por task, merge `--no-ff` via PR.

## Mapa

```
PRD.md                     contrato de produto
.specs/STATE.md            log de decisões AD-NNN  ← fonte da verdade
.specs/ROADMAP.md          a sequência oficial das 42 specs  ← por onde começar
.specs/features/NN-*/      specs numeradas: o que construir, em que ordem
.specs/modulos/m*/spec.md  requisitos por módulo (texto dos AC) + rodadas já feitas
docs/GITFLOW.md            como trabalhar no git
docs/EVIDENCIAS-*.md       estudos que embasam o método (oferta/marketing)
docs/historico/            congelado — como se chegou aqui
experiments/tts-comparacao ferramenta do teste cego de voz (trava o 1º lote do M3)
```

## Pendências que não travam o Design

Advogado (base legal das questões, janela de 24m, LIA antes do flywheel, **e o instrumento da
transferência internacional para os EUA** — art. 33 LGPD, sem decisão de adequação da ANPD, AD-079) ·
contador (CNPJ/regime) · contrato do Asaas (o que volta num estorno, D+ do parcelado) · preço do
Cohere embed-v4 · **free tier do PostHog em fonte primária** antes de ligar (AD-079) ·
**teste cego da voz** (trava o 1º lote do M3) · calibrações registradas como assumptions nas specs.
