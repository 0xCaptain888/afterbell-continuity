import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createPublicClient, formatEther, formatUnits, http, parseAbi } from "viem";
import { bscTestnet } from "viem/chains";
import { createEvidenceArtifact } from "../src/evidence.js";

type Json = Record<string, unknown>;

const root = process.cwd();
const rpc = process.env.STUDIO_BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const buyer = "0x2CB79d0eBcCd6D6846e458e748787C13c6e51Afa" as const;
const provider = "0x83B2B8D09d822DAed95e94E10062b232A54fd123" as const;
const uToken = "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565" as const;
const runManifest = JSON.parse(await readFile(resolve(root, "evidence/bnb-agent-paid-job-run.json"), "utf8")) as Json;
const jobId = process.argv.includes("--job-id")
  ? Number(process.argv[process.argv.indexOf("--job-id") + 1])
  : Number(process.env.BNB_AGENT_PAID_JOB_ID ?? runManifest.activeJobId);
const run = (runManifest.runs as Json)[String(jobId)] as Json | undefined;
assert(Number.isSafeInteger(jobId) && jobId > 0, "invalid_paid_job_id");
assert(run, `paid_job_run_missing:${jobId}`);
const deliverableUrl = String(run.deliverableUrl);
const transactions = run.transactions as Record<string, `0x${string}`>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const publicClient = createPublicClient({ chain: bscTestnet, transport: http(rpc, { timeout: 30_000, retryCount: 2 }) });
const receipts = Object.fromEntries(await Promise.all(Object.entries(transactions).map(async ([name, hash]) => {
  const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` });
  assert(receipt.status === "success", `${name}_receipt_failed`);
  return [name, { hash, blockNumber: receipt.blockNumber.toString(), status: receipt.status, gasUsed: receipt.gasUsed.toString() }];
})));

const deliverableResponse = await fetch(deliverableUrl, { signal: AbortSignal.timeout(30_000) });
assert(deliverableResponse.ok, `deliverable_http_${deliverableResponse.status}`);
const deliverableBytes = Buffer.from(await deliverableResponse.arrayBuffer());
const expectedContentHash = deliverableUrl.match(/\/sha256\/([0-9a-f]{64})\.json$/i)?.[1];
const actualContentHash = createHash("sha256").update(deliverableBytes).digest("hex");
assert(expectedContentHash === actualContentHash, "deliverable_content_address_mismatch");
const deliverable = JSON.parse(deliverableBytes.toString("utf8")) as Json;
const response = deliverable.response as Json;
const decision = JSON.parse(String(response.content ?? "{}")) as Json;
assert(deliverable.job_id === jobId, "deliverable_job_mismatch");
assert(decision.state === "PROTECTED", "paid_delivery_not_protected");
assert(Array.isArray(decision.reasons) && decision.reasons.length === 0, "paid_delivery_has_reasons");
assert(decision.financialTransactionCreated === false && decision.signingRequested === false, "paid_delivery_safety_boundary_failed");

process.chdir(resolve(root, "bnb-agent/app/agent"));
const runtimeModuleUrl = pathToFileURL(resolve(root, "bnb-agent/app/agent/node_modules/@bnbagent/studio-runtime/dist/erc8183/index.js")).href;
const { get8183Client } = await import(runtimeModuleUrl) as { get8183Client: () => Promise<{ getJob: (id: bigint) => Promise<Json> }> };
const client = await get8183Client();
const job = await client.getJob(BigInt(jobId));
process.chdir(root);

assert(Number(job.status) === 2, "job_not_submitted");
assert(String(job.client).toLowerCase() === buyer.toLowerCase(), "job_buyer_mismatch");
assert(String(job.provider).toLowerCase() === provider.toLowerCase(), "job_provider_mismatch");
assert(String(job.budget) === "10000000000000000", "job_budget_mismatch");

const erc20Abi = parseAbi(["function balanceOf(address account) view returns (uint256)"]);
const [buyerNative, buyerU, providerNative, providerU] = await Promise.all([
  publicClient.getBalance({ address: buyer }),
  publicClient.readContract({ address: uToken, abi: erc20Abi, functionName: "balanceOf", args: [buyer] }),
  publicClient.getBalance({ address: provider }),
  publicClient.readContract({ address: uToken, abi: erc20Abi, functionName: "balanceOf", args: [provider] })
]);

const quote = JSON.parse(await readFile(resolve(root, ".runtime/AfterBellBuyer/.studio/afterbell-quote.json"), "utf8")) as Json;
const publicNegotiation = JSON.parse(await readFile(resolve(root, "evidence/live/agent-studio-public-negotiate.json"), "utf8")) as Json;
const deployment = JSON.parse(await readFile(resolve(root, "evidence/live/agent-studio-deployment.json"), "utf8")) as Json;
const submittedAt = Number(job.submittedAt);
const policy = "0xd6a4217588f6b1f5657a92a3e94e6422ad771cea" as const;
const router = "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25" as const;
const [disputeWindow, boundPolicy] = await Promise.all([
  publicClient.readContract({ address: policy, abi: parseAbi(["function disputeWindow() view returns (uint64)"]), functionName: "disputeWindow" }),
  publicClient.readContract({ address: router, abi: parseAbi(["function jobPolicy(uint256 jobId) view returns (address)"]), functionName: "jobPolicy", args: [BigInt(jobId)] })
]);
assert(boundPolicy.toLowerCase() === policy.toLowerCase(), "paid_job_policy_binding_missing");
const settlementEligibleAt = new Date((submittedAt + Number(disputeWindow)) * 1_000).toISOString();
const payload = {
  status: "PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT",
  network: "bsc-testnet",
  chainId: 97,
  deployment: {
    agentId: "01M2T4KMDTJCBQ25HAMPZ9JZ9D",
    deploymentId: "01M2T6J1RNRQVP9573A1GDJRNX",
    erc8004AgentId: "2447"
  },
  participants: { buyer, provider, separatedWallets: buyer.toLowerCase() !== provider.toLowerCase() },
  quote: {
    accepted: (quote.response as Json)?.accepted,
    priceRaw: ((quote.response as Json)?.terms as Json)?.price,
    currency: ((quote.response as Json)?.terms as Json)?.currency,
    negotiationHash: quote.negotiation_hash,
    providerSignature: quote.provider_sig,
    chainId: quote.chain_id,
    verifyingContract: quote.verifying_contract
  },
  job: {
    id: jobId,
    statusCode: Number(job.status),
    status: "SUBMITTED",
    budgetRaw: String(job.budget),
    budgetDisplay: "0.01 U",
    expiredAt: new Date(Number(job.expiredAt) * 1_000).toISOString(),
    submittedAt: new Date(submittedAt * 1_000).toISOString(),
    settlementEligibleAt,
    deliverableHash: String(job.deliverable),
    deliverableUrl,
    contentAddressSha256: actualContentHash,
    policy: boundPolicy,
    disputeWindowSeconds: Number(disputeWindow)
  },
  deliverable: {
    schema: deliverable.schema,
    contentType: response.content_type,
    state: decision.state,
    reasons: decision.reasons,
    checks: decision.checks,
    metrics: decision.metrics,
    decisionHash: decision.decisionHash,
    financialTransactionCreated: decision.financialTransactionCreated,
    signingRequested: decision.signingRequested,
    truthNotice: decision.truthNotice
  },
  transactions: receipts,
  balancesAtObservation: {
    buyer: { tBNB: formatEther(buyerNative), U: formatUnits(buyerU, 18) },
    provider: { tBNB: formatEther(providerNative), U: formatUnits(providerU, 18) }
  },
  failClosedRegression: [
    {
      jobId: 1252,
      outcome: "BLOCKED",
      reason: "invalidTaskPayload",
      submitTransaction: "0xc63de05cf274f31172a4d408975acb5eb26f6b225e6583eebd340c06b9de0a39",
      deliverableUrl: "https://bnbagent-api.bnbchain.world/v1/deliverables/sha256/fd2a8d41e2ba32946d99178f7f10f88aac93fb669f6b39abaf9a1717759d9d6f.json"
    },
    {
      jobId: 1253,
      outcome: "BLOCKED",
      reason: "SDK tuple-array compatibility discovered and fixed",
      submitTransaction: "0x05259ba8b5e86ef2c588c8bf13d8f99d587dcd9f2279e8acc6ef21fb093beb8c",
      deliverableUrl: "https://bnbagent-api.bnbchain.world/v1/deliverables/sha256/a3f9dba011774b01e4a0c37e89764587c0a0d2303c05879bfb1b8dbe685f09dc.json"
    }
  ],
  settlement: {
    completed: false,
    reason: `Canonical ${Number(disputeWindow)}-second dispute window has not elapsed.`,
    earliestBuyerApproval: settlementEligibleAt
  },
  replacementFor: runManifest.replacementFor,
  truthNotice: `An independent buyer paid 0.01 U, the public Agent verified and fulfilled Job ${jobId}, and the seller submitted a content-addressed PROTECTED decision on-chain. Final buyer approval is time-gated by the canonical ${Number(disputeWindow)}-second dispute window and is not claimed yet.`
};

// Evidence hashing must operate on the exact JSON shape that is persisted.
// JSON serialization omits undefined optional fields, so normalize first.
const persistedPayload = JSON.parse(JSON.stringify(payload)) as Json;
const artifact = createEvidenceArtifact({
  artifactType: "BNB_AGENT_ERC8183_PAID_DELIVERY",
  mode: "LIVE",
  observedAt: new Date().toISOString(),
  source: "BSC Testnet RPC, BNB Agent Studio managed deliverable storage, and independent buyer workflow",
  parentHashes: [deployment.evidenceRoot as `0x${string}`, publicNegotiation.evidenceRoot as `0x${string}`],
  payload: persistedPayload
});

await writeFile(resolve(root, "evidence/live/agent-studio-paid-delivery.json"), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({
  status: artifact.payload.status,
  jobId,
  decision: String(decision.state),
  submitTransaction: transactions.submit,
  settlementEligibleAt,
  evidenceRoot: artifact.evidenceRoot,
  output: "evidence/live/agent-studio-paid-delivery.json"
}, null, 2));
