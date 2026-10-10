# Upstream provenance — anti-slop

## Source
- **Repository:** https://github.com/DietrichGebert/ponytail
- **Source snapshot:** vendored copy bundled with the ponytail `install-anti-slop` skill (.agents/skills/install-anti-slop/scripts/install.mjs, skills-lock.json pinned revision). No upstream git commit was resolvable from the skill bundle; provenance recorded as the pristine skill-bundled snapshot.
- **Installed paths:**
  - `tools/oxlint/anti-slop/` (generic plugin: `index.ts`, `rules/`, `shared/`, vendored `eslint-stylistic` under `vendor/eslint-stylistic` with its LICENSE)
  - `tools/oxlint/anti-slop/effect/` (opt-in Effect plugin, not enabled — no direct `effect` dependency in package.json)

## Intentional deviations
- None. Generic plugin registered as-is; Effect plugin present but unregistered (no direct effect manifest dependency).
