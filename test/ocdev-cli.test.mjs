import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import {
  buildConfigFromArgs,
  defaultImageForProfile,
  normalizeProfileId,
  readPositional,
  readEnvFile,
  resolveInstancesRoot,
  resolveManagerHome,
  stackPaths,
  writeStackFiles
} from "../packages/cli/src/lib/instance.mjs";
import { resolvePortPlan } from "../packages/cli/src/lib/ports.mjs";
import { helpText, resolveApproveRequest, resolveClawRequest, resolveExecRequest } from "../packages/cli/src/cli.mjs";

test("normalizeProfileId resolves python-node alias", () => {
  assert.equal(normalizeProfileId("python-node"), "node-python");
});

test("defaultImageForProfile points at the published developer image registry", () => {
  assert.equal(
    defaultImageForProfile("go-python"),
    "ghcr.io/ialaddin/openclaw-developer-images:2026.3.14-go-python"
  );
});

test("writeStackFiles materializes stack env, compose, and readme files", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "ocdev-stack-"));
  const config = buildConfigFromArgs({
    cwd,
    argv: ["up", "--name", "Collector", "--profile", "python-node", "--timezone", "Asia/Shanghai"]
  });

  const paths = await writeStackFiles({
    rootDir: path.join(cwd, "instances"),
    config
  });
  const env = await readEnvFile(paths.envPath);
  const compose = await readFile(paths.composePath, "utf8");
  const readme = await readFile(paths.readmePath, "utf8");

  assert.equal(env.OPENCLAW_PROFILE, "node-python");
  assert.equal(env.OPENCLAW_TZ, "Asia/Shanghai");
  assert.match(compose, /openclaw-gateway:/);
  assert.match(readme, /Managed by `ocdev`\./);
  assert.match(readme, /Live profile, image, token, and port values are stored in `\.env`\./);
  assert.match(readme, /ocdev token collector/);
  assert.match(readme, /ocdev approve collector/);
  assert.match(readme, /docker-compose\.instance\.yml/);
  assert.doesNotMatch(readme, /Gateway port:/);
});

test("buildConfigFromArgs preserves generated identity values from an existing stack", () => {
  const config = buildConfigFromArgs({
    cwd: "/tmp/example",
    argv: ["up", "--name", "collector", "--gateway-port", "19001"],
    defaults: {
      existingEnv: {
        COMPOSE_PROJECT_NAME: "openclaw-collector",
        OPENCLAW_GATEWAY_TOKEN: "existing-token",
        OPENCLAW_HOME_VOLUME: "collector_home",
        OPENCLAW_STATE_VOLUME: "collector_state",
        OPENCLAW_WORKSPACE_VOLUME: "collector_workspace"
      }
    }
  });

  assert.equal(config.gatewayToken, "existing-token");
  assert.equal(config.volumes.state, "collector_state");
  assert.equal(config.gatewayPort, 19001);
  assert.equal(config.bridgePort, 19002);
});

test("readPositional keeps boolean flags from swallowing later positional args", () => {
  assert.equal(readPositional(["down", "--volumes", "collector"], 1), "collector");
});

test("resolveManagerHome uses the openclaw-style manager root by default", () => {
  assert.equal(
    resolveManagerHome({
      platform: "darwin",
      homeDir: "/Users/tester",
      env: {}
    }),
    "/Users/tester/.openclaw-dev"
  );
  assert.equal(
    resolveInstancesRoot({
      platform: "linux",
      homeDir: "/home/tester",
      env: {}
    }),
    "/home/tester/.openclaw-dev/instances"
  );
});

test("stackPaths uses the global instances root by default", () => {
  const result = stackPaths({
    rootDir: "/tmp/openclaw-dev/instances",
    instance: "collector"
  });

  assert.equal(result.stackDir, "/tmp/openclaw-dev/instances/collector");
});

