export type Hex = `0x${string}`;
export type Address = `0x${string}`;

export type EvidenceMode =
  | "LIVE"
  | "MAINNET"
  | "HISTORICAL_REPLAY"
  | "ADVERSARIAL_TEST"
  | "SIMULATED"
  | "DESIGN"
  | "UNAVAILABLE";

export type Platform = "bstock" | "ondo" | "xstock" | "unknown";
export type MarketStatus = "PRE_MARKET" | "REGULAR" | "AFTER_HOURS" | "CLOSED" | "HALTED" | "UNKNOWN";

export type AssetSnapshot = {
  chainId: number;
  tokenAddress: Address;
  symbol: string;
  underlying: string;
  platform: Platform;
  tokenToShareRatio: number;
  tokenPriceUsd: number;
  underlyingPriceUsd: number;
  observedAt: string;
  marketStatus: MarketStatus;
  nextMarketOpen?: string;
  attestationPublishedAt?: string;
  attestationUrl?: string;
  exitLiquidityUsd?: number;
  exitPriceImpactBps?: number;
  source: string;
  sourcePayloadHash: Hex;
  mode: EvidenceMode;
};

export type RightsFingerprint = {
  underlying: string;
  platform: Platform;
  backingModel: "ONE_TO_ONE" | "TOTAL_RETURN" | "SYNTHETIC" | "UNKNOWN";
  dividendTreatment: "DISTRIBUTED" | "REINVESTED" | "NONE" | "UNKNOWN";
  splitTreatment: "BALANCE_ADJUSTMENT" | "PRICE_ADJUSTMENT" | "MANUAL" | "UNKNOWN";
  votingRights: boolean | "UNKNOWN";
  redemption: "DIRECT" | "RESTRICTED" | "NONE" | "UNKNOWN";
  sourceStatus: "VERIFIED" | "PARTIAL" | "UNVERIFIED";
  sourceVersion: string;
  sourceHashes: Hex[];
  fingerprintHash: Hex;
};

export type EconomicFingerprint = {
  underlying: string;
  tokenAddress: Address;
  economicExposurePerToken: number;
  normalizedReferencePriceUsd: number;
  tokenPriceUsd: number;
  premiumBps: number;
  structureClass: string;
  rightsFingerprintHash: Hex;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidenceHash: Hex;
};

export type EquivalenceResult = {
  classification: "SAFE_EQUIVALENT" | "PARTIAL_EQUIVALENCE" | "NOT_EQUIVALENT" | "UNKNOWN";
  reasons: string[];
  ratioDeltaBps: number;
  rightsCompatible: boolean;
};

export type ContinuityMandate = {
  version: "afterbell/1";
  mandateId: string;
  owner: Address;
  subject: string;
  maxPositionUsd: number;
  maxTradeUsd: number;
  dailyBudgetUsd: number;
  maxPremiumBps: number;
  maxSlippageBps: number;
  maxQuoteAgeSeconds: number;
  maxAttestationAgeSeconds: number;
  minimumExitLiquidityUsd: number;
  requiredRights: Array<"dividend" | "redemption" | "one-to-one-backing">;
  allowedPlatforms: Platform[];
  fallbackAsset: Address;
  simulationRequired: boolean;
  autoExecuteLimitUsd: number;
  expiresAt: number;
};

export type ContinuityState = "PROTECTED" | "WATCH" | "RESCUE_REQUIRED" | "BLOCKED" | "CHALLENGED";

export type PolicyDecision = {
  state: ContinuityState;
  reasons: string[];
  checks: Record<string, boolean>;
  mandateHash: Hex;
  evidenceHash: Hex;
};

export type RescuePlan = {
  planId: Hex;
  reason: string;
  fromAsset: Address;
  toAsset: Address;
  amount: string;
  expectedOutput: string;
  estimatedSlippageBps: number;
  quoteObservedAt: string;
  quoteExpiresAt: number;
  policyHash: Hex;
  quoteHash: Hex;
  simulationHash?: Hex;
  calldataHash?: Hex;
  mode: EvidenceMode;
};

export type ContinuityCredential = {
  schema: "afterbell-continuity/1";
  chainId: number;
  registry: Address;
  asset: Address;
  underlyingHash: Hex;
  economicExposureMicros: bigint;
  rightsFingerprintHash: Hex;
  equivalenceClassHash: Hex;
  status: 0 | 1 | 2;
  riskTier: 0 | 1 | 2 | 3;
  issuedAt: bigint;
  expiresAt: bigint;
  nonce: Hex;
  evidenceRoot: Hex;
};

export type SignedCredential = {
  credential: ContinuityCredential;
  signer: Address;
  signature: Hex;
};

export type SimulationEvidence = {
  simulationHash: Hex;
  success: boolean;
  observedAt: string;
  balanceChanges: Array<{ address: Address; asset: Address; delta: string }>;
  allowanceChanges: Array<{ owner: Address; spender: Address; asset: Address; before: string; after: string }>;
  source: string;
};

export type ExecutionEvidence = {
  intentHash: Hex;
  mandateHash: Hex;
  credentialHash: Hex;
  quoteHash: Hex;
  simulation: SimulationEvidence;
  committedCalldataHash: Hex;
  executedCalldataHash: Hex;
  transactionHash: Hex;
  quoteObservedAt: string;
  executedAt: string;
  quotedOutput: string;
  realizedOutput: string;
  maxSlippageBps: number;
};

export type VerificationResult = {
  result: "PASS" | "BLOCKED" | "CHALLENGE";
  checks: Record<string, boolean>;
  reasons: string[];
  evidenceHash: Hex;
};

export type ContinuityPassport = {
  passportId: Hex;
  state: ContinuityState;
  execution: ExecutionEvidence;
  verification: VerificationResult;
  evidenceRoot: Hex;
  issuedAt: string;
};
