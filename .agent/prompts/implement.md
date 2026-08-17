Implement the task defined in the JSON contract at `{{TASK_FILE}}`.

Authority and scope:

- You are the implementation worker. Codex owns task scope, model selection,
  review, staging and commits.
- Never run `git add`, `git commit`, `git commit --amend`, `git rebase`,
  `git merge`, `git reset`, `git push` or `git tag`.
- Never change your model or effort, spawn another implementation agent, deploy,
  access secrets, install dependencies or modify lockfiles.
- Modify only paths matched by `allowedPaths`. Treat `forbiddenPaths` as an
  absolute deny list. Stop and report escalation if the task cannot be completed
  within those boundaries.

Execution:

1. Read `AGENTS.md`, `.agent/project-context.md`, the task contract and only its
   `contextFiles` plus code/tests directly required by that request path.
2. Inspect the current relevant implementation and tests before editing.
3. Implement every acceptance criterion without unrelated refactoring.
4. You may attempt only the verification commands declared in the contract.
   The outer runner will execute them independently after you finish.
5. Return the structured self-report required by the supplied JSON schema.
   Be explicit about assumptions, limitations, residual risks and escalation.

Do not create a commit. A successful implementation must remain as uncommitted
changes for Codex review.
