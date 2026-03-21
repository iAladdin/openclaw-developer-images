import crypto from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_BRIDGE_PORT_OFFSET,
  DEFAULT_GATEWAY_PORT,
  DEFAULT_IMAGE_BASE_TAG,
  DEFAULT_IMAGE_REGISTRY,
  DEFAULT_MANAGER_HOME_DIRNAME,
  DEFAULT_PROFILE,
  PROFILE_ALIASES,
  SUPPORTED_PROFILES
} from "./constants.mjs";

const COMPOSE_TEMPLATE_PATH = new URL("../../assets/docker-compose.instance.yml", import.meta.url);
const FLAGS_WITH_VALUES = new Set([
  "--name",
  "--profile",
  "--image",
  "--gateway-port",
  "--bridge-port",
  "--timezone",
  "--service",
  "--request-id"
]);
const MANAGED_ENV_KEYS = [
  "COMPOSE_PROJECT_NAME",
  "OPENCLAW_INSTANCE",
  "OPENCLAW_PROFILE",
  "OPENCLAW_IMAGE",
  "OPENCLAW_GATEWAY_PORT",
  "OPENCLAW_BRIDGE_PORT",
  "OPENCLAW_GATEWAY_BIND",
  "OPENCLAW_GATEWAY_TOKEN",
  "OPENCLAW_TZ",
  "OPENCLAW_HOME_VOLUME",
  "OPENCLAW_STATE_VOLUME",
  "OPENCLAW_WORKSPACE_VOLUME"
];
const MANAGED_ENV_HEADER = [
  "# Managed by ocdev.",
  "# Managed keys may be refreshed when you run `ocdev up` again.",
  "# Extra keys are preserved, but comments and ordering are not guaranteed."
].join("\n");

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

export function defaultInstanceName(cwd = process.cwd()) {
  return sanitizeInstanceName(path.basename(cwd) || "default");
}

export function resolveManagerHome({
  env = process.env,
  homeDir = os.homedir()
} = {}) {
  if (env.OPENCLAW_DEV_HOME?.trim()) {
    return path.resolve(env.OPENCLAW_DEV_HOME.trim());
  }

  return path.join(homeDir, DEFAULT_MANAGER_HOME_DIRNAME);
}

export function resolveInstancesRoot(options) {
  return path.join(resolveManagerHome(options), "instances");
}

export function normalizeProfileId(rawProfile = DEFAULT_PROFILE) {
  const normalized = `${rawProfile || ""}`.trim().toLowerCase();
  const aliasResolved = PROFILE_ALIASES.get(normalized) || normalized || DEFAULT_PROFILE;

  if (!SUPPORTED_PROFILES.has(aliasResolved)) {
    throw new Error(
      `Unsupported profile: ${rawProfile}. Supported profiles: ${[...SUPPORTED_PROFILES].join(", ")}`
    );
  }

  return aliasResolved;
}

export function defaultImageForProfile(profile) {
  return `${DEFAULT_IMAGE_REGISTRY}:${DEFAULT_IMAGE_BASE_TAG}-${normalizeProfileId(profile)}`;
}

export function detectTimezone() {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function buildInstanceConfig({
  instance,
  profile,
  image,
  gatewayPort = DEFAULT_GATEWAY_PORT,
  bridgePort,
  timezone = "UTC"
}) {
  const sanitizedInstance = sanitizeInstanceName(instance);
  const composeProjectName = `openclaw-${sanitizedInstance}`;
  const resolvedBridgePort = bridgePort ?? gatewayPort + DEFAULT_BRIDGE_PORT_OFFSET;
  const prefix = `openclaw_${sanitizedInstance}`;

  return {
    instance: sanitizedInstance,
    profile: normalizeProfileId(profile),
    image: image || defaultImageForProfile(profile),
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

export function renderInstanceEnv(config, existingEntries = {}) {
  return renderMergedEnvFile({
    existingEntries,
    managedEntries: buildManagedEnvEntries(config)
  });
}

export function stackPaths({ rootDir = resolveInstancesRoot(), instance }) {
  const sanitizedInstance = sanitizeInstanceName(instance);
  const stackDir = path.join(rootDir, sanitizedInstance);

  return {
    instance: sanitizedInstance,
    stackDir,
    envPath: path.join(stackDir, ".env"),
    composePath: path.join(stackDir, "docker-compose.instance.yml"),
    readmePath: path.join(stackDir, "README.md")
  };
}

export function readFlag(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? null : argv[index + 1] ?? null;
}

export function hasFlag(argv, ...flags) {
  return flags.some((flag) => argv.includes(flag));
}

export function readPositional(argv, offset = 0) {
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) {
      continue;
    }

    if (token.startsWith("-")) {
      if (FLAGS_WITH_VALUES.has(token)) {
        index += 1;
      }
      continue;
    }

    positionals.push(token);
  }

  return positionals[offset] ?? null;
}

export function numberFlag(argv, flag, fallbackValue) {
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

export async function readEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return parseEnvContent(raw);
  } catch {
    return {};
  }
}

