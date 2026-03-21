import {
  assertDockerAvailable,
  collectComposeDiagnostics,
  isComposeServiceRunning,
  runDockerCompose,
  runDockerComposeExec
} from "./lib/docker.mjs";
import {
  buildConfigFromArgs,
  defaultInstanceName,
  hasFlag,
  readEnvFile,
  readFlag,
  readPositional,
  resolveInstancesRoot,
  stackPaths,
  writeStackFiles
} from "./lib/instance.mjs";
import { resolvePortPlan } from "./lib/ports.mjs";

export async function main(argv, { cwd = process.cwd() } = {}) {
  const command = argv[0] || "help";

  if (command === "help" || hasFlag(argv, "-h", "--help")) {
    printHelp(cwd);
    return;
  }

  if (command === "up") {
    await up(argv, { cwd });
    return;
  }

  if (command === "down") {
    await down(argv, { cwd });
    return;
  }

  if (command === "logs") {
    await logs(argv, { cwd });
    return;
  }

  if (command === "token") {
    await token(argv, { cwd });
    return;
  }

  if (command === "approve") {
    await approve(argv, { cwd });
    return;
  }

  if (command === "exec") {
    await execInContainer(argv, { cwd });
    return;
  }

  if (command === "claw") {
    await claw(argv, { cwd });
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${helpText(cwd)}`);
}

async function up(argv, { cwd }) {
  await assertDockerAvailable();

  const requestedInstance = readFlag(argv, "--name") || readPositional(argv, 1) || defaultInstanceName(cwd);
  const instancesRoot = resolveInstancesRoot();
  const paths = stackPaths({ rootDir: instancesRoot, instance: requestedInstance });
  const existingEnv = await readEnvFile(paths.envPath);
  const hasExplicitPortSelection = Boolean(readFlag(argv, "--gateway-port") || readFlag(argv, "--bridge-port"));
  const preserveExistingPorts =
    !hasExplicitPortSelection &&
    Object.keys(existingEnv).length > 0 &&
    (await isComposeServiceRunning({
      envFile: paths.envPath,
      composeFile: paths.composePath,
      service: "openclaw-gateway"
    }));
  const config = buildConfigFromArgs({
    cwd,
    argv,
    defaults: {
      instance: requestedInstance,
      existingEnv
    }
  });
  const portPlan = await resolvePortPlan({
    gatewayPort: config.gatewayPort,
    bridgePort: config.bridgePort,
    preserveExistingPorts
  });
  config.gatewayPort = portPlan.gatewayPort;
  config.bridgePort = portPlan.bridgePort;

  const writtenPaths = await writeStackFiles({
    rootDir: instancesRoot,
    config,
    refreshTemplate: hasFlag(argv, "--refresh-template")
  });

  try {
    await startComposeWithRetries({
      argv,
      config,
      writtenPaths
    });
  } catch (error) {
    const diagnostics = await collectComposeDiagnostics({
      envFile: writtenPaths.envPath,
      composeFile: writtenPaths.composePath
    });
    const details = [
      "OpenClaw developer instance failed to start.",
      `Instance: ${config.instance}`,
      `State directory: ${writtenPaths.stackDir}`,
      "",
      "Managed file policy:",
      "- `.env` managed keys are refreshed on `ocdev up`; extra keys are preserved.",
      "- `docker-compose.instance.yml` and `README.md` are only refreshed when you pass `--refresh-template`.",
      ""
    ];

    if (portPlan.shifted) {
      details.push(
        `Ports ${portPlan.originalGatewayPort}/${portPlan.originalBridgePort} were unavailable, so ocdev shifted to ${config.gatewayPort}/${config.bridgePort}.`,
        ""
      );
    }

    const composeOutput = `${error.stdout || ""}${error.stderr || ""}`.trim();
    if (composeOutput) {
      details.push("Compose output:", composeOutput, "");
    }

    if (diagnostics) {
      details.push("Diagnostics:", diagnostics);
    }

    throw new Error(details.join("\n"));
  }

  console.log("OpenClaw developer instance is starting.");
  console.log(`Instance: ${config.instance}`);
  console.log(`Profile: ${config.profile}`);
  console.log(`Image: ${config.image}`);
  console.log(`Control UI: http://127.0.0.1:${config.gatewayPort}`);
  console.log(`State directory: ${writtenPaths.stackDir}`);
  if (portPlan.shifted) {
    console.log(
      `Ports ${portPlan.originalGatewayPort}/${portPlan.originalBridgePort} were busy, so ocdev shifted to ${config.gatewayPort}/${config.bridgePort}.`
    );
  }
  console.log("");
  console.log("Managed file policy:");
  console.log("- `.env` managed keys are refreshed on `ocdev up`; extra keys are preserved.");
  console.log("- `docker-compose.instance.yml` and `README.md` are only refreshed when you pass `--refresh-template`.");
  console.log("");
  console.log("Next steps:");
  console.log(`- View logs: ocdev logs ${config.instance}`);
  console.log(`- Show token: ocdev token ${config.instance}`);
  console.log(`- Approve the first browser device: ocdev approve ${config.instance}`);
  console.log(`- Run OpenClaw CLI inside the instance: ocdev claw --name ${config.instance} devices list`);
}

async function startComposeWithRetries({ argv, config, writtenPaths }) {
  const explicitPorts = Boolean(readFlag(argv, "--gateway-port") || readFlag(argv, "--bridge-port"));
  let currentPaths = writtenPaths;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await runDockerCompose({
        envFile: currentPaths.envPath,
        composeFile: currentPaths.composePath,
        args: ["up", "-d", "--wait"],
        capture: true
      });
      return;
    } catch (error) {
      if (!shouldRetryPortAllocation(error, explicitPorts) || attempt === 2) {
        throw error;
      }

      await safeComposeDown(currentPaths);

      const retryPlan = await resolvePortPlan({
        gatewayPort: config.gatewayPort + 1,
        bridgePort: config.bridgePort + 1
      });
      config.gatewayPort = retryPlan.gatewayPort;
      config.bridgePort = retryPlan.bridgePort;
      currentPaths = await writeStackFiles({
        rootDir: resolveInstancesRoot(),
        config,
        refreshTemplate: hasFlag(argv, "--refresh-template")
      });
    }
  }
}

