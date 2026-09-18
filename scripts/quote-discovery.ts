import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";
import { calculateExecutableRoundTrip, crossWrapperSpreadBps } from "../src/executable-equivalence.js";
import { BinanceWeb3Client } from "../src/rwa-client.js";
import { extractQuoteEvidence } from "../src/trading-evidence.js";
import type { Address } from "../src/types.js";

const BSC_USDT = "0x55d398326f99059ff775485246999027b3197955" as Address;
const BSC_USDT_DECIMALS = 18;
const SAFE_QUOTE_ONLY_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;
const preferredTickers = (process.env.AFTERBELL_DISCOVERY_TICKERS ?? "TSLA,NVDA")
  .split(",").map((ticker) => ticker.trim().toUpperCase()).filter(Boolean);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

const wallet = (process.env.AFTERBELL_WALLET_ADDRESS?.match(/^0x[0-9a-fA-F]{40}$/)
  ? process.env.AFTERBELL_WALLET_ADDRESS
  : SAFE_QUOTE_ONLY_ADDRESS) as Address;
const walletMode = wallet === SAFE_QUOTE_ONLY_ADDRESS ? "QUOTE_ONLY_PLACEHOLDER" : "USER_PUBLIC_ADDRESS";
const amount = process.env.AFTERBELL_DISCOVERY_AMOUNT ?? "10000000000000000000";
if (!/^\d+$/.test(amount) || amount === "0") throw new Error("invalid_afterbell_discovery_amount");

type Wrapper = {
  platformId: "bstock" | "ondo";
  tokenSymbol: string;
  tokenContractAddress: Address;
  decimals: number;
  tokenToShareRatio: string;
  referencePrice: string;
};

