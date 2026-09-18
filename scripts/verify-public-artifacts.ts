import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createEvidenceArtifact } from "../src/evidence.js";
import { verifyCredential } from "../src/credential.js";
import { buildPassport } from "../src/verifier.js";
import type { ContinuityCredential, ContinuityPassport, EvidenceMode, ExecutionEvidence, Hex, SignedCredential } from "../src/types.js";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(path: string): Promise<Json> {
  return JSON.parse(await readFile(path, "utf8")) as Json;
}

function records(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter((item): item is Json => typeof item === "object" && item !== null) : [];
}

function verifyRoot(input: {
  file: Json;
  artifactType: string;
  parentHashes?: Hex[];
}) {
  const { evidenceRoot, parentHashes: storedParents, ...payload } = input.file;
  assert(typeof evidenceRoot === "string" && /^0x[0-9a-f]{64}$/.test(evidenceRoot), `${input.artifactType}: invalid_evidence_root`);
  const mode = payload.mode;
  const observedAt = payload.observedAt;
  const source = payload.source;
  assert(typeof mode === "string", `${input.artifactType}: missing_mode`);
  assert(typeof observedAt === "string" && Number.isFinite(Date.parse(observedAt)), `${input.artifactType}: invalid_observed_at`);
  assert(typeof source === "string" && source.length > 0, `${input.artifactType}: missing_source`);
  const artifact = createEvidenceArtifact({
    artifactType: input.artifactType,
    mode: mode as EvidenceMode,
    observedAt,
    source,
    payload,
    parentHashes: input.parentHashes ?? []
  });
  assert(artifact.evidenceRoot === evidenceRoot, `${input.artifactType}: evidence_root_mismatch`);
  if (input.parentHashes) assert(JSON.stringify(storedParents) === JSON.stringify(input.parentHashes), `${input.artifactType}: parent_hash_mismatch`);
}

function verifyWrappedRoot(file: Json, expectedArtifactType: string): void {
  const parentHashes = Array.isArray(file.parentHashes)
    ? file.parentHashes.filter((value): value is Hex => typeof value === "string" && /^0x[0-9a-f]{64}$/.test(value))
    : [];
  assert(file.artifactType === expectedArtifactType, `${expectedArtifactType}: unexpected_artifact_type`);
  assert(typeof file.mode === "string", `${expectedArtifactType}: missing_mode`);
  assert(typeof file.observedAt === "string" && Number.isFinite(Date.parse(file.observedAt)), `${expectedArtifactType}: invalid_observed_at`);
  assert(typeof file.source === "string" && file.source.length > 0, `${expectedArtifactType}: missing_source`);
  const rebuilt = createEvidenceArtifact({
    artifactType: expectedArtifactType,
    mode: file.mode as EvidenceMode,
    observedAt: file.observedAt,
    source: file.source,
    payload: file.payload,
    parentHashes
  });
  assert(rebuilt.payloadHash === file.payloadHash, `${expectedArtifactType}: payload_hash_mismatch`);
  assert(rebuilt.evidenceRoot === file.evidenceRoot, `${expectedArtifactType}: evidence_root_mismatch`);
}

function parseCredential(value: Json): ContinuityCredential {
  return {
    schema: "afterbell-continuity/1",
    chainId: Number(value.chainId),
    registry: String(value.registry) as `0x${string}`,
    asset: String(value.asset) as `0x${string}`,
    underlyingHash: String(value.underlyingHash) as Hex,
    economicExposureMicros: BigInt(String(value.economicExposureMicros)),
    rightsFingerprintHash: String(value.rightsFingerprintHash) as Hex,
    equivalenceClassHash: String(value.equivalenceClassHash) as Hex,
    status: Number(value.status) as 0 | 1 | 2,
    riskTier: Number(value.riskTier) as 0 | 1 | 2 | 3,
    issuedAt: BigInt(String(value.issuedAt)),
    expiresAt: BigInt(String(value.expiresAt)),
    nonce: String(value.nonce) as Hex,
    evidenceRoot: String(value.evidenceRoot) as Hex
  };
}

async function scanPublicFiles(directory: string): Promise<string[]> {
  const matches: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...await scanPublicFiles(path));
    else {
      const text = await readFile(path, "utf8");
      if (/ghp_[A-Za-z0-9_]{20,}|BINANCE_WEB3_SECRET_KEY\s*=\s*\S+|BINANCE_WEB3_API_KEY\s*=\s*\S+/i.test(text)) matches.push(path);
    }
  }
  return matches;
}

const rights = await readJson("evidence/live/rights-discovery.json");
const quotes = await readJson("evidence/live/quote-discovery.json");
const equivalence = await readJson("evidence/live/economic-equivalence.json");
const mainnetSwap = await readJson("evidence/live/mainnet-stock-swap.json");
const mainnetCredential = await readJson("evidence/live/mainnet-credential.json");
const mainnetPassport = await readJson("evidence/live/mainnet-passport.json");
const publicSummary = await readJson("site/live-evidence.json");

