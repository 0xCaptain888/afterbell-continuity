import { mkdir, writeFile } from "node:fs/promises";
import { ContinuityWatchtower } from "../src/watchtower.js";
import { sampleMandate, sampleRights, sampleSnapshot } from "../src/sample.js";

const watchtower = new ContinuityWatchtower();
const healthy = watchtower.inspect({
  positionId: "judge-position-1",
  wallet: sampleMandate.owner,
  amount: 0.12,
  positionUsd: 21.34,
  snapshot: sampleSnapshot,
  rights: sampleRights,
  mandate: sampleMandate
}, "2026-09-17T12:00:00.000Z");

const degraded = watchtower.inspect({
  positionId: "judge-position-1",
  wallet: sampleMandate.owner,
  amount: 0.12,
  positionUsd: 21.34,
  snapshot: { ...sampleSnapshot, tokenPriceUsd: sampleSnapshot.underlyingPriceUsd * 1.03, exitLiquidityUsd: 2_000 },
  rights: sampleRights,
  mandate: sampleMandate
}, "2026-09-17T12:05:00.000Z");

const output = {
  schema: "afterbell-watchtower/1",
  truthNotice: "SIMULATED state transition; no live monitor or mainnet action is claimed.",
  events: [healthy, degraded]
};
await mkdir("evidence", { recursive: true });
await writeFile("evidence/watchtower-run.json", JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
