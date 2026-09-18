import { credentialHash, verifyCredential } from "./credential.js";
import type { ContinuityCredential, ContinuityPassport, Hex, SignedCredential } from "./types.js";
import { buildPassport } from "./verifier.js";

export type ConsumerAdmissionResult = "ALLOW_AUTOMATION" | "REQUIRE_MANUAL_REVIEW" | "DENY";

export type ConsumerAdmissionDecision = {
  schema: "afterbell-consumer-admission/1";
  result: ConsumerAdmissionResult;
  checks: {
    signatureTrusted: boolean;
    credentialActive: boolean;
    credentialDigestBound: boolean;
    passportIntegrity: boolean;
    passportProtected: boolean;
    credentialProtected: boolean;
    riskTierAccepted: boolean;
  };
  reasons: string[];
  credentialDigest: Hex;
  passportId: Hex;
  evaluatedAt: string;
  permissions: {
    allowAutomatedRescue: boolean;
    allowGuardedDeposit: boolean;
    allowReadOnlyMonitoring: boolean;
  };
};

type SerializedCredential = Omit<ContinuityCredential, "economicExposureMicros" | "issuedAt" | "expiresAt"> & {
  economicExposureMicros: bigint | number | string;
  issuedAt: bigint | number | string;
  expiresAt: bigint | number | string;
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`invalid_${label}`);
  return value as Record<string, unknown>;
}

export function deserializeSignedCredential(value: unknown): SignedCredential {
  const signed = object(value, "signed_credential");
  const raw = object(signed.credential, "credential") as unknown as SerializedCredential;
  if (raw.schema !== "afterbell-continuity/1") throw new Error("invalid_credential_schema");
  const credential: ContinuityCredential = {
    ...raw,
    economicExposureMicros: BigInt(raw.economicExposureMicros),
    issuedAt: BigInt(raw.issuedAt),
    expiresAt: BigInt(raw.expiresAt)
  };
  const signer = String(signed.signer);
  const signature = String(signed.signature);
  if (!/^0x[0-9a-fA-F]{40}$/.test(signer)) throw new Error("invalid_credential_signer");
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) throw new Error("invalid_credential_signature");
  return { credential, signer: signer as `0x${string}`, signature: signature as Hex };
}

export async function evaluateConsumerAdmission(input: {
  signedCredential: SignedCredential;
  passport: ContinuityPassport;
  trustedSigner: `0x${string}`;
  nowSeconds?: number;
  maximumRiskTier?: 0 | 1 | 2 | 3;
}): Promise<ConsumerAdmissionDecision> {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  const digest = credentialHash(input.signedCredential.credential);
  let credentialReasons: string[] = [];
  try {
    credentialReasons = (await verifyCredential({
      signed: input.signedCredential,
      expectedSigner: input.trustedSigner,
      nowSeconds
    })).reasons;
  } catch {
    credentialReasons = ["credential_bad_signature"];
  }

  const rebuiltPassport = buildPassport(input.passport.execution, input.passport.issuedAt);
  const signatureTrusted = !credentialReasons.some((reason) => ["credential_bad_signature", "credential_untrusted_signer"].includes(reason));
  const credentialActive = !credentialReasons.some((reason) => ["credential_expired", "credential_not_yet_valid"].includes(reason));
  const checks = {
    signatureTrusted,
    credentialActive,
    credentialDigestBound: digest === input.passport.execution.credentialHash,
    passportIntegrity: rebuiltPassport.passportId === input.passport.passportId
      && rebuiltPassport.evidenceRoot === input.passport.evidenceRoot
      && rebuiltPassport.verification.evidenceHash === input.passport.verification.evidenceHash,
    passportProtected: input.passport.state === "PROTECTED" && input.passport.verification.result === "PASS",
    credentialProtected: input.signedCredential.credential.status === 0,
    riskTierAccepted: input.signedCredential.credential.riskTier <= (input.maximumRiskTier ?? 1)
  };
  const hardFailure = !checks.signatureTrusted || !checks.credentialActive || !checks.credentialDigestBound || !checks.passportIntegrity;
  const reviewRequired = !checks.passportProtected || !checks.credentialProtected || !checks.riskTierAccepted;
  const result: ConsumerAdmissionResult = hardFailure
    ? "DENY"
    : reviewRequired
      ? "REQUIRE_MANUAL_REVIEW"
      : "ALLOW_AUTOMATION";
  const reasons = [
    ...credentialReasons,
    ...Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
  ].filter((reason, index, values) => values.indexOf(reason) === index);
  const allowAutomation = result === "ALLOW_AUTOMATION";
  return {
    schema: "afterbell-consumer-admission/1",
    result,
    checks,
    reasons,
    credentialDigest: digest,
    passportId: input.passport.passportId,
    evaluatedAt: new Date(nowSeconds * 1_000).toISOString(),
    permissions: {
      allowAutomatedRescue: allowAutomation,
      allowGuardedDeposit: allowAutomation,
      allowReadOnlyMonitoring: result !== "DENY"
    }
  };
}
