# Passou Concursos

SaaS de preparação para concursos da carreira bancária, com foco no Banco do Brasil.
Método + IA: acervo de questões reais com proveniência, explicação conferida, plano diário adaptativo
com revisão espaçada e Raio-X da banca.

Repositório privado.

## Estado

**Specify concluída nos 9 módulos. Trabalho recortado em 36 specs numeradas (AD-089), das quais
as 01–14 são o MVP. Quatro concluídas: 01, 02, 03 e 04. Próxima: SPEC 05.**

A ordem oficial de construção está em **[`.specs/ROADMAP.md`](.specs/ROADMAP.md)** — 36 specs, cada
uma dependendo só de specs anteriores e dimensionada para uma sessão. **O lançamento é o fim da
SPEC 14**; da 15 em diante é evolução. Para trabalhar numa delas:

> "Desenvolva a SPEC XX seguindo a `/tlc-spec-driven`."

| Marco | Specs | O que existe ao fim |
|---|---|---|
| Fundação | 01–04 ✅ | projeto, configuração/flags, erro visível, acervo modelado |
| Espinha do aluno | 05–06 | log imutável, projeções, FSRS, plano do dia por regra |
| A primeira tela | 07 | site no ar, login, paywall testável |
| Acervo real | 08–10 | gateway de IA, 1º lote ingerido, gabarito conferido, explicação com fonte |
| A oferta | 11 | Raio-X calculado, pesando o plano e visível na tela |
| Dinheiro | 12 | página de vendas, checkout Asaas, ativação automática |
| O loop | 13–14 | onboarding, plano, sessão, explicação, progresso, sequência → 🚀 **lançamento** |
| Operação e lei | 15–18 | painel do operador, LGPD completa |
| Retenção e profundidade | 19–24 | 4 sinais, Raio-X completo, verificações, busca, tutor |
| Evolução | 25–36 | staging, notificação, flywheel, inéditas, simulado, tiers, áudio |

## Onde está o quê

| Arquivo | O que é |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Regras do projeto — invariantes, stack, convenções. Leia primeiro. |
| [`.specs/STATE.md`](.specs/STATE.md) | Handoff, contratos vigentes e decisões novas. **Fonte da verdade.** |
| [`.specs/STATE-ARQUIVO.md`](.specs/STATE-ARQUIVO.md) | Log histórico `AD-001`…`AD-088`. Consulta pontual |
| [`.specs/ROADMAP.md`](.specs/ROADMAP.md) | A sequência oficial das 36 specs (01–14 = MVP) |
| [`.specs/features/`](.specs/features/) | As specs numeradas — o que construir e em que ordem |
| [`.specs/modulos/`](.specs/modulos/) | As 9 specs temáticas — o texto dos requisitos (`BANCO-`, `IA-`, `ALUNO-`…) |
| [`PRD.md`](PRD.md) | Contrato de produto |
| [`docs/GITFLOW.md`](docs/GITFLOW.md) | Como trabalhar no git |
| [`docs/EVIDENCIAS-CIENTIFICAS.md`](docs/EVIDENCIAS-CIENTIFICAS.md) | Estudos que embasam o método |
| [`docs/historico/`](docs/historico/) | Registro congelado de como se chegou às decisões |

`CLAUDE.md` importa o `AGENTS.md` — as regras são as mesmas para pessoa e para agente.

## Ambiente

```bash
cp .env.example .env
```

Preencha o `.env`. O `SUPABASE_ACCESS_TOKEN` também precisa existir como variável de ambiente do
sistema — o MCP configurado em `.mcp.json` lê do ambiente, não do arquivo:

```bash
setx SUPABASE_ACCESS_TOKEN "sbp_xxx"
```

## Stack

Next.js · TypeScript · Supabase (Postgres, Auth, Storage, RLS, pgvector) · Vercel · Asaas · n8n.
Trabalho pesado roda em GitHub Actions + Batch API, nunca em serverless.
