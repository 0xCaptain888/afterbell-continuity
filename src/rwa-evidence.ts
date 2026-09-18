import { sha256, stableJson } from "./canonical.js";
import { buildRightsFingerprint } from "./rights.js";
import { normalizeMarketStatus } from "./inventory.js";
import type { Address, Hex, MarketStatus, Platform, RightsFingerprint } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapData(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || value.code !== 0 || value.success === false || !isRecord(value.data)) {
    throw new Error("invalid_rwa_evidence_envelope");
  }
  return value.data;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export type ProtectionDisclosure = {
  kind: string;
  supported: boolean;
  description?: string;
  url?: string;
};

export type UnderlyingProfileEvidence = {
  chainId: number;
  tokenAddress: Address;
  platform: Platform;
  underlying: string;
  underlyingName: string;
  assetType?: number;
  tokenToShareRatio: number;
  protections: ProtectionDisclosure[];
  payloadHash: Hex;
};

export type UnderlyingMarketEvidence = {
  tokenAddress: Address;
  platform: Platform;
  marketStatus: MarketStatus;
  openState?: boolean;
  reasonCode?: string;
  nextOpenTime?: string;
  nextCloseTime?: string;
  referencePriceUsd?: number;
  underlyingDividendYield?: number;
  underlyingLatestDividend?: number;
  payloadHash: Hex;
};

export function parseUnderlyingProfile(response: unknown): UnderlyingProfileEvidence {
  const data = unwrapData(response);
  const address = optionalString(data.tokenContractAddress);
  const underlying = optionalString(data.underlyingTicker);
  const ratio = Number(data.tokenToShareRatio);
  if (!address?.match(/^0x[0-9a-fA-F]{40}$/) || !underlying || !Number.isFinite(ratio) || ratio <= 0) {
    throw new Error("invalid_underlying_profile");
  }
  const protections: ProtectionDisclosure[] = [];
  if (isRecord(data.protections)) {
    for (const [kind, raw] of Object.entries(data.protections)) {
      if (!isRecord(raw) || typeof raw.supported !== "boolean") continue;
      const disclosure: ProtectionDisclosure = { kind, supported: raw.supported };
      const description = optionalString(raw.description);
      const url = optionalString(raw.url);
      if (description) disclosure.description = description;
      if (url) disclosure.url = url;
      protections.push(disclosure);
    }
  }
  return {
    chainId: Number(data.binanceChainId ?? 56),
    tokenAddress: address as Address,
    platform: data.platformId === "bstock" || data.platformId === "ondo" ? data.platformId : "unknown",
    underlying,
    underlyingName: optionalString(data.underlyingFullName) ?? underlying,
    ...(typeof data.assetType === "number" ? { assetType: data.assetType } : {}),
    tokenToShareRatio: ratio,
    protections,
    payloadHash: sha256(stableJson(data))
  };
}

function timestampToIso(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return new Date(value).toISOString();
}

export function parseUnderlyingMarket(response: unknown): UnderlyingMarketEvidence {
  const data = unwrapData(response);
  const address = optionalString(data.tokenContractAddress);
  if (!address?.match(/^0x[0-9a-fA-F]{40}$/)) throw new Error("invalid_underlying_market");
  const status = isRecord(data.statusInfo) ? data.statusInfo : {};
  const market = isRecord(data.marketData) ? data.marketData : {};
  const result: UnderlyingMarketEvidence = {
    tokenAddress: address as Address,
    platform: data.platformId === "bstock" || data.platformId === "ondo" ? data.platformId : "unknown",
    marketStatus: normalizeMarketStatus(optionalString(status.marketStatus), optionalString(status.reasonCode)),
    payloadHash: sha256(stableJson(data))
  };
  if (typeof status.openState === "boolean") result.openState = status.openState;
  const reasonCode = optionalString(status.reasonCode);
  if (reasonCode) result.reasonCode = reasonCode;
  const nextOpenTime = timestampToIso(status.nextOpenTime);
  const nextCloseTime = timestampToIso(status.nextCloseTime);
  if (nextOpenTime) result.nextOpenTime = nextOpenTime;
  if (nextCloseTime) result.nextCloseTime = nextCloseTime;
  const referencePrice = Number(market.referencePrice);
  const dividendYield = Number(market.dividendYield);
  const latestDividend = Number(market.latestDividend);
  if (Number.isFinite(referencePrice) && referencePrice > 0) result.referencePriceUsd = referencePrice;
  if (Number.isFinite(dividendYield) && dividendYield >= 0) result.underlyingDividendYield = dividendYield;
  if (Number.isFinite(latestDividend) && latestDividend >= 0) result.underlyingLatestDividend = latestDividend;
  return result;
}

export type RightsEvidenceAssessment = {
  rights: RightsFingerprint;
  claims: {
    backingModel: "UNKNOWN";
    dividendTreatment: "UNKNOWN";
    splitTreatment: "UNKNOWN";
    votingRights: "UNKNOWN";
    redemption: "UNKNOWN";
  };
  disclosureCoverage: {
    authenticatedProfile: true;
    authenticatedMarketStatus: true;
    supportedProtectionKinds: string[];
    linkedProtectionKinds: string[];
  };
  caveats: string[];
};

export function assessRightsEvidence(input: {
  profile: UnderlyingProfileEvidence;
  market: UnderlyingMarketEvidence;
  observedAt: string;
}): RightsEvidenceAssessment {
  if (input.profile.tokenAddress.toLowerCase() !== input.market.tokenAddress.toLowerCase()) {
    throw new Error("rights_evidence_token_mismatch");
  }
  const supported = input.profile.protections.filter((item) => item.supported);
  const linked = supported.filter((item) => item.url);
  const sourceHashes = [input.profile.payloadHash, input.market.payloadHash];
  const rights = buildRightsFingerprint({
    underlying: input.profile.underlying,
    platform: input.profile.platform,
    backingModel: "UNKNOWN",
    dividendTreatment: "UNKNOWN",
    splitTreatment: "UNKNOWN",
    votingRights: "UNKNOWN",
    redemption: "UNKNOWN",
    sourceStatus: "PARTIAL",
    sourceVersion: `binance-web3:${input.observedAt}`,
    sourceHashes
  });
  return {
    rights,
    claims: {
      backingModel: "UNKNOWN",
      dividendTreatment: "UNKNOWN",
      splitTreatment: "UNKNOWN",
      votingRights: "UNKNOWN",
      redemption: "UNKNOWN"
    },
    disclosureCoverage: {
      authenticatedProfile: true,
      authenticatedMarketStatus: true,
      supportedProtectionKinds: supported.map((item) => item.kind),
      linkedProtectionKinds: linked.map((item) => item.kind)
    },
    caveats: [
      "A supported collateral or attestation report is evidence availability, not proof of a specific backing model.",
      "Underlying dividend market data does not establish token-holder dividend treatment.",
      "No machine-readable split, voting, redemption, or jurisdiction terms were returned; those rights remain UNKNOWN."
    ]
  };
}
