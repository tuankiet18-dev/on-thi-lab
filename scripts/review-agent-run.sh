#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=agent-pipeline-lib.sh
source "$script_dir/agent-pipeline-lib.sh"

usage() {
  printf 'Usage: %s TASK_FILE [--round 0|1|2]\n' "$0" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
task_input=$1
shift
round=""
while (($#)); do
  case "$1" in
    --round)
      [[ $# -ge 2 ]] || usage
      round=$2
      shift 2
      ;;
    *) usage ;;
  esac
done

agent_require_tools git jq sha256sum pnpm rg
root=$(agent_repo_root)
cd "$root"
task_abs=$(agent_task_abs "$task_input")
[[ -f $task_abs ]] || agent_die "task contract not found: $task_input"
task_rel=$(agent_task_rel "$root" "$task_abs")
agent_validate_task "$task_abs"

task_id=$(jq -r '.taskId' "$task_abs")
task_run_dir="$root/.agent/runs/$task_id"
[[ -n $round ]] || round=$(agent_find_latest_round "$task_run_dir")
[[ $round =~ ^[0-2]$ ]] || agent_die "round must be 0, 1 or 2"
run_dir="$task_run_dir/round-$round"
agy_output="$run_dir/agy-output.json"
agy_stream="$run_dir/agy-stream.ndjson"
task_snapshot="$run_dir/task-contract.json"
invocation="$run_dir/invocation.json"
[[ -f $agy_output && -f $agy_stream && -f $task_snapshot && -f $invocation ]] || \
  agent_die "incomplete Antigravity evidence for round $round"
agent_validate_task "$task_snapshot"
control_task="$task_snapshot"
base_sha=$(jq -r '.baseSha' "$control_task")
risk=$(jq -r '.risk' "$control_task")

violations_file=$(mktemp)
commands_file=$(mktemp)
changed_file_list=$(mktemp)
trap 'rm -f "$violations_file" "$commands_file" "$changed_file_list"' EXIT
agent_changed_files "$base_sha" >"$changed_file_list"

expected_task_sha=$(jq -r '.taskSha256' "$invocation")
current_task_sha=$(sha256sum "$task_abs" | cut -d' ' -f1)
snapshot_task_sha=$(sha256sum "$task_snapshot" | cut -d' ' -f1)
if [[ $current_task_sha != "$expected_task_sha" || $snapshot_task_sha != "$expected_task_sha" ]]; then
  printf '%s\n' "task contract changed after delegation" >>"$violations_file"
fi

current_head=$(git rev-parse HEAD)
if [[ $current_head != "$base_sha" ]]; then
  printf '%s\n' "HEAD changed after delegation; worker commits are forbidden" >>"$violations_file"
fi
if [[ -n $(git diff --cached --name-only) ]]; then
  printf '%s\n' "staged changes detected; worker staging is forbidden" >>"$violations_file"
fi

while IFS= read -r file; do
  [[ -n $file ]] || continue
  if [[ $file == "$task_rel" ]]; then
    continue
  elif agent_path_forbidden "$control_task" "$file"; then
    printf 'forbidden path changed: %s\n' "$file" >>"$violations_file"
  elif ! agent_path_allowed "$control_task" "$file" "$task_rel"; then
    printf 'out-of-scope path changed: %s\n' "$file" >>"$violations_file"
  fi
done <"$changed_file_list"

if [[ $risk == L2 || $risk == L3 ]] && ! agent_has_exact_command "$control_task" pnpm validate; then
  printf '%s\n' "$risk tasks must declare pnpm validate" >>"$violations_file"
fi
if rg -q '^apps/api/src/modules/.+/routes\.ts$' "$changed_file_list" && \
  ! agent_has_exact_command "$control_task" pnpm --filter @onthilab/api test; then
  printf '%s\n' "API route changes require pnpm --filter @onthilab/api test" >>"$violations_file"
fi
if rg -q '^packages/contracts/src/' "$changed_file_list" && \
  ! agent_has_exact_command "$control_task" pnpm validate; then
  printf '%s\n' "contract changes require pnpm validate" >>"$violations_file"
fi

printf '[]\n' >"$commands_file"
command_count=$(jq '.verification | length' "$control_task")
for ((index = 0; index < command_count; index++)); do
  command_id=$(jq -r --argjson index "$index" '.verification[$index].id' "$control_task")
  required=$(jq -r --argjson index "$index" '.verification[$index].required' "$control_task")
  mapfile -d '' -t argv < <(jq -j --argjson index "$index" '.verification[$index].argv[] | ., "\u0000"' "$control_task")
  log_rel=".agent/runs/$task_id/round-$round/commands/$command_id.log"
  log_abs="$root/$log_rel"
  mkdir -p "$(dirname "$log_abs")"
  started=$(date +%s)
  set +e
  "${argv[@]}" >"$log_abs" 2>&1
  exit_code=$?
  set -e
  duration=$(($(date +%s) - started))
  argv_json=$(printf '%s\n' "${argv[@]}" | jq -R . | jq -s .)
  jq \
    --arg id "$command_id" \
    --argjson argv "$argv_json" \
    --argjson required "$required" \
    --argjson exitCode "$exit_code" \
    --argjson durationSeconds "$duration" \
    --arg log "$log_rel" \
    '. + [{id:$id,argv:$argv,required:$required,exitCode:$exitCode,durationSeconds:$durationSeconds,log:$log}]' \
    "$commands_file" >"$commands_file.next"
  mv "$commands_file.next" "$commands_file"
  if [[ $required == true && $exit_code -ne 0 ]]; then
    printf 'required check failed: %s (exit %s)\n' "$command_id" "$exit_code" >>"$violations_file"
  fi
done

agy_status=$(jq -r '.status // "INVALID"' "$agy_output")
if [[ $agy_status != SUCCESS ]]; then
  printf 'Antigravity status is %s\n' "$agy_status" >>"$violations_file"
fi
max_total_tokens=$(jq -r '.executor.maxTotalTokens' "$control_task")
used_total_tokens=$(jq '.usage.total_tokens // 0' "$agy_output")
if ((used_total_tokens > max_total_tokens)); then
  printf 'AGY token budget exceeded: used %s, budget %s\n' "$used_total_tokens" "$max_total_tokens" >>"$violations_file"
fi
init_model=$(jq -r 'select(.event == "init") | .init.model // empty' "$agy_stream" | tail -n 1)
permission_mode=$(jq -r 'select(.event == "init") | .init.permission_mode // empty' "$agy_stream" | tail -n 1)
expected_model=$(jq -r '.executor.model' "$control_task")
if [[ $init_model != "$expected_model" ]]; then
  printf 'AGY init model mismatch: expected %s, got %s\n' "$expected_model" "${init_model:-missing}" >>"$violations_file"
fi
if [[ $permission_mode == always-proceed || -z $permission_mode ]]; then
  printf 'unsafe or missing AGY permission mode: %s\n' "${permission_mode:-missing}" >>"$violations_file"
fi
jq -r '
  select(.event == "step_update" and .step_update.step_type == "tool") |
  (.step_update.tool_info.parameters // {} | tostring)
' "$agy_stream" | while IFS= read -r parameters; do
  if [[ $parameters =~ git[[:space:]]+(add|commit|push|reset|rebase|merge|tag) ]]; then
    printf 'worker attempted forbidden Git operation: %s\n' "$parameters" >>"$violations_file"
  fi
done
if jq -e '.structured_output.needsEscalation == true' "$agy_output" >/dev/null 2>&1; then
  printf '%s\n' "Antigravity requested escalation" >>"$violations_file"
fi

patch_file="$run_dir/diff.patch"
agent_write_patch "$base_sha" "$patch_file"
patch_sha=$(sha256sum "$patch_file" | cut -d' ' -f1)
diff_stat=$(git diff --stat "$base_sha" --)
changed_json=$(jq -R . <"$changed_file_list" | jq -s 'map(select(length > 0))')
violations_json=$(jq -R . <"$violations_file" | jq -s 'map(select(length > 0))')
usage=$(jq '.usage // {}' "$agy_output")
conversation_id=$(jq -r '.conversation_id // ""' "$agy_output")
model=$(jq -r '.executor.model' "$control_task")
effort=$(jq -r '.executor.effort' "$control_task")
if [[ $(jq 'length' <<<"$violations_json") -eq 0 ]]; then
  gate_status=NEEDS_REVIEW
else
  gate_status=FAIL
fi

jq -n \
  --arg taskId "$task_id" \
  --arg baseSha "$base_sha" \
  --arg currentHead "$current_head" \
  --arg patchSha256 "$patch_sha" \
  --argjson changedFiles "$changed_json" \
  --arg diffStat "$diff_stat" \
  --argjson commands "$(<"$commands_file")" \
  --argjson policyViolations "$violations_json" \
  --arg status "$agy_status" \
  --arg conversationId "$conversation_id" \
  --arg model "$model" \
  --arg effort "$effort" \
  --argjson usage "$usage" \
  --arg gateStatus "$gate_status" \
  --arg collectedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{taskId:$taskId,baseSha:$baseSha,currentHead:$currentHead,patchSha256:$patchSha256,changedFiles:$changedFiles,diffStat:$diffStat,commands:$commands,policyViolations:$policyViolations,agy:{status:$status,conversationId:$conversationId,model:$model,effort:$effort,usage:$usage},gateStatus:$gateStatus,collectedAt:$collectedAt}' \
  >"$run_dir/evidence.json"
agent_validate_json "$root/.agent/schemas/evidence.schema.json" "$run_dir/evidence.json" || \
  agent_die "runner produced invalid evidence.json"

if [[ $gate_status == FAIL ]]; then
  jq '{gateStatus,policyViolations,commands:[.commands[]|{id,exitCode,log}]}' "$run_dir/evidence.json"
  exit 1
fi

printf 'Deterministic gates passed. Codex must now review acceptance criteria and diff:\n  %s\n' "$patch_file"
printf 'After review, record the verdict with:\n  scripts/record-codex-review.sh %q --round %s --verdict PASS\n' "$task_rel" "$round"
