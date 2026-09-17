import test from "node:test";
import assert from "node:assert/strict";
import { compareEconomicEquivalence, buildEconomicFingerprint } from "../src/equivalence.js";
import { evaluateContinuity } from "../src/policy.js";
import { signCredential, verifyCredential } from "../src/credential.js";
import { buildPassport } from "../src/verifier.js";
import {
  demoAccount,
  sampleCredential,
  sampleEconomic,
  sampleExecution,
  sampleMandate,
  sampleRights,
  sampleSnapshot
} from "../src/sample.js";

const nowSeconds = Math.floor(Date.parse("2026-09-17T12:00:00.000Z") / 1000);

test("healthy position remains protected", () => {
  const decision = evaluateContinuity({
    snapshot: sampleSnapshot,
    economic: sampleEconomic,
    rights: sampleRights,
    mandate: sampleMandate,
    positionUsd: 21.34,
    proposedTradeUsd: 5,
    proposedSlippageBps: 24,
    nowSeconds
  });
  assert.equal(decision.state, "PROTECTED");
  assert.equal(decision.reasons.length, 0);
});

test("premium and exit-liquidity breach requires rescue", () => {
  const snapshot = { ...sampleSnapshot, tokenPriceUsd: sampleSnapshot.underlyingPriceUsd * 1.03, exitLiquidityUsd: 2_000 };
  const economic = buildEconomicFingerprint(snapshot, sampleRights);
  const decision = evaluateContinuity({ snapshot, economic, rights: sampleRights, mandate: sampleMandate, positionUsd: 21.34, nowSeconds });
  assert.equal(decision.state, "RESCUE_REQUIRED");
  assert.ok(decision.reasons.includes("premiumWithinLimit"));
  assert.ok(decision.reasons.includes("exitLiquiditySufficient"));
});

test("missing rights evidence fails closed", () => {
  const rights = { ...sampleRights, sourceStatus: "UNVERIFIED" as const };
  const economic = buildEconomicFingerprint(sampleSnapshot, rights);
  const decision = evaluateContinuity({ snapshot: sampleSnapshot, economic, rights, mandate: sampleMandate, positionUsd: 21.34, nowSeconds });
  assert.equal(decision.state, "BLOCKED");
  assert.ok(decision.reasons.includes("evidenceSufficient"));
});

test("identical economic structures are safely equivalent", () => {
  const result = compareEconomicEquivalence(sampleEconomic, sampleEconomic, sampleRights, sampleRights);
  assert.equal(result.classification, "SAFE_EQUIVALENT");
});

test("rights mismatch prevents automatic equivalence", () => {
  const otherRights = { ...sampleRights, dividendTreatment: "REINVESTED" as const, fingerprintHash: `0x${"88".repeat(32)}` as const };
  const otherEconomic = buildEconomicFingerprint(sampleSnapshot, otherRights);
  const result = compareEconomicEquivalence(sampleEconomic, otherEconomic, sampleRights, otherRights);
  assert.equal(result.classification, "PARTIAL_EQUIVALENCE");
});

test("credential is EIP-712 signed and time bounded", async () => {
  const credential = sampleCredential(nowSeconds);
  const signed = await signCredential(credential, demoAccount);
  const verification = await verifyCredential({ signed, expectedSigner: demoAccount.address, nowSeconds: nowSeconds + 10 });
  assert.equal(verification.valid, true);
  const expired = await verifyCredential({ signed, expectedSigner: demoAccount.address, nowSeconds: nowSeconds + 301 });
  assert.equal(expired.valid, false);
  assert.ok(expired.reasons.includes("credential_expired"));
});

test("tampered calldata creates a challenge passport", () => {
  const passport = buildPassport(sampleExecution({ executedCalldataHash: `0x${"ef".repeat(32)}` }));
  assert.equal(passport.state, "CHALLENGED");
  assert.ok(passport.verification.reasons.includes("calldataBound"));
});

test("correctly bound execution receives PASS", () => {
  const passport = buildPassport(sampleExecution());
  assert.equal(passport.state, "PROTECTED");
  assert.equal(passport.verification.result, "PASS");
});
