import { writeFile, mkdir } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";
import { parseRwaTokenRecords, rankRwaCandidates } from "../src/inventory.js";
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
  try {
    const [platforms, bstock, ondo] = await Promise.all([
      client.listPlatforms(),
      client.listAssets("bstock", "56"),
      client.listAssets("ondo", "56")
    ]);
    const records = [...parseRwaTokenRecords(bstock), ...parseRwaTokenRecords(ondo)];
    const ranked = rankRwaCandidates(records);
    const observedAt = new Date().toISOString();
    const evidence = createEvidenceArtifact({
      artifactType: "RWA_INVENTORY",
      mode: "LIVE",
      observedAt,
      source: "Binance Web3 RWA Data API",
      payload: { platforms, assets: { bstock, ondo }, rankedCandidates: ranked }
    });
    const result = {
      status: "LIVE_DATA_GATE_PASSED",
      observedAt,
      latencyMs: Date.now() - startedAt,
      source: "Binance Web3 RWA Data API",
      platforms,
      assets: { bstock, ondo },
      parsedAssetCount: records.length,
      rankedCandidates: ranked,
      evidenceRoot: evidence.evidenceRoot,
      caveat: "Availability, quotes, liquidity, and mainnet executability still require separate Trading and Transaction API checks."
    };
    await mkdir("evidence/live", { recursive: true });
    await writeFile("evidence/live/rwa-inventory.json", JSON.stringify(result, null, 2));
    await writeFile("evidence/live/rwa-inventory.evidence.json", JSON.stringify(evidence, null, 2));
    await writeFile("evidence/live/data-gate-status.json", JSON.stringify({ status: result.status, observedAt: result.observedAt }, null, 2));
    console.log(JSON.stringify(result, null, 2));
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
