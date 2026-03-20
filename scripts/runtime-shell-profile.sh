#!/usr/bin/env sh

prepend_path() {
  case ":${PATH:-}:" in
    *":$1:"*) ;;
    *) PATH="$1${PATH:+:$PATH}" ;;
  esac
}

export GOPATH="${GOPATH:-/home/node/.openclaw/.go}"
export GOBIN="${GOBIN:-/home/node/.openclaw/.go/bin}"
export GOMODCACHE="${GOMODCACHE:-/home/node/.openclaw/.cache/go/pkg/mod}"
export GOCACHE="${GOCACHE:-/home/node/.openclaw/.cache/go/build}"
export OPENCLAW_BUILTIN_CARGO_HOME="${OPENCLAW_BUILTIN_CARGO_HOME:-/opt/openclaw/toolchains/cargo}"
export OPENCLAW_BUILTIN_RUSTUP_HOME="${OPENCLAW_BUILTIN_RUSTUP_HOME:-/opt/openclaw/toolchains/rustup}"
export CARGO_HOME="${CARGO_HOME:-/home/node/.openclaw/.cargo}"
export RUSTUP_HOME="${RUSTUP_HOME:-/home/node/.openclaw/.rustup}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/home/node/.openclaw/.cargo-target}"
export NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-/home/node/.openclaw/.npm-global}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/home/node/.openclaw/.npm-cache}"
export NPM_CONFIG_USERCONFIG="${NPM_CONFIG_USERCONFIG:-/home/node/.openclaw/.npmrc}"
export COREPACK_HOME="${COREPACK_HOME:-/home/node/.openclaw/.corepack}"
export PNPM_HOME="${PNPM_HOME:-/home/node/.openclaw/.pnpm}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/home/node/.openclaw/.cache}"
export PYTHONUSERBASE="${PYTHONUSERBASE:-/home/node/.openclaw/.local}"
export PIP_USER="${PIP_USER:-1}"
export PIP_BREAK_SYSTEM_PACKAGES="${PIP_BREAK_SYSTEM_PACKAGES:-1}"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-/home/node/.openclaw/.cache/pip}"
export PIPX_HOME="${PIPX_HOME:-/home/node/.openclaw/.pipx}"
export PIPX_BIN_DIR="${PIPX_BIN_DIR:-/home/node/.openclaw/.local/bin}"
export HF_HOME="${HF_HOME:-/home/node/.openclaw/.cache/huggingface}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-/home/node/.openclaw/.cache/huggingface/hub}"
export TRANSFORMERS_CACHE="${TRANSFORMERS_CACHE:-/home/node/.openclaw/.cache/huggingface/transformers}"
export HF_DATASETS_CACHE="${HF_DATASETS_CACHE:-/home/node/.openclaw/.cache/huggingface/datasets}"
export SENTENCE_TRANSFORMERS_HOME="${SENTENCE_TRANSFORMERS_HOME:-/home/node/.openclaw/.cache/huggingface/sentence-transformers}"
export TORCH_HOME="${TORCH_HOME:-/home/node/.openclaw/.cache/torch}"

prepend_path "/usr/local/go/bin"
prepend_path "${GOBIN}"
prepend_path "${CARGO_HOME}/bin"
prepend_path "${NPM_CONFIG_PREFIX}/bin"
prepend_path "${PNPM_HOME}"
prepend_path "${PIPX_BIN_DIR}"
prepend_path "/home/node/.local/bin"

export PATH