test("resolvePortPlan shifts forward when the default port pair is occupied", async () => {
  const serverA = net.createServer();
  const serverB = net.createServer();

  await new Promise((resolve) => serverA.listen(19189, "0.0.0.0", resolve));
  await new Promise((resolve) => serverB.listen(19190, "0.0.0.0", resolve));

  try {
    const plan = await resolvePortPlan({
      gatewayPort: 19189,
      bridgePort: 19190
    });

    assert.equal(plan.shifted, true);
    assert.equal(plan.gatewayPort, 19191);
    assert.equal(plan.bridgePort, 19192);
  } finally {
    await new Promise((resolve) => serverA.close(resolve));
    await new Promise((resolve) => serverB.close(resolve));
  }
});

test("resolvePortPlan preserves the current port pair when explicitly told to keep existing ports", async () => {
  const plan = await resolvePortPlan({
    gatewayPort: 19189,
    bridgePort: 19190,
    preserveExistingPorts: true
  });

  assert.equal(plan.shifted, false);
  assert.equal(plan.gatewayPort, 19189);
  assert.equal(plan.bridgePort, 19190);
});

test("cli compose asset stays aligned with the root compose template", async () => {
  const rootCompose = await readFile(new URL("../docker-compose.instance.yml", import.meta.url), "utf8");
  const cliCompose = await readFile(
    new URL("../packages/cli/assets/docker-compose.instance.yml", import.meta.url),
    "utf8"
  );

  assert.equal(cliCompose, rootCompose);
  assert.match(cliCompose, /"--allow-unconfigured"/);
});

test("help text includes descriptions, examples, and manager paths", () => {
  const help = helpText("/tmp/openclaw-images");

  assert.match(help, /ocdev approve\s+Approve the first browser pairing request/);
  assert.match(help, /ocdev exec\s+Run an arbitrary command inside a managed container/);
  assert.match(help, /ocdev claw\s+Shortcut for `docker exec \.\.\. openclaw \.\.\.`/);
  assert.match(help, /npx openclaw-dev up --name my-project/);
  assert.match(help, /Manager home\s+\/root\/\.openclaw-dev|Manager home\s+\/Users\/.+\/\.openclaw-dev|Manager home/);
  assert.match(help, /Default image\s+ghcr\.io\/ialaddin\/openclaw-developer-images:2026\.3\.14-node-python/);
});

test("resolveApproveRequest keeps an explicit request ID when --name is used", () => {
  const resolved = resolveApproveRequest(["approve", "--name", "collector", "req-123"], {
    cwd: "/tmp/openclaw-images"
  });

  assert.equal(resolved.instance, "collector");
  assert.equal(resolved.requestId, "req-123");
});

test("resolveApproveRequest supports a default-instance request via --request-id", () => {
  const resolved = resolveApproveRequest(["approve", "--request-id", "req-456"], {
    cwd: "/tmp/openclaw-images"
  });

  assert.equal(resolved.instance, "openclaw-images");
  assert.equal(resolved.requestId, "req-456");
});

test("resolveExecRequest requires a command separator and keeps the instance positional before it", () => {
  const resolved = resolveExecRequest(["exec", "collector", "--", "sh", "-lc", "echo ok"], {
    cwd: "/tmp/openclaw-images"
  });

  assert.equal(resolved.instance, "collector");
  assert.deepEqual(resolved.commandArgs, ["sh", "-lc", "echo ok"]);
});

test("resolveClawRequest uses the default instance when no separator is present", () => {
  const resolved = resolveClawRequest(["claw", "devices", "list"], {
    cwd: "/tmp/openclaw-images"
  });

  assert.equal(resolved.instance, "openclaw-images");
  assert.deepEqual(resolved.commandArgs, ["devices", "list"]);
});

test("resolveClawRequest supports a named instance before the separator", () => {
  const resolved = resolveClawRequest(["claw", "collector", "--", "devices", "approve", "--latest"], {
    cwd: "/tmp/openclaw-images"
  });

  assert.equal(resolved.instance, "collector");
  assert.deepEqual(resolved.commandArgs, ["devices", "approve", "--latest"]);
});
