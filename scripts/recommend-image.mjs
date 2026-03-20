import { loadCatalog } from "./lib/catalog.mjs";
import { readOpenClawMetadata, resolveOfficialBaseTag } from "./lib/openclaw-source.mjs";
import { buildRecommendationInput, enrichInput, recommendProfiles } from "./lib/recommendation.mjs";

const catalog = await loadCatalog();
const metadata = await readOpenClawMetadata();
const baseTag = await resolveOfficialBaseTag();
const rawInput = buildRecommendationInput(process.argv.slice(2));
const input = enrichInput(catalog, rawInput);
const recommendation = recommendProfiles(catalog, input);

const topPick = recommendation.profiles[0];
const customSuggestion =
  input.requestedFeaturesWithNode.length > 1 && !recommendation.exactFeatureMatch
    ? input.requestedFeaturesWithNode
    : null;

if (rawInput.json) {
  console.log(
    JSON.stringify(
      {
        openclaw: metadata,
        baseTag,
        recommendation,
        customSuggestion
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (!topPick) {
  console.error("No profile recommendations were produced.");
  process.exit(1);
}

console.log(`OpenClaw source: ${metadata.sourceDir}`);
console.log(`OpenClaw version: ${metadata.version}`);
console.log(`Official base tag: ${baseTag}`);
console.log("");
console.log(`Recommended profile: ${topPick.profile.id}`);
console.log(`${topPick.profile.name} (${topPick.profile.baseVariant})`);
console.log(topPick.profile.summary);
console.log(`Features: ${topPick.profile.features.join(", ")}`);
console.log(`Image tag: ghcr.io/<your-org>/<repo>:${baseTag}-${topPick.profile.slug}`);
console.log("");

if (topPick.matchedPersonas.length > 0 || topPick.matchedWorkloads.length > 0 || topPick.matchedFeatures.length > 0) {
  console.log("Why it matches:");
  for (const item of [
    topPick.matchedPersonas.length > 0 ? `persona: ${topPick.matchedPersonas.join(", ")}` : null,
    topPick.matchedWorkloads.length > 0 ? `workload: ${topPick.matchedWorkloads.join(", ")}` : null,
    topPick.matchedFeatures.length > 0 ? `features: ${topPick.matchedFeatures.join(", ")}` : null
  ].filter(Boolean)) {
    console.log(`- ${item}`);
  }
  console.log("");
}

console.log("Top profiles:");
for (const candidate of recommendation.profiles) {
  console.log(
    `- ${candidate.profile.id}: features=${candidate.profile.features.join(", ")} | base=${candidate.profile.baseVariant} | score=${candidate.score}`
  );
}

if (customSuggestion) {
  console.log("");
  console.log(`Custom build suggestion: ${customSuggestion.join(", ")}`);
  console.log(
    `docker buildx build --build-arg OPENCLAW_BASE_TAG=${baseTag} --build-arg DEV_FEATURES='${customSuggestion.join(" ")}' -f Dockerfile.developer .`
  );
}
