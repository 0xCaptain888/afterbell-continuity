import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";
import { BinanceWeb3Client } from "../src/rwa-client.js";
import { assessRightsEvidence, parseUnderlyingMarket, parseUnderlyingProfile } from "../src/rwa-evidence.js";
import type { Address } from "../src/types.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

const preferredTickers = (process.env.AFTERBELL_DISCOVERY_TICKERS ?? "TSLA,NVDA")
  .split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
const ranking = JSON.parse(await readFile("evidence/live/candidate-ranking.json", "utf8")) as {
  continuityPairs?: Array<{
    underlyingTicker: string;
    bstock: { tokenSymbol: string; tokenContractAddress: Address };
    ondo: { tokenSymbol: string; tokenContractAddress: Address };
  }>;
};
const pairs = (ranking.continuityPairs ?? []).filter((pair) => preferredTickers.includes(pair.underlyingTicker));
if (!pairs.length) throw new Error("preferred_continuity_pairs_not_found_run_assets_rank");

const client = new BinanceWeb3Client(
  { apiKey: required("BINANCE_WEB3_API_KEY"), secretKey: required("BINANCE_WEB3_SECRET_KEY") },
  process.env.BINANCE_WEB3_BASE_URL
);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestWithRetry<T>(request: () => Promise<T>): Promise<{ response: T; attempts: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return { response: await request(), attempts: attempt };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const transient = message.includes("network error") || message.includes("API 429") || message.includes("42900");
      if (!transient || attempt === 4) break;
      await wait(attempt * 1_200);
    }
  }
  throw lastError;
}

const observedAt = new Date().toISOString();
const results: Array<Record<string, unknown>> = [];
for (const pair of pairs) {
  for (const wrapper of [pair.bstock, pair.ondo]) {
    const startedAt = Date.now();
    try {
      const profileResult = await requestWithRetry(() => client.getUnderlying(wrapper.tokenContractAddress));
      await wait(700);
      const marketResult = await requestWithRetry(() => client.getMarketStatus(wrapper.tokenContractAddress));
      const profile = parseUnderlyingProfile(profileResult.response);
      const market = parseUnderlyingMarket(marketResult.response);
      const assessment = assessRightsEvidence({ profile, market, observedAt });
      results.push({
        underlyingTicker: pair.underlyingTicker,
        tokenSymbol: wrapper.tokenSymbol,
        tokenContractAddress: wrapper.tokenContractAddress,
        status: "PARTIAL_RIGHTS_EVIDENCE",
        latencyMs: Date.now() - startedAt,
        attempts: profileResult.attempts + marketResult.attempts,
        profile,
        market,
        assessment
      });
    } catch (error) {
      results.push({
        underlyingTicker: pair.underlyingTicker,
        tokenSymbol: wrapper.tokenSymbol,
        tokenContractAddress: wrapper.tokenContractAddress,
        status: "UNAVAILABLE",
        latencyMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
    await wait(850);
  }
}

const available = results.filter((result) => result.status === "PARTIAL_RIGHTS_EVIDENCE");
const payload = {
  schema: "afterbell-rights-discovery/1",
  status: available.length === results.length ? "LIVE_PARTIAL_RIGHTS_EVIDENCE" : "INCOMPLETE_RIGHTS_DISCOVERY",
  mode: "LIVE" as const,
  observedAt,
  source: "Binance Web3 RWA underlying-profile + underlying-market APIs",
  truthNotice: "Authenticated disclosure coverage is LIVE. Backing model, token-holder dividend treatment, split handling, voting rights, and redemption remain UNKNOWN unless explicitly machine-readable.",
  results
};
const evidence = createEvidenceArtifact({ artifactType: "RIGHTS_DISCOVERY", mode: "LIVE", observedAt, source: payload.source, payload });
await mkdir("evidence/live", { recursive: true });
await writeFile("evidence/live/rights-discovery.json", JSON.stringify({ ...payload, evidenceRoot: evidence.evidenceRoot }, null, 2));
console.log(JSON.stringify({
  status: payload.status,
  observedAt,
  requestedAssets: results.length,
  availableAssets: available.length,
  assets: results.map(({ tokenSymbol, status, latencyMs, attempts, reason }) => ({ tokenSymbol, status, latencyMs, ...(attempts ? { attempts } : {}), ...(reason ? { reason } : {}) })),
  evidenceRoot: evidence.evidenceRoot,
  evidenceFile: "evidence/live/rights-discovery.json"
}, null, 2));
if (!available.length) process.exitCode = 2;
