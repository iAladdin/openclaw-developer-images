export const DEFAULT_PROFILE = "node-python";
export const DEFAULT_GATEWAY_PORT = 18789;
export const DEFAULT_BRIDGE_PORT_OFFSET = 1;
export const DEFAULT_IMAGE_REGISTRY = "ghcr.io/ialaddin/openclaw-developer-images";

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
