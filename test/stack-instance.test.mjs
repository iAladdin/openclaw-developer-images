import test from "node:test";
import assert from "node:assert/strict";

import { buildInstanceConfig, renderInstanceEnv, sanitizeInstanceName } from "../scripts/lib/stack-instance.mjs";

test("sanitizeInstanceName keeps names docker-safe", () => {
  assert.equal(sanitizeInstanceName("Collector Bot #1"), "collector-bot-1");
});

test("buildInstanceConfig creates isolated named volumes", () => {
  const config = buildInstanceConfig({
    instance: "Go Worker",
    profile: "go-python",
    image: "ghcr.io/example/openclaw:main-go-python",
    gatewayPort: 18889,
    bridgePort: 18890,
    timezone: "Asia/Shanghai"
  });

  assert.equal(config.composeProjectName, "openclaw-go-worker");
  assert.equal(config.volumes.home, "openclaw_go-worker_home");
  assert.equal(config.volumes.state, "openclaw_go-worker_state");
  assert.equal(config.volumes.workspace, "openclaw_go-worker_workspace");
});

test("renderInstanceEnv includes independent volume and port settings", () => {
  const env = renderInstanceEnv(
    buildInstanceConfig({
      instance: "collector",
      profile: "node-python",
      image: "ghcr.io/example/openclaw:main-node-python",
      gatewayPort: 18789,
      bridgePort: 18790,
      timezone: "UTC"
    })
  );

  assert.match(env, /COMPOSE_PROJECT_NAME=openclaw-collector/);
  assert.match(env, /OPENCLAW_STATE_VOLUME=openclaw_collector_state/);
  assert.match(env, /OPENCLAW_WORKSPACE_VOLUME=openclaw_collector_workspace/);
  assert.match(env, /OPENCLAW_GATEWAY_PORT=18789/);
});
