#!/usr/bin/env sh
set -eu

is_gateway_launch() {
  case "${1:-}" in
    openclaw)
      [ "${2:-}" = "gateway" ]
      ;;
    node|/usr/local/bin/node)
      case "${2:-}" in
        openclaw.mjs|/app/openclaw.mjs)
          [ "${3:-}" = "gateway" ]
          ;;
        dist/index.js|/app/dist/index.js)
          [ "${3:-}" = "gateway" ]
          ;;
        *)
          return 1
          ;;
      esac
      ;;
    /app/openclaw.mjs)
      [ "${2:-}" = "gateway" ]
      ;;
    dist/index.js|/app/dist/index.js)
      [ "${2:-}" = "gateway" ]
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_docker_bridge_defaults() {
  if ! openclaw config get gateway.bind >/dev/null 2>&1; then
    openclaw config set gateway.bind lan >/dev/null
    if ! openclaw config get gateway.controlUi.allowedOrigins >/dev/null 2>&1 &&
      ! openclaw config get gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback >/dev/null 2>&1; then
      openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true >/dev/null
    fi
  fi
}

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

if is_gateway_launch "$@"; then
  ensure_docker_bridge_defaults
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
