#!/usr/bin/env bash

set -euo pipefail

agent_lib_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

agent_die() {
  printf 'agent-pipeline: %s\n' "$*" >&2
  exit 1
}

agent_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || agent_die "not inside a Git repository"
}

agent_require_tools() {
  local tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || agent_die "required tool not found: $tool"
  done
}

agent_require_isolated_worktree() {
  [[ ${AGENT_PIPELINE_TEST_ALLOW_PRIMARY:-0} == 1 ]] && return 0
  local git_dir common_dir
  git_dir=$(cd "$(git rev-parse --git-dir)" && pwd)
  common_dir=$(cd "$(git rev-parse --git-common-dir)" && pwd)
  [[ $git_dir != "$common_dir" ]] || \
    agent_die "delegation must run in an isolated linked worktree; use scripts/create-agent-worktree.sh"
}

agent_validate_json() {
  local schema_file=$1
  local data_file=$2
  local validator=${AGENT_SCHEMA_VALIDATOR:-"$agent_lib_dir/validate-agent-json.mjs"}
  node "$validator" "$schema_file" "$data_file"
}

agent_task_abs() {
  local task_file=$1
  if [[ $task_file = /* ]]; then
    printf '%s\n' "$task_file"
  else
    printf '%s/%s\n' "$(pwd)" "$task_file"
  fi
}

agent_task_rel() {
  local root=$1
  local task_abs=$2
  [[ $task_abs == "$root/"* ]] || agent_die "task contract must be inside the repository"
  printf '%s\n' "${task_abs#"$root/"}"
}

agent_validate_task() {
  local task_file=$1
  local root
  root=$(agent_repo_root)
  agent_validate_json "$root/.agent/schemas/task.schema.json" "$task_file" || \
    agent_die "task contract does not match task.schema.json: $task_file"
  jq -e '
    type == "object" and
    (.taskId | test("^[A-Z][A-Z0-9_-]{2,63}$")) and
    (.title | type == "string" and length > 0) and
    (.objective | type == "string" and length > 0) and
    (.risk | IN("L0", "L1", "L2", "L3")) and
    (.baseSha | test("^[0-9a-f]{40}$")) and
    (.executor.selectedBy == "codex") and
    (.executor.effort | IN("low", "medium", "high")) and
    (.executor.timeout | test("^[1-9][0-9]*[smh]$")) and
    (.executor.maxTotalTokens | type == "number" and . >= 1000 and floor == .) and
    (.allowedPaths | type == "array" and length > 0) and
    (.forbiddenPaths | type == "array") and
    (.contextFiles | type == "array" and length > 0) and
    (.acceptanceCriteria | type == "array" and length > 0) and
    (.verification | type == "array" and length > 0) and
    (.verification | all(
      (.id | type == "string" and length > 0) and
      (.argv | type == "array" and length >= 2) and
      (.required | type == "boolean")
    )) and
    (.rollback | type == "string" and length > 0) and
    (.escalateIf | type == "array" and length > 0)
  ' "$task_file" >/dev/null || agent_die "invalid task contract: $task_file"

  local model effort reason
  model=$(jq -r '.executor.model' "$task_file")
  effort=$(jq -r '.executor.effort' "$task_file")
  reason=$(jq -r '.executor.overrideReason // ""' "$task_file")

  case "$model" in
    gemini-3.7-flash-medium)
      [[ $effort == medium ]] || agent_die "default model must use medium effort"
      ;;
    gemini-3.7-flash-high)
      [[ $effort == high ]] || agent_die "Flash High escalation must use high effort"
      [[ -n $reason ]] || agent_die "model escalation requires executor.overrideReason"
      ;;
    *)
      [[ $effort == high ]] || agent_die "a different model family requires high effort"
      [[ -n $reason ]] || agent_die "model override requires executor.overrideReason"
      jq -e '(.executor.priorAttempts // []) | any(.model == "gemini-3.7-flash-high" and .effort == "high")' \
        "$task_file" >/dev/null || \
        agent_die "a different model family requires a recorded Gemini 3.7 Flash High attempt"
      ;;
  esac

  local command_count index
  command_count=$(jq '.verification | length' "$task_file")
  for ((index = 0; index < command_count; index++)); do
    mapfile -d '' -t argv < <(jq -j --argjson index "$index" '.verification[$index].argv[] | ., "\u0000"' "$task_file")
    agent_validate_command "${argv[@]}"
  done
}

agent_validate_command() {
  local -a argv=("$@")
  local arg
  [[ ${argv[0]} == pnpm ]] || agent_die "verification commands must invoke pnpm directly"
  for arg in "${argv[@]}"; do
    [[ $arg != *$'\n'* && $arg != *$'\r'* ]] || agent_die "newline in verification argument"
  done

  if [[ ${argv[1]} =~ ^(validate|format:check|typecheck|test|build|agent:test)$ ]]; then
    return 0
  fi

  [[ ${argv[1]} == --filter && ${#argv[@]} -ge 4 ]] || \
    agent_die "verification command is outside the pnpm allowlist"
  [[ ${argv[2]} =~ ^@onthilab/(api|web|worker|contracts|database|importer|config|infra)$ ]] || \
    agent_die "pnpm filter is outside the workspace allowlist: ${argv[2]}"
  [[ ${argv[3]} =~ ^(test|typecheck|build|synth)$ ]] || \
    agent_die "pnpm script is outside the verification allowlist: ${argv[3]}"
}

agent_changed_files() {
  local base_sha=$1
  {
    git diff --name-only "$base_sha" --
    git ls-files --others --exclude-standard
  } | LC_ALL=C sort -u
}

agent_path_matches() {
  local path=$1
  local pattern=$2
  [[ $path == $pattern ]]
}

agent_path_allowed() {
  local task_file=$1
  local path=$2
  local task_rel=$3
  [[ $path == "$task_rel" ]] && return 0

  local pattern
  while IFS= read -r pattern; do
    agent_path_matches "$path" "$pattern" && return 0
  done < <(jq -r '.allowedPaths[]' "$task_file")
  return 1
}

agent_path_forbidden() {
  local task_file=$1
  local path=$2
  local pattern
  while IFS= read -r pattern; do
    agent_path_matches "$path" "$pattern" && return 0
  done < <(jq -r '.forbiddenPaths[]' "$task_file")
  return 1
}

agent_write_patch() {
  local base_sha=$1
  local output=$2
  local excluded=${3:-}
  local temporary
  temporary=$(mktemp)
  if [[ -n $excluded ]]; then
    git diff --binary "$base_sha" -- . ":(exclude)$excluded" >"$temporary"
  else
    git diff --binary "$base_sha" -- >"$temporary"
  fi

  local file
  while IFS= read -r file; do
    [[ -f $file ]] || continue
    [[ -n $excluded && $file == "$excluded" ]] && continue
    git diff --no-index --binary /dev/null "$file" >>"$temporary" 2>/dev/null || true
  done < <(git ls-files --others --exclude-standard | LC_ALL=C sort)
  mv "$temporary" "$output"
}

agent_find_latest_round() {
  local task_run_dir=$1
  local latest=-1 dir value
  shopt -s nullglob
  for dir in "$task_run_dir"/round-*; do
    value=${dir##*-}
    [[ $value =~ ^[0-9]+$ ]] || continue
    ((value > latest)) && latest=$value
  done
  shopt -u nullglob
  ((latest >= 0)) || agent_die "no Antigravity run found under $task_run_dir"
  printf '%s\n' "$latest"
}

agent_has_exact_command() {
  local task_file=$1
  shift
  local expected
  expected=$(printf '%s\0' "$@" | sha256sum | cut -d' ' -f1)
  local count index actual
  count=$(jq '.verification | length' "$task_file")
  for ((index = 0; index < count; index++)); do
    actual=$(jq -j --argjson index "$index" '.verification[$index].argv[] | ., "\u0000"' "$task_file" | sha256sum | cut -d' ' -f1)
    [[ $actual == "$expected" ]] && return 0
  done
  return 1
}
