#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=agent-pipeline-lib.sh
source "$script_dir/agent-pipeline-lib.sh"

[[ $# -eq 2 ]] || agent_die "usage: $0 TASK_FILE COMMIT_MESSAGE"
task_input=$1
commit_message=$2
[[ -n $commit_message ]] || agent_die "commit message must not be empty"

agent_require_tools git jq sha256sum
root=$(agent_repo_root)
cd "$root"
task_abs=$(agent_task_abs "$task_input")
[[ -f $task_abs ]] || agent_die "task contract not found: $task_input"
task_rel=$(agent_task_rel "$root" "$task_abs")
agent_validate_task "$task_abs"
task_id=$(jq -r '.taskId' "$task_abs")
base_sha=$(jq -r '.baseSha' "$task_abs")
[[ $(git rev-parse HEAD) == "$base_sha" ]] || agent_die "HEAD moved; exactly one post-PASS commit is required"

round=$(agent_find_latest_round "$root/.agent/runs/$task_id")
run_dir="$root/.agent/runs/$task_id/round-$round"
evidence="$run_dir/evidence.json"
review="$run_dir/review.json"
task_snapshot="$run_dir/task-contract.json"
invocation="$run_dir/invocation.json"
attestation_rel=".agent/attestations/$task_id.json"
attestation="$root/$attestation_rel"
[[ -f $evidence && -f $review && -f $attestation && -f $task_snapshot && -f $invocation ]] || agent_die "missing evidence, Codex review or attestation"
expected_task_sha=$(jq -r '.taskSha256' "$invocation")
[[ $(sha256sum "$task_abs" | cut -d' ' -f1) == "$expected_task_sha" ]] || agent_die "task contract changed after delegation"
[[ $(jq -r '.gateStatus' "$evidence") == NEEDS_REVIEW ]] || agent_die "deterministic gates are not passing"
[[ $(jq -r '.reviewer + ":" + .verdict' "$review") == codex:PASS ]] || agent_die "final Codex PASS is required"

current_patch=$(mktemp)
stage_list=$(mktemp)
trap 'rm -f "$current_patch" "$stage_list"' EXIT
agent_write_patch "$base_sha" "$current_patch" "$attestation_rel"
current_patch_sha=$(sha256sum "$current_patch" | cut -d' ' -f1)
[[ $current_patch_sha == "$(jq -r '.patchSha256' "$review")" ]] || agent_die "review is stale; patch changed after PASS"
[[ $current_patch_sha == "$(jq -r '.patchSha256' "$attestation")" ]] || agent_die "attestation is stale"

agent_changed_files "$base_sha" | while IFS= read -r file; do
  [[ -n $file ]] || continue
  if [[ $file == "$attestation_rel" ]]; then
    printf '%s\n' "$file"
  elif [[ $file == "$task_rel" ]]; then
    printf '%s\n' "$file"
  elif agent_path_forbidden "$task_snapshot" "$file"; then
    agent_die "forbidden path present at commit gate: $file"
  elif agent_path_allowed "$task_snapshot" "$file" "$task_rel"; then
    printf '%s\n' "$file"
  else
    agent_die "out-of-scope path present at commit gate: $file"
  fi
done >"$stage_list"

[[ -s $stage_list ]] || agent_die "nothing to commit"
while IFS= read -r file; do
  git add -- "$file"
done <"$stage_list"

staged=$(git diff --cached --name-only | LC_ALL=C sort)
expected=$(LC_ALL=C sort -u "$stage_list")
[[ $staged == "$expected" ]] || agent_die "staged files do not exactly match approved scope"

git diff --cached --check
git commit -m "$commit_message" -m "Task: $task_id" -m "Evidence: $attestation_rel"
[[ $(git rev-parse HEAD^) == "$base_sha" ]] || agent_die "commit ancestry invariant failed"
printf 'Created the single approved task commit: %s\n' "$(git rev-parse HEAD)"
