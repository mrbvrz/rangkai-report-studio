import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { globalIgnores } from "eslint/config"

export default tseslint.config([
  globalIgnores(["dist", "dev-dist", "data", "uploads", "fixtures", "vite.config.d.ts"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Konvensi repo: parameter/variabel berawalan "_" memang sengaja tak dipakai.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Diturunkan ke warn: barrel ikon (heroicons), primitives styled-components (ui),
      // dan file context+hook (security) memang mengekspor campuran secara sengaja.
      "react-refresh/only-export-components": "warn",
      // Diturunakn ke warn: pola bootstrap-fetch on-mount di seluruh halaman;
      // migrasi ke loader/pending router atau TanStack Query menyusul.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["server/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    languageOptions: {
      globals: globals.node,
    },
  },
])
