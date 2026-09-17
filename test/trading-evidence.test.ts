import assert from "node:assert/strict";
import test from "node:test";
import { extractEvmTransaction, extractQuoteEvidence, extractSimulationSuccess } from "../src/trading-evidence.js";

const from = "0x1111111111111111111111111111111111111111" as const;
const toToken = "0x2222222222222222222222222222222222222222" as const;

test("quote evidence binds amounts, expiry, and raw payload", () => {
  const quote = extractQuoteEvidence({
    response: { code: 0, data: { quotes: [{ quoteId: "q-1", vendor: "LiquidMesh", toTokenAmount: "99" }] } },
    fromTokenAddress: from,
    toTokenAddress: toToken,
    inputAmount: "100",
    observedAt: "2026-09-18T00:00:00.000Z",
    ttlSeconds: 30
  });
  assert.equal(quote.quoteId, "q-1");
  assert.equal(quote.expiresAt, "2026-09-18T00:00:30.000Z");
  assert.match(quote.payloadHash, /^0x[0-9a-f]{64}$/);
});

test("swap extractor distinguishes EVM transaction from RFQ signing", () => {
  assert.deepEqual(extractEvmTransaction({ data: { tx: { to: toToken, data: "0x1234", value: "0" } } }, from), {
    from, to: toToken, value: "0", data: "0x1234"
  });
  assert.deepEqual(extractEvmTransaction({ data: { executionMode: "RFQ", rfq: { typedDataToSign: { domain: {} } } } }, from), {
    rfq: true, signingPayload: { domain: {} }
  });
});

test("simulation parser fails closed for unknown status", () => {
  assert.equal(extractSimulationSuccess({ data: { executionStatus: "SUCCESS" } }).success, true);
  assert.equal(extractSimulationSuccess({ data: { status: "SUCCESS", failReason: "execution reverted" } }).success, false);
  assert.equal(extractSimulationSuccess({ data: { executionStatus: "UNKNOWN" } }).success, false);
});