async function down(argv, { cwd }) {
  await assertDockerAvailable();

  const instance = readFlag(argv, "--name") || readPositional(argv, 1) || defaultInstanceName(cwd);
  const paths = stackPaths({ rootDir: resolveInstancesRoot(), instance });
  const args = ["down"];

  if (hasFlag(argv, "-v", "--volumes")) {
    args.push("-v");
  }

  await ensureStackExists(paths);
  await runDockerCompose({
    envFile: paths.envPath,
    composeFile: paths.composePath,
    args
  });
}

async function logs(argv, { cwd }) {
  await assertDockerAvailable();

  const instance = readFlag(argv, "--name") || readPositional(argv, 1) || defaultInstanceName(cwd);
  const paths = stackPaths({ rootDir: resolveInstancesRoot(), instance });
  const service = readFlag(argv, "--service") || "openclaw-gateway";

  await ensureStackExists(paths);
  await runDockerCompose({
    envFile: paths.envPath,
    composeFile: paths.composePath,
    args: ["logs", "-f", service]
  });
}

async function token(argv, { cwd }) {
  const instance = readFlag(argv, "--name") || readPositional(argv, 1) || defaultInstanceName(cwd);
  const paths = stackPaths({ rootDir: resolveInstancesRoot(), instance });

  await ensureStackExists(paths);

  const env = await readEnvFile(paths.envPath);
  if (!env.OPENCLAW_GATEWAY_TOKEN) {
    throw new Error(`No OPENCLAW_GATEWAY_TOKEN found in ${paths.envPath}`);
  }

  console.log(env.OPENCLAW_GATEWAY_TOKEN);
}

