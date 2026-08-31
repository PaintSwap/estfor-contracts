#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

RPC_PORT=${ANVIL_PORT:-8545}
RPC_URL="http://127.0.0.1:${RPC_PORT}"
DEPLOYER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
DEPENDENCIES_OUTPUT=${DEPENDENCIES_OUTPUT:-.deployments/local-dependencies.json}
DEPLOYMENT_OUTPUT=${DEPLOYMENT_OUTPUT:-.deployments/deployment.json}

if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "An RPC server is already listening at $RPC_URL; use ANVIL_PORT to select a blank port." >&2
  exit 1
fi

echo "Building deployment contracts with Foundry..."
forge build --skip test --no-lint

mkdir -p .deployments "$(dirname "$DEPENDENCIES_OUTPUT")" "$(dirname "$DEPLOYMENT_OUTPUT")"
rm -f "$DEPENDENCIES_OUTPUT"

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

echo "Broadcasting CI-only local dependency fixture..."
PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY" DEPENDENCIES_OUTPUT="$DEPENDENCIES_OUTPUT" \
  forge script scripts/LocalAnvilDependencies.s.sol:LocalAnvilDependencies \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --non-interactive

export RPC_URL DEPLOYMENT_OUTPUT
export PRIVATE_KEY="$DEPLOYER_PRIVATE_KEY"
export BRUSH_ADDRESS WFTM_ADDRESS VRF_ADDRESS ROUTER_ADDRESS
export PAINTSWAP_MARKETPLACE_WHITELIST_ADDRESS USDC_ADDRESS LZ_ENDPOINT_ADDRESS
BRUSH_ADDRESS=$(jq -er '.brush' "$DEPENDENCIES_OUTPUT")
WFTM_ADDRESS=$(jq -er '.wftm' "$DEPENDENCIES_OUTPUT")
VRF_ADDRESS=$(jq -er '.vrf' "$DEPENDENCIES_OUTPUT")
ROUTER_ADDRESS=$(jq -er '.router' "$DEPENDENCIES_OUTPUT")
PAINTSWAP_MARKETPLACE_WHITELIST_ADDRESS=$(jq -er '.paintSwapMarketplaceWhitelist' "$DEPENDENCIES_OUTPUT")
USDC_ADDRESS=$(jq -er '.usdc' "$DEPENDENCIES_OUTPUT")
LZ_ENDPOINT_ADDRESS=$(jq -er '.lzEndpoint' "$DEPENDENCIES_OUTPUT")

IS_BETA=${IS_BETA:-false} \
ADD_TEST_DATA=${ADD_TEST_DATA:-false} \
SKIP_BUILD=true \
  bash scripts/deploy-foundry.sh
