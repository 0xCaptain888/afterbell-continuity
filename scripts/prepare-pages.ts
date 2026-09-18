import { cp, mkdir, rm, copyFile, writeFile } from "node:fs/promises";

const output = ".runtime/pages";
const evidenceFiles = [
  "rights-discovery.json",
  "quote-discovery.json",
  "economic-equivalence.json",
  "quote-simulation-gate.json",
  "mainnet-stock-swap.json",
  "mainnet-credential.json",
  "mainnet-passport.json"
];

await rm(output, { recursive: true, force: true });
await mkdir(`${output}/evidence`, { recursive: true });
await cp("site", output, { recursive: true });
for (const file of evidenceFiles) {
  await copyFile(`evidence/live/${file}`, `${output}/evidence/${file}`);
}
await writeFile(`${output}/publication.json`, JSON.stringify({
  schema: "afterbell-publication/1",
  generatedAt: new Date().toISOString(),
  evidenceFiles
}, null, 2));

console.log(JSON.stringify({ status: "PAGES_ARTIFACT_PREPARED", output, evidenceFiles }, null, 2));
