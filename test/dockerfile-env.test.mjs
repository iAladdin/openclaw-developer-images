import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dockerfilePath = new URL("../Dockerfile.developer", import.meta.url);
const dockerfile = await readFile(dockerfilePath, "utf8");
const shellProfilePath = new URL("../scripts/runtime-shell-profile.sh", import.meta.url);
const shellProfile = await readFile(shellProfilePath, "utf8");
const entrypointPath = new URL("../scripts/developer-entrypoint.sh", import.meta.url);
const entrypoint = await readFile(entrypointPath, "utf8");

test("routes go workspace and cache paths into the persisted openclaw state directory", () => {
  assert.match(dockerfile, /GOPATH=\/home\/node\/\.openclaw\/\.go/);
  assert.match(dockerfile, /GOBIN=\/home\/node\/\.openclaw\/\.go\/bin/);
  assert.match(dockerfile, /GOMODCACHE=\/home\/node\/\.openclaw\/\.cache\/go\/pkg\/mod/);
  assert.match(dockerfile, /GOCACHE=\/home\/node\/\.openclaw\/\.cache\/go\/build/);
});

test("routes rust user homes into the persisted openclaw state directory while keeping baked toolchains internal", () => {
  assert.match(dockerfile, /OPENCLAW_BUILTIN_CARGO_HOME=\/opt\/openclaw\/toolchains\/cargo/);
  assert.match(dockerfile, /OPENCLAW_BUILTIN_RUSTUP_HOME=\/opt\/openclaw\/toolchains\/rustup/);
  assert.match(dockerfile, /CARGO_HOME=\/home\/node\/\.openclaw\/\.cargo/);
  assert.match(dockerfile, /RUSTUP_HOME=\/home\/node\/\.openclaw\/\.rustup/);
  assert.match(dockerfile, /CARGO_TARGET_DIR=\/home\/node\/\.openclaw\/\.cargo-target/);
});

test("routes npm global installs into the persisted openclaw state directory", () => {
  assert.match(dockerfile, /NPM_CONFIG_PREFIX=\/home\/node\/\.openclaw\/\.npm-global/);
  assert.match(dockerfile, /NPM_CONFIG_CACHE=\/home\/node\/\.openclaw\/\.npm-cache/);
  assert.match(dockerfile, /NPM_CONFIG_USERCONFIG=\/home\/node\/\.openclaw\/\.npmrc/);
});

test("routes python user installs into the persisted openclaw state directory", () => {
  assert.match(dockerfile, /XDG_CACHE_HOME=\/home\/node\/\.openclaw\/\.cache/);
  assert.match(dockerfile, /PYTHONUSERBASE=\/home\/node\/\.openclaw\/\.local/);
  assert.match(dockerfile, /PIP_USER=1/);
  assert.match(dockerfile, /PIP_BREAK_SYSTEM_PACKAGES=1/);
  assert.match(dockerfile, /PIP_CACHE_DIR=\/home\/node\/\.openclaw\/\.cache\/pip/);
  assert.match(dockerfile, /PIPX_HOME=\/home\/node\/\.openclaw\/\.pipx/);
  assert.match(dockerfile, /PIPX_BIN_DIR=\/home\/node\/\.openclaw\/\.local\/bin/);
});

test("routes model and ML caches into the persisted openclaw cache directory", () => {
  assert.match(dockerfile, /HF_HOME=\/home\/node\/\.openclaw\/\.cache\/huggingface/);
  assert.match(dockerfile, /HUGGINGFACE_HUB_CACHE=\/home\/node\/\.openclaw\/\.cache\/huggingface\/hub/);
  assert.match(dockerfile, /TRANSFORMERS_CACHE=\/home\/node\/\.openclaw\/\.cache\/huggingface\/transformers/);
  assert.match(dockerfile, /HF_DATASETS_CACHE=\/home\/node\/\.openclaw\/\.cache\/huggingface\/datasets/);
  assert.match(dockerfile, /SENTENCE_TRANSFORMERS_HOME=\/home\/node\/\.openclaw\/\.cache\/huggingface\/sentence-transformers/);
  assert.match(dockerfile, /TORCH_HOME=\/home\/node\/\.openclaw\/\.cache\/torch/);
});

test("login shells keep persisted user tool paths on PATH", () => {
  assert.match(dockerfile, /ENTRYPOINT \["openclaw-developer-entrypoint.sh"\]/);
  assert.match(dockerfile, /COPY scripts\/developer-entrypoint\.sh \/usr\/local\/bin\/openclaw-developer-entrypoint\.sh/);
  assert.match(dockerfile, /COPY scripts\/runtime-shell-profile\.sh \/etc\/profile\.d\/openclaw-developer-user-paths\.sh/);
  assert.match(shellProfile, /GOBIN="\$\{GOBIN:-\/home\/node\/\.openclaw\/\.go\/bin\}"/);
  assert.match(shellProfile, /CARGO_HOME="\$\{CARGO_HOME:-\/home\/node\/\.openclaw\/\.cargo\}"/);
  assert.match(shellProfile, /NPM_CONFIG_PREFIX="\$\{NPM_CONFIG_PREFIX:-\/home\/node\/\.openclaw\/\.npm-global\}"/);
  assert.match(shellProfile, /XDG_CACHE_HOME="\$\{XDG_CACHE_HOME:-\/home\/node\/\.openclaw\/\.cache\}"/);
  assert.match(shellProfile, /PYTHONUSERBASE="\$\{PYTHONUSERBASE:-\/home\/node\/\.openclaw\/\.local\}"/);
  assert.match(shellProfile, /HF_HOME="\$\{HF_HOME:-\/home\/node\/\.openclaw\/\.cache\/huggingface\}"/);
  assert.match(shellProfile, /TORCH_HOME="\$\{TORCH_HOME:-\/home\/node\/\.openclaw\/\.cache\/torch\}"/);
  assert.match(shellProfile, /prepend_path "\$\{GOBIN\}"/);
  assert.match(shellProfile, /prepend_path "\$\{NPM_CONFIG_PREFIX\}\/bin"/);
  assert.match(shellProfile, /prepend_path "\$\{PIPX_BIN_DIR\}"/);
  assert.match(entrypoint, /cp -a "\$\{OPENCLAW_BUILTIN_CARGO_HOME\}\/\." "\$\{CARGO_HOME\}\/"/);
  assert.match(entrypoint, /cp -a "\$\{OPENCLAW_BUILTIN_RUSTUP_HOME\}\/\." "\$\{RUSTUP_HOME\}\/"/);
});
