import net from "node:net";

export async function resolvePortPlan({
  gatewayPort,
  bridgePort,
  preserveExistingPorts = false
}) {
  if (preserveExistingPorts) {
    return {
      gatewayPort,
      bridgePort,
      shifted: false,
      originalGatewayPort: gatewayPort,
      originalBridgePort: bridgePort
    };
  }

  const requestedBridgePort = bridgePort ?? gatewayPort + 1;
  const delta = requestedBridgePort - gatewayPort;
  let currentGateway = gatewayPort;
  let currentBridge = requestedBridgePort;

  while (!(await arePortsAvailable(currentGateway, currentBridge))) {
    currentGateway += 1;
    currentBridge += delta === 0 ? 1 : delta;
  }

  return {
    gatewayPort: currentGateway,
    bridgePort: currentBridge,
    shifted: currentGateway !== gatewayPort || currentBridge !== requestedBridgePort,
    originalGatewayPort: gatewayPort,
    originalBridgePort: requestedBridgePort
  };
}

async function arePortsAvailable(gatewayPort, bridgePort) {
  if (gatewayPort === bridgePort) {
    return false;
  }

  const gatewayAvailable = await isPortAvailable(gatewayPort);
  if (!gatewayAvailable) {
    return false;
  }

  return isPortAvailable(bridgePort);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "0.0.0.0");
  });
}
