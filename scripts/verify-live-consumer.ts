import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/canonical.js";
import { deserializeSignedCredential, evaluateConsumerAdmission } from "../src/consumer.js";
import { createEvidenceArtifact } from "../src/evidence.js";
import type { ContinuityPassport, Hex } from "../src/types.js";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(path: string): Promise<Json> {
  return JSON.parse(await readFile(path, "utf8")) as Json;
}

const [credentialArtifact, passportArtifact, trustList] = await Promise.all([
  readJson("evidence/live/mainnet-credential.json"),
  readJson("evidence/live/mainnet-passport.json"),
  readJson("site/trusted-issuers.json")
]);
const credentialPayload = credentialArtifact.payload as Json;
const passportPayload = passportArtifact.payload as Json;
const issuers = Array.isArray(trustList.issuers) ? trustList.issuers as Json[] : [];
const activeIssuer = issuers.find((issuer) => issuer.status === "ACTIVE");
assert(activeIssuer && /^0x[0-9a-fA-F]{40}$/.test(String(activeIssuer.address)), "active_trusted_issuer_missing");
const signedCredential = deserializeSignedCredential(credentialPayload.signedCredential);
assert(signedCredential.signer.toLowerCase() === String(activeIssuer.address).toLowerCase(), "credential_signer_not_in_consumer_trust_list");
const passport = passportPayload.passport as unknown as ContinuityPassport;
const nowSeconds = Math.floor(Date.now() / 1_000);
const decision = await evaluateConsumerAdmission({
  signedCredential,
  passport,
  trustedSigner: String(activeIssuer.address) as `0x${string}`,
  nowSeconds,
  maximumRiskTier: 1
});
const credentialActive = signedCredential.credential.issuedAt <= BigInt(nowSeconds)
  && signedCredential.credential.expiresAt > BigInt(nowSeconds);
assert(decision.result === (credentialActive ? "REQUIRE_MANUAL_REVIEW" : "DENY"), "live_consumer_fail_closed_result_mismatch");
assert(decision.permissions.allowAutomatedRescue === false, "live_consumer_must_block_automated_rescue");
assert(decision.permissions.allowGuardedDeposit === false, "live_consumer_must_block_guarded_deposit");
assert(decision.permissions.allowReadOnlyMonitoring === credentialActive, "live_consumer_read_only_permission_mismatch");

const artifact = createEvidenceArtifact({
  artifactType: "LIVE_GUARDED_CONSUMER_ADMISSION",
  mode: "LIVE",
  observedAt: decision.evaluatedAt,
  source: "Standalone AfterBell Guarded Consumer",
  parentHashes: [credentialArtifact.evidenceRoot as Hex, passportArtifact.evidenceRoot as Hex],
  payload: {
    decision,
    policy: {
      trustedIssuerSetHash: sha256(trustList),
      maximumRiskTier: 1,
      requireProtectedCredential: true,
      requireProtectedPassport: true
    },
    consumerBoundary: "This decision is computed without the AfterBell UI and does not possess a wallet key or transaction-signing capability.",
    truthNotice: credentialActive
      ? "The reference consumer allows read-only monitoring but blocks automated rescue and Guarded Vault deposits because the live credential is WATCH/HIGH and the Passport is CHALLENGED."
      : "The reference consumer denies all permissions because the published short-lived credential has expired."
  }
});

await writeFile("evidence/live/guarded-consumer-admission.json", JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({
  status: "LIVE_CONSUMER_ADMISSION_VERIFIED",
  result: decision.result,
  reasons: decision.reasons,
  permissions: decision.permissions,
  trustedIssuer: activeIssuer.address,
  evidenceRoot: artifact.evidenceRoot
}, null, 2));
