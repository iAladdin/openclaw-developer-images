# Golang Dev Persona Best Practices

**English** | [简体中文](BEST_PRACTICES.zh-CN.md)

These recommendations are for the "run an OpenClaw Developer image locally with Docker, and mount a host directory to `/home/node/.openclaw`" workflow.

## Recommended Configuration

Use [`persona/developer/openclaw.config`](persona/developer/openclaw.config) as the template. A sanitized JSON example is also available at [`persona/developer/openclaw.json`](persona/developer/openclaw.json).

The main tradeoffs in this config are:

- `gateway.mode: "local"`: removes the doctor warning about an unset gateway mode and matches the local Docker workflow.
- `gateway.bind: "lan"`: makes the host browser reachable after `docker run -p 18789:18789 ...`.
- `gateway.controlUi.allowedOrigins`: explicitly allows `http://127.0.0.1:18789` and `http://localhost:18789`, which is safer than relying on `dangerouslyAllowHostHeaderOriginFallback`.
- `gateway.auth.mode: "token"`: keeps token-based auth enabled instead of disabling auth for convenience.
- `agents.defaults.memorySearch.enabled: false`: turns off semantic memory search by default so doctor does not keep warning about missing OpenAI / Gemini / Voyage / Mistral embedding credentials.

## Why Not Force Doctor Warnings to Zero

Some warnings should not be "suppressed away" with config:

- `Gateway bound to "lan"`: this is the cost of making a Docker-hosted local gateway reachable from the host browser. It is not a config mistake. The better practice is to accept it for localhost development, and switch to `loopback` plus Tailscale or an SSH tunnel for remote access.
- `pairing required`: this is the intended one-time Control UI device approval flow. It is better to approve the browser than to bypass it with `dangerouslyDisableDeviceAuth`.
- `NODE_COMPILE_CACHE` / `OPENCLAW_NO_RESPAWN`: these are container runtime optimizations and belong in image defaults or Docker env vars, not in OpenClaw config.
- `missing transcripts`: this is a state cleanup issue, not a persona-config issue.

## Recommended Run Command

The current template assumes `18789 -> 18789`, so this is the recommended start command:

```bash
docker run -d \
  -v /root/workspace/developer:/home/node/.openclaw \
  -p 18789:18789 \
  --name openclaw-golang-dev \
  ghcr.io/ialaddin/openclaw-developer-images:main-go-python
```

Why this works well:

- OpenClaw state, caches, and user-installed dependencies all live inside the mounted directory.
- The image already sets `NODE_COMPILE_CACHE=/home/node/.openclaw/.cache/node-compile`, so the compile cache survives container recreation.
- The image already sets `OPENCLAW_NO_RESPAWN=1`, which reduces CLI self-respawn overhead and behaves better in Docker when gateway config changes require a restart.

## First Browser Login

When you first open `http://127.0.0.1:18789/` or `http://localhost:18789/`, follow this order:

```bash
docker exec openclaw-golang-dev openclaw config get gateway.auth.token
docker exec openclaw-golang-dev openclaw devices list
docker exec openclaw-golang-dev openclaw devices approve --latest
```

Notes:

- Paste the token into the Control UI settings page first.
- If you still see `pairing required`, approve the newest pending device.
- You only need to repeat this when a browser connects for the first time, browser storage is cleared, or you manually remove the pairing record.

## If You Change the Host Port

The template assumes host port `18789`. If you change it, for example to `-p 8080:18789`, update:

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

Otherwise the Control UI origin check will fail in the browser.

## Restart the Container After Gateway-Sensitive Config Changes

These fields affect gateway listening behavior and Control UI auth boundaries:

- `gateway.mode`
- `gateway.bind`
- `gateway.port`
- `gateway.controlUi.allowedOrigins`

When they change at runtime, OpenClaw usually performs a restart-required config reload.

In Docker, the more predictable workflow is:

1. Edit `openclaw.json` in the mounted directory.
2. Restart the container manually.

Example:

```bash
docker rm -f openclaw-golang-dev
docker run -d \
  -v /root/workspace/developer:/home/node/.openclaw \
  -p 18789:18789 \
  --name openclaw-golang-dev \
  ghcr.io/ialaddin/openclaw-developer-images:main-go-python
```

That is usually easier to reason about and easier to debug than changing these values live.

## If You Need Remote Access

Do not keep using this local-developer persona with `bind: "lan"` for remote exposure. A safer setup is:

- change `gateway.bind` back to `loopback`
- expose HTTPS through Tailscale Serve
- or use an SSH tunnel

The reason is simple: the goal of the local developer persona is quick local usability, while the goal of remote access is minimizing exposure.

## Useful Troubleshooting Commands

```bash
docker exec openclaw-golang-dev openclaw doctor
docker exec openclaw-golang-dev openclaw devices list
docker exec openclaw-golang-dev openclaw security audit --deep
docker exec openclaw-golang-dev openclaw sessions cleanup --store /home/node/.openclaw/agents/main/sessions/sessions.json --dry-run
```

What they are good for:

- `doctor` gives the overall health view.
- `devices list` helps troubleshoot first browser connection and device pairing.
- `security audit --deep` helps you review whether the `lan` exposure is still within your acceptable risk range.
- `sessions cleanup --dry-run` lets you preview the impact of cleaning up missing transcripts before applying any fixes.
