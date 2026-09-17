import { sha256, stableJson } from "./canonical.js";
import type { Address, Hex } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export type QuoteEvidence = {
  quoteId: string;
  vendor: string;
  fromTokenAddress: Address;
  toTokenAddress: Address;
  inputAmount: string;
  outputAmount: string;
  observedAt: string;
  expiresAt: string;
  payloadHash: Hex;
};

export function extractQuoteEvidence(input: {
  response: unknown;
  fromTokenAddress: Address;
  toTokenAddress: Address;
  inputAmount: string;
  observedAt: string;
  ttlSeconds: number;
}): QuoteEvidence {
  if (!isRecord(input.response) || !isRecord(input.response.data)) throw new Error("invalid_quote_envelope");
  const candidates = Array.isArray(input.response.data) ? input.response.data :
    Array.isArray(input.response.data.quotes) ? input.response.data.quotes :
      Array.isArray(input.response.data.routes) ? input.response.data.routes : [input.response.data];
  const quote = candidates.find((candidate) => isRecord(candidate) && candidate.isBest === true) ?? candidates.find(isRecord);
  if (!quote) throw new Error("quote_not_found");
  const quoteId = typeof quote.quoteId === "string" ? quote.quoteId : typeof quote.id === "string" ? quote.id : undefined;
  const outputAmount = typeof quote.toTokenAmount === "string" ? quote.toTokenAmount :
    typeof quote.outputAmount === "string" ? quote.outputAmount :
      typeof quote.amountOut === "string" ? quote.amountOut : undefined;
  const vendor = typeof quote.vendorName === "string" ? quote.vendorName :
    typeof quote.vendor === "string" ? quote.vendor :
      typeof quote.dexName === "string" ? quote.dexName : "UNKNOWN";
  if (!quoteId || !outputAmount) throw new Error("quote_missing_required_fields");
  return {
    quoteId,
    vendor,
    fromTokenAddress: input.fromTokenAddress,
    toTokenAddress: input.toTokenAddress,
    inputAmount: input.inputAmount,
    outputAmount,
    observedAt: input.observedAt,
    expiresAt: new Date(Date.parse(input.observedAt) + input.ttlSeconds * 1000).toISOString(),
    payloadHash: sha256(stableJson(input.response))
  };
}

export type EvmTransaction = { from: Address; to: Address; value: string; data: Hex };

export function extractEvmTransaction(response: unknown, from: Address): EvmTransaction | { rfq: true; signingPayload: unknown } {
  if (!isRecord(response) || !("data" in response)) throw new Error("invalid_swap_envelope");
  const data = response.data;
  if (!isRecord(data)) throw new Error("invalid_swap_data");
  if (data.executionMode === "RFQ" || isRecord(data.rfq)) {
    const rfq = isRecord(data.rfq) ? data.rfq : data;
    return { rfq: true, signingPayload: rfq.typedDataToSign ?? rfq.signingPayload ?? rfq };
  }
  const transaction = isRecord(data.tx) ? data.tx : isRecord(data.transaction) ? data.transaction : data;
  const to = typeof transaction.to === "string" && /^0x[0-9a-fA-F]{40}$/.test(transaction.to) ? transaction.to as Address : undefined;
  const calldata = typeof transaction.data === "string" && /^0x[0-9a-fA-F]*$/.test(transaction.data) ? transaction.data as Hex :
    typeof transaction.calldata === "string" && /^0x[0-9a-fA-F]*$/.test(transaction.calldata) ? transaction.calldata as Hex : undefined;
  if (to && calldata) return { from, to, value: typeof transaction.value === "string" ? transaction.value : "0", data: calldata };
  if ("typedData" in data || "signingPayload" in data) {
    return { rfq: true, signingPayload: data.typedData ?? data.signingPayload ?? data.rfq };
  }
  throw new Error("swap_transaction_not_found");
}

export function extractSimulationSuccess(response: unknown): { success: boolean; payloadHash: Hex; data: unknown } {
  if (!isRecord(response) || !("data" in response)) throw new Error("invalid_simulation_envelope");
  const data = response.data;
  if (!isRecord(data)) throw new Error("invalid_simulation_data");
  const rawStatus = data.success ?? data.status ?? data.executionStatus ?? data.simulationStatus;
  const statusPassed = rawStatus === true || rawStatus === "success" || rawStatus === "SUCCESS" || rawStatus === "SUCCEEDED" || rawStatus === 1;
  const failReason = typeof data.failReason === "string" ? data.failReason.trim() : "";
  const success = statusPassed && failReason.length === 0;
  return { success, payloadHash: sha256(stableJson(response)), data };
}
