import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceArtifact, verifyEvidenceArtifact } from "../src/evidence.js";

test("evidence artifacts detect payload tampering", () => {
  const artifact = createEvidenceArtifact({
    artifactType: "RWA_INVENTORY",
    mode: "LIVE",
    observedAt: "2026-09-18T00:00:00.000Z",
    source: "Binance Web3 RWA Data API",
    payload: { assets: 42 }
  });
  assert.equal(verifyEvidenceArtifact(artifact), true);
  assert.equal(verifyEvidenceArtifact({ ...artifact, payload: { assets: 43 } }), false);
});
