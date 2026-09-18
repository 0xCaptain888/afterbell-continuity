import assert from "node:assert/strict";
import test from "node:test";
import { inspectAfterBellPosition } from "../src/afterbell.js";

type Overrides = {
  snapshot?: Record<string, unknown>;
  rights?: Record<string, unknown>;
  mandate?: Record<string, unknown>;
};

function request(overrides: Overrides = {}): string {
  const now = Date.now();
  return JSON.stringify({
    positionId: "position-001",
    wallet: "0x101fd328a0b2fd9e853909651dab1c0b55947c03",
    amount: 1,
    positionUsd: 100,
    snapshot: {
      chainId: 56,
      tokenAddress: "0x1111111111111111111111111111111111111111",
      symbol: "TSLAB",
      underlying: "TSLA",
      platform: "Ondo",
      tokenToShareRatio: 1,
      tokenPriceUsd: 100,
      underlyingPriceUsd: 100,
      observedAt: new Date(now).toISOString(),
      marketStatus: "REGULAR",
      attestationPublishedAt: new Date(now - 60_000).toISOString(),
      exitLiquidityUsd: 20_000,
      mode: "LIVE",
      ...overrides.snapshot,
    },
    rights: {
      backingModel: "ONE_TO_ONE",
      dividendTreatment: "DISTRIBUTED",
      redemption: "DIRECT",
      sourceStatus: "VERIFIED",
      ...overrides.rights,
    },
    mandate: {
      mandateId: "mandate-001",
      subject: "TSLA",
      maxPositionUsd: 1_000,
      maxPremiumBps: 100,
      maxAttestationAgeSeconds: 3_600,
      minimumExitLiquidityUsd: 10_000,
      requiredRights: ["dividend", "redemption", "one-to-one-backing"],
      allowedPlatforms: ["Ondo"],
      expiresAt: Math.floor(now / 1_000) + 3_600,
      ...overrides.mandate,
    },
  });
}

function inspect(input: string): Record<string, unknown> {
  return JSON.parse(inspectAfterBellPosition(input)) as Record<string, unknown>;
}

test("healthy verified position is protected without signing or a transaction", () => {
  const result = inspect(request());
  assert.equal(result.state, "PROTECTED");
  assert.deepEqual(result.reasons, []);
  assert.equal(result.financialTransactionCreated, false);
  assert.equal(result.signingRequested, false);
  assert.match(String(result.decisionHash), /^0x[0-9a-f]{64}$/);
});

test("near-boundary premium becomes WATCH", () => {
  const result = inspect(request({ snapshot: { tokenPriceUsd: 100.85 } }));
  assert.equal(result.state, "WATCH");
  assert.deepEqual(result.reasons, []);
});

test("premium and exit-liquidity breaches require rescue", () => {
  const result = inspect(request({
    snapshot: { tokenPriceUsd: 105, exitLiquidityUsd: 2_000 },
  }));
  assert.equal(result.state, "RESCUE_REQUIRED");
  assert.deepEqual(result.reasons, ["premiumWithinLimit", "exitLiquiditySufficient"]);
  assert.equal(result.financialTransactionCreated, false);
  assert.equal(result.signingRequested, false);
});

test("unverified rights evidence blocks the position", () => {
  const result = inspect(request({ rights: { sourceStatus: "UNVERIFIED" } }));
  assert.equal(result.state, "BLOCKED");
  assert.deepEqual(result.reasons, ["evidenceSufficient"]);
});

test("invalid buyer JSON is rejected", () => {
  assert.throws(() => inspectAfterBellPosition("not-json"));
  assert.throws(() => inspectAfterBellPosition(JSON.stringify({ positionId: "missing-fields" })));
});
