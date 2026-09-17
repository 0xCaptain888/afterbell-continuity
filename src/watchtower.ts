import { sha256 } from "./canonical.js";
import { buildEconomicFingerprint } from "./equivalence.js";
import { evaluateContinuity } from "./policy.js";
import type { AssetSnapshot, ContinuityMandate, PolicyDecision, RightsFingerprint } from "./types.js";

export type WatchedPosition = {
  positionId: string;
  wallet: `0x${string}`;
  amount: number;
  positionUsd: number;
  snapshot: AssetSnapshot;
  rights: RightsFingerprint;
  mandate: ContinuityMandate;
};

export type WatchtowerEvent = {
  eventId: `0x${string}`;
  positionId: string;
  observedAt: string;
  previousState?: PolicyDecision["state"];
  state: PolicyDecision["state"];
  reasons: string[];
  decisionHash: `0x${string}`;
  mode: AssetSnapshot["mode"];
};

export class ContinuityWatchtower {
  private readonly previous = new Map<string, PolicyDecision["state"]>();

  inspect(position: WatchedPosition, observedAt = new Date().toISOString()): WatchtowerEvent {
    const economic = buildEconomicFingerprint(position.snapshot, position.rights);
    const decision = evaluateContinuity({
      snapshot: position.snapshot,
      economic,
      rights: position.rights,
      mandate: position.mandate,
      positionUsd: position.positionUsd,
      nowSeconds: Math.floor(Date.parse(observedAt) / 1000)
    });
    const previousState = this.previous.get(position.positionId);
    this.previous.set(position.positionId, decision.state);
    const core = {
      positionId: position.positionId,
      observedAt,
      ...(previousState ? { previousState } : {}),
      state: decision.state,
      reasons: decision.reasons,
      decisionHash: decision.evidenceHash,
      mode: position.snapshot.mode
    };
    return { ...core, eventId: sha256(core) };
  }
}
