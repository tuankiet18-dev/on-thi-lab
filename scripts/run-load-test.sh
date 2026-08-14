#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
script_path="$project_root/load-tests/attempt-flow.js"

if command -v k6 >/dev/null 2>&1; then
  exec k6 run "$@" "$script_path"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "k6 is not in PATH and Docker is unavailable." >&2
  echo "Install k6 or start Docker before running the load test." >&2
  exit 1
fi

docker_args=(
  run --rm
  --user "$(id -u):$(id -g)"
  --volume "$project_root:/workspace:ro"
  --workdir /workspace
)

for name in \
  BASE_URL EXAM_ID TEST_USERS_FILE TARGET_VUS MAX_QUESTIONS \
  ANSWER_INTERVAL_SECONDS RAMP_UP HOLD RAMP_DOWN; do
  if [[ -n "${!name:-}" ]]; then
    docker_args+=(--env "$name")
  fi
done

exec docker "${docker_args[@]}" grafana/k6:latest \
  run --include-system-env-vars "$@" /workspace/load-tests/attempt-flow.js
