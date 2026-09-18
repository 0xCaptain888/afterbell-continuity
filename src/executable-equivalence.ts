import type { QuoteEvidence } from "./trading-evidence.js";

export type ExecutableRoundTrip = {
  inputUsd: number;
  tokenOutput: number;
  returnedUsd: number;
  buyPricePerTokenUsd: number;
  sellPricePerTokenUsd: number;
  buyPricePerShareUsd: number;
  sellPricePerShareUsd: number;
  roundTripCostBps: number;
  inventoryReferencePriceUsd: number;
  executableBuyPremiumBps: number;
  executableSellDiscountBps: number;
};

function units(value: string, decimals: number): number {
  if (!/^\d+$/.test(value) || decimals < 0 || !Number.isInteger(decimals)) throw new Error("invalid_token_units");
  return Number(BigInt(value)) / 10 ** decimals;
}

function deltaBps(value: number, reference: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(reference) || reference <= 0) return 1_000_000;
  return Math.round(((value / reference) - 1) * 10_000);
}

export function calculateExecutableRoundTrip(input: {
  buy: QuoteEvidence;
  sell: QuoteEvidence;
  stableDecimals: number;
  tokenDecimals: number;
  tokenToShareRatio: number;
  inventoryReferencePriceUsd: number;
}): ExecutableRoundTrip {
  const inputUsd = units(input.buy.inputAmount, input.stableDecimals);
  const tokenOutput = units(input.buy.outputAmount, input.tokenDecimals);
  const soldTokens = units(input.sell.inputAmount, input.tokenDecimals);
  const returnedUsd = units(input.sell.outputAmount, input.stableDecimals);
  if (inputUsd <= 0 || tokenOutput <= 0 || soldTokens <= 0 || returnedUsd <= 0 || input.tokenToShareRatio <= 0) {
    throw new Error("invalid_round_trip_amounts");
  }
  const buyPricePerTokenUsd = inputUsd / tokenOutput;
  const sellPricePerTokenUsd = returnedUsd / soldTokens;
  const buyPricePerShareUsd = buyPricePerTokenUsd / input.tokenToShareRatio;
  const sellPricePerShareUsd = sellPricePerTokenUsd / input.tokenToShareRatio;
  return {
    inputUsd,
    tokenOutput,
    returnedUsd,
    buyPricePerTokenUsd,
    sellPricePerTokenUsd,
    buyPricePerShareUsd,
    sellPricePerShareUsd,
    roundTripCostBps: Math.round((1 - returnedUsd / inputUsd) * 10_000),
    inventoryReferencePriceUsd: input.inventoryReferencePriceUsd,
    executableBuyPremiumBps: deltaBps(buyPricePerShareUsd, input.inventoryReferencePriceUsd),
    executableSellDiscountBps: deltaBps(sellPricePerShareUsd, input.inventoryReferencePriceUsd)
  };
}

export function crossWrapperSpreadBps(left: number, right: number): number {
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return 1_000_000;
  return Math.round(Math.abs(left - right) / ((left + right) / 2) * 10_000);
}
