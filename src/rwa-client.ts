import { createHmac, randomUUID } from "node:crypto";
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

type ClientOptions = {
  fetch?: typeof fetch;
  now?: () => Date;
  nonce?: () => string;
  receiveWindowMs?: number;
};

export type BinanceApiEnvelope<T> = {
  code: number;
  msg: string;
  data: T;
  timestamp: number;
  success: boolean;
};

export function buildSignedRequest(input: {
  credentials: BinanceWeb3Credentials;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  timestamp: string;
  nonce: string;
  receiveWindowMs?: number;
}) {
  const queryString = Object.entries(input.query ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  const requestPath = `${input.path}${queryString ? `?${queryString}` : ""}`;
  const body = input.body === undefined ? "" : JSON.stringify(input.body);
  const signedRequestPath = `/build${requestPath}`;
  const prehash = `${input.timestamp}${input.method}${signedRequestPath}${body}`;
  const signature = createHmac("sha256", input.credentials.secretKey).update(prehash).digest("base64");
  return {
    requestPath,
    body,
    prehash,
    headers: {
      "Content-Type": "application/json",
      "X-OC-TIMESTAMP": input.timestamp,
      "X-OC-APIKEY": input.credentials.apiKey,
      "X-OC-SIGN": signature,
      "X-OC-RECV-WINDOW": String(input.receiveWindowMs ?? 10_000),
      "X-OC-NONCE": input.nonce
    }
  };
}

export class BinanceWeb3Client {
  private readonly requestFetch: typeof fetch;
  private readonly now: () => Date;
  private readonly nonce: () => string;
  private readonly receiveWindowMs: number;

  constructor(
    private readonly credentials: BinanceWeb3Credentials,
    private readonly baseUrl = "https://web3.binance.com/build",
    options: ClientOptions = {}
  ) {
    this.requestFetch = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.nonce = options.nonce ?? randomUUID;
    this.receiveWindowMs = options.receiveWindowMs ?? 10_000;
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const method = options.method ?? "GET";
    const signed = buildSignedRequest({
      credentials: this.credentials,
      method,
      path: options.path,
      ...(options.query ? { query: options.query } : {}),
      ...(options.body !== undefined ? { body: options.body } : {}),
      timestamp: this.now().toISOString(),
      nonce: this.nonce(),
      receiveWindowMs: this.receiveWindowMs
    });
    const response = await this.requestFetch(`${this.baseUrl}${signed.requestPath}`, {
      method,
      headers: signed.headers,
      ...(signed.body ? { body: signed.body } : {})
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Binance Web3 API ${response.status}: ${text.slice(0, 500)}`);
    const parsed = JSON.parse(text) as T | BinanceApiEnvelope<unknown>;
    if (typeof parsed === "object" && parsed !== null && "code" in parsed) {
      const envelope = parsed as BinanceApiEnvelope<unknown>;
      if (envelope.code !== 0 || envelope.success === false) {
        throw new Error(`Binance Web3 API business error ${envelope.code}: ${envelope.msg}`);
      }
    }
    return parsed as T;
  }

  listPlatforms() {
    return this.request<unknown>({ path: "/api/v1/dex/market/rwa/platforms" });
  }

  listAssets(platformId: "ondo" | "bstock", binanceChainId = "56") {
    return this.request<unknown>({
      path: "/api/v1/dex/market/rwa/tokens",
      query: { platformId, binanceChainId }
    });
  }

  searchAssets(keyword: string, platformId?: "ondo" | "bstock") {
    return this.request<unknown>({
      path: "/api/v1/dex/market/rwa/search",
      query: { keyword, platformId }
    });
  }

  getPrice(tokenContractAddresses: string, binanceChainId = "56") {
    return this.request<unknown>({
      path: "/api/v1/dex/market/rwa/price",
      query: { binanceChainId, tokenContractAddresses }
    });
  }

  getUnderlying(tokenContractAddress: string, binanceChainId = "56") {
    return this.request<unknown>({
      path: "/api/v1/dex/market/rwa/underlying-profile",
      query: { binanceChainId, tokenContractAddress }
    });
  }

  getMarketStatus(tokenContractAddress: string, binanceChainId = "56") {
    return this.request<unknown>({
      path: "/api/v1/dex/market/rwa/underlying-market",
      query: { binanceChainId, tokenContractAddress }
    });
  }

  getWalletBalances(address: string, chains = "56", page = 1, pageSize = 100) {
    return this.request<unknown>({
      path: "/api/v1/dex/balance/all-token-balances-by-address",
      query: { address, chains, excludeRiskToken: "true", page, pageSize }
    });
  }

  getQuote(input: {
    amount: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    userWalletAddress: string;
    binanceChainId?: string;
    vendor?: "LiquidMesh" | "Pancake" | "Jupiter";
  }) {
    return this.request<unknown>({
      path: "/api/v1/dex/aggregator/quote",
      query: { binanceChainId: "56", ...input }
    });
  }

  getApproveTransaction(input: {
    tokenContractAddress: string;
    approveAmount: string;
    vendor?: string;
    binanceChainId?: string;
  }) {
    return this.request<unknown>({
      path: "/api/v1/dex/aggregator/approve-transaction",
      query: { binanceChainId: "56", ...input }
    });
  }

  buildSwap(input: {
    amount: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    userWalletAddress: string;
    quoteId: string;
    slippagePercent?: string;
    autoSlippage?: "true" | "false";
    approveTransaction?: "true" | "false";
    approveAmount?: string;
    binanceChainId?: string;
  }) {
    return this.request<unknown>({
      path: "/api/v1/dex/aggregator/swap",
      query: { binanceChainId: "56", ...input }
    });
  }


  submitRfqOrder(input: {
    quoteId: string;
    signature: Hex;
    vendor: string;
    binanceChainId?: string;
  }) {
    return this.request<unknown>({
      method: "POST",
      path: "/api/v1/dex/aggregator/rfq/order",
      body: { binanceChainId: "56", ...input }
    });
  }

  simulateEvmTransaction(input: {
    from: string;
    to: string;
    value: string;
    data: string;
    binanceChainId?: string;
  }) {
    const { binanceChainId = "56", ...evmTx } = input;
    return this.request<unknown>({
      method: "POST",
      path: "/api/v1/dex/pre-transaction/simulate",
      body: { binanceChainId, evmTx }
    });
  }
}

export { BinanceWeb3Client as BinanceRwaClient };

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