verifyRoot({ file: rights, artifactType: "RIGHTS_DISCOVERY" });
verifyRoot({ file: quotes, artifactType: "ROUND_TRIP_QUOTE_DISCOVERY" });
const parents = Array.isArray(equivalence.parentHashes)
  ? equivalence.parentHashes.filter((value): value is Hex => typeof value === "string" && /^0x[0-9a-f]{64}$/.test(value))
  : [];
assert(parents.length === 2, "equivalence_parent_roots_missing");
verifyRoot({ file: equivalence, artifactType: "LIVE_ECONOMIC_EQUIVALENCE", parentHashes: parents });
verifyRoot({ file: mainnetSwap, artifactType: "MAINNET_STOCK_SWAP" });
verifyWrappedRoot(mainnetCredential, "LIVE_CONTINUITY_CREDENTIAL");
verifyWrappedRoot(mainnetPassport, "LIVE_CONTINUITY_PASSPORT");

const credentialPayload = mainnetCredential.payload as Json;
const signedCredentialJson = credentialPayload.signedCredential as Json;
const credential = parseCredential(signedCredentialJson.credential as Json);
const signedCredential: SignedCredential = {
  credential,
  signer: String(signedCredentialJson.signer) as `0x${string}`,
  signature: String(signedCredentialJson.signature) as Hex
};
const issuanceVerification = await verifyCredential({
  signed: signedCredential,
  expectedSigner: signedCredential.signer,
  nowSeconds: Number(credential.issuedAt + 1n)
});
assert(issuanceVerification.valid, `credential_invalid_at_issuance:${issuanceVerification.reasons.join(",")}`);
assert(issuanceVerification.digest === credentialPayload.digest, "credential_digest_mismatch");
assert((credentialPayload.issuanceVerification as Json | undefined)?.valid === true, "published_issuance_verification_not_valid");
assert(credential.registry === "0x0000000000000000000000000000000000000000", "credential_must_not_imply_deployed_registry");

const passportPayload = mainnetPassport.payload as Json;
const passport = passportPayload.passport as unknown as ContinuityPassport;
const rebuiltPassport = buildPassport(passport.execution as ExecutionEvidence, passport.issuedAt);
assert(rebuiltPassport.passportId === passport.passportId, "passport_id_mismatch");
assert(rebuiltPassport.evidenceRoot === passport.evidenceRoot, "passport_internal_root_mismatch");
assert(rebuiltPassport.verification.evidenceHash === passport.verification.evidenceHash, "passport_verification_hash_mismatch");
assert(passport.execution.credentialHash === credentialPayload.digest, "passport_credential_link_mismatch");
assert(passport.verification.result === "CHALLENGE", "passport_must_not_hide_quote_timing_gap");
assert(passport.verification.reasons.length === 1 && passport.verification.reasons[0] === "quoteFresh", "unexpected_passport_challenge_reason");
assert(Object.entries(passport.verification.checks).filter(([name, passed]) => !passed && name !== "quoteFresh").length === 0, "passport_non_timing_check_failed");

const rightResults = records(rights.results);
const quoteResults = records(quotes.results);
const equivalenceResults = records(equivalence.results);
assert(rights.status === "LIVE_PARTIAL_RIGHTS_EVIDENCE", "unexpected_rights_status");
assert(rightResults.length === 4 && rightResults.every((item) => item.status === "PARTIAL_RIGHTS_EVIDENCE"), "rights_coverage_not_4_of_4");
const roundTripRoutes = quoteResults.filter((item) => item.status === "ROUND_TRIP_QUOTED").length;
const expectedQuoteStatus = roundTripRoutes === quoteResults.length
  ? "LIVE_ROUND_TRIP_QUOTES_FOUND"
  : roundTripRoutes > 0
    ? "PARTIAL_ROUND_TRIP_QUOTES_FOUND"
    : "NO_ROUND_TRIP_QUOTES_FOUND";
assert(quotes.status === expectedQuoteStatus, "quote_status_count_mismatch");
assert(quoteResults.length === 4 && roundTripRoutes > 0, "live_round_trip_evidence_missing");
assert(equivalence.status === "LIVE_PRICE_EVIDENCE_RIGHTS_FAIL_CLOSED", "unexpected_equivalence_status");
assert(equivalenceResults.length === 2, "expected_two_featured_equivalence_results");
assert(equivalenceResults.every((item) => ["EXECUTABLE_PRICE_EQUIVALENT", "PRICE_EQUIVALENCE_UNPROVEN"].includes(String(item.economicPriceResult))), "invalid_price_equivalence_result");
assert(equivalenceResults.some((item) => item.economicPriceResult === "EXECUTABLE_PRICE_EQUIVALENT"), "price_equivalence_missing");
assert(equivalenceResults.every((item) => item.classification === "UNKNOWN" && item.automaticRescueAllowed === false), "rights_gate_failed_open");

