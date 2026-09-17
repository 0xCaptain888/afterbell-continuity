import { mkdir, writeFile } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";
import { BinanceWeb3Client } from "../src/rwa-client.js";
import { extractEvmTransaction, extractQuoteEvidence, extractSimulationSuccess } from "../src/trading-evidence.js";
import type { Address } from "../src/types.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function address(name: string): Address {
  const value = required(name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(`invalid_${name.toLowerCase()}`);
  return value as Address;
}

await mkdir("evidence/live", { recursive: true });
try {
  const apiKey = required("BINANCE_WEB3_API_KEY");
  const secretKey = required("BINANCE_WEB3_SECRET_KEY");
  const wallet = address("AFTERBELL_WALLET_ADDRESS");
  const fromTokenAddress = address("AFTERBELL_FROM_TOKEN_ADDRESS");
  const toTokenAddress = address("AFTERBELL_TO_TOKEN_ADDRESS");
  const amount = required("AFTERBELL_QUOTE_AMOUNT");
  if (!/^\d+$/.test(amount) || amount === "0") throw new Error("invalid_afterbell_quote_amount");
  const slippagePercent = process.env.AFTERBELL_SLIPPAGE_PERCENT ?? "0.5";
  const client = new BinanceWeb3Client({ apiKey, secretKey }, process.env.BINANCE_WEB3_BASE_URL);
  const observedAt = new Date().toISOString();
  const quoteResponse = await client.getQuote({ amount, fromTokenAddress, toTokenAddress, userWalletAddress: wallet });
  const quote = extractQuoteEvidence({ response: quoteResponse, fromTokenAddress, toTokenAddress, inputAmount: amount, observedAt, ttlSeconds: 30 });
  if (Date.now() >= Date.parse(quote.expiresAt)) throw new Error("quote_expired_before_swap_build");
  const swapResponse = await client.buildSwap({
    amount,
    fromTokenAddress,
    toTokenAddress,
    userWalletAddress: wallet,
    quoteId: quote.quoteId,
    slippagePercent,
    approveTransaction: "true"
  });
  const transaction = extractEvmTransaction(swapResponse, wallet);
  if ("rfq" in transaction) {
    const result = {
      status: "RFQ_SIGNATURE_REQUIRED",
      mode: "LIVE",
      observedAt,
      quote,
      signingPayloadPresent: transaction.signingPayload !== undefined,
      truthNotice: "No RFQ signature was created and no transaction was broadcast. Continue with Agentic Wallet or an approved local signer."
    };
    const evidence = createEvidenceArtifact({ artifactType: "QUOTE_AND_RFQ_GATE", mode: "LIVE", observedAt, source: "Binance Web3 Trading API", payload: result });
    await writeFile("evidence/live/quote-simulation-gate.json", JSON.stringify({ ...result, evidenceRoot: evidence.evidenceRoot }, null, 2));
    console.log(JSON.stringify({ ...result, evidenceRoot: evidence.evidenceRoot }, null, 2));
    process.exit(3);
  }
  const simulationResponse = await client.simulateEvmTransaction({ ...transaction, binanceChainId: "56" });
  const simulation = extractSimulationSuccess(simulationResponse);
  const status = simulation.success ? "LIVE_QUOTE_AND_SIMULATION_PASSED" : "SIMULATION_BLOCKED";
  const result = {
    status,
    mode: "LIVE",
    observedAt,
    quote,
    transaction: { ...transaction, data: `${transaction.data.slice(0, 18)}…`, calldataHash: createEvidenceArtifact({ artifactType: "CALLDATA", mode: "LIVE", observedAt, source: "Binance Web3 Trading API", payload: transaction.data }).payloadHash },
    simulation: { success: simulation.success, payloadHash: simulation.payloadHash, data: simulation.data },
    truthNotice: "This gate quotes, builds, and simulates only. It never signs or broadcasts a transaction."
  };
  const evidence = createEvidenceArtifact({ artifactType: "QUOTE_AND_SIMULATION_GATE", mode: "LIVE", observedAt, source: "Binance Web3 Trading and Transaction APIs", payload: result, parentHashes: [quote.payloadHash, simulation.payloadHash] });
  await writeFile("evidence/live/quote-simulation-gate.json", JSON.stringify({ ...result, evidenceRoot: evidence.evidenceRoot }, null, 2));
  console.log(JSON.stringify({ ...result, evidenceRoot: evidence.evidenceRoot }, null, 2));
  if (!simulation.success) process.exitCode = 4;
} catch (error) {
  const result = { status: "BLOCKED", mode: "UNAVAILABLE", observedAt: new Date().toISOString(), reason: error instanceof Error ? error.message : String(error) };
  await writeFile("evidence/live/quote-simulation-gate.json", JSON.stringify(result, null, 2));
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 2;
}
