import { cp, mkdir, rm, copyFile, writeFile } from "node:fs/promises";

const output = ".runtime/pages";
const evidenceFiles = [
  { source: "evidence/live/rights-discovery.json", name: "rights-discovery.json" },
  { source: "evidence/live/quote-discovery.json", name: "quote-discovery.json" },
  { source: "evidence/live/economic-equivalence.json", name: "economic-equivalence.json" },
  { source: "evidence/live/quote-simulation-gate.json", name: "quote-simulation-gate.json" },
  { source: "evidence/live/mainnet-stock-swap.json", name: "mainnet-stock-swap.json" },
  { source: "evidence/deployment/bsc-mainnet.json", name: "bsc-mainnet.json" },
  { source: "evidence/live/mainnet-credential.json", name: "mainnet-credential.json" },
  { source: "evidence/live/mainnet-passport.json", name: "mainnet-passport.json" },
  { source: "evidence/live/guarded-consumer-admission.json", name: "guarded-consumer-admission.json" },
  { source: "evidence/live/agent-studio-deployment.json", name: "agent-studio-deployment.json" },
  { source: "evidence/live/agent-studio-public-negotiate.json", name: "agent-studio-public-negotiate.json" },
  { source: "evidence/agent-studio-package.json", name: "agent-studio-package.json" },
  { source: "evidence/bnb-agent-operator-readiness.json", name: "bnb-agent-operator-readiness.json" },
  { source: "evidence/submission-readiness.json", name: "submission-readiness.json" }
];

await rm(output, { recursive: true, force: true });
await mkdir(`${output}/evidence`, { recursive: true });
await cp("site", output, { recursive: true });
for (const file of evidenceFiles) {
  await copyFile(file.source, `${output}/evidence/${file.name}`);
}
await writeFile(`${output}/publication.json`, JSON.stringify({
  schema: "afterbell-publication/1",
  generatedAt: new Date().toISOString(),
  evidenceFiles: evidenceFiles.map((file) => file.name)
}, null, 2));

console.log(JSON.stringify({ status: "PAGES_ARTIFACT_PREPARED", output, evidenceFiles: evidenceFiles.map((file) => file.name) }, null, 2));
