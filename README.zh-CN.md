# OpenClaw Developer Images

[English](README.md) | **简体中文**

基于官方 OpenClaw 仓库构建的一层 Developer 镜像发行层。

目标有三件事：

1. 跟随官方 OpenClaw 版本和主线持续更新。
2. 为不同开发/使用场景预制一组可直接使用的 Developer 镜像。
3. 提供一套“镜像选择服务”，帮助用户快速找到最合适的 profile。

最重要的一条兼容原则是：Developer 镜像要能直接平替官方镜像。

也就是说，官方原来的 `docker run` / `docker compose` 参数不需要重学，通常只要把镜像名从官方镜像替换成对应 profile 镜像即可。

## 设计原则

- 官方 OpenClaw 仍然是唯一上游真源。
- Developer 镜像不改官方构建逻辑，直接叠加在官方发布镜像之上。
- `Node.js` 视为默认能力，因为官方镜像已经内置 Node.js 24 和 pnpm。
- 语言环境通过 feature 组合来表达，profile 只是对常见组合的预打包。

## 当前 Profiles

| Profile | Features | Base | 适合场景 |
| --- | --- | --- | --- |
| `node` | `node` | default | JS/TS skill、bot、Webhook 集成 |
| `python` | `node python` | default | 自动化脚本、ETL、轻量数据处理 |
| `go` | `node go` | default | Go 服务、agent worker、CLI |
| `go-python` | `node go python` | default | Go 开发者但又依赖 Python 工具链 |
| `node-python` | `node python` | default | 信息收集、小龙虾、爬虫、内容处理 |
| `rust-cpp` | `node rust cxx` | slim | Rust 原生开发、FFI、需要 C++ 构建环境 |

其中 `python-node` 也作为 `node-python` 的别名支持，方便按习惯输入。

## 镜像标签规则

- 主线跟随标签：`main-<profile>`
- 稳定版本标签：`<openclaw-version>-<profile>`
- 稳定版本别名：`latest-<profile>`

例如：

- `ghcr.io/<org>/<repo>:main-go-python`
- `ghcr.io/<org>/<repo>:2026.3.14-go-python`
- `ghcr.io/<org>/<repo>:latest-rust-cpp`

其中 `2026.3.14` 直接对应官方 OpenClaw 版本。

## 镜像选择服务

仓库内置一个推荐脚本，会根据 persona、工作负载、所需语言能力、是否偏好 slim 底座来推荐 profile。

```bash
npm run recommend -- --persona golang --workload worker --need go,python
```

信息收集/爬虫场景：

```bash
npm run recommend -- --persona collector --workload scraper,processing --need python
```

Rust 原生开发场景：

```bash
npm run recommend -- --persona rust --workload ffi,native --need rust,cxx --prefer-slim
```

如果你的需求没有正好命中某个预制 profile，推荐器会给出自定义构建建议。

## 本地构建

列出所有 profile：

```bash
npm run catalog
```

本地构建某个预制 profile：

```bash
npm run build:profile -- --profile go-python --load
```

本地构建信息收集场景常用的 `python-node` 组合：

```bash
npm run build:profile -- --profile python-node --tag openclaw-developer:main-node-python --load
```

构建完成后，可以直接平替官方镜像名：

```bash
docker run -d \
  -v ~/.openclaw-children/my-project:/home/node/.openclaw \
  -p 8080:18789 \
  --name openclaw-my-project \
  openclaw-developer:main-node-python
```

也可以手工组合 feature：

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

## 可选的实例模板

默认推荐仍然是沿用官方启动方式，在宿主机上为不同实例挂不同目录，然后仅替换镜像名。

如果你想把实例名、端口、token、named volume 这些东西也模板化管理，仓库里另外提供了一套可选的实例模板。

它主要解决这几个偏高级的运维问题：

- 不同使用场景共用同一套 `~/.openclaw` 状态目录，导致配置和会话互相污染。
- 镜像升级、容器重建、容器重启时，用户数据和运行状态混在容器层里，不容易恢复。
- 多个 OpenClaw 场景并行运行时，volume、token、compose project name 互相冲突。

为此，`docker-compose.instance.yml` 会把运行时状态拆成三类独立 named volumes：

- `home`: `/home/node`
- `state`: `/home/node/.openclaw`
- `workspace`: `/home/node/.openclaw/workspace`

这些 volume 都独立于镜像生命周期，`docker compose up --force-recreate` 或重启容器不会清空数据。

### 创建一个隔离实例

```bash
npm run create:instance -- \
  --name collector \
  --profile node-python \
  --image ghcr.io/<org>/<repo>:main-node-python \
  --gateway-port 18789 \
  --bridge-port 18790 \
  --timezone Asia/Shanghai
```

这会生成：

- `stacks/collector/.env`
- `stacks/collector/README.md`

并为该实例分配独立的：

- `COMPOSE_PROJECT_NAME`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_HOME_VOLUME`
- `OPENCLAW_STATE_VOLUME`
- `OPENCLAW_WORKSPACE_VOLUME`

### 启动实例

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml up -d
```

