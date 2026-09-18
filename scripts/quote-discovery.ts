import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";
import { BinanceWeb3Client } from "../src/rwa-client.js";
import { extractQuoteEvidence } from "../src/trading-evidence.js";
import type { Address } from "../src/types.js";

const BSC_USDT = "0x55d398326f99059ff775485246999027b3197955" as Address;
const SAFE_QUOTE_ONLY_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;
const preferredTickers = (process.env.AFTERBELL_DISCOVERY_TICKERS ?? "TSLA,AMD,COIN,NVDA")
  .split(",")
  .map((ticker) => ticker.trim().toUpperCase())
  .filter(Boolean);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

const wallet = (process.env.AFTERBELL_WALLET_ADDRESS?.match(/^0x[0-9a-fA-F]{40}$/)
  ? process.env.AFTERBELL_WALLET_ADDRESS
  : SAFE_QUOTE_ONLY_ADDRESS) as Address;
const walletMode = wallet === SAFE_QUOTE_ONLY_ADDRESS ? "QUOTE_ONLY_PLACEHOLDER" : "USER_PUBLIC_ADDRESS";
const amount = process.env.AFTERBELL_DISCOVERY_AMOUNT ?? "5000000000000000000";
if (!/^\d+$/.test(amount) || amount === "0") throw new Error("invalid_afterbell_discovery_amount");

const inventory = JSON.parse(await readFile("evidence/live/candidate-ranking.json", "utf8")) as {
  continuityPairs?: Array<{
    underlyingTicker: string;
    score: number;
    bstock: { tokenSymbol: string; tokenContractAddress: Address };
    ondo: { tokenSymbol: string; tokenContractAddress: Address };
  }>;
};
const pairs = (inventory.continuityPairs ?? []).filter((pair) => preferredTickers.includes(pair.underlyingTicker));
if (!pairs.length) throw new Error("preferred_continuity_pairs_not_found_run_assets_rank");

const client = new BinanceWeb3Client(
  { apiKey: required("BINANCE_WEB3_API_KEY"), secretKey: required("BINANCE_WEB3_SECRET_KEY") },
  process.env.BINANCE_WEB3_BASE_URL
);
const observedAt = new Date().toISOString();
const results: Array<Record<string, unknown>> = [];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function quoteWithRetry(input: Parameters<typeof client.getQuote>[0]) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return { response: await client.getQuote(input), attempts: attempt };
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

for (const pair of pairs) {
  for (const wrapper of [pair.bstock, pair.ondo]) {
    const startedAt = Date.now();
    try {
      const { response, attempts } = await quoteWithRetry({
        amount,
        fromTokenAddress: BSC_USDT,
        toTokenAddress: wrapper.tokenContractAddress,
        userWalletAddress: wallet,
        binanceChainId: "56"
      });
      const quote = extractQuoteEvidence({
        response,
        fromTokenAddress: BSC_USDT,
        toTokenAddress: wrapper.tokenContractAddress,
        inputAmount: amount,
        observedAt: new Date().toISOString(),
        ttlSeconds: 30
      });
      results.push({
        underlyingTicker: pair.underlyingTicker,
        tokenSymbol: wrapper.tokenSymbol,
        tokenContractAddress: wrapper.tokenContractAddress,
        status: "QUOTED",
        latencyMs: Date.now() - startedAt,
        attempts,
        quote
      });
    } catch (error) {
      results.push({
        underlyingTicker: pair.underlyingTicker,
        tokenSymbol: wrapper.tokenSymbol,
        tokenContractAddress: wrapper.tokenContractAddress,
        status: "NO_QUOTE",
        latencyMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
    await wait(650);
  }
}

const quoted = results.filter((result) => result.status === "QUOTED");
const output = {
  schema: "afterbell-quote-discovery/1",
  status: quoted.length > 0 ? "LIVE_QUOTES_FOUND" : "NO_EXECUTABLE_QUOTES_FOUND",
  mode: "LIVE" as const,
  observedAt,
  source: "Binance Web3 Trading API",
  walletMode,
  wallet,
  inputToken: { symbol: "USDT", address: BSC_USDT, amount },
  truthNotice: "Quote discovery only. No transaction was built, signed, simulated, or broadcast.",
  results
};
const evidence = createEvidenceArtifact({
  artifactType: "QUOTE_DISCOVERY",
  mode: "LIVE",
  observedAt,
  source: output.source,
  payload: output
});
await mkdir("evidence/live", { recursive: true });
await writeFile("evidence/live/quote-discovery.json", JSON.stringify({ ...output, evidenceRoot: evidence.evidenceRoot }, null, 2));
console.log(JSON.stringify({
  status: output.status,
  observedAt,
  walletMode,
  requestedRoutes: results.length,
  quotedRoutes: quoted.length,
  routes: results.map(({ underlyingTicker, tokenSymbol, status, latencyMs, attempts, reason }) => ({ underlyingTicker, tokenSymbol, status, latencyMs, ...(attempts ? { attempts } : {}), ...(reason ? { reason } : {}) })),
  evidenceRoot: evidence.evidenceRoot,
  evidenceFile: "evidence/live/quote-discovery.json"
}, null, 2));
if (!quoted.length) process.exitCode = 2;
