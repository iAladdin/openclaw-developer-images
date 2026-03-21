# OpenClaw Developer Images

**English** | [简体中文](README.zh-CN.md)

Launch a ready-to-use OpenClaw developer environment with one command.

This project packages curated OpenClaw developer images and a lightweight CLI so you can start fast without cloning the repo, wiring Docker by hand, or guessing which profile to use.

What it gives you:

1. One-command startup with `ocdev`.
2. Curated images for common development and usage scenarios.
3. Safer local ergonomics like isolated state, automatic port shifting, and simple first-login flows.

## Quickstart

Recommended flow:

1. Launch an instance with `npx` or an installed `ocdev`.
2. Open the Control UI in your browser.
3. Run `ocdev approve` once for the first browser pairing.

### Option 1: Use `npx` (Recommended)

Start here if you want the fastest path:

```bash
npx openclaw-dev up --name my-project
```

Best when you want zero setup and do not need to manage a global CLI install.

### Option 2: Install `ocdev`

If you expect to use it often, install it once and keep the shorter command:

```bash
npm install -g openclaw-dev
ocdev up --name my-project
```

### Option 3: Use a Repository Checkout

If you are working from a local clone of this repository before the npm package is published or updated, use the workspace entrypoint instead:

```bash
npm run ocdev -- up --name my-project
```

This path is mainly for contributors, local validation, and unreleased changes.

### First Login

After `up` completes, finish the first browser login with:

```bash
ocdev token my-project
ocdev approve my-project
ocdev claw --name my-project devices list
```

By default, `ocdev` starts the `node-python` profile, stores instance state in a machine-global manager directory, and brings the stack up immediately with Docker Compose.

By default, `ocdev` manages instances under:

- macOS: `~/Library/Application Support/openclaw-dev/instances`
- Linux: `${XDG_STATE_HOME:-~/.local/state}/openclaw-dev/instances`
- Override: `OPENCLAW_DEV_HOME=/custom/path`

If the preferred host ports are already occupied, `ocdev up` automatically shifts forward until it finds a free pair.

Managed file policy:

- `.env` managed keys are refreshed on each `ocdev up`, while extra keys are preserved.
- `docker-compose.instance.yml` and `README.md` are created once and only refreshed when you pass `--refresh-template`.

### Daily Commands

Useful follow-up commands:

```bash
ocdev token my-project
ocdev logs my-project
ocdev down my-project
ocdev up --name my-project --refresh-template
```

If you are running from a repo checkout, prepend `npm run ocdev --`.

The compatibility goal is simple: a developer image should be a drop-in replacement for the official image.

In practice, that means you should not need to relearn the official `docker run` or `docker compose` arguments. Most of the time, you only swap the image name for the matching developer profile image.

## Design Principles

- Official OpenClaw remains the single upstream source of truth.
- Developer images do not replace or fork the upstream build logic. They extend official published images.
- `Node.js` is treated as a default capability because the upstream image already includes Node.js 24 and pnpm.
- Language environments are expressed as reusable features, while profiles are curated combinations for common workloads.

## Current Profiles

| Profile       | Features         | Base    | Recommended for                                      |
| ------------- | ---------------- | ------- | ---------------------------------------------------- |
| `node`        | `node`           | default | JS/TS skills, bots, webhook integrations             |
| `python`      | `node python`    | default | automation scripts, ETL, lightweight data processing |
| `go`          | `node go`        | default | Go services, agent workers, CLIs                     |
| `go-python`   | `node go python` | default | Go developers who also rely on Python tooling        |
| `node-python` | `node python`    | default | research, collection, crawling, content processing   |
| `rust-cpp`    | `node rust cxx`  | slim    | Rust-native development, FFI, C++ build environments |

`python-node` is also supported as an alias for `node-python`.

## Tag Rules

- Mainline tag: `main-<profile>`
- Stable release tag: `<openclaw-version>-<profile>`
- Stable release alias: `latest-<profile>`

Pushes to `main` publish both the moving `main-<profile>` tags and the exact current upstream OpenClaw version tags, so you can choose either "latest mainline" or "same-version corresponding" pulls.

Examples:

- `ghcr.io/ialaddin/openclaw-developer-images:main-go-python`
- `ghcr.io/ialaddin/openclaw-developer-images:2026.3.14-go-python`
- `ghcr.io/ialaddin/openclaw-developer-images:latest-rust-cpp`

Here `2026.3.14` maps directly to the matching upstream OpenClaw version.

## Image Recommendation Service

The repository includes a recommendation script that ranks profiles by persona, workload, required language features, and optional slim-base preference.

