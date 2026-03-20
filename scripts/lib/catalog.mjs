import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadCatalog(repoRoot = process.cwd()) {
  const catalogPath = path.join(repoRoot, "catalog", "profiles.json");
  const raw = await readFile(catalogPath, "utf8");
  return JSON.parse(raw);
}

export function getProfileById(catalog, profileId) {
  const normalizedId = `${profileId || ""}`.trim().toLowerCase();

  return catalog.profiles.find((profile) => {
    if (`${profile.id}`.trim().toLowerCase() === normalizedId) {
      return true;
    }

    return (profile.aliases || []).some((alias) => `${alias}`.trim().toLowerCase() === normalizedId);
  });
}

export function listProfileIds(catalog) {
  return catalog.profiles.map((profile) => profile.id);
}

export function uniqueFeatures(values = []) {
  return [...new Set(values.map((value) => `${value}`.trim().toLowerCase()).filter(Boolean))].sort();
}

export function profileFeatureSet(profile) {
  return uniqueFeatures(profile.features || []);
}
