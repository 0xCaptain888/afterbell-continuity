import { sha256, stableJson } from "./canonical.js";
import type { Hex, MarketStatus, Platform } from "./types.js";

export type RwaTokenRecord = {
  binanceChainId: string;
  tokenContractAddress: `0x${string}`;
  platformId: "ondo" | "bstock";
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  underlyingTicker: string;
  underlyingName: string;
  tokenToShareRatio: string;
  tokenPrice: string;
  referencePrice: string;
  volume24H?: string;
  marketCap?: string;
  statusInfo?: {
    openState?: boolean;
    marketStatus?: string;
    reasonCode?: string | null;
    reasonMsg?: string | null;
    nextOpenTime?: number | null;
    nextCloseTime?: number | null;
  };
};

type ApiEnvelope<T> = { code: number; msg: string; data: T; timestamp: number; success: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === "string" ? value[key] : undefined;
}

export function unwrapApiData<T>(value: unknown): T {
  if (!isRecord(value) || typeof value.code !== "number" || !("data" in value)) {
    throw new Error("invalid_binance_api_envelope");
  }
  const envelope = value as ApiEnvelope<T>;
  if (envelope.code !== 0 || envelope.success === false) {
    throw new Error(`binance_api_error_${envelope.code}:${envelope.msg}`);
  }
  return envelope.data;
}

export function parseRwaTokenRecords(value: unknown): RwaTokenRecord[] {
  const data = unwrapApiData<unknown>(value);
  if (!Array.isArray(data)) throw new Error("invalid_rwa_token_list");
  return data.flatMap((item) => {
    if (!isRecord(item)) return [];
    const chainId = stringField(item, "binanceChainId");
    const address = stringField(item, "tokenContractAddress");
    const platform = stringField(item, "platformId");
    const symbol = stringField(item, "tokenSymbol");
    const ticker = stringField(item, "underlyingTicker");
    const ratio = stringField(item, "tokenToShareRatio");
    const tokenPrice = stringField(item, "tokenPrice");
    const referencePrice = stringField(item, "referencePrice");
    if (!chainId || !address?.match(/^0x[0-9a-fA-F]{40}$/) || !["ondo", "bstock"].includes(platform ?? "") || !symbol || !ticker || !ratio || !tokenPrice || !referencePrice) return [];
    const record: RwaTokenRecord = {
      binanceChainId: chainId,
      tokenContractAddress: address as `0x${string}`,
      platformId: platform as "ondo" | "bstock",
      tokenName: stringField(item, "tokenName") ?? symbol,
      tokenSymbol: symbol,
      decimals: typeof item.decimals === "number" ? item.decimals : 18,
      underlyingTicker: ticker,
      underlyingName: stringField(item, "underlyingName") ?? ticker,
      tokenToShareRatio: ratio,
      tokenPrice,
      referencePrice
    };
    const volume24H = stringField(item, "volume24H");
    const marketCap = stringField(item, "marketCap");
    if (volume24H) record.volume24H = volume24H;
    if (marketCap) record.marketCap = marketCap;
    if (isRecord(item.statusInfo)) {
      const statusInfo: NonNullable<RwaTokenRecord["statusInfo"]> = {};
      if (typeof item.statusInfo.openState === "boolean") statusInfo.openState = item.statusInfo.openState;
      if (typeof item.statusInfo.marketStatus === "string") statusInfo.marketStatus = item.statusInfo.marketStatus;
      if (typeof item.statusInfo.reasonCode === "string" || item.statusInfo.reasonCode === null) statusInfo.reasonCode = item.statusInfo.reasonCode;
      if (typeof item.statusInfo.reasonMsg === "string" || item.statusInfo.reasonMsg === null) statusInfo.reasonMsg = item.statusInfo.reasonMsg;
      if (typeof item.statusInfo.nextOpenTime === "number" || item.statusInfo.nextOpenTime === null) statusInfo.nextOpenTime = item.statusInfo.nextOpenTime;
      if (typeof item.statusInfo.nextCloseTime === "number" || item.statusInfo.nextCloseTime === null) statusInfo.nextCloseTime = item.statusInfo.nextCloseTime;
      record.statusInfo = statusInfo;
    }
    return [record];
  });
}

export type RankedRwaCandidate = RwaTokenRecord & {
  premiumBps: number;
  score: number;
  reasons: string[];
  sourcePayloadHash: Hex;
};

function finiteNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function rankRwaCandidates(records: RwaTokenRecord[]): RankedRwaCandidate[] {
  return records.map((record) => {
    const tokenPrice = finiteNumber(record.tokenPrice) ?? 0;
    const referencePrice = finiteNumber(record.referencePrice) ?? 0;
    const volume = finiteNumber(record.volume24H) ?? 0;
    const ratio = finiteNumber(record.tokenToShareRatio) ?? 0;
    const expectedTokenPrice = referencePrice * ratio;
    const premiumBps = expectedTokenPrice > 0 ? Math.round(((tokenPrice / expectedTokenPrice) - 1) * 10_000) : 1_000_000;
    const reasons: string[] = [];
    let score = 0;
    if (record.binanceChainId === "56") { score += 25; reasons.push("bsc_mainnet"); }
    if (record.statusInfo?.openState) { score += 15; reasons.push("underlying_market_open"); }
    if (Math.abs(premiumBps) <= 100) { score += 20; reasons.push("premium_within_100bps"); }
    else if (Math.abs(premiumBps) <= 250) { score += 8; reasons.push("premium_within_250bps"); }
    if (volume >= 1_000_000) { score += 20; reasons.push("reported_volume_over_1m"); }
    else if (volume > 0) { score += 8; reasons.push("reported_volume_present"); }
    if (ratio > 0) { score += 10; reasons.push("share_ratio_present"); }
    if (record.platformId === "bstock" || record.platformId === "ondo") { score += 10; reasons.push("supported_platform"); }
    return { ...record, premiumBps, score, reasons, sourcePayloadHash: sha256(stableJson(record)) };
  }).sort((a, b) => b.score - a.score || Math.abs(a.premiumBps) - Math.abs(b.premiumBps));
}

export function normalizeMarketStatus(value?: string): MarketStatus {
  switch (value?.toLowerCase()) {
    case "pre_market": return "PRE_MARKET";
    case "regular": return "REGULAR";
    case "after_hours": return "AFTER_HOURS";
    case "closed": return "CLOSED";
    case "halted": return "HALTED";
    default: return "UNKNOWN";
  }
}

export function normalizePlatform(value: string): Platform {
  return value === "bstock" || value === "ondo" ? value : "unknown";
}
