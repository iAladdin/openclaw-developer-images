import { loadCatalog } from "./lib/catalog.mjs";

const catalog = await loadCatalog();

for (const profile of catalog.profiles) {
  console.log(`${profile.id}`);
  console.log(`  ${profile.summary}`);
  console.log(`  Features: ${profile.features.join(", ")}`);
  console.log(`  Base: ${profile.baseVariant}`);
  console.log("");
}
