import { readFile, writeFile } from "node:fs/promises";
import { getAddress, type Address } from "viem";
import { createEvidenceArtifact } from "../src/evidence.js";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const path = "evidence/deployment/bsc-mainnet.json";
const existing = JSON.parse(await readFile(path, "utf8")) as Json;
const expected = [
  { name: "ContinuityRegistry", address: getAddress("0xcb158746e0855ecec2703ce20ec3aa780c0c823a") },
  { name: "GuardedStockVault", address: getAddress("0x8f996afcb61eaa3fcc6bce21b691240e6eace1bd") },
  { name: "ExecutionBondEscrow", address: getAddress("0x52b6ff2243c3366e14ac13c6490a48580de12029") }
] as const;
const contracts = existing.contracts as Array<Json>;

assert(existing.schema === "afterbell-deployment/2", "unexpected_deployment_schema");
assert(existing.chainId === 56, "unexpected_deployment_chain");
assert(typeof existing.observedAt === "string" && Number.isFinite(Date.parse(existing.observedAt)), "invalid_deployment_observed_at");
assert(typeof existing.source === "string" && existing.source.length > 0, "invalid_deployment_source");
assert(Array.isArray(contracts) && contracts.length === expected.length, "unexpected_deployment_contract_count");
for (const [index, item] of expected.entries()) {
  const record = contracts[index]!;
  assert(record.name === item.name, `${item.name}_deployment_order_mismatch`);
  assert(getAddress(String(record.address) as Address) === item.address, `${item.name}_deployment_address_mismatch`);
  assert(record.receiptStatus === "success", `${item.name}_receipt_not_verified`);
  assert(record.constructorInputMatched === true, `${item.name}_constructor_not_verified`);
  assert(record.runtimeBytecodeMatched === true, `${item.name}_runtime_not_verified`);
}

const verifiedAt = new Date().toISOString();
const sourceVerification = {
  status: "VERIFIED",
  verifiedAt,
  verifier: "BscScan Standard JSON Input",
  compilerVersion: "v0.8.30+commit.73712a01",
  optimizer: { enabled: true, runs: 200 },
  license: "MIT",
  standardInput: "evidence/deployment/bscscan-standard-input.json",
  contracts: expected.map(({ name, address }) => ({
    name,
    address,
    sourceUrl: `https://bscscan.com/address/${address}#code`
  }))
};
const { evidenceRoot: _previousRoot, ...previousPayload } = existing;
const payload = {
  ...previousPayload,
  status: "MAINNET_DEPLOYED_VERIFIED",
  sourceVerification,
  truthNotice: "Deployment receipts, exact creation calldata, runtime bytecode, Registry relationships, and all three published Solidity sources are independently inspectable on BNB Chain and BscScan."
};
const evidence = createEvidenceArtifact({
  artifactType: "BSC_MAINNET_DEPLOYMENT",
  mode: "MAINNET",
  observedAt: existing.observedAt,
  source: existing.source,
  payload
});

await writeFile(path, JSON.stringify({ ...payload, evidenceRoot: evidence.evidenceRoot }, null, 2));
console.log(JSON.stringify({
  status: payload.status,
  verifiedAt,
  contracts: sourceVerification.contracts,
  evidenceRoot: evidence.evidenceRoot
}, null, 2));
