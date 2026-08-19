/**
 * Tailwind v4 nao tem arquivo de configuracao em JavaScript: o unico ajuste de
 * build e este plugin, e os tokens vivem no `@theme` de `src/app/globals.css`.
 * Ver AD-093.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
