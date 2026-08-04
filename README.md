# Passou Concursos

SaaS de preparação para concursos da carreira bancária, com foco no Banco do Brasil.
Método + IA: acervo de questões reais com proveniência, explicação conferida, plano diário adaptativo
com revisão espaçada e Raio-X da banca.

Repositório privado.

## Estado

**Specify concluída para os 9 módulos. Design não começou. Ainda não há código de aplicação.**

| Módulo | O que é | Spec |
|---|---|---|
| M1 | Banco de questões e pipeline de ingestão | [spec](.specs/features/m1-banco-questoes/spec.md) |
| M2 | Camada de IA (extração, explicação, tutor) | [spec](.specs/features/m2-camada-ia/spec.md) |
| M3 | Áudio (TTS) — fast-follow, atrás de flag | [spec](.specs/features/m3-audio/spec.md) |
| M4 | Coluna vertebral (log de tentativas + plano diário) | [spec](.specs/features/m4-coluna-vertebral/spec.md) |
| M5 | Raio-X da banca | [spec](.specs/features/m5-raiox-banca/spec.md) |
| M6 | Gamificação | [spec](.specs/features/m6-gamificacao/spec.md) |
| M7 | LGPD e flywheel de dados | [spec](.specs/features/m7-lgpd-flywheel/spec.md) |
| M8 | Negócio, auth e pagamentos | [spec](.specs/features/m8-negocio-pagamentos/spec.md) |
| M9 | Infraestrutura | [spec](.specs/features/m9-infra/spec.md) |

Ordem de Design: **M4 → M1 → M2 → M8 → M7 → M5 → M6 → M3.**

## Onde está o quê

| Arquivo | O que é |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Regras do projeto — invariantes, stack, convenções. Leia primeiro. |
| [`.specs/STATE.md`](.specs/STATE.md) | Log de decisões `AD-001`…`AD-072`. **Fonte da verdade.** |
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
