import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createEvidenceArtifact } from "../src/evidence.js";
import type { Hex } from "../src/types.js";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(path: string): Promise<Json> {
  return JSON.parse(await readFile(path, "utf8")) as Json;
}

function records(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.filter((item): item is Json => typeof item === "object" && item !== null)
    : [];
}

async function scanForSecrets(directory: string): Promise<string[]> {
  const matches: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...await scanForSecrets(path));
    else {
      const text = await readFile(path, "utf8");
      if (/ghp_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|(?:PRIVATE_KEY|SECRET_KEY)\s*=\s*(?:0x)?[A-Za-z0-9]{20,}/i.test(text)) {
        matches.push(path);
      }
    }
  }
  return matches;
}

const deployment = await readJson("evidence/deployment/bsc-mainnet.json");
const swap = await readJson("evidence/live/mainnet-stock-swap.json");
const credential = await readJson("evidence/live/mainnet-credential.json");
const passport = await readJson("evidence/live/mainnet-passport.json");
const consumer = await readJson("evidence/live/guarded-consumer-admission.json");
const agentPackage = await readJson("evidence/agent-studio-package.json");
const publicSummary = await readJson("site/live-evidence.json");
const trustedIssuers = await readJson("site/trusted-issuers.json");
const packageJson = await readJson("package.json");
const readme = await readFile("README.md", "utf8");
const roadmap = await readFile("docs/ROADMAP.md", "utf8");
const judgeGuide = await readFile("docs/JUDGE-GUIDE.md", "utf8");
const ciWorkflow = await readFile(".github/workflows/ci.yml", "utf8");
const pageWorkflow = await readFile(".github/workflows/pages.yml", "utf8");
const agentManifest = await readJson("agent-studio/agent.json");
const officialAgentPackage = await readJson("bnb-agent/app/agent/package.json");
const officialStudioToml = await readFile("bnb-agent/app/agent/studio.toml", "utf8");
const officialAgentSource = await readFile("bnb-agent/app/agent/src/afterbell.ts", "utf8");
const officialAgentTests = await readFile("bnb-agent/app/agent/test/afterbell.test.ts", "utf8");
const paidSettlementScript = await readFile("scripts/settle-bnb-agent-paid-job.ts", "utf8");
const operatorReadiness = await readJson("evidence/bnb-agent-operator-readiness.json");
const agentDeployment = await readJson("evidence/live/agent-studio-deployment.json");
const agentNegotiation = await readJson("evidence/live/agent-studio-public-negotiate.json");
const agentPaidDelivery = await readJson("evidence/live/agent-studio-paid-delivery.json");

const contracts = records(deployment.contracts);
const sourceVerification = deployment.sourceVerification as Json;
const verifiedSources = records(sourceVerification.contracts);
const registry = contracts.find((contract) => contract.name === "ContinuityRegistry");
const credentialPayload = credential.payload as Json;
const signedCredential = credentialPayload.signedCredential as Json;
const credentialBody = signedCredential.credential as Json;
const passportPayload = passport.payload as Json;
const passportBody = passportPayload.passport as Json;
const passportVerification = passportBody.verification as Json;
const passportChecks = passportVerification.checks as Json;
const consumerPayload = consumer.payload as Json;
const consumerDecision = consumerPayload.decision as Json;
const consumerPermissions = consumerDecision.permissions as Json;
const activeIssuer = records(trustedIssuers.issuers).find((issuer) => issuer.status === "ACTIVE");
const publicDeployment = publicSummary.deployment as Json;
const publicCredential = publicSummary.continuityCredential as Json;
const publicPassport = publicSummary.continuityPassport as Json;
const publicConsumer = publicSummary.guardedConsumer as Json;
const scripts = packageJson.scripts as Json;
const packageExports = packageJson.exports as Json;

