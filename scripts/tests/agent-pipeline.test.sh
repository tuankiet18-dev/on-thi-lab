#!/usr/bin/env bash

set -euo pipefail

source_root=$(git rev-parse --show-toplevel)
export AGENT_SCHEMA_VALIDATOR="$source_root/scripts/validate-agent-json.mjs"
rg -q 'Do not use.*run_command|`run_command` only' "$source_root/.agent/prompts/implement.md" || {
  printf '%s\n' 'FAIL: worker prompt must restrict inspection shell commands' >&2
  exit 1
}
rg -Fq '{{WORKSPACE_ROOT}}' "$source_root/.agent/prompts/implement.md" || {
  printf '%s\n' 'FAIL: worker prompt must pin the active workspace root' >&2
  exit 1
}
test_root=$(mktemp -d)
trap 'rm -rf "$test_root"' EXIT
export AGY_SETTINGS_PATH="$test_root/agy-settings-global.json"

pass_count=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

expect_success() {
  local label=$1
  shift
  if ! "$@" >"$test_root/last.log" 2>&1; then
    sed -n '1,160p' "$test_root/last.log" >&2
    fail "$label"
  fi
  pass_count=$((pass_count + 1))
  printf 'ok - %s\n' "$label"
}

expect_failure() {
  local label=$1
  shift
  if "$@" >"$test_root/last.log" 2>&1; then
    fail "$label unexpectedly succeeded"
  fi
  pass_count=$((pass_count + 1))
  printf 'ok - %s\n' "$label"
}

new_repo() {
  local name=$1
  local repo="$test_root/$name"
  mkdir -p "$repo/scripts/tests/fixtures" "$repo/.agent"
  cp "$source_root/scripts/agent-pipeline-lib.sh" "$repo/scripts/"
  cp "$source_root/scripts/configure-antigravity-permissions.mjs" "$repo/scripts/"
  cp "$source_root/scripts/run-agy-with-budget.mjs" "$repo/scripts/"
  cp "$source_root/scripts/validate-agent-json.mjs" "$repo/scripts/"
  cp "$source_root/scripts/create-agent-worktree.sh" "$repo/scripts/"
  cp "$source_root/scripts/delegate-to-agy.sh" "$repo/scripts/"
  cp "$source_root/scripts/review-agent-run.sh" "$repo/scripts/"
  cp "$source_root/scripts/record-codex-review.sh" "$repo/scripts/"
  cp "$source_root/scripts/approve-and-commit.sh" "$repo/scripts/"
  cp "$source_root/scripts/tests/fixtures/fake-agy.sh" "$repo/scripts/tests/fixtures/"
  cp "$source_root/scripts/tests/fixtures/fake-pnpm.sh" "$repo/scripts/tests/fixtures/pnpm"
  cp -R "$source_root/.agent/schemas" "$repo/.agent/"
  cp -R "$source_root/.agent/prompts" "$repo/.agent/"
  cp -R "$source_root/.agent/policies" "$repo/.agent/"
  cp "$source_root/.agent/project-context.md" "$repo/.agent/"
  cp "$source_root/AGENTS.md" "$repo/"
  cp "$source_root/.gitignore" "$repo/"
  chmod +x "$repo/scripts/"*.sh "$repo/scripts/tests/fixtures/"*
  git -C "$repo" init -q
  git -C "$repo" config user.name 'Pipeline Test'
  git -C "$repo" config user.email 'pipeline@example.invalid'
  git -C "$repo" add .
  git -C "$repo" commit -qm 'baseline'
  mkdir -p "$repo/node_modules"
  printf '%s\n' "$repo"
}

write_task() {
  local repo=$1
  local base
  base=$(git -C "$repo" rev-parse HEAD)
  mkdir -p "$repo/.agent/tasks"
  jq -n --arg base "$base" '{
    "$schema":"../schemas/task.schema.json",
    taskId:"TASK-TEST",
    title:"Pipeline fixture",
    objective:"Create the allowed feature file.",
    risk:"L0",
    baseSha:$base,
    executor:{model:"gemini-3.7-flash-medium",effort:"medium",selectedBy:"codex",timeout:"1m",maxTotalTokens:1000},
    allowedPaths:["src/**"],
    forbiddenPaths:["forbidden.txt","package.json","pnpm-lock.yaml"],
    contextFiles:["AGENTS.md"],
    acceptanceCriteria:[{id:"AC-1",statement:"Feature file exists.",verification:"fixture check"}],
    verification:[{id:"fixture-test",argv:["pnpm","test"],required:true}],
    rollback:"Revert the single task commit.",
    escalateIf:["Scope must expand."]
  }' >"$repo/.agent/tasks/TASK-TEST.json"
}

