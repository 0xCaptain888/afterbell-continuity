import { sha256 } from "./canonical.js";
import type { Address, ContinuityMandate, EvidenceMode, Hex, RescuePlan } from "./types.js";

export function buildRescuePlan(input: {
  reason: string;
  fromAsset: Address;
  amount: string;
  expectedOutput: string;
  estimatedSlippageBps: number;
  quoteObservedAt: string;
  quoteTtlSeconds: number;
  mandate: ContinuityMandate;
  quotePayload: unknown;
  mode: EvidenceMode;
}): RescuePlan {
  const quoteObservedAtMs = Date.parse(input.quoteObservedAt);
  if (!Number.isFinite(quoteObservedAtMs)) throw new Error("invalid quoteObservedAt");
  const policyHash = sha256(input.mandate);
  const quoteHash = sha256(input.quotePayload);
  const partial = {
    reason: input.reason,
    fromAsset: input.fromAsset,
    toAsset: input.mandate.fallbackAsset,
    amount: input.amount,
    expectedOutput: input.expectedOutput,
    estimatedSlippageBps: input.estimatedSlippageBps,
    quoteObservedAt: input.quoteObservedAt,
    quoteExpiresAt: Math.floor(quoteObservedAtMs / 1000) + input.quoteTtlSeconds,
    policyHash,
    quoteHash,
    mode: input.mode
  } as const;
  return { ...partial, planId: sha256(partial) };
}

export function bindSimulation(plan: RescuePlan, simulationHash: Hex, calldataHash: Hex): RescuePlan {
  return { ...plan, simulationHash, calldataHash };
}
