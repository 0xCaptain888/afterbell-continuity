import { readFile, writeFile } from "node:fs/promises";

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

const inventory = await readJson("evidence/live/rwa-inventory.json");
const quotes = await readJson("evidence/live/quote-discovery.json");
const rights = await readJson("evidence/live/rights-discovery.json");
const equivalence = await readJson("evidence/live/economic-equivalence.json");
const simulation = await readJson("evidence/live/quote-simulation-gate.json");
const mainnetSwap = await readJson("evidence/live/mainnet-stock-swap.json");

const inventoryPairs = Array.isArray(inventory?.continuityPairs) ? inventory.continuityPairs as Array<Record<string, unknown>> : [];
const quoteResults = Array.isArray(quotes?.results) ? quotes.results as Array<Record<string, unknown>> : [];
const quoteComparisons = Array.isArray(quotes?.comparisons) ? quotes.comparisons as Array<Record<string, unknown>> : [];
const rightsResults = Array.isArray(rights?.results) ? rights.results as Array<Record<string, unknown>> : [];
const equivalenceResults = Array.isArray(equivalence?.results) ? equivalence.results as Array<Record<string, unknown>> : [];
const simulationData = simulation?.simulation as Record<string, unknown> | undefined;
const simulationPayload = simulationData?.data as Record<string, unknown> | undefined;

const featured = ["TSLA", "NVDA"].map((ticker) => {
  const pair = inventoryPairs.find((item) => item.underlyingTicker === ticker);
  const comparison = quoteComparisons.find((item) => item.underlyingTicker === ticker);
  const report = equivalenceResults.find((item) => item.underlyingTicker === ticker);
  const routes = quoteResults.filter((item) => item.underlyingTicker === ticker).map((route) => {
    const executable = route.executable as Record<string, unknown> | undefined;
    const rightsRecord = rightsResults.find((item) => item.tokenContractAddress === route.tokenContractAddress);
    const assessment = rightsRecord?.assessment as Record<string, unknown> | undefined;
    const coverage = assessment?.disclosureCoverage as Record<string, unknown> | undefined;
    return {
      platformId: route.platformId,
      tokenSymbol: route.tokenSymbol,
      status: route.status,
      buyPricePerShareUsd: executable?.buyPricePerShareUsd,
      sellPricePerShareUsd: executable?.sellPricePerShareUsd,
      roundTripCostBps: executable?.roundTripCostBps,
      disclosureKinds: coverage?.supportedProtectionKinds ?? [],
      linkedDisclosureKinds: coverage?.linkedProtectionKinds ?? []
    };
  });
  return {
    underlyingTicker: ticker,
    inventoryNormalizedSpreadBps: pair?.normalizedSpreadBps,
    ratioDeltaBps: pair?.ratioDeltaBps,
    executableBuySpreadBps: comparison?.executableBuySpreadBps,
    executableSellSpreadBps: comparison?.executableSellSpreadBps,
    economicPriceResult: report?.economicPriceResult,
    classification: report?.classification,
    automaticRescueAllowed: report?.automaticRescueAllowed,
    decision: report?.decision,
    missingRightsFields: report?.missingRightsFields,
    routes
  };
});

const summary = {
  schema: "afterbell-public-live-evidence/2",
  generatedAt: new Date().toISOString(),
  truthNotice: mainnetSwap?.status === "SUCCESS"
    ? "LIVE labels refer to authenticated API and on-chain evidence. One bounded, user-confirmed BNB Chain stock-token swap is independently verified; incomplete rights evidence remains UNKNOWN and still blocks automatic rescue."
    : "LIVE labels refer to authenticated API and on-chain evidence. A bounded USDT approval was signed and broadcast by the user; no stock-token swap has been signed or broadcast. Incomplete rights evidence remains UNKNOWN and blocks automatic rescue.",
  inventory: inventory ? {
    status: inventory.status,
    observedAt: inventory.observedAt,
    parsedAssetCount: inventory.parsedAssetCount,
    continuityPairCount: inventory.continuityPairCount ?? inventoryPairs.length,
    evidenceRoot: inventory.evidenceRoot
  } : { status: "UNAVAILABLE" },
  rights: rights ? {
    status: rights.status,
    observedAt: rights.observedAt,
    availableAssets: rightsResults.filter((result) => result.status === "PARTIAL_RIGHTS_EVIDENCE").length,
    requestedAssets: rightsResults.length,
    evidenceRoot: rights.evidenceRoot,
    truthNotice: rights.truthNotice
  } : { status: "UNAVAILABLE" },
  quotes: quotes ? {
    status: quotes.status,
    observedAt: quotes.observedAt,
    requestedWrappers: quoteResults.length,
    roundTripRoutes: quoteResults.filter((result) => result.status === "ROUND_TRIP_QUOTED").length,
    evidenceRoot: quotes.evidenceRoot
  } : { status: "UNAVAILABLE" },
  equivalence: equivalence ? {
    status: equivalence.status,
    observedAt: equivalence.observedAt,
    evidenceRoot: equivalence.evidenceRoot,
    decisionRule: equivalence.decisionRule
  } : { status: "UNAVAILABLE" },
  featured,
  simulation: simulation ? {
    status: simulation.status,
    observedAt: simulation.observedAt,
    walletMode: simulation.walletMode,
    quoteVendor: (simulation.quote as Record<string, unknown> | undefined)?.vendor,
    simulationSuccess: simulationData?.success,
    failReason: simulationPayload?.failReason,
    evidenceRoot: simulation.evidenceRoot,
    truthNotice: simulation.truthNotice
  } : { status: "UNAVAILABLE" },
  mainnetExecution: mainnetSwap ? {
    status: mainnetSwap.status,
    observedAt: mainnetSwap.observedAt,
    transactionHash: mainnetSwap.transactionHash,
    explorerUrl: mainnetSwap.explorerUrl,
    blockNumber: mainnetSwap.blockNumber,
    input: mainnetSwap.input,
    output: mainnetSwap.output,
    gas: mainnetSwap.gas,
    authorization: mainnetSwap.authorization,
    verification: mainnetSwap.verification,
    evidenceRoot: mainnetSwap.evidenceRoot,
    truthNotice: mainnetSwap.truthNotice
  } : { status: "NOT_EXECUTED", transactionHash: null }
};

await writeFile("site/live-evidence.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ status: "PUBLIC_EVIDENCE_SUMMARY_UPDATED", output: "site/live-evidence.json", featuredAssets: featured.length }, null, 2));
