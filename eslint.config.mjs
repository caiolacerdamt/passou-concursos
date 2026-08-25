import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Motor de scroll da landing: cópia literal da skill scrollcraft, servida
    // como asset estático. A regra do porte é não editar o motor, então ele
    // também não se dobra ao nosso lint — o que ele avisa é sobre código que
    // não é nosso e que não temos permissão de mexer.
    "public/motor/**",
  ]),
]);

export default eslintConfig;