```bash
npm run recommend -- --persona golang --workload worker --need go,python
```

Information collection and crawling:

```bash
npm run recommend -- --persona collector --workload scraper,processing --need python
```

Rust-native development:

```bash
npm run recommend -- --persona rust --workload ffi,native --need rust,cxx --prefer-slim
```

If no curated profile matches exactly, the recommender prints a custom build suggestion.

## Repo Workflows

Clone the repository when you want to contribute, build custom images locally, or work on the CLI itself.
If your only goal is to launch and use a developer instance, you can stop at Quickstart.

### Local Builds

List all profiles:

```bash
npm run catalog
```

Build a curated profile locally:

```bash
npm run build:profile -- --profile go-python --load
```

Build the common `python-node` research profile locally:

```bash
npm run build:profile -- --profile python-node --tag openclaw-developer:main-node-python --load
```

After the build finishes, you can replace the official image name directly:

```bash
docker run -d \
  -v ~/.openclaw-children/my-project:/home/node/.openclaw \
  -p 18789:18789 \
  --name openclaw-my-project \
  openclaw-developer:main-node-python
```

On first startup with an empty mounted state directory, the developer image automatically seeds Docker bridge friendly gateway defaults into `/home/node/.openclaw/openclaw.json`:

- `gateway.bind=lan`
- `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=true`

This keeps the official `docker run -p 18789:18789 ...` style usable from the host browser without extra setup. The gateway still uses token auth by default.

These defaults are meant for local developer Docker usage. If you plan to expose the gateway beyond localhost, replace the fallback with explicit `gateway.controlUi.allowedOrigins` and review the network exposure carefully.

The developer image also sets `NODE_COMPILE_CACHE=/home/node/.openclaw/.cache/node-compile` and `OPENCLAW_NO_RESPAWN=1` by default, so repeated CLI runs are faster and restart-required gateway config changes behave better in Docker.

On the first browser connection, you may still see `unauthorized` or `disconnected (1008): pairing required`. That is expected: once the gateway is reachable from the host browser through Docker bridge networking, OpenClaw treats the browser as a remote operator device and requires a one-time approval.

If you launched the stack with `ocdev`, finish the first login with:

```bash
ocdev token my-project
ocdev approve my-project
```

For lower-level access, `ocdev` also wraps the container shell-outs:

```bash
ocdev claw --name my-project devices list
ocdev exec my-project -- sh
```

Paste the token into Control UI settings, then approve the pending browser device. After that, the browser profile stays paired unless you clear browser storage or remove the device pairing entry.

You can also build custom feature combinations manually:

```bash
docker buildx build \
  -f Dockerfile.developer \
  --build-arg OPENCLAW_BASE_TAG=main \
  --build-arg DEV_PROFILE=custom \
  --build-arg DEV_FEATURES="node go python" \
  --load \
  -t openclaw-developer:custom-go-python \
  .
```

## Optional Instance Template

The default recommendation is still the upstream runtime model: mount a different host directory for each instance and only replace the image name.

If you want templated management for instance names, ports, tokens, and named volumes, this repository also includes an optional instance template.

It mainly solves higher-level operational problems such as:

- different scenarios accidentally sharing the same `~/.openclaw` state directory
- user data and runtime state being mixed into container lifecycle during upgrades or recreation
- multiple OpenClaw scenarios colliding on volume names, tokens, or compose project names

For that reason, `docker-compose.instance.yml` splits runtime state into three separate named volumes:

- `home`: `/home/node`
- `state`: `/home/node/.openclaw`
- `workspace`: `/home/node/.openclaw/workspace`

Those volumes are independent from the image lifecycle, so `docker compose up --force-recreate` or container restarts do not erase state.

### Create an Isolated Instance

```bash
npm run create:instance -- \
  --name collector \
  --profile node-python \
  --image ghcr.io/ialaddin/openclaw-developer-images:main-node-python \
  --gateway-port 18789 \
  --bridge-port 18790 \
  --timezone Asia/Shanghai
```

This generates:

- `stacks/collector/.env`
- `stacks/collector/README.md`

It also assigns independent values for:

- `COMPOSE_PROJECT_NAME`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_HOME_VOLUME`
- `OPENCLAW_STATE_VOLUME`
- `OPENCLAW_WORKSPACE_VOLUME`

### Start an Instance

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml up -d
```

### Initialize OpenClaw

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml run --rm openclaw-cli onboard --mode local --no-install-daemon
```

### View Logs

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml logs -f openclaw-gateway
```

### Restart Without Losing Data

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml restart
```

Or:

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml up -d --force-recreate
```

Both approaches keep the named volumes, so recreating the container will not break the OpenClaw environment.

