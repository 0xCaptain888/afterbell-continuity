import assert from "node:assert/strict";
import test from "node:test";
import { calculateExecutableRoundTrip, crossWrapperSpreadBps } from "../src/executable-equivalence.js";
import { buildEconomicFingerprint, compareEconomicEquivalence } from "../src/equivalence.js";
import { assessRightsEvidence, parseUnderlyingMarket, parseUnderlyingProfile } from "../src/rwa-evidence.js";
import { sampleRights, sampleSnapshot } from "../src/sample.js";

const address = "0x1111111111111111111111111111111111111111" as const;
const usdt = "0x2222222222222222222222222222222222222222" as const;

test("authenticated profile disclosures do not invent token-holder rights", () => {
  const profile = parseUnderlyingProfile({ code: 0, success: true, data: {
    binanceChainId: "56", tokenContractAddress: address, platformId: "ondo", underlyingTicker: "TSLA",
    underlyingFullName: "Tesla (Ondo)", assetType: 1, tokenToShareRatio: "1",
    protections: { dailyAttestationReport: { supported: true, url: "https://example.test/report.pdf" } }
  }});
  const market = parseUnderlyingMarket({ code: 0, success: true, data: {
    tokenContractAddress: address, platformId: "ondo",
    statusInfo: { openState: true, marketStatus: "overnight", reasonCode: "TRADING" },
    marketData: { referencePrice: "365.12", dividendYield: "0", latestDividend: "0" }
  }});
  const assessment = assessRightsEvidence({ profile, market, observedAt: "2026-09-18T00:00:00.000Z" });
  assert.equal(market.marketStatus, "OVERNIGHT");
  assert.equal(assessment.rights.backingModel, "UNKNOWN");
  assert.equal(assessment.rights.dividendTreatment, "UNKNOWN");
  assert.deepEqual(assessment.disclosureCoverage.linkedProtectionKinds, ["dailyAttestationReport"]);
});

test("unknown rights never become safe merely because both sides say unknown", () => {
  const unknown = { ...sampleRights, backingModel: "UNKNOWN" as const, dividendTreatment: "UNKNOWN" as const, splitTreatment: "UNKNOWN" as const };
  const economic = buildEconomicFingerprint(sampleSnapshot, unknown);
  const result = compareEconomicEquivalence(economic, economic, unknown, unknown);
  assert.equal(result.classification, "UNKNOWN");
  assert.ok(result.reasons.includes("rights_evidence_incomplete"));
});

test("round-trip quote math normalizes token prices to one underlying share", () => {
  const buy = {
    quoteId: "buy", vendor: "LiquidMesh", fromTokenAddress: usdt, toTokenAddress: address,
    inputAmount: "10000000000000000000", outputAmount: "25000000000000000",
    observedAt: "2026-09-18T00:00:00.000Z", expiresAt: "2026-09-18T00:00:30.000Z", payloadHash: `0x${"11".repeat(32)}` as const
  };
  const sell = {
    quoteId: "sell", vendor: "LiquidMesh", fromTokenAddress: address, toTokenAddress: usdt,
    inputAmount: "25000000000000000", outputAmount: "9900000000000000000",
    observedAt: "2026-09-18T00:00:01.000Z", expiresAt: "2026-09-18T00:00:31.000Z", payloadHash: `0x${"22".repeat(32)}` as const
  };
  const result = calculateExecutableRoundTrip({ buy, sell, stableDecimals: 18, tokenDecimals: 18, tokenToShareRatio: 0.5, inventoryReferencePriceUsd: 800 });
  assert.equal(result.buyPricePerTokenUsd, 400);
  assert.equal(result.buyPricePerShareUsd, 800);
  assert.equal(result.roundTripCostBps, 100);
  assert.equal(crossWrapperSpreadBps(800, 804), 50);
});
