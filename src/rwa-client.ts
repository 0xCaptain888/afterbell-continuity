import { createHmac } from "node:crypto";
import { sha256, stableJson } from "./canonical.js";
import type { AssetSnapshot, Hex, MarketStatus, Platform } from "./types.js";

export type BinanceWeb3Credentials = {
  apiKey: string;
  secretKey: string;
};

type RequestOptions = {
  method?: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export class BinanceRwaClient {
  constructor(
    private readonly credentials: BinanceWeb3Credentials,
    private readonly baseUrl = "https://api.binance.com"
  ) {}

  private async request<T>(options: RequestOptions): Promise<T> {
    const method = options.method ?? "GET";
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }
    const queryString = query.toString();
    const requestPath = `${options.path}${queryString ? `?${queryString}` : ""}`;
    const body = options.body === undefined ? "" : JSON.stringify(options.body);
    const timestamp = new Date().toISOString();
    const prehash = `${timestamp}${method}${requestPath}${body}`;
    const signature = createHmac("sha256", this.credentials.secretKey).update(prehash).digest("base64");
    const response = await fetch(`${this.baseUrl}${requestPath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-OC-TIMESTAMP": timestamp,
        "X-OC-APIKEY": this.credentials.apiKey,
        "X-OC-SIGN": signature
      },
      ...(body ? { body } : {})
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Binance Web3 API ${response.status}: ${text.slice(0, 500)}`);
    return JSON.parse(text) as T;
  }

  listPlatforms() {
    return this.request<unknown>({ path: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/rwa/platform/list" });
  }

  listAssets(platformId: "ondo" | "bstock", page = 1, size = 100) {
    return this.request<unknown>({
      path: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/rwa/tokenized-stock/list",
      query: { platformId, page, size }
    });
  }

  getPrice(platformId: "ondo" | "bstock", tokenId: string) {
    return this.request<unknown>({
      path: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/rwa/tokenized-stock/price",
      query: { platformId, tokenId }
    });
  }

  getUnderlying(platformId: "ondo" | "bstock", underlyingId: string) {
    return this.request<unknown>({
      path: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/rwa/underlying/info",
      query: { platformId, underlyingId }
    });
  }

  getMarketStatus(platformId: "ondo" | "bstock", underlyingId: string) {
    return this.request<unknown>({
      path: "/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/rwa/underlying/market-status",
      query: { platformId, underlyingId }
    });
  }
}

export type NormalizedRwaInput = {
  chainId: number;
  tokenAddress: `0x${string}`;
  symbol: string;
  underlying: string;
  platform: Platform;
  tokenToShareRatio: number;
  tokenPriceUsd: number;
  underlyingPriceUsd: number;
  observedAt: string;
  marketStatus: MarketStatus;
  attestationPublishedAt?: string;
  attestationUrl?: string;
  exitLiquidityUsd?: number;
  exitPriceImpactBps?: number;
  rawPayload: unknown;
  source: string;
  mode: AssetSnapshot["mode"];
};

export function normalizeRwaSnapshot(input: NormalizedRwaInput): AssetSnapshot {
  const { rawPayload, ...snapshot } = input;
  return { ...snapshot, sourcePayloadHash: sha256(stableJson(rawPayload)) as Hex };
}
