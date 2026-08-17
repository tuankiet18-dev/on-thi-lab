---
name: git-workflow-pro
description: >-
  Use this skill when managing git history, branching strategies, resolving complex
  merge/rebase conflicts, writing conventional commits, managing git worktrees,
  cherry-picking, bisecting bugs, or preparing clean PRs.
---

# Git Workflow & Mastery Skill

Professional Git patterns for maintaining clean commit histories, trunk-based development, and conflict-free collaboration.

---

## 1. Conventional Commits Standard

Format: `<type>(<scope>): <short summary in imperative mood>`

- `feat(attempts)`: Add monotonic autosave validation
- `fix(auth)`: Correct token expiration calculation
- `refactor(catalog)`: Move catalog query logic to database package
- `perf(web)`: Preload hero fonts to improve LCP
- `test(api)`: Add integration tests for submit endpoint
- `docs(readme)`: Update local setup instructions

---

## 2. Git Worktree Workflows

Use worktrees to work on multiple branches concurrently without cloning the repository or stashing uncommitted changes:

```bash
# 1. Add a new worktree for a feature branch
git worktree add ../project-worktrees/feature-x -b feat/feature-x

# 2. Work inside the directory
cd ../project-worktrees/feature-x

# 3. Once finished and merged:
git worktree remove ../project-worktrees/feature-x
git branch -d feat/feature-x
```

---

## 3. Safe Interactive Rebase & Conflict Resolution

```bash
# Rebase feature branch onto latest main
git fetch origin
git rebase origin/main

# If conflicts occur:
git status # check conflicted files
# Edit files to resolve markers <<<<<<<, =======, >>>>>>>
git add <resolved-files>
git rebase --continue

# Abort if needed:
git rebase --abort
```

---

## 4. Useful Diagnostic Commands

```bash
# Bisect to pinpoint regression commit
git bisect start
git bisect bad HEAD
git bisect good v1.0.0
# Git will checkout commits; run test and type `git bisect good` or `git bisect bad`

# Show visual log graph
git log --graph --oneline --decorate -n 15

# Search commit messages or code changes
git log --grep="autosave" -n 5
git log -S "handleExamSubmit" -p
```