run_delegate() {
  local repo=$1
  local mode=${2:-success}
  local model=${3:-gemini-3.7-flash-medium}
  local permission_mode=${4:-request-review}
  local tokens=${5:-17}
  (
    cd "$repo"
    PATH="$repo/scripts/tests/fixtures:$PATH" \
      AGENT_PIPELINE_TEST_ALLOW_PRIMARY=1 \
      FAKE_AGY_MODE="$mode" \
      FAKE_AGY_MODEL="$model" \
      FAKE_AGY_PERMISSION_MODE="$permission_mode" \
      FAKE_AGY_TOKENS="$tokens" \
      scripts/delegate-to-agy.sh .agent/tasks/TASK-TEST.json \
        --agy "$repo/scripts/tests/fixtures/fake-agy.sh"
  )
}

repo=$(new_repo success)
write_task "$repo"
expect_failure "primary worktree delegation is rejected" env \
  PATH="$repo/scripts/tests/fixtures:$PATH" AGY_BIN="$repo/scripts/tests/fixtures/fake-agy.sh" \
  bash -c "cd '$repo' && scripts/delegate-to-agy.sh .agent/tasks/TASK-TEST.json"
expect_success "delegate valid task" run_delegate "$repo" success
expect_success "deterministic gate passes" env PATH="$repo/scripts/tests/fixtures:$PATH" \
  bash -c "cd '$repo' && scripts/review-agent-run.sh .agent/tasks/TASK-TEST.json"
expect_success "Codex records PASS" bash -c \
  "cd '$repo' && scripts/record-codex-review.sh .agent/tasks/TASK-TEST.json --verdict PASS"
expect_success "single final commit is created" bash -c \
  "cd '$repo' && scripts/approve-and-commit.sh .agent/tasks/TASK-TEST.json 'test: approved task'"
[[ $(git -C "$repo" rev-list --count HEAD) -eq 2 ]] || fail "expected exactly one commit after baseline"

repo=$(new_repo invalid-json)
write_task "$repo"
expect_failure "invalid AGY JSON is rejected" run_delegate "$repo" invalid-json

repo=$(new_repo schema-rejection)
write_task "$repo"
jq '.unexpectedField = true' "$repo/.agent/tasks/TASK-TEST.json" \
  >"$repo/.agent/tasks/TASK-TEST.json.next"
mv "$repo/.agent/tasks/TASK-TEST.json.next" "$repo/.agent/tasks/TASK-TEST.json"
expect_failure "full task schema rejects unknown fields" run_delegate "$repo" success

repo=$(new_repo token-budget)
write_task "$repo"
expect_failure "token budget stops oversized AGY run" run_delegate "$repo" success gemini-3.7-flash-medium request-review 2000

repo=$(new_repo out-of-scope)
write_task "$repo"
expect_success "out-of-scope worker run completes" run_delegate "$repo" out-of-scope
expect_failure "out-of-scope diff fails gate" env PATH="$repo/scripts/tests/fixtures:$PATH" \
  bash -c "cd '$repo' && scripts/review-agent-run.sh .agent/tasks/TASK-TEST.json"

repo=$(new_repo worker-commit)
write_task "$repo"
expect_success "worker commit is captured" run_delegate "$repo" commit
expect_failure "worker commit fails gate" env PATH="$repo/scripts/tests/fixtures:$PATH" \
  bash -c "cd '$repo' && scripts/review-agent-run.sh .agent/tasks/TASK-TEST.json"

repo=$(new_repo test-fail)
write_task "$repo"
expect_success "worker completes before failing check" run_delegate "$repo" success
expect_failure "required check failure fails gate" env PATH="$repo/scripts/tests/fixtures:$PATH" FAKE_PNPM_EXIT=1 \
  bash -c "cd '$repo' && scripts/review-agent-run.sh .agent/tasks/TASK-TEST.json"

repo=$(new_repo stale)
write_task "$repo"
expect_success "stale fixture delegate" run_delegate "$repo" success
expect_success "stale fixture gate" env PATH="$repo/scripts/tests/fixtures:$PATH" \
  bash -c "cd '$repo' && scripts/review-agent-run.sh .agent/tasks/TASK-TEST.json"
expect_success "stale fixture PASS" bash -c \
  "cd '$repo' && scripts/record-codex-review.sh .agent/tasks/TASK-TEST.json --verdict PASS"
printf '%s\n' 'changed after review' >>"$repo/src/feature.txt"
expect_failure "stale evidence blocks commit" bash -c \
  "cd '$repo' && scripts/approve-and-commit.sh .agent/tasks/TASK-TEST.json 'test: stale task'"

repo=$(new_repo contract-tamper)
write_task "$repo"
expect_success "contract tamper fixture delegate" run_delegate "$repo" success
jq '.allowedPaths += ["forbidden.txt"]' "$repo/.agent/tasks/TASK-TEST.json" \
  >"$repo/.agent/tasks/TASK-TEST.json.next"
