import { loadCatalog } from "./lib/catalog.mjs";
import { readOpenClawMetadata, resolveOfficialBaseTag } from "./lib/openclaw-source.mjs";

const catalog = await loadCatalog();
const metadata = await readOpenClawMetadata();
const baseTag = await resolveOfficialBaseTag();
const stableRelease = /^\d+\.\d+\.\d+(-\d+)?$/.test(baseTag);
const betaRelease = /^\d+\.\d+\.\d+-beta\.\d+$/.test(baseTag);

const matrix = catalog.profiles.map((profile) => ({
  id: profile.id,
  slug: profile.slug,
  baseVariant: profile.baseVariant,
  baseVariantSuffix: profile.baseVariant === "slim" ? "-slim" : "",
  baseTag,
  openclawVersion: metadata.version,
  stableRelease,
  betaRelease,
  features: profile.features.join(" "),
  imageTags: [
    `${baseTag}-${profile.slug}`,
    ...(stableRelease ? [`latest-${profile.slug}`] : [])
  ]
}));

console.log(JSON.stringify(matrix));
