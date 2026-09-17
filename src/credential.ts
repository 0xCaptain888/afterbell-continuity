import { hashTypedData, recoverTypedDataAddress, type Account } from "viem";
import { sha256 } from "./canonical.js";
import type { ContinuityCredential, Hex, SignedCredential } from "./types.js";

const credentialTypes = {
  ContinuityCredential: [
    { name: "schemaHash", type: "bytes32" },
    { name: "asset", type: "address" },
    { name: "underlyingHash", type: "bytes32" },
    { name: "economicExposureMicros", type: "uint256" },
    { name: "rightsFingerprintHash", type: "bytes32" },
    { name: "equivalenceClassHash", type: "bytes32" },
    { name: "status", type: "uint8" },
    { name: "riskTier", type: "uint8" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "bytes32" },
    { name: "evidenceRoot", type: "bytes32" }
  ]
} as const;

export function credentialTypedData(credential: ContinuityCredential) {
  return {
    domain: {
      name: "AfterBell Continuity",
      version: "1",
      chainId: credential.chainId,
      verifyingContract: credential.registry
    },
    types: credentialTypes,
    primaryType: "ContinuityCredential" as const,
    message: {
      schemaHash: sha256(credential.schema),
      asset: credential.asset,
      underlyingHash: credential.underlyingHash,
      economicExposureMicros: credential.economicExposureMicros,
      rightsFingerprintHash: credential.rightsFingerprintHash,
      equivalenceClassHash: credential.equivalenceClassHash,
      status: credential.status,
      riskTier: credential.riskTier,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      nonce: credential.nonce,
      evidenceRoot: credential.evidenceRoot
    }
  };
}

export function credentialHash(credential: ContinuityCredential): Hex {
  return hashTypedData(credentialTypedData(credential));
}

export async function signCredential(credential: ContinuityCredential, account: Account): Promise<SignedCredential> {
  if (!account.signTypedData) throw new Error("credential account cannot sign typed data");
  const signature = await account.signTypedData(credentialTypedData(credential));
  if (!account.address) throw new Error("credential signer has no address");
  return { credential, signer: account.address, signature };
}

export async function verifyCredential(input: {
  signed: SignedCredential;
  expectedSigner?: `0x${string}`;
  nowSeconds?: number;
}): Promise<{ valid: boolean; reasons: string[]; digest: Hex }> {
  const reasons: string[] = [];
  const now = BigInt(input.nowSeconds ?? Math.floor(Date.now() / 1000));
  if (input.signed.credential.issuedAt > now) reasons.push("credential_not_yet_valid");
  if (input.signed.credential.expiresAt <= now) reasons.push("credential_expired");
  const recovered = await recoverTypedDataAddress({
    ...credentialTypedData(input.signed.credential),
    signature: input.signed.signature
  });
  if (recovered.toLowerCase() !== input.signed.signer.toLowerCase()) reasons.push("credential_bad_signature");
  if (input.expectedSigner && recovered.toLowerCase() !== input.expectedSigner.toLowerCase()) reasons.push("credential_untrusted_signer");
  return { valid: reasons.length === 0, reasons, digest: credentialHash(input.signed.credential) };
}
