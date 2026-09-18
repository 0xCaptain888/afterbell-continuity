import { basisPointsDelta, sha256 } from "./canonical.js";
import type { AssetSnapshot, EconomicFingerprint, EquivalenceResult, RightsFingerprint } from "./types.js";

export function buildEconomicFingerprint(snapshot: AssetSnapshot, rights: RightsFingerprint): EconomicFingerprint {
  const normalizedReferencePriceUsd = snapshot.underlyingPriceUsd * snapshot.tokenToShareRatio;
  const premiumBps = basisPointsDelta(snapshot.tokenPriceUsd, normalizedReferencePriceUsd);
  const confidence =
    rights.sourceStatus === "VERIFIED" && Number.isFinite(premiumBps)
      ? "HIGH"
      : rights.sourceStatus === "PARTIAL"
        ? "MEDIUM"
        : "LOW";
  const structureClass = [snapshot.underlying, rights.backingModel, rights.dividendTreatment, rights.splitTreatment].join(":");
  const partial = {
    underlying: snapshot.underlying,
    tokenAddress: snapshot.tokenAddress,
    economicExposurePerToken: snapshot.tokenToShareRatio,
    normalizedReferencePriceUsd,
    tokenPriceUsd: snapshot.tokenPriceUsd,
    premiumBps,
    structureClass,
    rightsFingerprintHash: rights.fingerprintHash,
    confidence
  } as const;
  return { ...partial, evidenceHash: sha256({ snapshot, rights, partial }) };
}

export function compareEconomicEquivalence(
  left: EconomicFingerprint,
  right: EconomicFingerprint,
  leftRights: RightsFingerprint,
  rightRights: RightsFingerprint,
  toleranceBps = 25
): EquivalenceResult {
  const reasons: string[] = [];
  if (left.underlying !== right.underlying) reasons.push("different_underlying");
  const ratioDeltaBps = Math.abs(basisPointsDelta(left.economicExposurePerToken, right.economicExposurePerToken));
  if (ratioDeltaBps > toleranceBps) reasons.push("share_ratio_mismatch");

  const rightsComplete =
    leftRights.backingModel !== "UNKNOWN" &&
    leftRights.dividendTreatment !== "UNKNOWN" &&
    leftRights.splitTreatment !== "UNKNOWN";
  const rightsCompatible = rightsComplete &&
    leftRights.backingModel === rightRights.backingModel &&
    leftRights.dividendTreatment === rightRights.dividendTreatment &&
    leftRights.splitTreatment === rightRights.splitTreatment;
  if (!rightsComplete || rightRights.backingModel === "UNKNOWN" || rightRights.dividendTreatment === "UNKNOWN" || rightRights.splitTreatment === "UNKNOWN") {
    reasons.push("rights_evidence_incomplete");
  } else if (!rightsCompatible) reasons.push("rights_structure_mismatch");

  if (left.confidence === "LOW" || right.confidence === "LOW") {
    return { classification: "UNKNOWN", reasons: [...reasons, "insufficient_evidence"], ratioDeltaBps, rightsCompatible };
  }
  if (reasons.includes("different_underlying") || reasons.includes("share_ratio_mismatch")) {
    return { classification: "NOT_EQUIVALENT", reasons, ratioDeltaBps, rightsCompatible };
  }
  if (reasons.includes("rights_evidence_incomplete")) return { classification: "UNKNOWN", reasons, ratioDeltaBps, rightsCompatible };
  if (!rightsCompatible) return { classification: "PARTIAL_EQUIVALENCE", reasons, ratioDeltaBps, rightsCompatible };
  return { classification: "SAFE_EQUIVALENT", reasons, ratioDeltaBps, rightsCompatible };
}