### Stop Without Losing Data

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml down
```

### Remove the Instance and All Data

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml down -v
```

Use `-v` only when you explicitly want to wipe the entire scenario state.

## Feature Notes

- `node`: already included by the official image.
- `python`: installs `python3`, `pip`, `venv`, and `pipx`.
- `go`: installs a pinned Go toolchain.
- `rust`: installs a minimal Rust toolchain through `rustup`.
- `cxx`: installs `build-essential`, `clang`, `cmake`, `ninja`, `gdb`, and `pkg-config`.

## Preinstalled Dependencies vs User Installs

These developer images intentionally separate two dependency classes:

- preinstalled language runtimes, skill dependencies, and tool dependencies are baked into the image layer
- user-installed dependencies inside the running container are redirected into `/home/node/.openclaw` so they persist with your mounted working state

Default user-side paths:

- Go workspace: `/home/node/.openclaw/.go`
- Go build and module cache: `/home/node/.openclaw/.cache/go`
- Cargo and rustup user homes: `/home/node/.openclaw/.cargo` and `/home/node/.openclaw/.rustup`
- Cargo build target directory: `/home/node/.openclaw/.cargo-target`
- `npm install -g ...`: `/home/node/.openclaw/.npm-global`
- npm cache: `/home/node/.openclaw/.npm-cache`
- `pnpm add -g ...`: `/home/node/.openclaw/.pnpm`
- `pip install ...`: `/home/node/.openclaw/.local`
- `pipx install ...`: `/home/node/.openclaw/.pipx`
- Hugging Face, Transformers, Datasets, and Sentence Transformers cache: `/home/node/.openclaw/.cache/huggingface`
- Torch cache: `/home/node/.openclaw/.cache/torch`
- Generic XDG cache root: `/home/node/.openclaw/.cache`

Important details:

- the Go compiler itself remains inside the image at `/usr/local/go`
- the baked Rust toolchain remains inside the image at `/opt/openclaw/toolchains`

This avoids a common failure mode where mounting a host directory onto `/home/node/.openclaw` would otherwise hide the preinstalled toolchain.

At container startup, the built-in Rust toolchain is synchronized into the user-owned `.openclaw` paths on demand. That means:

- preinstalled Rust capabilities remain immediately usable
- later `cargo install`, registry, and toolchain state still persist in the mounted directory

With a runtime command like this:

```bash
docker run -d \
  -v ~/.openclaw-children/my-project:/home/node/.openclaw \
  -p 18789:18789 \
  --name openclaw-my-project \
  openclaw-developer:main-node-python
```

If you recreate the container and keep mounting the same host directory, user-installed npm, pip, pipx, pnpm, Go, Rust, and model-cache data will still be there.

That gives you a clean split:

- preinstalled dependencies follow the image version and are stable infrastructure
- user-installed dependencies follow the `.openclaw` state directory and support per-project customization

## Automation

### 1. Upstream Sync

`.github/workflows/sync-openclaw-upstream.yml`

- checks the official OpenClaw main branch every 30 minutes
- updates the embedded upstream source reference when upstream changes
- submits the update as a pull request for review

### 2. Image Publishing

`.github/workflows/developer-images.yml`

- publishes only to `ghcr.io` for now
- validates profile builds on `pull_request` without pushing images
- publishes `main-<profile>` images from changes on the `main` branch
- publishes `<version>-<profile>` images from `v*` tags
- refreshes `latest-<profile>` for stable releases
- ships multi-arch images for `linux/amd64` and `linux/arm64`

### 3. CLI Publishing

`.github/workflows/publish-ocdev-npm.yml`

- validates the `openclaw-dev` CLI on `pull_request` and `main` branch changes
- runs `npm test` and `npm run verify:cli-pack` before any publish step
- publishes `openclaw-dev` to npm only from tags in the form `ocdev-v<version>`
- rejects the release if the git tag does not exactly match `packages/cli/package.json`
- uses npm trusted publishing from GitHub Actions instead of a long-lived `NPM_TOKEN`
- requires the npm package to trust this GitHub repository and workflow before the first release
- trusted publisher values for this repo: GitHub user/org `iAladdin`, repository `openclaw-developer-images`, workflow `publish-ocdev-npm.yml`

## OpenClaw Source Directory Compatibility

Scripts look for the official source in this order:

1. `deps/openclaw`
2. `deps`

So the tooling keeps working whether the upstream source is eventually pinned at `deps/openclaw` or remains at the current `deps` layout.

## Verification

```bash
npm test
```

This only runs tests for this repository and intentionally avoids scanning upstream tests inside `deps/`.
