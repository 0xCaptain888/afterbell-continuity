import { sha256 } from "./canonical.js";
import type { Hex, Platform, RightsFingerprint } from "./types.js";

export function buildRightsFingerprint(input: Omit<RightsFingerprint, "fingerprintHash">): RightsFingerprint {
  return { ...input, fingerprintHash: sha256(input) };
}

export function conservativeRights(input: {
  underlying: string;
  platform: Platform;
  sourceVersion: string;
  sourceHashes: Hex[];
}): RightsFingerprint {
  return buildRightsFingerprint({
    ...input,
    backingModel: "UNKNOWN",
    dividendTreatment: "UNKNOWN",
    splitTreatment: "UNKNOWN",
    votingRights: "UNKNOWN",
    redemption: "UNKNOWN",
    sourceStatus: "UNVERIFIED"
  });
}