export function buildConfigFromArgs({ cwd = process.cwd(), argv, defaults = {} }) {
  const instance = sanitizeInstanceName(
    readFlag(argv, "--name") || readPositional(argv, 1) || defaults.instance || defaultInstanceName(cwd)
  );
  const existingEnv = defaults.existingEnv || {};
  const profile = normalizeProfileId(readFlag(argv, "--profile") || existingEnv.OPENCLAW_PROFILE || DEFAULT_PROFILE);
  const gatewayPort = numberFlag(
    argv,
    "--gateway-port",
    Number.parseInt(existingEnv.OPENCLAW_GATEWAY_PORT || "", 10) || DEFAULT_GATEWAY_PORT
  );
  const bridgePort = numberFlag(
    argv,
    "--bridge-port",
    Number.parseInt(existingEnv.OPENCLAW_BRIDGE_PORT || "", 10) || gatewayPort + DEFAULT_BRIDGE_PORT_OFFSET
  );
  const timezone = readFlag(argv, "--timezone") || existingEnv.OPENCLAW_TZ || detectTimezone();
  const image = readFlag(argv, "--image") || existingEnv.OPENCLAW_IMAGE || defaultImageForProfile(profile);

  const config = buildInstanceConfig({
    instance,
    profile,
    image,
    gatewayPort,
    bridgePort,
    timezone
  });

  config.gatewayToken = existingEnv.OPENCLAW_GATEWAY_TOKEN || config.gatewayToken;
  config.composeProjectName = existingEnv.COMPOSE_PROJECT_NAME || config.composeProjectName;
  config.volumes = {
    home: existingEnv.OPENCLAW_HOME_VOLUME || config.volumes.home,
    state: existingEnv.OPENCLAW_STATE_VOLUME || config.volumes.state,
    workspace: existingEnv.OPENCLAW_WORKSPACE_VOLUME || config.volumes.workspace
  };

  return config;
}

export async function loadComposeTemplate() {
  return readFile(COMPOSE_TEMPLATE_PATH, "utf8");
}

export async function writeStackFiles({
  rootDir = resolveInstancesRoot(),
  cwd,
  config,
  refreshTemplate = false
}) {
  const effectiveRootDir = cwd || rootDir;
  const paths = stackPaths({ rootDir: effectiveRootDir, instance: config.instance });
  const composeTemplate = await loadComposeTemplate();
  const existingEnv = await readEnvFile(paths.envPath);

  await mkdir(paths.stackDir, { recursive: true });
  await writeFile(paths.envPath, renderInstanceEnv(config, existingEnv), "utf8");

  if (refreshTemplate || !(await fileExists(paths.composePath))) {
    await writeFile(paths.composePath, composeTemplate, "utf8");
  }

  if (refreshTemplate || !(await fileExists(paths.readmePath))) {
    await writeFile(paths.readmePath, renderStackReadme(config, paths), "utf8");
  }

  return paths;
}

export function buildManagedEnvEntries(config) {
  return {
    COMPOSE_PROJECT_NAME: config.composeProjectName,
    OPENCLAW_INSTANCE: config.instance,
    OPENCLAW_PROFILE: config.profile,
    OPENCLAW_IMAGE: config.image,
    OPENCLAW_GATEWAY_PORT: `${config.gatewayPort}`,
    OPENCLAW_BRIDGE_PORT: `${config.bridgePort}`,
    OPENCLAW_GATEWAY_BIND: "lan",
    OPENCLAW_GATEWAY_TOKEN: config.gatewayToken,
    OPENCLAW_TZ: config.timezone,
    OPENCLAW_HOME_VOLUME: config.volumes.home,
    OPENCLAW_STATE_VOLUME: config.volumes.state,
    OPENCLAW_WORKSPACE_VOLUME: config.volumes.workspace
  };
}

function renderMergedEnvFile({ existingEntries = {}, managedEntries }) {
  const extraEntries = {};
  for (const [key, value] of Object.entries(existingEntries)) {
    if (!MANAGED_ENV_KEYS.includes(key)) {
      extraEntries[key] = value;
    }
  }

  const lines = [MANAGED_ENV_HEADER, ""];

  for (const key of MANAGED_ENV_KEYS) {
    lines.push(`${key}=${managedEntries[key]}`);
  }

  const extraKeys = Object.keys(extraEntries).sort();
  if (extraKeys.length) {
    lines.push("", "# Preserved extra keys");
    for (const key of extraKeys) {
      lines.push(`${key}=${extraEntries[key]}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function renderStackReadme(config, paths) {
  return [
    `# ${config.instance}`,
    "",
    "Managed by `ocdev`.",
    "",
    `State directory: \`${shellPath(paths.stackDir)}\``,
    "Live profile, image, token, and port values are stored in `.env`.",
    "",
    "Managed file policy:",
    "- `.env` managed keys may be refreshed on `ocdev up`; extra keys are preserved.",
    "- `docker-compose.instance.yml` and `README.md` are only created once unless you explicitly refresh them later.",
    "",
    "Recommended `ocdev` commands:",
    `- \`ocdev token ${config.instance}\``,
    `- \`ocdev approve ${config.instance}\``,
    `- \`ocdev logs ${config.instance}\``,
    `- \`ocdev claw --name ${config.instance} devices list\``,
    `- \`ocdev down ${config.instance}\``,
    "",
    "Low-level Docker Compose commands:",
    `- \`docker compose --env-file ${shellQuote(paths.envPath)} -f ${shellQuote(paths.composePath)} up -d\``,
    `- \`docker compose --env-file ${shellQuote(paths.envPath)} -f ${shellQuote(paths.composePath)} logs -f openclaw-gateway\``,
    `- \`docker compose --env-file ${shellQuote(paths.envPath)} -f ${shellQuote(paths.composePath)} down\``,
    ""
  ].join("\n");
}

function parseEnvContent(raw) {
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
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function shellPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function shellQuote(filePath) {
  const normalized = shellPath(filePath);
  return `'${normalized.replace(/'/g, `'\\''`)}'`;
}
