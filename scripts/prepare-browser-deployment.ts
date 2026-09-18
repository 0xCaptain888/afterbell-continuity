import { mkdir, readFile, writeFile } from "node:fs/promises";
import solc from "solc";
import { encodeFunctionData } from "viem";
import { loadContractArtifact } from "../src/contracts.js";

type Json = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const credentialArtifact = JSON.parse(await readFile("evidence/live/mainnet-credential.json", "utf8")) as Json;
const credentialPayload = credentialArtifact.payload as Json;
const signedCredential = credentialPayload.signedCredential as Json;
const issuer = String(signedCredential.signer);
assert(/^0x[0-9a-fA-F]{40}$/.test(issuer), "invalid_live_credential_issuer");
const compilerVersion = (solc as typeof solc & { version(): string }).version();

const names = ["ContinuityRegistry", "GuardedStockVault", "ExecutionBondEscrow"];
const artifacts = await Promise.all(names.map((name) => loadContractArtifact(name)));
const artifactByName = (name: string) => {
  const artifact = artifacts.find((item) => item.contractName === name);
  if (!artifact) throw new Error(`missing_artifact_${name}`);
  return artifact;
};
const contract = (name: string) => {
  const artifact = artifactByName(name);
  return {
    name,
    bytecode: artifact.bytecode,
    bytecodeHash: artifact.bytecodeHash,
    runtimeBytecode: artifact.runtimeBytecode,
    runtimeBytecodeHash: artifact.runtimeBytecodeHash,
    immutableReferences: artifact.immutableReferences
  };
};

const bundle = {
  schema: "afterbell-browser-deployment/1",
  generatedAt: new Date().toISOString(),
  network: { name: "BNB Smart Chain", chainId: 56, chainIdHex: "0x38", explorer: "https://bscscan.com" },
  expectedDeployer: "0x101fd328a0b2fd9e853909651dab1c0b55947c03",
  credentialIssuer: issuer,
  compiler: { version: compilerVersion, optimizerEnabled: true, optimizerRuns: 200 },
  contracts: [
    {
      ...contract("ContinuityRegistry"),
      constructor: { kind: "ADDRESS", value: issuer },
      viewChecks: [
        { label: "owner", data: encodeFunctionData({ abi: artifactByName("ContinuityRegistry").abi, functionName: "owner" }), expected: "DEPLOYER_ADDRESS" },
        { label: "trusted issuer", data: encodeFunctionData({ abi: artifactByName("ContinuityRegistry").abi, functionName: "trustedSigners", args: [issuer] }), expected: "BOOLEAN_TRUE" }
      ]
    },
    {
      ...contract("GuardedStockVault"),
      constructor: { kind: "DEPLOYED_ADDRESS", value: "ContinuityRegistry" },
      viewChecks: [{ label: "registry", data: encodeFunctionData({ abi: artifactByName("GuardedStockVault").abi, functionName: "registry" }), expected: "ContinuityRegistry" }]
    },
    {
      ...contract("ExecutionBondEscrow"),
      constructor: { kind: "DEPLOYED_ADDRESS", value: "ContinuityRegistry" },
      viewChecks: [{ label: "registry", data: encodeFunctionData({ abi: artifactByName("ExecutionBondEscrow").abi, functionName: "registry" }), expected: "ContinuityRegistry" }]
    }
  ],
  postDeployment: {
    required: [
      "Verify all three runtime bytecodes against the compiler artifact.",
      "Confirm Registry owner equals the deployment wallet.",
      "Confirm Registry trusts the public Credential issuer.",
      "Reissue the live Credential with Registry.address as the EIP-712 verifyingContract.",
      "Verify Solidity sources on BscScan before changing status from MAINNET_DEPLOYED_UNVERIFIED."
    ]
  },
  truthNotice: "Opening this bundle does not deploy anything. Each contract creation requires a separate wallet confirmation and consumes BNB gas."
};

await mkdir(".runtime/deployment", { recursive: true });
await writeFile(".runtime/deployment/deployment-bundle.json", JSON.stringify(bundle, null, 2), { mode: 0o600 });
await writeFile(".runtime/deployment/index.html", await readFile("tools/browser-deploy.html", "utf8"), { mode: 0o600 });
await writeFile("evidence/deployment/bscscan-standard-input.json", await readFile("artifacts/solc-standard-input.json", "utf8"));
console.log(JSON.stringify({
  status: "BROWSER_DEPLOYMENT_BUNDLE_PREPARED_NOT_BROADCAST",
  output: ".runtime/deployment/index.html",
  credentialIssuer: issuer,
  contracts: bundle.contracts.map(({ name, bytecodeHash, runtimeBytecodeHash }) => ({ name, bytecodeHash, runtimeBytecodeHash })),
  financialTransactionCreated: false
}, null, 2));
