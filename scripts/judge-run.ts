import { writeFile, mkdir } from "node:fs/promises";
import { buildEconomicFingerprint, compareEconomicEquivalence } from "../src/equivalence.js";
import { evaluateContinuity } from "../src/policy.js";
import { buildPassport } from "../src/verifier.js";
import { sampleEconomic, sampleExecution, sampleMandate, sampleRights, sampleSnapshot } from "../src/sample.js";

const nowSeconds = Math.floor(Date.parse("2026-09-17T12:00:00.000Z") / 1000);
const safe = evaluateContinuity({
  snapshot: sampleSnapshot,
  economic: sampleEconomic,
  rights: sampleRights,
  mandate: sampleMandate,
  positionUsd: 21.34,
  proposedTradeUsd: 5,
  proposedSlippageBps: 24,
  nowSeconds
});

const unhealthySnapshot = {
  ...sampleSnapshot,
  tokenPriceUsd: sampleSnapshot.underlyingPriceUsd * 1.035,
  exitLiquidityUsd: 4_000
};
const unhealthyEconomic = buildEconomicFingerprint(unhealthySnapshot, sampleRights);
const rescue = evaluateContinuity({
  snapshot: unhealthySnapshot,
  economic: unhealthyEconomic,
  rights: sampleRights,
  mandate: sampleMandate,
  positionUsd: 21.34,
  nowSeconds
});

const tamperedPassport = buildPassport(sampleExecution({ executedCalldataHash: `0x${"ef".repeat(32)}` }), "2026-09-17T12:00:01.000Z");
const result = {
  schema: "afterbell-judge-run/1",
  generatedAt: new Date().toISOString(),
  truthNotice: "This baseline run uses SIMULATED and ADVERSARIAL_TEST data. No mainnet transaction is claimed.",
  stages: {
    safe,
    rescue,
    equivalence: compareEconomicEquivalence(sampleEconomic, sampleEconomic, sampleRights, sampleRights),
    tamperedExecution: tamperedPassport.verification
  }
};

await mkdir("evidence", { recursive: true });
await writeFile("evidence/judge-run.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
