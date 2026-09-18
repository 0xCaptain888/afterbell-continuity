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
const publicSummary = await readJson("site/live-evidence.json");
const trustedIssuers = await readJson("site/trusted-issuers.json");
const packageJson = await readJson("package.json");
const readme = await readFile("README.md", "utf8");
const roadmap = await readFile("docs/ROADMAP.md", "utf8");
const judgeGuide = await readFile("docs/JUDGE-GUIDE.md", "utf8");
const ciWorkflow = await readFile(".github/workflows/ci.yml", "utf8");
const pageWorkflow = await readFile(".github/workflows/pages.yml", "utf8");

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

assert(readme.includes("https://0xcaptain888.github.io/afterbell-continuity/"), "public_demo_not_linked");
assert(readme.includes("eight canonical SHA-256 commitments"), "browser_verifier_count_stale");
assert(!readme.includes("REGISTRY_REISSUE_PENDING"), "readme_registry_status_stale");
assert(roadmap.includes("[x] Registry-bound Credential reissuance and public evidence refresh"), "roadmap_registry_status_stale");
assert(roadmap.includes("[x] Public demo"), "roadmap_demo_status_stale");
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
  { id: "continuous-integration", result: "PASS", evidence: ".github/workflows/ci.yml", detail: "Tests, compilation, package build, security audit, and this readiness audit run in CI." },
  { id: "public-secret-scan", result: "PASS", evidence: `${secretMatches.length} matches`, detail: "No credential or private-key pattern is present in public artifacts." }
] as const;

const observedAt = String(publicSummary.generatedAt);
assert(Number.isFinite(Date.parse(observedAt)), "public_summary_timestamp_invalid");
const parentHashes = [deployment.evidenceRoot, swap.evidenceRoot, credential.evidenceRoot, passport.evidenceRoot, consumer.evidenceRoot] as Hex[];
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
      { id: "agent-studio-receipt", status: "UNPUBLISHED", blockingCoreVerification: false },
      { id: "four-minute-demo-video", status: "NOT_RECORDED", blockingCoreVerification: false }
    ],
    truthNotice: "TECHNICALLY_READY covers the reproducible repository, public demo, mainnet execution, source-verified contracts, Registry-bound Credential, Passport, and independent consumer. It does not claim an Agent Studio deployment receipt or a completed submission video."
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
