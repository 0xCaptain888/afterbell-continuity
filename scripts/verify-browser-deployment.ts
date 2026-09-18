import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, getAddress, http, type Address, type Hex } from "viem";
import { bsc } from "viem/chains";
import { createEvidenceArtifact } from "../src/evidence.js";
import { loadContractArtifact } from "../src/contracts.js";

type DeploymentRecord = {
  name: string;
  address: Address;
  transactionHash: Hex;
  blockNumber: string;
  gasUsed: string;
  constructorAddress: Address;
  runtimeBytes: number;
};

type BrowserResult = {
  schema: string;
  status: string;
  chainId: number;
  deployer: Address;
  credentialIssuer: Address;
  completedAt: string;
  contracts: DeploymentRecord[];
};

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function patchRuntime(input: { runtimeBytecode: Hex; immutableReferences: Record<string, Array<{ start: number; length: number }>> }, registry: Address): Hex {
  let code = input.runtimeBytecode.slice(2);
  const encodedRegistry = registry.slice(2).toLowerCase().padStart(64, "0");
  for (const reference of Object.values(input.immutableReferences).flat()) {
    const replacement = encodedRegistry.slice(-reference.length * 2);
    const start = reference.start * 2;
    code = `${code.slice(0, start)}${replacement}${code.slice(start + reference.length * 2)}`;
  }
  return `0x${code}`;
}

function constructorInitCode(bytecode: Hex, address: Address): Hex {
  return `${bytecode}${address.slice(2).toLowerCase().padStart(64, "0")}` as Hex;
}

const resultPath = process.argv[2] ?? ".runtime/deployment/browser-result.json";
const rpcUrl = process.env.BSC_RPC_URL ?? "https://bsc-dataseed.bnbchain.org";
const expectedDeployer = getAddress("0x101fd328a0b2fd9e853909651dab1c0b55947c03");
const result = JSON.parse(await readFile(resultPath, "utf8")) as BrowserResult;
const credentialArtifact = JSON.parse(await readFile("evidence/live/mainnet-credential.json", "utf8")) as Json;
const credentialPayload = credentialArtifact.payload as Json;
const signedCredential = credentialPayload.signedCredential as Json;
const publishedIssuer = getAddress(String(signedCredential.signer));
assert(result.schema === "afterbell-browser-deployment-result/1", "invalid_browser_deployment_schema");
assert(result.status === "MAINNET_DEPLOYED_BROWSER_VERIFIED", "browser_deployment_not_complete");
assert(result.chainId === 56, "deployment_wrong_chain");
assert(/^0x[0-9a-fA-F]{40}$/.test(result.deployer), "invalid_deployer");
assert(result.deployer.toLowerCase() === expectedDeployer.toLowerCase(), "unexpected_deployment_wallet");
assert(/^0x[0-9a-fA-F]{40}$/.test(result.credentialIssuer), "invalid_credential_issuer");
assert(result.credentialIssuer.toLowerCase() === publishedIssuer.toLowerCase(), "credential_issuer_does_not_match_public_evidence");
assert(result.contracts.length === 3, "expected_three_contracts");
const expectedNames = ["ContinuityRegistry", "GuardedStockVault", "ExecutionBondEscrow"];
assert(result.contracts.every((item, index) => item.name === expectedNames[index]), "deployment_order_mismatch");
assert(new Set(result.contracts.map((item) => item.address.toLowerCase())).size === 3, "duplicate_contract_address");
assert(new Set(result.contracts.map((item) => item.transactionHash.toLowerCase())).size === 3, "duplicate_deployment_transaction");

const client = createPublicClient({ chain: bsc, transport: http(rpcUrl, { timeout: 20_000 }) });
assert(await client.getChainId() === 56, "rpc_wrong_chain");
const registry = result.contracts[0]!;
const verifiedContracts = [];

