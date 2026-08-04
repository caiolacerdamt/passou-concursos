# Prompt para continuar em outra sessão

Copie e cole o texto abaixo (da linha tracejada para baixo) numa nova sessão do Claude Code, na
pasta do projeto, para retomar exatamente de onde paramos.

---

Estou construindo um SaaS de preparação para concursos (nicho: carreira bancária, foco Banco do
Brasil). Continuando de sessões anteriores de decisões técnicas (/grill-me).

Antes de responder qualquer coisa:

1. Leia `HANDOFF.md`, `DECISOES-TECNICAS.md` e `EVIDENCIAS-CIENTIFICAS.md` na raiz do projeto. Já
   estão FECHADOS:
   - **D1–D2:** construção (plataforma completa, modular/incremental) e stack (Next.js + Supabase +
     Claude via SDK TS + n8n; monólito modular em TypeScript).
   - **D3–D9 — Banco de questões:** fontes oficiais, pipeline de ingestão, schema, QA misto, legalidade.
   - **TEMA 1 — Camada de IA (D10–D14):** pré-computa primeiro (única IA ao vivo = tutor com trava);
     modelos por tarefa + gateway trocável + eval cego de PT-BR; "não ensinar errado" (explicação só
     com base em documento entregue por etiqueta; base oficial-quando-existe + resumo próprio conferido;
     conta verificada por código); feedback do aluno (2 sinais separados); áudio TTS (ElevenLabs
     `eleven_v3` principal + fallback barato; 8 vozes candidatas).
   - **TEMA 2 — Coluna vertebral do aluno (D15–D18):** D15 `tentativas` = log imutável (só INSERT) +
     snapshot da etiqueta; domínio/caderno/Raio-X = telas calculadas por cima, recalculáveis. D16 causa
     do erro = auto-relato obrigatório (com "não sei" válido), 6 causas + "não sei". D17 diagnóstico =
     teste curto adaptativo pulável, semente recalibrada pelo log; 1 chamada de IA/aluno escreve o plano.
     D18 plano diário = motor de prioridade (quanto cai × fraqueza × devendo-revisão) + blocos (Revisar/
     Avançar/Treinar + simulado semanal) + revisão espaçada estilo FSRS (piso 1/3/7/14/30, migra p/ FSRS
     conforme o log enche) + intercalação; tudo regra/SQL, IA só escreve a frase.
   - **TEMA 3 — Raio-X da banca (D19–D22):** D19 arquitetura = **conteúdo-primeiro** (esqueleto único =
     edital verticalizado, banca = **coluna** de peso, não três mapas; antes da banca = visão combinada
     núcleo/condicional); **três sinais** com **frequência real mandando** (frequência real só conta
     `origem='real'` como taxa = anti-viés; edital = porteiro; atualidade = empurrão auditável); duas
     camadas (conteúdo combinável × formato banca-específico). D20 peso = porteiro binário + frequência
     motor + atualidade com teto + faixa especial "novo no edital". D21 sinal #3 = **SEM radar de
     internet** (edital + detecção grátis pelo banco + skim humano leve). D22 formato = núcleo universal
     treinado já + módulo de formato na gaveta pras 3; **antes/depois do edital = UMA app** lendo um
     "perfil de concurso"; **pivot do edital otimizado** (extrair c/ saída estruturada + citações →
     diff por embeddings → humano confere só o diff → propaga automático; snapshot D15 protege histórico).
     **Plataforma = motor multi-concurso; BB é o 1º perfil.**
   - **TEMA 4 — COMPLETO (D23–D30). Metade GAMIFICAÇÃO (D23–D25):** D23 (o que a gamificação recompensa =
     **4 sinais separados**; a **sequência/streak** tem barra baixa mas DENTRO do plano D18 — o mínimo é o
     bloco Revisar/revisão espaçada, que já é o trabalho de maior valor; **anel do dia** = quanto fez; **"no
     prazo/avanço"** = trava anti-coasting; **progresso** = crescimento desde o ponto de partida do D17,
     nunca veredito). D24 (perdão da sequência = mede **compromisso com a agenda declarada pelo aluno**;
     escudo + folga programada + **reset suave nunca-a-zero**; perdão isolado do "no prazo", que segue
     honesto — "generosos com a motivação, honestos com a preparação"). D25 (onde a gamificação para =
     **notificação bem leve**, tom de treinador, sem mentir; **anti-trapaça** por `tempo_ms` + anel com teto;
     **100% solo no lançamento**, sem ranking/liga — alunos competem por vaga real → ranking seria tóxico).
   - **TEMA 4 — metade LGPD/FLYWHEEL (D26–D30):** D26 (**base legal por finalidade**, não consentimento único:
     **contrato** pra operar o produto pro aluno + **legítimo interesse** pro flywheel — com LIA/teste de
     balanceamento + transparência + **opt-out** + **consentimento** só pra marketing/notificação; núcleo
     **nunca** atrás de checkbox; sem consentimento granular). D27 (**3 grupos de dado:** operacional **com
     nome** (contrato, some no DELETE) × **estatística somada anônima** (art. 12, não é dado pessoal,
     **sobrevive ao DELETE**) × **sequência pseudonimizada** (código, p/ knowledge tracing, ainda some no
     DELETE); "anônimo" só vale no **agregado somado de muita gente**, não em linha-com-código). D28
     (**retenção:** com-nome vive conta ativa **+ janela 24 meses** após cancelar → depois **anonimiza pro
     grupo 2 e apaga**; agregado anônimo = pra sempre; fiscal/cobrança = prazo legal ~5 anos). D29 (**direito
     ao esquecimento:** DELETE apaga conta + histórico com-nome + sequência-código; **ficam** faturas (lei) +
     agregado anônimo (art. 12); travas: **número mínimo de respondentes** + apagar **inclusive dos backups**
     em ~15–30 dias; política em pt claro). D30 (**pipeline do flywheel = máquina de 3 esteiras**, humano
     **fora** do "questão por questão": (1) 100% automática — dificuldade real, frequência, **índice de
     discriminação** (a matemática dedura a questão quebrada sozinha); (2) IA peneira + **pré-diagnostica**,
     humano confirma ~1h/semana; (3) 100% humano só p/ mudar gabarito oficial; **acesso mínimo** por RLS +
     **trilha de auditoria**; automação só mexe em número seguro → protege D12).
