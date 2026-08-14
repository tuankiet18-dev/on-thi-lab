#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
count="${LOAD_TEST_USER_COUNT:-300}"
parallelism="${LOAD_TEST_PROVISION_PARALLELISM:-8}"
output_file="${TEST_USERS_OUTPUT_FILE:-$project_root/load-tests/users.local.json}"
base_url="${BASE_URL:-}"
base_url="${base_url%/}"
user_pool_id="${COGNITO_USER_POOL_ID:-}"
client_id="${COGNITO_CLIENT_ID:-}"
campus_code="${LOAD_TEST_CAMPUS_CODE:-HCM}"

if [[ -z "$base_url" || -z "$user_pool_id" || -z "$client_id" ]]; then
  echo "BASE_URL, COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are required." >&2
  exit 1
fi

if ! [[ "$count" =~ ^[0-9]+$ ]] || (( count < 1 || count > 300 )); then
  echo "LOAD_TEST_USER_COUNT must be an integer from 1 to 300." >&2
  exit 1
fi

if ! [[ "$parallelism" =~ ^[0-9]+$ ]] || (( parallelism < 1 || parallelism > 16 )); then
  echo "LOAD_TEST_PROVISION_PARALLELISM must be an integer from 1 to 16." >&2
  exit 1
fi

umask 077
temp_dir="$(mktemp -d)"
password="Lt!$(openssl rand -hex 18)aA7"
trap 'rm -rf "$temp_dir"' EXIT

provision_one() {
  local ordinal="$1"
  local username email token auth_file profile_file
  email="onthilab-loadtest-${ordinal}@staging.onthilab.id.vn"
  username="$email"
  auth_file="$temp_dir/${ordinal}.auth.json"
  profile_file="$temp_dir/${ordinal}.profile.json"

  if ! aws cognito-idp admin-get-user \
    --user-pool-id "$user_pool_id" \
    --username "$username" >/dev/null 2>&1; then
    aws cognito-idp admin-create-user \
      --user-pool-id "$user_pool_id" \
      --username "$username" \
      --message-action SUPPRESS \
      --user-attributes \
        "Name=email,Value=$email" \
        "Name=email_verified,Value=true" \
        "Name=name,Value=Load Test $ordinal" >/dev/null
  fi

  aws cognito-idp admin-set-user-password \
    --user-pool-id "$user_pool_id" \
    --username "$username" \
    --password "$password" \
    --permanent >/dev/null

  aws cognito-idp initiate-auth \
    --client-id "$client_id" \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters "USERNAME=$username,PASSWORD=$password" >"$auth_file"

  token="$(jq -er '.AuthenticationResult.IdToken' "$auth_file")"
  curl --fail --silent --show-error \
    --retry 5 --retry-all-errors --retry-delay 1 \
    --request PUT "$base_url/v1/me" \
    --header "Authorization: Bearer $token" \
    --header "Content-Type: application/json" \
    --data "$(jq -nc \
      --arg fullName "Load Test $ordinal" \
      --arg campusCode "$campus_code" \
      '{fullName: $fullName, campusCode: $campusCode}')" >"$profile_file"
  jq -e '.data.id' "$profile_file" >/dev/null

  jq -nc \
    --arg label "$username" \
    --arg idToken "$token" \
    '{label: $label, idToken: $idToken}' >"$temp_dir/${ordinal}.json"
}

export -f provision_one
export base_url user_pool_id client_id campus_code password temp_dir

echo "Provisioning $count isolated Cognito users (parallelism: $parallelism)..."
seq 1 "$count" | xargs -r -P "$parallelism" -I{} \
  bash -euo pipefail -c 'provision_one "$1"' _ {}

mapfile -t user_files < <(find "$temp_dir" -maxdepth 1 -name '*.json' ! -name '*.auth.json' ! -name '*.profile.json' -print | sort)
if (( ${#user_files[@]} != count )); then
  echo "Expected $count token files, found ${#user_files[@]}." >&2
  exit 1
fi

mkdir -p "$(dirname "$output_file")"
jq -s '.' "${user_files[@]}" >"$output_file.tmp"
mv "$output_file.tmp" "$output_file"
chmod 600 "$output_file"
echo "Created $count profiles and wrote short-lived ID tokens to $output_file"