for (const record of result.contracts) {
  const artifact = await loadContractArtifact(record.name);
  const expectedConstructor = record.name === "ContinuityRegistry" ? publishedIssuer : registry.address;
  assert(record.constructorAddress.toLowerCase() === expectedConstructor.toLowerCase(), `${record.name}_constructor_record_mismatch`);
  const [receipt, transaction, deployedCode] = await Promise.all([
    client.getTransactionReceipt({ hash: record.transactionHash }),
    client.getTransaction({ hash: record.transactionHash }),
    client.getBytecode({ address: record.address })
  ]);
  assert(receipt.status === "success", `${record.name}_receipt_failed`);
  assert(receipt.contractAddress?.toLowerCase() === record.address.toLowerCase(), `${record.name}_contract_address_mismatch`);
  assert(transaction.from.toLowerCase() === result.deployer.toLowerCase(), `${record.name}_deployer_mismatch`);
  assert(transaction.to === null, `${record.name}_transaction_not_contract_creation`);
  assert(transaction.input.toLowerCase() === constructorInitCode(artifact.bytecode, expectedConstructor).toLowerCase(), `${record.name}_creation_input_mismatch`);
  assert(receipt.blockNumber.toString() === record.blockNumber, `${record.name}_block_number_mismatch`);
  assert(receipt.gasUsed.toString() === record.gasUsed, `${record.name}_gas_used_mismatch`);
  const expectedRuntime = patchRuntime(artifact, registry.address).toLowerCase();
  assert(deployedCode?.toLowerCase() === expectedRuntime, `${record.name}_runtime_bytecode_mismatch`);
  verifiedContracts.push({
    ...record,
    address: getAddress(record.address),
    receiptStatus: receipt.status,
    actualBlockNumber: receipt.blockNumber.toString(),
    actualGasUsed: receipt.gasUsed.toString(),
    constructorInputMatched: true,
    creationBytecodeHash: artifact.bytecodeHash,
    runtimeBytecodeHashTemplate: artifact.runtimeBytecodeHash,
    runtimeBytecodeMatched: true
  });
}

const registryArtifact = await loadContractArtifact("ContinuityRegistry");
const vaultArtifact = await loadContractArtifact("GuardedStockVault");
const bondArtifact = await loadContractArtifact("ExecutionBondEscrow");
const [owner, trusted, vaultRegistry, bondRegistry] = await Promise.all([
  client.readContract({ address: registry.address, abi: registryArtifact.abi, functionName: "owner" }) as Promise<Address>,
  client.readContract({ address: registry.address, abi: registryArtifact.abi, functionName: "trustedSigners", args: [result.credentialIssuer] }) as Promise<boolean>,
  client.readContract({ address: result.contracts[1]!.address, abi: vaultArtifact.abi, functionName: "registry" }) as Promise<Address>,
  client.readContract({ address: result.contracts[2]!.address, abi: bondArtifact.abi, functionName: "registry" }) as Promise<Address>
]);
assert(owner.toLowerCase() === result.deployer.toLowerCase(), "registry_owner_mismatch");
assert(trusted === true, "credential_issuer_not_trusted");
assert(vaultRegistry.toLowerCase() === registry.address.toLowerCase(), "vault_registry_mismatch");
assert(bondRegistry.toLowerCase() === registry.address.toLowerCase(), "bond_registry_mismatch");

const observedAt = new Date().toISOString();
const payload = {
  schema: "afterbell-deployment/2",
  status: "MAINNET_DEPLOYED_UNVERIFIED",
  mode: "MAINNET",
  observedAt,
  source: "BNB Chain RPC",
  chainId: 56,
  deployer: getAddress(result.deployer),
  credentialIssuer: getAddress(result.credentialIssuer),
  contracts: verifiedContracts,
  checks: {
    allReceiptsSucceeded: true,
    allCreationTransactionsMatchedDeployer: true,
    allRuntimeBytecodesMatched: true,
    registryOwnerMatchedDeployer: true,
    credentialIssuerTrusted: true,
    vaultRegistryMatched: true,
    bondRegistryMatched: true
  },
  sourceVerification: "PENDING",
  truthNotice: "Deployment receipts, runtime bytecode and registry relationships are independently verified through BNB Chain RPC. Source code verification on BscScan remains pending."
};
const evidence = createEvidenceArtifact({ artifactType: "BSC_MAINNET_DEPLOYMENT", mode: "MAINNET", observedAt, source: "BNB Chain RPC", payload });
await writeFile("evidence/deployment/bsc-mainnet.json", JSON.stringify({ ...payload, evidenceRoot: evidence.evidenceRoot }, null, 2));
console.log(JSON.stringify({
  status: payload.status,
  deployer: payload.deployer,
  credentialIssuer: payload.credentialIssuer,
  contracts: verifiedContracts.map(({ name, address, transactionHash }) => ({ name, address, transactionHash })),
  checks: payload.checks,
  sourceVerification: payload.sourceVerification,
  evidenceRoot: evidence.evidenceRoot
}, null, 2));
