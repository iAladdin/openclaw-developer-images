#!/usr/bin/env sh
set -eu

mkdir -p \
  "${NPM_CONFIG_PREFIX}/bin" \
  "${NPM_CONFIG_CACHE}" \
  "${COREPACK_HOME}" \
  "${PNPM_HOME}" \
  "${XDG_CACHE_HOME}" \
  "${PYTHONUSERBASE}/bin" \
  "${PIP_CACHE_DIR}" \
  "${PIPX_HOME}" \
  "${PIPX_BIN_DIR}" \
  "${GOPATH}" \
  "${GOBIN}" \
  "${GOMODCACHE}" \
  "${GOCACHE}" \
  "${CARGO_HOME}/bin" \
  "${RUSTUP_HOME}" \
  "${CARGO_TARGET_DIR}" \
  "${HF_HOME}" \
  "${HUGGINGFACE_HUB_CACHE}" \
  "${TRANSFORMERS_CACHE}" \
  "${HF_DATASETS_CACHE}" \
  "${SENTENCE_TRANSFORMERS_HOME}" \
  "${TORCH_HOME}"

if [ -x "${OPENCLAW_BUILTIN_CARGO_HOME}/bin/cargo" ] && [ ! -x "${CARGO_HOME}/bin/cargo" ]; then
  cp -a "${OPENCLAW_BUILTIN_CARGO_HOME}/." "${CARGO_HOME}/"
fi

if [ -e "${OPENCLAW_BUILTIN_RUSTUP_HOME}/settings.toml" ] && [ ! -e "${RUSTUP_HOME}/settings.toml" ]; then
  cp -a "${OPENCLAW_BUILTIN_RUSTUP_HOME}/." "${RUSTUP_HOME}/"
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
