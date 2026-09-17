import { sha256, stableJson } from "./canonical.js";
import type { EvidenceMode, Hex } from "./types.js";

export type EvidenceArtifact<T> = {
  schema: "afterbell-evidence/1";
  artifactType: string;
  mode: EvidenceMode;
  observedAt: string;
  source: string;
  parentHashes: Hex[];
  payload: T;
  payloadHash: Hex;
  evidenceRoot: Hex;
};

export function createEvidenceArtifact<T>(input: {
  artifactType: string;
  mode: EvidenceMode;
  observedAt: string;
  source: string;
  payload: T;
  parentHashes?: Hex[];
}): EvidenceArtifact<T> {
  const parentHashes = input.parentHashes ?? [];
  const payloadHash = sha256(stableJson(input.payload));
  const header = {
    schema: "afterbell-evidence/1",
    artifactType: input.artifactType,
    mode: input.mode,
    observedAt: input.observedAt,
    source: input.source,
    parentHashes,
    payloadHash
  } as const;
  return { ...header, payload: input.payload, evidenceRoot: sha256(stableJson(header)) };
}

export function verifyEvidenceArtifact(artifact: EvidenceArtifact<unknown>): boolean {
  const payloadHash = sha256(stableJson(artifact.payload));
  if (payloadHash !== artifact.payloadHash) return false;
  const header = {
    schema: artifact.schema,
    artifactType: artifact.artifactType,
    mode: artifact.mode,
    observedAt: artifact.observedAt,
    source: artifact.source,
    parentHashes: artifact.parentHashes,
    payloadHash: artifact.payloadHash
  };
  return sha256(stableJson(header)) === artifact.evidenceRoot;
}
