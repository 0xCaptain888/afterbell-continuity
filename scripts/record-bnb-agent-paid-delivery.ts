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
const jobId = 1254;
const deliverableUrl = "https://bnbagent-api.bnbchain.world/v1/deliverables/sha256/23c78693baea47fdcd1b8a9120943c564f70e6c988bccb1c5072d97951e7ea13.json";
const transactions = {
  buyerFundingNative: "0x9c0f37cf37ccbdc0bfaadc82acf14d6156429746d2df825184d69eeed1c4e5e6",
  buyerFundingU: "0x5d238c6502c0c59762c19abd31961527fde9d94414b7f7159f23c2791a1ebfaa",
  createJob: "0x59d9160faa92885d05aec3d71531fd102d586c81a0fd18469e6ec70025e95099",
  registerJob: "0x09b1d28d6e1e713a28f8063288da6dad049349aa286e77431dce9cf84f2549c0",
  setBudget: "0x2f882443aa6f95dfbd74af44d42adc1b45e8486ed6772622dd9474d2761cb981",
  fund: "0x6a10dd12a4a84fe7e172195d2a75a8336ca8e569e5dec80ef6659734984cce1a",
  submit: "0xf26786a929ab2a7955e0006a6367886060f9a899ee715d6e75751c3e63ba853b"
} as const;

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
const deliverable = await deliverableResponse.json() as Json;
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
const settlementEligibleAt = new Date((submittedAt + 86_400) * 1_000).toISOString();
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
    deliverableUrl
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
    reason: "Canonical 24-hour dispute window has not elapsed.",
    earliestBuyerApproval: settlementEligibleAt
  },
  truthNotice: "An independent buyer paid 0.01 U, the public Agent verified and fulfilled the job, and the seller submitted a content-addressed PROTECTED decision on-chain. Final buyer approval is time-gated by the canonical 24-hour dispute window and is not claimed yet."
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
