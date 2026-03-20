#!/usr/bin/env bash
set -euo pipefail

features_raw="${1:-}"
extra_packages_raw="${2:-}"
go_version="${3:-1.24.1}"
rust_toolchain="${4:-stable}"

install -d -m 0755 -o node -g node \
  /opt/openclaw/toolchains/cargo \
  /opt/openclaw/toolchains/rustup \
  /home/node/.local/bin \
  /home/node/.local/pipx

declare -A seen=()
features=()

for raw_feature in $features_raw; do
  feature="$(printf '%s' "$raw_feature" | tr '[:upper:]' '[:lower:]' | xargs)"
  if [[ -n "$feature" && -z "${seen[$feature]:-}" ]]; then
    seen["$feature"]=1
    features+=("$feature")
  fi
done

has_feature() {
  local expected="$1"
  local feature
  for feature in "${features[@]}"; do
    if [[ "$feature" == "$expected" ]]; then
      return 0
    fi
  done
  return 1
}

declare -A apt_seen=()
apt_packages=()

add_apt_package() {
  local pkg="$1"
  if [[ -n "$pkg" && -z "${apt_seen[$pkg]:-}" ]]; then
    apt_seen["$pkg"]=1
    apt_packages+=("$pkg")
  fi
}

for pkg in ca-certificates curl git xz-utils; do
  add_apt_package "$pkg"
done

if has_feature "python"; then
  for pkg in python3 python3-pip python3-venv python-is-python3 pipx; do
    add_apt_package "$pkg"
  done
fi

if has_feature "cxx"; then
  for pkg in build-essential clang cmake ninja-build gdb pkg-config; do
    add_apt_package "$pkg"
  done
fi

if has_feature "rust"; then
  for pkg in build-essential pkg-config libssl-dev; do
    add_apt_package "$pkg"
  done
fi

for pkg in $extra_packages_raw; do
  add_apt_package "$pkg"
done

if ((${#apt_packages[@]} > 0)); then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${apt_packages[@]}"
  rm -rf /var/lib/apt/lists/*
fi

if has_feature "go"; then
  case "$(dpkg --print-architecture)" in
    amd64) go_arch="amd64" ;;
    arm64) go_arch="arm64" ;;
    *)
      echo "Unsupported architecture for Go install: $(dpkg --print-architecture)" >&2
      exit 1
      ;;
  esac

  curl --proto "=https" --tlsv1.2 -fsSL \
    "https://go.dev/dl/go${go_version}.linux-${go_arch}.tar.gz" \
    -o /tmp/go.tar.gz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/go.tar.gz
  rm -f /tmp/go.tar.gz
fi

if has_feature "rust"; then
  install -d -m 0755 -o node -g node /opt/openclaw/toolchains/cargo /opt/openclaw/toolchains/rustup
  runuser -u node -- env \
    HOME=/home/node \
    CARGO_HOME=/opt/openclaw/toolchains/cargo \
    RUSTUP_HOME=/opt/openclaw/toolchains/rustup \
    RUSTUP_INIT_SKIP_PATH_CHECK=yes \
    bash -lc "curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain '${rust_toolchain}'"
fi

chown -R node:node /opt/openclaw /home/node/.local
