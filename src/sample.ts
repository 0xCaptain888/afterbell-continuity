import { privateKeyToAccount } from "viem/accounts";
import { sha256 } from "./canonical.js";
import { buildEconomicFingerprint } from "./equivalence.js";
import { buildRightsFingerprint } from "./rights.js";
import type { AssetSnapshot, ContinuityCredential, ContinuityMandate, ExecutionEvidence } from "./types.js";

export const addresses = {
  owner: "0x1111111111111111111111111111111111111111",
  stock: "0x2222222222222222222222222222222222222222",
  usdt: "0x3333333333333333333333333333333333333333",
  registry: "0x4444444444444444444444444444444444444444",
  vault: "0x5555555555555555555555555555555555555555"
} as const;

export const demoPrivateKey = `0x${"ab".repeat(32)}` as const;
export const demoAccount = privateKeyToAccount(demoPrivateKey);

export const sampleSnapshot: AssetSnapshot = {
  chainId: 56,
  tokenAddress: addresses.stock,
  symbol: "NVDAB",
  underlying: "NVDA",
  platform: "bstock",
  tokenToShareRatio: 1,
  tokenPriceUsd: 178.72,
  underlyingPriceUsd: 178.42,
  observedAt: "2026-09-17T00:00:00.000Z",
  marketStatus: "REGULAR",
  attestationPublishedAt: "2026-09-17T00:00:00.000Z",
  attestationUrl: "https://example.invalid/attestation",
  exitLiquidityUsd: 48_200,
  exitPriceImpactBps: 24,
  source: "afterbell_fixture",
  sourcePayloadHash: sha256("sample-rwa-payload"),
  mode: "SIMULATED"
};

export const sampleRights = buildRightsFingerprint({
  underlying: "NVDA",
  platform: "bstock",
  backingModel: "ONE_TO_ONE",
  dividendTreatment: "DISTRIBUTED",
  splitTreatment: "BALANCE_ADJUSTMENT",
  votingRights: false,
  redemption: "RESTRICTED",
  sourceStatus: "VERIFIED",
  sourceVersion: "fixture-2026-09-17",
  sourceHashes: [sha256("sample-rights-source")]
});

export const sampleEconomic = buildEconomicFingerprint(sampleSnapshot, sampleRights);

export const sampleMandate: ContinuityMandate = {
  version: "afterbell/1",
  mandateId: "judge-nvda-1",
  owner: addresses.owner,
  subject: "NVDA",
  maxPositionUsd: 100,
  maxTradeUsd: 25,
  dailyBudgetUsd: 50,
  maxPremiumBps: 80,
  maxSlippageBps: 70,
  maxQuoteAgeSeconds: 30,
  maxAttestationAgeSeconds: 172_800,
  minimumExitLiquidityUsd: 10_000,
  requiredRights: ["dividend", "one-to-one-backing"],
  allowedPlatforms: ["bstock", "ondo"],
  fallbackAsset: addresses.usdt,
  simulationRequired: true,
  autoExecuteLimitUsd: 10,
  expiresAt: 1_900_000_000
};

export function sampleCredential(nowSeconds = Math.floor(Date.now() / 1000)): ContinuityCredential {
  return {
    schema: "afterbell-continuity/1",
    chainId: 56,
    registry: addresses.registry,
    asset: addresses.stock,
    underlyingHash: sha256("NVDA"),
    economicExposureMicros: 1_000_000n,
    rightsFingerprintHash: sampleRights.fingerprintHash,
    equivalenceClassHash: sha256(sampleEconomic.structureClass),
    status: 0,
    riskTier: 0,
    issuedAt: BigInt(nowSeconds),
    expiresAt: BigInt(nowSeconds + 300),
    nonce: sha256(`judge-${nowSeconds}`),
    evidenceRoot: sampleEconomic.evidenceHash
  };
}

export function sampleExecution(overrides: Partial<ExecutionEvidence> = {}): ExecutionEvidence {
  const observedAt = new Date().toISOString();
  return {
    intentHash: sha256("judge-intent"),
    mandateHash: sha256(sampleMandate),
    credentialHash: sha256("judge-credential"),
    quoteHash: sha256("judge-quote"),
    simulation: {
      simulationHash: sha256("judge-simulation"),
      success: true,
      observedAt,
      balanceChanges: [],
      allowanceChanges: [],
      source: "afterbell_fixture"
    },
    committedCalldataHash: sha256("judge-calldata"),
    executedCalldataHash: sha256("judge-calldata"),
    transactionHash: `0x${"12".repeat(32)}`,
    quoteObservedAt: observedAt,
    executedAt: observedAt,
    quotedOutput: "21.34",
    realizedOutput: "21.29",
    maxSlippageBps: 70,
    ...overrides
  };
}
