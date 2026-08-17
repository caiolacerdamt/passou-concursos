# Passou Concursos

SaaS de preparação para concursos da carreira bancária, com foco no Banco do Brasil.
Método + IA: acervo de questões reais com proveniência, explicação conferida, plano diário adaptativo
com revisão espaçada e Raio-X da banca.

Repositório privado.

## Estado

**Specify concluída nos 9 módulos. Specs reorganizadas em 42 specs numeradas (AD-086).
Duas concluídas: 01 (fundação) e 02 (configuração e feature flags). Próxima: SPEC 03.**

A ordem oficial de construção está em **[`.specs/ROADMAP.md`](.specs/ROADMAP.md)** — 42 specs, cada
uma dependendo só de specs anteriores e dimensionada para uma sessão. Para trabalhar numa delas:

> "Desenvolva a SPEC XX seguindo a `/tlc-spec-driven`."

| Marco | Specs | O que existe ao fim |
|---|---|---|
| Fundação | 01–03 | projeto, configuração/flags, erro visível |
| Espinha do aluno | 04–06 | acervo modelado, log imutável, projeções, plano do dia |
| Acervo real e IA | 07–14 | gateway, provas ingeridas, gabarito conferido, explicação com fonte |
| Interface, conta e dinheiro | 15–21 | UI, deploy, login, checkout, página de vendas |
| Superfícies do aluno | 22–25 | as 4 telas que nascem ligadas (AD-076) |
| Raio-X e hábito | 26–29 | "quanto cai" real no plano, 4 sinais, tutor |
| LGPD | 30–32 | grupos, auditoria, esquecimento e retenção → **lançamento** |
| Fast-follow | 33–42 | perdão, atualidade, flywheel, inéditas, simulado, áudio |

## Onde está o quê

| Arquivo | O que é |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Regras do projeto — invariantes, stack, convenções. Leia primeiro. |
| [`.specs/STATE.md`](.specs/STATE.md) | Log de decisões `AD-001`…`AD-086`. **Fonte da verdade.** |
| [`.specs/ROADMAP.md`](.specs/ROADMAP.md) | A sequência oficial das 42 specs |
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
