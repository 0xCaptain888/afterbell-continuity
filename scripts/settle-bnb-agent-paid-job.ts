import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createPublicClient, http, parseAbi, parseAbiItem } from "viem";
import { bscTestnet } from "viem/chains";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const buyerWorkspace = resolve(root, ".runtime/AfterBellBuyer");
const buyerEnv = resolve(buyerWorkspace, ".studio/.env.local");
const bag = "/opt/homebrew/bin/bag";
const execute = process.argv.includes("--execute");
const rpc = process.env.STUDIO_BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const buyer = "0x2CB79d0eBcCd6D6846e458e748787C13c6e51Afa" as const;
const commerce = "0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE" as const;
const router = "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25" as const;
const policy = "0xd6a4217588f6b1f5657a92a3e94e6422ad771cea" as const;
const routerAbi = parseAbi(["function jobPolicy(uint256 jobId) view returns (address)"]);
const policyAbi = parseAbi([
  "function submittedAt(uint256 jobId) view returns (uint64)",
  "function disputeWindow() view returns (uint64)",
  "function check(uint256 jobId, bytes evidence) view returns (uint8 verdict, bytes32 reason)"
]);
const evidence = JSON.parse(await readFile(resolve(root, "evidence/live/agent-studio-paid-delivery.json"), "utf8")) as Json;
const payload = evidence.payload as Json;
const job = payload.job as Json;
const settlement = payload.settlement as Json;
const jobId = process.argv.includes("--job-id")
  ? Number(process.argv[process.argv.indexOf("--job-id") + 1])
  : Number(process.env.BNB_AGENT_PAID_JOB_ID ?? job.id);
assert(Number.isSafeInteger(jobId) && jobId > 0, "invalid_paid_job_id");
const privateReceiptPath = resolve(buyerWorkspace, `evidence/job-${jobId}-settlement.json`);

assert(job.id === jobId, "unexpected_paid_job_id");
assert(job.status === "SUBMITTED" || job.status === "COMPLETED", "paid_job_not_settleable");
if (job.status === "COMPLETED" || settlement.completed === true) {
  console.log(JSON.stringify({ status: "ALREADY_SETTLED", jobId, evidenceRoot: evidence.evidenceRoot }, null, 2));
  process.exit(0);
}

try {
  const captured = JSON.parse(await readFile(privateReceiptPath, "utf8")) as Json;
  if (captured.status === "COMPLETED" && /^0x[0-9a-f]{64}$/i.test(String(captured.transactionHash))) {
    console.log(JSON.stringify({
      status: "SETTLEMENT_RECEIPT_ALREADY_CAPTURED",
      jobId,
      transactionHash: captured.transactionHash,
      financialTransactionCreated: false,
      next: "npm run bnb-agent:paid:publish"
    }, null, 2));
    process.exit(0);
  }
} catch {
  // No recoverable private receipt exists yet.
}

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(rpc, { timeout: 30_000, retryCount: 2 })
});
const eventClient = createPublicClient({
  chain: bscTestnet,
  transport: http(process.env.STUDIO_BSC_EVENT_RPC ?? "https://bsc-testnet-rpc.publicnode.com", { timeout: 30_000, retryCount: 2 })
});
const [boundPolicy, submittedAt, disputeWindow, policyCheck] = await Promise.all([
  publicClient.readContract({ address: router, abi: routerAbi, functionName: "jobPolicy", args: [BigInt(jobId)] }),
  publicClient.readContract({ address: policy, abi: policyAbi, functionName: "submittedAt", args: [BigInt(jobId)] }),
  publicClient.readContract({ address: policy, abi: policyAbi, functionName: "disputeWindow" }),
  publicClient.readContract({ address: policy, abi: policyAbi, functionName: "check", args: [BigInt(jobId), "0x"] })
]);
const eligibleAt = (Number(submittedAt) + Number(disputeWindow)) * 1_000;
assert(Number.isFinite(eligibleAt), "invalid_onchain_settlement_eligibility_time");
const eligibleIso = new Date(eligibleAt).toISOString();

