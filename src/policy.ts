import { ageSeconds, sha256 } from "./canonical.js";
import type { AssetSnapshot, ContinuityMandate, EconomicFingerprint, PolicyDecision, RightsFingerprint } from "./types.js";

export function evaluateContinuity(input: {
  snapshot: AssetSnapshot;
  economic: EconomicFingerprint;
  rights: RightsFingerprint;
  mandate: ContinuityMandate;
  positionUsd: number;
  proposedTradeUsd?: number;
  proposedSlippageBps?: number;
  dailySpendUsd?: number;
  nowSeconds?: number;
}): PolicyDecision {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const mandateHash = sha256(input.mandate);
  const checks: Record<string, boolean> = {
    mandateActive: input.mandate.expiresAt > now,
    subjectMatches: input.mandate.subject.toUpperCase() === input.snapshot.underlying.toUpperCase(),
    platformAllowed: input.mandate.allowedPlatforms.includes(input.snapshot.platform),
    positionWithinLimit: input.positionUsd <= input.mandate.maxPositionUsd,
    premiumWithinLimit: Math.abs(input.economic.premiumBps) <= input.mandate.maxPremiumBps,
    marketNotHalted: input.snapshot.marketStatus !== "HALTED",
    evidenceSufficient: input.economic.confidence !== "LOW" && input.rights.sourceStatus !== "UNVERIFIED"
  };

  const attestationAge = ageSeconds(input.snapshot.attestationPublishedAt, now);
  checks.attestationFresh = attestationAge !== undefined && attestationAge <= input.mandate.maxAttestationAgeSeconds;
  checks.exitLiquiditySufficient =
    input.snapshot.exitLiquidityUsd !== undefined && input.snapshot.exitLiquidityUsd >= input.mandate.minimumExitLiquidityUsd;

  if (input.proposedTradeUsd !== undefined) {
    checks.tradeWithinLimit = input.proposedTradeUsd <= input.mandate.maxTradeUsd;
    checks.dailyBudgetAvailable = (input.dailySpendUsd ?? 0) + input.proposedTradeUsd <= input.mandate.dailyBudgetUsd;
  }
  if (input.proposedSlippageBps !== undefined) {
    checks.slippageWithinLimit = input.proposedSlippageBps <= input.mandate.maxSlippageBps;
  }

  for (const required of input.mandate.requiredRights) {
    if (required === "dividend") checks.rightDividend = input.rights.dividendTreatment !== "NONE" && input.rights.dividendTreatment !== "UNKNOWN";
    if (required === "redemption") checks.rightRedemption = input.rights.redemption === "DIRECT" || input.rights.redemption === "RESTRICTED";
    if (required === "one-to-one-backing") checks.rightOneToOne = input.rights.backingModel === "ONE_TO_ONE";
  }

  const reasons = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const hardBlockReasons = new Set([
    "mandateActive",
    "subjectMatches",
    "platformAllowed",
    "tradeWithinLimit",
    "dailyBudgetAvailable",
    "slippageWithinLimit",
    "marketNotHalted",
    "evidenceSufficient"
  ]);

  let state: PolicyDecision["state"] = "PROTECTED";
  if (reasons.some((reason) => hardBlockReasons.has(reason))) state = "BLOCKED";
  else if (reasons.length > 0) state = "RESCUE_REQUIRED";
  else if (
    Math.abs(input.economic.premiumBps) >= input.mandate.maxPremiumBps * 0.8 ||
    (input.snapshot.exitLiquidityUsd ?? 0) <= input.mandate.minimumExitLiquidityUsd * 1.2
  ) state = "WATCH";

  const partial = { state, reasons, checks, mandateHash };
  return { ...partial, evidenceHash: sha256({ ...partial, snapshot: input.snapshot, economic: input.economic, rights: input.rights }) };
}
