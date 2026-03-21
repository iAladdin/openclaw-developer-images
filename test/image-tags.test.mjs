import test from "node:test";
import assert from "node:assert/strict";

import { isStableOpenClawVersion, resolveProfileImageTags } from "../scripts/lib/image-tags.mjs";

test("resolveProfileImageTags publishes main, exact upstream version, and latest for stable mainline builds", () => {
  assert.deepEqual(resolveProfileImageTags({
    baseTag: "main",
    openclawVersion: "2026.3.14",
    slug: "go-python"
  }), [
    "main-go-python",
    "2026.3.14-go-python",
    "latest-go-python"
  ]);
});

test("resolveProfileImageTags avoids duplicate exact-version tags on release refs", () => {
  assert.deepEqual(resolveProfileImageTags({
    baseTag: "2026.3.14",
    openclawVersion: "2026.3.14",
    slug: "rust-cpp"
  }), [
    "2026.3.14-rust-cpp",
    "latest-rust-cpp"
  ]);
});

test("resolveProfileImageTags keeps prerelease version tags without latest alias", () => {
  assert.deepEqual(resolveProfileImageTags({
    baseTag: "main",
    openclawVersion: "2026.3.14-beta.1",
    slug: "node-python"
  }), [
    "main-node-python",
    "2026.3.14-beta.1-node-python"
  ]);
});

test("isStableOpenClawVersion only marks stable upstream versions as latest-eligible", () => {
  assert.equal(isStableOpenClawVersion("2026.3.14"), true);
  assert.equal(isStableOpenClawVersion("2026.3.14-1"), true);
  assert.equal(isStableOpenClawVersion("2026.3.14-beta.1"), false);
  assert.equal(isStableOpenClawVersion("main"), false);
});