async function approve(argv, { cwd }) {
  await assertDockerAvailable();

  const { instance, requestId } = resolveApproveRequest(argv, { cwd });
  const paths = stackPaths({ rootDir: resolveInstancesRoot(), instance });

  await ensureStackExists(paths);

  if (requestId && hasFlag(argv, "--latest")) {
    throw new Error("Use either a specific request ID or `--latest`, not both.");
  }

  const commandArgs = ["openclaw", "devices", "approve"];
  if (requestId) {
    commandArgs.push(requestId);
  } else {
    commandArgs.push("--latest");
  }

  try {
    const result = await runInstanceExec({
      paths,
      service: "openclaw-gateway",
      commandArgs,
      tty: false,
      capture: true
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
    if (output) {
      console.log(output);
    }
  } catch (error) {
    const output = `${error?.stdout || ""}\n${error?.stderr || ""}\n${error?.message || ""}`.trim();
    if (/No pending device pairing requests to approve/i.test(output)) {
      throw new Error(
        `No pending device pairing requests found for instance ${instance}. Open the Control UI first, trigger a browser connection, then run \`ocdev approve ${instance}\` again.`
      );
    }
    throw error;
  }
}

async function execInContainer(argv, { cwd }) {
  await assertDockerAvailable();

  const { instance, commandArgs } = resolveExecRequest(argv, { cwd });
  const paths = stackPaths({ rootDir: resolveInstancesRoot(), instance });
  const service = readFlag(argv, "--service") || "openclaw-gateway";

  await ensureStackExists(paths);
  await runInstanceExec({
    paths,
    service,
    commandArgs,
    tty: shouldUseTty(argv)
  });
}

async function claw(argv, { cwd }) {
  await assertDockerAvailable();

  const { instance, commandArgs } = resolveClawRequest(argv, { cwd });
  const paths = stackPaths({ rootDir: resolveInstancesRoot(), instance });

  await ensureStackExists(paths);
  await runInstanceExec({
    paths,
    service: "openclaw-gateway",
    commandArgs: ["openclaw", ...commandArgs],
    tty: shouldUseTty(argv)
  });
}

async function ensureStackExists(paths) {
  const env = await readEnvFile(paths.envPath);
  if (!Object.keys(env).length) {
    throw new Error(
      `No stack metadata found for instance ${paths.instance}. Run \`ocdev up --name ${paths.instance}\` first.`
    );
  }
}

async function safeComposeDown(paths) {
  try {
    await runDockerCompose({
      envFile: paths.envPath,
      composeFile: paths.composePath,
      args: ["down"],
      capture: true
    });
  } catch {
    // Best-effort cleanup before a retry.
  }
}

function shouldRetryPortAllocation(error, explicitPorts) {
  if (explicitPorts) {
    return false;
  }

  const output = `${error?.stdout || ""}\n${error?.stderr || ""}\n${error?.message || ""}`;
  return /port is already allocated|Bind for .* failed: port is already allocated/i.test(output);
}

async function runInstanceExec({
  paths,
  service,
  commandArgs,
  tty,
  capture = false
}) {
  return runDockerComposeExec({
    envFile: paths.envPath,
    composeFile: paths.composePath,
    service,
    commandArgs,
    tty,
    capture
  });
}

function shouldUseTty(argv) {
  return !hasFlag(argv, "-T", "--no-tty") && process.stdin.isTTY && process.stdout.isTTY;
}

function splitCommandArgv(argv) {
  const separatorIndex = argv.indexOf("--");
  if (separatorIndex === -1) {
    return {
      before: argv,
      after: [],
      hasSeparator: false
    };
  }

  return {
    before: argv.slice(0, separatorIndex),
    after: argv.slice(separatorIndex + 1),
    hasSeparator: true
  };
}

export function resolveExecRequest(argv, { cwd }) {
  const { before, after, hasSeparator } = splitCommandArgv(argv);
  if (!hasSeparator || !after.length) {
    throw new Error(
      `Usage: ocdev exec [instance] [--service <service>] [-T|--no-tty] -- <command...>\n\n${helpText(cwd)}`
    );
  }

  return {
    instance: readFlag(before, "--name") || readPositional(before, 1) || defaultInstanceName(cwd),
    commandArgs: after
  };
}

export function resolveApproveRequest(argv, { cwd }) {
  const namedInstance = readFlag(argv, "--name");
  const requestFlag = readFlag(argv, "--request-id");
  const positionalRequestId = namedInstance ? readPositional(argv, 1) : readPositional(argv, 2);

  if (requestFlag && positionalRequestId) {
    throw new Error("Use either a positional request ID or `--request-id`, not both.");
  }

  return {
    instance: namedInstance || readPositional(argv, 1) || defaultInstanceName(cwd),
    requestId: requestFlag || positionalRequestId || null
  };
}

export function resolveClawRequest(argv, { cwd }) {
  const { before, after, hasSeparator } = splitCommandArgv(argv);
  if (hasSeparator) {
    if (!after.length) {
      throw new Error(`Usage: ocdev claw [instance] -- <openclaw args...>\n\n${helpText(cwd)}`);
    }

    return {
      instance: readFlag(before, "--name") || readPositional(before, 1) || defaultInstanceName(cwd),
      commandArgs: after
    };
  }

  const namedInstance = readFlag(argv, "--name");
  const commandArgs = [];
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--name") {
      index += 1;
      continue;
    }
    commandArgs.push(token);
  }

  if (!commandArgs.length) {
    throw new Error(`Usage: ocdev claw [--name <instance>] <openclaw args...>\n\n${helpText(cwd)}`);
  }

  return {
    instance: namedInstance || defaultInstanceName(cwd),
    commandArgs
  };
}

function printHelp(cwd) {
  console.log(helpText(cwd));
}

export function helpText(cwd) {
  const defaultName = defaultInstanceName(cwd);

  return [
    "ocdev - OpenClaw developer instance launcher",
    "",
    "Usage:",
    "  ocdev up [--name <instance>] [--profile <profile>] [--image <image>] [--gateway-port <port>] [--bridge-port <port>] [--timezone <iana-tz>] [--refresh-template]",
    "  ocdev down [instance] [--volumes]",
    "  ocdev logs [instance] [--service <service>]",
    "  ocdev token [instance]",
    "  ocdev approve [instance] [requestId|--latest] [--request-id <id>]",
    "  ocdev exec [instance] [--service <service>] [-T|--no-tty] -- <command...>",
    "  ocdev claw [--name <instance>] <openclaw args...>",
    "  ocdev claw [instance] -- <openclaw args...>",
    "  ocdev help",
    "",
    `Defaults: instance=${defaultName}, profile=node-python`,
    `State root: ${resolveInstancesRoot()}`
  ].join("\n");
}
