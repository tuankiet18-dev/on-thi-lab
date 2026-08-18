#!/usr/bin/env bash

set -euo pipefail

case "${FAKE_AGY_MODE:-success}" in
  invalid-json)
    printf '%s\n' 'not-json'
    exit 0
    ;;
  commit)
    git -c user.name='Fake Worker' -c user.email='worker@example.invalid' \
      commit --allow-empty -m 'forbidden worker commit' >/dev/null
    ;;
  out-of-scope)
    printf '%s\n' 'forbidden' >forbidden.txt
    ;;
  success) ;;
  *) exit 2 ;;
esac

mkdir -p src
printf '%s\n' 'implemented by fake agy' >src/feature.txt

fake_model=${FAKE_AGY_MODEL:-gemini-3.7-flash-medium}
fake_permission_mode=${FAKE_AGY_PERMISSION_MODE:-request-review}
fake_tokens=${FAKE_AGY_TOKENS:-17}
jq -nc \
  --arg model "$fake_model" \
  --arg permissionMode "$fake_permission_mode" \
  '{event:"init",conversation_id:"fake-conversation",init:{cwd:"/tmp/fake",tools:[],permission_mode:$permissionMode,model:$model}}'
jq -nc \
  --argjson totalTokens "$fake_tokens" \
  '{event:"result",result:{conversation_id:"fake-conversation",status:"SUCCESS",response:"{}",structured_output:{summary:"implemented",changedFiles:["src/feature.txt"],acceptance:[{id:"AC-1",status:"PASS",evidence:"fixture"}],commandsAttempted:[],assumptions:[],knownLimitations:[],residualRisks:[],needsEscalation:false},usage:{input_tokens:10,output_tokens:5,thinking_tokens:2,cache_read_tokens:3,total_tokens:$totalTokens}}}'
