import { spawn } from "node:child_process";

export async function assertDockerAvailable() {
  await runCommand("docker", ["version"], { stdio: "ignore" }).catch(() => {
    throw new Error("Docker is required but `docker version` failed. Start Docker Desktop or install Docker first.");
  });

  await runCommand("docker", ["compose", "version"], { stdio: "ignore" }).catch(() => {
    throw new Error("Docker Compose v2 is required but `docker compose version` failed.");
  });
}

export async function runDockerCompose({
  envFile,
  composeFile,
  args,
  stdio = "inherit",
  capture = false
}) {
  return runCommand("docker", ["compose", "--env-file", envFile, "-f", composeFile, ...args], {
    stdio,
    capture
  });
}

export async function runDockerComposeExec({
  envFile,
  composeFile,
  service,
  commandArgs,
  tty = process.stdin.isTTY && process.stdout.isTTY,
  stdio = "inherit",
  capture = false
}) {
  const args = ["compose", "--env-file", envFile, "-f", composeFile, "exec"];
  if (!tty) {
    args.push("-T");
  }
  args.push(service, ...commandArgs);

  return runCommand("docker", args, {
    stdio,
    capture
  });
}

export async function isComposeServiceRunning({
  envFile,
  composeFile,
  service
}) {
  try {
    const result = await runDockerCompose({
      envFile,
      composeFile,
      args: ["ps", "--services", "--status", "running"],
      capture: true
    });

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .includes(service);
  } catch {
    return false;
  }
}

export async function collectComposeDiagnostics({
  envFile,
  composeFile,
  service = "openclaw-gateway"
}) {
  const sections = [];

  const psOutput = await tryComposeCommand({
    envFile,
    composeFile,
    args: ["ps", "--all"],
    label: "docker compose ps --all"
  });
  const logsOutput = await tryComposeCommand({
    envFile,
    composeFile,
    args: ["logs", "--tail", "80", service],
    label: `docker compose logs --tail 80 ${service}`
  });

  if (psOutput) {
    sections.push(psOutput);
  }
  if (logsOutput) {
    sections.push(logsOutput);
  }

  return sections.join("\n\n");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const capture = Boolean(options.capture);
    const child = spawn(command, args, {
      stdio: capture ? "pipe" : options.stdio ?? "pipe"
    });
    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ code: 0, stdout, stderr });
        return;
      }

      const error = new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`);
      error.code = code ?? 1;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function tryComposeCommand({ envFile, composeFile, args, label }) {
  try {
    const result = await runDockerCompose({
      envFile,
      composeFile,
      args,
      capture: true
    });
    const output = `${result.stdout}${result.stderr}`.trim();
    return output ? `${label}\n${output}` : null;
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`.trim();
    return output ? `${label}\n${output}` : null;
  }
}
