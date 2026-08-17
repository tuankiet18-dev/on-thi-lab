#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=agent-pipeline-lib.sh
source "$script_dir/agent-pipeline-lib.sh"

[[ $# -ge 1 && $# -le 3 ]] || \
  agent_die "usage: $0 TASK_CONTRACT [BASE_REF] [DESTINATION]"

task_input=$1
base_ref=${2:-HEAD}
agent_require_tools git jq sha256sum
root=$(agent_repo_root)
cd "$root"
task_abs=$(agent_task_abs "$task_input")
[[ -f $task_abs ]] || agent_die "task contract not found: $task_input"
agent_validate_task "$task_abs"

task_id=$(jq -r '.taskId' "$task_abs")
task_slug=$(tr '[:upper:]_' '[:lower:]-' <<<"$task_id")
task_slug=${task_slug%$'\n'}
branch="codex/$task_slug"
destination=${3:-"$(dirname "$root")/$(basename "$root")-worktrees/$task_slug"}
base_sha=$(git rev-parse "$base_ref^{commit}")

[[ ! -e $destination ]] || agent_die "worktree destination already exists: $destination"
if git show-ref --verify --quiet "refs/heads/$branch"; then
  agent_die "task branch already exists: $branch"
fi

git worktree add -b "$branch" "$destination" "$base_sha"
mkdir -p "$destination/.agent/tasks"
destination_task="$destination/.agent/tasks/$task_id.json"
jq --arg baseSha "$base_sha" '.baseSha = $baseSha' "$task_abs" >"$destination_task"

[[ -d "$root/node_modules" ]] || \
  agent_die "primary workspace has no node_modules; run pnpm install there before creating tasks"
ln -s "$root/node_modules" "$destination/node_modules"
while IFS= read -r package_file; do
  package_dir=$(dirname "$package_file")
  [[ $package_dir != . && -d "$root/$package_dir/node_modules" ]] || continue
  mkdir -p "$destination/$package_dir"
  ln -s "$root/$package_dir/node_modules" "$destination/$package_dir/node_modules"
done < <(git ls-files '*/package.json')

printf 'Created isolated task worktree.\n'
printf '  branch: %s\n' "$branch"
printf '  path: %s\n' "$destination"
printf '  task: .agent/tasks/%s.json\n' "$task_id"
printf 'Run:\n  cd %q && scripts/delegate-to-agy.sh %q\n' \
  "$destination" ".agent/tasks/$task_id.json"