2. A memória do projeto já carrega os fatos principais (project-overview, stack-decision,
   banco-de-questoes, camada-ia, coluna-vertebral, raio-x-banca, gamificacao-flywheel,
   evidencias-cientificas, comm-style, research-first-context7).

**Pendências práticas (não são decisão de mesa, não bloqueiam):** (1) escolher **1 voz ElevenLabs**
entre as 8 já testadas (amostras em `experiments/tts-comparacao/out/`); (2) fixar qual **provedor
barato** de fallback (Fish/OpenAI). Além disso, alguns detalhes ficaram deferidos pro PRD (parâmetros
FSRS default, tamanho de bloco, prazos exatos de LGPD a confirmar com advogado, IA aplicar sozinha
correção de baixíssimo risco no flywheel).

Regras de trabalho (mantidas):

- Aja como sócio experiente e direto, não como consultor que só concorda; aponte furos e riscos.
- Fale/explique como para um leigo, **sem analogias**; termo técnico sempre seguido do que significa
  em concreto; dê recomendação, não menu de opções. Quando eu pedir, use exemplos didáticos.
- Pesquise na internet dados voláteis (editais, datas, preços, modelos de IA, concorrentes, e também
  regras/prazos de LGPD) antes de afirmar; use o MCP do Context7 para documentação de bibliotecas.
- Vá atualizando `HANDOFF.md`, `DECISOES-TECNICAS.md`, `EVIDENCIAS-CIENTIFICAS.md` e a memória do
  projeto a cada decisão.
- Orçamento e tempo estão FORA da discussão: otimizar pela melhor plataforma, de forma equilibrada.

Quero continuar a sessão de **/grill-me** (uma pergunta estratégica por vez, com sua recomendação):

**TEMA 5 — COMEÇAR AQUI: autenticação, pagamentos, hospedagem/infra e modelo de negócio/preço.**
Decidir, uma pergunta de cada vez (você propõe a ordem e me explica o porquê de cada uma):
- **Autenticação/contas:** login (Supabase Auth já na stack — e-mail/senha, Google, etc.), verificação,
  recuperação, e como isso conversa com o `user_id` que é a espinha de todo o log (D15) e do DELETE (D29).
- **Pagamentos/cobrança:** provedor (Stripe × gateways nacionais como Pagar.me/Asaas/Mercado Pago — Pix
  importa muito no Brasil), assinatura recorrente, trial, inadimplência, notas fiscais (liga na retenção
  fiscal do D28).
- **Hospedagem/infra operacional:** Vercel (Next) + Supabase Cloud (a confirmar), ambientes, backups (que
  o D29 exige alcançar no DELETE), observabilidade, custo operacional, segurança/segredos.
- **Modelo de negócio/preço:** free/trial × pago, faixas de preço (pesquisar concorrentes — Gran, Bizzu
  ~R$10/mês, Qconcursos, etc.), o que entra em cada plano, ancoragem no valor do método (usar
  `EVIDENCIAS-CIENTIFICAS.md` na oferta).

Depois disso, vou gerar um **PRD** e as specs via **/tlc-spec-driven**.

Comece confirmando que leu os documentos e faça a **1ª pergunta estratégica do Tema 5** (proponha por
qual das quatro frentes começar e por quê), com sua recomendação.
