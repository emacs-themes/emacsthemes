# Action Log

## 2026-01-06
- [ai] Created `src/schema-checker.ts` using Zod for JSON schema validation.
- [ai] Migrated project runtime and package management to Bun.
- [ai] Set up ESLint with modern flat configuration and TypeScript support.
- [ai] Refactored `eslint.config.js` to remove deprecated `tseslint.config` wrapper.
- [ai] Created `GEMINI.md` to document project-specific AI conventions (Git prefixes and action logging).
- [ai] Created `docs/sample-theme.json` following the `ThemeSchema` and verified it with `src/schema-checker.ts`.
- [ai] Created `src/validate-pr.ts` to check changed recipes against `main`.
- [ai] Added `.circleci/config.yml` to run recipe validation on every merge request (push).
- [ai] Enhanced `src/validate-pr.ts` to log a summary of all invalid file names when validation fails.
- [ai] Added a detailed "Principal Engineer" context prompt to `GEMINI.md` to guide future AI interactions towards security, simplicity, and best practices.
- [ai] Created `.gitignore` to exclude node_modules, build artifacts, environment files, and OS-specific files.
