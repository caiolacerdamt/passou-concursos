import path from "node:path";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Mesmo atalho `@/*` que o tsconfig.json declara. O Vitest nao le `paths` do
// tsconfig sozinho, e sem isto o teste de banco nao acha `src/modules/...`.
const atalhos = { "@": path.resolve(import.meta.dirname, "src") };

// O Vitest nao copia o .env para process.env sozinho. O terceiro argumento vazio
// significa "toda variavel, sem exigir o prefixo VITE_" — e o DATABASE_URL dos
// testes de banco mora no .env, que o git ignora.
const env = loadEnv("test", process.cwd(), "");

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: atalhos },
        test: {
          // Teste unit: mora junto do codigo, nunca toca banco nem rede.
          name: "unit",
          include: [
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
            "scripts/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        resolve: { alias: atalhos },
        test: {
          // Teste de banco: escreve no projeto Supabase de desenvolvimento.
          // Um banco so, compartilhado por todos os arquivos — por isso sequencial.
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          setupFiles: ["tests/db/setup.ts"],
          fileParallelism: false,
          environment: "node",
          // O default de 5s e curto para teste de banco **na CI**, e nao por
          // lentidao do teste: o runner do GitHub fica longe de sa-east-1, e cada
          // ida e volta ao Postgres custa dezenas de milissegundos. Um teste que
          // faz varios `savepoint` em laco acumula isso e estoura — a suite
          // inteira levou 215s na CI contra ~40s na maquina do desenvolvedor.
          // Timeout maior nao esconde teste lento; o que esconderia seria rodar
          // so onde a rede e curta.
          testTimeout: 30_000,
          env: {
            DATABASE_URL: env.DATABASE_URL ?? "",
            NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
            SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY ?? "",
          },
        },
      },
    ],
  },
});
