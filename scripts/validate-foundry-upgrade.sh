#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || "$1" != *:* ]]; then
  echo "Usage: $0 <source-path>:<contract-name>" >&2
  exit 1
fi

fully_qualified_name=$1
source_path=${fully_qualified_name%:*}
contract_name=${fully_qualified_name##*:}
source_file=${source_path##*/}
source_name=${source_file%.sol}
out_dir=${FOUNDRY_OUT:-out}
cache_dir=${FOUNDRY_CACHE_PATH:-cache-foundry}
cache_file="$cache_dir/solidity-files-cache.json"

mapfile -t build_ids < <(
  jq -er \
    --arg source "$source_path" \
    --arg contract "$contract_name" \
    --arg artifactPath "$source_name.sol/$contract_name.json" \
    '[.files[$source].artifacts[$contract] | .. | objects | select(.path? == $artifactPath) | .build_id] | unique[]' \
    "$cache_file"
)

if [[ ${#build_ids[@]} -ne 1 ]]; then
  echo "Expected one current build ID for $fully_qualified_name, found ${#build_ids[@]}." >&2
  exit 1
fi

build_info="$out_dir/build-info/${build_ids[0]}.json"
if [[ ! -f "$build_info" ]]; then
  echo "Current build info does not exist: $build_info" >&2
  exit 1
fi

mkdir -p .deployments
validation_dir=$(mktemp -d .deployments/upgrade-validation.XXXXXX)
trap 'rm -rf "$validation_dir"' EXIT
ln "$build_info" "$validation_dir/"

npx --yes @openzeppelin/upgrades-core@^1.45.0 validate \
  "$validation_dir" \
  --contract "$fully_qualified_name" \
  --unsafeAllow external-library-linking \
  --requireReference
