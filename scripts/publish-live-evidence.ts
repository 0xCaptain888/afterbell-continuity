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
const simulation = await readJson("evidence/live/quote-simulation-gate.json");

const inventoryPairs = Array.isArray(inventory?.continuityPairs) ? inventory.continuityPairs as Array<Record<string, unknown>> : [];
const featured = inventoryPairs
  .filter((pair) => ["TSLA", "NVDA"].includes(String(pair.underlyingTicker)))
  .map((pair) => {
    const bstock = pair.bstock as Record<string, unknown> | undefined;
    const ondo = pair.ondo as Record<string, unknown> | undefined;
    return {
      underlyingTicker: pair.underlyingTicker,
      normalizedSpreadBps: pair.normalizedSpreadBps,
      ratioDeltaBps: pair.ratioDeltaBps,
      bstock: bstock?.tokenSymbol,
      ondo: ondo?.tokenSymbol,
      pairEvidenceHash: pair.pairEvidenceHash
    };
  });
const quoteResults = Array.isArray(quotes?.results) ? quotes.results as Array<Record<string, unknown>> : [];
const simulationData = simulation?.simulation as Record<string, unknown> | undefined;
const simulationPayload = simulationData?.data as Record<string, unknown> | undefined;

const summary = {
  schema: "afterbell-public-live-evidence/1",
  generatedAt: new Date().toISOString(),
  truthNotice: "LIVE labels refer to authenticated API evidence. No BSC transaction has been signed or broadcast.",
  inventory: inventory ? {
    status: inventory.status,
    observedAt: inventory.observedAt,
    parsedAssetCount: inventory.parsedAssetCount,
    continuityPairCount: inventory.continuityPairCount ?? inventoryPairs.length,
    evidenceRoot: inventory.evidenceRoot,
    featuredPairs: featured
  } : { status: "UNAVAILABLE" },
  quotes: quotes ? {
    status: quotes.status,
    observedAt: quotes.observedAt,
    requestedRoutes: quoteResults.length,
    quotedRoutes: quoteResults.filter((result) => result.status === "QUOTED").length,
    routes: quoteResults.map((result) => ({
      underlyingTicker: result.underlyingTicker,
      tokenSymbol: result.tokenSymbol,
      status: result.status,
      latencyMs: result.latencyMs
    })),
    evidenceRoot: quotes.evidenceRoot
  } : { status: "UNAVAILABLE" },
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
  mainnetExecution: {
    status: "NOT_EXECUTED",
    transactionHash: null
  }
};

await writeFile("site/live-evidence.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ status: "PUBLIC_EVIDENCE_SUMMARY_UPDATED", output: "site/live-evidence.json" }, null, 2));
