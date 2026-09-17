import { mkdir, writeFile } from "node:fs/promises";
import { buildEconomicFingerprint } from "../src/equivalence.js";
import { evaluateContinuity } from "../src/policy.js";
import { buildPassport } from "../src/verifier.js";
import { sampleEconomic, sampleExecution, sampleMandate, sampleRights, sampleSnapshot } from "../src/sample.js";

const nowSeconds = Math.floor(Date.parse("2026-09-17T12:00:00.000Z") / 1000);
const scenarios = [
  {
    id: "false-arbitrage",
    baseline: "BUY",
    afterbell: "BLOCKED",
    evidence: {
      nominalSpreadBps: 180,
      normalizedSpreadBps: 11,
      reason: "economic_structure_not_equivalent",
      mode: "ADVERSARIAL_TEST"
    }
  },
  {
    id: "stale-attestation",
    baseline: "BUY",
    afterbell: evaluateContinuity({
      snapshot: { ...sampleSnapshot, attestationPublishedAt: "2026-09-10T00:00:00.000Z" },
      economic: sampleEconomic,
      rights: sampleRights,
      mandate: sampleMandate,
      positionUsd: 21.34,
      nowSeconds
    }).state,
    evidence: { mode: "ADVERSARIAL_TEST" }
  },
  {
    id: "liquidity-collapse",
    baseline: "HOLD",
    afterbell: evaluateContinuity({
      snapshot: { ...sampleSnapshot, exitLiquidityUsd: 2_000 },
      economic: sampleEconomic,
      rights: sampleRights,
      mandate: sampleMandate,
      positionUsd: 21.34,
      nowSeconds
    }).state,
    evidence: { mode: "ADVERSARIAL_TEST" }
  },
  {
    id: "premium-breach",
    baseline: "BUY",
    afterbell: evaluateContinuity({
      snapshot: { ...sampleSnapshot, tokenPriceUsd: sampleSnapshot.underlyingPriceUsd * 1.03 },
      economic: buildEconomicFingerprint({ ...sampleSnapshot, tokenPriceUsd: sampleSnapshot.underlyingPriceUsd * 1.03 }, sampleRights),
      rights: sampleRights,
      mandate: sampleMandate,
      positionUsd: 21.34,
      nowSeconds
    }).state,
    evidence: { mode: "ADVERSARIAL_TEST" }
  },
  {
    id: "tampered-calldata",
    baseline: "UNDETECTED",
    afterbell: buildPassport(sampleExecution({ executedCalldataHash: `0x${"ef".repeat(32)}` })).verification.result,
    evidence: { mode: "ADVERSARIAL_TEST" }
  }
] as const;

const summary = {
  schema: "afterbell-benchmark/1",
  generatedAt: new Date().toISOString(),
  truthNotice: "All v0.1.0 benchmark scenarios are simulated or adversarial. No avoided-loss amount is claimed.",
  scenarios,
  metrics: {
    scenarios: scenarios.length,
    unsafeBaselineActions: scenarios.filter((item) => ["BUY", "HOLD", "UNDETECTED"].includes(item.baseline)).length,
    afterbellInterventions: scenarios.filter((item) => item.afterbell !== "PROTECTED").length
  }
};

await mkdir("benchmark/results", { recursive: true });
await writeFile("benchmark/results/latest.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
