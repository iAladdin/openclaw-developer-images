import { loadCatalog } from "./lib/catalog.mjs";
import { isStableOpenClawVersion, resolveProfileImageTags } from "./lib/image-tags.mjs";
import { readOpenClawMetadata, resolveOfficialBaseTag } from "./lib/openclaw-source.mjs";

const catalog = await loadCatalog();
const metadata = await readOpenClawMetadata();
const baseTag = await resolveOfficialBaseTag();
const stableRelease = isStableOpenClawVersion(metadata.version);
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
  imageTags: resolveProfileImageTags({
    baseTag,
    openclawVersion: metadata.version,
    slug: profile.slug
  })
}));

console.log(JSON.stringify(matrix));
