# Codex + Antigravity pipeline

This directory contains the versioned control plane for delegated coding tasks.
Codex creates a task contract, Antigravity edits an isolated worktree without
committing, deterministic checks collect evidence, and Codex creates one commit
only after a final PASS.

## Layout

- `tasks/`: Codex-owned implementation contracts.
- `schemas/`: JSON schemas for contracts, worker reports, evidence and attestations.
- `prompts/`: worker instructions.
- `policies/`: model escalation and permission guidance.
- `runs/`: ignored raw output, logs and patches for local/CI use.
- `attestations/`: sanitized, reviewable records that may be committed.

## Typical flow

```bash
scripts/create-agent-worktree.sh .agent/tasks/TASK-123.json origin/main
# Run the printed delegate command from the new worktree.
scripts/delegate-to-agy.sh .agent/tasks/TASK-123.json
scripts/review-agent-run.sh .agent/tasks/TASK-123.json
# After Codex inspects the diff and acceptance criteria:
scripts/record-codex-review.sh .agent/tasks/TASK-123.json --verdict PASS
scripts/approve-and-commit.sh .agent/tasks/TASK-123.json "feat(domain): description"
```

Run `pnpm agent:test` to validate the pipeline itself. Delegation refuses to run
in the primary worktree. `create-agent-worktree.sh` creates a `codex/<task-id>`
branch and copies the contract into the isolated worktree with its actual base
SHA.

Before the first real run, execute `scripts/configure-antigravity-permissions.mjs`.
It preserves existing settings, creates a backup, trusts this workspace and
merges the scoped rules from `policies/antigravity-settings.example.json`. The
runner also passes `--sandbox` and rejects `always-proceed` mode.
