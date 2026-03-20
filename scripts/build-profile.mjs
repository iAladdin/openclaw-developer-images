import { spawn } from "node:child_process";

import { getProfileById, loadCatalog } from "./lib/catalog.mjs";
import { readOpenClawMetadata, resolveOfficialBaseTag } from "./lib/openclaw-source.mjs";

const args = process.argv.slice(2);
const profileId = readFlag(args, "--profile");

if (!profileId) {
  console.error("Usage: node scripts/build-profile.mjs --profile <id> [--tag image:tag] [--platform linux/amd64,linux/arm64] [--push|--load]");
  process.exit(1);
}

const catalog = await loadCatalog();
const profile = getProfileById(catalog, profileId);

if (!profile) {
  console.error(`Unknown profile: ${profileId}`);
  process.exit(1);
}

const metadata = await readOpenClawMetadata();
const baseTag = readFlag(args, "--base-tag") || (await resolveOfficialBaseTag());
const baseVariantSuffix = profile.baseVariant === "slim" ? "-slim" : "";
const imageTag = readFlag(args, "--tag") || `openclaw-developer:${baseTag}-${profile.slug}`;
const platform = readFlag(args, "--platform");
const shouldPush = args.includes("--push");
const shouldLoad = args.includes("--load");

const commandArgs = [
  "buildx",
  "build",
  "-f",
  "Dockerfile.developer",
  "--build-arg",
  `OPENCLAW_BASE_TAG=${baseTag}`,
  "--build-arg",
  `OPENCLAW_BASE_VARIANT_SUFFIX=${baseVariantSuffix}`,
  "--build-arg",
  `DEV_PROFILE=${profile.id}`,
  "--build-arg",
  `DEV_FEATURES=${profile.features.join(" ")}`,
  "--label",
  `io.openclaw.source.version=${metadata.version}`,
  "-t",
  imageTag
];

if (platform) {
  commandArgs.push("--platform", platform);
}
if (shouldPush) {
  commandArgs.push("--push");
} else if (shouldLoad) {
  commandArgs.push("--load");
}

commandArgs.push(".");

console.log(`Building ${profile.id} from OpenClaw ${metadata.version} using base tag ${baseTag}`);
console.log(`docker ${commandArgs.join(" ")}`);

const child = spawn("docker", commandArgs, {
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

function readFlag(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return argv[index + 1] ?? null;
}
