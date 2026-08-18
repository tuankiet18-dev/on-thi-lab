# Stable project context

Start with `AGENTS.md`, then use `docs/code-map.md` to select the owning domain.
Read only the contract and request path named by the task. Read
`docs/architecture.md` before changing domain behavior or persistence.

The root verification command is `pnpm validate`. API route changes also require
`pnpm --filter @onthilab/api test`. Contract changes require contract tests plus
tests for every consuming package.

Never weaken the business invariants in `AGENTS.md`, alter production state,
read secrets, change dependencies, or broaden task scope without escalation to
Codex.
