import { mkdir, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { loadContractArtifact } from "../src/contracts.js";

if (process.env.DEPLOY_CONFIRM !== "BSC_MAINNET") {
  throw new Error("deployment_blocked_set_DEPLOY_CONFIRM=BSC_MAINNET_only_after_review");
}
const rpcUrl = process.env.BSC_RPC_URL;
const key = process.env.BSC_DEPLOYER_PRIVATE_KEY;
const signerAddress = process.env.AFTERBELL_SIGNER_ADDRESS;
if (!rpcUrl) throw new Error("missing_bsc_rpc_url");
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("missing_or_invalid_bsc_deployer_private_key");
if (!signerAddress || !/^0x[0-9a-fA-F]{40}$/.test(signerAddress)) throw new Error("missing_or_invalid_afterbell_signer_address");

const account = privateKeyToAccount(key as Hex);
const transport = http(rpcUrl, { timeout: 20_000 });
const wallet = createWalletClient({ account, chain: bsc, transport });
const publicClient = createPublicClient({ chain: bsc, transport });
const chainId = await publicClient.getChainId();
if (chainId !== 56) throw new Error(`wrong_chain_${chainId}_expected_56`);

async function deploy(contractName: string, args: readonly unknown[]) {
  const artifact = await loadContractArtifact(contractName);
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args, account, chain: bsc });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 180_000 });
  if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`${contractName}_deployment_failed_${hash}`);
  return { contractName, address: receipt.contractAddress, transactionHash: hash, blockNumber: receipt.blockNumber.toString(), bytecodeHash: artifact.bytecodeHash };
}

const registry = await deploy("ContinuityRegistry", [signerAddress as Address]);
const vault = await deploy("GuardedStockVault", [registry.address]);
const bond = await deploy("ExecutionBondEscrow", [registry.address]);
const evidence = {
  schema: "afterbell-deployment/1",
  status: "MAINNET_DEPLOYED_UNVERIFIED",
  deployedAt: new Date().toISOString(),
  chainId,
  deployer: account.address,
  contracts: [registry, vault, bond],
  truthNotice: "Deployment receipts are recorded. Source verification is a separate required step."
};
await mkdir("evidence/deployment", { recursive: true });
await writeFile("evidence/deployment/bsc-mainnet.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
