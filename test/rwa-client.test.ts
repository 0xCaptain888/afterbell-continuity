import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { BinanceWeb3Client, buildSignedRequest } from "../src/rwa-client.js";
import { parseRwaTokenRecords, rankContinuityPairs, rankRwaCandidates } from "../src/inventory.js";

const credentials = { apiKey: "public-test-key", secretKey: "secret-test-key" };

test("signed requests bind method, /build path, query, and body", () => {
  const signed = buildSignedRequest({
    credentials,
    method: "POST",
    path: "/api/v1/dex/pre-transaction/simulate",
    body: { binanceChainId: "56", evmTx: { from: "0x1", to: "0x2", value: "0", data: "0x" } },
    timestamp: "2026-09-18T00:00:00.000Z",
    nonce: "fixed-nonce"
  });
  const expectedPrehash = `2026-09-18T00:00:00.000ZPOST/build/api/v1/dex/pre-transaction/simulate${signed.body}`;
  assert.equal(signed.prehash, expectedPrehash);
  assert.equal(signed.headers["X-OC-SIGN"], createHmac("sha256", credentials.secretKey).update(expectedPrehash).digest("base64"));
  assert.equal(signed.headers["X-OC-NONCE"], "fixed-nonce");
});

test("client signs the exact requested query and rejects business errors", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;
  const okFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedHeaders = init?.headers;
    return new Response(JSON.stringify({ code: 0, msg: "success", data: [], timestamp: 1, success: true }), { status: 200 });
  };
  const client = new BinanceWeb3Client(credentials, "https://web3.binance.com/build", {
    fetch: okFetch,
    now: () => new Date("2026-09-18T00:00:00.000Z"),
    nonce: () => "fixed-nonce"
  });
  await client.listAssets("bstock", "56");
  assert.equal(capturedUrl, "https://web3.binance.com/build/api/v1/dex/market/rwa/tokens?platformId=bstock&binanceChainId=56");
  assert.equal((capturedHeaders as Record<string, string>)["X-OC-APIKEY"], credentials.apiKey);

  const errorClient = new BinanceWeb3Client(credentials, "https://web3.binance.com/build", {
    fetch: async () => new Response(JSON.stringify({ code: 4001, msg: "bad request", data: null, timestamp: 1, success: false }), { status: 200 })
  });
  await assert.rejects(() => errorClient.listPlatforms(), /business error 4001/);
});

test("client exposes the underlying transport failure without leaking credentials", async () => {
  const client = new BinanceWeb3Client(credentials, "https://web3.binance.com/build", {
    fetch: async () => { throw Object.assign(new Error("fetch failed"), { cause: { code: "ETIMEDOUT" } }); }
  });
  await assert.rejects(() => client.listPlatforms(), /network error: ETIMEDOUT/);
});

test("inventory parser rejects malformed rows and ranks executable BSC candidates", () => {
  const payload = {
    code: 0,
    msg: "success",
    success: true,
    timestamp: 1,
    data: [
      {
        binanceChainId: "56",
        tokenContractAddress: "0x1111111111111111111111111111111111111111",
        platformId: "bstock",
        assetType: 1,
        tokenName: "NVIDIA tokenized stock",
        tokenSymbol: "NVDAB",
        decimals: 18,
        underlyingTicker: "NVDA",
        underlyingName: "NVIDIA",
        tokenToShareRatio: "1",
        tokenPrice: "100.50",
        referencePrice: "100.00",
        volume24H: "1200000",
        statusInfo: { openState: true, marketStatus: "regular", reasonCode: "TRADING" }
      },
      { platformId: "bstock", tokenSymbol: "BROKEN" }
    ]
  };
  const parsed = parseRwaTokenRecords(payload);
  assert.equal(parsed.length, 1);
  const ranked = rankRwaCandidates(parsed);
  assert.equal(ranked[0]?.score, 96);
  assert.equal(ranked[0]?.premiumBps, 50);
  assert.match(ranked[0]?.sourcePayloadHash ?? "", /^0x[0-9a-f]{64}$/);
});

test("continuity pair ranking compares normalized exposure across wrappers", () => {
  const base = {
    binanceChainId: "56",
    assetType: 1,
    tokenName: "NVIDIA tokenized stock",
    decimals: 18,
    underlyingTicker: "NVDA",
    underlyingName: "NVIDIA",
    volume24H: "2000000000",
    statusInfo: { openState: true, reasonCode: "TRADING" }
  } as const;
  const pairs = rankContinuityPairs([
    { ...base, tokenContractAddress: "0x1111111111111111111111111111111111111111", platformId: "bstock", tokenSymbol: "NVDAB", tokenToShareRatio: "1", tokenPrice: "219.40", referencePrice: "219.40" },
    { ...base, tokenContractAddress: "0x2222222222222222222222222222222222222222", platformId: "ondo", tokenSymbol: "NVDAon", tokenToShareRatio: "1.001", tokenPrice: "219.62", referencePrice: "219.40" }
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.underlyingTicker, "NVDA");
  assert.ok((pairs[0]?.normalizedSpreadBps ?? 999) <= 1);
  assert.equal(pairs[0]?.ratioDeltaBps, 10);
});
