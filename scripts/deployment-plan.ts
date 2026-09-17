import { mkdir, writeFile } from "node:fs/promises";
import { loadContractArtifact } from "../src/contracts.js";

const contractNames = ["ContinuityRegistry", "GuardedStockVault", "ExecutionBondEscrow"];
const contracts = await Promise.all(contractNames.map((name) => loadContractArtifact(name)));
const plan = {
  schema: "afterbell-deployment-plan/1",
  generatedAt: new Date().toISOString(),
  network: { name: "BNB Smart Chain", chainId: 56 },
  status: "DESIGN",
  truthNotice: "This file commits deployment bytecode hashes only. It is not evidence that any contract is deployed or verified.",
  order: [
    { contract: "ContinuityRegistry", constructorArgs: ["AFTERBELL_SIGNER_ADDRESS"] },
    { contract: "GuardedStockVault", constructorArgs: ["ContinuityRegistry.address"] },
    { contract: "ExecutionBondEscrow", constructorArgs: ["ContinuityRegistry.address"] }
  ],
  contracts: contracts.map(({ contractName, bytecodeHash }) => ({ contractName, bytecodeHash }))
};
await mkdir("evidence/deployment", { recursive: true });
await writeFile("evidence/deployment/bsc-mainnet-plan.json", JSON.stringify(plan, null, 2));
console.log(JSON.stringify(plan, null, 2));
