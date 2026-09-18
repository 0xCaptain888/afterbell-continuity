import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const buyerWorkspace = resolve(root, ".runtime/AfterBellBuyer");
const buyerEnv = resolve(buyerWorkspace, ".studio/.env.local");
const bag = "/opt/homebrew/bin/bag";
const jobId = 1254;
const execute = process.argv.includes("--execute");
const evidence = JSON.parse(await readFile(resolve(root, "evidence/live/agent-studio-paid-delivery.json"), "utf8")) as Json;
const payload = evidence.payload as Json;
const job = payload.job as Json;
const settlement = payload.settlement as Json;

assert(job.id === jobId, "unexpected_paid_job_id");
assert(job.status === "SUBMITTED" || job.status === "COMPLETED", "paid_job_not_settleable");
const eligibleIso = String(job.settlementEligibleAt ?? settlement.earliestBuyerApproval ?? "");
const eligibleAt = Date.parse(eligibleIso);
assert(Number.isFinite(eligibleAt), "invalid_settlement_eligibility_time");

if (job.status === "COMPLETED" || settlement.completed === true) {
  console.log(JSON.stringify({ status: "ALREADY_SETTLED", jobId, evidenceRoot: evidence.evidenceRoot }, null, 2));
  process.exit(0);
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
  process.exit(0);
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
  STUDIO_BSC_TESTNET_RPC: process.env.STUDIO_BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
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
  status: "COMPLETED",
  financialTransactionCreated: true,
  truthNotice: "The independent buyer approved the submitted deliverable after the canonical dispute window elapsed."
};
await mkdir(resolve(buyerWorkspace, "evidence"), { recursive: true });
await writeFile(resolve(buyerWorkspace, "evidence/job-1254-settlement.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  status: "PAID_DELIVERY_SETTLED",
  jobId,
  transactionHash,
  privateReceipt: ".runtime/AfterBellBuyer/evidence/job-1254-settlement.json",
  next: "Record and publish the settlement receipt before claiming completion."
}, null, 2));
