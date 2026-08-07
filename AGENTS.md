# Repository Guidelines

## Project Structure & Module Organization

The Vite/React client lives in `src/`: reusable UI in `src/components/`, route screens in `src/pages/`, and shared API/types beside them. The Express and SQLite implementation is in `server/`. Runtime state is created under `data/` and `uploads/`; both are Git-ignored. Keep tests next to the module they cover using `*.test.ts` or `*.test.tsx`.

## Build, Test, and Development Commands

Use Node.js 20+ and npm:

- `npm install` — install client and server dependencies.
- `npm run dev` — start Vite on port 5173 and the API on port 3001.
- `npm run build` — type-check and create the production client bundle.
- `npm test` — run Vitest once; `npm run lint` runs TypeScript checks.

Prefer repository-owned commands over undocumented global tools so local development and CI behave consistently.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, and no semicolons, matching the existing files. Use `PascalCase` for React components/types and `camelCase` for functions and variables. Route components belong in `src/pages/`; styled-components primitives belong in `src/components/ui.tsx`. Prefer Tailwind utilities for layout and styled-components for reusable interactive primitives.

## Testing Guidelines

Add Vitest coverage for data transformation and API client behavior. Test success paths, malformed input, missing configuration, and month/date boundaries. Run `npm test` and `npm run build` before requesting review. Use synthetic fixtures only; never commit real report content, credentials, or customer data.

## Commit & Pull Request Guidelines

Use short imperative commit subjects with Conventional Commit prefixes, such as `feat: add image captions` or `fix: handle empty reporting period`. Pull requests should explain the problem and solution, list verification commands, link relevant issues, and include screenshots for UI or generated-document changes. Call out schema, configuration, or migration steps explicitly.

## Security & Local Data

Never commit `.env`, SQLite files, uploads, generated exports, or API keys. Validate file type and size on the server. Database changes must preserve foreign keys and use parameterized SQLite statements.
