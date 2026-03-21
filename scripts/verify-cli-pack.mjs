import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const cacheDir = path.join(process.cwd(), ".cache", "cli-pack");
const extractDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-dev-pack-"));
const installDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-dev-install-"));

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

  await writeFile(
    path.join(installDir, "package.json"),
    JSON.stringify(
      {
        name: "openclaw-dev-pack-verify",
        private: true
      },
      null,
      2
    ),
    "utf8"
  );

  await execFileAsync("npm", ["install", "--no-package-lock", tarballPath], {
    cwd: installDir
  });

  const { stdout: helpOutput } = await execFileAsync("./node_modules/.bin/ocdev", ["help"], {
    cwd: installDir
  });

  assert.match(helpOutput, /ocdev - OpenClaw developer instance launcher/);
  assert.match(helpOutput, /Manager home/);
  assert.match(helpOutput, /npx openclaw-dev up --name my-project/);

  console.log(`Verified packed CLI tarball: ${tarballPath}`);
} finally {
  await rm(extractDir, { recursive: true, force: true });
  await rm(installDir, { recursive: true, force: true });
}
