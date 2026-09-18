import { readFile, writeFile } from "node:fs/promises";
import { privateKeyToAccount } from "viem/accounts";
import { sha256 } from "../src/canonical.js";
import { credentialHash, signCredential, verifyCredential } from "../src/credential.js";
import { createEvidenceArtifact } from "../src/evidence.js";
import type { Address, ContinuityCredential, ExecutionEvidence, Hex } from "../src/types.js";
import { buildPassport } from "../src/verifier.js";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(path: string): Promise<Json> {
  return JSON.parse(await readFile(path, "utf8")) as Json;
}

function json(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(json);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, json(item)]));
  }
  return value;
}

function address(value: unknown, label: string): Address {
  assert(typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value), `invalid_${label}`);
  return value.toLowerCase() as Address;
}

function hex(value: unknown, label: string): Hex {
  assert(typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value), `invalid_${label}`);
  return value.toLowerCase() as Hex;
}

const signerPrivateKey = process.env.CREDENTIAL_SIGNER_PRIVATE_KEY as Hex | undefined;
assert(signerPrivateKey && /^0x[0-9a-fA-F]{64}$/.test(signerPrivateKey), "missing_credential_signer_private_key_run_npm_run_credentials_issuer");

const [swap, prepared, rights, equivalence] = await Promise.all([
  readJson("evidence/live/mainnet-stock-swap.json"),
  readJson(".runtime/prepared-live-swap.json"),
  readJson("evidence/live/rights-discovery.json"),
  readJson("evidence/live/economic-equivalence.json")
]);

assert(swap.status === "SUCCESS", "mainnet_swap_not_successful");
assert(prepared.mode === "LIVE_PREPARED_NOT_BROADCAST", "invalid_live_preparation");
const transaction = prepared.transaction as Json;
const quote = prepared.quote as Json;
const simulation = prepared.simulation as Json;
const swapInput = swap.input as Json;
const swapOutput = swap.output as Json;
assert(String(transaction.data).length > 2, "prepared_calldata_missing");
const preparedCalldataArtifact = createEvidenceArtifact({
  artifactType: "LIVE_SWAP_CALLDATA",
  mode: "LIVE",
  observedAt: String(swap.observedAt),
  source: "BNB Chain RPC",
  payload: String(transaction.data)
});
assert(preparedCalldataArtifact.payloadHash === swap.calldataHash, "prepared_calldata_hash_mismatch");
assert(String(quote.inputAmount) === String(swapInput.amountRaw), "prepared_input_mismatch");
assert(String(quote.expectedOutputAmount) === String(swapOutput.quotedAmountRaw), "prepared_quote_mismatch");

const rightsResults = Array.isArray(rights.results) ? rights.results as Json[] : [];
const tslabRights = rightsResults.find((item) => String(item.tokenContractAddress).toLowerCase() === String(swapOutput.tokenAddress).toLowerCase());
assert(tslabRights, "tslab_rights_evidence_missing");
const assessment = tslabRights.assessment as Json;
const rightsProfile = assessment.rights as Json;
const rightsFingerprintHash = hex(rightsProfile.fingerprintHash, "rights_fingerprint_hash");

const equivalenceResults = Array.isArray(equivalence.results) ? equivalence.results as Json[] : [];
const tslaEquivalence = equivalenceResults.find((item) => item.underlyingTicker === "TSLA");
assert(tslaEquivalence, "tsla_equivalence_evidence_missing");
assert(tslaEquivalence.classification === "UNKNOWN", "unexpected_tsla_rights_classification");
assert(tslaEquivalence.automaticRescueAllowed === false, "automatic_rescue_must_remain_blocked");

