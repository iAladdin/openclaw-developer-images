import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const cacheDir = path.join(process.cwd(), ".cache", "cli-pack");
const extractDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-dev-pack-"));

try {
  await mkdir(cacheDir, { recursive: true });

  const { stdout: packJson } = await execFileAsync(
    "npm",
    ["pack", "./packages/cli", "--json", "--pack-destination", cacheDir],
    { cwd: process.cwd() }
  );
  const packInfo = JSON.parse(packJson);
  const tarballName = packInfo[0]?.filename;

  assert.ok(tarballName, "npm pack did not return a tarball name.");

  const tarballPath = path.join(cacheDir, tarballName);
  const { stdout: tarList } = await execFileAsync("tar", ["-tf", tarballPath], {
    cwd: process.cwd()
  });

  for (const requiredEntry of [
    "package/package.json",
    "package/bin/ocdev",
    "package/src/cli.mjs",
    "package/assets/docker-compose.instance.yml"
  ]) {
    assert.ok(tarList.includes(requiredEntry), `Missing packed file: ${requiredEntry}`);
  }

  await execFileAsync("tar", ["-xf", tarballPath, "-C", extractDir], {
    cwd: process.cwd()
  });

  const { stdout: helpOutput } = await execFileAsync("node", ["package/bin/ocdev", "help"], {
    cwd: extractDir
  });

  assert.match(helpOutput, /ocdev - OpenClaw developer instance launcher/);
  assert.match(helpOutput, /State root:/);

  console.log(`Verified packed CLI tarball: ${tarballPath}`);
} finally {
  await rm(extractDir, { recursive: true, force: true });
}
