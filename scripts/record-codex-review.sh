#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=agent-pipeline-lib.sh
source "$script_dir/agent-pipeline-lib.sh"

usage() {
  printf 'Usage: %s TASK_FILE [--round 0|1|2] --verdict PASS|FAIL [--finding TEXT ...]\n' "$0" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
task_input=$1
shift
round=""
verdict=""
findings='[]'
while (($#)); do
  case "$1" in
    --round)
      [[ $# -ge 2 ]] || usage
      round=$2
      shift 2
      ;;
    --verdict)
      [[ $# -ge 2 ]] || usage
      verdict=$2
      shift 2
      ;;
    --finding)
      [[ $# -ge 2 ]] || usage
      findings=$(jq --arg value "$2" '. + [$value]' <<<"$findings")
      shift 2
      ;;
    *) usage ;;
  esac
done
[[ $verdict == PASS || $verdict == FAIL ]] || usage

agent_require_tools git jq sha256sum
root=$(agent_repo_root)
cd "$root"
task_abs=$(agent_task_abs "$task_input")
task_rel=$(agent_task_rel "$root" "$task_abs")
agent_validate_task "$task_abs"
task_id=$(jq -r '.taskId' "$task_abs")
task_run_dir="$root/.agent/runs/$task_id"
[[ -n $round ]] || round=$(agent_find_latest_round "$task_run_dir")
run_dir="$task_run_dir/round-$round"
evidence="$run_dir/evidence.json"
task_snapshot="$run_dir/task-contract.json"
invocation="$run_dir/invocation.json"
[[ -f $evidence && -f $task_snapshot && -f $invocation ]] || agent_die "run deterministic review first"
expected_task_sha=$(jq -r '.taskSha256' "$invocation")
[[ $(sha256sum "$task_abs" | cut -d' ' -f1) == "$expected_task_sha" ]] || agent_die "task contract changed after delegation"
[[ $(jq -r '.gateStatus' "$evidence") == NEEDS_REVIEW ]] || agent_die "deterministic gates did not pass"

base_sha=$(jq -r '.baseSha' "$task_snapshot")
current_patch=$(mktemp)
trap 'rm -f "$current_patch"' EXIT
agent_write_patch "$base_sha" "$current_patch"
current_patch_sha=$(sha256sum "$current_patch" | cut -d' ' -f1)
evidence_patch_sha=$(jq -r '.patchSha256' "$evidence")
[[ $current_patch_sha == "$evidence_patch_sha" ]] || agent_die "evidence is stale; rerun review-agent-run.sh"

jq -n \
  --arg taskId "$task_id" \
  --argjson round "$round" \
  --arg verdict "$verdict" \
  --arg patchSha256 "$current_patch_sha" \
  --argjson findings "$findings" \
  --arg reviewedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{taskId:$taskId,round:$round,reviewer:"codex",verdict:$verdict,patchSha256:$patchSha256,findings:$findings,reviewedAt:$reviewedAt}' \
  >"$run_dir/review.json"

if [[ $verdict == FAIL ]]; then
  printf 'Codex review recorded FAIL. Remediate without committing; maximum round is 2.\n'
  exit 0
fi

risk=$(jq -r '.risk' "$task_snapshot")
changed_files=$(jq '.changedFiles' "$evidence")
checks=$(jq '[.commands[] | {id,exitCode}]' "$evidence")
model=$(jq -r '.agy.model' "$evidence")
effort=$(jq -r '.agy.effort' "$evidence")
total_tokens=$(jq '.agy.usage.total_tokens // 0' "$evidence")
cache_tokens=$(jq '.agy.usage.cache_read_tokens // 0' "$evidence")
attestation_dir="$root/.agent/attestations"
mkdir -p "$attestation_dir"
attestation="$attestation_dir/$task_id.json"
jq -n \
  --arg taskId "$task_id" \
  --arg risk "$risk" \
  --arg baseSha "$base_sha" \
  --arg patchSha256 "$current_patch_sha" \
  --argjson changedFiles "$changed_files" \
  --argjson checks "$checks" \
  --arg model "$model" \
  --arg effort "$effort" \
  --argjson totalTokens "$total_tokens" \
  --argjson cacheReadTokens "$cache_tokens" \
  --arg reviewedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{taskId:$taskId,risk:$risk,baseSha:$baseSha,patchSha256:$patchSha256,changedFiles:$changedFiles,checks:$checks,acceptanceStatus:"PASS",reviewer:"codex",verdict:"PASS",model:$model,effort:$effort,usage:{totalTokens:$totalTokens,cacheReadTokens:$cacheReadTokens},reviewedAt:$reviewedAt}' \
  >"$attestation"
agent_validate_json "$root/.agent/schemas/attestation.schema.json" "$attestation" || \
  agent_die "generated attestation failed schema validation"

printf 'Codex PASS recorded and sanitized attestation created: %s\n' "$attestation"
