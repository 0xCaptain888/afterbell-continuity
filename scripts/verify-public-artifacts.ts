import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createEvidenceArtifact } from "../src/evidence.js";
import type { EvidenceMode, Hex } from "../src/types.js";

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
const publicSummary = await readJson("site/live-evidence.json");

verifyRoot({ file: rights, artifactType: "RIGHTS_DISCOVERY" });
verifyRoot({ file: quotes, artifactType: "ROUND_TRIP_QUOTE_DISCOVERY" });
const parents = Array.isArray(equivalence.parentHashes)
  ? equivalence.parentHashes.filter((value): value is Hex => typeof value === "string" && /^0x[0-9a-f]{64}$/.test(value))
  : [];
assert(parents.length === 2, "equivalence_parent_roots_missing");
verifyRoot({ file: equivalence, artifactType: "LIVE_ECONOMIC_EQUIVALENCE", parentHashes: parents });

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
assert(publicSummary.schema === "afterbell-public-live-evidence/2", "unexpected_public_summary_schema");
assert(publicRights?.evidenceRoot === rights.evidenceRoot, "public_rights_root_mismatch");
assert(publicQuotes?.evidenceRoot === quotes.evidenceRoot, "public_quotes_root_mismatch");
assert(publicEquivalence?.evidenceRoot === equivalence.evidenceRoot, "public_equivalence_root_mismatch");
assert(records(publicSummary.featured).length === 2, "public_featured_assets_missing");

const html = await readFile("site/index.html", "utf8");
const app = await readFile("site/app.js", "utf8");
for (const asset of ["./styles.css", "./app.js", "./favicon.svg"]) {
  assert(html.includes(asset), `site_asset_not_referenced:${asset}`);
}
for (const asset of ["live-evidence.json", "demo-data.json", "wallet-authorization.json"]) {
  assert(app.includes(asset), `runtime_asset_not_referenced:${asset}`);
  await readFile(`site/${asset}`, "utf8");
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
  evidence: { rights: rights.evidenceRoot, quotes: quotes.evidenceRoot, equivalence: equivalence.evidenceRoot },
  rightsProfiles: rightResults.length,
  roundTripRoutes,
  featuredAssets: equivalenceResults.length,
  publicSecretMatches: leakedFiles.length
}, null, 2));
