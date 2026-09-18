import { readFile, writeFile } from "node:fs/promises";
import { createEvidenceArtifact } from "../src/evidence.js";

type Json = Record<string, unknown>;
type RpcLog = { address: string; data: string; topics: string[] };
type RpcTransaction = { hash: string; from: string; to: string; input: string; blockNumber: string };
type RpcReceipt = { status: string; blockNumber: string; gasUsed: string; effectiveGasPrice: string; logs: RpcLog[] };

const DEFAULT_BSC_RPC_URL = "https://bsc-dataseed.bnbchain.org";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function formatUnits(value: bigint, decimals = 18): string {
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function addressTopic(value: string): string {
  return `0x${value.slice(2).toLowerCase().padStart(64, "0")}`;
}

function encodeAddress(value: string): string {
  return value.slice(2).toLowerCase().padStart(64, "0");
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
  if (payload.result === undefined || payload.result === null) throw new Error(`bsc_rpc_missing_result:${method}`);
  return payload.result;
}

const transactionHash = process.argv[2];
assert(typeof transactionHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(transactionHash), "usage: npm run trade:verify -- <transaction_hash>");
const prepared = JSON.parse(await readFile(".runtime/prepared-live-swap.json", "utf8")) as Json;
const preparedTransaction = prepared.transaction as Json;
const preparedQuote = prepared.quote as Json;
const wallet = String(prepared.wallet).toLowerCase();
const fromTokenAddress = String(preparedQuote.fromTokenAddress ?? process.env.AFTERBELL_FROM_TOKEN_ADDRESS ?? "").toLowerCase();
const toTokenAddress = String(preparedQuote.toTokenAddress ?? process.env.AFTERBELL_TO_TOKEN_ADDRESS ?? "").toLowerCase();
assert(/^0x[0-9a-f]{40}$/.test(fromTokenAddress), "invalid_from_token_address");
assert(/^0x[0-9a-f]{40}$/.test(toTokenAddress), "invalid_to_token_address");
const rpcUrl = process.env.BSC_RPC_URL ?? DEFAULT_BSC_RPC_URL;
const [transaction, receipt] = await Promise.all([
  rpc<RpcTransaction>(rpcUrl, "eth_getTransactionByHash", [transactionHash]),
  rpc<RpcReceipt>(rpcUrl, "eth_getTransactionReceipt", [transactionHash])
]);

assert(transaction.hash.toLowerCase() === transactionHash.toLowerCase(), "transaction_hash_mismatch");
assert(transaction.from.toLowerCase() === wallet, "transaction_sender_mismatch");
assert(transaction.to.toLowerCase() === String(preparedTransaction.to).toLowerCase(), "transaction_target_mismatch");
assert(transaction.input.toLowerCase() === String(preparedTransaction.data).toLowerCase(), "broadcast_calldata_mismatch");
assert(BigInt(receipt.status) === 1n, "transaction_receipt_failed");

const walletTopic = addressTopic(wallet);
let usdtSpent = 0n;
let tslabReceived = 0n;
for (const log of receipt.logs) {
  if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
  const logAddress = log.address.toLowerCase();
  if (logAddress === fromTokenAddress && log.topics[1]?.toLowerCase() === walletTopic) usdtSpent += BigInt(log.data);
  if (logAddress === toTokenAddress && log.topics[2]?.toLowerCase() === walletTopic) tslabReceived += BigInt(log.data);
}
const expectedInput = BigInt(String(preparedQuote.inputAmount));
const expectedOutput = BigInt(String(preparedQuote.expectedOutputAmount));
const minimumOutput = BigInt(String(preparedQuote.minOutputAmount));
assert(usdtSpent === expectedInput, `unexpected_usdt_spend:${usdtSpent}`);
assert(tslabReceived >= minimumOutput, `minimum_output_not_met:${tslabReceived}`);
const realizedShortfallBps = expectedOutput > tslabReceived
  ? Number((expectedOutput - tslabReceived) * 10_000n / expectedOutput)
  : 0;
const allowanceData = `0xdd62ed3e${encodeAddress(wallet)}${encodeAddress(transaction.to)}`;
const allowanceHex = await rpc<string>(rpcUrl, "eth_call", [{ to: fromTokenAddress, data: allowanceData }, "latest"]);
const postSwapAllowance = BigInt(allowanceHex);
assert(postSwapAllowance === 0n, `post_swap_allowance_not_zero:${postSwapAllowance}`);
const block = await rpc<{ timestamp: string }>(rpcUrl, "eth_getBlockByNumber", [receipt.blockNumber, false]);
const gasUsed = BigInt(receipt.gasUsed);
const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
const gasPaidWei = gasUsed * effectiveGasPrice;
const observedAt = new Date(Number(BigInt(block.timestamp)) * 1_000).toISOString();
const calldataArtifact = createEvidenceArtifact({
  artifactType: "LIVE_SWAP_CALLDATA",
  mode: "LIVE",
  observedAt,
  source: "BNB Chain RPC",
  payload: transaction.input
});
const payload = {
  schema: "afterbell-mainnet-stock-swap/1",
  status: "SUCCESS",
  mode: "LIVE",
  observedAt,
  source: "BNB Chain RPC",
  chainId: 56,
  transactionHash: transaction.hash,
  explorerUrl: `https://bscscan.com/tx/${transaction.hash}`,
  blockNumber: Number(BigInt(receipt.blockNumber)),
  from: transaction.from,
  to: transaction.to,
  calldataHash: calldataArtifact.payloadHash,
  input: {
    tokenAddress: fromTokenAddress,
    amountRaw: usdtSpent.toString(),
    amountUsdt: formatUnits(usdtSpent)
  },
  output: {
    tokenAddress: toTokenAddress,
    amountRaw: tslabReceived.toString(),
    amountTslab: formatUnits(tslabReceived),
    quotedAmountRaw: expectedOutput.toString(),
    minimumAmountRaw: minimumOutput.toString(),
    realizedShortfallBps
  },
  gas: {
    gasUsed: gasUsed.toString(),
    effectiveGasPriceWei: effectiveGasPrice.toString(),
    paidWei: gasPaidWei.toString(),
    paidBnb: formatUnits(gasPaidWei)
  },
  authorization: {
    postSwapAllowanceRaw: postSwapAllowance.toString(),
    postSwapAllowanceUsdt: formatUnits(postSwapAllowance)
  },
  verification: {
    receiptSucceeded: true,
    senderMatched: true,
    targetMatched: true,
    calldataMatchedPreparedTransaction: true,
    exactInputSpent: true,
    minimumOutputMet: true,
    allowanceConsumedToZero: true
  },
  truthNotice: "This artifact records one user-confirmed BNB Chain mainnet stock-token swap and independently verifies its calldata, receipt, token transfers, slippage bound, gas, and post-swap allowance."
};
const evidence = createEvidenceArtifact({
  artifactType: "MAINNET_STOCK_SWAP",
  mode: "LIVE",
  observedAt,
  source: "BNB Chain RPC",
  payload
});
await writeFile("evidence/live/mainnet-stock-swap.json", JSON.stringify({ ...payload, evidenceRoot: evidence.evidenceRoot }, null, 2));
console.log(JSON.stringify({
  status: payload.status,
  transactionHash: transaction.hash,
  blockNumber: payload.blockNumber,
  spent: `${payload.input.amountUsdt} USDT`,
  received: `${payload.output.amountTslab} TSLAB`,
  realizedShortfallBps,
  gasPaid: `${payload.gas.paidBnb} BNB`,
  postSwapAllowance: `${payload.authorization.postSwapAllowanceUsdt} USDT`,
  evidenceRoot: evidence.evidenceRoot
}, null, 2));
