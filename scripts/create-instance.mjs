import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getProfileById, loadCatalog } from "./lib/catalog.mjs";
import { resolveOfficialBaseTag } from "./lib/openclaw-source.mjs";
import { buildInstanceConfig, renderInstanceEnv } from "./lib/stack-instance.mjs";
import { resolvePortPlan } from "../packages/cli/src/lib/ports.mjs";
import { isComposeServiceRunning } from "../packages/cli/src/lib/docker.mjs";

const args = process.argv.slice(2);
const instance = readFlag(args, "--name") || readFlag(args, "--instance");
const profileId = readFlag(args, "--profile");

if (!instance || !profileId) {
  console.error(
    "Usage: node scripts/create-instance.mjs --name <instance> --profile <profile> [--image ghcr.io/org/repo:tag] [--gateway-port 18789] [--bridge-port 18790] [--timezone Asia/Shanghai]"
  );
  process.exit(1);
}

const catalog = await loadCatalog();
const profile = getProfileById(catalog, profileId);
if (!profile) {
  console.error(`Unknown profile: ${profileId}`);
  process.exit(1);
}

const baseTag = await resolveOfficialBaseTag();
const image =
  readFlag(args, "--image") ||
  `ghcr.io/<your-org>/<repo>:${baseTag}-${profile.slug}`;
const stackDir = path.join(process.cwd(), "stacks", sanitizePathSegment(instance));
const envPath = path.join(stackDir, ".env");
const existingEnv = await readEnvFile(envPath);
const hasExplicitPortSelection = args.includes("--gateway-port") || args.includes("--bridge-port");
const gatewayPort = numberFlag(args, "--gateway-port", Number.parseInt(existingEnv.OPENCLAW_GATEWAY_PORT || "", 10) || 18789);
const bridgePort = numberFlag(
  args,
  "--bridge-port",
  Number.parseInt(existingEnv.OPENCLAW_BRIDGE_PORT || "", 10) || gatewayPort + 1
);
const timezone = readFlag(args, "--timezone") || existingEnv.OPENCLAW_TZ || process.env.TZ || "UTC";

const config = buildInstanceConfig({
  instance,
  profile: profile.id,
  image,
  gatewayPort,
  bridgePort,
  timezone
});
const portPlan = await resolvePortPlan({
  gatewayPort: config.gatewayPort,
  bridgePort: config.bridgePort,
  preserveExistingPorts:
    !hasExplicitPortSelection &&
    Object.keys(existingEnv).length > 0 &&
    (await isComposeServiceRunning({
      envFile: envPath,
      composeFile: path.join(process.cwd(), "docker-compose.instance.yml"),
      service: "openclaw-gateway"
    }))
});
config.gatewayPort = portPlan.gatewayPort;
config.bridgePort = portPlan.bridgePort;
config.gatewayToken = existingEnv.OPENCLAW_GATEWAY_TOKEN || config.gatewayToken;
config.composeProjectName = existingEnv.COMPOSE_PROJECT_NAME || config.composeProjectName;
config.volumes = {
  home: existingEnv.OPENCLAW_HOME_VOLUME || config.volumes.home,
  state: existingEnv.OPENCLAW_STATE_VOLUME || config.volumes.state,
  workspace: existingEnv.OPENCLAW_WORKSPACE_VOLUME || config.volumes.workspace
};

await mkdir(stackDir, { recursive: true });
await writeFile(envPath, renderInstanceEnv(config), "utf8");

const readmePath = path.join(stackDir, "README.md");
const commands = [
  `docker compose --env-file ${shellPath(path.join("stacks", config.instance, ".env"))} -f docker-compose.instance.yml up -d`,
  `docker compose --env-file ${shellPath(path.join("stacks", config.instance, ".env"))} -f docker-compose.instance.yml logs -f openclaw-gateway`,
  `docker compose --env-file ${shellPath(path.join("stacks", config.instance, ".env"))} -f docker-compose.instance.yml run --rm openclaw-cli onboard --mode local --no-install-daemon`
];

await writeFile(
  readmePath,
  [
    `# ${config.instance}`,
    "",
    `Profile: \`${config.profile}\``,
    `Image: \`${config.image}\``,
    `Gateway port: \`${config.gatewayPort}\``,
    `Bridge port: \`${config.bridgePort}\``,
    "",
    "Volumes:",
    `- home: \`${config.volumes.home}\``,
    `- state: \`${config.volumes.state}\``,
    `- workspace: \`${config.volumes.workspace}\``,
    "",
    "Commands:",
    ...commands.map((command) => `- \`${command}\``),
    ""
  ].join("\n"),
  "utf8"
);

console.log(`Created isolated stack: ${config.instance}`);
console.log(`Env file: ${envPath}`);
console.log(`State volume: ${config.volumes.state}`);
console.log(`Workspace volume: ${config.volumes.workspace}`);
if (portPlan.shifted) {
  console.log(
    `Ports ${portPlan.originalGatewayPort}/${portPlan.originalBridgePort} were busy, so the instance will use ${config.gatewayPort}/${config.bridgePort}.`
  );
}
console.log("");
console.log("Bring it up with:");
console.log(`docker compose --env-file stacks/${config.instance}/.env -f docker-compose.instance.yml up -d`);

function readFlag(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? null : argv[index + 1] ?? null;
}

function numberFlag(argv, flag, fallbackValue) {
  const value = readFlag(argv, flag);
  if (!value) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function shellPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

async function readEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const entries = {};
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) {
        continue;
      }
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (key) {
        entries[key] = value;
      }
    }
    return entries;
  } catch {
    return {};
  }
}

function sanitizePathSegment(rawValue) {
  return `${rawValue || ""}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}