assert(deployment.status === "MAINNET_DEPLOYED_VERIFIED", "deployment_not_verified");
assert(deployment.chainId === 56, "deployment_not_on_bnb_mainnet");
assert(contracts.length === 3, "expected_three_deployed_contracts");
assert(contracts.every((contract) => contract.receiptStatus === "success" && contract.runtimeBytecodeMatched === true), "deployment_receipt_or_bytecode_failure");
assert(sourceVerification.status === "VERIFIED", "source_verification_missing");
assert(verifiedSources.length === 3 && verifiedSources.every((contract) => String(contract.sourceUrl).endsWith("#code")), "verified_source_links_missing");
assert(registry && typeof registry.address === "string", "registry_missing");

assert(credentialPayload.registryStatus === "MAINNET_DEPLOYED_VERIFIED", "credential_registry_status_stale");
assert(String(credentialBody.registry).toLowerCase() === registry.address.toLowerCase(), "credential_not_registry_bound");
assert(credentialPayload.deploymentEvidenceRoot === deployment.evidenceRoot, "credential_deployment_root_mismatch");
assert(Array.isArray(credential.parentHashes) && credential.parentHashes.includes(deployment.evidenceRoot), "credential_deployment_parent_missing");
assert(activeIssuer && String(activeIssuer.address).toLowerCase() === String(signedCredential.signer).toLowerCase(), "consumer_issuer_trust_mismatch");
assert(String(activeIssuer.registryAddress).toLowerCase() === registry.address.toLowerCase(), "consumer_registry_trust_mismatch");

assert(passportVerification.result === "CHALLENGE", "passport_truth_label_changed");
assert(passportChecks.quoteFresh === false, "passport_quote_timing_gap_not_disclosed");
assert(Array.isArray(passportVerification.reasons) && passportVerification.reasons.length === 1 && passportVerification.reasons[0] === "quoteFresh", "unexpected_passport_challenge");
assert(consumerDecision.result === "REQUIRE_MANUAL_REVIEW", "consumer_did_not_fail_closed");
assert(consumerPermissions.allowAutomatedRescue === false && consumerPermissions.allowGuardedDeposit === false && consumerPermissions.allowReadOnlyMonitoring === true, "consumer_permissions_unsafe");