const publicRights = publicSummary.rights as Json | undefined;
const publicQuotes = publicSummary.quotes as Json | undefined;
const publicEquivalence = publicSummary.equivalence as Json | undefined;
const publicMainnetExecution = publicSummary.mainnetExecution as Json | undefined;
const publicCredential = publicSummary.continuityCredential as Json | undefined;
const publicPassport = publicSummary.continuityPassport as Json | undefined;
assert(publicSummary.schema === "afterbell-public-live-evidence/3", "unexpected_public_summary_schema");
assert(publicRights?.evidenceRoot === rights.evidenceRoot, "public_rights_root_mismatch");
assert(publicQuotes?.evidenceRoot === quotes.evidenceRoot, "public_quotes_root_mismatch");
assert(publicEquivalence?.evidenceRoot === equivalence.evidenceRoot, "public_equivalence_root_mismatch");
assert(mainnetSwap.status === "SUCCESS", "mainnet_swap_not_successful");
assert((mainnetSwap.input as Json | undefined)?.amountRaw === "10000000000000000000", "mainnet_swap_input_not_exact_10_usdt");
assert(BigInt(String((mainnetSwap.output as Json | undefined)?.amountRaw ?? "0")) >= BigInt(String((mainnetSwap.output as Json | undefined)?.minimumAmountRaw ?? "1")), "mainnet_swap_minimum_output_not_met");
assert((mainnetSwap.authorization as Json | undefined)?.postSwapAllowanceRaw === "0", "mainnet_swap_allowance_not_zero");
assert(publicMainnetExecution?.status === "SUCCESS", "public_mainnet_execution_not_successful");
assert(publicMainnetExecution?.evidenceRoot === mainnetSwap.evidenceRoot, "public_mainnet_execution_root_mismatch");
assert(publicCredential?.evidenceRoot === mainnetCredential.evidenceRoot, "public_credential_root_mismatch");
assert(publicCredential?.digest === credentialPayload.digest, "public_credential_digest_mismatch");
assert(publicPassport?.evidenceRoot === mainnetPassport.evidenceRoot, "public_passport_root_mismatch");
assert(publicPassport?.passportId === passport.passportId, "public_passport_id_mismatch");
assert(records(publicSummary.featured).length === 2, "public_featured_assets_missing");

const html = await readFile("site/index.html", "utf8");
const app = await readFile("site/app.js", "utf8");
for (const asset of ["./styles.css", "./app.js", "./favicon.svg"]) {
  assert(html.includes(asset), `site_asset_not_referenced:${asset}`);
}
for (const asset of ["live-evidence.json", "demo-data.json", "wallet-authorization.json", "mainnet-credential.json", "mainnet-passport.json"]) {
  assert(app.includes(asset), `runtime_asset_not_referenced:${asset}`);
  if (["mainnet-credential.json", "mainnet-passport.json"].includes(asset)) await readFile(`evidence/live/${asset}`, "utf8");
  else await readFile(`site/${asset}`, "utf8");
}
assert(app.includes("eth_requestAccounts"), "wallet_connect_not_implemented");
assert(app.includes("eth_sendTransaction"), "bounded_approval_not_implemented");
assert(app.includes("eth_getTransactionByHash"), "broadcast_calldata_not_verified");
assert(app.includes("eth_call"), "onchain_allowance_not_verified");
assert(html.includes("Revoke unexpected allowance"), "unsafe_allowance_revoke_missing");
const walletAuthorization = await readJson("site/wallet-authorization.json");
assert(walletAuthorization.amount === "10000000000000000000", "wallet_approval_not_bounded_to_10_usdt");
assert(typeof walletAuthorization.calldata === "string" && /^0x095ea7b3[0-9a-f]{128}$/i.test(walletAuthorization.calldata), "invalid_wallet_approval_calldata");
const leakedFiles = await scanPublicFiles("site");
assert(leakedFiles.length === 0, `public_secret_pattern_detected:${leakedFiles.join(",")}`);

console.log(JSON.stringify({
  status: "PUBLIC_ARTIFACTS_VERIFIED",
  evidence: { rights: rights.evidenceRoot, quotes: quotes.evidenceRoot, equivalence: equivalence.evidenceRoot, mainnetSwap: mainnetSwap.evidenceRoot, credential: mainnetCredential.evidenceRoot, passport: mainnetPassport.evidenceRoot },
  rightsProfiles: rightResults.length,
  roundTripRoutes,
  featuredAssets: equivalenceResults.length,
  publicSecretMatches: leakedFiles.length,
  credentialSigner: signedCredential.signer,
  passportResult: passport.verification.result
}, null, 2));
