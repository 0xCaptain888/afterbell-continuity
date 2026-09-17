import { absoluteSlippageBps, sha256 } from "./canonical.js";
import type { ContinuityPassport, ExecutionEvidence, VerificationResult } from "./types.js";

export function verifyExecution(evidence: ExecutionEvidence): VerificationResult {
  const quoteTime = Date.parse(evidence.quoteObservedAt);
  const executionTime = Date.parse(evidence.executedAt);
  const quoteAgeSeconds = Number.isFinite(quoteTime) && Number.isFinite(executionTime)
    ? Math.max(0, Math.round((executionTime - quoteTime) / 1000))
    : Number.POSITIVE_INFINITY;
  const realizedSlippageBps = absoluteSlippageBps(evidence.quotedOutput, evidence.realizedOutput);
  const checks = {
    simulationPassed: evidence.simulation.success,
    simulationBound: evidence.simulation.simulationHash !== "0x",
    calldataBound: evidence.committedCalldataHash === evidence.executedCalldataHash,
    quoteFresh: quoteAgeSeconds <= 30,
    slippageWithinMandate: realizedSlippageBps <= evidence.maxSlippageBps,
    transactionPresent: /^0x[0-9a-fA-F]{64}$/.test(evidence.transactionHash)
  };
  const reasons = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const result = reasons.length === 0 ? "PASS" : "CHALLENGE";
  return { result, checks, reasons, evidenceHash: sha256({ evidence, checks, reasons, result }) };
}

export function buildPassport(execution: ExecutionEvidence, issuedAt = new Date().toISOString()): ContinuityPassport {
  const verification = verifyExecution(execution);
  const state = verification.result === "PASS" ? "PROTECTED" : "CHALLENGED";
  const evidenceRoot = sha256({ execution, verification });
  return {
    passportId: sha256({ evidenceRoot, issuedAt }),
    state,
    execution,
    verification,
    evidenceRoot,
    issuedAt
  };
}
