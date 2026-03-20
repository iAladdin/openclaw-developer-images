#!/usr/bin/env bash
set -euo pipefail

repo_url="${OPENCLAW_UPSTREAM_URL:-https://github.com/openclaw/openclaw.git}"

if [[ -f deps/openclaw/package.json || -f deps/package.json ]]; then
  exit 0
fi

if git config -f .gitmodules --get submodule.deps.path >/dev/null 2>&1; then
  git config submodule.deps.url "$repo_url"
  git submodule update --init --recursive deps
  exit 0
fi

if git config -f .gitmodules --get submodule.openclaw.path >/dev/null 2>&1; then
  git config submodule.openclaw.url "$repo_url"
  git submodule update --init --recursive deps/openclaw
  exit 0
fi

mkdir -p deps
git clone --depth 1 "$repo_url" deps/openclaw
