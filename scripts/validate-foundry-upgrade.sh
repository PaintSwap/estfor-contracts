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

validation_dir=$(mktemp -d "${TMPDIR:-/tmp}/estfor-upgrade-validation.XXXXXX")
trap 'rm -rf "$validation_dir"' EXIT

build_info="$out_dir/build-info/${build_ids[0]}.json"
if [[ ! -f "$build_info" ]]; then
  echo "Current build info does not exist: $build_info" >&2
  exit 1
fi
cp "$build_info" "$validation_dir/"

reference=$(sed -n 's/.*@custom:oz-upgrades-from[[:space:]]\+\([^[:space:]]\+\).*/\1/p' "$source_path")
reference_name=${reference##*:}
reference_count=$(jq --arg contract "$reference_name" '[.output.contracts[]?[$contract] // empty] | length' "$build_info")
if [[ $reference_count -eq 0 ]]; then
  mapfile -t reference_build_ids < <(
    jq -er \
      --arg contract "$reference_name" \
      '[.files[]?.artifacts[$contract] | .. | objects | .build_id? // empty] | unique[]' \
      "$cache_file"
  )
  if [[ ${#reference_build_ids[@]} -ne 1 ]]; then
    echo "Expected one current build ID for reference $reference, found ${#reference_build_ids[@]}." >&2
    exit 1
  fi
  reference_build_info="$out_dir/build-info/${reference_build_ids[0]}.json"
  if [[ ! -f "$reference_build_info" ]]; then
    echo "Current reference build info does not exist: $reference_build_info" >&2
    exit 1
  fi
  if jq -e --arg source "$source_path" --arg contract "$contract_name" \
    '.output.contracts[$source][$contract] != null' "$reference_build_info" >/dev/null; then
    echo "Reference build info duplicates current contract $fully_qualified_name." >&2
    exit 1
  fi
  cp "$reference_build_info" "$validation_dir/"
fi

unsafe_allow=external-library-linking
if [[ $fully_qualified_name == "contracts/Bridge/Bridge.sol:Bridge" ]]; then
  unsafe_allow+=,constructor,state-variable-immutable
fi

pnpm exec openzeppelin-upgrades-core validate \
  "$validation_dir" \
  --contract "$fully_qualified_name" \
  --unsafeAllow "$unsafe_allow" \
  --requireReference