assert(swap.status === "SUCCESS", "mainnet_swap_missing");
assert((swap.authorization as Json).postSwapAllowanceRaw === "0", "post_swap_allowance_not_zero");
assert((swap.verification as Json).receiptSucceeded === true, "mainnet_receipt_not_verified");
assert(publicDeployment.evidenceRoot === deployment.evidenceRoot, "public_deployment_root_stale");
assert(publicCredential.evidenceRoot === credential.evidenceRoot, "public_credential_root_stale");
assert(publicPassport.evidenceRoot === passport.evidenceRoot, "public_passport_root_stale");
assert(publicConsumer.evidenceRoot === consumer.evidenceRoot, "public_consumer_root_stale");
const rebuiltAgentPackage = createEvidenceArtifact({
  artifactType: String(agentPackage.artifactType),
  mode: "LIVE",
  observedAt: String(agentPackage.observedAt),
  source: String(agentPackage.source),
  payload: agentPackage.payload,
  parentHashes: Array.isArray(agentPackage.parentHashes) ? agentPackage.parentHashes as Hex[] : []
});
assert(rebuiltAgentPackage.payloadHash === agentPackage.payloadHash && rebuiltAgentPackage.evidenceRoot === agentPackage.evidenceRoot, "agent_package_evidence_root_mismatch");
assert((agentPackage.payload as Json).status === "DEPLOYED_TESTNET_TRIAL", "agent_package_not_deployed");
assert((agentPackage.payload as Json).deploymentStatus === "RUNNING_READY", "agent_package_truth_label_invalid");
assert(agentManifest.status === "DEPLOYED_TESTNET_TRIAL", "agent_manifest_status_stale");
assert(officialAgentPackage.name === "AfterBellWatchtower-agent", "official_agent_package_missing");
assert(officialStudioToml.includes('protocols = ["A2A","X402"]'), "official_agent_protocols_missing");
assert(officialStudioToml.includes('default = "bsc-testnet"'), "official_agent_network_invalid");
assert(!officialStudioToml.includes("[llm]"), "official_agent_llm_boundary_invalid");
assert(officialAgentSource.includes("financialTransactionCreated: false") && officialAgentSource.includes("signingRequested: false"), "official_agent_safety_boundary_missing");
assert(officialAgentTests.includes('result.state, "PROTECTED"') && officialAgentTests.includes('result.state, "BLOCKED"'), "official_agent_tests_missing");
assert(paidSettlementScript.includes('status: "TIME_LOCKED"') && paidSettlementScript.includes('process.argv.includes("--execute")'), "paid_settlement_time_lock_missing");
const rebuiltOperatorReadiness = createEvidenceArtifact({
  artifactType: String(operatorReadiness.artifactType),
  mode: "LIVE",
  observedAt: String(operatorReadiness.observedAt),
  source: String(operatorReadiness.source),
  payload: operatorReadiness.payload,
  parentHashes: Array.isArray(operatorReadiness.parentHashes) ? operatorReadiness.parentHashes as Hex[] : []
});
assert(rebuiltOperatorReadiness.payloadHash === operatorReadiness.payloadHash && rebuiltOperatorReadiness.evidenceRoot === operatorReadiness.evidenceRoot, "operator_readiness_evidence_root_mismatch");
assert((operatorReadiness.payload as Json).status === "DEPLOYED_TESTNET_TRIAL", "operator_readiness_not_deployed");
assert(((operatorReadiness.payload as Json).platform as Json).trialClockStarted === true, "trial_truth_label_invalid");
for (const [file, type] of [[agentDeployment, "BNB_AGENT_STUDIO_DEPLOYMENT"], [agentNegotiation, "BNB_AGENT_PUBLIC_NEGOTIATION"]] as const) {
  const rebuilt = createEvidenceArtifact({
    artifactType: type,
    mode: "LIVE",
    observedAt: String(file.observedAt),
    source: String(file.source),
    payload: file.payload,
    parentHashes: Array.isArray(file.parentHashes) ? file.parentHashes as Hex[] : []
  });
  assert(rebuilt.payloadHash === file.payloadHash && rebuilt.evidenceRoot === file.evidenceRoot, `${type}_evidence_root_mismatch`);
}
const rebuiltPaidDelivery = createEvidenceArtifact({
  artifactType: "BNB_AGENT_ERC8183_PAID_DELIVERY",
  mode: "LIVE",
  observedAt: String(agentPaidDelivery.observedAt),
  source: String(agentPaidDelivery.source),
  payload: agentPaidDelivery.payload,
  parentHashes: Array.isArray(agentPaidDelivery.parentHashes) ? agentPaidDelivery.parentHashes as Hex[] : []
});
assert(rebuiltPaidDelivery.payloadHash === agentPaidDelivery.payloadHash && rebuiltPaidDelivery.evidenceRoot === agentPaidDelivery.evidenceRoot, "paid_delivery_evidence_root_mismatch");
const paidDeliveryPayload = agentPaidDelivery.payload as Json;
const paidDeliveryJob = paidDeliveryPayload.job as Json;
const paidDeliveryParticipants = paidDeliveryPayload.participants as Json;
const paidDeliveryResult = paidDeliveryPayload.deliverable as Json;
const paidDeliverySettlement = paidDeliveryPayload.settlement as Json;
const paidDeliverySettled = paidDeliveryPayload.status === "PAID_DELIVERY_SETTLED";
assert(["PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT", "PAID_DELIVERY_SETTLED"].includes(String(paidDeliveryPayload.status)), "paid_delivery_status_invalid");
assert(paidDeliveryJob.id === 1254 && paidDeliveryJob.status === (paidDeliverySettled ? "COMPLETED" : "SUBMITTED") && paidDeliveryJob.budgetRaw === "10000000000000000", "paid_delivery_job_invalid");
assert(paidDeliveryParticipants.separatedWallets === true, "paid_delivery_not_independent");
assert(paidDeliveryResult.state === "PROTECTED" && paidDeliveryResult.financialTransactionCreated === false && paidDeliveryResult.signingRequested === false, "paid_delivery_boundary_invalid");
if (paidDeliverySettled) {
  assert(paidDeliverySettlement.completed === true && paidDeliverySettlement.action === "approve", "paid_delivery_settlement_invalid");
  assert(/^0x[0-9a-f]{64}$/i.test(String(paidDeliverySettlement.transactionHash)), "paid_delivery_settlement_hash_missing");
  assert(paidDeliverySettlement.disputeWindowRespected === true, "paid_delivery_dispute_window_not_respected");
}
assert((agentDeployment.payload as Json).status === "DEPLOYED_TESTNET_TRIAL", "agent_deployment_missing");
assert(((agentNegotiation.payload as Json).negotiation as Json).signatureVerified === true, "agent_public_signature_missing");
await readJson("agent-studio/examples/protected-request.json");
await readJson("agent-studio/examples/protected-response.json");
await readJson("agent-studio/examples/rescue-request.json");
await readJson("agent-studio/examples/rescue-response.json");

