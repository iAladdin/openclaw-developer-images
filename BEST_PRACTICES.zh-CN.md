# Golang Dev Persona Best Practices

[English](BEST_PRACTICES.md) | **简体中文**

这份建议针对的是“本机通过 Docker 运行 OpenClaw Developer 镜像，并把宿主机目录挂载到 `/home/node/.openclaw`”的场景。

## 推荐配置

建议把 [`persona/developer/openclaw.config`](persona/developer/openclaw.config) 作为模板使用。仓库里也提供了一个脱敏后的 JSON 示例：[`persona/developer/openclaw.json`](persona/developer/openclaw.json)。

这份配置的核心取舍是：

- `gateway.mode: "local"`：消除 doctor 对 gateway mode 未设置的告警，也更符合本机 Docker 运行方式。
- `gateway.bind: "lan"`：让 `docker run -p 18789:18789 ...` 后，宿主机浏览器可以直接访问。
- `gateway.controlUi.allowedOrigins`：显式允许 `http://127.0.0.1:18789` 与 `http://localhost:18789`，替代更危险的 `dangerouslyAllowHostHeaderOriginFallback` 兜底策略。
- `gateway.auth.mode: "token"`：保留 token 鉴权，不为了“省事”把网关改成无鉴权。
- `agents.defaults.memorySearch.enabled: false`：默认关闭语义记忆检索，避免在未配置 OpenAI / Gemini / Voyage / Mistral embedding 凭证时持续出现 doctor 噪音。

## 为什么不是把所有 doctor 告警都“修到零”

有几类提示不适合靠配置硬压：

- `Gateway bound to "lan"`：这是本地 Docker 直连浏览器时的必要代价，不是配置错误。真正的最佳实践是在“仅本机开发”时接受它，在“远程访问”时改成 `loopback` + Tailscale 或 SSH tunnel。
- `pairing required`：这是 Control UI 的一次性设备配对要求，不建议通过 `dangerouslyDisableDeviceAuth` 去规避。
- `NODE_COMPILE_CACHE` / `OPENCLAW_NO_RESPAWN`：这属于容器运行环境优化，应该放在镜像环境变量或 Docker 启动参数里，不应该塞进 OpenClaw 配置文件。
- `missing transcripts`：这是状态目录清理问题，不是 persona 配置问题。

## 推荐运行方式

当前模板默认假设你使用 `18789 -> 18789`，建议这样启动：

```bash
docker run -d \
  -v /root/workspace/developer:/home/node/.openclaw \
  -p 18789:18789 \
  --name openclaw-golang-dev \
  ghcr.io/ialaddin/openclaw-developer-images:main-go-python
```

这样做的好处：

- OpenClaw 自己的状态、缓存、用户安装的依赖都跟着挂载目录走。
- 镜像默认已经设置 `NODE_COMPILE_CACHE=/home/node/.openclaw/.cache/node-compile`，容器重建后编译缓存仍然有效。
- 镜像默认已经设置 `OPENCLAW_NO_RESPAWN=1`，可以减少 CLI 自我重启带来的额外启动损耗，并让 Docker 场景下需要重启的配置更倾向于进程内重启。

## 首次登录流程

第一次用浏览器打开 `http://127.0.0.1:18789/` 或 `http://localhost:18789/` 时，推荐按这个顺序做：

```bash
docker exec openclaw-golang-dev openclaw config get gateway.auth.token
docker exec openclaw-golang-dev openclaw devices list
docker exec openclaw-golang-dev openclaw devices approve --latest
```

说明：

- 先把 token 粘到 Control UI 设置页里。
- 如果仍然提示 `pairing required`，批准最新的待处理设备即可。
- 这一步只在浏览器首次接入、浏览器存储被清空、或你手动删除配对记录时需要重新做。

## 如果你要换端口

当前模板假设主机端口是 `18789`。如果你改成别的端口，比如 `-p 8080:18789`，要同步修改：

```json5
gateway: {
  controlUi: {
    allowedOrigins: [
      "http://127.0.0.1:8080",
      "http://localhost:8080",
    ],
  },
}
```

否则 Control UI 的浏览器 origin 校验会失败。

## 修改网关关键配置时，优先重启容器

像下面这些字段：

- `gateway.mode`
- `gateway.bind`
- `gateway.port`
- `gateway.controlUi.allowedOrigins`

都属于会影响网关监听与 Control UI 鉴权边界的关键配置。它们在运行中变更时，OpenClaw 往往会触发一次需要重启的配置重载。

在 Docker 场景下，更稳的做法不是在线热改，而是：

1. 先改挂载目录里的 `openclaw.json`
2. 再手动重启容器

例如：

```bash
docker rm -f openclaw-golang-dev
docker run -d \
  -v /root/workspace/developer:/home/node/.openclaw \
  -p 18789:18789 \
  --name openclaw-golang-dev \
  ghcr.io/ialaddin/openclaw-developer-images:main-go-python
```

这样比在运行中改配置更可预期，也更容易排障。

## 如果你要做远程访问

不建议继续沿用这份本地开发 persona 的 `bind: "lan"` 配置。更稳的做法是：

- 把 `gateway.bind` 改回 `loopback`
- 通过 Tailscale Serve 暴露 HTTPS
- 或者使用 SSH tunnel

这是因为本地开发 persona 的目标是“开箱即用”，远程访问场景的目标则是“收缩暴露面”。

## 建议保留的排障命令

```bash
docker exec openclaw-golang-dev openclaw doctor
docker exec openclaw-golang-dev openclaw devices list
docker exec openclaw-golang-dev openclaw security audit --deep
docker exec openclaw-golang-dev openclaw sessions cleanup --store /home/node/.openclaw/agents/main/sessions/sessions.json --dry-run
```

其中：

- `doctor` 用来观察整体状态。
- `devices list` 用来排查 Control UI 首次接入与设备配对问题。
- `security audit --deep` 用来评估 `lan` 暴露面是否还在你的可接受范围内。
- `sessions cleanup --dry-run` 用来先预览“缺失 transcript”清理的影响，再决定是否执行修复。
