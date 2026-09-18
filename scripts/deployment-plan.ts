import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadContractArtifact } from "../src/contracts.js";

const contractNames = ["ContinuityRegistry", "GuardedStockVault", "ExecutionBondEscrow"];
const contracts = await Promise.all(contractNames.map((name) => loadContractArtifact(name)));
const credentialArtifact = JSON.parse(await readFile("evidence/live/mainnet-credential.json", "utf8")) as Record<string, unknown>;
const credentialPayload = credentialArtifact.payload as Record<string, unknown> | undefined;
const signedCredential = credentialPayload?.signedCredential as Record<string, unknown> | undefined;
const credentialIssuer = String(signedCredential?.signer ?? "");
if (!/^0x[0-9a-fA-F]{40}$/.test(credentialIssuer)) throw new Error("live_credential_issuer_missing");
const plan = {
  schema: "afterbell-deployment-plan/1",
  generatedAt: new Date().toISOString(),
  network: { name: "BNB Smart Chain", chainId: 56 },
  status: "DESIGN",
  credentialIssuer,
  truthNotice: "This file commits deployment bytecode hashes and the exact public Credential issuer constructor argument. It is not evidence that any contract is deployed or verified.",
  order: [
    { contract: "ContinuityRegistry", constructorArgs: [credentialIssuer] },
    { contract: "GuardedStockVault", constructorArgs: ["ContinuityRegistry.address"] },
    { contract: "ExecutionBondEscrow", constructorArgs: ["ContinuityRegistry.address"] }
  ],
  contracts: contracts.map(({ contractName, bytecodeHash }) => ({ contractName, bytecodeHash }))
};
await mkdir("evidence/deployment", { recursive: true });
await writeFile("evidence/deployment/bsc-mainnet-plan.json", JSON.stringify(plan, null, 2));
console.log(JSON.stringify(plan, null, 2));