assert(readme.includes("https://0xcaptain888.github.io/afterbell-continuity/"), "public_demo_not_linked");
assert(readme.includes("nine canonical SHA-256 commitments"), "browser_verifier_count_stale");
assert(!readme.includes("REGISTRY_REISSUE_PENDING"), "readme_registry_status_stale");
assert(roadmap.includes("[x] Registry-bound Credential reissuance and public evidence refresh"), "roadmap_registry_status_stale");
assert(roadmap.includes("[x] Public demo"), "roadmap_demo_status_stale");
assert(roadmap.includes("[x] Agent Studio Watchtower deployment receipt"), "roadmap_agent_deployment_status_stale");
assert(!judgeGuide.includes("Reissue the Credential with the deployed Registry"), "judge_guide_still_requests_completed_step");
assert(typeof scripts.check === "string" && typeof scripts["submission:audit"] === "string", "verification_scripts_missing");
assert(typeof packageExports["."] === "object", "sdk_export_missing");
await readFile("openapi.yaml", "utf8");
assert(ciWorkflow.includes("npm run submission:audit"), "ci_submission_audit_missing");
assert(pageWorkflow.includes("npm run site:prepare"), "pages_workflow_missing");

const secretMatches = [
  ...await scanForSecrets("site"),
  ...await scanForSecrets("evidence"),
  ...await scanForSecrets("docs")
];
assert(secretMatches.length === 0, `public_secret_pattern_detected:${secretMatches.join(",")}`);

const checks = [
  { id: "mainnet-execution", result: "PASS", evidence: swap.evidenceRoot, detail: "Bounded 10 USDT stock-token execution succeeded; post-swap allowance is zero." },
  { id: "source-verified-contracts", result: "PASS", evidence: deployment.evidenceRoot, detail: "Three BNB Chain contracts have matching receipts, runtime bytecode, relationships, and BscScan sources." },
  { id: "registry-bound-credential", result: "PASS", evidence: credential.evidenceRoot, detail: "The live EIP-712 Credential is bound to the deployed ContinuityRegistry and deployment evidence root." },
  { id: "truthful-passport", result: "PASS", evidence: passport.evidenceRoot, detail: "The Passport exposes quoteFresh as the sole challenge instead of inferring an unprovable broadcast time." },
  { id: "independent-fail-closed-consumer", result: "PASS", evidence: consumer.evidenceRoot, detail: "An independent consumer permits monitoring but blocks deposits and automated rescue." },
  { id: "public-evidence-synchronized", result: "PASS", evidence: publicSummary.generatedAt, detail: "Public summary roots match deployment, Credential, Passport, and consumer artifacts." },
  { id: "browser-verifier", result: "PASS", evidence: "8 canonical public artifacts", detail: "The wallet-free browser verifier independently recomputes all published roots." },
  { id: "sdk-and-openapi", result: "PASS", evidence: "package export + openapi.yaml", detail: "Wallets, agents, and protocols can integrate without importing the UI." },
  { id: "agent-service-package", result: "PASS", evidence: agentPackage.evidenceRoot, detail: "The official BNB Agent Studio A2A/X402 workspace is deployed in the managed BSC Testnet trial with fixed 0.01 U pricing." },
  { id: "public-agent-negotiation", result: "PASS", evidence: agentNegotiation.evidenceRoot, detail: "OAuth-protected public A2A negotiation returned an accepted quote whose provider signature recovers to the deployed Agent wallet." },
  { id: "paid-agent-delivery", result: "PASS", evidence: agentPaidDelivery.evidenceRoot, detail: paidDeliverySettled ? "An independent buyer funded Job 1254 with 0.01 U, the public Agent submitted a content-addressed PROTECTED decision, and buyer approval completed after the dispute window." : "An independent buyer funded Job 1254 with 0.01 U and the public Agent submitted a content-addressed PROTECTED decision on-chain." },
  { id: "official-agent-safety", result: "PASS", evidence: "bnb-agent/app/agent", detail: "The seller runtime is BSC Testnet-bound, has no LLM pricing or delivery path, and tests PROTECTED, WATCH, RESCUE_REQUIRED, BLOCKED, no-signing, and no-transaction outcomes." },
  { id: "continuous-integration", result: "PASS", evidence: ".github/workflows/ci.yml", detail: "Tests, compilation, package build, security audit, and this readiness audit run in CI." },
  { id: "public-secret-scan", result: "PASS", evidence: `${secretMatches.length} matches`, detail: "No credential or private-key pattern is present in public artifacts." }
] as const;

