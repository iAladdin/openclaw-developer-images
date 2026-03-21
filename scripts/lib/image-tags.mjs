const STABLE_OPENCLAW_VERSION_RE = /^\d+\.\d+\.\d+(-\d+)?$/;

export function isStableOpenClawVersion(version) {
  return typeof version === "string" && STABLE_OPENCLAW_VERSION_RE.test(version.trim());
}

export function resolveProfileImageTags({ baseTag, openclawVersion, slug }) {
  const suffixes = new Set();

  if (typeof baseTag === "string" && baseTag.trim()) {
    suffixes.add(`${baseTag.trim()}-${slug}`);
  }

  if (typeof openclawVersion === "string" && openclawVersion.trim()) {
    suffixes.add(`${openclawVersion.trim()}-${slug}`);
  }

  if (isStableOpenClawVersion(openclawVersion)) {
    suffixes.add(`latest-${slug}`);
  }

  return [...suffixes];
}