mv "$repo/.agent/tasks/TASK-TEST.json.next" "$repo/.agent/tasks/TASK-TEST.json"
expect_failure "task contract tampering fails gate" env PATH="$repo/scripts/tests/fixtures:$PATH" \
  bash -c "cd '$repo' && scripts/review-agent-run.sh .agent/tasks/TASK-TEST.json"

repo=$(new_repo model-mismatch)
write_task "$repo"
expect_success "model mismatch fixture delegate" run_delegate "$repo" success gemini-3.7-flash-high
expect_failure "runtime model mismatch fails gate" env PATH="$repo/scripts/tests/fixtures:$PATH" \
  bash -c "cd '$repo' && scripts/review-agent-run.sh .agent/tasks/TASK-TEST.json"

repo=$(new_repo unsafe-permissions)
write_task "$repo"
expect_success "unsafe permission fixture delegate" run_delegate "$repo" success gemini-3.7-flash-medium always-proceed
expect_failure "always-proceed permission mode fails gate" env PATH="$repo/scripts/tests/fixtures:$PATH" \
  bash -c "cd '$repo' && scripts/review-agent-run.sh .agent/tasks/TASK-TEST.json"

repo=$(new_repo model-escalation-policy)
write_task "$repo"
jq '.executor = {model:"gemini-3.1-pro-high",effort:"high",selectedBy:"codex",overrideReason:"Flash High was insufficient.",timeout:"1m",maxTotalTokens:1000}' \
  "$repo/.agent/tasks/TASK-TEST.json" >"$repo/.agent/tasks/TASK-TEST.json.next"
mv "$repo/.agent/tasks/TASK-TEST.json.next" "$repo/.agent/tasks/TASK-TEST.json"
expect_failure "model-family override requires Flash High evidence" run_delegate "$repo" success gemini-3.1-pro-high
jq '.executor.priorAttempts = [{model:"gemini-3.7-flash-high",effort:"high",outcome:"Insufficient for the task."}]' \
  "$repo/.agent/tasks/TASK-TEST.json" >"$repo/.agent/tasks/TASK-TEST.json.next"
mv "$repo/.agent/tasks/TASK-TEST.json.next" "$repo/.agent/tasks/TASK-TEST.json"
expect_success "Codex can override model after Flash High attempt" run_delegate "$repo" success gemini-3.1-pro-high

repo=$(new_repo worktree-create)
write_task "$repo"
worktree_destination="$test_root/created-worktree"
expect_success "isolated worktree helper creates task branch" bash -c \
  "cd '$repo' && scripts/create-agent-worktree.sh .agent/tasks/TASK-TEST.json HEAD '$worktree_destination'"
[[ -f "$worktree_destination/.git" ]] || fail "created task directory is not a linked worktree"
[[ $(jq -r '.baseSha' "$worktree_destination/.agent/tasks/TASK-TEST.json") == \
  "$(git -C "$repo" rev-parse HEAD)" ]] || fail "worktree task base SHA was not normalized"
jq -e --arg workspace "$worktree_destination" \
  '(.trustedWorkspaces | index($workspace) != null) and
   (.permissions.allow | index("read_file(" + $workspace + ")") != null) and
   (.permissions.allow | index("write_file(" + $workspace + ")") != null) and
   (.permissions.deny | index("write_file(" + $workspace + "/.agent)") != null)' \
  "$AGY_SETTINGS_PATH" >/dev/null || \
  fail "created worktree was not registered as a trusted AGY workspace"
mkdir -p "$repo/apps/api/node_modules"
mkdir -p "$worktree_destination/apps/api"
ln -s "$repo/apps/api/node_modules" "$worktree_destination/apps/api/node_modules"
expect_success "linked dependency artifacts are excluded from task diff" bash -c \
  "cd '$worktree_destination' && source scripts/agent-pipeline-lib.sh && ! agent_changed_files \"\$(git rev-parse HEAD)\" | grep -q node_modules"

settings_fixture="$test_root/agy-settings.json"
printf '%s\n' '{"trustedWorkspaces":["/existing/workspace"],"customSetting":true}' >"$settings_fixture"
expect_success "permission installer preserves existing settings" env AGY_SETTINGS_PATH="$settings_fixture" \
  node "$source_root/scripts/configure-antigravity-permissions.mjs"
jq -e --arg root "$source_root" '
  .customSetting == true and
  (.trustedWorkspaces | index("/existing/workspace") != null) and
  (.trustedWorkspaces | index($root) != null) and
  (.permissions.deny | index("command(git commit)") != null) and
  (.permissions.allow | index("unsandboxed(pnpm format:check)") != null) and
  (.permissions.deny | index("write_file(.agent/)") == null)
' "$settings_fixture" >/dev/null || fail "permission installer did not merge settings safely"

printf '1..%s\n' "$pass_count"
