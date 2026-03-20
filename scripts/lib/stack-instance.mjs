import crypto from "node:crypto";

export function sanitizeInstanceName(rawValue) {
  const sanitized = `${rawValue || ""}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  if (!sanitized) {
    throw new Error("Instance name must contain at least one ASCII letter or number.");
  }

  return sanitized;
}

export function buildInstanceConfig({
  instance,
  profile,
  image,
  gatewayPort = 18789,
  bridgePort,
  timezone = "UTC"
}) {
  const sanitizedInstance = sanitizeInstanceName(instance);
  const composeProjectName = `openclaw-${sanitizedInstance}`;
  const resolvedBridgePort = bridgePort ?? gatewayPort + 1;
  const prefix = `openclaw_${sanitizedInstance}`;

  return {
    instance: sanitizedInstance,
    profile,
    image,
    composeProjectName,
    gatewayPort,
    bridgePort: resolvedBridgePort,
    timezone,
    gatewayToken: crypto.randomBytes(32).toString("hex"),
    volumes: {
      home: `${prefix}_home`,
      state: `${prefix}_state`,
      workspace: `${prefix}_workspace`
    }
  };
}

export function renderInstanceEnv(config) {
  return [
    `COMPOSE_PROJECT_NAME=${config.composeProjectName}`,
    `OPENCLAW_INSTANCE=${config.instance}`,
    `OPENCLAW_PROFILE=${config.profile}`,
    `OPENCLAW_IMAGE=${config.image}`,
    `OPENCLAW_GATEWAY_PORT=${config.gatewayPort}`,
    `OPENCLAW_BRIDGE_PORT=${config.bridgePort}`,
    `OPENCLAW_GATEWAY_BIND=lan`,
    `OPENCLAW_GATEWAY_TOKEN=${config.gatewayToken}`,
    `OPENCLAW_TZ=${config.timezone}`,
    `OPENCLAW_HOME_VOLUME=${config.volumes.home}`,
    `OPENCLAW_STATE_VOLUME=${config.volumes.state}`,
    `OPENCLAW_WORKSPACE_VOLUME=${config.volumes.workspace}`
  ].join("\n") + "\n";
}