const latestEventBlock = await eventClient.getBlockNumber();
const completionEvents = await eventClient.getLogs({
  address: commerce,
  event: parseAbiItem("event JobCompleted(uint256 indexed jobId,address indexed evaluator,bytes32 reason)"),
  args: { jobId: BigInt(jobId) },
  fromBlock: latestEventBlock > 5_000n ? latestEventBlock - 5_000n : 0n,
  toBlock: latestEventBlock
});
const completionEvent = completionEvents.at(-1);
if (completionEvent?.transactionHash && completionEvent.blockNumber) {
  const recoveredReceipt = await publicClient.getTransactionReceipt({ hash: completionEvent.transactionHash });
  const recoveredBlock = await publicClient.getBlock({ blockNumber: completionEvent.blockNumber });
  assert(recoveredReceipt.status === "success", "recovered_settlement_transaction_failed");
  const recovered = {
    schema: "afterbell-buyer-settlement/1",
    observedAt: new Date(Number(recoveredBlock.timestamp) * 1_000).toISOString(),
    network: "bsc-testnet",
    jobId,
    action: "approve",
    transactionHash: completionEvent.transactionHash,
    blockNumber: completionEvent.blockNumber.toString(),
    gasUsed: recoveredReceipt.gasUsed.toString(),
    status: "COMPLETED",
    financialTransactionCreated: true,
    recoveredFromChainEvent: true,
    truthNotice: "The independent buyer approved the submitted deliverable after the canonical dispute window elapsed. The receipt was recovered from the Commerce JobCompleted event."
  };
  await mkdir(resolve(buyerWorkspace, "evidence"), { recursive: true });
  await writeFile(privateReceiptPath, `${JSON.stringify(recovered, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    status: "SETTLEMENT_RECEIPT_RECOVERED_FROM_CHAIN",
    jobId,
    transactionHash: completionEvent.transactionHash,
    blockNumber: completionEvent.blockNumber.toString(),
    privateReceipt: `.runtime/AfterBellBuyer/evidence/job-${jobId}-settlement.json`,
    next: "Run npm run bnb-agent:paid:publish to refresh docs, Demo artifacts, and audits."
  }, null, 2));
  process.exit(0);
}

if (boundPolicy.toLowerCase() !== policy.toLowerCase()) {
  console.log(JSON.stringify({
    status: "BLOCKED_POLICY_BINDING_MISSING",
    jobId,
    router,
    expectedPolicy: policy,
    boundPolicy,
    onchainVerdict: Number(policyCheck[0]),
    onchainReason: policyCheck[1],
    submittedAt: new Date(Number(submittedAt) * 1_000).toISOString(),
    disputeWindowSeconds: Number(disputeWindow),
    settlementEligibleAt: eligibleIso,
    financialTransactionCreated: false,
    next: "The canonical Router no longer binds this submitted job to its Policy. Do not retry settlement; request platform recovery or create a replacement job."
  }, null, 2));
  process.exit(execute ? 3 : 0);
}

const now = Date.now();
if (now < eligibleAt) {
  console.log(JSON.stringify({
    status: "TIME_LOCKED",
    jobId,
    now: new Date(now).toISOString(),
    settlementEligibleAt: eligibleIso,
    remainingSeconds: Math.ceil((eligibleAt - now) / 1_000),
    financialTransactionCreated: false
  }, null, 2));
  process.exit(execute ? 2 : 0);
}

if (!execute) {
  console.log(JSON.stringify({
    status: "READY_AWAITING_EXPLICIT_EXECUTE",
    jobId,
    settlementEligibleAt: eligibleIso,
    next: "npm run bnb-agent:paid:settle -- --execute",
    financialTransactionCreated: false
  }, null, 2));
  process.exit(0);
}

await access(bag, constants.X_OK);
await access(buyerEnv, constants.R_OK);
const mode = (await stat(buyerEnv)).mode & 0o777;
assert(mode === 0o600, "buyer_env_permissions_must_be_0600");

const environment = {
  ...process.env,
  STUDIO_BSC_TESTNET_RPC: rpc,
  BNBAGENT_USE_PAYMASTER: "0"
};
const settlementRun = spawnSync(bag, ["erc8183", "settle", String(jobId), "--action", "approve"], {
  cwd: buyerWorkspace,
  env: environment,
  encoding: "utf8"
});
if (settlementRun.status !== 0) {
  throw new Error(`settlement_failed:${String(settlementRun.stderr || settlementRun.stdout).trim().slice(0, 800)}`);
}
const settlementOutput = `${settlementRun.stdout}\n${settlementRun.stderr}`;
const transactionHash = settlementOutput.match(/0x[0-9a-f]{64}/i)?.[0];
assert(transactionHash, "settlement_transaction_hash_missing");

const transactionReceipt = await publicClient.waitForTransactionReceipt({
  hash: transactionHash as `0x${string}`,
  confirmations: 1,
  timeout: 60_000
});
assert(transactionReceipt.status === "success", "settlement_transaction_failed");

const statusRun = spawnSync(bag, ["erc8183", "status", String(jobId)], {
  cwd: buyerWorkspace,
  env: environment,
  encoding: "utf8"
});
assert(statusRun.status === 0, "post_settlement_status_failed");
assert(/COMPLETED|status[^\n]*3/i.test(statusRun.stdout), "post_settlement_job_not_completed");

const receipt = {
  schema: "afterbell-buyer-settlement/1",
  observedAt: new Date().toISOString(),
  network: "bsc-testnet",
  jobId,
  action: "approve",
  transactionHash,
  blockNumber: transactionReceipt.blockNumber.toString(),
  gasUsed: transactionReceipt.gasUsed.toString(),
  status: "COMPLETED",
  financialTransactionCreated: true,
  truthNotice: "The independent buyer approved the submitted deliverable after the canonical dispute window elapsed."
};
await mkdir(resolve(buyerWorkspace, "evidence"), { recursive: true });
await writeFile(privateReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });

console.log(JSON.stringify({
  status: "PAID_DELIVERY_SETTLED",
  jobId,
  transactionHash,
  blockNumber: transactionReceipt.blockNumber.toString(),
  privateReceipt: `.runtime/AfterBellBuyer/evidence/job-${jobId}-settlement.json`,
  next: "Run npm run bnb-agent:paid:publish to refresh docs, Demo artifacts, and audits."
}, null, 2));