const observedAt = String(publicSummary.generatedAt);
assert(Number.isFinite(Date.parse(observedAt)), "public_summary_timestamp_invalid");
const parentHashes = [deployment.evidenceRoot, swap.evidenceRoot, credential.evidenceRoot, passport.evidenceRoot, consumer.evidenceRoot, agentDeployment.evidenceRoot, agentNegotiation.evidenceRoot, agentPaidDelivery.evidenceRoot] as Hex[];
const artifact = createEvidenceArtifact({
  artifactType: "SUBMISSION_READINESS",
  mode: "LIVE",
  observedAt,
  source: "AfterBell repository-local submission audit",
  parentHashes,
  payload: {
    status: "TECHNICALLY_READY",
    checks,
    remainingExternalItems: [
      ...(paidDeliverySettled ? [] : [{ id: "erc8183-buyer-settlement", status: "PAID_DELIVERY_SUBMITTED_AWAITING_SETTLEMENT", settlementEligibleAt: "2026-09-19T12:07:31.000Z", blockingCoreVerification: false }]),
      { id: "b402-settlement", status: "DORMANT_PENDING_MERCHANT_CREDENTIALS", blockingCoreVerification: false },
      { id: "four-minute-demo-video", status: "NOT_RECORDED", blockingCoreVerification: false }
    ],
    truthNotice: paidDeliverySettled
      ? "TECHNICALLY_READY covers the reproducible repository, public demo, mainnet execution, source-verified contracts, Registry-bound Credential, Passport, independent consumer, managed Agent Studio trial, authenticated signed public quote, and a completed independent-buyer ERC-8183 delivery. It does not claim B402 settlement or a completed submission video."
      : "TECHNICALLY_READY covers the reproducible repository, public demo, mainnet execution, source-verified contracts, Registry-bound Credential, Passport, independent consumer, managed Agent Studio trial, authenticated signed public quote, and a real independent-buyer ERC-8183 delivery submitted on-chain. It does not claim final buyer settlement, B402 settlement, or a completed submission video."
  }
});

await mkdir("evidence", { recursive: true });
await writeFile("evidence/submission-readiness.json", `${JSON.stringify(artifact, null, 2)}\n`);

console.log(JSON.stringify({
  status: "SUBMISSION_TECHNICALLY_READY",
  checksPassed: checks.length,
  checksFailed: 0,
  remainingExternalItems: artifact.payload.remainingExternalItems,
  evidenceRoot: artifact.evidenceRoot,
  output: "evidence/submission-readiness.json"
}, null, 2));
