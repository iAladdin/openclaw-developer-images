import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveOpenClawSourceDir(repoRoot = process.cwd()) {
  const explicitDir = process.env.OPENCLAW_SOURCE_DIR?.trim();
  const candidates = [
    explicitDir,
    path.join(repoRoot, "deps", "openclaw"),
    path.join(repoRoot, "deps")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await exists(path.join(candidate, "package.json"))) {
      return path.resolve(candidate);
    }
  }

  throw new Error(
    "Unable to locate the OpenClaw source checkout. Set OPENCLAW_SOURCE_DIR or provide deps/openclaw or deps."
  );
}

export async function readOpenClawMetadata(repoRoot = process.cwd()) {
  const sourceDir = await resolveOpenClawSourceDir(repoRoot);
  const packageJson = JSON.parse(await readFile(path.join(sourceDir, "package.json"), "utf8"));
  const gitSha = await readGitValue(sourceDir, ["rev-parse", "HEAD"]);
  const exactTag = await readGitValue(sourceDir, ["describe", "--tags", "--exact-match"]);
  const gitBranch = await readGitValue(sourceDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const version = packageJson.version;

  return {
    sourceDir,
    version,
    versionTag: `v${version}`,
    gitSha,
    exactTag,
    gitBranch
  };
}

export async function resolveOfficialBaseTag(repoRoot = process.cwd()) {
  if (process.env.OPENCLAW_BASE_TAG?.trim()) {
    return process.env.OPENCLAW_BASE_TAG.trim();
  }

  const githubRef = process.env.GITHUB_REF?.trim();
  if (githubRef === "refs/heads/main") {
    return "main";
  }
  if (githubRef?.startsWith("refs/tags/v")) {
    return githubRef.slice("refs/tags/v".length);
  }

  const metadata = await readOpenClawMetadata(repoRoot);
  if (metadata.exactTag?.startsWith("v")) {
    return metadata.exactTag.slice(1);
  }

  return "main";
}

async function readGitValue(cwd, args) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
