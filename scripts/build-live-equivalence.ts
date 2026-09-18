import { readFile, writeFile } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";
import type { Hex } from "../src/types.js";

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

const inventory = await readJson("evidence/live/candidate-ranking.json");
const rights = await readJson("evidence/live/rights-discovery.json");
const quotes = await readJson("evidence/live/quote-discovery.json");
const observedAt = new Date().toISOString();

const inventoryPairs = Array.isArray(inventory.continuityPairs) ? inventory.continuityPairs as Array<Record<string, unknown>> : [];
const rightsResults = Array.isArray(rights.results) ? rights.results as Array<Record<string, unknown>> : [];
const quoteResults = Array.isArray(quotes.results) ? quotes.results as Array<Record<string, unknown>> : [];
const quoteComparisons = Array.isArray(quotes.comparisons) ? quotes.comparisons as Array<Record<string, unknown>> : [];

const tickers = ["TSLA", "NVDA"];
const results = tickers.map((ticker) => {
  const pair = inventoryPairs.find((item) => item.underlyingTicker === ticker);
  if (!pair) return { underlyingTicker: ticker, classification: "UNAVAILABLE", automaticRescueAllowed: false, blockingReasons: ["inventory_pair_missing"] };
  const wrappers = rightsResults.filter((item) => item.underlyingTicker === ticker);
  const routes = quoteResults.filter((item) => item.underlyingTicker === ticker);
  const comparison = quoteComparisons.find((item) => item.underlyingTicker === ticker);
  const executableRoutes = routes.filter((item) => item.status === "ROUND_TRIP_QUOTED");
  const allRightsAvailable = wrappers.length === 2 && wrappers.every((item) => item.status === "PARTIAL_RIGHTS_EVIDENCE");
  const missingRightsFields = new Set<string>();
  for (const wrapper of wrappers) {
    const assessment = wrapper.assessment as Record<string, unknown> | undefined;
    const claims = assessment?.claims as Record<string, unknown> | undefined;
    for (const [field, value] of Object.entries(claims ?? {})) if (value === "UNKNOWN") missingRightsFields.add(field);
  }
  const buySpread = Number(comparison?.executableBuySpreadBps);
  const sellSpread = Number(comparison?.executableSellSpreadBps);
  const executablePriceEquivalent = executableRoutes.length === 2 && Number.isFinite(buySpread) && Number.isFinite(sellSpread) && buySpread <= 50 && sellSpread <= 50;
  const wrapperSummaries = routes.map((route) => {
    const executable = route.executable as Record<string, unknown> | undefined;
    const rightsRecord = wrappers.find((item) => item.tokenContractAddress === route.tokenContractAddress);
    const market = rightsRecord?.market as Record<string, unknown> | undefined;
    const assessment = rightsRecord?.assessment as Record<string, unknown> | undefined;
    const coverage = assessment?.disclosureCoverage as Record<string, unknown> | undefined;
    return {
      platformId: route.platformId,
      tokenSymbol: route.tokenSymbol,
      tokenContractAddress: route.tokenContractAddress,
      marketStatus: market?.marketStatus ?? "UNKNOWN",
      buyPricePerShareUsd: executable?.buyPricePerShareUsd,
      sellPricePerShareUsd: executable?.sellPricePerShareUsd,
      roundTripCostBps: executable?.roundTripCostBps,
      executableBuyPremiumBps: executable?.executableBuyPremiumBps,
      protectionDisclosures: coverage?.supportedProtectionKinds ?? [],
      linkedDisclosures: coverage?.linkedProtectionKinds ?? [],
      rightsFingerprintHash: (assessment?.rights as Record<string, unknown> | undefined)?.fingerprintHash
    };
  });
  return {
    underlyingTicker: ticker,
    economicPriceResult: executablePriceEquivalent ? "EXECUTABLE_PRICE_EQUIVALENT" : "PRICE_EQUIVALENCE_UNPROVEN",
    classification: "UNKNOWN",
    automaticRescueAllowed: false,
    inventoryNormalizedSpreadBps: pair.normalizedSpreadBps,
    ratioDeltaBps: pair.ratioDeltaBps,
    executableBuySpreadBps: Number.isFinite(buySpread) ? buySpread : undefined,
    executableSellSpreadBps: Number.isFinite(sellSpread) ? sellSpread : undefined,
    rightsEvidenceStatus: allRightsAvailable ? "LIVE_PARTIAL" : "INCOMPLETE",
    missingRightsFields: [...missingRightsFields].sort(),
    blockingReasons: [
      "machine_readable_rights_incomplete",
      "price_equivalence_does_not_prove_legal_or_rights_equivalence"
    ],
    decision: "WATCH_ONLY_MANUAL_REVIEW",
    wrappers: wrapperSummaries
  };
});

const payload = JSON.parse(JSON.stringify({
  schema: "afterbell-live-economic-equivalence/1",
  status: "LIVE_PRICE_EVIDENCE_RIGHTS_FAIL_CLOSED",
  mode: "LIVE" as const,
  observedAt,
  source: "Derived from authenticated Binance Web3 RWA profile, market, inventory, and bidirectional Trading API quotes",
  decisionRule: "Automatic wrapper rescue requires both executable economic equivalence and complete compatible rights evidence. Price-only equivalence is insufficient.",
  results
})) as Record<string, unknown>;
const parentHashes = [rights.evidenceRoot, quotes.evidenceRoot].filter((value): value is Hex => typeof value === "string" && value.startsWith("0x")) as Hex[];
const evidence = createEvidenceArtifact({ artifactType: "LIVE_ECONOMIC_EQUIVALENCE", mode: "LIVE", observedAt, source: String(payload.source), payload, parentHashes });
await writeFile("evidence/live/economic-equivalence.json", JSON.stringify({ ...payload, evidenceRoot: evidence.evidenceRoot, parentHashes }, null, 2));
console.log(JSON.stringify({
  status: payload.status,
  results: results.map((result) => ({ underlyingTicker: result.underlyingTicker, economicPriceResult: result.economicPriceResult, classification: result.classification, automaticRescueAllowed: result.automaticRescueAllowed })),
  evidenceRoot: evidence.evidenceRoot,
  evidenceFile: "evidence/live/economic-equivalence.json"
}, null, 2));