const issuer = privateKeyToAccount(signerPrivateKey);
const issuedAt = new Date();
const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1_000);
const expiresAtSeconds = issuedAtSeconds + 7 * 24 * 60 * 60;
const parentEvidenceRoots = [
  hex(rights.evidenceRoot, "rights_evidence_root"),
  hex(equivalence.evidenceRoot, "equivalence_evidence_root"),
  hex(swap.evidenceRoot, "swap_evidence_root")
];
const credentialEvidenceRoot = sha256({ parentEvidenceRoots });
const asset = address(swapOutput.tokenAddress, "output_token");
const credential: ContinuityCredential = {
  schema: "afterbell-continuity/1",
  chainId: 56,
  registry: "0x0000000000000000000000000000000000000000",
  asset,
  underlyingHash: sha256("TSLA"),
  economicExposureMicros: 1_000_000n,
  rightsFingerprintHash,
  equivalenceClassHash: sha256({
    chainId: 56,
    asset,
    platform: "bstock",
    underlying: "TSLA",
    tokenToShareRatio: 1,
    rightsFingerprintHash
  }),
  status: 1,
  riskTier: 2,
  issuedAt: BigInt(issuedAtSeconds),
  expiresAt: BigInt(expiresAtSeconds),
  nonce: sha256({ issuer: issuer.address, transactionHash: swap.transactionHash, issuedAt: issuedAt.toISOString() }),
  evidenceRoot: credentialEvidenceRoot
};
const signedCredential = await signCredential(credential, issuer);
const issuanceVerification = await verifyCredential({
  signed: signedCredential,
  expectedSigner: issuer.address,
  nowSeconds: issuedAtSeconds + 1
});
assert(issuanceVerification.valid, `credential_issuance_verification_failed:${issuanceVerification.reasons.join(",")}`);

const balanceChanges = Array.isArray(simulation.balanceChanges)
  ? (simulation.balanceChanges as Json[]).map((item) => ({
      address: address(item.owner, "simulation_balance_owner"),
      asset: address(item.contractAddress, "simulation_balance_asset"),
      delta: String(item.change)
    }))
  : [];
const allowanceChanges = Array.isArray(simulation.allowanceChanges)
  ? (simulation.allowanceChanges as Json[]).map((item) => ({
      owner: address(item.owner, "simulation_allowance_owner"),
      spender: address(item.spender, "simulation_allowance_spender"),
      asset: address(item.tokenAddress, "simulation_allowance_asset"),
      before: String(item.preAmount),
      after: String(item.postAmount)
    }))
  : [];
const quoteObservedAt = String(prepared.observedAt);
const executedAt = String(swap.observedAt);
assert(Number.isFinite(Date.parse(quoteObservedAt)), "invalid_quote_observed_at");
assert(Number.isFinite(Date.parse(executedAt)), "invalid_execution_observed_at");

const execution: ExecutionEvidence = {
  intentHash: sha256({
    action: "EXACT_INPUT_STOCK_TOKEN_SWAP",
    chainId: 56,
    owner: swap.from,
    fromAsset: swapInput.tokenAddress,
    toAsset: swapOutput.tokenAddress,
    exactInput: swapInput.amountRaw,
    maximumSlippageBps: 50
  }),
  mandateHash: sha256({
    owner: swap.from,
    maximumTradeUsd: 10,
    exactAllowanceRequired: true,
    zeroPostExecutionAllowanceRequired: true,
    simulationRequired: true,
    maximumSlippageBps: 50
  }),
  credentialHash: credentialHash(credential),
  quoteHash: sha256({
    vendor: quote.vendor,
    quoteId: quote.quoteId,
    observedAt: quoteObservedAt,
    expiresAt: prepared.expiresAt,
    inputAmount: quote.inputAmount,
    expectedOutputAmount: quote.expectedOutputAmount,
    minimumOutputAmount: quote.minOutputAmount
  }),
  simulation: {
    simulationHash: sha256(simulation),
    success: simulation.status === "SUCCESS" && !simulation.failReason,
    observedAt: quoteObservedAt,
    balanceChanges,
    allowanceChanges,
    source: "Binance Web3 Transaction API"
  },
  committedCalldataHash: hex(swap.calldataHash, "committed_calldata_hash"),
  executedCalldataHash: hex(swap.calldataHash, "executed_calldata_hash"),
  transactionHash: hex(swap.transactionHash, "transaction_hash"),
  quoteObservedAt,
  executedAt,
  quotedOutput: String(swapOutput.quotedAmountRaw),
  realizedOutput: String(swapOutput.amountRaw),
  maxSlippageBps: 50
};
const passport = buildPassport(execution, issuedAt.toISOString());
assert(passport.verification.checks.simulationPassed, "passport_simulation_check_failed");
assert(passport.verification.checks.calldataBound, "passport_calldata_check_failed");
assert(passport.verification.checks.slippageWithinMandate, "passport_slippage_check_failed");
assert(passport.verification.checks.transactionPresent, "passport_transaction_check_failed");
assert(passport.verification.result === "CHALLENGE" && passport.verification.checks.quoteFresh === false, "passport_must_disclose_unprovable_submission_freshness");

