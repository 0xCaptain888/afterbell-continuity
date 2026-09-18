import { writeFile, mkdir } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";
import { parseRwaTokenRecords, rankContinuityPairs, rankRwaCandidates } from "../src/inventory.js";
import { BinanceRwaClient } from "../src/rwa-client.js";

const apiKey = process.env.BINANCE_WEB3_API_KEY;
const secretKey = process.env.BINANCE_WEB3_SECRET_KEY;
if (!apiKey || !secretKey) {
  const blocked = {
    status: "BLOCKED",
    reason: "missing_binance_web3_credentials",
    next: "Set BINANCE_WEB3_API_KEY and BINANCE_WEB3_SECRET_KEY in .env. Do not paste secrets into source control."
  };
  await mkdir("evidence/live", { recursive: true });
  await writeFile("evidence/live/data-gate-status.json", JSON.stringify(blocked, null, 2));
  console.error(JSON.stringify(blocked, null, 2));
  process.exitCode = 2;
} else {
  const client = new BinanceRwaClient({ apiKey, secretKey }, process.env.BINANCE_WEB3_BASE_URL);
  const startedAt = Date.now();
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const transient = message.includes("network error") || message.includes("API 429") || message.includes("42900");
        if (!transient || attempt === 3) break;
        await wait(attempt * 1_000);
      }
    }
    throw lastError;
  }
  try {
    const platforms = await withRetry(() => client.listPlatforms());
    await wait(350);
    const bstock = await withRetry(() => client.listAssets("bstock", "56"));
    await wait(350);
    const ondo = await withRetry(() => client.listAssets("ondo", "56"));
    const records = [...parseRwaTokenRecords(bstock), ...parseRwaTokenRecords(ondo)];
    const ranked = rankRwaCandidates(records);
    const pairs = rankContinuityPairs(records);
    const observedAt = new Date().toISOString();
    const evidence = createEvidenceArtifact({
      artifactType: "RWA_INVENTORY",
      mode: "LIVE",
      observedAt,
      source: "Binance Web3 RWA Data API",
      payload: { platforms, assets: { bstock, ondo }, rankedCandidates: ranked, continuityPairs: pairs }
    });
    const result = {
      status: "LIVE_DATA_GATE_PASSED",
      observedAt,
      latencyMs: Date.now() - startedAt,
      source: "Binance Web3 RWA Data API",
      platforms,
      assets: { bstock, ondo },
      parsedAssetCount: records.length,
      continuityPairCount: pairs.length,
      rankedCandidates: ranked,
      continuityPairs: pairs,
      evidenceRoot: evidence.evidenceRoot,
      caveat: "Availability, quotes, liquidity, and mainnet executability still require separate Trading and Transaction API checks."
    };
    await mkdir("evidence/live", { recursive: true });
    await writeFile("evidence/live/rwa-inventory.json", JSON.stringify(result, null, 2));
    await writeFile("evidence/live/rwa-inventory.evidence.json", JSON.stringify(evidence, null, 2));
    await writeFile("evidence/live/data-gate-status.json", JSON.stringify({ status: result.status, observedAt: result.observedAt }, null, 2));
    console.log(JSON.stringify({
      status: result.status,
      observedAt: result.observedAt,
      latencyMs: result.latencyMs,
      parsedAssetCount: result.parsedAssetCount,
      continuityPairCount: pairs.length,
      topCandidates: ranked.slice(0, 10).map(({ underlyingTicker, tokenSymbol, platformId, score, premiumBps, tokenContractAddress }) => ({ underlyingTicker, tokenSymbol, platformId, score, premiumBps, tokenContractAddress })),
      topContinuityPairs: pairs.slice(0, 10).map(({ underlyingTicker, score, normalizedSpreadBps, ratioDeltaBps, bstock: left, ondo: right, pairEvidenceHash }) => ({ underlyingTicker, score, normalizedSpreadBps, ratioDeltaBps, bstock: left.tokenSymbol, ondo: right.tokenSymbol, pairEvidenceHash })),
      evidenceRoot: result.evidenceRoot,
      evidenceFile: "evidence/live/rwa-inventory.json"
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      status: "LIVE_DATA_GATE_FAILED",
      observedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exitCode = 1;
  }
}
