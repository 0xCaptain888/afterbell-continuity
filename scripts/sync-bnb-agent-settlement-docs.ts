import { readFile, writeFile } from "node:fs/promises";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function replaceRequired(path: string, replacements: Array<[string | RegExp, string]>): Promise<void> {
  let text = await readFile(path, "utf8");
  for (const [search, replacement] of replacements) {
    const next = text.replace(search, replacement);
    assert(next !== text || text.includes(replacement), `settlement_docs_pattern_missing:${path}:${String(search)}`);
    text = next;
  }
  await writeFile(path, text);
}

const artifact = JSON.parse(await readFile("evidence/live/agent-studio-paid-delivery.json", "utf8")) as Json;
const payload = artifact.payload as Json;
const job = payload.job as Json;
const settlement = payload.settlement as Json;
const transactionHash = String(settlement.transactionHash ?? "");
const jobId = Number(job.id);
const disputeWindowSeconds = Number(job.disputeWindowSeconds);

assert(payload.status === "PAID_DELIVERY_SETTLED", "paid_delivery_not_settled");
assert(job.status === "COMPLETED" && settlement.completed === true, "paid_delivery_completion_missing");
assert(Number.isSafeInteger(jobId) && jobId > 0, "paid_delivery_job_id_invalid");
assert(/^0x[0-9a-f]{64}$/i.test(transactionHash), "paid_delivery_settlement_hash_missing");

await replaceRequired("README.md", [
  [/\- Independent paid delivery: \[`PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT`\][^\n]*/, `- Independent paid delivery: [\`PAID_DELIVERY_SETTLED\`](./evidence/live/agent-studio-paid-delivery.json) — buyer \`0x2CB7…1Afa\`, replacement Job \`${jobId}\`, \`0.01 U\`, content-addressed \`PROTECTED\` result, and buyer approval after the canonical ${disputeWindowSeconds}-second dispute window; [settlement transaction](https://testnet.bscscan.com/tx/${transactionHash}). Job \`1254\` remains transparently recorded as un-settled because its Router Policy binding was missing.`],
  [/The settlement command is deliberately time-locked and dry-run by default:[\s\S]*?After eligibility, omitting `--execute` returns `READY_AWAITING_EXPLICIT_EXECUTE`\./, `The independent buyer settlement is complete. The time-locked command remains reproducible and idempotent; rerunning it returns \`ALREADY_SETTLED\`.`],
  [/It does \*\*not\*\* claim Agentic Wallet custody, final ERC-8183 buyer settlement, B402 settlement, or automated rescue settlement\./, "It does **not** claim Agentic Wallet custody, B402 settlement, or automated rescue settlement."],
  ["and one independently funded ERC-8183 delivery.", "and one independently settled ERC-8183 delivery."],
  [/Independent-buyer ERC-8183 lifecycle through quote, create, register, budget, `0\.01 U` funding, notify, deterministic delivery, content-addressed result, and on-chain submission; final approval remains subject to the canonical dispute window/, "Independent-buyer ERC-8183 lifecycle through quote, create, register, budget, `0.01 U` funding, notify, deterministic delivery, content-addressed result, on-chain submission, and buyer approval after the canonical dispute window"],
  [/\| BNB Agent Studio Watchtower \| `PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT` \|[^\n]*/, `| BNB Agent Studio Watchtower | \`PAID_DELIVERY_SETTLED\` | runtime \`running (ready)\`, ERC-8004 ID \`2447\`; independent buyer funded Job \`${jobId}\` with \`0.01 U\`, Agent submitted \`PROTECTED\`, and buyer approval completed after the canonical ${disputeWindowSeconds}-second dispute window; B402 remains dormant |`]
]);

await replaceRequired("docs/ROADMAP.md", [
  [/\- \[x\] Complete an independent-buyer paid ERC-8183 delivery through on-chain submission[^\n]*/, `- [x] Complete an independent-buyer paid ERC-8183 delivery through on-chain submission (replacement Job \`${jobId}\`, \`0.01 U\`, \`PROTECTED\`)`],
  [/\- \[ \] Approve Job `\d+` after[^\n]*/, `- [x] Approve Job \`${jobId}\` after the canonical ${disputeWindowSeconds}-second dispute window`]
]);

await replaceRequired("docs/JUDGE-GUIDE.md", [
  [/12\. In the paid-delivery artifact,[^\n]*/, `12. In the paid-delivery artifact, confirm the independent buyer \`0x2CB7…1Afa\`, Job \`${jobId}\`, the content-addressed \`PROTECTED\` deliverable, and the buyer-approval transaction \`${transactionHash}\`; the job must read \`COMPLETED\`.`],
  ["- `PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT`: an independent buyer funded the job and the Agent submitted its deliverable on-chain; payment release is not claimed until buyer approval has its own receipt.", "- `PAID_DELIVERY_SETTLED`: an independent buyer funded the job, the Agent submitted its deliverable on-chain, and buyer approval released payment after the canonical dispute window with its own receipt."]
]);

await replaceRequired("docs/VIDEO-SCRIPT.md", [
  [/\- Show the verified BSC Testnet managed-trial deployment,[^\n]*/, `- Show the verified BSC Testnet managed-trial deployment, Agent/Deployment IDs, ERC-8004 ID, public Agent Card, signed quote, and Job \`${jobId}\` settlement receipt. Say “independent buyer funded, Agent delivered, buyer approved after the canonical ${disputeWindowSeconds}-second dispute window”; do not claim B402 settlement.`]
]);

await replaceRequired("site/index.html", [
  [/PAID JOB \d+ · (?:loading chain state|SUBMITTED · awaiting settlement) ↗/, `PAID JOB ${jobId} · COMPLETED · settlement verified ↗`],
  [/<div class="pending" id="agentApprovalStep"><i>5<\/i><span>Buyer approves<\/span><\/div>/, "<div class=\"complete\" id=\"agentApprovalStep\"><i>5</i><span>Buyer approved</span></div>"],
  [/<p class="commerce-truth">[^<]*<\/p>/, "<p class=\"commerce-truth\">Buyer approval released payment only after the canonical dispute window. No rescue transaction was signed or broadcast by the Watchtower, and no B402 payment is claimed.</p>"],
  [/an independent buyer's paid Agent Job \d+ through on-chain submission\. Final buyer settlement remains time-gated and is not claimed\./, `an independent buyer's paid Agent Job ${jobId} through completed settlement. The buyer approval is backed by its own BSC Testnet receipt; B402 settlement is not claimed.`]
]);

console.log(JSON.stringify({
  status: "SETTLEMENT_DOCS_SYNCHRONIZED",
  jobId: job.id,
  transactionHash,
  files: ["README.md", "docs/ROADMAP.md", "docs/JUDGE-GUIDE.md", "docs/VIDEO-SCRIPT.md", "site/index.html"]
}, null, 2));
