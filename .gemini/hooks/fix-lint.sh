#!/usr/bin/env bash
touch .tmp/hook-executed
echo "Hook ran" >> .tmp/hook-debug.log
# We use a temp file because we might need the output multiple times or it's large
LINT_OUTPUT=$(bun run lint 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "Linting passed."
  exit 0
fi

echo "Linting failed with code $EXIT_CODE. Attempting to fix with Gemini..."
echo "$LINT_OUTPUT"

# Construct a prompt for Gemini
PROMPT="Fix the following linting errors. Run 'bun run lint' to verify fixes.
Errors:
$LINT_OUTPUT"

# Call Gemini CLI to fix the errors
# We use --yolo to auto-approve tools (like replace/write_file) 
gemini "$PROMPT" --yolo

# Verify if it's fixed
bun run lint
FINAL_EXIT_CODE=$?

if [ $FINAL_EXIT_CODE -eq 0 ]; then
  echo "Gemini successfully fixed the linting errors."
  exit 0
else
  echo "Gemini failed to fix all linting errors."
  exit 2 # Exit 2 to report remaining errors back to the agent if this was called by an agent
fi
