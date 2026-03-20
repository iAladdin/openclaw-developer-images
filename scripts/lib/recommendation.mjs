import { profileFeatureSet, uniqueFeatures } from "./catalog.mjs";

function normalizeText(value) {
  return `${value || ""}`.toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();
}

function tokenize(values = []) {
  return [...new Set(values.flatMap((value) => normalizeText(value).split(/\s+/).filter(Boolean)))];
}

function intersects(left = [], right = []) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

export function buildRecommendationInput(argv) {
  const personas = [];
  const workloads = [];
  const requestedFeatures = [];
  let preferSlim = false;
  let json = false;
  let top = 3;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    switch (value) {
      case "--persona":
        personas.push(...splitCommaArgs(next));
        index += 1;
        break;
      case "--workload":
      case "--use-case":
        workloads.push(...splitCommaArgs(next));
        index += 1;
        break;
      case "--need":
      case "--feature":
        requestedFeatures.push(...splitCommaArgs(next));
        index += 1;
        break;
      case "--prefer-slim":
        preferSlim = true;
        break;
      case "--json":
        json = true;
        break;
      case "--top":
        top = Number.parseInt(next, 10) || top;
        index += 1;
        break;
      default:
        break;
    }
  }

  return {
    personas: tokenize(personas),
    workloads: tokenize(workloads),
    requestedFeatures: uniqueFeatures(requestedFeatures),
    preferSlim,
    json,
    top
  };
}

function splitCommaArgs(value) {
  return `${value || ""}`
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function recommendProfiles(catalog, input) {
  const scored = catalog.profiles
    .map((profile) => scoreProfile(profile, input))
    .sort((left, right) => right.score - left.score || left.profile.id.localeCompare(right.profile.id));

  const matchesRequestedFeatures = catalog.profiles.find((profile) => {
    const profileFeatures = profileFeatureSet(profile);
    return JSON.stringify(profileFeatures) === JSON.stringify(input.requestedFeaturesWithNode);
  });

  return {
    requestedFeatures: input.requestedFeaturesWithNode,
    exactFeatureMatch: matchesRequestedFeatures?.id || null,
    profiles: scored.slice(0, Math.max(1, input.top))
  };
}

export function enrichInput(catalog, rawInput) {
  const requestedFeatures = rawInput.requestedFeatures.includes("node")
    ? rawInput.requestedFeatures
    : rawInput.requestedFeatures.length > 0
      ? uniqueFeatures(["node", ...rawInput.requestedFeatures])
      : [];

  return {
    ...rawInput,
    knownFeatures: Object.keys(catalog.features),
    requestedFeaturesWithNode: requestedFeatures
  };
}

function scoreProfile(profile, input) {
  const profileFeatures = profileFeatureSet(profile);
  const requestedFeatures = input.requestedFeaturesWithNode;
  const matchedPersonas = intersects(tokenize(profile.personas || []), input.personas);
  const matchedWorkloads = intersects(tokenize(profile.workloads || []), input.workloads);
  const matchedFeatures = intersects(profileFeatures, requestedFeatures);
  const missingRequestedFeatures = requestedFeatures.filter((feature) => !profileFeatures.includes(feature));
  const extraFeatures = profileFeatures.filter((feature) => !requestedFeatures.includes(feature));
  const exactFeatureMatch =
    requestedFeatures.length > 0 && missingRequestedFeatures.length === 0 && extraFeatures.length === 0;

  let score = 0;
  score += matchedPersonas.length * 14;
  score += matchedWorkloads.length * 12;
  score += matchedFeatures.length * 20;
  score -= missingRequestedFeatures.length * 24;
  score -= requestedFeatures.length > 0 ? extraFeatures.length * 4 : 0;
  score += exactFeatureMatch ? 30 : 0;
  score += input.preferSlim && profile.baseVariant === "slim" ? 12 : 0;
  score += !input.preferSlim && profile.baseVariant !== "slim" ? 4 : 0;

  return {
    profile,
    score,
    exactFeatureMatch,
    matchedPersonas,
    matchedWorkloads,
    matchedFeatures,
    missingRequestedFeatures,
    extraFeatures
  };
}