### 初始化 OpenClaw

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml run --rm openclaw-cli onboard --mode local --no-install-daemon
```

### 查看日志

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml logs -f openclaw-gateway
```

### 重启但保留数据

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml restart
```

或者：

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml up -d --force-recreate
```

以上两种方式都不会删除 volumes，因此不会导致 OpenClaw 环境因为容器重建而崩掉。

### 停止实例但保留数据

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml down
```

### 彻底删除实例和数据

```bash
docker compose --env-file stacks/collector/.env -f docker-compose.instance.yml down -v
```

只有在明确要清空这个场景的全部状态时，才使用 `-v`。

## Feature 说明

- `node`: 官方镜像自带，不额外安装。
- `python`: 安装 `python3`、`pip`、`venv`、`pipx`。
- `go`: 安装指定版本 Go 工具链。
- `rust`: 使用 `rustup` 安装最小 Rust 工具链。
- `cxx`: 安装 `build-essential`、`clang`、`cmake`、`ninja`、`gdb`、`pkg-config`。

## 预装依赖与用户安装

这套 Developer 镜像把两类依赖分开处理：

- 镜像预制的 language runtime、skills 依赖、tool 依赖，直接烘焙在镜像层里。
- 用户进入容器后自己追加安装的依赖，默认写入 `/home/node/.openclaw` 下面，便于跟随你挂载出去的工作目录一起持久化。

当前默认行为是：

- `go` 的用户工作区会写到 `/home/node/.openclaw/.go`
- `go` build/module cache 会写到 `/home/node/.openclaw/.cache/go`
- `cargo` / `rustup` 的用户 home 会写到 `/home/node/.openclaw/.cargo` 与 `/home/node/.openclaw/.rustup`
- `cargo` build target 默认写到 `/home/node/.openclaw/.cargo-target`
- `npm install -g ...` 会写到 `/home/node/.openclaw/.npm-global`
- `npm` cache 会写到 `/home/node/.openclaw/.npm-cache`
- `pnpm add -g ...` 会写到 `/home/node/.openclaw/.pnpm`
- `pip install ...` 默认走 user install，写到 `/home/node/.openclaw/.local`
- `pipx install ...` 会写到 `/home/node/.openclaw/.pipx`
- Hugging Face / Transformers / Datasets / Sentence Transformers 的缓存会写到 `/home/node/.openclaw/.cache/huggingface`
- Torch hub / model cache 会写到 `/home/node/.openclaw/.cache/torch`
- 更通用的 XDG cache 根目录会写到 `/home/node/.openclaw/.cache`

需要特别说明的是：

- Go 编译器本身仍然留在镜像内的 `/usr/local/go`
- Rust 预装工具链本身保留在镜像内的 `/opt/openclaw/toolchains`

这样做是为了避免你把宿主机目录挂到 `/home/node/.openclaw` 之后，把镜像预装工具链整个盖掉。

容器启动时会自动把内置 Rust 工具链按需同步到用户的 `.openclaw` 目录，因此：

- 预装的 Rust 能力还能直接用
- 用户后续 `cargo install`、registry、toolchain 状态也能保存在挂载目录里

因此，在你当前这种挂载方式下：

```bash
docker run -d \
  -v ~/.openclaw-children/my-project:/home/node/.openclaw \
  -p 8080:18789 \
  --name openclaw-my-project \
  openclaw-developer:main-node-python
```

只要你删除容器后重新创建时继续挂同一个宿主机目录，这些用户后续安装的 npm / pip / pipx / pnpm / Go / Rust / 模型缓存数据仍然会保留。

镜像预装依赖和用户后续安装依赖因此不会混在一起：

- 预装依赖跟随镜像版本走，适合 skills/tooling 的稳定基础设施。
- 用户追加依赖跟随 `.openclaw` 数据目录走，适合项目定制和个人工作流。

## 自动化

### 1. 上游同步

`.github/workflows/sync-openclaw-upstream.yml`

- 每 30 分钟检查一次官方 OpenClaw 主线。
- 如果上游有新提交，就自动更新本仓库内的 OpenClaw 源引用。
- 通过 PR 方式提交，方便审查和控制节奏。

### 2. 镜像发布

`.github/workflows/developer-images.yml`

- 当前 CI 只发布到 `ghcr.io`，还没有接入 Docker Hub。
- `pull_request` 阶段会先做 profile 构建验证，但不会推送镜像。
- 在 `main` 分支变更时发布 `main-<profile>` 镜像。
- 在版本 tag（`v*`）上发布 `<version>-<profile>` 镜像。
- 稳定版本额外刷新 `latest-<profile>`。
- 每个 profile 会发布 `linux/amd64` 和 `linux/arm64` 多架构镜像。

## OpenClaw 源目录兼容

脚本会优先寻找：

1. `deps/openclaw`
2. `deps`

所以不管官方仓库最终固定在 `deps/openclaw` 还是当前的 `deps`，这套工具都能继续工作。

## 验证

```bash
npm test
```

这里只会运行当前仓库自己的测试，不会误扫上游 `deps/` 里的官方测试。
