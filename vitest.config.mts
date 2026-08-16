import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// O Vitest nao copia o .env para process.env sozinho. O terceiro argumento vazio
// significa "toda variavel, sem exigir o prefixo VITE_" — e o DATABASE_URL dos
// testes de banco mora no .env, que o git ignora.
const env = loadEnv("test", process.cwd(), "");

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // Teste unit: mora junto do codigo, nunca toca banco nem rede.
          name: "unit",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          // Teste de banco: escreve no projeto Supabase de desenvolvimento.
          // Um banco so, compartilhado por todos os arquivos — por isso sequencial.
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          setupFiles: ["tests/db/setup.ts"],
          fileParallelism: false,
          environment: "node",
          env: { DATABASE_URL: env.DATABASE_URL ?? "" },
        },
      },
    ],
  },
});
