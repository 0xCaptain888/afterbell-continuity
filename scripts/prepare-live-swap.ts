import { mkdir, writeFile } from "node:fs/promises";
import { BinanceWeb3Client } from "../src/rwa-client.js";
import { extractEvmTransaction, extractQuoteEvidence, extractSimulationSuccess } from "../src/trading-evidence.js";
import type { Address } from "../src/types.js";

const DEFAULT_BSC_RPC_URL = "https://bsc-dataseed.bnbchain.org";
const BPS_DENOMINATOR = 10_000n;

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

function decimalPercentToBps(value: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("invalid_slippage_percent");
  const [whole = "0", fraction = ""] = value.split(".");
  const bps = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (bps < 0n || bps > 500n) throw new Error("slippage_exceeds_5_percent_safety_limit");
  return bps;
}

function toHexQuantity(value: string): string {
  if (/^0x[0-9a-f]+$/i.test(value)) return value;
  if (!/^\d+$/.test(value)) throw new Error("invalid_evm_quantity");
  return `0x${BigInt(value).toString(16)}`;
}

function encodeAddress(value: string): string {
  return value.slice(2).toLowerCase().padStart(64, "0");
}

function formatUnits(value: bigint, decimals = 18): string {
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  if (!response.ok) throw new Error(`bsc_rpc_http_${response.status}`);
  const payload = await response.json() as { result?: T; error?: { code?: number; message?: string } };
  if (payload.error) throw new Error(`bsc_rpc_${payload.error.code ?? "error"}:${payload.error.message ?? "unknown"}`);
  if (payload.result === undefined) throw new Error(`bsc_rpc_missing_result:${method}`);
  return payload.result;
}

const apiKey = required("BINANCE_WEB3_API_KEY");
const secretKey = required("BINANCE_WEB3_SECRET_KEY");
const wallet = address("AFTERBELL_WALLET_ADDRESS");
const fromTokenAddress = address("AFTERBELL_FROM_TOKEN_ADDRESS");
const toTokenAddress = address("AFTERBELL_TO_TOKEN_ADDRESS");
const amount = required("AFTERBELL_QUOTE_AMOUNT");
const slippagePercent = process.env.AFTERBELL_SLIPPAGE_PERCENT ?? "0.5";
const slippageBps = decimalPercentToBps(slippagePercent);
const rpcUrl = process.env.BSC_RPC_URL ?? DEFAULT_BSC_RPC_URL;
const client = new BinanceWeb3Client({ apiKey, secretKey }, process.env.BINANCE_WEB3_BASE_URL);

const observedAt = new Date().toISOString();
const quoteResponse = await client.getQuote({ amount, fromTokenAddress, toTokenAddress, userWalletAddress: wallet });
const quote = extractQuoteEvidence({ response: quoteResponse, fromTokenAddress, toTokenAddress, inputAmount: amount, observedAt, ttlSeconds: 30 });
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
if ("rfq" in transaction) throw new Error("rfq_signature_required_not_supported_by_live_swap_preparer");
const simulationResponse = await client.simulateEvmTransaction({ ...transaction, binanceChainId: "56" });
const simulation = extractSimulationSuccess(simulationResponse);
if (!simulation.success) throw new Error("live_swap_simulation_failed");

const outputAmount = BigInt(quote.outputAmount);
const minOutputAmount = outputAmount * (BPS_DENOMINATOR - slippageBps) / BPS_DENOMINATOR;
const rpcTransaction = {
  from: wallet,
  to: transaction.to,
  value: toHexQuantity(transaction.value),
  data: transaction.data
};
const allowanceData = `0xdd62ed3e${encodeAddress(wallet)}${encodeAddress(transaction.to)}`;
const [gasLimitHex, gasPriceHex, nativeBalanceHex, allowanceHex] = await Promise.all([
  rpc<string>(rpcUrl, "eth_estimateGas", [rpcTransaction]),
  rpc<string>(rpcUrl, "eth_gasPrice", []),
  rpc<string>(rpcUrl, "eth_getBalance", [wallet, "latest"]),
  rpc<string>(rpcUrl, "eth_call", [{ to: fromTokenAddress, data: allowanceData }, "latest"])
]);
const gasLimit = BigInt(gasLimitHex);
const gasPriceWei = BigInt(gasPriceHex);
const maxEstimatedGasWei = gasLimit * gasPriceWei;
const nativeBalanceWei = BigInt(nativeBalanceHex);
const allowance = BigInt(allowanceHex);
if (allowance !== BigInt(amount)) throw new Error(`unexpected_allowance:${allowance}`);
if (nativeBalanceWei < maxEstimatedGasWei) throw new Error("insufficient_bnb_for_estimated_gas");

const prepared = {
  schema: "afterbell-live-swap-preparation/1",
  mode: "LIVE_PREPARED_NOT_BROADCAST",
  observedAt,
  expiresAt: quote.expiresAt,
  chainId: 56,
  wallet,
  quote: {
    quoteId: quote.quoteId,
    vendor: quote.vendor,
    inputAmount: amount,
    inputAmountUsdt: formatUnits(BigInt(amount)),
    expectedOutputAmount: quote.outputAmount,
    expectedOutputTslab: formatUnits(outputAmount),
    slippagePercent,
    minOutputAmount: minOutputAmount.toString(),
    minOutputTslab: formatUnits(minOutputAmount)
  },
  gas: {
    gasLimit: gasLimit.toString(),
    gasPriceWei: gasPriceWei.toString(),
    maxEstimatedGasWei: maxEstimatedGasWei.toString(),
    maxEstimatedGasBnb: formatUnits(maxEstimatedGasWei),
    walletBnbBalance: formatUnits(nativeBalanceWei)
  },
  authorization: {
    allowanceRaw: allowance.toString(),
    allowanceUsdt: formatUnits(allowance),
    expectedPostSwapAllowanceRaw: "0"
  },
  transaction,
  simulation: simulation.data,
  truthNotice: "Prepared and simulated only. The wallet owner must explicitly confirm before signing or broadcasting."
};

await mkdir(".runtime", { recursive: true });
await writeFile(".runtime/prepared-live-swap.json", JSON.stringify(prepared, null, 2), { mode: 0o600 });
console.log(JSON.stringify({
  status: "LIVE_SWAP_PREPARED_NOT_BROADCAST",
  observedAt,
  expiresAt: quote.expiresAt,
  vendor: quote.vendor,
  spend: `${prepared.quote.inputAmountUsdt} USDT`,
  expectedReceive: `${prepared.quote.expectedOutputTslab} TSLAB`,
  minimumReceive: `${prepared.quote.minOutputTslab} TSLAB`,
  slippagePercent,
  maxEstimatedGas: `${prepared.gas.maxEstimatedGasBnb} BNB`,
  walletBnbBalance: `${prepared.gas.walletBnbBalance} BNB`,
  currentAllowance: `${prepared.authorization.allowanceUsdt} USDT`,
  output: ".runtime/prepared-live-swap.json",
  next: "Do not broadcast without a fresh explicit user confirmation."
}, null, 2));