const inventory = JSON.parse(await readFile("evidence/live/candidate-ranking.json", "utf8")) as {
  continuityPairs?: Array<{ underlyingTicker: string; score: number; bstock: Wrapper; ondo: Wrapper }>;
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
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return { response: await client.getQuote(input), attempts: attempt };
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

for (const pair of pairs) {
  for (const wrapper of [pair.bstock, pair.ondo]) {
    const startedAt = Date.now();
    let buyAttempts = 0;
    try {
      const buyResult = await quoteWithRetry({ amount, fromTokenAddress: BSC_USDT, toTokenAddress: wrapper.tokenContractAddress, userWalletAddress: wallet, binanceChainId: "56" });
      buyAttempts = buyResult.attempts;
      const buyQuote = extractQuoteEvidence({
        response: buyResult.response,
        fromTokenAddress: BSC_USDT,
        toTokenAddress: wrapper.tokenContractAddress,
        inputAmount: amount,
        observedAt: new Date().toISOString(),
        ttlSeconds: 30
      });
      await wait(850);
      try {
        const sellResult = await quoteWithRetry({ amount: buyQuote.outputAmount, fromTokenAddress: wrapper.tokenContractAddress, toTokenAddress: BSC_USDT, userWalletAddress: wallet, binanceChainId: "56" });
        const sellQuote = extractQuoteEvidence({
          response: sellResult.response,
          fromTokenAddress: wrapper.tokenContractAddress,
          toTokenAddress: BSC_USDT,
          inputAmount: buyQuote.outputAmount,
          observedAt: new Date().toISOString(),
          ttlSeconds: 30
        });
        const executable = calculateExecutableRoundTrip({
          buy: buyQuote,
          sell: sellQuote,
          stableDecimals: BSC_USDT_DECIMALS,
          tokenDecimals: wrapper.decimals,
          tokenToShareRatio: Number(wrapper.tokenToShareRatio),
          inventoryReferencePriceUsd: Number(wrapper.referencePrice)
        });
        results.push({ underlyingTicker: pair.underlyingTicker, platformId: wrapper.platformId, tokenSymbol: wrapper.tokenSymbol, tokenContractAddress: wrapper.tokenContractAddress, status: "ROUND_TRIP_QUOTED", latencyMs: Date.now() - startedAt, attempts: buyResult.attempts + sellResult.attempts, buyQuote, sellQuote, executable });
      } catch (sellError) {
        results.push({ underlyingTicker: pair.underlyingTicker, platformId: wrapper.platformId, tokenSymbol: wrapper.tokenSymbol, tokenContractAddress: wrapper.tokenContractAddress, status: "BUY_ONLY", latencyMs: Date.now() - startedAt, attempts: buyAttempts, buyQuote, exitReason: sellError instanceof Error ? sellError.message : String(sellError) });
      }
    } catch (error) {
      results.push({ underlyingTicker: pair.underlyingTicker, platformId: wrapper.platformId, tokenSymbol: wrapper.tokenSymbol, tokenContractAddress: wrapper.tokenContractAddress, status: "NO_QUOTE", latencyMs: Date.now() - startedAt, attempts: buyAttempts, reason: error instanceof Error ? error.message : String(error) });
    }
    await wait(850);
  }
}

const roundTrips = results.filter((result) => result.status === "ROUND_TRIP_QUOTED");
const comparisons = pairs.map((pair) => {
  const bstock = roundTrips.find((result) => result.underlyingTicker === pair.underlyingTicker && result.platformId === "bstock");
  const ondo = roundTrips.find((result) => result.underlyingTicker === pair.underlyingTicker && result.platformId === "ondo");
  const bMath = bstock?.executable as { buyPricePerShareUsd: number; sellPricePerShareUsd: number } | undefined;
  const oMath = ondo?.executable as { buyPricePerShareUsd: number; sellPricePerShareUsd: number } | undefined;
  return {
    underlyingTicker: pair.underlyingTicker,
    status: bMath && oMath ? "BOTH_DIRECTIONS_COMPARABLE" : "INCOMPLETE",
    ...(bMath && oMath ? {
      executableBuySpreadBps: crossWrapperSpreadBps(bMath.buyPricePerShareUsd, oMath.buyPricePerShareUsd),
      executableSellSpreadBps: crossWrapperSpreadBps(bMath.sellPricePerShareUsd, oMath.sellPricePerShareUsd)
    } : {})
  };
});

const output = {
  schema: "afterbell-quote-discovery/2",
  status: roundTrips.length === results.length ? "LIVE_ROUND_TRIP_QUOTES_FOUND" : roundTrips.length ? "PARTIAL_ROUND_TRIP_QUOTES_FOUND" : "NO_ROUND_TRIP_QUOTES_FOUND",
  mode: "LIVE" as const,
  observedAt,
  source: "Binance Web3 Trading API",
  walletMode,
  wallet,
  stableToken: { symbol: "USDT", address: BSC_USDT, decimals: BSC_USDT_DECIMALS, inputAmount: amount },
  truthNotice: "Quote discovery covers buy and immediate exit liquidity only. No transaction was built, signed, simulated, or broadcast.",
  results,
  comparisons
};
const evidence = createEvidenceArtifact({ artifactType: "ROUND_TRIP_QUOTE_DISCOVERY", mode: "LIVE", observedAt, source: output.source, payload: output });
await mkdir("evidence/live", { recursive: true });
await writeFile("evidence/live/quote-discovery.json", JSON.stringify({ ...output, evidenceRoot: evidence.evidenceRoot }, null, 2));
console.log(JSON.stringify({
  status: output.status,
  observedAt,
  walletMode,
  requestedWrappers: results.length,
  roundTripRoutes: roundTrips.length,
  routes: results.map(({ underlyingTicker, tokenSymbol, status, latencyMs, attempts, reason, exitReason }) => ({ underlyingTicker, tokenSymbol, status, latencyMs, attempts, ...(reason ? { reason } : {}), ...(exitReason ? { exitReason } : {}) })),
  comparisons,
  evidenceRoot: evidence.evidenceRoot,
  evidenceFile: "evidence/live/quote-discovery.json"
}, null, 2));
if (!roundTrips.length) process.exitCode = 2;
