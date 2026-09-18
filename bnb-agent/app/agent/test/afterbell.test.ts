import assert from "node:assert/strict";
import test from "node:test";
import { inspectAfterBellPosition, inspectAfterBellWorkPrompt } from "../src/afterbell.js";

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

test("ERC-8183 funded-job prompt unwraps the signed task description", () => {
  const signedTask = request();
  const runtimePrompt = [
    "You accepted and were paid for the following job. Produce the deliverable now. Be complete and self-contained.",
    "",
    "JOB CONTEXT:",
    JSON.stringify({
      task: signedTask,
      terms: {
        deliverables: "afterbell-watchtower-result/1 JSON",
        quality_standards: "deterministic fail-closed policy"
      }
    })
  ].join("\n");
  const result = inspect(runtimePrompt);
  assert.equal(result.state, "PROTECTED");
  assert.equal(result.financialTransactionCreated, false);
  assert.equal(result.signingRequested, false);
});

test("malformed paid task fails closed instead of stranding the funded job", () => {
  const result = JSON.parse(inspectAfterBellWorkPrompt(
    "You accepted and were paid for the following job.\n\nJOB CONTEXT:\n" +
    JSON.stringify({ task: JSON.stringify({ asset: "AAPLx" }), terms: {} })
  )) as Record<string, unknown>;
  assert.equal(result.state, "BLOCKED");
  assert.deepEqual(result.reasons, ["invalidTaskPayload"]);
  assert.equal(result.financialTransactionCreated, false);
  assert.equal(result.signingRequested, false);
});

test("ERC-8183 SDK tuple-style arrays are normalized outside strings", () => {
  const tupleTask = request()
    .replace('"requiredRights":["dividend","redemption","one-to-one-backing"]', '"requiredRights":("dividend","redemption","one-to-one-backing")')
    .replace('"allowedPlatforms":["Ondo"]', '"allowedPlatforms":("Ondo")');
  const runtimePrompt = "Paid job\n\nJOB CONTEXT:\n" + JSON.stringify({ task: tupleTask, terms: {} });
  const result = JSON.parse(inspectAfterBellWorkPrompt(runtimePrompt)) as Record<string, unknown>;
  assert.equal(result.state, "PROTECTED");
  assert.equal(result.financialTransactionCreated, false);
});
