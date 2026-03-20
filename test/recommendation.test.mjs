import test from "node:test";
import assert from "node:assert/strict";

import { loadCatalog } from "../scripts/lib/catalog.mjs";
import { enrichInput, recommendProfiles } from "../scripts/lib/recommendation.mjs";

const catalog = await loadCatalog(new URL("..", import.meta.url).pathname);

test("recommends go-python for golang users who need python", () => {
  const input = enrichInput(catalog, {
    personas: ["golang"],
    workloads: ["worker"],
    requestedFeatures: ["go", "python"],
    preferSlim: false,
    top: 3
  });

  const result = recommendProfiles(catalog, input);
  assert.equal(result.profiles[0].profile.id, "go-python");
  assert.equal(result.exactFeatureMatch, "go-python");
});

test("recommends node-python for information collection workloads", () => {
  const input = enrichInput(catalog, {
    personas: ["collector"],
    workloads: ["scraper", "processing"],
    requestedFeatures: ["python"],
    preferSlim: false,
    top: 3
  });

  const result = recommendProfiles(catalog, input);
  assert.equal(result.profiles[0].profile.id, "node-python");
});

test("resolves python-node as an alias of node-python", async () => {
  const { getProfileById } = await import("../scripts/lib/catalog.mjs");
  assert.equal(getProfileById(catalog, "python-node")?.id, "node-python");
});

test("prefers rust-cpp for slim native workloads", () => {
  const input = enrichInput(catalog, {
    personas: ["rust"],
    workloads: ["ffi", "native"],
    requestedFeatures: ["rust", "cxx"],
    preferSlim: true,
    top: 3
  });

  const result = recommendProfiles(catalog, input);
  assert.equal(result.profiles[0].profile.id, "rust-cpp");
});
