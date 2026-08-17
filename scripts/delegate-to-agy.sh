#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=agent-pipeline-lib.sh
source "$script_dir/agent-pipeline-lib.sh"

usage() {
  printf 'Usage: %s TASK_FILE [--round 0|1|2] [--conversation ID] [--agy PATH]\n' "$0" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
task_input=$1
shift
round=0
conversation_id=""
agy_bin=${AGY_BIN:-agy}

while (($#)); do
  case "$1" in
    --round)
      [[ $# -ge 2 ]] || usage
      round=$2
      shift 2
      ;;
    --conversation)
      [[ $# -ge 2 ]] || usage
      conversation_id=$2
      shift 2
      ;;
    --agy)
      [[ $# -ge 2 ]] || usage
      agy_bin=$2
      shift 2
      ;;
    *) usage ;;
  esac
done

[[ $round =~ ^[0-2]$ ]] || agent_die "remediation round must be 0, 1 or 2"
agent_require_tools git jq sha256sum node "$agy_bin"
root=$(agent_repo_root)
cd "$root"
agent_require_isolated_worktree
task_abs=$(agent_task_abs "$task_input")
[[ -f $task_abs ]] || agent_die "task contract not found: $task_input"
task_rel=$(agent_task_rel "$root" "$task_abs")
agent_validate_task "$task_abs"

task_id=$(jq -r '.taskId' "$task_abs")
base_sha=$(jq -r '.baseSha' "$task_abs")
model=$(jq -r '.executor.model' "$task_abs")
effort=$(jq -r '.executor.effort' "$task_abs")
timeout=$(jq -r '.executor.timeout' "$task_abs")
max_total_tokens=$(jq -r '.executor.maxTotalTokens' "$task_abs")
head_sha=$(git rev-parse HEAD)
[[ $head_sha == "$base_sha" ]] || agent_die "HEAD $head_sha does not match task baseSha $base_sha; Antigravity must not work on committed remediation"

if ((round == 0)); then
  while IFS= read -r file; do
    [[ $file == "$task_rel" ]] || agent_die "initial task worktree already has unrelated change: $file"
  done < <(agent_changed_files "$base_sha")
fi

run_dir="$root/.agent/runs/$task_id/round-$round"
[[ ! -e $run_dir ]] || agent_die "run already exists: $run_dir"
mkdir -p "$run_dir"
task_sha=$(sha256sum "$task_abs" | cut -d' ' -f1)
cp "$task_abs" "$run_dir/task-contract.json"
chmod a-w "$run_dir/task-contract.json"

template="$root/.agent/prompts/implement.md"
prompt=$(<"$template")
prompt=${prompt//'{{TASK_FILE}}'/$task_rel}
if ((round > 0)); then
  prior_round=$((round - 1))
  prompt+=$'\n\nThis is remediation round '
  prompt+="$round"
  prompt+=$' of 2. Read the prior deterministic findings at `.agent/runs/'"$task_id"'/round-'"$prior_round"'/evidence.json` and the Codex findings at `.agent/runs/'"$task_id"'/round-'"$prior_round"'/review.json` when present. Fix only those findings plus any directly related regression.'
fi

jq -n \
  --arg taskId "$task_id" \
  --arg baseSha "$base_sha" \
  --arg taskSha256 "$task_sha" \
  --arg model "$model" \
  --arg effort "$effort" \
  --argjson maxTotalTokens "$max_total_tokens" \
  --argjson round "$round" \
  --arg startedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{taskId:$taskId,baseSha:$baseSha,taskSha256:$taskSha256,model:$model,effort:$effort,maxTotalTokens:$maxTotalTokens,round:$round,startedAt:$startedAt}' \
  >"$run_dir/invocation.json"
chmod a-w "$run_dir/invocation.json"

command=("$agy_bin" -p "$prompt" --output-format stream-json
  --json-schema "$root/.agent/schemas/result.schema.json"
  --model "$model" --effort "$effort" --sandbox --print-timeout "$timeout")
if [[ -n $conversation_id ]]; then
  command+=(--conversation "$conversation_id")
fi

set +e
node "$script_dir/run-agy-with-budget.mjs" \
  --budget "$max_total_tokens" \
  --stdout "$run_dir/agy-stream.ndjson" \
  --stderr "$run_dir/agy-stderr.log" \
  -- "${command[@]}"
agy_exit=$?
set -e
printf '%s\n' "$agy_exit" >"$run_dir/agy-exit-code"
if [[ $agy_exit -eq 75 ]]; then
  agent_die "Antigravity exceeded maxTotalTokens=$max_total_tokens; see $run_dir/agy-stderr.log"
fi

jq -e -s 'all(.[]; type == "object")' "$run_dir/agy-stream.ndjson" >/dev/null 2>&1 || \
  agent_die "Antigravity did not return valid NDJSON; see $run_dir"
jq -s '[.[] | select(.event == "result") | .result] | last // empty' \
  "$run_dir/agy-stream.ndjson" >"$run_dir/agy-output.json"
jq -e 'type == "object"' "$run_dir/agy-output.json" >/dev/null 2>&1 || \
  agent_die "Antigravity stream has no terminal result event"
status=$(jq -r '.status // "INVALID"' "$run_dir/agy-output.json")
if [[ $agy_exit -ne 0 || $status != SUCCESS ]]; then
  agent_die "Antigravity failed with exit=$agy_exit status=$status; see $run_dir"
fi
jq -e '.structured_output | type == "object"' "$run_dir/agy-output.json" >/dev/null || \
  agent_die "Antigravity response has no structured_output"
jq '.structured_output' "$run_dir/agy-output.json" >"$run_dir/agent-result.json"
agent_validate_json "$root/.agent/schemas/result.schema.json" "$run_dir/agent-result.json" || \
  agent_die "Antigravity structured output failed local schema validation"

printf 'Antigravity completed without committing. Review with:\n  scripts/review-agent-run.sh %q --round %s\n' "$task_rel" "$round"
