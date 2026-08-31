#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

RPC_PORT=${ANVIL_PORT:-8545}
RPC_URL="http://127.0.0.1:${RPC_PORT}"
DEPLOYER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
ANVIL_ALICE_PRIVATE_KEY=${ANVIL_ALICE_PRIVATE_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}
DEPLOY_DATA_DIR=${DEPLOY_DATA_DIR:-.forge-deploy-data}
DEPLOYMENT_OUTPUT=${DEPLOYMENT_OUTPUT:-.deployments/beta-local.json}
START_TIME=$SECONDS

if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "An RPC server is already listening at $RPC_URL; use ANVIL_PORT to select a blank port." >&2
  exit 1
fi

echo "Building deployment contracts with Foundry..."
forge build --skip test --no-lint

rm -rf "$DEPLOY_DATA_DIR" .deployments/phases
mkdir -p "$DEPLOY_DATA_DIR" .deployments/phases "$(dirname "$DEPLOYMENT_OUTPUT")"

echo "Starting blank Anvil chain 31337 at $RPC_URL..."
anvil \
  --host 127.0.0.1 \
  --port "$RPC_PORT" \
  --chain-id 31337 \
  --hardfork cancun \
  --code-size-limit 49152 \
  --gas-limit 1000000000 \
  --silent >.deployments/anvil.log 2>&1 &
ANVIL_PID=$!
cleanup() {
  kill "$ANVIL_PID" >/dev/null 2>&1 || true
  wait "$ANVIL_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 100); do
  if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
if [[ $(cast chain-id --rpc-url "$RPC_URL") != "31337" ]]; then
  echo "Anvil did not start with chain id 31337" >&2
  exit 1
fi

run_deploy_phase() {
  local phase=$1
  local phase_output=".deployments/phases/${phase}.json"
  echo "Broadcasting deployment phase ${phase}/9..."
  PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" \
    DEPLOY_DATA_DIR="$DEPLOY_DATA_DIR" \
    DEPLOYMENT_INPUT="$DEPLOYMENT_OUTPUT" \
    DEPLOY_PHASE="$phase" \
    DEPLOYMENT_PHASE_OUTPUT="$phase_output" \
    forge script scripts/DeployBeta.s.sol:DeployBeta \
      --rpc-url "$RPC_URL" \
      --broadcast \
      --non-interactive \
      --code-size-limit 49152 \
      --gas-estimate-multiplier 150

  if [[ $phase -le 5 ]]; then
    if [[ $phase -eq 1 ]]; then
      cp "$phase_output" "$DEPLOYMENT_OUTPUT"
    else
      jq -s '.[0] * .[1]' "$DEPLOYMENT_OUTPUT" "$phase_output" >.deployments/merged.json
      mv .deployments/merged.json "$DEPLOYMENT_OUTPUT"
    fi
  fi
}

run_test_data_phase() {
  local phase=$1
  echo "Broadcasting beta lifecycle phase ${phase}/8..."
  PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" \
    ALICE_PRIVATE_KEY="$ANVIL_ALICE_PRIVATE_KEY" \
    DEPLOY_DATA_DIR="$DEPLOY_DATA_DIR" \
    DEPLOYMENT_INPUT="$DEPLOYMENT_OUTPUT" \
    TEST_DATA_PHASE="$phase" \
    forge script scripts/SeedBetaTestData.s.sol:SeedBetaTestData \
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
DEPLOYMENT_INPUT="$DEPLOYMENT_OUTPUT" DEPLOY_DATA_DIR="$DEPLOY_DATA_DIR" \
  pnpm exec ts-node --transpile-only scripts/prepareForgeDeployData.ts

for phase in 2 3 4 5 6 7 8 9; do run_deploy_phase "$phase"; done

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

echo "Running RPC-backed post-deployment assertions..."
ALICE_PRIVATE_KEY="$ANVIL_ALICE_PRIVATE_KEY" \
  DEPLOY_DATA_DIR="$DEPLOY_DATA_DIR" \
  DEPLOYMENT_INPUT="$DEPLOYMENT_OUTPUT" \
  forge script scripts/VerifyBetaDeployment.s.sol:VerifyBetaDeployment \
    --rpc-url "$RPC_URL" \
    --non-interactive

echo "Full beta deployment smoke passed in $((SECONDS - START_TIME)) seconds."
echo "Addresses: $DEPLOYMENT_OUTPUT"