const credentialArtifact = createEvidenceArtifact({
  artifactType: "LIVE_CONTINUITY_CREDENTIAL",
  mode: "LIVE",
  observedAt: issuedAt.toISOString(),
  source: "AfterBell off-chain EIP-712 issuer",
  parentHashes: parentEvidenceRoots,
  payload: {
    signedCredential: json(signedCredential),
    digest: credentialHash(credential),
    issuerRole: "AFTERBELL_OFFCHAIN_CREDENTIAL_ISSUER",
    registryStatus: "NOT_DEPLOYED",
    semantics: {
      status: "WATCH",
      riskTier: "HIGH",
      reason: "Price execution verified; machine-readable shareholder rights remain incomplete."
    },
    validFrom: new Date(issuedAtSeconds * 1_000).toISOString(),
    validUntil: new Date(expiresAtSeconds * 1_000).toISOString(),
    issuanceVerification,
    truthNotice: "The signature proves an AfterBell issuer attested to this bounded evidence set. It is not a wallet-owner signature, ownership claim, deployed-registry claim, or guarantee of shareholder rights."
  }
});
const passportArtifact = createEvidenceArtifact({
  artifactType: "LIVE_CONTINUITY_PASSPORT",
  mode: "LIVE",
  observedAt: issuedAt.toISOString(),
  source: "AfterBell deterministic verifier + BNB Chain RPC",
  parentHashes: [credentialArtifact.evidenceRoot, hex(swap.evidenceRoot, "swap_evidence_root")],
  payload: {
    passport,
    credentialDigest: credentialHash(credential),
    resultSummary: {
      passedChecks: Object.entries(passport.verification.checks).filter(([, passed]) => passed).map(([name]) => name),
      challengedChecks: Object.entries(passport.verification.checks).filter(([, passed]) => !passed).map(([name]) => name),
      continuityState: "WATCH",
      automaticRescueAllowed: false
    },
    timingDisclosure: {
      quoteObservedAt,
      quoteExpiredAt: prepared.expiresAt,
      chainConfirmedAt: executedAt,
      limitation: "The wallet UI rejected stale quotes, but no independently timestamped broadcast event was retained. The passport therefore challenges quote freshness instead of inferring it from a successful receipt."
    },
    truthNotice: "This passport binds the prepared calldata, successful BNB Chain receipt, exact input, output bound, simulation and zero remaining allowance. It remains CHALLENGED because chain confirmation does not prove the quote was submitted within 30 seconds."
  }
});

await Promise.all([
  writeFile("evidence/live/mainnet-credential.json", JSON.stringify(credentialArtifact, null, 2)),
  writeFile("evidence/live/mainnet-passport.json", JSON.stringify(passportArtifact, null, 2))
]);

console.log(JSON.stringify({
  status: "LIVE_PASSPORT_AND_CREDENTIAL_PUBLISHED",
  issuer: issuer.address,
  credentialDigest: credentialHash(credential),
  credentialValidUntil: new Date(expiresAtSeconds * 1_000).toISOString(),
  passportId: passport.passportId,
  passportState: passport.state,
  passportResult: passport.verification.result,
  challengeReasons: passport.verification.reasons,
  financialTransactionCreated: false,
  privateKeyPrinted: false
}, null, 2));
