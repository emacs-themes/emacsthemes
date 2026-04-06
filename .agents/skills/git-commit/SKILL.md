---
name: git-commit
description: Help with git commit tasks. Use when git should stage files, write commit messages, or create commits in a repository.
---

# Git Commits

## Instructions

Goal: commit using `git` all the changes by creating separate commits with changes that belong to the same functionality.

## Steps

1. Analyze all current changes before planning commits:

   ```
       git diff --staged

       # Review unstaged changes
       git diff

       # Review overall file state, including untracked files
       git status --porcelain
   ```

   Always inspect both staged and unstaged changes before deciding how to group commits.
   If staged and unstaged changes overlap in the same files, account for that explicitly when planning commit boundaries.

2. Scan all changes for secrets before staging anything:

   ```
       # Check for files that commonly contain secrets
       git diff --name-only && git diff --staged --name-only | grep -Ei '\.(env|pem|key|p12|pfx|cer|crt)$|credentials|secret|token|password'

       # Check file contents for secret-like patterns
       git diff && git diff --staged | grep -Ei '(password|secret|token|api.?key|private.?key)[[:space:]]*[:=][[:space:]]*[^[:space:]]+'
   ```

   If any matches are found: - Stop and alert the user before proceeding - Check whether the file is listed in `.gitignore` — if not, recommend adding it - Do not stage or commit until the user confirms or the sensitive content is removed

3. Stage the changes:
   Use selective staging to craft precise commits:

   ```
       # Stage entire files
       git add <specific-files>

       # Stage specific hunks within a file (hunk-level granularity):
       git diff <file> > patch.diff
       # Edit patch.diff to remove unwanted @@ ... @@ hunk blocks
       git apply --cached patch.diff
       rm patch.diff

       # Review staged changes before committing
       git diff --staged
   ```

   When a single file contains changes belonging to multiple logical commits, stage hunks separately rather than committing the entire file.
   If the working tree contains entangled changes: - Identify the distinct changes — list what logical modifications exist - Determine dependencies — which changes require others to be present - Create a commit plan — order commits to satisfy dependencies - Stage incrementally — use partial staging to isolate each change - Verify at each step — ensure the repository works after each commit

   When changes are too entangled to separate cleanly, prefer a slightly larger commit with a clear message over a commit that leaves the repository in a broken state.

4. Generate a commit message
   Analyze the diff to determine: why something changed, not only what changed.
   Use semantic commit messages (e.g., `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `chore:`, `revert:`) in **lower case** for the subject. Use present tense, imperative mood, <72 chars. Be clear and concise.
   If the diff is larger add also a body describing in more details what changed and the reason behind it.
   At the bottom of the commit message, add `Co-authored-by` trailers for both the CLI tool and the underlying model when both are known and distinct.

   Before writing the trailers, **identify the underlying model** by asking yourself: _"What model am I?"_
   Use the answer to select the correct model trailer below. If you cannot determine your own model, omit the model line.

   **CLI / Tool** — add if the work was done through one of these agents:
   - **GitHub Copilot CLI** — use when running inside the `gh copilot` CLI or Copilot chat in VS Code/JetBrains:
     `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
   - **Claude Code** — use when running the `claude` CLI by Anthropic:
     `Co-authored-by: claude-code[bot] <claude-code[bot]@users.noreply.github.com>`
   - **Gemini CLI** — use when running the `gemini` CLI by Google:
     `Co-authored-by: Gemini CLI <gemini-cli@google.com>`
   - **opencode** — use when running via the `opencode` CLI; no official GitHub bot identity exists, use:
     `Co-Authored-By: opencode <noreply@opencode.ai>`

   **Underlying Model** — add if the model is known and not already fully represented by the tool line above:
   - **Claude** (any version by Anthropic — e.g. Claude Sonnet, Claude Opus):
     `Co-authored-by: Claude <noreply@anthropic.com>`
   - **GPT** (any OpenAI model — e.g. GPT-4o, o3):
     `Co-authored-by: GPT <noreply@openai.com>`
   - **Gemini** (any Google model — e.g. Gemini 2.5 Pro):
     `Co-authored-by: Gemini <gemini-cli@google.com>`

   **Rule:** Always add the tool line if the tool is known. Add the model line in addition when the tool does not implicitly identify the model (e.g. opencode can run any model — always add both). If only the model is known (e.g. direct API use), add only the model line.

## Safety

Don't EVER commit secrets (.env, credentials.json, private keys). Alert the user if those are not in .gitignore'.
NEVER run destructive commands (--force, hard reset) without explicit request.
Do NOT push commits unless the user explicitly asks.
