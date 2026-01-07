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
- [ai] Committed project setup, including schema validation, linting, CI configuration, and documentation.
- [ai] Updated `.circleci/config.yml` to install `git` before checkout, fixing `ENOENT` error in the `oven/bun` image.
- [ai] Pushed all committed setup and fixes to the remote repository `origin/main`.
- [ai] Optimized CircleCI configuration to use shallow fetch (`--depth=1`) for faster execution.
- [ai] Added "No Automatic Commits" convention to `GEMINI.md`.
- [ai] Implemented Automated Screenshot Pipeline:
    - Created `src/generate-screenshots.ts` to automate theme screenshots.
    - Updated `.circleci/config.yml` to include the `generate-screenshots` job.
    - Updated `docs/sample-theme.json` with a valid repository URL.
    - Updated `.gitignore` to exclude `.tmp/`.
- [ai] Updated Screenshot Generation Logic:
    - Modified `src/generate-screenshots.ts` to detect changed recipes from the last commit (`HEAD`) using `git diff-tree`.
    - Removed strict `.json` extension check for changed files, relying on directory filtering.
- [ai] Refactored `src/generate-screenshots.ts` to extract `getChangedFilesFromLastCommit` function.
- [ai] Refactored `src/generate-screenshots.ts` with testable functions (`downloadThemeFiles`, `generateEmacsConfig`, `captureScreenshot`) and JSDocs.
- [ai] Enhanced `src/generate-screenshots.ts` summary logging to include exact theme names for each status.
- [ai] Created `src/local/Dockerfile` to replicate the CI environment for local screenshot generation testing.
- [ai] Added `docker:local` script to `package.json` to build and run the local screenshot generation container.
- [ai] Fixed `docker:local` script compatibility with Apple Silicon by enforcing `linux/amd64` platform.
- [ai] Refactored Docker setup: moved `src/local/` to `docker/`, created `docker/run.sh` (persisting containers), and updated `package.json`.
- [ai] Added a linting step to the `validate-recipes` job in `.circleci/config.yml`.
- [ai] Separated linting into a dedicated `lint` job in `.circleci/config.yml` and updated workflow dependencies.
- [ai] Refactored `.circleci/config.yml` to use a shared `bun-executor` and implemented dependency caching for faster builds.

## 2026-01-07
- [ai] Modified `src/generate-screenshots.ts` to implement stateful change detection using `.last-processed-commit`, processing changes since the last successful run instead of just the latest commit.
- Modified `src/generate-screenshots.ts` to only update `STATE_FILE` if `successThemes.length > 0`.
- Added logic to delete failed screenshot files in `src/generate-screenshots.ts`.
