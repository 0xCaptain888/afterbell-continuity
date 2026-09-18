import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createPublicClient, http } from "viem";
import { bscTestnet } from "viem/chains";
import { createEvidenceArtifact } from "../src/evidence.js";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const buyerWorkspace = resolve(root, ".runtime/AfterBellBuyer");
const privateReceiptPath = resolve(buyerWorkspace, "evidence/job-1254-settlement.json");
const publicEvidencePath = resolve(root, "evidence/live/agent-studio-paid-delivery.json");
const evidence = JSON.parse(await readFile(publicEvidencePath, "utf8")) as Json;
const payload = evidence.payload as Json;
const job = payload.job as Json;
const settlement = payload.settlement as Json;

if (payload.status === "PAID_DELIVERY_SETTLED" && settlement.completed === true) {
  console.log(JSON.stringify({ status: "SETTLEMENT_EVIDENCE_ALREADY_PUBLISHED", jobId: 1254, transactionHash: settlement.transactionHash, evidenceRoot: evidence.evidenceRoot }, null, 2));
  process.exit(0);
}

const privateMode = (await stat(privateReceiptPath)).mode & 0o777;
assert(privateMode === 0o600, "settlement_receipt_permissions_must_be_0600");
const receipt = JSON.parse(await readFile(privateReceiptPath, "utf8")) as Json;
const transactionHash = String(receipt.transactionHash ?? "") as `0x${string}`;
const completedAt = String(receipt.observedAt ?? "");
const eligibleIso = String(job.settlementEligibleAt ?? settlement.earliestBuyerApproval ?? "");
const eligibleAt = Date.parse(eligibleIso);

assert(receipt.jobId === 1254 && receipt.action === "approve" && receipt.status === "COMPLETED", "invalid_private_settlement_receipt");
assert(/^0x[0-9a-f]{64}$/i.test(transactionHash), "settlement_transaction_hash_missing");
assert(Number.isFinite(Date.parse(completedAt)), "settlement_observed_at_invalid");
assert(Number.isFinite(eligibleAt) && Date.parse(completedAt) >= eligibleAt, "settlement_dispute_window_not_respected");

const rpc = process.env.STUDIO_BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const publicClient = createPublicClient({ chain: bscTestnet, transport: http(rpc, { timeout: 30_000, retryCount: 2 }) });
const transactionReceipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
assert(transactionReceipt.status === "success", "settlement_transaction_failed");
assert(transactionReceipt.blockNumber.toString() === String(receipt.blockNumber), "settlement_block_number_mismatch");

process.chdir(resolve(root, "bnb-agent/app/agent"));
const runtimeModuleUrl = pathToFileURL(resolve(root, "bnb-agent/app/agent/node_modules/@bnbagent/studio-runtime/dist/erc8183/index.js")).href;
const { get8183Client } = await import(runtimeModuleUrl) as { get8183Client: () => Promise<{ getJob: (id: bigint) => Promise<Json> }> };
const client = await get8183Client();
const chainJob = await client.getJob(1254n);
process.chdir(root);
assert(Number(chainJob.status) === 3, "post_settlement_job_not_completed");

const previousParents = Array.isArray(evidence.parentHashes)
  ? evidence.parentHashes.filter((value): value is `0x${string}` => typeof value === "string" && /^0x[0-9a-f]{64}$/.test(value))
  : [];
const completedPayload = JSON.parse(JSON.stringify({
  ...payload,
  status: "PAID_DELIVERY_SETTLED",
  job: { ...job, statusCode: 3, status: "COMPLETED" },
  transactions: {
    ...(payload.transactions as Json),
    buyerApproval: {
      hash: transactionHash,
      blockNumber: transactionReceipt.blockNumber.toString(),
      status: transactionReceipt.status,
      gasUsed: transactionReceipt.gasUsed.toString()
    }
  },
  settlement: {
    completed: true,
    action: "approve",
    completedAt,
    transactionHash,
    blockNumber: transactionReceipt.blockNumber.toString(),
    earliestBuyerApproval: eligibleIso,
    disputeWindowRespected: true
  },
  truthNotice: "An independent buyer paid 0.01 U, the public Agent submitted a content-addressed PROTECTED decision, and the buyer approved it after the canonical dispute window. The job is COMPLETED on BSC Testnet; no B402 settlement or rescue transaction is claimed."
})) as Json;
const artifact = createEvidenceArtifact({
  artifactType: "BNB_AGENT_ERC8183_PAID_DELIVERY",
  mode: "LIVE",
  observedAt: completedAt,
  source: "BSC Testnet RPC, BNB Agent Studio managed deliverable storage, independent buyer workflow, and buyer settlement receipt",
  parentHashes: [...previousParents, String(evidence.evidenceRoot) as `0x${string}`],
  payload: completedPayload
});

await writeFile(publicEvidencePath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  status: "PAID_DELIVERY_SETTLEMENT_EVIDENCE_PUBLISHED",
  jobId: 1254,
  transactionHash,
  evidenceRoot: artifact.evidenceRoot,
  output: "evidence/live/agent-studio-paid-delivery.json"
}, null, 2));
