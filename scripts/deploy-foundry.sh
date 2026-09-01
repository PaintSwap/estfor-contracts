#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

required_variables=(
  RPC_URL
  PRIVATE_KEY
  BRUSH_ADDRESS
  WFTM_ADDRESS
  VRF_ADDRESS
  ROUTER_ADDRESS
  PAINTSWAP_MARKETPLACE_WHITELIST_ADDRESS
  USDC_ADDRESS
  LZ_ENDPOINT_ADDRESS
)
for variable in "${required_variables[@]}"; do
  if [[ -z ${!variable:-} ]]; then
    echo "$variable is required" >&2
    exit 1
  fi
done

IS_BETA=${IS_BETA:-false}
ADD_TEST_DATA=${ADD_TEST_DATA:-false}
if [[ $IS_BETA != "true" && $IS_BETA != "false" ]]; then
  echo "IS_BETA must be true or false" >&2
  exit 1
fi
if [[ $ADD_TEST_DATA != "true" && $ADD_TEST_DATA != "false" ]]; then
  echo "ADD_TEST_DATA must be true or false" >&2
  exit 1
fi
if [[ $ADD_TEST_DATA == "true" && $IS_BETA != "true" ]]; then
  echo "ADD_TEST_DATA=true requires IS_BETA=true" >&2
  exit 1
fi
if [[ $ADD_TEST_DATA == "true" && -z ${ALICE_PRIVATE_KEY:-} ]]; then
  echo "ALICE_PRIVATE_KEY is required when ADD_TEST_DATA=true" >&2
  exit 1
fi

DEPLOY_DATA_DIR=${DEPLOY_DATA_DIR:-.forge-deploy-data}
DEPLOYMENT_OUTPUT=${DEPLOYMENT_OUTPUT:-.deployments/deployment.json}
DEPLOY_PHASE_DIR=${DEPLOY_PHASE_DIR:-.deployments/phases}
START_TIME=$SECONDS

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "RPC_URL is not reachable" >&2
  exit 1
fi

if [[ ${SKIP_BUILD:-false} != "true" ]]; then
  echo "Building deployment contracts with Foundry..."
  forge build --skip test --no-lint
fi

rm -rf "$DEPLOY_DATA_DIR" "$DEPLOY_PHASE_DIR"
mkdir -p "$DEPLOY_DATA_DIR" "$DEPLOY_PHASE_DIR" "$(dirname "$DEPLOYMENT_OUTPUT")"

run_deploy_phase() {
  local phase=$1
  local phase_output="${DEPLOY_PHASE_DIR}/${phase}.json"
  echo "Broadcasting game deployment phase ${phase}/8..."
  DEPLOY_DATA_DIR="$DEPLOY_DATA_DIR" \
    DEPLOYMENT_INPUT="$DEPLOYMENT_OUTPUT" \
    DEPLOY_PHASE="$phase" \
    DEPLOYMENT_PHASE_OUTPUT="$phase_output" \
    IS_BETA="$IS_BETA" \
    forge script scripts/DeployGame.s.sol:DeployGame \
      --rpc-url "$RPC_URL" \
      --broadcast \
      --non-interactive \
      --code-size-limit 65536 \
      --gas-estimate-multiplier 150

  if [[ $phase -le 4 ]]; then
    if [[ $phase -eq 1 ]]; then
      cp "$phase_output" "$DEPLOYMENT_OUTPUT"
    else
      jq -s '.[0] * .[1]' "$DEPLOYMENT_OUTPUT" "$phase_output" >"${DEPLOY_PHASE_DIR}/merged.json"
      mv "${DEPLOY_PHASE_DIR}/merged.json" "$DEPLOYMENT_OUTPUT"
    fi
  fi
}

run_test_data_phase() {
  local phase=$1
  echo "Broadcasting optional test lifecycle phase ${phase}/8..."
  DEPLOY_DATA_DIR="$DEPLOY_DATA_DIR" \
    DEPLOYMENT_INPUT="$DEPLOYMENT_OUTPUT" \
    TEST_DATA_PHASE="$phase" \
    forge script scripts/SeedTestData.s.sol:SeedTestData \
      --rpc-url "$RPC_URL" \
      --broadcast \
      --non-interactive \
      --gas-estimate-multiplier 150
}

advance_time() {
  cast rpc --rpc-url "$RPC_URL" evm_increaseTime "$1" >/dev/null
  cast rpc --rpc-url "$RPC_URL" evm_mine >/dev/null
}

run_deploy_phase 1

echo "Encoding canonical deployment calldata and linking bytecode..."
DEPLOYMENT_INPUT="$DEPLOYMENT_OUTPUT" \
  DEPLOY_DATA_DIR="$DEPLOY_DATA_DIR" \
  IS_BETA="$IS_BETA" \
  ADD_TEST_DATA="$ADD_TEST_DATA" \
  pnpm exec ts-node --transpile-only scripts/prepareForgeDeployData.ts

for phase in 2 3 4 5 6 7 8; do run_deploy_phase "$phase"; done

if [[ $ADD_TEST_DATA == "true" ]]; then
  run_test_data_phase 1
  advance_time 10000
  run_test_data_phase 2
  advance_time 300
  run_test_data_phase 3
  advance_time 1000000
  run_test_data_phase 4
  advance_time 10
  run_test_data_phase 5
  advance_time 172800
  run_test_data_phase 6
  advance_time 1000
  run_test_data_phase 7
  run_test_data_phase 8
fi

echo "Running RPC-backed post-deployment assertions..."
DEPLOY_DATA_DIR="$DEPLOY_DATA_DIR" \
  DEPLOYMENT_INPUT="$DEPLOYMENT_OUTPUT" \
  forge script scripts/VerifyDeployment.s.sol:VerifyDeployment \
    --rpc-url "$RPC_URL" \
    --non-interactive

echo "Full game deployment passed in $((SECONDS - START_TIME)) seconds."
echo "Addresses: $DEPLOYMENT_OUTPUT"
