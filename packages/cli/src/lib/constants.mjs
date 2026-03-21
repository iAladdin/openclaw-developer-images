import { readFileSync } from "node:fs";

export const DEFAULT_PROFILE = "node-python";
export const DEFAULT_GATEWAY_PORT = 18789;
export const DEFAULT_BRIDGE_PORT_OFFSET = 1;
export const DEFAULT_IMAGE_REGISTRY = "ghcr.io/ialaddin/openclaw-developer-images";
export const DEFAULT_MANAGER_HOME_DIRNAME = ".openclaw-dev";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

export const DEFAULT_IMAGE_BASE_TAG = packageJson.openclaw?.recommendedImageBaseTag || "main";
export const DEFAULT_IMAGE_CHANNEL = DEFAULT_IMAGE_BASE_TAG === "main" ? "mainline" : "release";

export const PROFILE_ALIASES = new Map([
  ["python-node", "node-python"]
]);

export const SUPPORTED_PROFILES = new Set([
  "node",
  "python",
  "go",
  "go-python",
  "node-python",
  "rust-cpp"
]);

export const PROFILE_SUMMARIES = new Map([
  ["node", "Lean JavaScript/TypeScript workspace for web and tooling projects."],
  ["python", "Lean Python workspace for data, scripts, and automation."],
  ["go", "Lean Go workspace for services, CLIs, and backend tools."],
  ["go-python", "Go plus Python for infra, data processing, and mixed stacks."],
  ["node-python", "Default full-stack profile for agent, web, and scripting work."],
  ["rust-cpp", "Native toolchain profile for systems, bindings, and performance work."]
]);
